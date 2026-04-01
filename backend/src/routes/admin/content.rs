use axum::Json;
use axum::body::Bytes;
use axum::extract::{Extension, Path, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde::Deserialize;
use serde_json::json;

use crate::error::ApiError;
use crate::models::{
    AdminActor, CreatePostRequest, CreatePostVersionRequest, CreateProjectRequest,
    CreateProjectVersionRequest, PostPatch, ProjectPatch, RestoreVersionRequest,
    SetCurrentVersionRequest, UpdatePostVersionRequest, UpdateProjectVersionRequest,
    UpsertTagRequest,
};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub(super) struct AdminPostsQuery {
    #[serde(rename = "includeDraft", default)]
    include_draft: bool,
    #[serde(default)]
    page: i32,
    #[serde(rename = "pageSize", default)]
    page_size: i32,
    #[serde(rename = "tagId", default)]
    tag_id: String,
}

#[derive(Debug, Deserialize)]
pub(super) struct AdminProjectsQuery {
    #[serde(rename = "includeDraft", default)]
    include_draft: bool,
}

pub(super) async fn admin_posts(
    State(state): State<AppState>,
    Query(query): Query<AdminPostsQuery>,
) -> Result<impl IntoResponse, ApiError> {
    Ok((
        StatusCode::OK,
        Json(
            state
                .list_admin_posts(
                    query.include_draft,
                    &query.tag_id,
                    query.page,
                    query.page_size,
                )
                .await
                .map_err(|_| ApiError::internal("failed_to_load_posts"))?,
        ),
    ))
}

pub(super) async fn admin_get_post(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let post = state
        .get_admin_post_by_id(&id)
        .await
        .map_err(|_| ApiError::not_found("post_not_found"))?;
    Ok((StatusCode::OK, Json(post)))
}

pub(super) async fn admin_create_post(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: CreatePostRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let post = state
        .create_post(
            &actor.user_id,
            &request.title,
            &request.slug,
            &request.summary,
        )
        .await
        .map_err(|_| ApiError::internal("failed_to_create_post"))?;
    Ok((StatusCode::CREATED, Json(post)))
}

pub(super) async fn admin_patch_post(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let patch: PostPatch =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let post = state
        .patch_post(&id, patch)
        .await
        .map_err(|_| ApiError::not_found("post_not_found"))?;
    Ok((StatusCode::OK, Json(post)))
}

pub(super) async fn admin_publish_post(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let post = state
        .set_post_published(&id, true)
        .await
        .map_err(|_| ApiError::not_found("post_not_found"))?;
    Ok((StatusCode::OK, Json(post)))
}

pub(super) async fn admin_unpublish_post(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let post = state
        .set_post_published(&id, false)
        .await
        .map_err(|_| ApiError::not_found("post_not_found"))?;
    Ok((StatusCode::OK, Json(post)))
}

pub(super) async fn admin_delete_post(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let keys = state
        .delete_post(&id)
        .await
        .map_err(|_| ApiError::not_found("post_not_found"))?;
    Ok((StatusCode::OK, Json(keys)))
}

pub(super) async fn admin_post_version_state(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let (item, current_version, latest_version) = state
        .get_post_version_state(&id)
        .await
        .map_err(|_| ApiError::not_found("post_not_found"))?;
    Ok((
        StatusCode::OK,
        Json(json!({
            "item": item,
            "currentVersion": current_version,
            "latestVersion": latest_version,
        })),
    ))
}

pub(super) async fn admin_create_post_version(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: CreatePostVersionRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let id = state
        .create_post_version(
            &request.post_id,
            &request.title,
            &request.summary,
            &request.content,
            &actor,
            request.change_description,
        )
        .await
        .map_err(|_| ApiError::not_found("post_not_found"))?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

pub(super) async fn admin_get_post_version(
    State(state): State<AppState>,
    Path(version_id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let version = state
        .get_post_version_by_id(&version_id)
        .await
        .map_err(|_| ApiError::not_found("post_version_not_found"))?;
    Ok((StatusCode::OK, Json(version)))
}

pub(super) async fn admin_update_post_version(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    Path(version_id): Path<String>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: UpdatePostVersionRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let id = state
        .update_post_version(
            &version_id,
            &request.title,
            &request.summary,
            &request.content,
            &actor,
            request.change_description,
        )
        .await
        .map_err(|_| ApiError::not_found("post_version_not_found"))?;
    Ok((StatusCode::OK, Json(json!({ "ok": true, "id": id }))))
}

pub(super) async fn admin_set_post_current_version(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: SetCurrentVersionRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    state
        .set_post_current_version(&id, &request.version_id, &request.title, &request.summary)
        .await
        .map_err(|_| ApiError::not_found("post_not_found"))?;
    Ok((StatusCode::OK, Json(json!({ "ok": true }))))
}

pub(super) async fn admin_list_post_versions(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let versions = state
        .list_post_versions(&id)
        .await
        .map_err(|_| ApiError::not_found("post_not_found"))?;
    Ok((StatusCode::OK, Json(versions)))
}

pub(super) async fn admin_restore_post_version(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: RestoreVersionRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    state
        .restore_post_version(&id, request.version_number, &actor)
        .await
        .map_err(|_| ApiError::not_found("post_version_not_found"))?;
    Ok((StatusCode::OK, Json(json!({ "ok": true }))))
}

pub(super) async fn admin_projects(
    State(state): State<AppState>,
    Query(query): Query<AdminProjectsQuery>,
) -> Result<impl IntoResponse, ApiError> {
    Ok((
        StatusCode::OK,
        Json(
            state
                .list_admin_projects(query.include_draft)
                .await
                .map_err(|_| ApiError::internal("failed_to_load_projects"))?,
        ),
    ))
}

pub(super) async fn admin_get_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let project = state
        .get_admin_project_by_id(&id)
        .await
        .map_err(|_| ApiError::not_found("project_not_found"))?;
    Ok((StatusCode::OK, Json(project)))
}

pub(super) async fn admin_create_project(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: CreateProjectRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let project = state
        .create_project(
            &actor.user_id,
            &request.title,
            &request.slug,
            &request.summary,
        )
        .await
        .map_err(|_| ApiError::internal("failed_to_create_project"))?;
    Ok((StatusCode::CREATED, Json(project)))
}

pub(super) async fn admin_patch_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let patch: ProjectPatch =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let project = state
        .patch_project(&id, patch)
        .await
        .map_err(|_| ApiError::not_found("project_not_found"))?;
    Ok((StatusCode::OK, Json(project)))
}

pub(super) async fn admin_publish_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let project = state
        .set_project_published(&id, true)
        .await
        .map_err(|_| ApiError::not_found("project_not_found"))?;
    Ok((StatusCode::OK, Json(project)))
}

pub(super) async fn admin_unpublish_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let project = state
        .set_project_published(&id, false)
        .await
        .map_err(|_| ApiError::not_found("project_not_found"))?;
    Ok((StatusCode::OK, Json(project)))
}

pub(super) async fn admin_delete_project(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let keys = state
        .delete_project(&id)
        .await
        .map_err(|_| ApiError::not_found("project_not_found"))?;
    Ok((StatusCode::OK, Json(keys)))
}

pub(super) async fn admin_project_version_state(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let (item, current_version, latest_version) = state
        .get_project_version_state(&id)
        .await
        .map_err(|_| ApiError::not_found("project_not_found"))?;
    Ok((
        StatusCode::OK,
        Json(json!({
            "item": item,
            "currentVersion": current_version,
            "latestVersion": latest_version,
        })),
    ))
}

pub(super) async fn admin_create_project_version(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: CreateProjectVersionRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let id = state
        .create_project_version(request, &actor)
        .await
        .map_err(|_| ApiError::not_found("project_not_found"))?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

pub(super) async fn admin_get_project_version(
    State(state): State<AppState>,
    Path(version_id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let version = state
        .get_project_version_by_id(&version_id)
        .await
        .map_err(|_| ApiError::not_found("project_version_not_found"))?;
    Ok((StatusCode::OK, Json(version)))
}

pub(super) async fn admin_update_project_version(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    Path(version_id): Path<String>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: UpdateProjectVersionRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let id = state
        .update_project_version(
            &version_id,
            &request.title,
            &request.summary,
            &request.content,
            request.links,
            &actor,
            request.change_description,
        )
        .await
        .map_err(|_| ApiError::not_found("project_version_not_found"))?;
    Ok((StatusCode::OK, Json(json!({ "ok": true, "id": id }))))
}

pub(super) async fn admin_set_project_current_version(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: SetCurrentVersionRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    state
        .set_project_current_version(&id, &request.version_id, &request.title, &request.summary)
        .await
        .map_err(|_| ApiError::not_found("project_not_found"))?;
    Ok((StatusCode::OK, Json(json!({ "ok": true }))))
}

pub(super) async fn admin_list_project_versions(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let versions = state
        .list_project_versions(&id)
        .await
        .map_err(|_| ApiError::not_found("project_not_found"))?;
    Ok((StatusCode::OK, Json(versions)))
}

pub(super) async fn admin_restore_project_version(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: RestoreVersionRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    state
        .restore_project_version(&id, request.version_number, &actor)
        .await
        .map_err(|_| ApiError::not_found("project_version_not_found"))?;
    Ok((StatusCode::OK, Json(json!({ "ok": true }))))
}

pub(super) async fn admin_tags(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    Ok((
        StatusCode::OK,
        Json(
            state
                .list_tags()
                .await
                .map_err(|_| ApiError::internal("failed_to_load_tags"))?,
        ),
    ))
}

pub(super) async fn admin_create_tag(
    State(state): State<AppState>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: UpsertTagRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    if request.name.trim().is_empty() || request.slug.trim().is_empty() {
        return Err(ApiError::bad_request("invalid_request"));
    }
    let tag = state
        .create_tag(&request.name, &request.slug)
        .await
        .map_err(|_| ApiError::internal("failed_to_create_tag"))?;
    Ok((StatusCode::CREATED, Json(tag)))
}

pub(super) async fn admin_update_tag(
    State(state): State<AppState>,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: UpsertTagRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    if request.name.trim().is_empty() || request.slug.trim().is_empty() {
        return Err(ApiError::bad_request("invalid_request"));
    }
    let tag = state
        .update_tag(&id, &request.name, &request.slug)
        .await
        .map_err(|_| ApiError::not_found("tag_not_found"))?;
    Ok((StatusCode::OK, Json(tag)))
}

pub(super) async fn admin_delete_tag(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    state
        .delete_tag(&id)
        .await
        .map_err(|_| ApiError::not_found("tag_not_found"))?;
    Ok((StatusCode::OK, Json(json!({ "ok": true }))))
}
