package operational

import contentstore "github.com/hyunbridge/website/backend/internal/store"

type DraftDocument struct {
	ID         string        `json:"id"`
	Slug       string        `json:"slug"`
	Title      string        `json:"title"`
	Summary    string        `json:"summary"`
	Tags       []string      `json:"tags"`
	CoverImage *string       `json:"cover_image,omitempty"`
	Editor     EditorState   `json:"editor"`
	Workflow   WorkflowState `json:"workflow"`
	Audit      AuditState    `json:"audit"`
}

type DraftPost struct {
	DraftDocument
	AuthorID       string `json:"author_id"`
	EnableComments bool   `json:"enable_comments"`
}

type DraftProject struct {
	DraftDocument
	OwnerID   string        `json:"owner_id"`
	SortOrder int           `json:"sort_order"`
	Links     []ProjectLink `json:"links"`
}

type DraftPage struct {
	ID       string         `json:"id"`
	Kind     string         `json:"kind"`
	Document map[string]any `json:"document"`
	Workflow WorkflowState  `json:"workflow"`
	Audit    AuditState     `json:"audit"`
}

type EditorState struct {
	Document map[string]any `json:"document"`
	Type     string         `json:"type"`
	Version  int            `json:"version"`
}

type WorkflowState struct {
	Status              string  `json:"status"`
	LastPublishedCommit *string `json:"last_published_commit,omitempty"`
	LastPublishedAt     *string `json:"last_published_at,omitempty"`
}

type AuditState struct {
	CreatedAt string `json:"created_at"`
	CreatedBy string `json:"created_by"`
	UpdatedAt string `json:"updated_at"`
	UpdatedBy string `json:"updated_by"`
}

type ProjectLink struct {
	Label     string  `json:"label"`
	URL       string  `json:"url"`
	LinkType  *string `json:"link_type,omitempty"`
	SortOrder int     `json:"sort_order"`
}

type User struct {
	ID           string  `json:"id"`
	Email        string  `json:"email"`
	Role         string  `json:"role"`
	Username     string  `json:"username"`
	FullName     *string `json:"full_name,omitempty"`
	AvatarURL    *string `json:"avatar_url,omitempty"`
	PasswordHash string  `json:"password_hash"`
}

type Session struct {
	ID         string  `json:"id"`
	UserID     string  `json:"user_id"`
	ExpiresAt  string  `json:"expires_at"`
	RevokedAt  *string `json:"revoked_at,omitempty"`
	UserAgent  *string `json:"user_agent,omitempty"`
	RemoteAddr *string `json:"remote_addr,omitempty"`
}

type SiteSettings struct {
	ID           string         `json:"id"`
	Branding     map[string]any `json:"branding"`
	SEO          map[string]any `json:"seo"`
	FeatureFlags map[string]any `json:"feature_flags"`
}

type ReleaseJob struct {
	ID          string           `json:"id"`
	Type        string           `json:"type"`
	Status      string           `json:"status"`
	CommitSHA   *string          `json:"commit_sha,omitempty"`
	RequestedBy string           `json:"requested_by"`
	Logs        []string         `json:"logs"`
	Meta        map[string]any   `json:"meta"`
	Manifest    *PublishManifest `json:"manifest,omitempty"`
	CreatedAt   string           `json:"created_at"`
	UpdatedAt   string           `json:"updated_at"`
	StartedAt   *string          `json:"started_at,omitempty"`
	CompletedAt *string          `json:"completed_at,omitempty"`
}

const (
	ReleaseJobTypeDeploy          = "deploy"
	ReleaseJobStatusQueued        = "queued"
	ReleaseJobStatusDispatching   = "dispatching"
	ReleaseJobStatusWaitingResult = "waiting_result"
	ReleaseJobStatusSucceeded     = "succeeded"
	ReleaseJobStatusFailed        = "failed"
)

const DeployManifestSchemaVersion = 1

type PublishManifest struct {
	SchemaVersion int                     `json:"schema_version" yaml:"schema_version"`
	Kind          string                  `json:"kind" yaml:"kind"`
	PublishedAt   string                  `json:"published_at" yaml:"published_at"`
	Actor         string                  `json:"actor" yaml:"actor"`
	SiteCommit    string                  `json:"site_commit" yaml:"site_commit"`
	Summary       PublishManifestSummary  `json:"summary" yaml:"summary"`
	Changes       []PublishManifestChange `json:"changes" yaml:"changes"`
}

type PublishManifestSummary struct {
	PublishCount   int `json:"publish_count" yaml:"publish_count"`
	UpdateCount    int `json:"update_count" yaml:"update_count"`
	UnpublishCount int `json:"unpublish_count" yaml:"unpublish_count"`
	TotalCount     int `json:"total_count" yaml:"total_count"`
}

type PublishManifestChange struct {
	Kind         string                  `json:"kind" yaml:"kind"`
	DocumentID   string                  `json:"document_id" yaml:"document_id"`
	Title        string                  `json:"title" yaml:"title"`
	Slug         *string                 `json:"slug,omitempty" yaml:"slug,omitempty"`
	ChangeType   string                  `json:"change_type" yaml:"change_type"`
	From         *string                 `json:"from,omitempty" yaml:"from,omitempty"`
	To           *string                 `json:"to,omitempty" yaml:"to,omitempty"`
	FromMetadata string                  `json:"from_metadata,omitempty" yaml:"-"`
	ToMetadata   string                  `json:"to_metadata,omitempty" yaml:"-"`
	FromBody     string                  `json:"from_body,omitempty" yaml:"-"`
	ToBody       string                  `json:"to_body,omitempty" yaml:"-"`
	Diff         string                  `json:"diff,omitempty" yaml:"-"`
	Commits      []PublishManifestCommit `json:"commits,omitempty" yaml:"-"`
}

type PublishManifestCommit struct {
	SHA       string `json:"sha"`
	Message   string `json:"message"`
	Author    string `json:"author"`
	CreatedAt string `json:"created_at"`
	Diff      string `json:"diff,omitempty"`
}

type LiveState struct {
	ID               string                               `json:"id"`
	LiveCommitSHA    string                               `json:"live_commit_sha"`
	LastDeployJobID  *string                              `json:"last_deploy_job_id,omitempty"`
	LastSuccessfulAt *string                              `json:"last_successful_at,omitempty"`
	PublicBaseURL    *string                              `json:"public_base_url,omitempty"`
	LivePointers     *contentstore.PublishPointerSnapshot `json:"-"`
}

type SearchCache struct {
	ID           string         `json:"id"`
	CommitSHA    string         `json:"commit_sha"`
	DocumentID   string         `json:"document_id"`
	DocumentType string         `json:"document_type"`
	Title        string         `json:"title"`
	Summary      string         `json:"summary"`
	Text         string         `json:"text"`
	Tags         []string       `json:"tags"`
	Meta         map[string]any `json:"meta"`
}

type AssetRecord struct {
	ID         string   `json:"id"`
	ObjectKey  string   `json:"object_key"`
	PublicURL  string   `json:"public_url"`
	MimeType   string   `json:"mime_type"`
	CreatedBy  string   `json:"created_by"`
	AttachedTo []string `json:"attached_to"`
}
