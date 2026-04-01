use std::collections::{HashMap, HashSet};
use std::time::{Duration, SystemTime};

mod app;
mod common;
mod content;
mod deploy;
mod home;
mod identity;
mod parsing;
mod profile;
mod reconcile;
mod store;
mod versioning;
use common::*;
use parsing::*;

use crate::content_repo::{ContentRepo, RepoCommit};
use crate::editorial::{
    EditorialHomeSnapshot, EditorialPostDocument, EditorialProjectDocument, LinkDoc, TagDoc,
    build_commit_body, build_editorial_post_markdown, build_editorial_project_markdown,
    parse_commit_body, parse_editorial_post_markdown, parse_editorial_project_markdown,
};
use crate::error::{ApiError, AppInitError};
use crate::models::{
    AdminProfile, AuthorDto, CountsResponse, HomeDocumentDto, HomeVersionDto,
    PersistedAdminProfile, PersistedData, PersistedHome, PersistedHomeVersion, PersistedLiveState,
    PersistedPost, PersistedPostVersion, PersistedProject, PersistedProjectLink,
    PersistedProjectVersion, PersistedReleaseJob, PersistedTag, PostDto, PostPatch, PostVersionDto,
    ProjectDto, ProjectLinkDto, ProjectPatch, ProjectVersionDto, PublishPointerSnapshot,
    PublishPointerState, TagDto, UpdateProfileRequest, VersionStateItemDto, VersionStateVersionDto,
};
use argon2::password_hash::SaltString;
use argon2::{Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use mongodb::bson::{Bson, Document, doc, from_document, to_document};
use mongodb::{Client, Collection, Database};
use ulid::Ulid;

const DEFAULT_STATE_ID: &str = "primary";
const USERS_COLLECTION: &str = "users";
const POSTS_COLLECTION: &str = "draft_posts";
const PROJECTS_COLLECTION: &str = "draft_projects";
const TAGS_COLLECTION: &str = "tags";
const PAGES_COLLECTION: &str = "draft_pages";
const POST_VERSIONS_COLLECTION: &str = "post_versions";
const PROJECT_VERSIONS_COLLECTION: &str = "project_versions";
const HOME_VERSIONS_COLLECTION: &str = "home_versions";
const RELEASE_JOBS_COLLECTION: &str = "release_jobs";
const LIVE_STATE_COLLECTION: &str = "live_state";
const HOME_DOCUMENT_ID: &str = "home";
const HOME_PAGE_ID: &str = "home-page";
const LIVE_STATE_ID: &str = "live";

#[derive(Clone)]
pub struct AppState {
    pub config: crate::config::AppConfig,
    pub http_client: reqwest::Client,
    repo: Option<ContentRepo>,
    store: ContentStore,
}

#[derive(Clone)]
struct ContentStore {
    posts: Collection<Document>,
    projects: Collection<Document>,
    tags: Collection<Document>,
    pages: Collection<Document>,
    users: Collection<Document>,
    post_versions: Collection<Document>,
    project_versions: Collection<Document>,
    home_versions: Collection<Document>,
    release_jobs: Collection<Document>,
    live_state: Collection<Document>,
}
