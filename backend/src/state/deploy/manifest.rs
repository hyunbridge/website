use super::*;

pub(super) fn to_live_state_dto(state: PersistedLiveState) -> LiveStateDto {
    LiveStateDto {
        id: state.id,
        live_commit_sha: state.live_commit_sha,
        last_deploy_job_id: state.last_deploy_job_id,
        last_successful_at: state.last_successful_at,
        public_base_url: state.public_base_url,
    }
}

pub(super) fn infer_live_state(
    repo: Option<&ContentRepo>,
    jobs: &[ReleaseJobDto],
) -> Option<LiveStateDto> {
    let repo = repo?;
    let (_, live_commit_sha) = repo.resolve_reference("refs/publish/deploy/live").ok()?;
    let job = jobs.iter().find(|job| {
        job.status.trim() == "succeeded"
            && job.commit_sha.as_deref().unwrap_or_default().trim() == live_commit_sha.trim()
    });
    Some(LiveStateDto {
        id: LIVE_STATE_ID.to_owned(),
        live_commit_sha,
        last_deploy_job_id: job.map(|job| job.id.clone()),
        last_successful_at: job.map(|job| job.created_at.clone()),
        public_base_url: None,
    })
}

pub(super) fn parse_release_job_document(document: &Document) -> ReleaseJobDto {
    let manifest = document
        .get_document("manifest")
        .ok()
        .map(parse_publish_manifest_document);
    ReleaseJobDto {
        id: document_string(document, "_id")
            .or_else(|| document_string(document, "id"))
            .unwrap_or_default(),
        r#type: document_string(document, "type").unwrap_or_default(),
        status: document_string(document, "status").unwrap_or_default(),
        commit_sha: document_string(document, "commit_sha"),
        requested_by: document_string(document, "requested_by").unwrap_or_default(),
        logs: document
            .get_array("logs")
            .ok()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(str::to_owned))
                    .collect()
            })
            .unwrap_or_default(),
        meta: document
            .get_document("meta")
            .ok()
            .and_then(|doc| serde_json::to_value(doc).ok())
            .and_then(|value| serde_json::from_value(value).ok())
            .unwrap_or_default(),
        manifest,
        created_at: document_string(document, "created_at").unwrap_or_default(),
        updated_at: document_string(document, "updated_at").unwrap_or_default(),
        started_at: document_string(document, "started_at"),
        completed_at: document_string(document, "completed_at"),
    }
}

pub(super) fn parse_publish_manifest_document(document: &Document) -> PublishManifestDto {
    PublishManifestDto {
        schema_version: document
            .get_i32("schema_version")
            .or_else(|_| document.get_i32("SchemaVersion"))
            .or_else(|_| document.get_i64("schema_version").map(|v| v as i32))
            .or_else(|_| document.get_i64("SchemaVersion").map(|v| v as i32))
            .unwrap_or(1),
        kind: document_string(document, "kind")
            .or_else(|| document_string(document, "Kind"))
            .unwrap_or_default(),
        published_at: document_string(document, "published_at")
            .or_else(|| document_string(document, "PublishedAt"))
            .unwrap_or_default(),
        actor: document_string(document, "actor")
            .or_else(|| document_string(document, "Actor"))
            .unwrap_or_default(),
        site_commit: document_string(document, "site_commit")
            .or_else(|| document_string(document, "SiteCommit"))
            .unwrap_or_default(),
        summary: document
            .get_document("summary")
            .or_else(|_| document.get_document("Summary"))
            .ok()
            .map(parse_publish_manifest_summary_document)
            .unwrap_or(PublishManifestSummaryDto {
                publish_count: 0,
                update_count: 0,
                unpublish_count: 0,
                total_count: 0,
            }),
        changes: document
            .get_array("changes")
            .or_else(|_| document.get_array("Changes"))
            .ok()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        item.as_document()
                            .map(parse_publish_manifest_change_document)
                    })
                    .collect()
            })
            .unwrap_or_default(),
    }
}

pub(super) fn parse_publish_manifest_summary_document(
    document: &Document,
) -> PublishManifestSummaryDto {
    PublishManifestSummaryDto {
        publish_count: document
            .get_i32("publish_count")
            .or_else(|_| document.get_i32("PublishCount"))
            .or_else(|_| document.get_i64("publish_count").map(|v| v as i32))
            .or_else(|_| document.get_i64("PublishCount").map(|v| v as i32))
            .unwrap_or_default(),
        update_count: document
            .get_i32("update_count")
            .or_else(|_| document.get_i32("UpdateCount"))
            .or_else(|_| document.get_i64("update_count").map(|v| v as i32))
            .or_else(|_| document.get_i64("UpdateCount").map(|v| v as i32))
            .unwrap_or_default(),
        unpublish_count: document
            .get_i32("unpublish_count")
            .or_else(|_| document.get_i32("UnpublishCount"))
            .or_else(|_| document.get_i64("unpublish_count").map(|v| v as i32))
            .or_else(|_| document.get_i64("UnpublishCount").map(|v| v as i32))
            .unwrap_or_default(),
        total_count: document
            .get_i32("total_count")
            .or_else(|_| document.get_i32("TotalCount"))
            .or_else(|_| document.get_i64("total_count").map(|v| v as i32))
            .or_else(|_| document.get_i64("TotalCount").map(|v| v as i32))
            .unwrap_or_default(),
    }
}

pub(super) fn parse_publish_manifest_change_document(
    document: &Document,
) -> PublishManifestChangeDto {
    PublishManifestChangeDto {
        kind: document_string(document, "kind")
            .or_else(|| document_string(document, "Kind"))
            .unwrap_or_default(),
        document_id: document_string(document, "document_id")
            .or_else(|| document_string(document, "DocumentID"))
            .unwrap_or_default(),
        title: document_string(document, "title")
            .or_else(|| document_string(document, "Title"))
            .unwrap_or_default(),
        slug: document_string(document, "slug").or_else(|| document_string(document, "Slug")),
        change_type: document_string(document, "change_type")
            .or_else(|| document_string(document, "ChangeType"))
            .unwrap_or_default(),
        from: document_string(document, "from").or_else(|| document_string(document, "From")),
        to: document_string(document, "to").or_else(|| document_string(document, "To")),
        from_metadata: document_string(document, "from_metadata")
            .or_else(|| document_string(document, "FromMetadata"))
            .unwrap_or_default(),
        to_metadata: document_string(document, "to_metadata")
            .or_else(|| document_string(document, "ToMetadata"))
            .unwrap_or_default(),
        from_body: document_string(document, "from_body")
            .or_else(|| document_string(document, "FromBody"))
            .unwrap_or_default(),
        to_body: document_string(document, "to_body")
            .or_else(|| document_string(document, "ToBody"))
            .unwrap_or_default(),
        diff: document_string(document, "diff")
            .or_else(|| document_string(document, "Diff"))
            .unwrap_or_default(),
        commits: document
            .get_array("commits")
            .or_else(|_| document.get_array("Commits"))
            .ok()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| {
                        item.as_document()
                            .map(parse_publish_manifest_commit_document)
                    })
                    .collect()
            })
            .unwrap_or_default(),
    }
}

pub(super) fn parse_publish_manifest_commit_document(
    document: &Document,
) -> PublishManifestCommitDto {
    PublishManifestCommitDto {
        sha: document_string(document, "sha")
            .or_else(|| document_string(document, "SHA"))
            .unwrap_or_default(),
        message: document_string(document, "message")
            .or_else(|| document_string(document, "Message"))
            .unwrap_or_default(),
        author: document_string(document, "author")
            .or_else(|| document_string(document, "Author"))
            .unwrap_or_default(),
        created_at: document_string(document, "created_at")
            .or_else(|| document_string(document, "CreatedAt"))
            .unwrap_or_default(),
        diff: document_string(document, "diff")
            .or_else(|| document_string(document, "Diff"))
            .unwrap_or_default(),
    }
}

pub(super) fn enrich_manifest(
    repo: &ContentRepo,
    mut manifest: PublishManifestDto,
) -> PublishManifestDto {
    for change in &mut manifest.changes {
        let from_sha = change.from.clone().unwrap_or_default();
        let to_sha = change.to.clone().unwrap_or_default();
        let (from_metadata, from_body) = load_snapshot_parts(repo, change, &from_sha);
        let (to_metadata, to_body) = load_snapshot_parts(repo, change, &to_sha);
        change.from_metadata = from_metadata;
        change.to_metadata = to_metadata;
        change.from_body = from_body;
        change.to_body = to_body;
        change.diff = load_change_diff(repo, change);
        change.commits = list_change_commits(repo, change);
    }
    manifest
}

pub(super) fn build_publish_manifest(
    actor: &str,
    site_commit: &str,
    summary: &PreviewSummaryDto,
    items: &[PreviewItemDto],
) -> PublishManifestDto {
    PublishManifestDto {
        schema_version: 1,
        kind: "deploy".to_owned(),
        published_at: now_rfc3339(),
        actor: if actor.trim().is_empty() {
            "system".to_owned()
        } else {
            actor.trim().to_owned()
        },
        site_commit: site_commit.trim().to_owned(),
        summary: PublishManifestSummaryDto {
            publish_count: summary.publish_count,
            update_count: summary.update_count,
            unpublish_count: summary.unpublish_count,
            total_count: summary.total_count,
        },
        changes: items
            .iter()
            .map(|item| PublishManifestChangeDto {
                kind: item.kind.clone(),
                document_id: item.id.clone(),
                title: item.title.clone(),
                slug: item.slug.clone(),
                change_type: item.change_type.clone(),
                from: item.live_version_id.clone(),
                to: item.target_version_id.clone(),
                from_metadata: String::new(),
                to_metadata: String::new(),
                from_body: String::new(),
                to_body: String::new(),
                diff: String::new(),
                commits: Vec::<PublishManifestCommitDto>::new(),
            })
            .collect(),
    }
}

pub(super) fn load_snapshot_parts(
    repo: &ContentRepo,
    change: &PublishManifestChangeDto,
    commit_sha: &str,
) -> (String, String) {
    let path = deploy_change_path(change);
    if path.is_empty() || commit_sha.trim().is_empty() {
        return (String::new(), String::new());
    }
    let Ok(payload) = repo.read_file_at_commit(&path, commit_sha) else {
        return (String::new(), String::new());
    };

    match change.kind.trim() {
        "home" => {
            let Ok(mut raw) =
                serde_json::from_slice::<serde_json::Map<String, serde_json::Value>>(&payload)
            else {
                return (
                    String::new(),
                    String::from_utf8_lossy(&payload).trim().to_owned(),
                );
            };
            let body = raw
                .remove("data")
                .map(|value| serde_json::to_string_pretty(&value).unwrap_or_default())
                .unwrap_or_default();
            raw.remove("id");
            (
                serde_json::to_string_pretty(&raw).unwrap_or_default(),
                body.trim().to_owned(),
            )
        }
        "post" => {
            let Ok((document, body)) = parse_editorial_post_markdown(&payload) else {
                return (
                    String::new(),
                    String::from_utf8_lossy(&payload).trim().to_owned(),
                );
            };
            (
                serde_json::to_string_pretty(&serde_json::json!({
                    "id": document.id,
                    "slug": document.slug,
                    "title": document.title,
                    "summary": document.summary,
                    "publishedAt": document.published_at,
                    "coverImage": document.cover_image,
                    "enableComments": document.enable_comments,
                    "tags": document.tags,
                }))
                .unwrap_or_default(),
                body,
            )
        }
        "project" => {
            let Ok((document, body)) = parse_editorial_project_markdown(&payload) else {
                return (
                    String::new(),
                    String::from_utf8_lossy(&payload).trim().to_owned(),
                );
            };
            (
                serde_json::to_string_pretty(&serde_json::json!({
                    "id": document.id,
                    "slug": document.slug,
                    "title": document.title,
                    "summary": document.summary,
                    "publishedAt": document.published_at,
                    "coverImage": document.cover_image,
                    "sortOrder": document.sort_order,
                    "tags": document.tags,
                    "links": document.links,
                }))
                .unwrap_or_default(),
                body,
            )
        }
        _ => (
            String::new(),
            String::from_utf8_lossy(&payload).trim().to_owned(),
        ),
    }
}

pub(super) fn load_change_diff(repo: &ContentRepo, change: &PublishManifestChangeDto) -> String {
    let path = deploy_change_path(change);
    if path.is_empty() {
        return String::new();
    }
    repo.diff_path(
        change.from.as_deref().unwrap_or_default(),
        change.to.as_deref().unwrap_or_default(),
        &path,
    )
    .unwrap_or_default()
    .trim()
    .to_owned()
}

pub(super) fn list_change_commits(
    repo: &ContentRepo,
    change: &PublishManifestChangeDto,
) -> Vec<PublishManifestCommitDto> {
    let path = deploy_change_path(change);
    let to_sha = change.to.as_deref().unwrap_or_default();
    if path.is_empty() || to_sha.trim().is_empty() {
        return Vec::new();
    }
    repo.commits_for_path_between(&path, change.from.as_deref().unwrap_or_default(), to_sha)
        .unwrap_or_default()
        .into_iter()
        .map(|commit| PublishManifestCommitDto {
            diff: repo.commit_diff(&commit.sha, &path).unwrap_or_default(),
            sha: commit.sha,
            message: commit.summary.trim().to_owned(),
            author: commit.author,
            created_at: commit.created_at,
        })
        .collect()
}

pub(super) fn deploy_change_path(change: &PublishManifestChangeDto) -> String {
    match change.kind.trim() {
        "home" => "pages/home.json".to_owned(),
        "post" if !change.document_id.trim().is_empty() => {
            format!("posts/{}.md", change.document_id.trim())
        }
        "project" if !change.document_id.trim().is_empty() => {
            format!("projects/{}.md", change.document_id.trim())
        }
        _ => String::new(),
    }
}
