use axum::Json;
use axum::body::Bytes;
use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::Deserialize;
use serde_json::json;

use crate::auth;
use crate::error::ApiError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
struct VerifyProtectedEmailRequest {
    token: String,
}

#[derive(Debug, Deserialize)]
pub(super) struct ProtectedEmailStatusQuery {
    #[serde(default)]
    token: String,
}

pub(super) async fn verify_protected_email(
    State(state): State<AppState>,
    body: Bytes,
) -> Result<impl IntoResponse, ApiError> {
    let request: VerifyProtectedEmailRequest =
        serde_json::from_slice(&body).map_err(|_| ApiError::bad_request("invalid_request"))?;
    if request.token.trim().is_empty() {
        return Err(ApiError::bad_request("invalid_request"));
    }
    auth::verify_turnstile(&state, &request.token).await?;
    let token = issue_protected_email_token(&state)?;
    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "token": token,
            "email": state.config.protected_email,
        })),
    ))
}

pub(super) async fn check_protected_email(
    State(state): State<AppState>,
    Query(query): Query<ProtectedEmailStatusQuery>,
) -> Result<impl IntoResponse, ApiError> {
    if state.config.protected_email_token_secret.trim().is_empty() {
        return Ok((
            StatusCode::OK,
            Json(json!({ "success": false, "verified": false })),
        ));
    }
    if query.token.trim().is_empty() {
        return Ok((StatusCode::BAD_REQUEST, Json(json!({ "success": false }))));
    }

    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_audience(&[state.config.protected_email_token_audience.trim()]);
    validation.set_issuer(&[state.config.protected_email_token_issuer.trim()]);
    let claims = decode::<serde_json::Value>(
        &query.token,
        &DecodingKey::from_secret(state.config.protected_email_token_secret.as_bytes()),
        &validation,
    )
    .map(|token| token.claims)
    .ok();

    let Some(claims) = claims else {
        return Ok((
            StatusCode::OK,
            Json(json!({ "success": false, "verified": false })),
        ));
    };

    let verified = claims
        .get("verified")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let email = claims
        .get("email")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    let subject = claims
        .get("sub")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    if !verified
        || email.trim() != state.config.protected_email.trim()
        || subject.trim() != "protected-email"
    {
        return Ok((
            StatusCode::OK,
            Json(json!({ "success": false, "verified": false })),
        ));
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "success": true,
            "verified": true,
            "email": email.trim(),
        })),
    ))
}

fn issue_protected_email_token(state: &AppState) -> Result<String, ApiError> {
    if state.config.protected_email_token_secret.trim().is_empty() {
        return Err(ApiError::internal(
            "protected email token secret is not configured",
        ));
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let claims = json!({
        "sub": "protected-email",
        "iss": state.config.protected_email_token_issuer,
        "aud": state.config.protected_email_token_audience,
        "iat": now,
        "exp": now + state.config.protected_email_token_ttl.as_secs(),
        "verified": true,
        "email": state.config.protected_email.trim(),
    });
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(state.config.protected_email_token_secret.as_bytes()),
    )
    .map_err(|_| ApiError::internal("failed_to_issue_token"))
}
