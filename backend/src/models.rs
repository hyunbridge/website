use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use validator::Validate;

fn deserialize_null_default<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: Deserialize<'de> + Default,
{
    Option::<T>::deserialize(deserializer).map(|value| value.unwrap_or_default())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedAdminProfile {
    pub id: String,
    pub email: String,
    pub username: String,
    pub password: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub git_author_name: Option<String>,
    pub git_author_email: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AdminProfile {
    pub id: String,
    pub email: String,
    pub username: String,
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub git_author_name: Option<String>,
    pub git_author_email: Option<String>,
}

impl From<PersistedAdminProfile> for AdminProfile {
    fn from(value: PersistedAdminProfile) -> Self {
        Self {
            id: value.id.trim().to_owned(),
            email: value.email.trim().to_owned(),
            username: value.username.trim().to_owned(),
            full_name: value
                .full_name
                .map(|name| name.trim().to_owned())
                .filter(|name| !name.is_empty()),
            avatar_url: value.avatar_url.and_then(|value| {
                let trimmed = value.trim().to_owned();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed)
                }
            }),
            git_author_name: value.git_author_name.and_then(|value| {
                let trimmed = value.trim().to_owned();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed)
                }
            }),
            git_author_email: value.git_author_email.and_then(|value| {
                let trimmed = value.trim().to_owned();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed)
                }
            }),
        }
    }
}

#[derive(Debug, Deserialize, Validate)]
pub struct LoginRequest {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8))]
    pub password: String,
    #[serde(rename = "captchaToken", default)]
    pub captcha_token: String,
}

#[derive(Debug, Serialize)]
pub struct AccessTokenResponse {
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "expiresIn")]
    pub expires_in: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminJwtClaims {
    pub sub: String,
    pub iss: String,
    pub aud: String,
    pub iat: u64,
    pub exp: u64,
    pub role: String,
    pub email: String,
    pub username: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TurnstileVerificationResponse {
    pub success: bool,
    #[serde(
        rename = "error-codes",
        default,
        deserialize_with = "deserialize_null_default"
    )]
    pub error_codes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminActor {
    pub user_id: String,
    pub email: String,
    pub auth_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagDto {
    pub id: String,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthorDto {
    pub full_name: String,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectLinkDto {
    pub id: String,
    pub project_id: String,
    pub label: String,
    pub url: String,
    pub link_type: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostDto {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub author_id: String,
    pub summary: String,
    pub cover_image: Option<String>,
    pub published_at: Option<String>,
    #[serde(skip_serializing)]
    pub published_version_id: Option<String>,
    #[serde(skip_serializing)]
    pub current_version_id: Option<String>,
    pub enable_comments: bool,
    pub tags: Vec<TagDto>,
    pub author: AuthorDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDto {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub owner_id: String,
    pub summary: String,
    pub cover_image: Option<String>,
    pub published_at: Option<String>,
    #[serde(skip_serializing)]
    pub published_version_id: Option<String>,
    #[serde(skip_serializing)]
    pub current_version_id: Option<String>,
    pub sort_order: i32,
    pub tags: Vec<TagDto>,
    pub links: Vec<ProjectLinkDto>,
    pub owner: AuthorDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeDocumentDto {
    pub id: String,
    #[serde(rename = "ownerId")]
    pub owner_id: String,
    pub status: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<String>,
    #[serde(rename = "publishedAt")]
    pub published_at: Option<String>,
    #[serde(rename = "currentVersionId")]
    pub current_version_id: Option<String>,
    #[serde(rename = "publishedVersionId")]
    pub published_version_id: Option<String>,
    pub data: Value,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub notices: Vec<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedTag {
    pub id: String,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedPost {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub author_id: String,
    pub summary: String,
    pub cover_image: Option<String>,
    pub published_at: Option<String>,
    pub published_version_id: Option<String>,
    pub current_version_id: Option<String>,
    #[serde(default)]
    pub enable_comments: bool,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub tag_ids: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub asset_keys: Vec<String>,
    #[serde(default)]
    pub draft_dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedProjectLink {
    pub id: String,
    pub label: String,
    pub url: String,
    pub link_type: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedProject {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub owner_id: String,
    pub summary: String,
    pub cover_image: Option<String>,
    pub published_at: Option<String>,
    pub published_version_id: Option<String>,
    pub current_version_id: Option<String>,
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub tag_ids: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub asset_keys: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub links: Vec<PersistedProjectLink>,
    #[serde(default)]
    pub draft_dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedHome {
    pub id: String,
    pub owner_id: String,
    pub updated_at: Option<String>,
    pub published_at: Option<String>,
    pub current_version_id: Option<String>,
    pub published_version_id: Option<String>,
    pub data: Option<Value>,
    #[serde(default)]
    pub draft_dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedData {
    pub posts: Vec<PersistedPost>,
    pub projects: Vec<PersistedProject>,
    pub tags: Vec<PersistedTag>,
    pub home: PersistedHome,
    #[serde(rename = "adminProfile")]
    pub admin_profile: PersistedAdminProfile,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PostPatch {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub cover_image: Option<String>,
    pub published_at: Option<String>,
    pub enable_comments: Option<bool>,
    pub tag_ids: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProjectPatch {
    pub title: Option<String>,
    pub slug: Option<String>,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub cover_image: Option<String>,
    pub published_at: Option<String>,
    pub sort_order: Option<i32>,
    pub tag_ids: Option<Vec<String>>,
    pub links: Option<Vec<ProjectLinkDto>>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostRequest {
    pub title: String,
    pub slug: String,
    pub summary: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub title: String,
    pub slug: String,
    pub summary: String,
}

#[derive(Debug, Deserialize)]
pub struct UpsertTagRequest {
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub full_name: Option<String>,
    pub avatar_url: Option<String>,
    pub git_author_name: Option<String>,
    pub git_author_email: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePasswordRequest {
    pub current_password: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct SaveHomeRequest {
    pub data: Value,
    #[serde(rename = "changeDescription")]
    pub change_description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CountsResponse {
    #[serde(rename = "postCount")]
    pub post_count: usize,
    #[serde(rename = "projectCount")]
    pub project_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PublishPointerState {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_version_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub published_version_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub published_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PublishPointerSnapshot {
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub posts: Vec<PublishPointerState>,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub projects: Vec<PublishPointerState>,
    pub home: PublishPointerState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PostVersionDto {
    pub id: String,
    pub version_number: i32,
    pub post_id: String,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub summary: String,
    pub published_at: Option<String>,
    pub cover_image: Option<String>,
    pub enable_comments: bool,
    pub tags: Vec<TagDto>,
    pub change_description: Option<String>,
    pub created_at: String,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectVersionDto {
    pub id: String,
    pub version_number: i32,
    pub project_id: String,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub summary: String,
    pub published_at: Option<String>,
    pub cover_image: Option<String>,
    pub sort_order: i32,
    pub tags: Vec<TagDto>,
    pub links: Vec<ProjectLinkDto>,
    pub change_description: Option<String>,
    pub created_at: String,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HomeVersionDto {
    pub id: String,
    pub page_id: String,
    pub version_number: i32,
    pub title: String,
    pub data: Value,
    pub notices: Vec<std::collections::HashMap<String, String>>,
    pub summary: Option<String>,
    pub change_description: Option<String>,
    pub created_at: String,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionStateItemDto {
    pub id: String,
    pub title: String,
    pub summary: Option<String>,
    pub current_version_id: Option<String>,
    pub published_version_id: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionStateVersionDto {
    pub id: String,
    pub version_number: i32,
    pub title: String,
    pub summary: Option<String>,
    pub body_markdown: String,
    pub change_description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedPostVersion {
    pub id: String,
    pub version_number: i32,
    pub post_id: String,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub summary: String,
    pub published_at: Option<String>,
    pub cover_image: Option<String>,
    pub enable_comments: bool,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub tag_ids: Vec<String>,
    pub change_description: Option<String>,
    pub created_at: String,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedProjectVersion {
    pub id: String,
    pub version_number: i32,
    pub project_id: String,
    pub title: String,
    pub slug: String,
    pub content: String,
    pub summary: String,
    pub published_at: Option<String>,
    pub cover_image: Option<String>,
    pub sort_order: i32,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub tag_ids: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub links: Vec<PersistedProjectLink>,
    pub change_description: Option<String>,
    pub created_at: String,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedHomeVersion {
    pub id: String,
    pub page_id: String,
    pub version_number: i32,
    pub title: String,
    pub data: Value,
    pub summary: Option<String>,
    pub change_description: Option<String>,
    pub created_at: String,
    pub created_by: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedLiveState {
    #[serde(rename = "_id")]
    pub id: String,
    pub live_commit_sha: String,
    pub last_deploy_job_id: Option<String>,
    pub last_successful_at: Option<String>,
    pub public_base_url: Option<String>,
    pub live_pointers: Option<PublishPointerSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedReleaseJob {
    #[serde(rename = "_id")]
    pub id: String,
    pub r#type: String,
    pub status: String,
    pub commit_sha: Option<String>,
    pub requested_by: String,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub logs: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub meta: std::collections::HashMap<String, Value>,
    pub manifest: Option<PublishManifestDto>,
    pub created_at: String,
    pub updated_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    #[serde(default)]
    pub rollback_snapshot: Option<PublishPointerSnapshot>,
    #[serde(default)]
    pub target_snapshot: Option<PublishPointerSnapshot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiveStateDto {
    pub id: String,
    pub live_commit_sha: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_deploy_job_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_successful_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_base_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseJobDto {
    pub id: String,
    pub r#type: String,
    pub status: String,
    pub commit_sha: Option<String>,
    pub requested_by: String,
    pub logs: Vec<String>,
    pub meta: std::collections::HashMap<String, Value>,
    pub manifest: Option<PublishManifestDto>,
    pub created_at: String,
    pub updated_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishManifestDto {
    pub schema_version: i32,
    pub kind: String,
    pub published_at: String,
    pub actor: String,
    pub site_commit: String,
    pub summary: PublishManifestSummaryDto,
    pub changes: Vec<PublishManifestChangeDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishManifestSummaryDto {
    pub publish_count: i32,
    pub update_count: i32,
    pub unpublish_count: i32,
    pub total_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishManifestChangeDto {
    pub kind: String,
    pub document_id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    pub change_type: String,
    pub from: Option<String>,
    pub to: Option<String>,
    pub from_metadata: String,
    pub to_metadata: String,
    pub from_body: String,
    pub to_body: String,
    pub diff: String,
    pub commits: Vec<PublishManifestCommitDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublishManifestCommitDto {
    pub sha: String,
    pub message: String,
    pub author: String,
    pub created_at: String,
    pub diff: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeployDashboardDto {
    pub live_state: Option<LiveStateDto>,
    pub jobs: Vec<ReleaseJobDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewSummaryDto {
    pub publish_count: i32,
    pub update_count: i32,
    pub unpublish_count: i32,
    pub total_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewItemDto {
    pub id: String,
    pub kind: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slug: Option<String>,
    pub change_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub live_version_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub live_version_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub live_version_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_version_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_version_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_version_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeployPreviewDto {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub live_state: Option<LiveStateDto>,
    pub summary: PreviewSummaryDto,
    pub items: Vec<PreviewItemDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicSiteReleaseDto {
    pub live_commit_sha: String,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PublicSiteExportDto {
    pub release: PublicSiteReleaseDto,
    pub home: Option<HomeDocumentDto>,
    pub posts: Vec<PostDto>,
    pub projects: Vec<ProjectDto>,
    pub tags: Vec<TagDto>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePostVersionRequest {
    #[serde(rename = "postId")]
    pub post_id: String,
    pub title: String,
    pub content: String,
    pub summary: String,
    #[serde(rename = "changeDescription")]
    pub change_description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePostVersionRequest {
    pub title: String,
    pub summary: String,
    pub content: String,
    pub change_description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SetCurrentVersionRequest {
    #[serde(rename = "versionId")]
    pub version_id: String,
    pub title: String,
    pub summary: String,
}

#[derive(Debug, Deserialize)]
pub struct RestoreVersionRequest {
    #[serde(rename = "versionNumber")]
    pub version_number: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectVersionRequest {
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub title: String,
    pub content: String,
    pub summary: String,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub links: Vec<ProjectLinkDto>,
    #[serde(rename = "changeDescription")]
    pub change_description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProjectVersionRequest {
    pub title: String,
    pub summary: String,
    pub content: String,
    #[serde(default, deserialize_with = "deserialize_null_default")]
    pub links: Vec<ProjectLinkDto>,
    pub change_description: Option<String>,
}
