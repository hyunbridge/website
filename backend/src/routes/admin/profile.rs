use axum::Json;
use axum::body::Bytes;
use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde_json::json;

use crate::error::ApiError;
use crate::models::{AdminActor, AdminProfile, UpdatePasswordRequest, UpdateProfileRequest};
use crate::state::AppState;

pub(super) async fn admin_profile(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
) -> Result<impl IntoResponse, ApiError> {
    let profile = state
        .admin_me(&actor)
        .await
        .map_err(|_| ApiError::internal("failed_to_load_profile"))?;
    Ok((StatusCode::OK, Json(profile_payload_json(&profile))))
}

pub(super) async fn admin_update_profile(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: UpdateProfileRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    let profile = state
        .update_admin_profile(&actor, request)
        .await
        .map_err(|_| ApiError::internal("failed_to_update_profile"))?;
    Ok((StatusCode::OK, Json(profile)))
}

pub(super) async fn admin_update_password(
    State(state): State<AppState>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: UpdatePasswordRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_password"))?;
    if request.current_password.len() < 8 || request.password.len() < 8 {
        return Err(ApiError::bad_request("invalid_password"));
    }
    state
        .update_admin_password(&request.current_password, &request.password)
        .await?;
    Ok((StatusCode::OK, Json(json!({ "ok": true }))))
}

fn profile_payload_json(profile: &AdminProfile) -> serde_json::Value {
    json!({
        "username": profile.username,
        "full_name": profile.full_name,
        "avatar_url": profile.avatar_url,
        "email": profile.email,
        "git_author_name": profile.git_author_name,
        "git_author_email": profile.git_author_email,
    })
}
