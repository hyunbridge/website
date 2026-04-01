use std::time::{SystemTime, UNIX_EPOCH};

use axum::extract::{Request, State};
use axum::middleware::Next;
use axum::response::Response;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use reqwest::header::CONTENT_TYPE;

use crate::config::AppConfig;
use crate::error::ApiError;
use crate::models::{
    AccessTokenResponse, AdminActor, AdminJwtClaims, AdminProfile, TurnstileVerificationResponse,
};
use crate::state::AppState;

pub async fn require_admin_jwt(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    let auth_header = request
        .headers()
        .get(http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    let claims = parse_admin_jwt(&state.config, auth_header)?;
    request.extensions_mut().insert(AdminActor {
        user_id: claims.sub.clone(),
        email: claims.email.clone(),
        auth_type: "jwt".to_owned(),
    });
    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}

pub async fn require_admin_jwt_or_bridge(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    if let Some(actor) = parse_bridge_actor(&state.config, request.headers(), true)? {
        request.extensions_mut().insert(actor);
        return Ok(next.run(request).await);
    }

    let auth_header = request
        .headers()
        .get(http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    let claims = parse_admin_jwt(&state.config, auth_header)?;
    request.extensions_mut().insert(AdminActor {
        user_id: claims.sub.clone(),
        email: claims.email.clone(),
        auth_type: "jwt".to_owned(),
    });
    request.extensions_mut().insert(claims);
    Ok(next.run(request).await)
}

pub async fn optional_admin_jwt_or_bridge(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, ApiError> {
    if let Some(actor) = parse_bridge_actor(&state.config, request.headers(), false)? {
        request.extensions_mut().insert(actor);
        return Ok(next.run(request).await);
    }

    let auth_header = request
        .headers()
        .get(http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default();
    if let Ok(claims) = parse_admin_jwt(&state.config, auth_header) {
        request.extensions_mut().insert(AdminActor {
            user_id: claims.sub.clone(),
            email: claims.email.clone(),
            auth_type: "jwt".to_owned(),
        });
        request.extensions_mut().insert(claims);
    }
    Ok(next.run(request).await)
}

pub fn issue_admin_token(
    config: &AppConfig,
    profile: &AdminProfile,
) -> Result<AccessTokenResponse, ApiError> {
    if config.jwt_secret.is_empty() {
        return Err(ApiError::internal("failed_to_issue_token"));
    }
    if profile.id.trim().is_empty() {
        return Err(ApiError::internal("failed_to_issue_token"));
    }

    let now = unix_timestamp();
    let expires_in = config.access_token_ttl.as_secs();
    let claims = AdminJwtClaims {
        sub: profile.id.trim().to_owned(),
        iss: config.jwt_issuer.trim().to_owned(),
        aud: config.jwt_audience.trim().to_owned(),
        iat: now,
        exp: now + expires_in,
        role: "admin".to_owned(),
        email: profile.email.trim().to_owned(),
        username: profile.username.trim().to_owned(),
        name: profile
            .full_name
            .as_ref()
            .map(|name| name.trim().to_owned())
            .filter(|name| !name.is_empty()),
    };

    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(config.jwt_secret.as_bytes()),
    )
    .map_err(|_| ApiError::internal("failed_to_issue_token"))?;

    Ok(AccessTokenResponse {
        access_token: token,
        expires_in: expires_in as i64,
    })
}

pub fn parse_admin_jwt(config: &AppConfig, auth_header: &str) -> Result<AdminJwtClaims, ApiError> {
    let Some(token) = auth_header.strip_prefix("Bearer ") else {
        return Err(ApiError::unauthorized(
            "missing_or_invalid_authorization_header",
        ));
    };

    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_audience(&[config.jwt_audience.trim()]);
    validation.set_issuer(&[config.jwt_issuer.trim()]);

    decode::<AdminJwtClaims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|_| ApiError::unauthorized("unauthorized"))
}

pub fn should_bypass_turnstile(config: &AppConfig) -> bool {
    config.turnstile_secret.trim().is_empty() && !config.is_production()
}

pub async fn verify_turnstile(state: &AppState, token: &str) -> Result<(), ApiError> {
    if should_bypass_turnstile(&state.config) {
        return Ok(());
    }

    if state.config.turnstile_secret.trim().is_empty() {
        return Err(ApiError::unauthorized("turnstile secret is not configured"));
    }
    if token.trim().is_empty() {
        return Err(ApiError::unauthorized("turnstile token is required"));
    }

    let response = state
        .http_client
        .post("https://challenges.cloudflare.com/turnstile/v0/siteverify")
        .header(CONTENT_TYPE, "application/x-www-form-urlencoded")
        .form(&[
            ("secret", state.config.turnstile_secret.as_str()),
            ("response", token),
        ])
        .send()
        .await
        .map_err(|err| ApiError::unauthorized(err.to_string()))?;

    let payload: TurnstileVerificationResponse = response
        .json()
        .await
        .map_err(|err| ApiError::unauthorized(err.to_string()))?;

    if payload.success {
        return Ok(());
    }

    if payload.error_codes.is_empty() {
        return Err(ApiError::unauthorized("turnstile verification failed"));
    }

    Err(ApiError::unauthorized(format!(
        "turnstile verification failed: {}",
        payload.error_codes.join(", ")
    )))
}

fn unix_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn parse_bridge_actor(
    config: &AppConfig,
    headers: &http::HeaderMap,
    strict: bool,
) -> Result<Option<AdminActor>, ApiError> {
    let bridge_secret = headers
        .get("x-admin-bridge-secret")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .trim()
        .to_owned();
    if bridge_secret.is_empty() {
        return Ok(None);
    }

    if config.admin_bridge_secret.trim().is_empty()
        || bridge_secret != config.admin_bridge_secret.trim()
    {
        if strict {
            return Err(ApiError::unauthorized("unauthorized"));
        }
        return Ok(None);
    }

    let user_id = headers
        .get("x-admin-user-id")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .trim()
        .to_owned();
    let email = headers
        .get("x-admin-user-email")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .trim()
        .to_owned();

    if strict && user_id.is_empty() {
        return Err(ApiError::unauthorized("missing_bridge_user"));
    }
    if strict && email.is_empty() {
        return Err(ApiError::unauthorized("missing_bridge_email"));
    }

    if user_id.is_empty() {
        return Ok(None);
    }

    Ok(Some(AdminActor {
        user_id,
        email,
        auth_type: "bridge".to_owned(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;
    use std::time::Duration;
    use tracing::Level;

    fn test_config() -> AppConfig {
        AppConfig {
            app_env: "test".to_owned(),
            http_addr: ":8080".to_owned(),
            log_level: Level::INFO,
            jwt_issuer: "issuer".to_owned(),
            jwt_audience: "audience".to_owned(),
            jwt_secret: "secret".to_owned(),
            access_token_ttl: Duration::from_secs(3600),
            s3_bucket: String::new(),
            s3_region: String::new(),
            s3_endpoint: String::new(),
            s3_access_key: String::new(),
            s3_secret_key: String::new(),
            s3_public_base_url: String::new(),
            gotenberg_url: String::new(),
            gotenberg_username: String::new(),
            gotenberg_password: String::new(),
            public_site_url: String::new(),
            cloudflare_pages_deploy_hook_url: String::new(),
            cloudflare_webhook_secret: String::new(),
            content_repo_dir: String::new(),
            content_repo_source_url: String::new(),
            content_repo_source_username: String::new(),
            content_repo_source_password: String::new(),
            mongo_url: String::new(),
            mongo_database_name: String::new(),
            editorial_git_branch: "main".to_owned(),
            cv_source_url: String::new(),
            notion_cv_page_id: String::new(),
            protected_email: String::new(),
            protected_email_token_secret: String::new(),
            protected_email_token_issuer: String::new(),
            protected_email_token_audience: String::new(),
            protected_email_token_ttl: Duration::from_secs(60),
            turnstile_secret: String::new(),
            admin_bridge_secret: "bridge-secret".to_owned(),
            cors_allowed_origins: Vec::new(),
        }
    }

    #[test]
    fn parse_bridge_actor_requires_email_in_strict_mode() {
        let config = test_config();
        let mut headers = http::HeaderMap::new();
        headers.insert(
            "x-admin-bridge-secret",
            HeaderValue::from_static("bridge-secret"),
        );
        headers.insert("x-admin-user-id", HeaderValue::from_static("admin-1"));

        let err = parse_bridge_actor(&config, &headers, true).unwrap_err();
        assert_eq!(err.status_code(), http::StatusCode::UNAUTHORIZED);
        assert_eq!(err.message(), "missing_bridge_email");
    }

    #[test]
    fn parse_bridge_actor_accepts_complete_bridge_identity() {
        let config = test_config();
        let mut headers = http::HeaderMap::new();
        headers.insert(
            "x-admin-bridge-secret",
            HeaderValue::from_static("bridge-secret"),
        );
        headers.insert("x-admin-user-id", HeaderValue::from_static("admin-1"));
        headers.insert(
            "x-admin-user-email",
            HeaderValue::from_static("admin@example.com"),
        );

        let actor = parse_bridge_actor(&config, &headers, true)
            .unwrap()
            .expect("bridge actor");
        assert_eq!(actor.user_id, "admin-1");
        assert_eq!(actor.email, "admin@example.com");
        assert_eq!(actor.auth_type, "bridge");
    }
}
