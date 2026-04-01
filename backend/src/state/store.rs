use super::*;

impl ContentStore {
    pub(super) fn new(database: Database) -> Self {
        Self {
            posts: database.collection(POSTS_COLLECTION),
            projects: database.collection(PROJECTS_COLLECTION),
            tags: database.collection(TAGS_COLLECTION),
            pages: database.collection(PAGES_COLLECTION),
            users: database.collection(USERS_COLLECTION),
            post_versions: database.collection(POST_VERSIONS_COLLECTION),
            project_versions: database.collection(PROJECT_VERSIONS_COLLECTION),
            home_versions: database.collection(HOME_VERSIONS_COLLECTION),
            release_jobs: database.collection(RELEASE_JOBS_COLLECTION),
            live_state: database.collection(LIVE_STATE_COLLECTION),
        }
    }

    pub(super) async fn load_primary_admin(
        &self,
    ) -> Result<Option<PersistedAdminProfile>, ApiError> {
        let document = self
            .users
            .find_one(doc! { "_id": DEFAULT_STATE_ID })
            .await
            .map_err(|err| ApiError::internal(format!("failed_to_load_admin_profile: {err}")))?;
        document.map(parse_admin_profile_document).transpose()
    }

    pub(super) async fn load_data(&self) -> Result<Option<PersistedData>, ApiError> {
        let posts = load_collection::<PersistedPost>(&self.posts).await?;
        let projects = load_collection::<PersistedProject>(&self.projects).await?;
        let tags = load_collection::<PersistedTag>(&self.tags).await?;
        let home = load_single::<PersistedHome>(&self.pages, HOME_DOCUMENT_ID).await?;
        let admin_profile = self
            .users
            .find_one(doc! { "_id": DEFAULT_STATE_ID })
            .await
            .map_err(|err| ApiError::internal(format!("failed_to_load_admin_profile: {err}")))?
            .map(parse_admin_profile_document)
            .transpose()?;

        let any_data = !posts.is_empty()
            || !projects.is_empty()
            || !tags.is_empty()
            || home.is_some()
            || admin_profile.is_some();
        if !any_data {
            return Ok(None);
        }

        Ok(Some(PersistedData {
            posts,
            projects,
            tags,
            home: home.unwrap_or_else(default_home),
            admin_profile: admin_profile
                .ok_or_else(|| ApiError::internal("failed_to_load_admin_profile"))?,
        }))
    }

    pub(super) async fn load_or_seedless_data(&self) -> Result<PersistedData, ApiError> {
        self.load_data()
            .await?
            .ok_or_else(|| ApiError::internal("backend state is not initialized"))
    }

    pub(super) async fn load_live_state(&self) -> Result<Option<PersistedLiveState>, ApiError> {
        let Some(document) = self
            .live_state
            .find_one(doc! { "_id": LIVE_STATE_ID })
            .await
            .map_err(|err| ApiError::internal(err.to_string()))?
        else {
            return Ok(None);
        };

        Ok(Some(parse_live_state_document(&document)))
    }

    pub(super) async fn save_data(&self, data: &PersistedData) -> Result<(), ApiError> {
        sync_collection(&self.posts, &data.posts, |item| item.id.clone()).await?;
        sync_collection(&self.projects, &data.projects, |item| item.id.clone()).await?;
        sync_collection(&self.tags, &data.tags, |item| item.id.clone()).await?;
        sync_single(&self.pages, HOME_DOCUMENT_ID, &data.home).await?;
        sync_single(&self.users, DEFAULT_STATE_ID, &data.admin_profile).await?;
        Ok(())
    }
}
