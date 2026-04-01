use super::*;

const CLOUDFLARE_DEPLOYMENT_KEY_META: &str = "cloudflare_deployment_key";

impl ContentStore {
    pub(super) async fn deploy_dashboard(
        &self,
        public_site_url: &str,
        repo: Option<&ContentRepo>,
    ) -> Result<DeployDashboardDto, ApiError> {
        let persisted_live_state = self.load_live_state().await?;
        let mut cursor = self
            .release_jobs
            .find(doc! {})
            .sort(doc! { "_id": 1_i32 })
            .await
            .map_err(|err| ApiError::internal(err.to_string()))?;
        let mut jobs = Vec::new();
        while cursor
            .advance()
            .await
            .map_err(|err| ApiError::internal(err.to_string()))?
        {
            let document = cursor
                .deserialize_current()
                .map_err(|err| ApiError::internal(err.to_string()))?;
            jobs.push(parse_release_job_document(&document));
        }
        jobs.sort_by(|left, right| {
            right
                .created_at
                .cmp(&left.created_at)
                .then_with(|| right.id.cmp(&left.id))
        });
        jobs.truncate(20);
        if let Some(repo) = repo {
            for job in &mut jobs {
                if let Some(manifest) = job.manifest.take() {
                    job.manifest = Some(enrich_manifest(repo, manifest));
                }
            }
        }
        let mut live_state = persisted_live_state
            .map(to_live_state_dto)
            .or_else(|| infer_live_state(repo, &jobs));
        if live_state.is_none() && !public_site_url.trim().is_empty() {
            let mut dto = to_live_state_dto(default_live_state());
            dto.public_base_url = Some(public_site_url.trim().to_owned());
            live_state = Some(dto);
        } else if let Some(dto) = live_state.as_mut()
            && dto.public_base_url.is_none()
            && !public_site_url.trim().is_empty()
        {
            dto.public_base_url = Some(public_site_url.trim().to_owned());
        }

        Ok(DeployDashboardDto { live_state, jobs })
    }

    pub(super) async fn live_commit_sha(&self) -> Result<Option<String>, ApiError> {
        Ok(self.load_live_state().await?.and_then(|state| {
            let value = state.live_commit_sha.trim().to_owned();
            if value.is_empty() { None } else { Some(value) }
        }))
    }

    pub(super) async fn deploy_preview(
        &self,
        public_site_url: &str,
        repo: Option<&ContentRepo>,
    ) -> Result<DeployPreviewDto, ApiError> {
        let data = self.load_or_seedless_data().await?;
        let live_state = self.load_live_state().await?;
        let current = capture_published_pointer_snapshot(&data, repo);
        let live = live_state
            .as_ref()
            .and_then(|state| state.live_pointers.clone())
            .unwrap_or_default();
        let items = build_preview_items(&data, &current, &live, self, repo).await?;
        let summary = summarize_preview(&items);
        Ok(DeployPreviewDto {
            live_state: Some(match live_state {
                Some(state) => {
                    let mut dto = to_live_state_dto(state);
                    if dto.public_base_url.is_none() && !public_site_url.trim().is_empty() {
                        dto.public_base_url = Some(public_site_url.trim().to_owned());
                    }
                    dto
                }
                None => {
                    let mut dto = to_live_state_dto(default_live_state());
                    if !public_site_url.trim().is_empty() {
                        dto.public_base_url = Some(public_site_url.trim().to_owned());
                    }
                    dto
                }
            }),
            summary,
            items,
        })
    }

    pub(super) async fn sync_deploy(
        &self,
        actor: &str,
        public_site_url: &str,
        deploy_hook_url: &str,
        http_client: &reqwest::Client,
        commit_sha: &str,
        repo: &ContentRepo,
    ) -> Result<DeployDashboardDto, ApiError> {
        let data = self.load_or_seedless_data().await?;
        let live_state = self.load_live_state().await?;
        let rollback_snapshot = live_state
            .as_ref()
            .and_then(|state| state.live_pointers.clone())
            .unwrap_or_default();
        let current = capture_published_pointer_snapshot(&data, Some(repo));
        let live = live_state
            .as_ref()
            .and_then(|state| state.live_pointers.clone())
            .unwrap_or_default();
        let preview = build_preview_items(&data, &current, &live, self, Some(repo)).await?;
        let preview_summary = summarize_preview(&preview);
        let now = now_rfc3339();
        let mut jobs = load_collection::<PersistedReleaseJob>(&self.release_jobs).await?;
        let mut meta = HashMap::new();
        meta.insert(
            "editorial_repo_dir".to_owned(),
            serde_json::Value::String(repo.path().to_owned()),
        );
        meta.insert(
            "post_count".to_owned(),
            serde_json::Value::from(data.posts.len() as i64),
        );
        meta.insert(
            "project_count".to_owned(),
            serde_json::Value::from(data.projects.len() as i64),
        );
        let hook_url = deploy_hook_url.trim();
        if hook_url.is_empty() {
            meta.insert(
                "trigger_mode".to_owned(),
                serde_json::Value::String("local_only".to_owned()),
            );
        } else {
            meta.insert(
                "trigger_mode".to_owned(),
                serde_json::Value::String("cloudflare_pages_deploy_hook".to_owned()),
            );
            meta.insert(
                "deploy_hook_url".to_owned(),
                serde_json::Value::String(hook_url.to_owned()),
            );
        }

        let requested_by = if actor.trim().is_empty() {
            "system".to_owned()
        } else {
            actor.trim().to_owned()
        };
        let manifest =
            build_publish_manifest(&requested_by, commit_sha, &preview_summary, &preview);
        let waiting_for_webhook = !hook_url.is_empty();
        let job = PersistedReleaseJob {
            id: new_persistent_id(),
            r#type: "deploy".to_owned(),
            status: if waiting_for_webhook {
                "queued".to_owned()
            } else {
                "succeeded".to_owned()
            },
            commit_sha: trim_optional_owned(Some(commit_sha.to_owned())),
            requested_by,
            logs: if waiting_for_webhook {
                vec!["queued".to_owned()]
            } else {
                vec![
                    "queued".to_owned(),
                    "dispatching".to_owned(),
                    "captured_rollback_snapshot".to_owned(),
                    "local_deploy_ready".to_owned(),
                    "deployment_succeeded".to_owned(),
                ]
            },
            meta,
            manifest: Some(manifest),
            created_at: now.clone(),
            updated_at: now.clone(),
            started_at: if waiting_for_webhook {
                None
            } else {
                Some(now.clone())
            },
            completed_at: if waiting_for_webhook {
                None
            } else {
                Some(now.clone())
            },
            rollback_snapshot: if waiting_for_webhook {
                None
            } else {
                Some(rollback_snapshot)
            },
            target_snapshot: Some(current),
        };
        let job_id = job.id.clone();
        jobs.push(job);
        sync_collection(&self.release_jobs, &jobs, |item| item.id.clone()).await?;

        if waiting_for_webhook {
            self.dispatch_next_queued_deploy(hook_url, http_client)
                .await?;
        } else {
            self.complete_waiting_deploy_success(&job_id, public_site_url, Some(repo))
                .await?;
        }

        self.deploy_dashboard(public_site_url, Some(repo)).await
    }

    pub(super) async fn accept_deploy_webhook(
        &self,
        body: &[u8],
        deploy_hook_url: &str,
        http_client: &reqwest::Client,
        repo: Option<&ContentRepo>,
    ) -> Result<(), ApiError> {
        let notification: serde_json::Value = serde_json::from_slice(body)
            .map_err(|_| ApiError::bad_request("invalid_webhook_payload"))?;
        let outcome = classify_cloudflare_notification(&notification);
        let deployment_key = extract_cloudflare_deployment_key(&notification);
        if outcome.is_empty() || outcome == "started" {
            if outcome == "started"
                && let Some(deployment_key) = deployment_key.as_deref()
            {
                self.bind_waiting_deploy_to_notification(deployment_key)
                    .await?;
            }
            return Ok(());
        }

        let Some(job_id) = self
            .waiting_deploy_job_id_for_notification(deployment_key.as_deref())
            .await?
        else {
            return Ok(());
        };
        if outcome == "success" {
            let public_base_url = notification
                .get("data")
                .and_then(serde_json::Value::as_object)
                .and_then(|data| data.get("url"))
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            self.complete_waiting_deploy_success(&job_id, public_base_url, repo)
                .await?;
            self.dispatch_next_queued_deploy(deploy_hook_url, http_client)
                .await?;
            return Ok(());
        }

        let reason = notification
            .get("text")
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .unwrap_or("cloudflare deployment failed");
        self.complete_waiting_deploy_failure(&job_id, reason)
            .await?;
        self.dispatch_next_queued_deploy(deploy_hook_url, http_client)
            .await?;
        Ok(())
    }

    async fn waiting_deploy_job_id_for_notification(
        &self,
        deployment_key: Option<&str>,
    ) -> Result<Option<String>, ApiError> {
        let mut jobs = load_collection::<PersistedReleaseJob>(&self.release_jobs).await?;
        Ok(waiting_deploy_job_id_for_notification(
            &mut jobs,
            deployment_key,
        ))
    }

    async fn bind_waiting_deploy_to_notification(
        &self,
        deployment_key: &str,
    ) -> Result<(), ApiError> {
        let mut jobs = load_collection::<PersistedReleaseJob>(&self.release_jobs).await?;
        if bind_waiting_deploy_to_notification(&mut jobs, deployment_key) {
            sync_collection(&self.release_jobs, &jobs, |item| item.id.clone()).await?;
        }
        Ok(())
    }

    async fn dispatch_next_queued_deploy(
        &self,
        deploy_hook_url: &str,
        http_client: &reqwest::Client,
    ) -> Result<(), ApiError> {
        if deploy_hook_url.trim().is_empty() {
            return Ok(());
        }
        loop {
            let now = now_rfc3339();
            let live_state = self.load_live_state().await?;
            let rollback_snapshot = live_state
                .as_ref()
                .and_then(|state| state.live_pointers.clone())
                .unwrap_or_default();
            let mut jobs = load_collection::<PersistedReleaseJob>(&self.release_jobs).await?;
            if jobs.iter().any(|job| {
                let status = job.status.trim();
                status == "waiting_result" || status == "dispatching"
            }) {
                return Ok(());
            }
            jobs.sort_by(|left, right| {
                left.created_at
                    .cmp(&right.created_at)
                    .then_with(|| left.id.cmp(&right.id))
            });
            let Some(job) = jobs
                .iter_mut()
                .find(|job| job.r#type.trim() == "deploy" && job.status.trim() == "queued")
            else {
                return Ok(());
            };

            job.status = "waiting_result".to_owned();
            job.meta.remove(CLOUDFLARE_DEPLOYMENT_KEY_META);
            job.updated_at = now.clone();
            job.started_at = Some(now.clone());
            job.rollback_snapshot = Some(rollback_snapshot);
            for line in [
                "dispatching",
                "captured_rollback_snapshot",
                "external_deploy_started",
            ] {
                if job.logs.last().map(|entry| entry != line).unwrap_or(true) {
                    job.logs.push(line.to_owned());
                }
            }
            let job_id = job.id.clone();
            sync_collection(&self.release_jobs, &jobs, |item| item.id.clone()).await?;

            if let Err(reason) = trigger_deploy_hook(http_client, deploy_hook_url).await {
                self.complete_waiting_deploy_failure(&job_id, &reason)
                    .await?;
                continue;
            }
            return Ok(());
        }
    }

    async fn complete_waiting_deploy_success(
        &self,
        job_id: &str,
        public_base_url: &str,
        repo: Option<&ContentRepo>,
    ) -> Result<(), ApiError> {
        let now = now_rfc3339();
        let mut jobs = load_collection::<PersistedReleaseJob>(&self.release_jobs).await?;
        let Some(job) = jobs.iter_mut().find(|job| job.id == job_id) else {
            return Ok(());
        };
        job.status = "succeeded".to_owned();
        job.updated_at = now.clone();
        job.completed_at = Some(now.clone());
        if job
            .logs
            .last()
            .map(|line| line != "deployment_succeeded")
            .unwrap_or(true)
        {
            job.logs.push("deployment_succeeded".to_owned());
        }

        let pointers = job
            .target_snapshot
            .clone()
            .or_else(|| Some(PublishPointerSnapshot::default()));

        let mut live_state = self
            .load_live_state()
            .await?
            .unwrap_or_else(default_live_state);
        live_state.live_commit_sha = job.commit_sha.clone().unwrap_or_default();
        live_state.last_deploy_job_id = Some(job.id.clone());
        live_state.last_successful_at = Some(now);
        live_state.public_base_url =
            trim_optional_owned(Some(if public_base_url.trim().is_empty() {
                String::new()
            } else {
                public_base_url.trim().to_owned()
            }));
        if let Some(pointers) = pointers {
            live_state.live_pointers = Some(pointers);
        }
        if let (Some(repo), Some(commit_sha), Some(manifest)) =
            (repo, job.commit_sha.as_deref(), job.manifest.as_ref())
        {
            let (author_name, author_email) =
                self.resolve_git_author_identity(&job.requested_by).await?;
            let manifest_yaml = serde_norway::to_string(manifest)
                .map_err(|err| ApiError::internal(err.to_string()))?;
            if let Err(err) = repo.record_deploy_success(
                commit_sha,
                manifest_yaml.trim(),
                &author_name,
                &author_email,
            ) {
                eprintln!("record_deploy_success failed: {err}");
                return Err(ApiError::internal(err));
            }
        }

        sync_collection(&self.release_jobs, &jobs, |item| item.id.clone()).await?;
        if let Err(err) = sync_single(&self.live_state, LIVE_STATE_ID, &live_state).await {
            eprintln!("sync_live_state failed: {err}");
        }
        Ok(())
    }

    async fn complete_waiting_deploy_failure(
        &self,
        job_id: &str,
        reason: &str,
    ) -> Result<(), ApiError> {
        let now = now_rfc3339();
        let mut jobs = load_collection::<PersistedReleaseJob>(&self.release_jobs).await?;
        let Some(job) = jobs.iter_mut().find(|job| job.id == job_id) else {
            return Ok(());
        };
        if let Some(snapshot) = job.rollback_snapshot.clone() {
            let mut live_state = self
                .load_live_state()
                .await?
                .unwrap_or_else(default_live_state);
            live_state.live_pointers = Some(snapshot);
            sync_single(&self.live_state, LIVE_STATE_ID, &live_state).await?;
        }
        job.status = "failed".to_owned();
        job.updated_at = now.clone();
        job.completed_at = Some(now);
        job.logs.push(reason.trim().to_owned());
        job.rollback_snapshot = None;
        job.target_snapshot = None;
        sync_collection(&self.release_jobs, &jobs, |item| item.id.clone()).await?;
        Ok(())
    }
}

fn active_deploy_jobs(jobs: &mut [PersistedReleaseJob]) -> Vec<&mut PersistedReleaseJob> {
    jobs.sort_by(|left, right| {
        left.created_at
            .cmp(&right.created_at)
            .then_with(|| left.id.cmp(&right.id))
    });
    jobs.iter_mut()
        .filter(|job| {
            job.r#type.trim() == "deploy"
                && matches!(job.status.trim(), "waiting_result" | "dispatching")
        })
        .collect()
}

fn waiting_deploy_job_id_for_notification(
    jobs: &mut [PersistedReleaseJob],
    deployment_key: Option<&str>,
) -> Option<String> {
    let active = active_deploy_jobs(jobs);
    let sole_active_job_id = if active.len() == 1 {
        active.first().map(|job| job.id.clone())
    } else {
        None
    };
    let deployment_key = deployment_key.map(str::trim).filter(|key| !key.is_empty());
    if let Some(deployment_key) = deployment_key {
        if let Some(job_id) = active
            .iter()
            .find(|job| {
                job.meta
                    .get(CLOUDFLARE_DEPLOYMENT_KEY_META)
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    == Some(deployment_key)
            })
            .map(|job| job.id.clone())
        {
            return Some(job_id);
        }
        if jobs.iter().any(|job| {
            !matches!(job.status.trim(), "waiting_result" | "dispatching")
                && job
                    .meta
                    .get(CLOUDFLARE_DEPLOYMENT_KEY_META)
                    .and_then(serde_json::Value::as_str)
                    .map(str::trim)
                    == Some(deployment_key)
        }) {
            return None;
        }
        return sole_active_job_id;
    }

    if let Some(job_id) = sole_active_job_id {
        return Some(job_id);
    }

    None
}

fn bind_waiting_deploy_to_notification(
    jobs: &mut [PersistedReleaseJob],
    deployment_key: &str,
) -> bool {
    let deployment_key = deployment_key.trim();
    if deployment_key.is_empty() {
        return false;
    }

    let mut active = active_deploy_jobs(jobs);
    let Some(job) = (match active.len() {
        0 => None,
        1 => active.pop(),
        _ => None,
    }) else {
        return false;
    };

    let current = job
        .meta
        .get(CLOUDFLARE_DEPLOYMENT_KEY_META)
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .unwrap_or_default();
    if current.is_empty() {
        job.meta.insert(
            CLOUDFLARE_DEPLOYMENT_KEY_META.to_owned(),
            serde_json::Value::String(deployment_key.to_owned()),
        );
        return true;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn release_job(id: &str, status: &str, created_at: &str) -> PersistedReleaseJob {
        PersistedReleaseJob {
            id: id.to_owned(),
            r#type: "deploy".to_owned(),
            status: status.to_owned(),
            commit_sha: None,
            requested_by: "system".to_owned(),
            logs: Vec::new(),
            meta: HashMap::new(),
            manifest: None,
            created_at: created_at.to_owned(),
            updated_at: created_at.to_owned(),
            started_at: None,
            completed_at: None,
            rollback_snapshot: None,
            target_snapshot: None,
        }
    }

    #[test]
    fn waiting_deploy_job_id_for_notification_returns_none_when_waiting_jobs_overlap() {
        let mut jobs = vec![
            release_job("job-3", "waiting_result", "2026-04-01T00:00:03Z"),
            release_job("job-1", "waiting_result", "2026-04-01T00:00:01Z"),
            release_job("job-2", "succeeded", "2026-04-01T00:00:02Z"),
        ];

        assert_eq!(
            waiting_deploy_job_id_for_notification(&mut jobs, Some("deploy-1")),
            None
        );
    }

    #[test]
    fn bind_waiting_deploy_to_notification_marks_single_waiting_job() {
        let mut jobs = vec![
            release_job("job-3", "queued", "2026-04-01T00:00:03Z"),
            release_job("job-1", "waiting_result", "2026-04-01T00:00:01Z"),
            release_job("job-2", "succeeded", "2026-04-01T00:00:02Z"),
        ];

        assert!(bind_waiting_deploy_to_notification(&mut jobs, "deploy-1"));
        assert_eq!(
            waiting_deploy_job_id_for_notification(&mut jobs, Some("deploy-1")).as_deref(),
            Some("job-1")
        );
    }

    #[test]
    fn waiting_deploy_job_id_for_notification_falls_back_to_single_active_job_without_key() {
        let mut jobs = vec![
            release_job("job-3", "queued", "2026-04-01T00:00:03Z"),
            release_job("job-1", "waiting_result", "2026-04-01T00:00:01Z"),
            release_job("job-2", "succeeded", "2026-04-01T00:00:02Z"),
        ];

        assert_eq!(
            waiting_deploy_job_id_for_notification(&mut jobs, None).as_deref(),
            Some("job-1")
        );
    }

    #[test]
    fn waiting_deploy_job_id_for_notification_falls_back_to_single_active_job_when_key_disagrees() {
        let mut jobs = vec![
            release_job("job-3", "queued", "2026-04-01T00:00:03Z"),
            release_job("job-1", "waiting_result", "2026-04-01T00:00:01Z"),
            release_job("job-2", "succeeded", "2026-04-01T00:00:02Z"),
        ];

        assert_eq!(
            waiting_deploy_job_id_for_notification(&mut jobs, Some("missing-key")),
            Some("job-1".to_owned())
        );
    }

    #[test]
    fn waiting_deploy_job_id_for_notification_ignores_duplicate_for_next_job() {
        let mut previous = release_job("job-1", "succeeded", "2026-04-01T00:00:01Z");
        previous.meta.insert(
            CLOUDFLARE_DEPLOYMENT_KEY_META.to_owned(),
            serde_json::Value::String("deploy-1".to_owned()),
        );
        let mut next = release_job("job-2", "waiting_result", "2026-04-01T00:00:02Z");
        next.meta.insert(
            CLOUDFLARE_DEPLOYMENT_KEY_META.to_owned(),
            serde_json::Value::String("deploy-2".to_owned()),
        );
        let mut jobs = vec![next, previous];

        assert_eq!(
            waiting_deploy_job_id_for_notification(&mut jobs, Some("deploy-1")),
            None
        );
        assert_eq!(
            waiting_deploy_job_id_for_notification(&mut jobs, Some("deploy-2")).as_deref(),
            Some("job-2")
        );
    }
}
