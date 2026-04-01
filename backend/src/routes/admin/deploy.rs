use axum::Json;
use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;

use crate::error::ApiError;
use crate::models::AdminActor;
use crate::state::AppState;

pub(super) async fn admin_deploy_dashboard(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let dashboard = state
        .deploy_dashboard()
        .await
        .map_err(|_| ApiError::internal("failed_to_load_deploy_dashboard"))?;
    Ok((StatusCode::OK, Json(dashboard)))
}

pub(super) async fn admin_deploy_preview(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let preview = state
        .deploy_preview()
        .await
        .map_err(|_| ApiError::internal("failed_to_load_deploy_dashboard"))?;
    Ok((StatusCode::OK, Json(preview)))
}

pub(super) async fn admin_deploy_sync(
    State(state): State<AppState>,
    Extension(actor): Extension<AdminActor>,
) -> Result<impl IntoResponse, ApiError> {
    let dashboard = state.sync_deploy(&actor).await.map_err(|err| {
        if err.status_code() == StatusCode::NOT_IMPLEMENTED {
            err
        } else {
            ApiError::internal("failed_to_enqueue_deploy")
        }
    })?;
    Ok((StatusCode::OK, Json(dashboard)))
}
