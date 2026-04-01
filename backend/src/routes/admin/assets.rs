use axum::Json;
use axum::body::Bytes;
use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde::Deserialize;
use serde_json::json;

use crate::error::ApiError;
use crate::models::AdminActor;
use crate::object_storage::ObjectStorage;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct PresignUploadRequest {
    #[serde(rename = "resourceType")]
    resource_type: String,
    #[serde(rename = "resourceId", default)]
    resource_id: String,
    filename: String,
    #[serde(rename = "contentType", default)]
    content_type: String,
}

#[derive(Debug, Deserialize)]
struct CompleteAssetUploadRequest {
    #[serde(rename = "resourceType")]
    resource_type: String,
    #[serde(rename = "resourceId", default)]
    resource_id: String,
    #[serde(rename = "objectKey", default)]
    object_key: String,
}

#[derive(Debug, Deserialize)]
struct DeleteObjectsRequest {
    keys: Vec<String>,
}

pub(super) async fn create_presigned_upload(
    Extension(actor): Extension<AdminActor>,
    State(state): State<AppState>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: PresignUploadRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    if request.content_type.trim().is_empty() {
        return Err(ApiError::bad_request("invalid_request"));
    }
    let key = build_asset_object_key(
        &actor,
        &request.resource_type,
        &request.resource_id,
        &request.filename,
    )
    .map_err(|err| {
        if err.status_code() == StatusCode::BAD_REQUEST {
            ApiError::bad_request(format!("code=400, message={}", err.message()))
        } else {
            err
        }
    })?;
    let storage = ObjectStorage::new(&state.config);
    if !storage.is_configured() {
        return Err(ApiError::internal("object storage is not configured"));
    }
    let url = storage
        .presign_put_object(
            &key,
            &request.content_type,
            std::time::Duration::from_secs(60 * 60),
        )
        .await
        .map_err(ApiError::internal)?;
    let file_url = storage.public_url(&key).map_err(ApiError::internal)?;
    Ok((
        StatusCode::OK,
        Json(json!({
            "url": url,
            "fileUrl": file_url,
            "key": key,
        })),
    ))
}

pub(super) async fn complete_asset_upload(
    State(state): State<AppState>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: CompleteAssetUploadRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    if request.object_key.trim().is_empty() {
        return Err(ApiError::bad_request("invalid_request"));
    }
    match request.resource_type.trim() {
        "post" => {
            if request.resource_id.trim().is_empty() {
                return Err(ApiError::bad_request("invalid_request"));
            }
            state
                .add_post_asset(&request.resource_id, &request.object_key)
                .await
                .map_err(|_| ApiError::not_found("post_not_found"))?;
            Ok((StatusCode::OK, Json(json!({ "ok": true }))))
        }
        "project" => {
            if request.resource_id.trim().is_empty() {
                return Err(ApiError::bad_request("invalid_request"));
            }
            state
                .add_project_asset(&request.resource_id, &request.object_key)
                .await
                .map_err(|_| ApiError::not_found("project_not_found"))?;
            Ok((StatusCode::OK, Json(json!({ "ok": true }))))
        }
        "avatar" => Ok((StatusCode::OK, Json(json!({ "ok": true })))),
        _ => Err(ApiError::bad_request("invalid_request")),
    }
}

pub(super) async fn delete_objects(
    State(state): State<AppState>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: DeleteObjectsRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    if request.keys.is_empty() {
        return Err(ApiError::bad_request("invalid_request"));
    }
    let storage = ObjectStorage::new(&state.config);
    if !storage.is_configured() {
        return Err(ApiError::internal("object storage is not configured"));
    }
    storage
        .delete_objects(&request.keys)
        .await
        .map_err(ApiError::internal)?;
    Ok((StatusCode::OK, Json(json!({ "success": true }))))
}

fn build_asset_object_key(
    actor: &AdminActor,
    resource_type: &str,
    resource_id: &str,
    filename: &str,
) -> Result<String, ApiError> {
    let extension = std::path::Path::new(filename)
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{}", value.to_ascii_lowercase()))
        .unwrap_or_default();
    let object_id = ulid::Ulid::new().to_string();
    match resource_type.trim() {
        "post" | "project" => {
            if resource_id.trim().is_empty() {
                return Err(ApiError::bad_request("missing_resource_id"));
            }
            Ok(format!(
                "assets/{}/{object_id}{extension}",
                resource_id.trim()
            ))
        }
        "avatar" => {
            let owner = if actor.user_id.trim().is_empty() {
                resource_id.trim()
            } else {
                actor.user_id.trim()
            };
            if owner.is_empty() {
                return Err(ApiError::bad_request("missing_resource_id"));
            }
            Ok(format!("avatars/{owner}/{object_id}{extension}"))
        }
        _ => Err(ApiError::bad_request("invalid_resource_type")),
    }
}
