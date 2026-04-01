use super::*;

impl ContentStore {
    pub(in crate::state) async fn find_post_by_current_version_id(
        &self,
        version_id: &str,
    ) -> Result<PersistedPost, ApiError> {
        self.load_or_seedless_data()
            .await?
            .posts
            .into_iter()
            .find(|post| post.current_version_id.as_deref() == Some(version_id))
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "post_version_not_found"))
    }

    pub(in crate::state) async fn find_post_by_published_version_id(
        &self,
        version_id: &str,
    ) -> Result<PersistedPost, ApiError> {
        self.load_or_seedless_data()
            .await?
            .posts
            .into_iter()
            .find(|post| post.published_version_id.as_deref() == Some(version_id))
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "post_version_not_found"))
    }

    pub(in crate::state) async fn overwrite_post_from_editorial(
        &self,
        post_id: &str,
        doc: &EditorialPostDocument,
        body_markdown: &str,
        current_version_id: &str,
    ) -> Result<(), ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let Some(post) = data.posts.iter_mut().find(|post| post.id == post_id) else {
            return Err(ApiError::new(mongodb_not_found_status(), "post_not_found"));
        };
        post.slug = doc.slug.trim().to_owned();
        post.title = doc.title.trim().to_owned();
        post.summary = doc.summary.clone();
        post.content = body_markdown.to_owned();
        post.published_at = trim_optional_owned(Some(doc.published_at.clone()));
        post.cover_image = trim_optional_owned(doc.cover_image.clone());
        post.enable_comments = doc.enable_comments;
        post.tag_ids = doc
            .tags
            .iter()
            .map(|tag| tag.id.trim().to_owned())
            .collect();
        post.current_version_id = trim_optional_owned(Some(current_version_id.to_owned()));
        post.updated_at = now_rfc3339();
        post.draft_dirty = false;
        self.save_data(&data).await
    }

    pub(in crate::state) async fn find_project_by_current_version_id(
        &self,
        version_id: &str,
    ) -> Result<PersistedProject, ApiError> {
        self.load_or_seedless_data()
            .await?
            .projects
            .into_iter()
            .find(|project| project.current_version_id.as_deref() == Some(version_id))
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "project_version_not_found"))
    }

    pub(in crate::state) async fn find_project_by_published_version_id(
        &self,
        version_id: &str,
    ) -> Result<PersistedProject, ApiError> {
        self.load_or_seedless_data()
            .await?
            .projects
            .into_iter()
            .find(|project| project.published_version_id.as_deref() == Some(version_id))
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "project_version_not_found"))
    }

    pub(in crate::state) async fn overwrite_project_from_editorial(
        &self,
        project_id: &str,
        doc: &EditorialProjectDocument,
        body_markdown: &str,
        current_version_id: &str,
    ) -> Result<(), ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let Some(project) = data
            .projects
            .iter_mut()
            .find(|project| project.id == project_id)
        else {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "project_not_found",
            ));
        };
        project.slug = doc.slug.trim().to_owned();
        project.title = doc.title.trim().to_owned();
        project.summary = doc.summary.clone();
        project.content = body_markdown.to_owned();
        project.published_at = trim_optional_owned(Some(doc.published_at.clone()));
        project.cover_image = trim_optional_owned(doc.cover_image.clone());
        project.sort_order = doc.sort_order;
        project.tag_ids = doc
            .tags
            .iter()
            .map(|tag| tag.id.trim().to_owned())
            .collect();
        project.links = doc
            .links
            .iter()
            .map(|link| PersistedProjectLink {
                id: trim_optional_owned(link.id.clone()).unwrap_or_else(new_persistent_id),
                label: link.label.clone(),
                url: link.url.clone(),
                link_type: trim_optional_owned(link.link_type.clone()),
                sort_order: link.sort_order,
            })
            .collect();
        project.current_version_id = trim_optional_owned(Some(current_version_id.to_owned()));
        project.updated_at = now_rfc3339();
        project.draft_dirty = false;
        self.save_data(&data).await
    }

    pub(in crate::state) async fn get_post_version_state(
        &self,
        id: &str,
    ) -> Result<
        (
            VersionStateItemDto,
            VersionStateVersionDto,
            Option<VersionStateVersionDto>,
        ),
        ApiError,
    > {
        let data = self.load_or_seedless_data().await?;
        let post = data
            .posts
            .iter()
            .find(|post| post.id == id)
            .cloned()
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "post_not_found"))?;
        let mut versions = self.list_post_versions(id).await?;
        versions.sort_by_key(|version| version.version_number);

        let current = post
            .current_version_id
            .as_ref()
            .and_then(|version_id| {
                versions
                    .iter()
                    .find(|version| &version.id == version_id)
                    .cloned()
            })
            .map(version_state_from_post_version)
            .unwrap_or_else(|| VersionStateVersionDto {
                id: post.current_version_id.clone().unwrap_or_default(),
                version_number: 0,
                title: post.title.clone(),
                summary: Some(post.summary.clone()),
                body_markdown: post.content.clone(),
                change_description: None,
            });
        let latest = versions
            .last()
            .cloned()
            .map(version_state_from_post_version);
        let item = VersionStateItemDto {
            id: post.id,
            title: post.title,
            summary: Some(post.summary),
            current_version_id: post.current_version_id,
            published_version_id: post.published_version_id,
            status: status_from_published_at(post.published_at.as_deref()),
        };
        Ok((item, current, latest))
    }

    pub(in crate::state) async fn update_post_version(
        &self,
        version_id: &str,
        title: &str,
        summary: &str,
        content: &str,
        change_description: Option<String>,
    ) -> Result<String, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let mut versions = load_collection::<PersistedPostVersion>(&self.post_versions).await?;
        let Some(post) = data
            .posts
            .iter_mut()
            .find(|post| post.current_version_id.as_deref() == Some(version_id))
        else {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "post_version_not_found",
            ));
        };

        let next = PersistedPostVersion {
            id: new_persistent_id(),
            version_number: next_post_version_number(&versions, &post.id),
            post_id: post.id.clone(),
            title: title.trim().to_owned(),
            slug: post.slug.clone(),
            content: content.to_owned(),
            summary: summary.to_owned(),
            published_at: post.published_at.clone(),
            cover_image: post.cover_image.clone(),
            enable_comments: post.enable_comments,
            tag_ids: post.tag_ids.clone(),
            change_description: trim_optional_owned(change_description),
            created_at: now_rfc3339(),
            created_by: post.author_id.clone(),
        };
        post.title = title.trim().to_owned();
        post.summary = summary.to_owned();
        post.content = content.to_owned();
        post.updated_at = now_rfc3339();
        post.current_version_id = Some(next.id.clone());
        post.draft_dirty = false;
        versions.push(next.clone());
        self.save_data(&data).await?;
        sync_collection(&self.post_versions, &versions, |item| item.id.clone()).await?;
        Ok(next.id)
    }

    pub(in crate::state) async fn create_post_version(
        &self,
        post_id: &str,
        title: &str,
        summary: &str,
        content: &str,
        actor_id: &str,
        change_description: Option<String>,
    ) -> Result<String, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let mut versions = load_collection::<PersistedPostVersion>(&self.post_versions).await?;
        let Some(post) = data.posts.iter_mut().find(|post| post.id == post_id) else {
            return Err(ApiError::new(mongodb_not_found_status(), "post_not_found"));
        };

        let next = PersistedPostVersion {
            id: new_persistent_id(),
            version_number: next_post_version_number(&versions, &post.id),
            post_id: post.id.clone(),
            title: title.trim().to_owned(),
            slug: post.slug.clone(),
            content: content.to_owned(),
            summary: summary.to_owned(),
            published_at: post.published_at.clone(),
            cover_image: post.cover_image.clone(),
            enable_comments: post.enable_comments,
            tag_ids: post.tag_ids.clone(),
            change_description: trim_optional_owned(change_description),
            created_at: now_rfc3339(),
            created_by: actor_id.trim().to_owned(),
        };
        post.title = title.trim().to_owned();
        post.summary = summary.to_owned();
        post.content = content.to_owned();
        post.author_id = actor_id.trim().to_owned();
        post.updated_at = now_rfc3339();
        post.current_version_id = Some(next.id.clone());
        post.draft_dirty = false;
        versions.push(next.clone());
        self.save_data(&data).await?;
        sync_collection(&self.post_versions, &versions, |item| item.id.clone()).await?;
        Ok(next.id)
    }

    pub(in crate::state) async fn set_post_current_version(
        &self,
        post_id: &str,
        version_id: &str,
        _title: &str,
        _summary: &str,
    ) -> Result<(), ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let versions = load_collection::<PersistedPostVersion>(&self.post_versions).await?;
        let version = versions
            .iter()
            .find(|version| version.id == version_id && version.post_id == post_id)
            .cloned()
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "post_not_found"))?;
        let Some(post) = data.posts.iter_mut().find(|post| post.id == post_id) else {
            return Err(ApiError::new(mongodb_not_found_status(), "post_not_found"));
        };

        apply_post_version(post, &version);
        post.updated_at = now_rfc3339();
        post.current_version_id = Some(version.id);
        post.draft_dirty = false;
        self.save_data(&data).await
    }

    pub(in crate::state) async fn list_post_versions(
        &self,
        post_id: &str,
    ) -> Result<Vec<PostVersionDto>, ApiError> {
        let data = self.load_or_seedless_data().await?;
        if !data.posts.iter().any(|post| post.id == post_id) {
            return Err(ApiError::new(mongodb_not_found_status(), "post_not_found"));
        }
        let mut versions: Vec<PostVersionDto> =
            load_collection::<PersistedPostVersion>(&self.post_versions)
                .await?
                .into_iter()
                .filter(|version| version.post_id == post_id)
                .map(|version| to_post_version_dto(version, &data.tags))
                .collect();
        versions.sort_by_key(|version| version.version_number);
        Ok(versions)
    }

    pub(in crate::state) async fn get_post_version_by_id(
        &self,
        version_id: &str,
    ) -> Result<PostVersionDto, ApiError> {
        let data = self.load_or_seedless_data().await?;
        load_collection::<PersistedPostVersion>(&self.post_versions)
            .await?
            .into_iter()
            .find(|version| version.id == version_id)
            .map(|version| to_post_version_dto(version, &data.tags))
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "post_version_not_found"))
    }

    pub(in crate::state) async fn get_published_post_version_by_id(
        &self,
        version_id: &str,
    ) -> Result<PostVersionDto, ApiError> {
        let data = self.load_or_seedless_data().await?;
        if !data
            .posts
            .iter()
            .any(|post| post.published_version_id.as_deref() == Some(version_id))
        {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "post_version_not_found",
            ));
        }
        self.get_post_version_by_id(version_id).await
    }

    pub(in crate::state) async fn restore_post_version(
        &self,
        post_id: &str,
        version_number: i32,
        user_id: &str,
    ) -> Result<(), ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let mut versions = load_collection::<PersistedPostVersion>(&self.post_versions).await?;
        let version = versions
            .iter()
            .find(|version| version.post_id == post_id && version.version_number == version_number)
            .cloned()
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "post_version_not_found"))?;
        let Some(post) = data.posts.iter_mut().find(|post| post.id == post_id) else {
            return Err(ApiError::new(mongodb_not_found_status(), "post_not_found"));
        };

        apply_post_version(post, &version);
        post.updated_at = now_rfc3339();
        post.draft_dirty = false;
        let next = PersistedPostVersion {
            id: new_persistent_id(),
            version_number: next_post_version_number(&versions, post_id),
            post_id: post.id.clone(),
            title: post.title.clone(),
            slug: post.slug.clone(),
            content: post.content.clone(),
            summary: post.summary.clone(),
            published_at: post.published_at.clone(),
            cover_image: post.cover_image.clone(),
            enable_comments: post.enable_comments,
            tag_ids: post.tag_ids.clone(),
            change_description: Some(format!("restore post version {version_number}")),
            created_at: now_rfc3339(),
            created_by: user_id.trim().to_owned(),
        };
        post.current_version_id = Some(next.id.clone());
        versions.push(next);
        self.save_data(&data).await?;
        sync_collection(&self.post_versions, &versions, |item| item.id.clone()).await
    }

    pub(in crate::state) async fn get_project_version_state(
        &self,
        id: &str,
    ) -> Result<
        (
            VersionStateItemDto,
            VersionStateVersionDto,
            Option<VersionStateVersionDto>,
        ),
        ApiError,
    > {
        let data = self.load_or_seedless_data().await?;
        let project = data
            .projects
            .iter()
            .find(|project| project.id == id)
            .cloned()
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "project_not_found"))?;
        let mut versions = self.list_project_versions(id).await?;
        versions.sort_by_key(|version| version.version_number);

        let current = project
            .current_version_id
            .as_ref()
            .and_then(|version_id| {
                versions
                    .iter()
                    .find(|version| &version.id == version_id)
                    .cloned()
            })
            .map(version_state_from_project_version)
            .unwrap_or_else(|| VersionStateVersionDto {
                id: project.current_version_id.clone().unwrap_or_default(),
                version_number: 0,
                title: project.title.clone(),
                summary: Some(project.summary.clone()),
                body_markdown: project.content.clone(),
                change_description: None,
            });
        let latest = versions
            .last()
            .cloned()
            .map(version_state_from_project_version);
        let item = VersionStateItemDto {
            id: project.id,
            title: project.title,
            summary: Some(project.summary),
            current_version_id: project.current_version_id,
            published_version_id: project.published_version_id,
            status: status_from_published_at(project.published_at.as_deref()),
        };
        Ok((item, current, latest))
    }

    pub(in crate::state) async fn update_project_version(
        &self,
        version_id: &str,
        title: &str,
        summary: &str,
        content: &str,
        links: Vec<ProjectLinkDto>,
        change_description: Option<String>,
    ) -> Result<String, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let mut versions =
            load_collection::<PersistedProjectVersion>(&self.project_versions).await?;
        let Some(project) = data
            .projects
            .iter_mut()
            .find(|project| project.current_version_id.as_deref() == Some(version_id))
        else {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "project_version_not_found",
            ));
        };
        let normalized_links = normalize_project_links(links);
        let next = PersistedProjectVersion {
            id: new_persistent_id(),
            version_number: next_project_version_number(&versions, &project.id),
            project_id: project.id.clone(),
            title: title.trim().to_owned(),
            slug: project.slug.clone(),
            content: content.to_owned(),
            summary: summary.to_owned(),
            published_at: project.published_at.clone(),
            cover_image: project.cover_image.clone(),
            sort_order: project.sort_order,
            tag_ids: project.tag_ids.clone(),
            links: normalized_links.clone(),
            change_description: trim_optional_owned(change_description),
            created_at: now_rfc3339(),
            created_by: project.owner_id.clone(),
        };
        project.title = title.trim().to_owned();
        project.summary = summary.to_owned();
        project.content = content.to_owned();
        project.links = normalized_links;
        project.updated_at = now_rfc3339();
        project.current_version_id = Some(next.id.clone());
        project.draft_dirty = false;
        versions.push(next.clone());
        self.save_data(&data).await?;
        sync_collection(&self.project_versions, &versions, |item| item.id.clone()).await?;
        Ok(next.id)
    }

    pub(in crate::state) async fn create_project_version(
        &self,
        request: CreateProjectVersionRequest,
        actor_id: &str,
    ) -> Result<String, ApiError> {
        let CreateProjectVersionRequest {
            project_id,
            title,
            summary,
            content,
            links,
            change_description,
        } = request;
        let mut data = self.load_or_seedless_data().await?;
        let mut versions =
            load_collection::<PersistedProjectVersion>(&self.project_versions).await?;
        let Some(project) = data
            .projects
            .iter_mut()
            .find(|project| project.id == project_id)
        else {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "project_not_found",
            ));
        };
        let normalized_links = normalize_project_links(links);
        let next = PersistedProjectVersion {
            id: new_persistent_id(),
            version_number: next_project_version_number(&versions, &project.id),
            project_id: project.id.clone(),
            title: title.trim().to_owned(),
            slug: project.slug.clone(),
            content: content.to_owned(),
            summary: summary.to_owned(),
            published_at: project.published_at.clone(),
            cover_image: project.cover_image.clone(),
            sort_order: project.sort_order,
            tag_ids: project.tag_ids.clone(),
            links: normalized_links.clone(),
            change_description: trim_optional_owned(change_description),
            created_at: now_rfc3339(),
            created_by: actor_id.trim().to_owned(),
        };
        project.title = title.trim().to_owned();
        project.summary = summary.to_owned();
        project.content = content.to_owned();
        project.links = normalized_links;
        project.owner_id = actor_id.trim().to_owned();
        project.updated_at = now_rfc3339();
        project.current_version_id = Some(next.id.clone());
        project.draft_dirty = false;
        versions.push(next.clone());
        self.save_data(&data).await?;
        sync_collection(&self.project_versions, &versions, |item| item.id.clone()).await?;
        Ok(next.id)
    }

    pub(in crate::state) async fn set_project_current_version(
        &self,
        project_id: &str,
        version_id: &str,
        _title: &str,
        _summary: &str,
    ) -> Result<(), ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let versions = load_collection::<PersistedProjectVersion>(&self.project_versions).await?;
        let version = versions
            .iter()
            .find(|version| version.id == version_id && version.project_id == project_id)
            .cloned()
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "project_not_found"))?;
        let Some(project) = data
            .projects
            .iter_mut()
            .find(|project| project.id == project_id)
        else {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "project_not_found",
            ));
        };

        apply_project_version(project, &version);
        project.updated_at = now_rfc3339();
        project.current_version_id = Some(version.id);
        project.draft_dirty = false;
        self.save_data(&data).await
    }

    pub(in crate::state) async fn list_project_versions(
        &self,
        project_id: &str,
    ) -> Result<Vec<ProjectVersionDto>, ApiError> {
        let data = self.load_or_seedless_data().await?;
        if !data.projects.iter().any(|project| project.id == project_id) {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "project_not_found",
            ));
        }
        let mut versions: Vec<ProjectVersionDto> =
            load_collection::<PersistedProjectVersion>(&self.project_versions)
                .await?
                .into_iter()
                .filter(|version| version.project_id == project_id)
                .map(|version| to_project_version_dto(version, &data.tags))
                .collect();
        versions.sort_by_key(|version| version.version_number);
        Ok(versions)
    }

    pub(in crate::state) async fn get_project_version_by_id(
        &self,
        version_id: &str,
    ) -> Result<ProjectVersionDto, ApiError> {
        let data = self.load_or_seedless_data().await?;
        load_collection::<PersistedProjectVersion>(&self.project_versions)
            .await?
            .into_iter()
            .find(|version| version.id == version_id)
            .map(|version| to_project_version_dto(version, &data.tags))
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "project_version_not_found"))
    }

    pub(in crate::state) async fn get_published_project_version_by_id(
        &self,
        version_id: &str,
    ) -> Result<ProjectVersionDto, ApiError> {
        let data = self.load_or_seedless_data().await?;
        if !data
            .projects
            .iter()
            .any(|project| project.published_version_id.as_deref() == Some(version_id))
        {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "project_version_not_found",
            ));
        }
        self.get_project_version_by_id(version_id).await
    }

    pub(in crate::state) async fn restore_project_version(
        &self,
        project_id: &str,
        version_number: i32,
        user_id: &str,
    ) -> Result<(), ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let mut versions =
            load_collection::<PersistedProjectVersion>(&self.project_versions).await?;
        let version = versions
            .iter()
            .find(|version| {
                version.project_id == project_id && version.version_number == version_number
            })
            .cloned()
            .ok_or_else(|| {
                ApiError::new(mongodb_not_found_status(), "project_version_not_found")
            })?;
        let Some(project) = data
            .projects
            .iter_mut()
            .find(|project| project.id == project_id)
        else {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "project_not_found",
            ));
        };

        apply_project_version(project, &version);
        project.updated_at = now_rfc3339();
        project.draft_dirty = false;
        let next = PersistedProjectVersion {
            id: new_persistent_id(),
            version_number: next_project_version_number(&versions, project_id),
            project_id: project.id.clone(),
            title: project.title.clone(),
            slug: project.slug.clone(),
            content: project.content.clone(),
            summary: project.summary.clone(),
            published_at: project.published_at.clone(),
            cover_image: project.cover_image.clone(),
            sort_order: project.sort_order,
            tag_ids: project.tag_ids.clone(),
            links: project.links.clone(),
            change_description: Some(format!("restore project version {version_number}")),
            created_at: now_rfc3339(),
            created_by: user_id.trim().to_owned(),
        };
        project.current_version_id = Some(next.id.clone());
        versions.push(next);
        self.save_data(&data).await?;
        sync_collection(&self.project_versions, &versions, |item| item.id.clone()).await
    }
}
