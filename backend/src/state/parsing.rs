use super::*;

pub(super) fn parse_admin_profile_document(
    mut document: Document,
) -> Result<PersistedAdminProfile, ApiError> {
    if !document.contains_key("id")
        && let Some(id) = document_string(&document, "_id")
    {
        document.insert("id", id);
    }
    from_document(document).map_err(map_bson_decode_error)
}

pub(super) fn parse_live_state_document(document: &Document) -> PersistedLiveState {
    PersistedLiveState {
        id: document_string(document, "_id")
            .or_else(|| document_string(document, "id"))
            .unwrap_or_else(|| LIVE_STATE_ID.to_owned()),
        live_commit_sha: document_string(document, "live_commit_sha").unwrap_or_default(),
        last_deploy_job_id: document_string(document, "last_deploy_job_id"),
        last_successful_at: document_string(document, "last_successful_at"),
        public_base_url: document_string(document, "public_base_url"),
        live_pointers: document
            .get_document("live_pointers")
            .ok()
            .map(parse_publish_pointer_snapshot),
    }
}

pub(super) fn resolve_actor_id(admin: &PersistedAdminProfile, author_name: &str) -> String {
    let author_name = author_name.trim();
    let admin_name = admin
        .git_author_name
        .as_deref()
        .unwrap_or(admin.username.as_str())
        .trim();
    if !author_name.is_empty() && author_name == admin_name {
        return admin.id.clone();
    }
    admin.id.clone()
}

pub(super) fn fallback_string(current: &str, fallback: &str) -> String {
    let current = current.trim();
    if !current.is_empty() {
        current.to_owned()
    } else {
        fallback.trim().to_owned()
    }
}

pub(super) fn published_at_from_doc(value: &str, fallback: &str) -> Option<String> {
    let value = value.trim();
    if !value.is_empty() {
        Some(value.to_owned())
    } else {
        trim_optional_owned(Some(fallback.to_owned()))
    }
}

pub(super) fn parse_publish_pointer_snapshot(document: &Document) -> PublishPointerSnapshot {
    PublishPointerSnapshot {
        posts: document
            .get_array("posts")
            .ok()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_document().map(parse_publish_pointer_state))
                    .collect()
            })
            .unwrap_or_default(),
        projects: document
            .get_array("projects")
            .ok()
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_document().map(parse_publish_pointer_state))
                    .collect()
            })
            .unwrap_or_default(),
        home: document
            .get_document("home")
            .ok()
            .map(parse_publish_pointer_state)
            .unwrap_or_default(),
    }
}

pub(super) fn parse_publish_pointer_state(document: &Document) -> PublishPointerState {
    PublishPointerState {
        id: document_string(document, "id").unwrap_or_default(),
        current_version_id: document_string(document, "current_version_id"),
        published_version_id: document_string(document, "published_version_id"),
        published_at: document_string(document, "published_at"),
    }
}

pub(super) fn document_string(document: &Document, key: &str) -> Option<String> {
    match document.get(key) {
        Some(Bson::String(value)) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_owned())
            }
        }
        _ => None,
    }
}
