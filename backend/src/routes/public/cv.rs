use axum::Json;
use axum::body::Body;
use axum::extract::{Query, State};
use axum::http::header::{CONTENT_TYPE, HOST, ORIGIN};
use axum::http::{HeaderMap, HeaderName, StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;

use crate::auth;
use crate::error::ApiError;
use crate::notion::{NotionClient, parse_page_id};
use crate::object_storage::{ObjectStorage, PutObjectInput};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub(super) struct CVPdfQuery {
    #[serde(default)]
    token: String,
}

pub(super) async fn get_cv_content(
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let payload = load_cv_payload(&state)
        .await
        .map_err(|err| ApiError::new(StatusCode::BAD_GATEWAY, err))?;
    Ok(Json(payload))
}

pub(super) async fn get_cv_pdf(
    State(state): State<AppState>,
    Query(query): Query<CVPdfQuery>,
    headers: HeaderMap,
    uri: Uri,
) -> Result<Response, ApiError> {
    auth::verify_turnstile(&state, &query.token).await?;

    let storage = ObjectStorage::new(&state.config);
    if storage.is_configured() {
        let payload = load_cv_payload(&state)
            .await
            .map_err(|err| ApiError::new(StatusCode::BAD_GATEWAY, err))?;
        let last_modified = get_cv_last_modified(payload.get("recordMap"));
        let object_key = build_cv_pdf_object_key(&last_modified);
        let download_url = storage
            .public_url(&object_key)
            .map_err(ApiError::internal)?;
        let exists = storage
            .object_exists(&object_key)
            .await
            .map_err(ApiError::internal)?;
        if exists {
            return Ok((
                StatusCode::OK,
                Json(json!({
                    "downloadUrl": download_url,
                    "source": "cache",
                })),
            )
                .into_response());
        }

        let target_url = cv_render_target(&state, &headers, Some(&uri))?;
        let pdf = gotenberg_convert_url_to_pdf(&state, &target_url).await?;
        let mut metadata = HashMap::new();
        metadata.insert("filename".to_owned(), "CV.pdf".to_owned());
        metadata.insert("source".to_owned(), "gotenberg".to_owned());
        metadata.insert("render_url".to_owned(), target_url);
        metadata.insert("revision".to_owned(), last_modified.clone());
        storage
            .put_object(PutObjectInput {
                key: object_key,
                body: pdf,
                content_type: "application/pdf".to_owned(),
                content_disposition: "attachment; filename=\"CV.pdf\"".to_owned(),
                cache_control: get_cv_pdf_cache_control(&last_modified),
                metadata,
            })
            .await
            .map_err(ApiError::internal)?;
        return Ok((
            StatusCode::OK,
            Json(json!({
                "downloadUrl": download_url,
                "source": "generated",
            })),
        )
            .into_response());
    }

    let target_url = cv_render_target(&state, &headers, Some(&uri))?;
    let pdf = gotenberg_convert_url_to_pdf(&state, &target_url).await?;
    Response::builder()
        .status(StatusCode::OK)
        .header(CONTENT_TYPE, "application/pdf")
        .body(Body::from(pdf))
        .map_err(|err| ApiError::internal(err.to_string()))
}

pub(super) async fn get_cv_pdf_cache_status(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let storage = ObjectStorage::new(&state.config);
    let mut has_cache = false;
    let mut download_url = String::new();
    if storage.is_configured()
        && let Ok(payload) = load_cv_payload(&state).await
    {
        let last_modified = get_cv_last_modified(payload.get("recordMap"));
        let object_key = build_cv_pdf_object_key(&last_modified);
        download_url = storage.public_url(&object_key).unwrap_or_default();
        if let Ok(exists) = storage.object_exists(&object_key).await {
            has_cache = exists;
        }
    }

    Ok((
        StatusCode::OK,
        Json(json!({
            "hasCache": has_cache,
            "downloadUrl": download_url,
            "storageConfigured": storage.is_configured(),
            "gotenbergReady": !state.config.gotenberg_url.trim().is_empty(),
        })),
    ))
}

fn cv_render_target(
    state: &AppState,
    headers: &HeaderMap,
    uri: Option<&Uri>,
) -> Result<String, ApiError> {
    if !state.config.cv_source_url.trim().is_empty() {
        return Ok(state.config.cv_source_url.trim().to_owned());
    }
    let mut base = state
        .config
        .public_site_url
        .trim()
        .trim_end_matches('/')
        .to_owned();
    if base.is_empty() {
        base = header_string(headers, ORIGIN)
            .trim_end_matches('/')
            .to_owned();
    }
    if base.is_empty() {
        let host = header_string(headers, HOST);
        let forwarded_host = header_string(headers, HeaderName::from_static("x-forwarded-host"));
        let host = if !forwarded_host.is_empty() {
            forwarded_host
        } else {
            host
        };
        let proto = header_string(headers, HeaderName::from_static("x-forwarded-proto"));
        if !host.is_empty() {
            let scheme = if proto.is_empty() {
                "http"
            } else {
                proto.as_str()
            };
            base = format!("{scheme}://{host}");
        } else if let Some(authority) = uri.and_then(Uri::authority) {
            let scheme = if proto.is_empty() {
                "http"
            } else {
                proto.as_str()
            };
            base = format!("{scheme}://{authority}");
        }
    }
    if base.is_empty() {
        return Err(ApiError::internal("public site url is not configured"));
    }
    Ok(format!("{base}/cv/print"))
}

async fn load_cv_payload(state: &AppState) -> Result<serde_json::Value, String> {
    let page_id = cv_page_id(state)?;
    let record_map = NotionClient::new(state.http_client.clone())
        .get_page(&page_id)
        .await
        .map_err(|_| http_error_string(502, "failed_to_load_cv"))?;
    Ok(json!({
        "pageId": page_id,
        "recordMap": record_map,
    }))
}

fn cv_page_id(state: &AppState) -> Result<String, String> {
    for candidate in [
        state.config.notion_cv_page_id.as_str(),
        state.config.cv_source_url.as_str(),
    ] {
        if candidate.trim().is_empty() {
            continue;
        }
        if let Ok(page_id) = parse_page_id(candidate) {
            return Ok(page_id);
        }
    }
    Err(http_error_string(
        503,
        "notion cv page id is not configured",
    ))
}

fn http_error_string(status: u16, message: &str) -> String {
    format!("code={status}, message={}", message.trim())
}

fn get_cv_last_modified(record_map: Option<&serde_json::Value>) -> String {
    let Some(block) = record_map
        .and_then(serde_json::Value::as_object)
        .and_then(|root| root.get("block"))
        .and_then(serde_json::Value::as_object)
    else {
        return String::new();
    };

    for entry in block.values() {
        let Some(raw_value) = entry
            .as_object()
            .and_then(|entry| entry.get("value"))
            .and_then(serde_json::Value::as_object)
        else {
            continue;
        };
        if let Some(last_edited) = raw_value.get("last_edited_time") {
            return stringify_json_value(last_edited);
        }
        break;
    }
    String::new()
}

fn build_cv_pdf_object_key(last_modified: &str) -> String {
    const PREFIX: &str = "generated/cv";
    const FALLBACK: &str = "generated/cv/cv-latest.pdf";

    if last_modified.trim().is_empty() {
        return FALLBACK.to_owned();
    }

    let sanitized = last_modified
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | ' ' | '.' | '+' | '=' | '?' => '-',
            _ => ch,
        })
        .collect::<String>()
        .trim_matches('-')
        .to_owned();
    if sanitized.is_empty() {
        return FALLBACK.to_owned();
    }
    format!("{PREFIX}/cv-{sanitized}.pdf")
}

fn get_cv_pdf_cache_control(last_modified: &str) -> String {
    if last_modified.trim().is_empty() {
        "public, max-age=60, stale-while-revalidate=86400".to_owned()
    } else {
        "public, max-age=31536000, immutable".to_owned()
    }
}

fn stringify_json_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(text) => text.clone(),
        serde_json::Value::Number(number) => number.to_string(),
        serde_json::Value::Null => String::new(),
        other => serde_json::to_string(other)
            .unwrap_or_default()
            .trim_matches('"')
            .to_owned(),
    }
}

fn header_string(headers: &HeaderMap, name: impl axum::http::header::AsHeaderName) -> String {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .trim()
        .to_owned()
}

async fn gotenberg_convert_url_to_pdf(
    state: &AppState,
    target_url: &str,
) -> Result<Vec<u8>, ApiError> {
    if state.config.gotenberg_url.trim().is_empty() {
        return Err(ApiError::internal("gotenberg url is not configured"));
    }

    let endpoint = format!(
        "{}/forms/chromium/convert/url",
        state.config.gotenberg_url.trim().trim_end_matches('/'),
    );
    let mut request = state.http_client.post(endpoint).multipart(
        reqwest::multipart::Form::new()
            .text("url", target_url.to_owned())
            .text("printBackground", "true")
            .text("preferCssPageSize", "true")
            .text("waitForSelector", "[data-cv-print-ready='true']"),
    );

    if !state.config.gotenberg_username.trim().is_empty()
        && !state.config.gotenberg_password.trim().is_empty()
    {
        request = request.basic_auth(
            state.config.gotenberg_username.trim(),
            Some(state.config.gotenberg_password.trim()),
        );
    }

    let response = request
        .send()
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;
    if !response.status().is_success() {
        let status = response.status();
        let payload = response.text().await.unwrap_or_default();
        return Err(ApiError::internal(format!(
            "gotenberg request failed with status {status}: {payload}"
        )));
    }

    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|err| ApiError::internal(err.to_string()))
}
