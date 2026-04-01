mod contact;
mod content;
mod cv;
mod system;

use axum::Router;
use axum::routing::{get, post};

use crate::state::AppState;

pub(super) fn router() -> Router<AppState> {
    Router::new()
        .route("/system/info", get(system::system_info))
        .route("/site/export", get(content::public_site_export))
        .route("/site/home", get(content::public_home))
        .route("/posts", get(content::public_posts))
        .route("/posts/{slug}", get(content::public_post))
        .route(
            "/posts/versions/{versionId}",
            get(content::public_post_version),
        )
        .route("/tags", get(content::public_tags))
        .route("/projects", get(content::public_projects))
        .route("/projects/{slug}", get(content::public_project))
        .route(
            "/projects/versions/{versionId}",
            get(content::public_project_version),
        )
        .route(
            "/contact/verify-turnstile",
            post(contact::verify_protected_email),
        )
        .route("/contact/email-status", get(contact::check_protected_email))
        .route("/cv/content", get(cv::get_cv_content))
        .route("/cv/pdf", get(cv::get_cv_pdf))
        .route("/cv/pdf-cache-status", get(cv::get_cv_pdf_cache_status))
        .route(
            "/integrations/cloudflare/pages/deploy-webhook",
            post(system::handle_cloudflare_webhook),
        )
}
