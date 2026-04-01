use axum::Json;
use axum::body::Bytes;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use serde_json::json;

use crate::error::ApiError;
use crate::state::AppState;

pub(super) async fn system_info(State(state): State<AppState>) -> impl IntoResponse {
    let mut payload = json!({
        "service": "website-api",
        "version": "0.1.0",
        "targets": [
            "admin-auth",
            "content-api",
            "asset-api",
            "cv-jobs"
        ]
    });

    if !state.config.is_production() {
        payload["env"] = json!(state.config.app_env);
    }

    Json(payload)
}

pub(super) async fn handle_cloudflare_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    if !state.config.cloudflare_webhook_secret.trim().is_empty() {
        let provided = headers
            .get("cf-webhook-auth")
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .trim()
            .to_owned();
        if provided != state.config.cloudflare_webhook_secret.trim() {
            return Err(ApiError::unauthorized("invalid_webhook_secret"));
        }
    }
    state
        .accept_deploy_webhook(&body)
        .await
        .map_err(|_| ApiError::bad_request("failed_to_process_deploy_notification"))?;
    Ok((StatusCode::ACCEPTED, Json(json!({ "status": "accepted" }))))
}
