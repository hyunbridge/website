use super::*;

pub(super) async fn build_site_export_from_commit(
    repo: &ContentRepo,
    profile: &PersistedAdminProfile,
    commit_sha: &str,
    _state: &AppState,
) -> Result<Option<PublicSiteExportDto>, ApiError> {
    let posts = load_public_posts_at_commit(repo, profile, commit_sha)?;
    let projects = load_public_projects_at_commit(repo, profile, commit_sha)?;
    let tags = collect_public_tags(&posts, &projects);
    let home = load_public_home_at_commit(repo, profile, commit_sha)?;
    Ok(Some(PublicSiteExportDto {
        release: PublicSiteReleaseDto {
            live_commit_sha: commit_sha.to_owned(),
            generated_at: humantime::format_rfc3339_seconds(SystemTime::now()).to_string(),
        },
        home,
        posts,
        projects,
        tags,
    }))
}

pub(super) fn load_public_home_at_commit(
    repo: &ContentRepo,
    profile: &PersistedAdminProfile,
    commit_sha: &str,
) -> Result<Option<HomeDocumentDto>, ApiError> {
    let payload = match repo.read_file_at_commit(&home_history_path(), commit_sha) {
        Ok(payload) => payload,
        Err(err) if err.contains("not found") => return Ok(None),
        Err(err) => return Err(ApiError::internal(err)),
    };
    let snapshot: EditorialHomeSnapshot =
        serde_json::from_slice(&payload).map_err(|err| ApiError::internal(err.to_string()))?;
    let published_at = normalize_published_value(snapshot.published_at.clone());
    if published_at.is_none() {
        return Ok(None);
    }
    let commit = repo.get_commit(commit_sha).map_err(ApiError::internal)?;
    Ok(Some(HomeDocumentDto {
        id: snapshot.id,
        owner_id: resolve_public_home_owner_id(profile, &commit.author, &commit.author_email),
        status: "published".to_owned(),
        updated_at: None,
        published_at,
        current_version_id: Some(commit.sha.clone()),
        published_version_id: Some(commit.sha),
        data: snapshot.data,
        notices: Vec::new(),
    }))
}

pub(super) fn load_public_posts_at_commit(
    repo: &ContentRepo,
    profile: &PersistedAdminProfile,
    commit_sha: &str,
) -> Result<Vec<PostDto>, ApiError> {
    let paths = repo
        .list_files_at_commit(commit_sha, "posts/", ".md")
        .map_err(ApiError::internal)?;
    let mut items = Vec::new();
    for path in paths {
        let payload = repo
            .read_file_at_commit(&path, commit_sha)
            .map_err(ApiError::internal)?;
        let (document, body_markdown) =
            parse_editorial_post_markdown(&payload).map_err(ApiError::internal)?;
        let Some(published_at) = normalize_published_value(Some(document.published_at.clone()))
        else {
            continue;
        };
        let metadata = document_metadata_at_commit(repo, &path, commit_sha)?;
        let author_matches =
            git_author_matches(profile, &metadata.author_name, &metadata.author_email);
        let author = AuthorDto {
            full_name: if author_matches {
                display_name_from_profile(profile)
            } else if metadata.author_name.trim().is_empty() {
                "관리자".to_owned()
            } else {
                metadata.author_name.clone()
            },
            avatar_url: if author_matches {
                trim_optional_owned(profile.avatar_url.clone())
            } else {
                None
            },
        };
        items.push(PostDto {
            id: path
                .trim()
                .strip_prefix("posts/")
                .and_then(|value| value.strip_suffix(".md"))
                .unwrap_or_default()
                .to_owned(),
            created_at: metadata.created_at.clone(),
            updated_at: if metadata.updated_at.trim().is_empty() {
                metadata.created_at
            } else {
                metadata.updated_at
            },
            title: document.title,
            slug: document.slug,
            content: body_markdown,
            author_id: if author_matches {
                profile.id.clone()
            } else {
                String::new()
            },
            summary: document.summary,
            cover_image: trim_optional_owned(document.cover_image),
            published_at: Some(published_at),
            published_version_id: None,
            current_version_id: None,
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
            author,
        });
    }
    items.sort_by(|left, right| {
        right
            .published_at
            .cmp(&left.published_at)
            .then_with(|| left.slug.cmp(&right.slug))
    });
    Ok(items)
}

pub(super) fn load_public_projects_at_commit(
    repo: &ContentRepo,
    profile: &PersistedAdminProfile,
    commit_sha: &str,
) -> Result<Vec<ProjectDto>, ApiError> {
    let paths = repo
        .list_files_at_commit(commit_sha, "projects/", ".md")
        .map_err(ApiError::internal)?;
    let mut items = Vec::new();
    for path in paths {
        let payload = repo
            .read_file_at_commit(&path, commit_sha)
            .map_err(ApiError::internal)?;
        let (document, body_markdown) =
            parse_editorial_project_markdown(&payload).map_err(ApiError::internal)?;
        let Some(published_at) = normalize_published_value(Some(document.published_at.clone()))
        else {
            continue;
        };
        let metadata = document_metadata_at_commit(repo, &path, commit_sha)?;
        let owner_matches =
            git_author_matches(profile, &metadata.author_name, &metadata.author_email);
        let owner = AuthorDto {
            full_name: if owner_matches {
                display_name_from_profile(profile)
            } else if metadata.author_name.trim().is_empty() {
                "관리자".to_owned()
            } else {
                metadata.author_name.clone()
            },
            avatar_url: if owner_matches {
                trim_optional_owned(profile.avatar_url.clone())
            } else {
                None
            },
        };
        let project_id = path
            .trim()
            .strip_prefix("projects/")
            .and_then(|value| value.strip_suffix(".md"))
            .unwrap_or_default()
            .to_owned();
        items.push(ProjectDto {
            id: project_id.clone(),
            created_at: metadata.created_at.clone(),
            updated_at: if metadata.updated_at.trim().is_empty() {
                metadata.created_at
            } else {
                metadata.updated_at
            },
            title: document.title,
            slug: document.slug,
            content: body_markdown,
            owner_id: if owner_matches {
                profile.id.clone()
            } else {
                String::new()
            },
            summary: document.summary,
            cover_image: trim_optional_owned(document.cover_image),
            published_at: Some(published_at),
            published_version_id: None,
            current_version_id: None,
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
                    project_id: project_id.clone(),
                    label: link.label,
                    url: link.url,
                    link_type: trim_optional_owned(link.link_type),
                    sort_order: link.sort_order,
                })
                .collect(),
            owner,
        });
    }
    items.sort_by(|left, right| {
        left.sort_order
            .cmp(&right.sort_order)
            .then_with(|| right.published_at.cmp(&left.published_at))
            .then_with(|| left.slug.cmp(&right.slug))
    });
    Ok(items)
}

pub(super) fn collect_public_tags(posts: &[PostDto], projects: &[ProjectDto]) -> Vec<TagDto> {
    let mut seen: HashMap<String, TagDto> = HashMap::new();
    for post in posts {
        for tag in &post.tags {
            if !tag.id.trim().is_empty() {
                seen.insert(tag.id.clone(), tag.clone());
            }
        }
    }
    for project in projects {
        for tag in &project.tags {
            if !tag.id.trim().is_empty() {
                seen.insert(tag.id.clone(), tag.clone());
            }
        }
    }
    let mut tags = seen.into_values().collect::<Vec<_>>();
    tags.sort_by(|left, right| {
        left.name
            .cmp(&right.name)
            .then_with(|| left.slug.cmp(&right.slug))
    });
    tags
}

struct CommitPathMetadata {
    created_at: String,
    updated_at: String,
    author_name: String,
    author_email: String,
}

fn document_metadata_at_commit(
    repo: &ContentRepo,
    relative_path: &str,
    commit_sha: &str,
) -> Result<CommitPathMetadata, ApiError> {
    let commits = repo
        .commits_for_path_between(relative_path, "", commit_sha)
        .map_err(ApiError::internal)?;
    let Some(first) = commits.first() else {
        return Ok(CommitPathMetadata {
            created_at: String::new(),
            updated_at: String::new(),
            author_name: String::new(),
            author_email: String::new(),
        });
    };
    let latest = commits.last().unwrap_or(first);
    Ok(CommitPathMetadata {
        created_at: first.created_at.clone(),
        updated_at: latest.created_at.clone(),
        author_name: latest.author.clone(),
        author_email: latest.author_email.clone(),
    })
}

pub(super) fn git_author_matches(
    profile: &PersistedAdminProfile,
    author_name: &str,
    author_email: &str,
) -> bool {
    let author_name = author_name.trim();
    let author_email = author_email.trim();
    [
        profile.git_author_name.as_deref(),
        profile.full_name.as_deref(),
        Some(profile.username.as_str()),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .any(|candidate| !candidate.is_empty() && candidate == author_name)
        || profile
            .git_author_email
            .as_deref()
            .map(str::trim)
            .filter(|candidate| !candidate.is_empty() && *candidate == author_email)
            .is_some()
}

pub(super) fn resolve_public_home_owner_id(
    profile: &PersistedAdminProfile,
    author_name: &str,
    author_email: &str,
) -> String {
    if git_author_matches(profile, author_name, author_email) {
        profile.id.clone()
    } else {
        String::new()
    }
}

pub(super) fn normalize_published_value(value: Option<String>) -> Option<String> {
    trim_optional_owned(value).and_then(|value| {
        if value.eq_ignore_ascii_case("null") {
            None
        } else {
            Some(value)
        }
    })
}
