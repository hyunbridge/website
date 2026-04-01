use super::*;
use crate::models::AdminActor;

impl AppState {
    pub async fn get_home_document(&self) -> Result<HomeDocumentDto, ApiError> {
        self.store.get_home_document(self.repo.as_ref()).await
    }

    pub async fn get_published_home_document(&self) -> Result<Option<HomeDocumentDto>, ApiError> {
        self.store
            .get_published_home_document(self.repo.as_ref())
            .await
    }

    pub async fn save_home_draft(
        &self,
        user_id: &str,
        data: serde_json::Value,
    ) -> Result<HomeDocumentDto, ApiError> {
        self.store.save_home_draft(user_id, data).await
    }

    pub async fn save_home_version(
        &self,
        actor: &AdminActor,
        change_description: &str,
    ) -> Result<HomeDocumentDto, ApiError> {
        if let Some(repo) = self.repo.clone() {
            let home = self.get_home_document().await?;
            let snapshot = EditorialHomeSnapshot {
                id: home.id.clone(),
                title: "Homepage".to_owned(),
                data: home.data.clone(),
                summary: Some("Homepage".to_owned()),
                published_at: home.published_at.clone(),
            };
            let payload = serde_json::to_vec_pretty(&snapshot)
                .map_err(|err| ApiError::internal(err.to_string()))?;
            let subject = fallback_change_description(Some(change_description), "홈 구성 업데이트");
            let body =
                build_commit_body("home", &home.id, "Homepage").map_err(ApiError::internal)?;
            let (author_name, author_email) = self
                .store
                .resolve_git_author_identity_for_actor(actor)
                .await?;
            let commit_sha = repo
                .commit_file_with_author(
                    &home_history_path(),
                    &payload,
                    &subject,
                    &body,
                    &author_name,
                    &author_email,
                )
                .map_err(ApiError::internal)?;
            let snapshot: EditorialHomeSnapshot = serde_json::from_slice(&payload)
                .map_err(|err| ApiError::internal(err.to_string()))?;
            return self
                .store
                .overwrite_home_from_snapshot(&actor.user_id, &snapshot, &commit_sha, true)
                .await;
        }

        self.store
            .save_home_version(&actor.user_id, change_description)
            .await
    }

    pub async fn list_home_versions(&self) -> Result<Vec<HomeVersionDto>, ApiError> {
        if let Some(repo) = self.repo.clone() {
            let commits = repo
                .file_history(&home_history_path())
                .map_err(ApiError::internal)?;
            return git_home_versions_from_commits(&repo, &commits).await;
        }
        self.store.list_home_versions().await
    }

    pub async fn restore_home_version(
        &self,
        version_number: i32,
        actor: &AdminActor,
    ) -> Result<HomeDocumentDto, ApiError> {
        if let Some(repo) = self.repo.clone() {
            let versions = self.list_home_versions().await?;
            let version = versions
                .into_iter()
                .find(|version| version.version_number == version_number)
                .ok_or_else(|| {
                    ApiError::new(mongodb_not_found_status(), "home_version_not_found")
                })?;
            let payload = repo
                .read_file_at_commit(&home_history_path(), &version.id)
                .map_err(ApiError::internal)?;
            let snapshot: EditorialHomeSnapshot = serde_json::from_slice(&payload)
                .map_err(|err| ApiError::internal(err.to_string()))?;
            let subject = format!("restore home version {version_number}");
            let body = build_commit_body("home", &snapshot.id, &snapshot.title)
                .map_err(ApiError::internal)?;
            let (author_name, author_email) = self
                .store
                .resolve_git_author_identity_for_actor(actor)
                .await?;
            let commit_sha = repo
                .commit_file_with_author(
                    &home_history_path(),
                    &payload,
                    &subject,
                    &body,
                    &author_name,
                    &author_email,
                )
                .map_err(ApiError::internal)?;
            return self
                .store
                .overwrite_home_from_snapshot(&actor.user_id, &snapshot, &commit_sha, false)
                .await;
        }
        self.store
            .restore_home_version(version_number, &actor.user_id)
            .await
    }
}

impl ContentStore {
    async fn get_home_document(
        &self,
        repo: Option<&ContentRepo>,
    ) -> Result<HomeDocumentDto, ApiError> {
        let data = self.load_or_seedless_data().await?;
        Ok(to_home_document(data.home, latest_home_version_id(repo)))
    }

    async fn get_published_home_document(
        &self,
        repo: Option<&ContentRepo>,
    ) -> Result<Option<HomeDocumentDto>, ApiError> {
        let data = self.load_or_seedless_data().await?;
        let live_state = self.load_live_state().await?;
        let published_version_id = published_home_version_id(live_state.as_ref(), &data.home);
        let Some(version_id) = published_version_id else {
            return Ok(None);
        };

        if let Some(repo) = repo {
            let owner_id = repo
                .get_commit(&version_id)
                .ok()
                .and_then(|commit| resolve_home_owner_id(&data.admin_profile, &commit.author))
                .unwrap_or_else(|| data.home.owner_id.clone());
            let payload = repo
                .read_file_at_commit(&home_history_path(), &version_id)
                .map_err(ApiError::internal)?;
            let snapshot: EditorialHomeSnapshot = serde_json::from_slice(&payload)
                .map_err(|err| ApiError::internal(err.to_string()))?;
            return Ok(Some(HomeDocumentDto {
                id: data.home.id,
                owner_id,
                status: "published".to_owned(),
                updated_at: data.home.updated_at,
                published_at: trim_optional_owned(snapshot.published_at),
                current_version_id: Some(version_id.clone()),
                published_version_id: Some(version_id),
                data: snapshot.data,
                notices: Vec::new(),
            }));
        }

        let version = load_collection::<PersistedHomeVersion>(&self.home_versions)
            .await?
            .into_iter()
            .find(|version| version.id == version_id)
            .map(to_home_version_dto);
        Ok(version.map(|version| HomeDocumentDto {
            id: data.home.id,
            owner_id: data.home.owner_id,
            status: "published".to_owned(),
            updated_at: data.home.updated_at,
            published_at: data.home.published_at,
            current_version_id: Some(version.id.clone()),
            published_version_id: Some(version.id),
            data: version.data,
            notices: Vec::new(),
        }))
    }

    async fn save_home_draft(
        &self,
        user_id: &str,
        data_value: serde_json::Value,
    ) -> Result<HomeDocumentDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let now = now_rfc3339();
        data.home.data = Some(normalize_home_data_ids(data_value));
        data.home.owner_id = user_id.trim().to_owned();
        data.home.updated_at = Some(now);
        data.home.draft_dirty = true;
        let dto = to_home_document(data.home.clone(), None);
        self.save_data(&data).await?;
        Ok(dto)
    }

    async fn overwrite_home_from_snapshot(
        &self,
        owner_id: &str,
        snapshot: &EditorialHomeSnapshot,
        current_version_id: &str,
        published: bool,
    ) -> Result<HomeDocumentDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let now = now_rfc3339();
        data.home.data = Some(snapshot.data.clone());
        data.home.owner_id = owner_id.trim().to_owned();
        data.home.updated_at = Some(now.clone());
        data.home.current_version_id = trim_optional_owned(Some(current_version_id.to_owned()));
        if published {
            data.home.published_at =
                trim_optional_owned(snapshot.published_at.clone()).or_else(|| Some(now.clone()));
            data.home.published_version_id = data.home.current_version_id.clone();
        }
        data.home.draft_dirty = false;
        let document = to_home_document(data.home.clone(), None);
        self.save_data(&data).await?;
        Ok(document)
    }

    async fn save_home_version(
        &self,
        user_id: &str,
        change_description: &str,
    ) -> Result<HomeDocumentDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let mut versions = load_collection::<PersistedHomeVersion>(&self.home_versions).await?;
        let owner_id = if user_id.trim().is_empty() {
            data.home.owner_id.clone()
        } else {
            user_id.trim().to_owned()
        };
        let now = now_rfc3339();
        let next = PersistedHomeVersion {
            id: new_persistent_id(),
            page_id: data.home.id.clone(),
            version_number: next_home_version_number(&versions),
            title: "홈".to_owned(),
            data: data.home.data.clone().unwrap_or(serde_json::Value::Null),
            summary: None,
            change_description: Some(fallback_home_change_description(change_description)),
            created_at: now.clone(),
            created_by: owner_id.clone(),
        };
        data.home.owner_id = owner_id;
        data.home.updated_at = Some(now.clone());
        if data
            .home
            .published_at
            .as_deref()
            .unwrap_or("")
            .trim()
            .is_empty()
        {
            data.home.published_at = Some(now.clone());
        }
        data.home.current_version_id = Some(next.id.clone());
        data.home.published_version_id = Some(next.id.clone());
        data.home.draft_dirty = false;
        versions.push(next);
        self.save_data(&data).await?;
        sync_collection(&self.home_versions, &versions, |item| item.id.clone()).await?;
        Ok(to_home_document(data.home, None))
    }

    async fn list_home_versions(&self) -> Result<Vec<HomeVersionDto>, ApiError> {
        let mut versions: Vec<HomeVersionDto> =
            load_collection::<PersistedHomeVersion>(&self.home_versions)
                .await?
                .into_iter()
                .map(to_home_version_dto)
                .collect();
        versions.sort_by_key(|version| version.version_number);
        Ok(versions)
    }

    pub(super) async fn get_home_version_by_id(
        &self,
        version_id: &str,
    ) -> Result<HomeVersionDto, ApiError> {
        load_collection::<PersistedHomeVersion>(&self.home_versions)
            .await?
            .into_iter()
            .find(|version| version.id == version_id)
            .map(to_home_version_dto)
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "home_version_not_found"))
    }

    async fn restore_home_version(
        &self,
        version_number: i32,
        user_id: &str,
    ) -> Result<HomeDocumentDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let mut versions = load_collection::<PersistedHomeVersion>(&self.home_versions).await?;
        let source = versions
            .iter()
            .find(|version| version.version_number == version_number)
            .cloned()
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "home_version_not_found"))?;
        let owner_id = if user_id.trim().is_empty() {
            data.home.owner_id.clone()
        } else {
            user_id.trim().to_owned()
        };
        let now = now_rfc3339();
        data.home.data = Some(source.data.clone());
        data.home.owner_id = owner_id.clone();
        data.home.updated_at = Some(now.clone());
        data.home.draft_dirty = false;
        let next = PersistedHomeVersion {
            id: new_persistent_id(),
            page_id: data.home.id.clone(),
            version_number: next_home_version_number(&versions),
            title: source.title,
            data: source.data,
            summary: source.summary,
            change_description: Some(format!("restore home version {version_number}")),
            created_at: now,
            created_by: owner_id,
        };
        data.home.current_version_id = Some(next.id.clone());
        versions.push(next);
        self.save_data(&data).await?;
        sync_collection(&self.home_versions, &versions, |item| item.id.clone()).await?;
        Ok(to_home_document(data.home, None))
    }
}

fn published_home_version_id(
    live_state: Option<&PersistedLiveState>,
    home: &PersistedHome,
) -> Option<String> {
    live_state
        .and_then(|state| state.live_pointers.as_ref())
        .and_then(|snapshot| trim_optional_owned(snapshot.home.published_version_id.clone()))
        .or_else(|| trim_optional_owned(home.published_version_id.clone()))
        .or_else(|| trim_optional_owned(home.current_version_id.clone()))
}

fn resolve_home_owner_id(profile: &PersistedAdminProfile, commit_author: &str) -> Option<String> {
    let author = commit_author.trim();
    if author.is_empty() {
        return None;
    }

    let candidates = [
        profile.git_author_name.as_deref(),
        profile.full_name.as_deref(),
        Some(profile.username.as_str()),
        Some(profile.email.as_str()),
    ];

    if candidates
        .into_iter()
        .flatten()
        .map(str::trim)
        .any(|candidate| !candidate.is_empty() && candidate == author)
    {
        return trim_optional_owned(Some(profile.id.clone()));
    }

    None
}

fn to_home_document(home: PersistedHome, latest_version_id: Option<String>) -> HomeDocumentDto {
    let published_at = home.published_at.clone();
    let is_published = !published_at.as_deref().unwrap_or("").trim().is_empty();
    HomeDocumentDto {
        id: home.id,
        owner_id: home.owner_id,
        status: if !is_published {
            "draft".to_owned()
        } else {
            "published".to_owned()
        },
        updated_at: home.updated_at,
        published_at,
        current_version_id: trim_optional_owned(home.current_version_id.clone())
            .or_else(|| latest_version_id.clone()),
        published_version_id: if !is_published {
            None
        } else {
            trim_optional_owned(home.published_version_id)
                .or_else(|| trim_optional_owned(home.current_version_id))
                .or(latest_version_id)
        },
        data: home.data.unwrap_or(serde_json::Value::Null),
        notices: Vec::new(),
    }
}

pub(super) fn latest_home_version_id(repo: Option<&ContentRepo>) -> Option<String> {
    repo.and_then(|repo| {
        repo.file_history(&home_history_path())
            .ok()
            .and_then(|commits| commits.last().map(|commit| commit.sha.clone()))
    })
}

fn to_home_version_dto(version: PersistedHomeVersion) -> HomeVersionDto {
    HomeVersionDto {
        id: version.id,
        page_id: version.page_id,
        version_number: version.version_number,
        title: version.title,
        data: version.data,
        notices: Vec::new(),
        summary: version.summary,
        change_description: version.change_description,
        created_at: version.created_at,
        created_by: version.created_by,
    }
}

fn fallback_home_change_description(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "홈 구성 업데이트".to_owned()
    } else {
        trimmed.to_owned()
    }
}

fn normalize_home_data_ids(value: serde_json::Value) -> serde_json::Value {
    let mut root = match value {
        serde_json::Value::Object(map) => map,
        other => return other,
    };
    let Some(sections) = root
        .get_mut("sections")
        .and_then(serde_json::Value::as_array_mut)
    else {
        return serde_json::Value::Object(root);
    };

    for section in sections {
        let Some(section_map) = section.as_object_mut() else {
            continue;
        };
        section_map.insert(
            "id".to_owned(),
            serde_json::Value::String(canonicalize_secondary_id(section_map.get("id"))),
        );
        let section_type = section_map
            .get("type")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_owned();
        match section_type.as_str() {
            "hero" => normalize_home_collection_ids(section_map, "cards"),
            "timeline" | "cards" => normalize_home_collection_ids(section_map, "items"),
            _ => {}
        }
    }

    serde_json::Value::Object(root)
}

fn normalize_home_collection_ids(
    section_map: &mut serde_json::Map<String, serde_json::Value>,
    key: &str,
) {
    let Some(items) = section_map
        .get_mut(key)
        .and_then(serde_json::Value::as_array_mut)
    else {
        return;
    };
    for item in items {
        let Some(item_map) = item.as_object_mut() else {
            continue;
        };
        item_map.insert(
            "id".to_owned(),
            serde_json::Value::String(canonicalize_secondary_id(item_map.get("id"))),
        );
    }
}

fn canonicalize_secondary_id(value: Option<&serde_json::Value>) -> String {
    let current = value
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_owned();
    if !current.is_empty() && Ulid::from_string(&current).is_ok() {
        current
    } else {
        new_persistent_id()
    }
}
