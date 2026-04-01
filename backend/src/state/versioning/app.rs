use super::*;
use crate::models::AdminActor;

impl AppState {
    pub async fn get_published_post_version(
        &self,
        version_id: &str,
    ) -> Result<PostVersionDto, ApiError> {
        if let Some(repo) = self.repo.clone() {
            let post = self
                .store
                .find_post_by_published_version_id(version_id)
                .await?;
            return git_post_version_for_id(&repo, &post.id, version_id).await;
        }
        self.store
            .get_published_post_version_by_id(version_id)
            .await
    }

    pub async fn get_post_version_state(
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
        if self.repo.is_some() {
            let post = self.store.get_post_by_id(id).await?;
            let versions = self.list_post_versions(id).await?;
            let current = VersionStateVersionDto {
                id: post.current_version_id.clone().unwrap_or_default(),
                version_number: 0,
                title: post.title.clone(),
                summary: Some(post.summary.clone()),
                body_markdown: post.content.clone(),
                change_description: None,
            };
            let latest = versions
                .last()
                .cloned()
                .map(version_state_from_post_version);
            return Ok((
                VersionStateItemDto {
                    id: post.id,
                    title: post.title,
                    summary: Some(post.summary),
                    current_version_id: post.current_version_id,
                    published_version_id: post.published_version_id,
                    status: status_from_published_at(post.published_at.as_deref()),
                },
                current,
                latest,
            ));
        }
        self.store.get_post_version_state(id).await
    }

    pub async fn update_post_version(
        &self,
        version_id: &str,
        title: &str,
        summary: &str,
        content: &str,
        actor: &AdminActor,
        change_description: Option<String>,
    ) -> Result<String, ApiError> {
        if let Some(repo) = self.repo.clone() {
            let post = self
                .store
                .find_post_by_current_version_id(version_id)
                .await?;
            let document = editorial_post_document_from_post(&post, title, summary, content);
            let payload =
                build_editorial_post_markdown(&document, content).map_err(ApiError::internal)?;
            let body = build_commit_body("post", &post.id, title).map_err(ApiError::internal)?;
            let subject = fallback_change_description(change_description.as_deref(), title);
            let (author_name, author_email) = self
                .store
                .resolve_git_author_identity_for_actor(actor)
                .await?;
            let commit_sha = repo
                .commit_file_with_author(
                    &post_history_path(&post.id),
                    payload.as_bytes(),
                    &subject,
                    &body,
                    &author_name,
                    &author_email,
                )
                .map_err(ApiError::internal)?;
            self.store
                .overwrite_post_from_editorial(&post.id, &document, content, &commit_sha)
                .await?;
            return Ok(commit_sha);
        }
        self.store
            .update_post_version(version_id, title, summary, content, change_description)
            .await
    }

    pub async fn create_post_version(
        &self,
        post_id: &str,
        title: &str,
        summary: &str,
        content: &str,
        actor: &AdminActor,
        change_description: Option<String>,
    ) -> Result<String, ApiError> {
        if let Some(repo) = self.repo.clone() {
            let post = self.store.get_post_by_id(post_id).await?;
            let document = editorial_post_document_from_post_dto(&post, title, summary, content);
            let payload =
                build_editorial_post_markdown(&document, content).map_err(ApiError::internal)?;
            let body = build_commit_body("post", post_id, title).map_err(ApiError::internal)?;
            let subject = fallback_change_description(change_description.as_deref(), title);
            let (author_name, author_email) = self
                .store
                .resolve_git_author_identity_for_actor(actor)
                .await?;
            let commit_sha = repo
                .commit_file_with_author(
                    &post_history_path(post_id),
                    payload.as_bytes(),
                    &subject,
                    &body,
                    &author_name,
                    &author_email,
                )
                .map_err(ApiError::internal)?;
            self.store
                .overwrite_post_from_editorial(post_id, &document, content, &commit_sha)
                .await?;
            return Ok(commit_sha);
        }
        self.store
            .create_post_version(
                post_id,
                title,
                summary,
                content,
                &actor.user_id,
                change_description,
            )
            .await
    }

    pub async fn set_post_current_version(
        &self,
        post_id: &str,
        version_id: &str,
        title: &str,
        summary: &str,
    ) -> Result<(), ApiError> {
        if let Some(repo) = self.repo.clone() {
            let payload = repo
                .read_file_at_commit(&post_history_path(post_id), version_id)
                .map_err(ApiError::internal)?;
            let (document, body_markdown) =
                parse_editorial_post_markdown(&payload).map_err(ApiError::internal)?;
            let _ = title;
            let _ = summary;
            return self
                .store
                .overwrite_post_from_editorial(post_id, &document, &body_markdown, version_id)
                .await;
        }
        self.store
            .set_post_current_version(post_id, version_id, title, summary)
            .await
    }

    pub async fn list_post_versions(&self, post_id: &str) -> Result<Vec<PostVersionDto>, ApiError> {
        if let Some(repo) = self.repo.clone() {
            self.store.get_post_by_id(post_id).await?;
            let commits = match repo.file_history(&post_history_path(post_id)) {
                Ok(commits) => commits,
                Err(err)
                    if err.contains("not found")
                        || err.contains("missing")
                        || err.contains("does not have commits") =>
                {
                    Vec::new()
                }
                Err(err) => return Err(ApiError::internal(err)),
            };
            return git_post_versions_from_commits(&self.store, &repo, post_id, &commits).await;
        }
        self.store.list_post_versions(post_id).await
    }

    pub async fn get_post_version_by_id(
        &self,
        version_id: &str,
    ) -> Result<PostVersionDto, ApiError> {
        if let Some(repo) = self.repo.clone()
            && let Ok(body) = repo.commit_body(version_id)
            && let Some(metadata) = parse_commit_body(&body)
            && metadata.kind == "post"
            && !metadata.document_id.trim().is_empty()
        {
            return git_post_version_for_id(&repo, &metadata.document_id, version_id).await;
        }
        self.store.get_post_version_by_id(version_id).await
    }

    pub async fn restore_post_version(
        &self,
        post_id: &str,
        version_number: i32,
        actor: &AdminActor,
    ) -> Result<(), ApiError> {
        if let Some(repo) = self.repo.clone() {
            let versions = self.list_post_versions(post_id).await?;
            let version = versions
                .into_iter()
                .find(|version| version.version_number == version_number)
                .ok_or_else(|| {
                    ApiError::new(mongodb_not_found_status(), "post_version_not_found")
                })?;
            let payload = repo
                .read_file_at_commit(&post_history_path(post_id), &version.id)
                .map_err(ApiError::internal)?;
            let (document, body_markdown) =
                parse_editorial_post_markdown(&payload).map_err(ApiError::internal)?;
            let subject = format!("restore post version {version_number}");
            let body =
                build_commit_body("post", post_id, &document.title).map_err(ApiError::internal)?;
            let (author_name, author_email) = self
                .store
                .resolve_git_author_identity_for_actor(actor)
                .await?;
            let commit_sha = repo
                .commit_file_with_author(
                    &post_history_path(post_id),
                    payload.as_slice(),
                    &subject,
                    &body,
                    &author_name,
                    &author_email,
                )
                .map_err(ApiError::internal)?;
            return self
                .store
                .overwrite_post_from_editorial(post_id, &document, &body_markdown, &commit_sha)
                .await;
        }
        self.store
            .restore_post_version(post_id, version_number, &actor.user_id)
            .await
    }

    pub async fn get_published_project_version(
        &self,
        version_id: &str,
    ) -> Result<ProjectVersionDto, ApiError> {
        if let Some(repo) = self.repo.clone() {
            let project = self
                .store
                .find_project_by_published_version_id(version_id)
                .await?;
            return git_project_version_for_id(&repo, &project.id, version_id).await;
        }
        self.store
            .get_published_project_version_by_id(version_id)
            .await
    }

    pub async fn get_project_version_state(
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
        if self.repo.is_some() {
            let project = self.store.get_project_by_id(id).await?;
            let versions = self.list_project_versions(id).await?;
            let current = VersionStateVersionDto {
                id: project.current_version_id.clone().unwrap_or_default(),
                version_number: 0,
                title: project.title.clone(),
                summary: Some(project.summary.clone()),
                body_markdown: project.content.clone(),
                change_description: None,
            };
            let latest = versions
                .last()
                .cloned()
                .map(version_state_from_project_version);
            return Ok((
                VersionStateItemDto {
                    id: project.id,
                    title: project.title,
                    summary: Some(project.summary),
                    current_version_id: project.current_version_id,
                    published_version_id: project.published_version_id,
                    status: status_from_published_at(project.published_at.as_deref()),
                },
                current,
                latest,
            ));
        }
        self.store.get_project_version_state(id).await
    }

    pub async fn update_project_version(
        &self,
        version_id: &str,
        title: &str,
        summary: &str,
        content: &str,
        links: Vec<ProjectLinkDto>,
        actor: &AdminActor,
        change_description: Option<String>,
    ) -> Result<String, ApiError> {
        if let Some(repo) = self.repo.clone() {
            let project = self
                .store
                .find_project_by_current_version_id(version_id)
                .await?;
            let document =
                editorial_project_document_from_project(&project, title, summary, content, &links);
            let payload =
                build_editorial_project_markdown(&document, content).map_err(ApiError::internal)?;
            let body =
                build_commit_body("project", &project.id, title).map_err(ApiError::internal)?;
            let subject = fallback_change_description(change_description.as_deref(), title);
            let (author_name, author_email) = self
                .store
                .resolve_git_author_identity_for_actor(actor)
                .await?;
            let commit_sha = repo
                .commit_file_with_author(
                    &project_history_path(&project.id),
                    payload.as_bytes(),
                    &subject,
                    &body,
                    &author_name,
                    &author_email,
                )
                .map_err(ApiError::internal)?;
            self.store
                .overwrite_project_from_editorial(&project.id, &document, content, &commit_sha)
                .await?;
            return Ok(commit_sha);
        }
        self.store
            .update_project_version(
                version_id,
                title,
                summary,
                content,
                links,
                change_description,
            )
            .await
    }

    pub async fn create_project_version(
        &self,
        request: CreateProjectVersionRequest,
        actor: &AdminActor,
    ) -> Result<String, ApiError> {
        if let Some(repo) = self.repo.clone() {
            let project = self.store.get_project_by_id(&request.project_id).await?;
            let document = editorial_project_document_from_project_dto(
                &project,
                &request.title,
                &request.summary,
                &request.content,
                &request.links,
            );
            let payload = build_editorial_project_markdown(&document, &request.content)
                .map_err(ApiError::internal)?;
            let body = build_commit_body("project", &request.project_id, &request.title)
                .map_err(ApiError::internal)?;
            let subject =
                fallback_change_description(request.change_description.as_deref(), &request.title);
            let (author_name, author_email) = self
                .store
                .resolve_git_author_identity_for_actor(actor)
                .await?;
            let commit_sha = repo
                .commit_file_with_author(
                    &project_history_path(&request.project_id),
                    payload.as_bytes(),
                    &subject,
                    &body,
                    &author_name,
                    &author_email,
                )
                .map_err(ApiError::internal)?;
            self.store
                .overwrite_project_from_editorial(
                    &request.project_id,
                    &document,
                    &request.content,
                    &commit_sha,
                )
                .await?;
            return Ok(commit_sha);
        }
        self.store
            .create_project_version(request, &actor.user_id)
            .await
    }

    pub async fn set_project_current_version(
        &self,
        project_id: &str,
        version_id: &str,
        title: &str,
        summary: &str,
    ) -> Result<(), ApiError> {
        if let Some(repo) = self.repo.clone() {
            let payload = repo
                .read_file_at_commit(&project_history_path(project_id), version_id)
                .map_err(ApiError::internal)?;
            let (document, body_markdown) =
                parse_editorial_project_markdown(&payload).map_err(ApiError::internal)?;
            let _ = title;
            let _ = summary;
            return self
                .store
                .overwrite_project_from_editorial(project_id, &document, &body_markdown, version_id)
                .await;
        }
        self.store
            .set_project_current_version(project_id, version_id, title, summary)
            .await
    }

    pub async fn list_project_versions(
        &self,
        project_id: &str,
    ) -> Result<Vec<ProjectVersionDto>, ApiError> {
        if let Some(repo) = self.repo.clone() {
            self.store.get_project_by_id(project_id).await?;
            let commits = match repo.file_history(&project_history_path(project_id)) {
                Ok(commits) => commits,
                Err(err)
                    if err.contains("not found")
                        || err.contains("missing")
                        || err.contains("does not have commits") =>
                {
                    Vec::new()
                }
                Err(err) => return Err(ApiError::internal(err)),
            };
            return git_project_versions_from_commits(&self.store, &repo, project_id, &commits)
                .await;
        }
        self.store.list_project_versions(project_id).await
    }

    pub async fn get_project_version_by_id(
        &self,
        version_id: &str,
    ) -> Result<ProjectVersionDto, ApiError> {
        if let Some(repo) = self.repo.clone()
            && let Ok(body) = repo.commit_body(version_id)
            && let Some(metadata) = parse_commit_body(&body)
            && metadata.kind == "project"
            && !metadata.document_id.trim().is_empty()
        {
            return git_project_version_for_id(&repo, &metadata.document_id, version_id).await;
        }
        self.store.get_project_version_by_id(version_id).await
    }

    pub async fn restore_project_version(
        &self,
        project_id: &str,
        version_number: i32,
        actor: &AdminActor,
    ) -> Result<(), ApiError> {
        if let Some(repo) = self.repo.clone() {
            let versions = self.list_project_versions(project_id).await?;
            let version = versions
                .into_iter()
                .find(|version| version.version_number == version_number)
                .ok_or_else(|| {
                    ApiError::new(mongodb_not_found_status(), "project_version_not_found")
                })?;
            let payload = repo
                .read_file_at_commit(&project_history_path(project_id), &version.id)
                .map_err(ApiError::internal)?;
            let (document, body_markdown) =
                parse_editorial_project_markdown(&payload).map_err(ApiError::internal)?;
            let subject = format!("restore project version {version_number}");
            let body = build_commit_body("project", project_id, &document.title)
                .map_err(ApiError::internal)?;
            let (author_name, author_email) = self
                .store
                .resolve_git_author_identity_for_actor(actor)
                .await?;
            let commit_sha = repo
                .commit_file_with_author(
                    &project_history_path(project_id),
                    payload.as_slice(),
                    &subject,
                    &body,
                    &author_name,
                    &author_email,
                )
                .map_err(ApiError::internal)?;
            return self
                .store
                .overwrite_project_from_editorial(
                    project_id,
                    &document,
                    &body_markdown,
                    &commit_sha,
                )
                .await;
        }
        self.store
            .restore_project_version(project_id, version_number, &actor.user_id)
            .await
    }
}
