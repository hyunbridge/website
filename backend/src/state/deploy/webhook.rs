use super::*;

pub(super) fn default_live_state() -> PersistedLiveState {
    PersistedLiveState {
        id: LIVE_STATE_ID.to_owned(),
        live_commit_sha: String::new(),
        last_deploy_job_id: None,
        last_successful_at: None,
        public_base_url: None,
        live_pointers: Some(PublishPointerSnapshot::default()),
    }
}

pub(super) async fn trigger_deploy_hook(
    http_client: &reqwest::Client,
    deploy_hook_url: &str,
) -> Result<(), String> {
    let response = http_client
        .post(deploy_hook_url.trim())
        .send()
        .await
        .map_err(|err| err.to_string())?;
    if response.status().is_success() {
        return Ok(());
    }

    let status = response.status();
    let payload = response.text().await.unwrap_or_default();
    if payload.trim().is_empty() {
        return Err(format!("unexpected status {status}"));
    }
    Err(format!("unexpected status {status}: {}", payload.trim()))
}

pub(super) fn classify_cloudflare_notification(notification: &serde_json::Value) -> String {
    let alert_type = notification
        .get("alert_type")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    if !alert_type.is_empty() && !alert_type.contains("pages") {
        return String::new();
    }

    if let Some(status) = normalized_notification_status(notification.get("data")) {
        return match status.as_str() {
            "success" | "succeeded" | "successful" => "success".to_owned(),
            "failed" | "failure" | "error" => "failure".to_owned(),
            "started" | "queued" | "in_progress" | "running" => "started".to_owned(),
            _ => String::new(),
        };
    }

    let joined = [
        notification
            .get("name")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default(),
        notification
            .get("text")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default(),
        notification
            .get("alert_type")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default(),
        notification
            .get("alert_event")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default(),
        &extract_notification_data_text(notification.get("data")),
    ]
    .join(" ")
    .to_ascii_lowercase();

    if contains_any(
        &joined,
        &[
            "deployment failed",
            "deploy failed",
            "build failed",
            " failed ",
            " failure ",
            "error",
        ],
    ) {
        return "failure".to_owned();
    }
    if contains_any(
        &joined,
        &[
            "deployment success",
            "deploy success",
            "successful",
            " succeeded ",
            "successfully",
        ],
    ) {
        return "success".to_owned();
    }
    if contains_any(
        &joined,
        &[
            "deployment started",
            "deploy started",
            "started",
            "in progress",
            "queued",
        ],
    ) {
        return "started".to_owned();
    }
    String::new()
}

pub(super) fn extract_cloudflare_deployment_key(
    notification: &serde_json::Value,
) -> Option<String> {
    notification
        .get("alert_correlation_id")
        .and_then(serde_json::Value::as_str)
        .and_then(|value| trim_optional_owned(Some(value.to_owned())))
        .or_else(|| extract_cloudflare_deployment_key_from_data(notification.get("data")))
}

fn extract_cloudflare_deployment_key_from_data(data: Option<&serde_json::Value>) -> Option<String> {
    let data = data?.as_object()?;
    for key in [
        "deployment_id",
        "deploymentId",
        "deployment_uuid",
        "deploymentUuid",
        "deployment_url",
        "deploymentUrl",
        "id",
        "url",
    ] {
        if let Some(value) = data.get(key) {
            let text = match value {
                serde_json::Value::String(text) => text.trim().to_owned(),
                other => other.to_string().trim().trim_matches('"').to_owned(),
            };
            if !text.is_empty() {
                return Some(text);
            }
        }
    }
    let nested = data
        .get("deployment")
        .and_then(serde_json::Value::as_object)?;
    for key in ["id", "uuid", "url"] {
        let Some(value) = nested.get(key) else {
            continue;
        };
        let text = match value {
            serde_json::Value::String(text) => text.trim().to_owned(),
            other => other.to_string().trim().trim_matches('"').to_owned(),
        };
        if !text.is_empty() {
            return Some(text);
        }
    }
    None
}

pub(super) fn normalized_notification_status(data: Option<&serde_json::Value>) -> Option<String> {
    let data = data?.as_object()?;
    for key in ["status", "result", "deployment_status", "state"] {
        let Some(value) = data.get(key) else {
            continue;
        };
        let text = match value {
            serde_json::Value::String(text) => text.trim().to_ascii_lowercase(),
            other => other
                .to_string()
                .trim()
                .trim_matches('"')
                .to_ascii_lowercase(),
        };
        if !text.is_empty() {
            return Some(text);
        }
    }
    None
}

pub(super) fn extract_notification_data_text(data: Option<&serde_json::Value>) -> String {
    let Some(object) = data.and_then(serde_json::Value::as_object) else {
        return String::new();
    };

    let mut parts = Vec::new();
    for key in [
        "status",
        "result",
        "event",
        "deployment_status",
        "project_name",
        "environment",
    ] {
        let Some(value) = object.get(key) else {
            continue;
        };
        let text = match value {
            serde_json::Value::String(text) => text.trim().to_owned(),
            other => other.to_string().trim().trim_matches('"').to_owned(),
        };
        if !text.is_empty() {
            parts.push(text);
        }
    }
    parts.join(" ").to_ascii_lowercase()
}

pub(super) fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|needle| haystack.contains(needle))
}
