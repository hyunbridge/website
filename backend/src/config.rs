use crate::error::AppInitError;
use std::env;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tracing::Level;

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub app_env: String,
    pub http_addr: String,
    pub log_level: Level,
    pub jwt_issuer: String,
    pub jwt_audience: String,
    pub jwt_secret: String,
    pub access_token_ttl: Duration,
    pub s3_bucket: String,
    pub s3_region: String,
    pub s3_endpoint: String,
    pub s3_access_key: String,
    pub s3_secret_key: String,
    pub s3_public_base_url: String,
    pub gotenberg_url: String,
    pub gotenberg_username: String,
    pub gotenberg_password: String,
    pub public_site_url: String,
    pub cloudflare_pages_deploy_hook_url: String,
    pub cloudflare_webhook_secret: String,
    pub content_repo_dir: String,
    pub content_repo_source_url: String,
    pub content_repo_source_username: String,
    pub content_repo_source_password: String,
    pub mongo_url: String,
    pub mongo_database_name: String,
    pub editorial_git_branch: String,
    pub cv_source_url: String,
    pub notion_cv_page_id: String,
    pub protected_email: String,
    pub protected_email_token_secret: String,
    pub protected_email_token_issuer: String,
    pub protected_email_token_audience: String,
    pub protected_email_token_ttl: Duration,
    pub turnstile_secret: String,
    pub admin_bridge_secret: String,
    pub cors_allowed_origins: Vec<String>,
}

impl AppConfig {
    pub fn load() -> Result<Self, AppInitError> {
        let env_base_dir = load_env();

        Ok(Self {
            app_env: get_env("APP_ENV", "development"),
            http_addr: get_env("HTTP_ADDR", ":8080"),
            log_level: parse_log_level(&get_env("LOG_LEVEL", "info")),
            jwt_issuer: get_env("JWT_ISSUER", "website-api"),
            jwt_audience: get_env("JWT_AUDIENCE", "website-admin"),
            jwt_secret: get_env("JWT_SECRET", ""),
            access_token_ttl: get_duration_env(
                "ACCESS_TOKEN_TTL",
                Duration::from_secs(12 * 60 * 60),
            ),
            s3_bucket: get_env("S3_BUCKET", ""),
            s3_region: get_env("S3_REGION", "auto"),
            s3_endpoint: get_env("S3_ENDPOINT", ""),
            s3_access_key: get_env("S3_ACCESS_KEY", ""),
            s3_secret_key: get_env("S3_SECRET_KEY", ""),
            s3_public_base_url: get_env("S3_PUBLIC_BASE_URL", ""),
            gotenberg_url: get_env("GOTENBERG_URL", ""),
            gotenberg_username: get_env("GOTENBERG_USERNAME", ""),
            gotenberg_password: get_env("GOTENBERG_PASSWORD", ""),
            public_site_url: get_env("PUBLIC_SITE_URL", ""),
            cloudflare_pages_deploy_hook_url: get_env("CLOUDFLARE_PAGES_DEPLOY_HOOK_URL", ""),
            cloudflare_webhook_secret: get_env("CLOUDFLARE_WEBHOOK_SECRET", ""),
            content_repo_dir: get_path_env(
                "CONTENT_REPO_DIR",
                "/tmp/website-content-repo.git",
                &env_base_dir,
            ),
            content_repo_source_url: get_env("CONTENT_REPO_SOURCE_URL", ""),
            content_repo_source_username: get_env("CONTENT_REPO_SOURCE_USERNAME", ""),
            content_repo_source_password: get_env("CONTENT_REPO_SOURCE_PASSWORD", ""),
            mongo_url: get_env("MONGO_URL", "mongodb://localhost:27017"),
            mongo_database_name: get_env("MONGO_DATABASE_NAME", "website"),
            editorial_git_branch: get_env("EDITORIAL_GIT_BRANCH", "main"),
            cv_source_url: get_env("CV_SOURCE_URL", ""),
            notion_cv_page_id: get_env("NOTION_CV_PAGE_ID", ""),
            protected_email: get_env("PROTECTED_EMAIL", ""),
            protected_email_token_secret: get_env("PROTECTED_EMAIL_TOKEN_SECRET", ""),
            protected_email_token_issuer: get_env(
                "PROTECTED_EMAIL_TOKEN_ISSUER",
                "website-protected-email",
            ),
            protected_email_token_audience: get_env(
                "PROTECTED_EMAIL_TOKEN_AUDIENCE",
                "protected-email",
            ),
            protected_email_token_ttl: get_duration_env(
                "PROTECTED_EMAIL_TOKEN_TTL",
                Duration::from_secs(30 * 60),
            ),
            turnstile_secret: get_env("TURNSTILE_SECRET", ""),
            admin_bridge_secret: get_env("ADMIN_BRIDGE_SECRET", ""),
            cors_allowed_origins: get_csv_env(
                "CORS_ALLOWED_ORIGINS",
                &[
                    "http://localhost:3000",
                    "http://localhost:3001",
                    "http://localhost:4173",
                    "http://localhost:4321",
                ],
            ),
        })
    }

    pub fn validate_for_server(&self) -> Result<(), AppInitError> {
        if self.is_production() {
            validate_required_secret("JWT_SECRET", &self.jwt_secret, &["change-me"])?;
            if !self.admin_bridge_secret.trim().is_empty() {
                validate_required_secret(
                    "ADMIN_BRIDGE_SECRET",
                    &self.admin_bridge_secret,
                    &["change-me"],
                )?;
            }
            if !self.protected_email.trim().is_empty() {
                validate_required_secret(
                    "PROTECTED_EMAIL_TOKEN_SECRET",
                    &self.protected_email_token_secret,
                    &["change-me-protected-email"],
                )?;
            }
        }
        Ok(())
    }

    pub fn bind_addr(&self) -> String {
        let trimmed = self.http_addr.trim();
        if let Some(port) = trimmed.strip_prefix(':') {
            return format!("0.0.0.0:{port}");
        }
        trimmed.to_owned()
    }

    pub fn log_filter_directive(&self) -> &'static str {
        match self.log_level {
            Level::DEBUG => "debug",
            Level::INFO => "info",
            Level::WARN => "warn",
            Level::ERROR => "error",
            Level::TRACE => "trace",
        }
    }

    pub fn is_production(&self) -> bool {
        self.app_env.trim().eq_ignore_ascii_case("production")
    }
}

fn load_env() -> PathBuf {
    let candidates = [Path::new(".env"), Path::new("backend/.env")];
    for candidate in candidates {
        if dotenvy::from_filename(candidate).is_ok() {
            if let Some(parent) = candidate.parent()
                && !parent.as_os_str().is_empty()
                && let Ok(absolute) = parent.canonicalize()
            {
                return absolute;
            }
            if let Ok(cwd) = env::current_dir() {
                return cwd;
            }
        }
    }
    env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn get_env(key: &str, fallback: &str) -> String {
    env::var(key).unwrap_or_else(|_| fallback.to_owned())
}

fn get_path_env(key: &str, fallback: &str, base_dir: &Path) -> String {
    let value = get_env(key, fallback).trim().to_owned();
    if value.is_empty() {
        return value;
    }
    let path = PathBuf::from(&value);
    if path.is_absolute() {
        return value;
    }
    base_dir.join(path).to_string_lossy().into_owned()
}

fn parse_log_level(value: &str) -> Level {
    match value.trim() {
        "debug" => Level::DEBUG,
        "warn" => Level::WARN,
        "error" => Level::ERROR,
        "trace" => Level::TRACE,
        _ => Level::INFO,
    }
}

fn get_duration_env(key: &str, fallback: Duration) -> Duration {
    match env::var(key) {
        Ok(value) => humantime::parse_duration(&value).unwrap_or(fallback),
        Err(_) => fallback,
    }
}

fn get_csv_env(key: &str, fallback: &[&str]) -> Vec<String> {
    match env::var(key) {
        Ok(value) => {
            let items: Vec<String> = value
                .split(',')
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(ToOwned::to_owned)
                .collect();
            if items.is_empty() {
                fallback.iter().map(|item| (*item).to_owned()).collect()
            } else {
                items
            }
        }
        Err(_) => fallback.iter().map(|item| (*item).to_owned()).collect(),
    }
}

fn validate_required_secret(
    key: &str,
    value: &str,
    placeholders: &[&str],
) -> Result<(), AppInitError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppInitError::new(format!(
            "{key} is required in production"
        )));
    }
    if placeholders
        .iter()
        .any(|placeholder| trimmed == placeholder.trim())
    {
        return Err(AppInitError::new(format!(
            "{key} must not use the default placeholder in production"
        )));
    }
    Ok(())
}
