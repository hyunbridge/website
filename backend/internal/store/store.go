package store

import (
	"errors"

	"github.com/hyunbridge/website/backend/internal/domain"
)

type AdminProfile struct {
	ID             string  `json:"id"`
	Email          string  `json:"email"`
	Username       string  `json:"username"`
	FullName       *string `json:"full_name"`
	AvatarURL      *string `json:"avatar_url"`
	GitAuthorName  *string `json:"git_author_name"`
	GitAuthorEmail *string `json:"git_author_email"`
}

type AdminAuthStore interface {
	AuthenticateAdmin(email, password string) bool
	GetAdminProfile() AdminProfile
}

type AdminProfileStore interface {
	GetAdminProfile() AdminProfile
	UpdateAdminProfile(fullName *string, avatarURL *string, gitAuthorName *string, gitAuthorEmail *string) (AdminProfile, error)
	UpdateAdminPassword(currentPassword, nextPassword string) error
}

type IdentityProfileStore interface {
	GetOrCreateIdentityProfile(userID, email string) (AdminProfile, error)
	UpsertIdentityProfile(userID, email string, fullName *string, avatarURL *string, gitAuthorName *string, gitAuthorEmail *string) (AdminProfile, error)
}

type AssetAdminStore interface {
	AddPostAsset(id, objectKey string) error
	AddProjectAsset(id, objectKey string) error
}

type PublishPointerState struct {
	ID                 string  `json:"id"`
	CurrentVersionID   *string `json:"current_version_id,omitempty"`
	PublishedVersionID *string `json:"published_version_id,omitempty"`
	PublishedAt        *string `json:"published_at,omitempty"`
}

type PublishPointerSnapshot struct {
	Posts    []PublishPointerState `json:"posts"`
	Projects []PublishPointerState `json:"projects"`
	Home     PublishPointerState   `json:"home"`
}

type PublishedContentStore interface {
	GetPublishedHomeDocument() (HomeDocumentDTO, error)
	ListPostDTOsFiltered(includeDraft bool, page int, pageSize int, tagID string) []PostDTO
	GetPostDTOBySlug(slug string, includeDraft bool) (PostDTO, error)
	GetPublishedPostVersionByID(versionID string) (PostVersionDTO, error)
	ListTags() []TagDTO
	ListProjectDTOs(includeDraft bool) []ProjectDTO
	GetProjectDTOBySlug(slug string, includeDraft bool) (ProjectDTO, error)
	GetPublishedProjectVersionByID(versionID string) (ProjectVersionDTO, error)
}

type HomeAdminStore interface {
	GetHome() domain.HomePayload
	GetHomeDocument() HomeDocumentDTO
	GetHomeVersionByID(versionID string) (HomeVersionDTO, error)
	GetPublishedHomeDocument() (HomeDocumentDTO, error)
	SaveHomeDraft(userID string, data map[string]any, changeDescription string) (HomeDocumentDTO, error)
	SaveHomeVersion(userID string, changeDescription string) (HomeDocumentDTO, error)
	ListHomeVersions() []HomeVersionDTO
	RestoreHomeVersion(versionNumber int, userID string) (HomeDocumentDTO, error)
	CapturePublishedPointerSnapshot() PublishPointerSnapshot
	RestorePublishedPointerSnapshot(snapshot PublishPointerSnapshot) error
	SyncPublishedContentPointers() error
}

type EditorialAdminStore interface {
	ListPostDTOs(includeDraft bool) []PostDTO
	ListPostDTOsFiltered(includeDraft bool, page int, pageSize int, tagID string) []PostDTO
	GetPostDTOByID(id string) (PostDTO, error)
	GetPostDTOBySlug(slug string, includeDraft bool) (PostDTO, error)
	CreatePost(authorID, title, slug, summary string) (persistedPost, error)
	PatchPost(id string, patch PostPatch) (PostDTO, error)
	SetPostPublished(id string, published bool) (PostDTO, error)
	DeletePostWithAssets(id string) ([]string, error)
	GetPostVersionState(id string) (VersionStateItemDTO, VersionStateVersionDTO, *VersionStateVersionDTO, error)
	UpdatePostVersion(versionID string, title string, summary string, content string, changeDescription *string) (string, error)
	CreatePostVersion(postID string, title string, summary string, content string, actorID string, changeDescription *string) (string, error)
	SetPostCurrentVersion(postID, versionID, title, summary string) error
	ListPostVersions(postID string) ([]PostVersionDTO, error)
	GetPostVersionByID(versionID string) (PostVersionDTO, error)
	GetPublishedPostVersionByID(versionID string) (PostVersionDTO, error)
	RestorePostVersion(postID string, versionNumber int, userID string) error

	ListProjectDTOs(includeDraft bool) []ProjectDTO
	GetProjectDTOByID(id string) (ProjectDTO, error)
	GetProjectDTOBySlug(slug string, includeDraft bool) (ProjectDTO, error)
	CreateProject(ownerID, title, slug, summary string) (persistedProject, error)
	PatchProject(id string, patch ProjectPatch) (ProjectDTO, error)
	SetProjectPublished(id string, published bool) (ProjectDTO, error)
	DeleteProjectWithAssets(id string) ([]string, error)
	GetProjectVersionState(id string) (VersionStateItemDTO, VersionStateVersionDTO, *VersionStateVersionDTO, error)
	UpdateProjectVersion(versionID string, title string, summary string, content string, links []ProjectLinkDTO, changeDescription *string) (string, error)
	CreateProjectVersion(projectID string, title string, summary string, content string, links []ProjectLinkDTO, actorID string, changeDescription *string) (string, error)
	SetProjectCurrentVersion(projectID, versionID, title, summary string) error
	ListProjectVersions(projectID string) ([]ProjectVersionDTO, error)
	GetProjectVersionByID(versionID string) (ProjectVersionDTO, error)
	GetPublishedProjectVersionByID(versionID string) (ProjectVersionDTO, error)
	RestoreProjectVersion(projectID string, versionNumber int, userID string) error

	ListTags() []TagDTO
	CreateTag(name, slug string) (persistedTag, error)
	UpdateTag(id, name, slug string) (persistedTag, error)
	DeleteTag(id string) error
}

type PublishStateStore interface {
	CapturePublishedPointerSnapshot() PublishPointerSnapshot
	RestorePublishedPointerSnapshot(snapshot PublishPointerSnapshot) error
	SyncPublishedContentPointers() error
}

type WorkspaceStore interface {
	AdminAuthStore
	AdminProfileStore
	HomeAdminStore
	EditorialAdminStore
}

var (
	errBootstrapRequired           = errors.New("store bootstrap is required")
	errBootstrapAlreadyInitialized = errors.New("store is already initialized")
)

func ErrBootstrapRequired() error {
	return errBootstrapRequired
}

func IsBootstrapRequired(err error) bool {
	return errors.Is(err, errBootstrapRequired)
}

func ErrBootstrapAlreadyInitialized() error {
	return errBootstrapAlreadyInitialized
}

func IsBootstrapAlreadyInitialized(err error) bool {
	return errors.Is(err, errBootstrapAlreadyInitialized)
}
