use axum::Json;
use axum::body::Bytes;
use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use serde_json::json;
use validator::Validate;

use crate::auth;
use crate::error::ApiError;
use crate::models::{AdminJwtClaims, LoginRequest};
use crate::state::AppState;

pub(super) async fn admin_login(
    State(state): State<AppState>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: LoginRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;

    request
        .validate()
        .map_err(|_| ApiError::bad_request("invalid_credentials_shape"))?;

    if !auth::should_bypass_turnstile(&state.config) && request.captcha_token.trim().is_empty() {
        return Err(ApiError::bad_request("captcha_required"));
    }

    auth::verify_turnstile(&state, &request.captcha_token).await?;

    let profile = state
        .authenticate_admin(&request.email, &request.password)
        .await?
        .ok_or_else(|| ApiError::unauthorized("invalid_credentials"))?;

    let token = auth::issue_admin_token(&state.config, &profile)?;
    Ok((StatusCode::OK, Json(token)))
}

pub(super) async fn admin_me(
    Extension(claims): Extension<AdminJwtClaims>,
) -> Result<impl IntoResponse, ApiError> {
    Ok((
        StatusCode::OK,
        Json(json!({
            "id": claims.sub,
            "email": claims.email,
            "role": claims.role,
        })),
    ))
}

pub(super) async fn admin_dashboard(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    Ok((
        StatusCode::OK,
        Json(
            state
                .counts()
                .await
                .map_err(|_| ApiError::internal("failed_to_load_dashboard"))?,
        ),
    ))
}
