use super::*;

pub(super) fn to_post_dto(
    post: PersistedPost,
    tags: &[PersistedTag],
    admin: &PersistedAdminProfile,
) -> PostDto {
    PostDto {
        id: post.id,
        created_at: post.created_at,
        updated_at: post.updated_at,
        title: post.title,
        slug: post.slug,
        content: post.content,
        author_id: post.author_id,
        summary: post.summary,
        cover_image: post.cover_image,
        published_at: post.published_at,
        published_version_id: post.published_version_id,
        current_version_id: post.current_version_id,
        enable_comments: post.enable_comments,
        tags: resolve_tags(tags, &post.tag_ids),
        author: author_dto(admin),
    }
}

pub(super) fn to_public_post_dto(
    post: PersistedPost,
    tags: &[PersistedTag],
    admin: &PersistedAdminProfile,
) -> PostDto {
    let mut dto = to_post_dto(post, tags, admin);
    dto.author_id = admin.id.clone();
    dto
}

pub(super) fn to_public_post_dto_from_version(
    post: &PersistedPost,
    version: &PersistedPostVersion,
    tags: &[PersistedTag],
    admin: &PersistedAdminProfile,
) -> PostDto {
    PostDto {
        id: post.id.clone(),
        created_at: post.created_at.clone(),
        updated_at: post.updated_at.clone(),
        title: version.title.clone(),
        slug: version.slug.clone(),
        content: version.content.clone(),
        author_id: admin.id.clone(),
        summary: version.summary.clone(),
        cover_image: version.cover_image.clone(),
        published_at: trim_optional_owned(post.published_at.clone())
            .or_else(|| trim_optional_owned(version.published_at.clone())),
        published_version_id: Some(version.id.clone()),
        current_version_id: post.current_version_id.clone(),
        enable_comments: version.enable_comments,
        tags: resolve_tags(tags, &version.tag_ids),
        author: author_dto(admin),
    }
}

pub(super) fn published_post_version_id(
    live_state: Option<&PersistedLiveState>,
    post: &PersistedPost,
) -> Option<String> {
    live_state
        .and_then(|state| state.live_pointers.as_ref())
        .and_then(|snapshot| snapshot.posts.iter().find(|state| state.id == post.id))
        .and_then(|state| trim_optional_owned(state.published_version_id.clone()))
        .or_else(|| trim_optional_owned(post.published_version_id.clone()))
        .or_else(|| trim_optional_owned(post.current_version_id.clone()))
}

pub(super) fn resolve_public_post_dto(
    post: PersistedPost,
    live_state: Option<&PersistedLiveState>,
    versions_by_id: &HashMap<String, PersistedPostVersion>,
    repo: Option<&ContentRepo>,
    tags: &[PersistedTag],
    admin: &PersistedAdminProfile,
) -> Option<PostDto> {
    match published_post_version_id(live_state, &post) {
        Some(version_id) => versions_by_id
            .get(&version_id)
            .map(|version| to_public_post_dto_from_version(&post, version, tags, admin))
            .or_else(|| public_post_dto_from_commit(repo, &post, &version_id, admin)),
        None => Some(to_public_post_dto(post, tags, admin)),
    }
}

pub(super) fn to_project_dto(
    project: PersistedProject,
    tags: &[PersistedTag],
    admin: &PersistedAdminProfile,
) -> ProjectDto {
    let project_id = project.id.clone();
    ProjectDto {
        id: project.id,
        created_at: project.created_at,
        updated_at: project.updated_at,
        title: project.title,
        slug: project.slug,
        content: project.content,
        owner_id: project.owner_id,
        summary: project.summary,
        cover_image: project.cover_image,
        published_at: project.published_at,
        published_version_id: project.published_version_id,
        current_version_id: project.current_version_id,
        sort_order: project.sort_order,
        tags: resolve_tags(tags, &project.tag_ids),
        links: project
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
        owner: author_dto(admin),
    }
}

pub(super) fn to_public_project_dto(
    project: PersistedProject,
    tags: &[PersistedTag],
    admin: &PersistedAdminProfile,
) -> ProjectDto {
    let mut dto = to_project_dto(project, tags, admin);
    dto.owner_id = admin.id.clone();
    dto
}

pub(super) fn to_public_project_dto_from_version(
    project: &PersistedProject,
    version: &PersistedProjectVersion,
    tags: &[PersistedTag],
    admin: &PersistedAdminProfile,
) -> ProjectDto {
    let project_id = project.id.clone();
    ProjectDto {
        id: project.id.clone(),
        created_at: project.created_at.clone(),
        updated_at: project.updated_at.clone(),
        title: version.title.clone(),
        slug: version.slug.clone(),
        content: version.content.clone(),
        owner_id: admin.id.clone(),
        summary: version.summary.clone(),
        cover_image: version.cover_image.clone(),
        published_at: trim_optional_owned(project.published_at.clone())
            .or_else(|| trim_optional_owned(version.published_at.clone())),
        published_version_id: Some(version.id.clone()),
        current_version_id: project.current_version_id.clone(),
        sort_order: version.sort_order,
        tags: resolve_tags(tags, &version.tag_ids),
        links: version
            .links
            .iter()
            .map(|link| ProjectLinkDto {
                id: link.id.clone(),
                project_id: project_id.clone(),
                label: link.label.clone(),
                url: link.url.clone(),
                link_type: link.link_type.clone(),
                sort_order: link.sort_order,
            })
            .collect(),
        owner: author_dto(admin),
    }
}

pub(super) fn published_project_version_id(
    live_state: Option<&PersistedLiveState>,
    project: &PersistedProject,
) -> Option<String> {
    live_state
        .and_then(|state| state.live_pointers.as_ref())
        .and_then(|snapshot| {
            snapshot
                .projects
                .iter()
                .find(|state| state.id == project.id)
        })
        .and_then(|state| trim_optional_owned(state.published_version_id.clone()))
        .or_else(|| trim_optional_owned(project.published_version_id.clone()))
        .or_else(|| trim_optional_owned(project.current_version_id.clone()))
}

pub(super) fn resolve_public_project_dto(
    project: PersistedProject,
    live_state: Option<&PersistedLiveState>,
    versions_by_id: &HashMap<String, PersistedProjectVersion>,
    repo: Option<&ContentRepo>,
    tags: &[PersistedTag],
    admin: &PersistedAdminProfile,
) -> Option<ProjectDto> {
    match published_project_version_id(live_state, &project) {
        Some(version_id) => versions_by_id
            .get(&version_id)
            .map(|version| to_public_project_dto_from_version(&project, version, tags, admin))
            .or_else(|| public_project_dto_from_commit(repo, &project, &version_id, admin)),
        None => Some(to_public_project_dto(project, tags, admin)),
    }
}

pub(super) fn public_post_dto_from_commit(
    repo: Option<&ContentRepo>,
    post: &PersistedPost,
    version_id: &str,
    admin: &PersistedAdminProfile,
) -> Option<PostDto> {
    let repo = repo?;
    let payload = repo
        .read_file_at_commit(&post_history_path(&post.id), version_id)
        .ok()?;
    let (document, body_markdown) = parse_editorial_post_markdown(&payload).ok()?;
    let metadata = repo
        .commits_for_path_between(&post_history_path(&post.id), "", version_id)
        .ok()?;
    let first = metadata.first()?;
    let latest = metadata.last().unwrap_or(first);
    Some(PostDto {
        id: post.id.clone(),
        created_at: fallback_string(&first.created_at, &post.created_at),
        updated_at: fallback_string(&latest.created_at, &post.updated_at),
        title: document.title,
        slug: document.slug,
        content: body_markdown,
        author_id: resolve_public_actor_id(admin, &latest.author, &latest.author_email),
        summary: document.summary,
        cover_image: trim_optional_owned(document.cover_image),
        published_at: trim_optional_owned(post.published_at.clone())
            .or_else(|| normalize_public_published_value(Some(document.published_at))),
        published_version_id: Some(version_id.to_owned()),
        current_version_id: post.current_version_id.clone(),
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
        author: if public_git_author_matches(admin, &latest.author, &latest.author_email) {
            author_dto(admin)
        } else {
            AuthorDto {
                full_name: if latest.author.trim().is_empty() {
                    "관리자".to_owned()
                } else {
                    latest.author.clone()
                },
                avatar_url: None,
            }
        },
    })
}

pub(super) fn public_project_dto_from_commit(
    repo: Option<&ContentRepo>,
    project: &PersistedProject,
    version_id: &str,
    admin: &PersistedAdminProfile,
) -> Option<ProjectDto> {
    let repo = repo?;
    let payload = repo
        .read_file_at_commit(&project_history_path(&project.id), version_id)
        .ok()?;
    let (document, body_markdown) = parse_editorial_project_markdown(&payload).ok()?;
    let metadata = repo
        .commits_for_path_between(&project_history_path(&project.id), "", version_id)
        .ok()?;
    let first = metadata.first()?;
    let latest = metadata.last().unwrap_or(first);
    Some(ProjectDto {
        id: project.id.clone(),
        created_at: fallback_string(&first.created_at, &project.created_at),
        updated_at: fallback_string(&latest.created_at, &project.updated_at),
        title: document.title,
        slug: document.slug,
        content: body_markdown,
        owner_id: resolve_public_actor_id(admin, &latest.author, &latest.author_email),
        summary: document.summary,
        cover_image: trim_optional_owned(document.cover_image),
        published_at: trim_optional_owned(project.published_at.clone())
            .or_else(|| normalize_public_published_value(Some(document.published_at))),
        published_version_id: Some(version_id.to_owned()),
        current_version_id: project.current_version_id.clone(),
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
                project_id: project.id.clone(),
                label: link.label,
                url: link.url,
                link_type: trim_optional_owned(link.link_type),
                sort_order: link.sort_order,
            })
            .collect(),
        owner: if public_git_author_matches(admin, &latest.author, &latest.author_email) {
            author_dto(admin)
        } else {
            AuthorDto {
                full_name: if latest.author.trim().is_empty() {
                    "관리자".to_owned()
                } else {
                    latest.author.clone()
                },
                avatar_url: None,
            }
        },
    })
}

pub(super) fn next_home_version_number(versions: &[PersistedHomeVersion]) -> i32 {
    versions
        .iter()
        .map(|version| version.version_number)
        .max()
        .unwrap_or(0)
        + 1
}

pub(super) fn post_history_path(post_id: &str) -> String {
    format!("posts/{}.md", post_id.trim())
}

pub(super) fn project_history_path(project_id: &str) -> String {
    format!("projects/{}.md", project_id.trim())
}

pub(super) fn home_history_path() -> String {
    "pages/home.json".to_owned()
}

pub(super) fn fallback_change_description(value: Option<&str>, fallback: &str) -> String {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback)
        .to_owned()
}

pub(super) async fn git_home_versions_from_commits(
    repo: &ContentRepo,
    commits: &[RepoCommit],
) -> Result<Vec<HomeVersionDto>, ApiError> {
    let mut versions = Vec::with_capacity(commits.len());
    for (index, commit) in commits.iter().enumerate() {
        let payload = repo
            .read_file_at_commit(&home_history_path(), &commit.sha)
            .map_err(ApiError::internal)?;
        let snapshot: EditorialHomeSnapshot =
            serde_json::from_slice(&payload).map_err(|err| ApiError::internal(err.to_string()))?;
        versions.push(HomeVersionDto {
            id: commit.sha.clone(),
            page_id: snapshot.id,
            version_number: index as i32 + 1,
            title: snapshot.title,
            data: snapshot.data,
            notices: Vec::new(),
            summary: snapshot.summary,
            change_description: trim_optional_owned(Some(commit.summary.clone())),
            created_at: commit.created_at.clone(),
            created_by: commit.author.clone(),
        });
    }
    Ok(versions)
}

pub(super) fn author_dto(admin: &PersistedAdminProfile) -> AuthorDto {
    AuthorDto {
        full_name: display_name_from_profile(admin),
        avatar_url: admin.avatar_url.clone(),
    }
}

pub(super) fn display_name_from_profile(profile: &PersistedAdminProfile) -> String {
    if let Some(name) = profile
        .full_name
        .as_ref()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
    {
        return name;
    }
    if !profile.username.trim().is_empty() {
        return profile.username.trim().to_owned();
    }
    "admin".to_owned()
}

pub(super) fn public_git_author_matches(
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

pub(super) fn resolve_public_actor_id(
    profile: &PersistedAdminProfile,
    author_name: &str,
    author_email: &str,
) -> String {
    if public_git_author_matches(profile, author_name, author_email) {
        profile.id.clone()
    } else {
        String::new()
    }
}

pub(super) fn normalize_public_published_value(value: Option<String>) -> Option<String> {
    trim_optional_owned(value).and_then(|value| {
        if value.eq_ignore_ascii_case("null") {
            None
        } else {
            Some(value)
        }
    })
}

pub(super) fn resolve_tags(all_tags: &[PersistedTag], ids: &[String]) -> Vec<TagDto> {
    let wanted: HashSet<&str> = ids.iter().map(String::as_str).collect();
    all_tags
        .iter()
        .filter(|tag| wanted.contains(tag.id.as_str()))
        .map(|tag| TagDto {
            id: tag.id.clone(),
            name: tag.name.clone(),
            slug: tag.slug.clone(),
        })
        .collect()
}

pub(super) async fn load_collection<T>(
    collection: &Collection<Document>,
) -> Result<Vec<T>, ApiError>
where
    T: for<'de> serde::Deserialize<'de> + Unpin + Send + Sync,
{
    let mut cursor = collection
        .find(doc! {})
        .sort(doc! { "_id": 1_i32 })
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;

    let mut items = Vec::new();
    while cursor
        .advance()
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
    {
        let document = cursor
            .deserialize_current()
            .map_err(|err| ApiError::internal(err.to_string()))?;
        let item = from_document(document).map_err(map_bson_decode_error)?;
        items.push(item);
    }
    Ok(items)
}

pub(super) async fn load_single<T>(
    collection: &Collection<Document>,
    id: &str,
) -> Result<Option<T>, ApiError>
where
    T: for<'de> serde::Deserialize<'de> + Unpin + Send + Sync,
{
    collection
        .find_one(doc! { "_id": id })
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
        .map(|document| from_document(document).map_err(map_bson_decode_error))
        .transpose()
}

pub(super) async fn sync_collection<T, F>(
    collection: &Collection<Document>,
    items: &[T],
    id_fn: F,
) -> Result<(), ApiError>
where
    T: serde::Serialize,
    F: Fn(&T) -> String,
{
    let mut existing_cursor = collection
        .find(doc! {})
        .projection(doc! { "_id": 1_i32 })
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;
    let mut existing_ids = Vec::new();
    while existing_cursor
        .advance()
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
    {
        let document: Document = existing_cursor
            .deserialize_current()
            .map_err(|err| ApiError::internal(err.to_string()))?;
        if let Ok(id) = document.get_str("_id") {
            existing_ids.push(id.to_owned());
        }
    }

    let mut next_ids = HashSet::new();
    for item in items {
        let id = id_fn(item);
        next_ids.insert(id.clone());
        let mut document = to_document(item).map_err(map_bson_encode_error)?;
        document.insert("_id", id.clone());
        collection
            .replace_one(doc! { "_id": &id }, document)
            .upsert(true)
            .await
            .map_err(|err| ApiError::internal(err.to_string()))?;
    }

    let stale_ids: Vec<String> = existing_ids
        .into_iter()
        .filter(|id| !next_ids.contains(id))
        .collect();
    if !stale_ids.is_empty() {
        collection
            .delete_many(doc! { "_id": { "$in": stale_ids } })
            .await
            .map_err(|err| ApiError::internal(err.to_string()))?;
    }
    Ok(())
}

pub(super) async fn sync_single<T>(
    collection: &Collection<Document>,
    id: &str,
    value: &T,
) -> Result<(), ApiError>
where
    T: serde::Serialize,
{
    let mut document = to_document(value).map_err(map_bson_encode_error)?;
    document.insert("_id", id);
    collection
        .replace_one(doc! { "_id": id }, document)
        .upsert(true)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;
    Ok(())
}

pub(super) fn seed_persisted_data(
    admin_email: &str,
    admin_password: &str,
) -> Result<PersistedData, ApiError> {
    if admin_email.trim().is_empty() || admin_password.trim().is_empty() {
        return Err(ApiError::internal("admin email and password are required"));
    }

    Ok(PersistedData {
        posts: Vec::new(),
        projects: Vec::new(),
        tags: Vec::new(),
        home: default_home(),
        admin_profile: PersistedAdminProfile {
            id: new_persistent_id(),
            email: admin_email.trim().to_owned(),
            username: "admin".to_owned(),
            password: hash_admin_password(admin_password)?,
            full_name: None,
            avatar_url: None,
            git_author_name: Some("admin".to_owned()),
            git_author_email: Some(admin_email.trim().to_owned()),
        },
    })
}

pub(super) fn default_home() -> PersistedHome {
    PersistedHome {
        id: HOME_PAGE_ID.to_owned(),
        owner_id: String::new(),
        updated_at: None,
        published_at: None,
        current_version_id: None,
        published_version_id: None,
        data: None,
        draft_dirty: false,
    }
}

pub(super) fn hash_admin_password(password: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut argon2::password_hash::rand_core::OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|err| ApiError::internal(err.to_string()))
}

pub(super) fn compare_admin_password(hashed_password: &str, password: &str) -> bool {
    let Ok(parsed_hash) = PasswordHash::new(hashed_password) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok()
}

pub(super) fn now_rfc3339() -> String {
    humantime::format_rfc3339_seconds(SystemTime::now()).to_string()
}

pub(super) fn published_at_on_publish(existing: Option<String>, now: &str) -> Option<String> {
    trim_optional_owned(existing).or_else(|| trim_optional_owned(Some(now.to_owned())))
}

pub(super) fn new_persistent_id() -> String {
    Ulid::new().to_string()
}

pub(super) fn trim_optional_owned(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim().to_owned();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

pub(super) fn normalize_project_links(links: Vec<ProjectLinkDto>) -> Vec<PersistedProjectLink> {
    links
        .into_iter()
        .map(|link| PersistedProjectLink {
            id: if link.id.trim().is_empty() {
                new_persistent_id()
            } else {
                link.id
            },
            label: link.label,
            url: link.url,
            link_type: trim_optional_owned(link.link_type),
            sort_order: link.sort_order,
        })
        .collect()
}

pub(super) fn paginate<T>(items: Vec<T>, page: i32, page_size: i32) -> Vec<T> {
    let page = if page < 1 { 1 } else { page as usize };
    let page_size = if page_size < 1 {
        10
    } else {
        page_size as usize
    };
    let start = (page - 1) * page_size;
    if start >= items.len() {
        return Vec::new();
    }
    items.into_iter().skip(start).take(page_size).collect()
}

pub(super) fn map_bson_decode_error(err: mongodb::bson::de::Error) -> ApiError {
    ApiError::internal(err.to_string())
}

pub(super) fn map_bson_encode_error(err: mongodb::bson::ser::Error) -> ApiError {
    ApiError::internal(err.to_string())
}

pub(super) fn mongodb_not_found_status() -> http::StatusCode {
    http::StatusCode::NOT_FOUND
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_admin() -> PersistedAdminProfile {
        PersistedAdminProfile {
            id: "admin-1".to_owned(),
            email: "admin@example.com".to_owned(),
            username: "admin".to_owned(),
            password: "secret".to_owned(),
            full_name: Some("Admin".to_owned()),
            avatar_url: None,
            git_author_name: None,
            git_author_email: None,
        }
    }

    fn sample_post() -> PersistedPost {
        PersistedPost {
            id: "post-1".to_owned(),
            created_at: "2026-03-01T00:00:00Z".to_owned(),
            updated_at: "2026-03-02T00:00:00Z".to_owned(),
            title: "Draft title".to_owned(),
            slug: "draft-slug".to_owned(),
            content: "draft body".to_owned(),
            author_id: "author-1".to_owned(),
            summary: "draft summary".to_owned(),
            cover_image: Some("draft-cover".to_owned()),
            published_at: Some("2024-01-01T00:00:00Z".to_owned()),
            published_version_id: Some("post-v1".to_owned()),
            current_version_id: Some("post-v2".to_owned()),
            enable_comments: true,
            tag_ids: vec!["tag-draft".to_owned()],
            asset_keys: Vec::new(),
            draft_dirty: true,
        }
    }

    fn sample_project() -> PersistedProject {
        PersistedProject {
            id: "project-1".to_owned(),
            created_at: "2026-03-01T00:00:00Z".to_owned(),
            updated_at: "2026-03-02T00:00:00Z".to_owned(),
            title: "Draft project".to_owned(),
            slug: "draft-project".to_owned(),
            content: "draft project body".to_owned(),
            owner_id: "owner-1".to_owned(),
            summary: "draft project summary".to_owned(),
            cover_image: Some("draft-project-cover".to_owned()),
            published_at: Some("2024-02-01T00:00:00Z".to_owned()),
            published_version_id: Some("project-v1".to_owned()),
            current_version_id: Some("project-v2".to_owned()),
            sort_order: 99,
            tag_ids: vec!["tag-draft".to_owned()],
            asset_keys: Vec::new(),
            links: vec![PersistedProjectLink {
                id: "draft-link".to_owned(),
                label: "Draft".to_owned(),
                url: "https://draft.example.com".to_owned(),
                link_type: None,
                sort_order: 10,
            }],
            draft_dirty: true,
        }
    }

    #[test]
    fn resolve_public_post_dto_prefers_published_version_content() {
        let post = sample_post();
        let mut versions = HashMap::new();
        versions.insert(
            "post-v1".to_owned(),
            PersistedPostVersion {
                id: "post-v1".to_owned(),
                version_number: 1,
                post_id: post.id.clone(),
                title: "Published title".to_owned(),
                slug: "published-slug".to_owned(),
                content: "published body".to_owned(),
                summary: "published summary".to_owned(),
                published_at: Some("2023-12-31T00:00:00Z".to_owned()),
                cover_image: Some("published-cover".to_owned()),
                enable_comments: false,
                tag_ids: vec!["tag-live".to_owned()],
                change_description: None,
                created_at: "2026-03-01T00:00:00Z".to_owned(),
                created_by: "author-1".to_owned(),
            },
        );
        let tags = vec![PersistedTag {
            id: "tag-live".to_owned(),
            name: "Live".to_owned(),
            slug: "live".to_owned(),
        }];

        let dto =
            resolve_public_post_dto(post, None, &versions, None, &tags, &sample_admin()).unwrap();

        assert_eq!(dto.title, "Published title");
        assert_eq!(dto.slug, "published-slug");
        assert_eq!(dto.content, "published body");
        assert_eq!(dto.summary, "published summary");
        assert_eq!(dto.cover_image.as_deref(), Some("published-cover"));
        assert_eq!(dto.published_at.as_deref(), Some("2024-01-01T00:00:00Z"));
        assert_eq!(dto.author_id, "admin-1");
        assert_eq!(dto.tags.len(), 1);
        assert_eq!(dto.tags[0].id, "tag-live");
    }

    #[test]
    fn resolve_public_project_dto_prefers_published_version_content() {
        let project = sample_project();
        let mut versions = HashMap::new();
        versions.insert(
            "project-v1".to_owned(),
            PersistedProjectVersion {
                id: "project-v1".to_owned(),
                version_number: 1,
                project_id: project.id.clone(),
                title: "Published project".to_owned(),
                slug: "published-project".to_owned(),
                content: "published project body".to_owned(),
                summary: "published project summary".to_owned(),
                published_at: Some("2024-02-01T00:00:00Z".to_owned()),
                cover_image: Some("published-project-cover".to_owned()),
                sort_order: 3,
                tag_ids: vec!["tag-live".to_owned()],
                links: vec![PersistedProjectLink {
                    id: "live-link".to_owned(),
                    label: "Live".to_owned(),
                    url: "https://live.example.com".to_owned(),
                    link_type: Some("demo".to_owned()),
                    sort_order: 1,
                }],
                change_description: None,
                created_at: "2026-03-01T00:00:00Z".to_owned(),
                created_by: "owner-1".to_owned(),
            },
        );
        let tags = vec![PersistedTag {
            id: "tag-live".to_owned(),
            name: "Live".to_owned(),
            slug: "live".to_owned(),
        }];

        let dto =
            resolve_public_project_dto(project, None, &versions, None, &tags, &sample_admin())
                .unwrap();

        assert_eq!(dto.title, "Published project");
        assert_eq!(dto.slug, "published-project");
        assert_eq!(dto.content, "published project body");
        assert_eq!(dto.summary, "published project summary");
        assert_eq!(dto.cover_image.as_deref(), Some("published-project-cover"));
        assert_eq!(dto.sort_order, 3);
        assert_eq!(dto.owner_id, "admin-1");
        assert_eq!(dto.links.len(), 1);
        assert_eq!(dto.links[0].id, "live-link");
    }

    #[test]
    fn published_version_id_prefers_live_pointer_state() {
        let post = sample_post();
        let project = sample_project();
        let live_state = PersistedLiveState {
            id: LIVE_STATE_ID.to_owned(),
            live_commit_sha: String::new(),
            last_deploy_job_id: None,
            last_successful_at: None,
            public_base_url: None,
            live_pointers: Some(PublishPointerSnapshot {
                posts: vec![PublishPointerState {
                    id: post.id.clone(),
                    current_version_id: None,
                    published_version_id: Some("post-live".to_owned()),
                    published_at: None,
                }],
                projects: vec![PublishPointerState {
                    id: project.id.clone(),
                    current_version_id: None,
                    published_version_id: Some("project-live".to_owned()),
                    published_at: None,
                }],
                home: PublishPointerState::default(),
            }),
        };

        assert_eq!(
            published_post_version_id(Some(&live_state), &post).as_deref(),
            Some("post-live")
        );
        assert_eq!(
            published_project_version_id(Some(&live_state), &project).as_deref(),
            Some("project-live")
        );
    }

    #[test]
    fn published_at_on_publish_preserves_existing_timestamp() {
        assert_eq!(
            published_at_on_publish(
                Some("2020-01-01T00:00:00Z".to_owned()),
                "2026-04-01T00:00:00Z"
            )
            .as_deref(),
            Some("2020-01-01T00:00:00Z")
        );
        assert_eq!(
            published_at_on_publish(None, "2026-04-01T00:00:00Z").as_deref(),
            Some("2026-04-01T00:00:00Z")
        );
    }
}
