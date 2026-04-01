use axum::Json;
use axum::extract::{Extension, Path, Query, State};
use axum::http::header::CACHE_CONTROL;
use axum::http::{HeaderMap, HeaderName, HeaderValue, StatusCode};
use axum::response::IntoResponse;
use serde::Deserialize;
use serde_json::json;
use tracing::error;

use crate::error::ApiError;
use crate::models::{AdminActor, PublicSiteExportDto};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub(super) struct PublicPostsQuery {
    #[serde(default)]
    page: i32,
    #[serde(rename = "pageSize", default)]
    page_size: i32,
    #[serde(rename = "tagId", default)]
    tag_id: String,
    #[serde(default)]
    at: String,
}

#[derive(Debug, Deserialize)]
pub(super) struct PublicAtQuery {
    #[serde(default)]
    at: String,
}

pub(super) async fn public_home(
    State(state): State<AppState>,
    Query(query): Query<PublicAtQuery>,
    actor: Option<Extension<AdminActor>>,
) -> Result<impl IntoResponse, ApiError> {
    require_snapshot_access(&query.at, actor.as_ref())?;
    if let Some(snapshot) = resolve_public_snapshot(&state, &query.at)
        .await
        .map_err(|_| ApiError::internal("failed_to_load_home"))?
        && let Some(home) = snapshot.home
    {
        return Ok((StatusCode::OK, Json(home)));
    }
    let home = match state.get_published_home_document().await {
        Ok(home) => home,
        Err(err) => {
            error!(error = %err, "failed to load published home document");
            return Err(ApiError::internal("failed_to_load_home"));
        }
    }
    .ok_or_else(|| ApiError::not_found("home_not_found"))?;
    Ok((StatusCode::OK, Json(home)))
}

pub(super) async fn public_site_export(
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let commit_sha = match state.snapshot_commit_sha("").await {
        Ok(commit_sha) => commit_sha,
        Err(err) => {
            error!(error = %err, "failed to resolve live snapshot commit");
            return Err(ApiError::internal("failed_to_resolve_live_commit"));
        }
    };
    let snapshot = match state
        .current_site_export(commit_sha.as_deref().unwrap_or_default())
        .await
    {
        Ok(export) => export,
        Err(err) => {
            error!(error = %err, "failed to build current site export");
            return Err(ApiError::internal("failed_to_resolve_live_commit"));
        }
    };
    let mut headers = HeaderMap::new();
    headers.insert(
        CACHE_CONTROL,
        HeaderValue::from_static("no-store, max-age=0"),
    );
    if let Some(commit_sha) = commit_sha {
        headers.insert(
            HeaderName::from_static("x-published-commit-sha"),
            HeaderValue::from_str(&commit_sha).unwrap_or_else(|_| HeaderValue::from_static("")),
        );
    }
    Ok((headers, Json(snapshot)))
}

pub(super) async fn public_posts(
    State(state): State<AppState>,
    Query(query): Query<PublicPostsQuery>,
    actor: Option<Extension<AdminActor>>,
) -> Result<impl IntoResponse, ApiError> {
    require_snapshot_access(&query.at, actor.as_ref())?;
    if let Some(snapshot) = resolve_public_snapshot(&state, &query.at)
        .await
        .map_err(|_| ApiError::internal("failed_to_load_posts"))?
    {
        let mut posts = snapshot.posts;
        if !query.tag_id.trim().is_empty() {
            posts.retain(|post| post.tags.iter().any(|tag| tag.id == query.tag_id.trim()));
        }
        let page = if query.page < 1 {
            1
        } else {
            query.page as usize
        };
        let page_size = if query.page_size < 1 {
            posts.len().max(1)
        } else {
            query.page_size as usize
        };
        let start = (page - 1) * page_size;
        let items = if start >= posts.len() {
            Vec::new()
        } else {
            posts.into_iter().skip(start).take(page_size).collect()
        };
        return Ok((StatusCode::OK, Json(items)));
    }
    Ok((
        StatusCode::OK,
        Json(
            state
                .list_public_posts(&query.tag_id, query.page, query.page_size)
                .await
                .map_err(|_| ApiError::internal("failed_to_load_posts"))?,
        ),
    ))
}

pub(super) async fn public_post(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(query): Query<PublicAtQuery>,
    actor: Option<Extension<AdminActor>>,
) -> Result<impl IntoResponse, ApiError> {
    require_snapshot_access(&query.at, actor.as_ref())?;
    if let Some(snapshot) = resolve_public_snapshot(&state, &query.at)
        .await
        .map_err(|_| ApiError::internal("failed_to_load_post"))?
    {
        let post = snapshot
            .posts
            .into_iter()
            .find(|post| post.slug == slug)
            .ok_or_else(|| ApiError::not_found("post_not_found"))?;
        return Ok((StatusCode::OK, Json(post)));
    }
    let post = state.get_public_post(&slug).await.map_err(|err| {
        if is_not_found(&err) {
            ApiError::not_found("post_not_found")
        } else {
            ApiError::internal("failed_to_load_post")
        }
    })?;
    Ok((StatusCode::OK, Json(post)))
}

pub(super) async fn public_tags(
    State(state): State<AppState>,
    Query(query): Query<PublicAtQuery>,
    actor: Option<Extension<AdminActor>>,
) -> Result<impl IntoResponse, ApiError> {
    require_snapshot_access(&query.at, actor.as_ref())?;
    if let Some(snapshot) = resolve_public_snapshot(&state, &query.at)
        .await
        .map_err(|_| ApiError::internal("failed_to_load_tags"))?
    {
        return Ok((StatusCode::OK, Json(snapshot.tags)));
    }
    Ok((
        StatusCode::OK,
        Json(
            state
                .list_tags()
                .await
                .map_err(|_| ApiError::internal("failed_to_load_tags"))?,
        ),
    ))
}

pub(super) async fn public_post_version(
    State(state): State<AppState>,
    Path(version_id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let version = state
        .get_published_post_version(&version_id)
        .await
        .map_err(|_| ApiError::not_found("post_version_not_found"))?;
    Ok((
        StatusCode::OK,
        Json(json!({
            "id": version.id,
            "title": version.title,
            "summary": version.summary,
            "content": version.content,
        })),
    ))
}

pub(super) async fn public_projects(
    State(state): State<AppState>,
    Query(query): Query<PublicAtQuery>,
    actor: Option<Extension<AdminActor>>,
) -> Result<impl IntoResponse, ApiError> {
    require_snapshot_access(&query.at, actor.as_ref())?;
    if let Some(snapshot) = resolve_public_snapshot(&state, &query.at)
        .await
        .map_err(|_| ApiError::internal("failed_to_load_projects"))?
    {
        return Ok((StatusCode::OK, Json(snapshot.projects)));
    }
    Ok((
        StatusCode::OK,
        Json(
            state
                .list_public_projects()
                .await
                .map_err(|_| ApiError::internal("failed_to_load_projects"))?,
        ),
    ))
}

pub(super) async fn public_project(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Query(query): Query<PublicAtQuery>,
    actor: Option<Extension<AdminActor>>,
) -> Result<impl IntoResponse, ApiError> {
    require_snapshot_access(&query.at, actor.as_ref())?;
    if let Some(snapshot) = resolve_public_snapshot(&state, &query.at)
        .await
        .map_err(|_| ApiError::internal("failed_to_load_project"))?
    {
        let project = snapshot
            .projects
            .into_iter()
            .find(|project| project.slug == slug)
            .ok_or_else(|| ApiError::not_found("project_not_found"))?;
        return Ok((StatusCode::OK, Json(project)));
    }
    let project = state.get_public_project(&slug).await.map_err(|err| {
        if is_not_found(&err) {
            ApiError::not_found("project_not_found")
        } else {
            ApiError::internal("failed_to_load_project")
        }
    })?;
    Ok((StatusCode::OK, Json(project)))
}

pub(super) async fn public_project_version(
    State(state): State<AppState>,
    Path(version_id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let version = state
        .get_published_project_version(&version_id)
        .await
        .map_err(|_| ApiError::not_found("project_version_not_found"))?;
    Ok((
        StatusCode::OK,
        Json(json!({
            "id": version.id,
            "title": version.title,
            "summary": version.summary,
            "content": version.content,
            "links": version.links,
        })),
    ))
}

async fn resolve_public_snapshot(
    state: &AppState,
    at: &str,
) -> Result<Option<PublicSiteExportDto>, ApiError> {
    let commit_sha = if at.trim().is_empty() {
        state.snapshot_commit_sha("").await?
    } else {
        Some(at.trim().to_owned())
    };
    let Some(commit_sha) = commit_sha else {
        return Ok(None);
    };
    match state.load_site_export_at(&commit_sha).await {
        Ok(snapshot) => Ok(snapshot),
        Err(err) => {
            error!(error = %err, commit_sha, "failed to load site export snapshot");
            Err(err)
        }
    }
}

fn require_snapshot_access(
    at: &str,
    actor: Option<&Extension<AdminActor>>,
) -> Result<(), ApiError> {
    if at.trim().is_empty() || actor.is_some() {
        return Ok(());
    }
    Err(ApiError::unauthorized("snapshot_auth_required"))
}

fn is_not_found(error: &ApiError) -> bool {
    error.status_code() == StatusCode::NOT_FOUND
}
