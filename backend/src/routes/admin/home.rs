use axum::Json;
use axum::body::Bytes;
use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde::Deserialize;

use crate::error::ApiError;
use crate::models::{AdminActor, RestoreVersionRequest, SaveHomeRequest};
use crate::state::AppState;

pub(super) async fn admin_get_home(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let home = state
        .get_home_document()
        .await
        .map_err(|_| ApiError::internal("failed_to_load_home"))?;
    Ok((StatusCode::OK, Json(home)))
}

pub(super) async fn admin_save_home(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: SaveHomeRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let _ = request.change_description;
    let document = state
        .save_home_draft(&actor.user_id, request.data)
        .await
        .map_err(|_| ApiError::internal("failed_to_save_home"))?;
    Ok((StatusCode::OK, Json(document)))
}

pub(super) async fn admin_save_home_version(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    #[derive(Debug, Deserialize)]
    struct Request {
        #[serde(rename = "changeDescription", default)]
        change_description: String,
    }

    let request: Request =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let document = state
        .save_home_version(&actor, &request.change_description)
        .await
        .map_err(|_| ApiError::internal("failed_to_save_home_version"))?;
    Ok((StatusCode::OK, Json(document)))
}

pub(super) async fn admin_list_home_versions(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let versions = state
        .list_home_versions()
        .await
        .map_err(|_| ApiError::internal("failed_to_load_home_versions"))?;
    Ok((StatusCode::OK, Json(versions)))
}

pub(super) async fn admin_restore_home_version(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: RestoreVersionRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let document = state
        .restore_home_version(request.version_number, &actor)
        .await
        .map_err(|_| ApiError::not_found("home_version_not_found"))?;
    Ok((StatusCode::OK, Json(document)))
}
