use super::*;
use crate::models::AdminActor;

impl AppState {
    pub async fn deploy_dashboard(&self) -> Result<DeployDashboardDto, ApiError> {
        self.store
            .deploy_dashboard(&self.config.public_site_url, self.repo.as_ref())
            .await
    }

    pub async fn deploy_preview(&self) -> Result<DeployPreviewDto, ApiError> {
        self.store
            .deploy_preview(&self.config.public_site_url, self.repo.as_ref())
            .await
    }

    pub async fn sync_deploy(&self, actor: &AdminActor) -> Result<DeployDashboardDto, ApiError> {
        let repo = self.repo.as_ref().ok_or_else(|| {
            ApiError::new(
                http::StatusCode::NOT_IMPLEMENTED,
                "content_repo_not_configured",
            )
        })?;
        let export = self.current_site_export("").await?;
        let payload = serde_json::to_vec_pretty(&export)
            .map_err(|err| ApiError::internal(err.to_string()))?;
        let (author_name, author_email) = self
            .store
            .resolve_git_author_identity_for_actor(actor)
            .await?;
        let commit_sha = repo
            .commit_public_export_with_author(&payload, &actor.user_id, &author_name, &author_email)
            .map_err(ApiError::internal)?;
        self.store
            .sync_deploy(
                &actor.user_id,
                &self.config.public_site_url,
                &self.config.cloudflare_pages_deploy_hook_url,
                &self.http_client,
                &commit_sha,
                repo,
            )
            .await
    }

    pub async fn accept_deploy_webhook(&self, body: &[u8]) -> Result<(), ApiError> {
        self.store
            .accept_deploy_webhook(
                body,
                &self.config.cloudflare_pages_deploy_hook_url,
                &self.http_client,
                self.repo.as_ref(),
            )
            .await
    }

    pub async fn current_site_export(
        &self,
        live_commit_sha: &str,
    ) -> Result<PublicSiteExportDto, ApiError> {
        if !live_commit_sha.trim().is_empty()
            && let Some(snapshot) = self.load_site_export_at(live_commit_sha).await?
        {
            return Ok(snapshot);
        }
        Ok(PublicSiteExportDto {
            release: PublicSiteReleaseDto {
                live_commit_sha: live_commit_sha.trim().to_owned(),
                generated_at: humantime::format_rfc3339_seconds(SystemTime::now()).to_string(),
            },
            home: if live_commit_sha.trim().is_empty() {
                self.get_published_home_document().await?
            } else {
                None
            },
            posts: self
                .store
                .list_public_posts_unpaginated(self.repo.as_ref(), "")
                .await?,
            projects: self.list_public_projects().await?,
            tags: self.list_tags().await?,
        })
    }

    pub async fn snapshot_commit_sha(&self, at: &str) -> Result<Option<String>, ApiError> {
        if !at.trim().is_empty() {
            return Ok(Some(at.trim().to_owned()));
        }
        let commit_sha = self.store.live_commit_sha().await?;
        if commit_sha.is_some() {
            return Ok(commit_sha);
        }
        if let Some(repo) = &self.repo
            && let Ok((_, commit_sha)) = repo.resolve_reference("refs/publish/deploy/live")
            && !commit_sha.trim().is_empty()
        {
            return Ok(Some(commit_sha));
        }
        Ok(None)
    }

    pub async fn load_site_export_at(
        &self,
        commit_sha: &str,
    ) -> Result<Option<PublicSiteExportDto>, ApiError> {
        let repo = match &self.repo {
            Some(repo) => repo,
            None => return Ok(None),
        };
        let commit_sha = commit_sha.trim();
        if commit_sha.is_empty() {
            return Ok(None);
        }
        let data = self.store.load_or_seedless_data().await?;
        Ok(Some(
            build_site_export_from_commit(repo, &data.admin_profile, commit_sha, self)
                .await?
                .unwrap_or(PublicSiteExportDto {
                    release: PublicSiteReleaseDto {
                        live_commit_sha: commit_sha.to_owned(),
                        generated_at: humantime::format_rfc3339_seconds(SystemTime::now())
                            .to_string(),
                    },
                    home: self.get_published_home_document().await?,
                    posts: Vec::new(),
                    projects: Vec::new(),
                    tags: Vec::new(),
                }),
        ))
    }
}
