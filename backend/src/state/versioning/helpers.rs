use super::*;

pub(super) fn to_post_version_dto(
    version: PersistedPostVersion,
    tags: &[PersistedTag],
) -> PostVersionDto {
    PostVersionDto {
        id: version.id,
        version_number: version.version_number,
        post_id: version.post_id,
        title: version.title,
        slug: version.slug,
        content: version.content,
        summary: version.summary,
        published_at: version.published_at,
        cover_image: version.cover_image,
        enable_comments: version.enable_comments,
        tags: resolve_tags(tags, &version.tag_ids),
        change_description: version.change_description,
        created_at: version.created_at,
        created_by: version.created_by,
    }
}

pub(super) fn to_project_version_dto(
    version: PersistedProjectVersion,
    tags: &[PersistedTag],
) -> ProjectVersionDto {
    let project_id = version.project_id.clone();
    ProjectVersionDto {
        id: version.id,
        version_number: version.version_number,
        project_id: version.project_id,
        title: version.title,
        slug: version.slug,
        content: version.content,
        summary: version.summary,
        published_at: version.published_at,
        cover_image: version.cover_image,
        sort_order: version.sort_order,
        tags: resolve_tags(tags, &version.tag_ids),
        links: version
            .links
            .into_iter()
            .map(|link| ProjectLinkDto {
                id: link.id,
                project_id: project_id.clone(),
                label: link.label,
                url: link.url,
                link_type: link.link_type,
                sort_order: link.sort_order,
            })
            .collect(),
        change_description: version.change_description,
        created_at: version.created_at,
        created_by: version.created_by,
    }
}

pub(super) fn version_state_from_post_version(version: PostVersionDto) -> VersionStateVersionDto {
    VersionStateVersionDto {
        id: version.id,
        version_number: version.version_number,
        title: version.title,
        summary: Some(version.summary),
        body_markdown: version.content,
        change_description: version.change_description,
    }
}

pub(super) fn version_state_from_project_version(
    version: ProjectVersionDto,
) -> VersionStateVersionDto {
    VersionStateVersionDto {
        id: version.id,
        version_number: version.version_number,
        title: version.title,
        summary: Some(version.summary),
        body_markdown: version.content,
        change_description: version.change_description,
    }
}

pub(super) fn apply_post_version(post: &mut PersistedPost, version: &PersistedPostVersion) {
    post.title = version.title.clone();
    post.slug = version.slug.clone();
    post.summary = version.summary.clone();
    post.content = version.content.clone();
    post.published_at = version.published_at.clone();
    post.cover_image = version.cover_image.clone();
    post.enable_comments = version.enable_comments;
    post.tag_ids = version.tag_ids.clone();
}

pub(super) fn apply_project_version(
    project: &mut PersistedProject,
    version: &PersistedProjectVersion,
) {
    project.title = version.title.clone();
    project.slug = version.slug.clone();
    project.summary = version.summary.clone();
    project.content = version.content.clone();
    project.published_at = version.published_at.clone();
    project.cover_image = version.cover_image.clone();
    project.sort_order = version.sort_order;
    project.tag_ids = version.tag_ids.clone();
    project.links = version.links.clone();
}

pub(super) fn next_post_version_number(versions: &[PersistedPostVersion], post_id: &str) -> i32 {
    versions
        .iter()
        .filter(|version| version.post_id == post_id)
        .map(|version| version.version_number)
        .max()
        .unwrap_or(0)
        + 1
}

pub(super) fn next_project_version_number(
    versions: &[PersistedProjectVersion],
    project_id: &str,
) -> i32 {
    versions
        .iter()
        .filter(|version| version.project_id == project_id)
        .map(|version| version.version_number)
        .max()
        .unwrap_or(0)
        + 1
}

pub(super) fn status_from_published_at(value: Option<&str>) -> String {
    if value.unwrap_or_default().trim().is_empty() {
        "draft".to_owned()
    } else {
        "published".to_owned()
    }
}

pub(super) fn editorial_post_document_from_post(
    post: &PersistedPost,
    title: &str,
    summary: &str,
    content: &str,
) -> EditorialPostDocument {
    let _ = content;
    EditorialPostDocument {
        id: post.id.clone(),
        title: title.trim().to_owned(),
        slug: post.slug.clone(),
        summary: summary.to_owned(),
        cover_image: post.cover_image.clone(),
        published_at: post.published_at.clone().unwrap_or_default(),
        enable_comments: post.enable_comments,
        tags: post
            .tag_ids
            .iter()
            .map(|id| TagDoc {
                id: id.clone(),
                name: id.clone(),
                slug: id.clone(),
            })
            .collect(),
    }
}

pub(super) fn editorial_post_document_from_post_dto(
    post: &PostDto,
    title: &str,
    summary: &str,
    content: &str,
) -> EditorialPostDocument {
    let _ = content;
    EditorialPostDocument {
        id: post.id.clone(),
        title: title.trim().to_owned(),
        slug: post.slug.clone(),
        summary: summary.to_owned(),
        cover_image: post.cover_image.clone(),
        published_at: post.published_at.clone().unwrap_or_default(),
        enable_comments: post.enable_comments,
        tags: post
            .tags
            .iter()
            .map(|tag| TagDoc {
                id: tag.id.clone(),
                name: tag.name.clone(),
                slug: tag.slug.clone(),
            })
            .collect(),
    }
}

pub(super) fn editorial_project_document_from_project(
    project: &PersistedProject,
    title: &str,
    summary: &str,
    content: &str,
    links: &[ProjectLinkDto],
) -> EditorialProjectDocument {
    let _ = content;
    EditorialProjectDocument {
        id: project.id.clone(),
        title: title.trim().to_owned(),
        slug: project.slug.clone(),
        summary: summary.to_owned(),
        cover_image: project.cover_image.clone(),
        published_at: project.published_at.clone().unwrap_or_default(),
        sort_order: project.sort_order,
        tags: project
            .tag_ids
            .iter()
            .map(|id| TagDoc {
                id: id.clone(),
                name: id.clone(),
                slug: id.clone(),
            })
            .collect(),
        links: links
            .iter()
            .map(|link| LinkDoc {
                id: Some(link.id.clone()),
                label: link.label.clone(),
                url: link.url.clone(),
                link_type: link.link_type.clone(),
                sort_order: link.sort_order,
            })
            .collect(),
    }
}

pub(super) fn editorial_project_document_from_project_dto(
    project: &ProjectDto,
    title: &str,
    summary: &str,
    content: &str,
    links: &[ProjectLinkDto],
) -> EditorialProjectDocument {
    let _ = content;
    EditorialProjectDocument {
        id: project.id.clone(),
        title: title.trim().to_owned(),
        slug: project.slug.clone(),
        summary: summary.to_owned(),
        cover_image: project.cover_image.clone(),
        published_at: project.published_at.clone().unwrap_or_default(),
        sort_order: project.sort_order,
        tags: project
            .tags
            .iter()
            .map(|tag| TagDoc {
                id: tag.id.clone(),
                name: tag.name.clone(),
                slug: tag.slug.clone(),
            })
            .collect(),
        links: links
            .iter()
            .map(|link| LinkDoc {
                id: Some(link.id.clone()),
                label: link.label.clone(),
                url: link.url.clone(),
                link_type: link.link_type.clone(),
                sort_order: link.sort_order,
            })
            .collect(),
    }
}

pub(super) async fn git_post_version_for_id(
    repo: &ContentRepo,
    post_id: &str,
    version_id: &str,
) -> Result<PostVersionDto, ApiError> {
    let commits = repo
        .file_history(&post_history_path(post_id))
        .map_err(ApiError::internal)?;
    let index = commits
        .iter()
        .position(|commit| commit.sha == version_id)
        .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "post_version_not_found"))?;
    let commit = repo.get_commit(version_id).map_err(ApiError::internal)?;
    let payload = repo
        .read_file_at_commit(&post_history_path(post_id), version_id)
        .map_err(ApiError::internal)?;
    let (document, body_markdown) =
        parse_editorial_post_markdown(&payload).map_err(ApiError::internal)?;
    Ok(PostVersionDto {
        id: version_id.to_owned(),
        version_number: index as i32 + 1,
        post_id: post_id.trim().to_owned(),
        title: document.title,
        slug: document.slug,
        content: body_markdown,
        summary: document.summary,
        published_at: trim_optional_owned(Some(document.published_at)),
        cover_image: trim_optional_owned(document.cover_image),
        enable_comments: document.enable_comments,
        tags: document
            .tags
            .into_iter()
            .map(|tag| TagDto {
                id: tag.id,
                name: tag.name,
                slug: tag.slug,
            })
            .collect(),
        change_description: trim_optional_owned(Some(commit.summary)),
        created_at: commit.created_at,
        created_by: commit.author,
    })
}

pub(super) async fn git_post_versions_from_commits(
    store: &ContentStore,
    repo: &ContentRepo,
    post_id: &str,
    commits: &[RepoCommit],
) -> Result<Vec<PostVersionDto>, ApiError> {
    let mut versions = Vec::new();
    for commit in commits {
        let mut version = git_post_version_for_id(repo, post_id, &commit.sha).await?;
        if let Ok(post) = store.get_post_by_id(post_id).await {
            version.cover_image = version.cover_image.or(post.cover_image);
        }
        versions.push(version);
    }
    Ok(versions)
}

pub(super) async fn git_project_version_for_id(
    repo: &ContentRepo,
    project_id: &str,
    version_id: &str,
) -> Result<ProjectVersionDto, ApiError> {
    let commits = repo
        .file_history(&project_history_path(project_id))
        .map_err(ApiError::internal)?;
    let index = commits
        .iter()
        .position(|commit| commit.sha == version_id)
        .ok_or_else(|| ApiError::new(mongodb_not_found_status(), "project_version_not_found"))?;
    let commit = repo.get_commit(version_id).map_err(ApiError::internal)?;
    let payload = repo
        .read_file_at_commit(&project_history_path(project_id), version_id)
        .map_err(ApiError::internal)?;
    let (document, body_markdown) =
        parse_editorial_project_markdown(&payload).map_err(ApiError::internal)?;
    Ok(ProjectVersionDto {
        id: version_id.to_owned(),
        version_number: index as i32 + 1,
        project_id: project_id.trim().to_owned(),
        title: document.title,
        slug: document.slug,
        content: body_markdown,
        summary: document.summary,
        published_at: trim_optional_owned(Some(document.published_at)),
        cover_image: trim_optional_owned(document.cover_image),
        sort_order: document.sort_order,
        tags: document
            .tags
            .into_iter()
            .map(|tag| TagDto {
                id: tag.id,
                name: tag.name,
                slug: tag.slug,
            })
            .collect(),
        links: document
            .links
            .into_iter()
            .map(|link| ProjectLinkDto {
                id: link.id.unwrap_or_else(new_persistent_id),
                project_id: project_id.trim().to_owned(),
                label: link.label,
                url: link.url,
                link_type: trim_optional_owned(link.link_type),
                sort_order: link.sort_order,
            })
            .collect(),
        change_description: trim_optional_owned(Some(commit.summary)),
        created_at: commit.created_at,
        created_by: commit.author,
    })
}

pub(super) async fn git_project_versions_from_commits(
    store: &ContentStore,
    repo: &ContentRepo,
    project_id: &str,
    commits: &[RepoCommit],
) -> Result<Vec<ProjectVersionDto>, ApiError> {
    let mut versions = Vec::new();
    for commit in commits {
        let mut version = git_project_version_for_id(repo, project_id, &commit.sha).await?;
        if let Ok(project) = store.get_project_by_id(project_id).await {
            version.cover_image = version.cover_image.or(project.cover_image);
        }
        versions.push(version);
    }
    Ok(versions)
}
