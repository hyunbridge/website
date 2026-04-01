mod assets;
mod auth;
mod content;
mod deploy;
mod home;
mod profile;

use axum::Router;
use axum::routing::{get, patch, post};

use crate::state::AppState;

pub(super) fn auth_router() -> Router<AppState> {
    Router::new().route("/admin/login", post(auth::admin_login))
}

pub(super) fn admin_router() -> Router<AppState> {
    Router::new()
        .route("/admin/me", get(auth::admin_me))
        .route("/admin/dashboard", get(auth::admin_dashboard))
        .route("/assets/presign", post(assets::create_presigned_upload))
        .route("/assets/complete", post(assets::complete_asset_upload))
        .route("/assets/delete", post(assets::delete_objects))
        .route(
            "/admin/posts",
            get(content::admin_posts).post(content::admin_create_post),
        )
        .route(
            "/admin/posts/{id}",
            get(content::admin_get_post)
                .patch(content::admin_patch_post)
                .delete(content::admin_delete_post),
        )
        .route(
            "/admin/posts/{id}/publish",
            post(content::admin_publish_post).delete(content::admin_unpublish_post),
        )
        .route(
            "/admin/posts/{id}/version-state",
            get(content::admin_post_version_state),
        )
        .route(
            "/admin/posts/versions",
            post(content::admin_create_post_version),
        )
        .route(
            "/admin/posts/versions/{versionId}",
            get(content::admin_get_post_version).patch(content::admin_update_post_version),
        )
        .route(
            "/admin/posts/{id}/current-version",
            post(content::admin_set_post_current_version),
        )
        .route(
            "/admin/posts/{id}/versions",
            get(content::admin_list_post_versions),
        )
        .route(
            "/admin/posts/{id}/restore",
            post(content::admin_restore_post_version),
        )
        .route(
            "/admin/projects",
            get(content::admin_projects).post(content::admin_create_project),
        )
        .route(
            "/admin/projects/{id}",
            get(content::admin_get_project)
                .patch(content::admin_patch_project)
                .delete(content::admin_delete_project),
        )
        .route(
            "/admin/projects/{id}/publish",
            post(content::admin_publish_project).delete(content::admin_unpublish_project),
        )
        .route(
            "/admin/projects/{id}/version-state",
            get(content::admin_project_version_state),
        )
        .route(
            "/admin/projects/versions",
            post(content::admin_create_project_version),
        )
        .route(
            "/admin/projects/versions/{versionId}",
            get(content::admin_get_project_version).patch(content::admin_update_project_version),
        )
        .route(
            "/admin/projects/{id}/current-version",
            post(content::admin_set_project_current_version),
        )
        .route(
            "/admin/projects/{id}/versions",
            get(content::admin_list_project_versions),
        )
        .route(
            "/admin/projects/{id}/restore",
            post(content::admin_restore_project_version),
        )
        .route(
            "/admin/tags",
            get(content::admin_tags).post(content::admin_create_tag),
        )
        .route(
            "/admin/tags/{id}",
            patch(content::admin_update_tag).delete(content::admin_delete_tag),
        )
        .route("/admin/home", get(home::admin_get_home))
        .route("/admin/home/save", post(home::admin_save_home))
        .route(
            "/admin/home/current-version",
            post(home::admin_save_home_version),
        )
        .route("/admin/home/versions", get(home::admin_list_home_versions))
        .route(
            "/admin/home/restore",
            post(home::admin_restore_home_version),
        )
        .route("/admin/deploy", get(deploy::admin_deploy_dashboard))
        .route("/admin/deploy/preview", get(deploy::admin_deploy_preview))
        .route("/admin/deploy/sync", post(deploy::admin_deploy_sync))
        .route("/admin/publish", get(deploy::admin_deploy_dashboard))
        .route("/admin/publish/preview", get(deploy::admin_deploy_preview))
        .route("/admin/publish/sync", post(deploy::admin_deploy_sync))
        .route(
            "/admin/profile/password",
            post(profile::admin_update_password),
        )
}

pub(super) fn profile_router() -> Router<AppState> {
    Router::new().route(
        "/admin/profile",
        get(profile::admin_profile).patch(profile::admin_update_profile),
    )
}
