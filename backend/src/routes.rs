mod admin;
mod public;

use axum::Router;
use axum::http::header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE, ORIGIN};
use axum::http::{HeaderName, HeaderValue, Method, StatusCode};
use axum::middleware;
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use serde_json::json;
use std::any::Any;
use tower_http::catch_panic::CatchPanicLayer;
use tower_http::compression::CompressionLayer;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::request_id::{MakeRequestUuid, PropagateRequestIdLayer, SetRequestIdLayer};
use tower_http::trace::TraceLayer;
use tracing::error;

use crate::auth;
use crate::error::ApiError;
use crate::state::AppState;

pub fn build_router(state: AppState) -> Router {
    let admin_jwt = middleware::from_fn_with_state(state.clone(), auth::require_admin_jwt);
    let admin_jwt_or_bridge =
        middleware::from_fn_with_state(state.clone(), auth::require_admin_jwt_or_bridge);
    let optional_admin =
        middleware::from_fn_with_state(state.clone(), auth::optional_admin_jwt_or_bridge);

    let public_api = public::router().route_layer(optional_admin);
    let admin_api = admin::admin_router().route_layer(admin_jwt);
    let profile_api = admin::profile_router().route_layer(admin_jwt_or_bridge);
    let auth_api = admin::auth_router();

    Router::new()
        .route("/healthz", get(healthz))
        .route("/api/v1/healthz", get(healthz))
        .nest(
            "/api/v1",
            public_api
                .merge(admin_api)
                .merge(profile_api)
                .merge(auth_api),
        )
        .with_state(state.clone())
        .fallback(not_found)
        .layer(build_cors(&state))
        .layer(CompressionLayer::new())
        .layer(PropagateRequestIdLayer::x_request_id())
        .layer(CatchPanicLayer::custom(handle_panic))
        .layer(TraceLayer::new_for_http())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid))
}

async fn healthz() -> impl axum::response::IntoResponse {
    axum::Json(serde_json::json!({ "status": "ok" }))
}

async fn not_found() -> Response {
    ApiError::not_found("not_found").into_response()
}

fn build_cors(state: &AppState) -> CorsLayer {
    let origins: Vec<HeaderValue> = state
        .config
        .cors_allowed_origins
        .iter()
        .filter_map(|origin| HeaderValue::from_str(origin).ok())
        .collect();

    let bridge_secret = HeaderName::from_static("x-admin-bridge-secret");
    let bridge_user_id = HeaderName::from_static("x-admin-user-id");
    let bridge_user_email = HeaderName::from_static("x-admin-user-email");

    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([
            Method::GET,
            Method::HEAD,
            Method::PUT,
            Method::PATCH,
            Method::POST,
            Method::DELETE,
        ])
        .allow_headers([
            ORIGIN,
            CONTENT_TYPE,
            ACCEPT,
            AUTHORIZATION,
            bridge_secret,
            bridge_user_id,
            bridge_user_email,
        ])
}

fn handle_panic(panic: Box<dyn Any + Send + 'static>) -> Response {
    let details = panic
        .downcast_ref::<String>()
        .map(String::as_str)
        .or_else(|| panic.downcast_ref::<&str>().copied())
        .unwrap_or("unknown panic payload");
    error!(details, "request panicked");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        axum::Json(json!({ "error": "internal_server_error" })),
    )
        .into_response()
}
