use super::*;

impl AppState {
    pub async fn list_public_posts(
        &self,
        tag_id: &str,
        page: i32,
        page_size: i32,
    ) -> Result<Vec<PostDto>, ApiError> {
        self.store
            .list_public_posts(self.repo.as_ref(), tag_id, page, page_size)
            .await
    }

    pub async fn list_admin_posts(
        &self,
        include_draft: bool,
        tag_id: &str,
        page: i32,
        page_size: i32,
    ) -> Result<Vec<PostDto>, ApiError> {
        self.store
            .list_posts(include_draft, tag_id, page, page_size)
            .await
    }

    pub async fn get_public_post(&self, slug: &str) -> Result<PostDto, ApiError> {
        self.store
            .get_public_post_by_slug(self.repo.as_ref(), slug)
            .await
    }

    pub async fn get_admin_post_by_id(&self, id: &str) -> Result<PostDto, ApiError> {
        self.store.get_post_by_id(id).await
    }

    pub async fn create_post(
        &self,
        author_id: &str,
        title: &str,
        slug: &str,
        summary: &str,
    ) -> Result<PostDto, ApiError> {
        self.store
            .create_post(author_id, title, slug, summary)
            .await
    }

    pub async fn patch_post(&self, id: &str, patch: PostPatch) -> Result<PostDto, ApiError> {
        self.store.patch_post(id, patch).await
    }

    pub async fn set_post_published(&self, id: &str, published: bool) -> Result<PostDto, ApiError> {
        self.store.set_post_published(id, published).await
    }

    pub async fn delete_post(&self, id: &str) -> Result<Vec<String>, ApiError> {
        self.store.delete_post(id).await
    }

    pub async fn add_post_asset(&self, id: &str, object_key: &str) -> Result<(), ApiError> {
        self.store.add_post_asset(id, object_key).await
    }

    pub async fn list_public_projects(&self) -> Result<Vec<ProjectDto>, ApiError> {
        self.store.list_public_projects(self.repo.as_ref()).await
    }

    pub async fn list_admin_projects(
        &self,
        include_draft: bool,
    ) -> Result<Vec<ProjectDto>, ApiError> {
        self.store.list_projects(include_draft).await
    }

    pub async fn get_public_project(&self, slug: &str) -> Result<ProjectDto, ApiError> {
        self.store
            .get_public_project_by_slug(self.repo.as_ref(), slug)
            .await
    }

    pub async fn get_admin_project_by_id(&self, id: &str) -> Result<ProjectDto, ApiError> {
        self.store.get_project_by_id(id).await
    }

    pub async fn create_project(
        &self,
        owner_id: &str,
        title: &str,
        slug: &str,
        summary: &str,
    ) -> Result<ProjectDto, ApiError> {
        self.store
            .create_project(owner_id, title, slug, summary)
            .await
    }

    pub async fn patch_project(
        &self,
        id: &str,
        patch: ProjectPatch,
    ) -> Result<ProjectDto, ApiError> {
        self.store.patch_project(id, patch).await
    }

    pub async fn set_project_published(
        &self,
        id: &str,
        published: bool,
    ) -> Result<ProjectDto, ApiError> {
        self.store.set_project_published(id, published).await
    }

    pub async fn delete_project(&self, id: &str) -> Result<Vec<String>, ApiError> {
        self.store.delete_project(id).await
    }

    pub async fn add_project_asset(&self, id: &str, object_key: &str) -> Result<(), ApiError> {
        self.store.add_project_asset(id, object_key).await
    }

    pub async fn list_tags(&self) -> Result<Vec<TagDto>, ApiError> {
        self.store.list_tags().await
    }

    pub async fn create_tag(&self, name: &str, slug: &str) -> Result<TagDto, ApiError> {
        self.store.create_tag(name, slug).await
    }

    pub async fn update_tag(&self, id: &str, name: &str, slug: &str) -> Result<TagDto, ApiError> {
        self.store.update_tag(id, name, slug).await
    }

    pub async fn delete_tag(&self, id: &str) -> Result<(), ApiError> {
        self.store.delete_tag(id).await
    }

    pub async fn counts(&self) -> Result<CountsResponse, ApiError> {
        self.store.counts().await
    }
}

impl ContentStore {
    async fn list_public_posts(
        &self,
        repo: Option<&ContentRepo>,
        tag_id: &str,
        page: i32,
        page_size: i32,
    ) -> Result<Vec<PostDto>, ApiError> {
        let mut items = self.list_public_posts_unpaginated(repo, tag_id).await?;
        if !tag_id.trim().is_empty() {
            items.retain(|post| post.tags.iter().any(|tag| tag.id == tag_id.trim()));
        }
        Ok(paginate(items, page, page_size))
    }

    pub(crate) async fn list_public_posts_unpaginated(
        &self,
        repo: Option<&ContentRepo>,
        tag_id: &str,
    ) -> Result<Vec<PostDto>, ApiError> {
        let data = self.load_or_seedless_data().await?;
        let live_state = self.load_live_state().await?;
        let post_versions: HashMap<String, PersistedPostVersion> =
            load_collection::<PersistedPostVersion>(&self.post_versions)
                .await?
                .into_iter()
                .map(|version| (version.id.clone(), version))
                .collect();
        let mut posts = data.posts.clone();
        posts.sort_by(|left, right| {
            right
                .created_at
                .cmp(&left.created_at)
                .then_with(|| right.id.cmp(&left.id))
        });
        let admin = data.admin_profile.clone();
        let tags = data.tags.clone();
        let mut items: Vec<PostDto> = posts
            .into_iter()
            .filter(|post| post.published_at.as_deref().unwrap_or("").trim() != "")
            .filter_map(|post| {
                resolve_public_post_dto(
                    post,
                    live_state.as_ref(),
                    &post_versions,
                    repo,
                    &tags,
                    &admin,
                )
            })
            .collect();
        if !tag_id.trim().is_empty() {
            items.retain(|post| post.tags.iter().any(|tag| tag.id == tag_id.trim()));
        }
        Ok(items)
    }

    async fn list_posts(
        &self,
        include_draft: bool,
        tag_id: &str,
        page: i32,
        page_size: i32,
    ) -> Result<Vec<PostDto>, ApiError> {
        let data = self.load_or_seedless_data().await?;
        let mut posts = data.posts.clone();
        posts.sort_by(|left, right| {
            right
                .created_at
                .cmp(&left.created_at)
                .then_with(|| right.id.cmp(&left.id))
        });
        let admin = data.admin_profile.clone();
        let tags = data.tags.clone();
        let mut items: Vec<PostDto> = posts
            .into_iter()
            .filter(|post| include_draft || post.published_at.as_deref().unwrap_or("").trim() != "")
            .map(|post| to_post_dto(post, &tags, &admin))
            .collect();
        if !tag_id.trim().is_empty() {
            items.retain(|post| post.tags.iter().any(|tag| tag.id == tag_id.trim()));
        }
        Ok(paginate(items, page, page_size))
    }

    pub(super) async fn get_post_by_id(&self, id: &str) -> Result<PostDto, ApiError> {
        let data = self.load_or_seedless_data().await?;
        let admin = data.admin_profile.clone();
        let tags = data.tags.clone();
        data.posts
            .into_iter()
            .find(|post| post.id == id)
            .map(|post| to_post_dto(post, &tags, &admin))
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "post_not_found"))
    }

    async fn get_public_post_by_slug(
        &self,
        repo: Option<&ContentRepo>,
        slug: &str,
    ) -> Result<PostDto, ApiError> {
        let data = self.load_or_seedless_data().await?;
        let live_state = self.load_live_state().await?;
        let post_versions: HashMap<String, PersistedPostVersion> =
            load_collection::<PersistedPostVersion>(&self.post_versions)
                .await?
                .into_iter()
                .map(|version| (version.id.clone(), version))
                .collect();
        let admin = data.admin_profile.clone();
        let tags = data.tags.clone();
        data.posts
            .into_iter()
            .filter(|post| post.published_at.as_deref().unwrap_or("").trim() != "")
            .filter_map(|post| {
                resolve_public_post_dto(
                    post,
                    live_state.as_ref(),
                    &post_versions,
                    repo,
                    &tags,
                    &admin,
                )
            })
            .find(|post| post.slug == slug)
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "post_not_found"))
    }

    async fn list_public_projects(
        &self,
        repo: Option<&ContentRepo>,
    ) -> Result<Vec<ProjectDto>, ApiError> {
        let data = self.load_or_seedless_data().await?;
        let live_state = self.load_live_state().await?;
        let project_versions: HashMap<String, PersistedProjectVersion> =
            load_collection::<PersistedProjectVersion>(&self.project_versions)
                .await?
                .into_iter()
                .map(|version| (version.id.clone(), version))
                .collect();
        let admin = data.admin_profile.clone();
        let tags = data.tags.clone();
        let mut items: Vec<ProjectDto> = data
            .projects
            .into_iter()
            .filter(|project| project.published_at.as_deref().unwrap_or("").trim() != "")
            .filter_map(|project| {
                resolve_public_project_dto(
                    project,
                    live_state.as_ref(),
                    &project_versions,
                    repo,
                    &tags,
                    &admin,
                )
            })
            .collect();
        items.sort_by(|left, right| {
            left.sort_order
                .cmp(&right.sort_order)
                .then_with(|| right.published_at.cmp(&left.published_at))
                .then_with(|| left.slug.cmp(&right.slug))
        });
        Ok(items)
    }

    async fn create_post(
        &self,
        author_id: &str,
        title: &str,
        slug: &str,
        summary: &str,
    ) -> Result<PostDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let now = now_rfc3339();
        let post = PersistedPost {
            id: new_persistent_id(),
            created_at: now.clone(),
            updated_at: now,
            title: title.to_owned(),
            slug: slug.to_owned(),
            content: String::new(),
            author_id: author_id.trim().to_owned(),
            summary: summary.to_owned(),
            cover_image: None,
            published_at: None,
            published_version_id: None,
            current_version_id: None,
            enable_comments: true,
            tag_ids: Vec::new(),
            asset_keys: Vec::new(),
            draft_dirty: true,
        };
        data.posts.insert(0, post.clone());
        self.save_data(&data).await?;
        Ok(to_post_dto(post, &data.tags, &data.admin_profile))
    }

    async fn patch_post(&self, id: &str, patch: PostPatch) -> Result<PostDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let Some(post) = data.posts.iter_mut().find(|post| post.id == id) else {
            return Err(ApiError::new(mongodb_not_found_status(), "post_not_found"));
        };

        if let Some(title) = patch.title {
            post.title = title;
        }
        if let Some(slug) = patch.slug {
            post.slug = slug;
        }
        if let Some(summary) = patch.summary {
            post.summary = summary;
        }
        if let Some(content) = patch.content {
            post.content = content;
        }
        if let Some(cover_image) = patch.cover_image {
            post.cover_image = trim_optional_owned(Some(cover_image));
        }
        if let Some(published_at) = patch.published_at {
            post.published_at = trim_optional_owned(Some(published_at));
        }
        if let Some(enable_comments) = patch.enable_comments {
            post.enable_comments = enable_comments;
        }
        if let Some(tag_ids) = patch.tag_ids {
            post.tag_ids = tag_ids;
        }
        post.updated_at = now_rfc3339();
        post.draft_dirty = true;

        let result = to_post_dto(post.clone(), &data.tags, &data.admin_profile);
        self.save_data(&data).await?;
        Ok(result)
    }

    async fn set_post_published(&self, id: &str, published: bool) -> Result<PostDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let versions = if published {
            Some(load_collection::<PersistedPostVersion>(&self.post_versions).await?)
        } else {
            None
        };
        let Some(post) = data.posts.iter_mut().find(|post| post.id == id) else {
            return Err(ApiError::new(mongodb_not_found_status(), "post_not_found"));
        };

        let now = now_rfc3339();
        post.published_at = if published {
            published_at_on_publish(post.published_at.clone(), &now)
        } else {
            None
        };
        post.published_version_id = if published {
            let current_version_id = post.current_version_id.clone().or_else(|| {
                versions.as_ref().and_then(|items| {
                    items
                        .iter()
                        .filter(|version| version.post_id == post.id)
                        .max_by_key(|version| version.version_number)
                        .map(|version| version.id.clone())
                })
            });
            let Some(current_version_id) = current_version_id else {
                return Err(ApiError::new(mongodb_not_found_status(), "post_not_found"));
            };
            post.current_version_id = Some(current_version_id.clone());
            Some(current_version_id)
        } else {
            None
        };
        post.updated_at = now;
        let result = to_post_dto(post.clone(), &data.tags, &data.admin_profile);
        self.save_data(&data).await?;
        Ok(result)
    }

    async fn delete_post(&self, id: &str) -> Result<Vec<String>, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let Some(index) = data.posts.iter().position(|post| post.id == id) else {
            return Err(ApiError::new(mongodb_not_found_status(), "post_not_found"));
        };
        let removed = data.posts.remove(index);
        self.save_data(&data).await?;
        Ok(removed.asset_keys)
    }

    async fn add_post_asset(&self, id: &str, object_key: &str) -> Result<(), ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let Some(post) = data.posts.iter_mut().find(|post| post.id == id) else {
            return Err(ApiError::new(mongodb_not_found_status(), "post_not_found"));
        };
        let key = object_key.trim();
        if !key.is_empty() && !post.asset_keys.iter().any(|candidate| candidate == key) {
            post.asset_keys.push(key.to_owned());
            post.updated_at = now_rfc3339();
            post.draft_dirty = true;
            self.save_data(&data).await?;
        }
        Ok(())
    }

    async fn list_projects(&self, include_draft: bool) -> Result<Vec<ProjectDto>, ApiError> {
        let data = self.load_or_seedless_data().await?;
        let admin = data.admin_profile.clone();
        let tags = data.tags.clone();
        let mut items: Vec<ProjectDto> = data
            .projects
            .into_iter()
            .filter(|project| {
                include_draft || project.published_at.as_deref().unwrap_or("").trim() != ""
            })
            .map(|project| to_project_dto(project, &tags, &admin))
            .collect();
        items.sort_by_key(|project| project.sort_order);
        Ok(items)
    }

    pub(super) async fn get_project_by_id(&self, id: &str) -> Result<ProjectDto, ApiError> {
        let data = self.load_or_seedless_data().await?;
        let admin = data.admin_profile.clone();
        let tags = data.tags.clone();
        data.projects
            .into_iter()
            .find(|project| project.id == id)
            .map(|project| to_project_dto(project, &tags, &admin))
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "project_not_found"))
    }

    async fn get_public_project_by_slug(
        &self,
        repo: Option<&ContentRepo>,
        slug: &str,
    ) -> Result<ProjectDto, ApiError> {
        let data = self.load_or_seedless_data().await?;
        let live_state = self.load_live_state().await?;
        let project_versions: HashMap<String, PersistedProjectVersion> =
            load_collection::<PersistedProjectVersion>(&self.project_versions)
                .await?
                .into_iter()
                .map(|version| (version.id.clone(), version))
                .collect();
        let admin = data.admin_profile.clone();
        let tags = data.tags.clone();
        data.projects
            .into_iter()
            .filter(|project| project.published_at.as_deref().unwrap_or("").trim() != "")
            .filter_map(|project| {
                resolve_public_project_dto(
                    project,
                    live_state.as_ref(),
                    &project_versions,
                    repo,
                    &tags,
                    &admin,
                )
            })
            .find(|project| project.slug == slug)
            .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "project_not_found"))
    }

    async fn create_project(
        &self,
        owner_id: &str,
        title: &str,
        slug: &str,
        summary: &str,
    ) -> Result<ProjectDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let now = now_rfc3339();
        let project = PersistedProject {
            id: new_persistent_id(),
            created_at: now.clone(),
            updated_at: now,
            title: title.to_owned(),
            slug: slug.to_owned(),
            content: String::new(),
            owner_id: owner_id.trim().to_owned(),
            summary: summary.to_owned(),
            cover_image: None,
            published_at: None,
            published_version_id: None,
            current_version_id: None,
            sort_order: data.projects.len() as i32,
            tag_ids: Vec::new(),
            asset_keys: Vec::new(),
            links: Vec::new(),
            draft_dirty: true,
        };
        data.projects.push(project.clone());
        self.save_data(&data).await?;
        Ok(to_project_dto(project, &data.tags, &data.admin_profile))
    }

    async fn patch_project(&self, id: &str, patch: ProjectPatch) -> Result<ProjectDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let Some(project) = data.projects.iter_mut().find(|project| project.id == id) else {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "project_not_found",
            ));
        };

        if let Some(title) = patch.title {
            project.title = title;
        }
        if let Some(slug) = patch.slug {
            project.slug = slug;
        }
        if let Some(summary) = patch.summary {
            project.summary = summary;
        }
        if let Some(content) = patch.content {
            project.content = content;
        }
        if let Some(cover_image) = patch.cover_image {
            project.cover_image = trim_optional_owned(Some(cover_image));
        }
        if let Some(published_at) = patch.published_at {
            project.published_at = trim_optional_owned(Some(published_at));
        }
        if let Some(sort_order) = patch.sort_order {
            project.sort_order = sort_order;
        }
        if let Some(tag_ids) = patch.tag_ids {
            project.tag_ids = tag_ids;
        }
        if let Some(links) = patch.links {
            project.links = normalize_project_links(links);
        }
        project.updated_at = now_rfc3339();
        project.draft_dirty = true;

        let result = to_project_dto(project.clone(), &data.tags, &data.admin_profile);
        self.save_data(&data).await?;
        Ok(result)
    }

    async fn set_project_published(
        &self,
        id: &str,
        published: bool,
    ) -> Result<ProjectDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let versions = if published {
            Some(load_collection::<PersistedProjectVersion>(&self.project_versions).await?)
        } else {
            None
        };
        let Some(project) = data.projects.iter_mut().find(|project| project.id == id) else {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "project_not_found",
            ));
        };
        let now = now_rfc3339();
        project.published_at = if published {
            published_at_on_publish(project.published_at.clone(), &now)
        } else {
            None
        };
        project.published_version_id = if published {
            let current_version_id = project.current_version_id.clone().or_else(|| {
                versions.as_ref().and_then(|items| {
                    items
                        .iter()
                        .filter(|version| version.project_id == project.id)
                        .max_by_key(|version| version.version_number)
                        .map(|version| version.id.clone())
                })
            });
            let Some(current_version_id) = current_version_id else {
                return Err(ApiError::new(
                    mongodb_not_found_status(),
                    "project_not_found",
                ));
            };
            project.current_version_id = Some(current_version_id.clone());
            Some(current_version_id)
        } else {
            None
        };
        project.updated_at = now;
        let result = to_project_dto(project.clone(), &data.tags, &data.admin_profile);
        self.save_data(&data).await?;
        Ok(result)
    }

    async fn delete_project(&self, id: &str) -> Result<Vec<String>, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let Some(index) = data.projects.iter().position(|project| project.id == id) else {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "project_not_found",
            ));
        };
        let removed = data.projects.remove(index);
        self.save_data(&data).await?;
        Ok(removed.asset_keys)
    }

    async fn add_project_asset(&self, id: &str, object_key: &str) -> Result<(), ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let Some(project) = data.projects.iter_mut().find(|project| project.id == id) else {
            return Err(ApiError::new(
                mongodb_not_found_status(),
                "project_not_found",
            ));
        };
        let key = object_key.trim();
        if !key.is_empty() && !project.asset_keys.iter().any(|candidate| candidate == key) {
            project.asset_keys.push(key.to_owned());
            project.updated_at = now_rfc3339();
            project.draft_dirty = true;
            self.save_data(&data).await?;
        }
        Ok(())
    }

    async fn list_tags(&self) -> Result<Vec<TagDto>, ApiError> {
        let mut tags: Vec<TagDto> = self
            .load_or_seedless_data()
            .await?
            .tags
            .into_iter()
            .map(|tag| TagDto {
                id: tag.id,
                name: tag.name,
                slug: tag.slug,
            })
            .collect();
        tags.sort_by(|left, right| {
            left.name
                .cmp(&right.name)
                .then_with(|| left.slug.cmp(&right.slug))
        });
        Ok(tags)
    }

    async fn create_tag(&self, name: &str, slug: &str) -> Result<TagDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let trimmed_slug = slug.trim();
        let existing = data
            .tags
            .iter()
            .find(|tag| tag.slug == trimmed_slug)
            .cloned();
        let tag = if let Some(existing) = existing {
            existing
        } else {
            let tag = PersistedTag {
                id: new_persistent_id(),
                name: name.trim().to_owned(),
                slug: trimmed_slug.to_owned(),
            };
            data.tags.push(tag.clone());
            tag
        };
        self.save_data(&data).await?;
        Ok(TagDto {
            id: tag.id,
            name: tag.name,
            slug: tag.slug,
        })
    }

    async fn update_tag(&self, id: &str, name: &str, slug: &str) -> Result<TagDto, ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let Some(tag) = data.tags.iter_mut().find(|tag| tag.id == id) else {
            return Err(ApiError::new(mongodb_not_found_status(), "tag_not_found"));
        };
        tag.name = name.trim().to_owned();
        tag.slug = slug.trim().to_owned();
        let dto = TagDto {
            id: tag.id.clone(),
            name: tag.name.clone(),
            slug: tag.slug.clone(),
        };
        self.save_data(&data).await?;
        Ok(dto)
    }

    async fn delete_tag(&self, id: &str) -> Result<(), ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let Some(index) = data.tags.iter().position(|tag| tag.id == id) else {
            return Err(ApiError::new(mongodb_not_found_status(), "tag_not_found"));
        };
        data.tags.remove(index);
        self.save_data(&data).await?;
        Ok(())
    }

    async fn counts(&self) -> Result<CountsResponse, ApiError> {
        let data = self.load_or_seedless_data().await?;
        Ok(CountsResponse {
            post_count: data.posts.len(),
            project_count: data.projects.len(),
        })
    }
}
