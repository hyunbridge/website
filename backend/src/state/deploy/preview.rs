use super::*;

pub(super) fn capture_published_pointer_snapshot(
    data: &PersistedData,
    repo: Option<&ContentRepo>,
) -> PublishPointerSnapshot {
    PublishPointerSnapshot {
        posts: data
            .posts
            .iter()
            .map(|post| PublishPointerState {
                id: post.id.clone(),
                current_version_id: trim_optional_owned(post.current_version_id.clone())
                    .or_else(|| latest_version_id_for_post(repo, &post.id)),
                published_version_id: published_pointer_version_id(
                    post.published_at.as_deref(),
                    post.published_version_id.as_ref(),
                    post.current_version_id.as_ref(),
                )
                .or_else(|| {
                    if post.published_at.as_deref().unwrap_or("").trim().is_empty() {
                        None
                    } else {
                        latest_version_id_for_post(repo, &post.id)
                    }
                }),
                published_at: trim_optional_owned(post.published_at.clone()),
            })
            .collect(),
        projects: data
            .projects
            .iter()
            .map(|project| PublishPointerState {
                id: project.id.clone(),
                current_version_id: trim_optional_owned(project.current_version_id.clone())
                    .or_else(|| latest_version_id_for_project(repo, &project.id)),
                published_version_id: published_pointer_version_id(
                    project.published_at.as_deref(),
                    project.published_version_id.as_ref(),
                    project.current_version_id.as_ref(),
                )
                .or_else(|| {
                    if project
                        .published_at
                        .as_deref()
                        .unwrap_or("")
                        .trim()
                        .is_empty()
                    {
                        None
                    } else {
                        latest_version_id_for_project(repo, &project.id)
                    }
                }),
                published_at: trim_optional_owned(project.published_at.clone()),
            })
            .collect(),
        home: PublishPointerState {
            id: data.home.id.clone(),
            current_version_id: trim_optional_owned(data.home.current_version_id.clone())
                .or_else(|| latest_home_version_id(repo)),
            published_version_id: published_home_pointer_version_id(
                data.home.published_at.as_deref(),
                data.home.published_version_id.as_ref(),
                data.home.current_version_id.as_ref(),
            ),
            published_at: trim_optional_owned(data.home.published_at.clone()),
        },
    }
}

pub(super) fn latest_version_id_for_post(
    repo: Option<&ContentRepo>,
    post_id: &str,
) -> Option<String> {
    repo.and_then(|repo| {
        repo.file_history(&post_history_path(post_id))
            .ok()
            .and_then(|commits| commits.last().map(|commit| commit.sha.clone()))
    })
}

pub(super) fn latest_version_id_for_project(
    repo: Option<&ContentRepo>,
    project_id: &str,
) -> Option<String> {
    repo.and_then(|repo| {
        repo.file_history(&project_history_path(project_id))
            .ok()
            .and_then(|commits| commits.last().map(|commit| commit.sha.clone()))
    })
}

pub(super) fn published_pointer_version_id(
    published_at: Option<&str>,
    published_version_id: Option<&String>,
    current_version_id: Option<&String>,
) -> Option<String> {
    if published_at.unwrap_or("").trim().is_empty() {
        return None;
    }
    published_version_id
        .cloned()
        .or_else(|| current_version_id.cloned())
}

pub(super) fn published_home_pointer_version_id(
    _published_at: Option<&str>,
    published_version_id: Option<&String>,
    current_version_id: Option<&String>,
) -> Option<String> {
    published_version_id
        .cloned()
        .or_else(|| current_version_id.cloned())
}

pub(super) async fn build_preview_items(
    data: &PersistedData,
    current: &PublishPointerSnapshot,
    live: &PublishPointerSnapshot,
    store: &ContentStore,
    repo: Option<&ContentRepo>,
) -> Result<Vec<PreviewItemDto>, ApiError> {
    let mut items = Vec::new();

    let home_change = preview_change_type(
        live.home.published_version_id.as_deref(),
        current.home.published_version_id.as_deref(),
    );
    if let Some(change_type) = home_change {
        let live_version = match live.home.published_version_id.as_deref() {
            Some(id) => load_home_preview_version(store, repo, id).await.ok(),
            None => None,
        };
        let target_version = match current.home.published_version_id.as_deref() {
            Some(id) => load_home_preview_version(store, repo, id).await.ok(),
            None => None,
        };
        items.push(PreviewItemDto {
            id: if current.home.id.trim().is_empty() {
                data.home.id.clone()
            } else {
                current.home.id.clone()
            },
            kind: "home".to_owned(),
            title: "홈".to_owned(),
            slug: None,
            change_type: change_type.to_owned(),
            live_version_id: live.home.published_version_id.clone(),
            live_version_title: live_version.as_ref().map(|version| version.title.clone()),
            live_version_message: live_version.and_then(|version| version.change_description),
            target_version_id: current.home.published_version_id.clone(),
            target_version_title: target_version.as_ref().map(|version| version.title.clone()),
            target_version_message: target_version.and_then(|version| version.change_description),
        });
    }

    let mut post_ids: HashSet<String> =
        current.posts.iter().map(|state| state.id.clone()).collect();
    post_ids.extend(live.posts.iter().map(|state| state.id.clone()));
    for id in post_ids {
        let current_state = find_pointer_state(&current.posts, &id);
        let live_state = find_pointer_state(&live.posts, &id);
        let Some(change_type) = preview_change_type(
            live_state.and_then(|state| state.published_version_id.as_deref()),
            current_state.and_then(|state| state.published_version_id.as_deref()),
        ) else {
            continue;
        };

        let post = data.posts.iter().find(|post| post.id == id);
        let live_version = match live_state.and_then(|state| state.published_version_id.as_deref())
        {
            Some(version_id) => load_post_preview_version(store, repo, version_id)
                .await
                .ok(),
            None => None,
        };
        let target_version =
            match current_state.and_then(|state| state.published_version_id.as_deref()) {
                Some(version_id) => load_post_preview_version(store, repo, version_id)
                    .await
                    .ok(),
                None => None,
            };
        items.push(PreviewItemDto {
            id: id.clone(),
            kind: "post".to_owned(),
            title: post
                .map(|post| post.title.clone())
                .or_else(|| live_version.as_ref().map(|version| version.title.clone()))
                .or_else(|| target_version.as_ref().map(|version| version.title.clone()))
                .unwrap_or_default(),
            slug: post
                .map(|post| post.slug.clone())
                .or_else(|| live_version.as_ref().map(|version| version.slug.clone()))
                .or_else(|| target_version.as_ref().map(|version| version.slug.clone())),
            change_type: change_type.to_owned(),
            live_version_id: live_state.and_then(|state| state.published_version_id.clone()),
            live_version_title: live_version.as_ref().map(|version| version.title.clone()),
            live_version_message: live_version.and_then(|version| version.change_description),
            target_version_id: current_state.and_then(|state| state.published_version_id.clone()),
            target_version_title: target_version.as_ref().map(|version| version.title.clone()),
            target_version_message: target_version.and_then(|version| version.change_description),
        });
    }

    let mut project_ids: HashSet<String> = current
        .projects
        .iter()
        .map(|state| state.id.clone())
        .collect();
    project_ids.extend(live.projects.iter().map(|state| state.id.clone()));
    for id in project_ids {
        let current_state = find_pointer_state(&current.projects, &id);
        let live_state = find_pointer_state(&live.projects, &id);
        let Some(change_type) = preview_change_type(
            live_state.and_then(|state| state.published_version_id.as_deref()),
            current_state.and_then(|state| state.published_version_id.as_deref()),
        ) else {
            continue;
        };

        let project = data.projects.iter().find(|project| project.id == id);
        let live_version = match live_state.and_then(|state| state.published_version_id.as_deref())
        {
            Some(version_id) => load_project_preview_version(store, repo, version_id)
                .await
                .ok(),
            None => None,
        };
        let target_version =
            match current_state.and_then(|state| state.published_version_id.as_deref()) {
                Some(version_id) => load_project_preview_version(store, repo, version_id)
                    .await
                    .ok(),
                None => None,
            };
        items.push(PreviewItemDto {
            id: id.clone(),
            kind: "project".to_owned(),
            title: project
                .map(|project| project.title.clone())
                .or_else(|| live_version.as_ref().map(|version| version.title.clone()))
                .or_else(|| target_version.as_ref().map(|version| version.title.clone()))
                .unwrap_or_default(),
            slug: project
                .map(|project| project.slug.clone())
                .or_else(|| live_version.as_ref().map(|version| version.slug.clone()))
                .or_else(|| target_version.as_ref().map(|version| version.slug.clone())),
            change_type: change_type.to_owned(),
            live_version_id: live_state.and_then(|state| state.published_version_id.clone()),
            live_version_title: live_version.as_ref().map(|version| version.title.clone()),
            live_version_message: live_version.and_then(|version| version.change_description),
            target_version_id: current_state.and_then(|state| state.published_version_id.clone()),
            target_version_title: target_version.as_ref().map(|version| version.title.clone()),
            target_version_message: target_version.and_then(|version| version.change_description),
        });
    }

    Ok(items)
}

pub(super) fn preview_change_type(
    live: Option<&str>,
    target: Option<&str>,
) -> Option<&'static str> {
    match (
        live.filter(|value| !value.trim().is_empty()),
        target.filter(|value| !value.trim().is_empty()),
    ) {
        (None, Some(_)) => Some("publish"),
        (Some(_), None) => Some("unpublish"),
        (Some(left), Some(right)) if left != right => Some("update"),
        _ => None,
    }
}

pub(super) fn find_pointer_state<'a>(
    states: &'a [PublishPointerState],
    id: &str,
) -> Option<&'a PublishPointerState> {
    states.iter().find(|state| state.id == id)
}

pub(super) async fn load_home_preview_version(
    store: &ContentStore,
    repo: Option<&ContentRepo>,
    version_id: &str,
) -> Result<HomeVersionDto, ApiError> {
    if let Some(repo) = repo {
        let payload = repo
            .read_file_at_commit(&home_history_path(), version_id)
            .map_err(ApiError::internal)?;
        let snapshot: EditorialHomeSnapshot =
            serde_json::from_slice(&payload).map_err(|err| ApiError::internal(err.to_string()))?;
        let commit = repo.get_commit(version_id).map_err(ApiError::internal)?;
        return Ok(HomeVersionDto {
            id: version_id.to_owned(),
            page_id: snapshot.id,
            version_number: 0,
            title: snapshot.title,
            data: snapshot.data,
            notices: Vec::new(),
            summary: snapshot.summary,
            change_description: trim_optional_owned(Some(commit.summary)),
            created_at: commit.created_at,
            created_by: commit.author,
        });
    }
    store.get_home_version_by_id(version_id).await
}

pub(super) async fn load_post_preview_version(
    store: &ContentStore,
    repo: Option<&ContentRepo>,
    version_id: &str,
) -> Result<PostVersionDto, ApiError> {
    if let Some(repo) = repo
        && let Ok(body) = repo.commit_body(version_id)
        && let Some(metadata) = parse_commit_body(&body)
        && metadata.kind == "post"
        && !metadata.document_id.trim().is_empty()
    {
        let payload = repo
            .read_file_at_commit(&post_history_path(&metadata.document_id), version_id)
            .map_err(ApiError::internal)?;
        let (document, body_markdown) =
            parse_editorial_post_markdown(&payload).map_err(ApiError::internal)?;
        let commit = repo.get_commit(version_id).map_err(ApiError::internal)?;
        return Ok(PostVersionDto {
            id: version_id.to_owned(),
            version_number: 0,
            post_id: metadata.document_id,
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
        });
    }
    store.get_post_version_by_id(version_id).await
}

pub(super) async fn load_project_preview_version(
    store: &ContentStore,
    repo: Option<&ContentRepo>,
    version_id: &str,
) -> Result<ProjectVersionDto, ApiError> {
    if let Some(repo) = repo
        && let Ok(body) = repo.commit_body(version_id)
        && let Some(metadata) = parse_commit_body(&body)
        && metadata.kind == "project"
        && !metadata.document_id.trim().is_empty()
    {
        let payload = repo
            .read_file_at_commit(&project_history_path(&metadata.document_id), version_id)
            .map_err(ApiError::internal)?;
        let (document, body_markdown) =
            parse_editorial_project_markdown(&payload).map_err(ApiError::internal)?;
        let commit = repo.get_commit(version_id).map_err(ApiError::internal)?;
        return Ok(ProjectVersionDto {
            id: version_id.to_owned(),
            version_number: 0,
            project_id: metadata.document_id.clone(),
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
                    project_id: metadata.document_id.clone(),
                    label: link.label,
                    url: link.url,
                    link_type: trim_optional_owned(link.link_type),
                    sort_order: link.sort_order,
                })
                .collect(),
            change_description: trim_optional_owned(Some(commit.summary)),
            created_at: commit.created_at,
            created_by: commit.author,
        });
    }
    store.get_project_version_by_id(version_id).await
}

pub(super) fn summarize_preview(items: &[PreviewItemDto]) -> PreviewSummaryDto {
    let mut summary = PreviewSummaryDto {
        publish_count: 0,
        update_count: 0,
        unpublish_count: 0,
        total_count: items.len() as i32,
    };
    for item in items {
        match item.change_type.as_str() {
            "publish" => summary.publish_count += 1,
            "update" => summary.update_count += 1,
            "unpublish" => summary.unpublish_count += 1,
            _ => {}
        }
    }
    summary
}
