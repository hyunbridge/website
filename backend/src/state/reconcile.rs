use super::*;

impl ContentStore {
    pub(super) async fn reconcile_editorial_state(
        &self,
        repo: &ContentRepo,
    ) -> Result<(), ApiError> {
        let mut data = self.load_or_seedless_data().await?;
        let post_paths = repo
            .list_files("posts/", ".md")
            .map_err(ApiError::internal)?;
        let project_paths = repo
            .list_files("projects/", ".md")
            .map_err(ApiError::internal)?;
        let page_paths = repo
            .list_files("pages/", ".json")
            .map_err(ApiError::internal)?;

        let post_live_refs = repo
            .list_references("refs/publish/live/posts/")
            .map_err(ApiError::internal)?;
        let project_live_refs = repo
            .list_references("refs/publish/live/projects/")
            .map_err(ApiError::internal)?;
        let home_live_ref = repo
            .list_references("refs/publish/live/home")
            .map_err(ApiError::internal)?;

        let post_published: HashMap<String, String> = post_live_refs
            .into_iter()
            .filter_map(|(name, _object_sha, commit_sha)| {
                let id = name.trim().strip_prefix("refs/publish/live/posts/")?.trim();
                if id.is_empty() || commit_sha.trim().is_empty() {
                    None
                } else {
                    Some((id.to_owned(), commit_sha))
                }
            })
            .collect();
        let project_published: HashMap<String, String> = project_live_refs
            .into_iter()
            .filter_map(|(name, _object_sha, commit_sha)| {
                let id = name
                    .trim()
                    .strip_prefix("refs/publish/live/projects/")?
                    .trim();
                if id.is_empty() || commit_sha.trim().is_empty() {
                    None
                } else {
                    Some((id.to_owned(), commit_sha))
                }
            })
            .collect();
        let home_published =
            home_live_ref
                .into_iter()
                .find_map(|(name, _object_sha, commit_sha)| {
                    if name.trim() == "refs/publish/live/home" && !commit_sha.trim().is_empty() {
                        Some(commit_sha)
                    } else {
                        None
                    }
                });

        let mut next_posts = Vec::new();
        let mut next_projects = Vec::new();
        let mut next_tags: HashMap<String, PersistedTag> = HashMap::new();
        let existing_posts: HashMap<String, PersistedPost> = data
            .posts
            .iter()
            .cloned()
            .map(|post| (post.id.clone(), post))
            .collect();
        let existing_projects: HashMap<String, PersistedProject> = data
            .projects
            .iter()
            .cloned()
            .map(|project| (project.id.clone(), project))
            .collect();

        for path in post_paths {
            let id = path
                .trim()
                .strip_prefix("posts/")
                .and_then(|value| value.strip_suffix(".md"))
                .unwrap_or_default()
                .trim()
                .to_owned();
            if id.is_empty() {
                continue;
            }
            let history = repo.file_history(&path).map_err(ApiError::internal)?;
            let Some(first) = history.first().cloned() else {
                continue;
            };
            let Some(latest) = history.last().cloned() else {
                continue;
            };
            let payload = repo
                .read_file_at_commit(&path, &latest.sha)
                .map_err(ApiError::internal)?;
            let (doc, body) =
                parse_editorial_post_markdown(&payload).map_err(ApiError::internal)?;
            for tag in &doc.tags {
                next_tags.insert(
                    tag.id.clone(),
                    PersistedTag {
                        id: tag.id.clone(),
                        name: tag.name.clone(),
                        slug: tag.slug.clone(),
                    },
                );
            }

            let mut post = existing_posts.get(&id).cloned().unwrap_or(PersistedPost {
                id: id.clone(),
                created_at: first.created_at.clone(),
                updated_at: latest.created_at.clone(),
                title: String::new(),
                slug: String::new(),
                content: String::new(),
                author_id: resolve_actor_id(&data.admin_profile, &first.author),
                summary: String::new(),
                cover_image: None,
                published_at: None,
                published_version_id: None,
                current_version_id: None,
                enable_comments: false,
                tag_ids: Vec::new(),
                asset_keys: Vec::new(),
                draft_dirty: false,
            });
            if !post.draft_dirty
                || trim_optional_owned(post.current_version_id.clone()).as_deref()
                    != Some(latest.sha.as_str())
            {
                post.title = doc.title.clone();
                post.slug = doc.slug.clone();
                post.content = body;
                post.summary = doc.summary.clone();
                post.cover_image = trim_optional_owned(doc.cover_image.clone());
                post.enable_comments = doc.enable_comments;
                post.tag_ids = doc.tags.iter().map(|tag| tag.id.clone()).collect();
                post.draft_dirty = false;
            }
            post.created_at = fallback_string(&first.created_at, &post.created_at);
            post.updated_at = fallback_string(&latest.created_at, &post.updated_at);
            post.author_id = fallback_string(
                &post.author_id,
                &resolve_actor_id(&data.admin_profile, &first.author),
            );
            post.current_version_id = Some(latest.sha.clone());
            post.published_version_id = None;
            post.published_at = None;
            if let Some(published_sha) = post_published.get(&id)
                && repo.read_file_at_commit(&path, published_sha).is_ok()
            {
                post.published_version_id = Some(published_sha.clone());
                post.published_at = published_at_from_doc(&doc.published_at, &latest.created_at);
            }
            next_posts.push(post);
        }

        for path in project_paths {
            let id = path
                .trim()
                .strip_prefix("projects/")
                .and_then(|value| value.strip_suffix(".md"))
                .unwrap_or_default()
                .trim()
                .to_owned();
            if id.is_empty() {
                continue;
            }
            let history = repo.file_history(&path).map_err(ApiError::internal)?;
            let Some(first) = history.first().cloned() else {
                continue;
            };
            let Some(latest) = history.last().cloned() else {
                continue;
            };
            let payload = repo
                .read_file_at_commit(&path, &latest.sha)
                .map_err(ApiError::internal)?;
            let (doc, body) =
                parse_editorial_project_markdown(&payload).map_err(ApiError::internal)?;
            for tag in &doc.tags {
                next_tags.insert(
                    tag.id.clone(),
                    PersistedTag {
                        id: tag.id.clone(),
                        name: tag.name.clone(),
                        slug: tag.slug.clone(),
                    },
                );
            }

            let mut project = existing_projects
                .get(&id)
                .cloned()
                .unwrap_or(PersistedProject {
                    id: id.clone(),
                    created_at: first.created_at.clone(),
                    updated_at: latest.created_at.clone(),
                    title: String::new(),
                    slug: String::new(),
                    content: String::new(),
                    owner_id: resolve_actor_id(&data.admin_profile, &first.author),
                    summary: String::new(),
                    cover_image: None,
                    published_at: None,
                    published_version_id: None,
                    current_version_id: None,
                    sort_order: 0,
                    tag_ids: Vec::new(),
                    asset_keys: Vec::new(),
                    links: Vec::new(),
                    draft_dirty: false,
                });
            if !project.draft_dirty
                || trim_optional_owned(project.current_version_id.clone()).as_deref()
                    != Some(latest.sha.as_str())
            {
                project.title = doc.title.clone();
                project.slug = doc.slug.clone();
                project.content = body;
                project.summary = doc.summary.clone();
                project.cover_image = trim_optional_owned(doc.cover_image.clone());
                project.sort_order = doc.sort_order;
                project.tag_ids = doc.tags.iter().map(|tag| tag.id.clone()).collect();
                project.links = doc
                    .links
                    .iter()
                    .map(|link| PersistedProjectLink {
                        id: link.id.clone().unwrap_or_else(new_persistent_id),
                        label: link.label.clone(),
                        url: link.url.clone(),
                        link_type: trim_optional_owned(link.link_type.clone()),
                        sort_order: link.sort_order,
                    })
                    .collect();
                project.draft_dirty = false;
            }
            project.created_at = fallback_string(&first.created_at, &project.created_at);
            project.updated_at = fallback_string(&latest.created_at, &project.updated_at);
            project.owner_id = fallback_string(
                &project.owner_id,
                &resolve_actor_id(&data.admin_profile, &first.author),
            );
            project.current_version_id = Some(latest.sha.clone());
            project.published_version_id = None;
            project.published_at = None;
            if let Some(published_sha) = project_published.get(&id)
                && repo.read_file_at_commit(&path, published_sha).is_ok()
            {
                project.published_version_id = Some(published_sha.clone());
                project.published_at = published_at_from_doc(&doc.published_at, &latest.created_at);
            }
            next_projects.push(project);
        }

        if page_paths.iter().any(|path| path == "pages/home.json") {
            let history = repo
                .file_history("pages/home.json")
                .map_err(ApiError::internal)?;
            if let Some(latest) = history.last() {
                let payload = repo
                    .read_file_at_commit("pages/home.json", &latest.sha)
                    .map_err(ApiError::internal)?;
                let snapshot: EditorialHomeSnapshot = serde_json::from_slice(&payload)
                    .map_err(|err| ApiError::internal(err.to_string()))?;
                if !data.home.draft_dirty
                    || trim_optional_owned(data.home.current_version_id.clone()).as_deref()
                        != Some(latest.sha.as_str())
                {
                    data.home.data = Some(snapshot.data.clone());
                    data.home.draft_dirty = false;
                }
                if data.home.id.trim().is_empty() {
                    data.home.id = snapshot.id.clone();
                }
                if data.home.owner_id.trim().is_empty() {
                    data.home.owner_id = data.admin_profile.id.clone();
                }
                data.home.current_version_id = Some(latest.sha.clone());
                data.home.published_version_id = None;
                data.home.published_at = None;
                if let Some(published_sha) = home_published.as_ref()
                    && repo
                        .read_file_at_commit("pages/home.json", published_sha)
                        .is_ok()
                {
                    data.home.published_version_id = Some(published_sha.clone());
                    let published_payload = repo
                        .read_file_at_commit("pages/home.json", published_sha)
                        .map_err(ApiError::internal)?;
                    if let Ok(published_snapshot) =
                        serde_json::from_slice::<EditorialHomeSnapshot>(&published_payload)
                    {
                        data.home.published_at =
                            trim_optional_owned(published_snapshot.published_at);
                    }
                }
            }
        }

        next_posts.sort_by(|left, right| right.created_at.cmp(&left.created_at));
        next_projects.sort_by(|left, right| {
            left.sort_order
                .cmp(&right.sort_order)
                .then_with(|| right.created_at.cmp(&left.created_at))
        });
        let mut tags = next_tags.into_values().collect::<Vec<_>>();
        tags.sort_by(|left, right| {
            left.name
                .cmp(&right.name)
                .then_with(|| left.id.cmp(&right.id))
        });

        data.posts = next_posts;
        data.projects = next_projects;
        data.tags = tags;
        self.save_data(&data).await
    }
}
