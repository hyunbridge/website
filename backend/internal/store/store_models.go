package store

type persistedData struct {
	Posts        []persistedPost       `json:"posts"`
	Projects     []persistedProject    `json:"projects"`
	Tags         []persistedTag        `json:"tags"`
	Home         persistedHome         `json:"home"`
	AdminProfile persistedAdminProfile `json:"adminProfile"`
}

type TagDTO struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type PostDTO struct {
	ID                 string    `json:"id"`
	CreatedAt          string    `json:"created_at"`
	UpdatedAt          string    `json:"updated_at"`
	Title              string    `json:"title"`
	Slug               string    `json:"slug"`
	Content            string    `json:"content"`
	AuthorID           string    `json:"author_id"`
	Summary            string    `json:"summary"`
	CoverImage         *string   `json:"cover_image"`
	PublishedAt        *string   `json:"published_at"`
	PublishedVersionID *string   `json:"-"`
	CurrentVersionID   *string   `json:"-"`
	EnableComments     bool      `json:"enable_comments"`
	Tags               []TagDTO  `json:"tags"`
	Author             AuthorDTO `json:"author"`
}

type AuthorDTO struct {
	FullName  string  `json:"full_name"`
	AvatarURL *string `json:"avatar_url"`
}

type PostVersionDTO struct {
	ID                string   `json:"id"`
	VersionNumber     int      `json:"version_number"`
	PostID            string   `json:"post_id"`
	Title             string   `json:"title"`
	Slug              string   `json:"slug"`
	Content           string   `json:"content"`
	Summary           string   `json:"summary"`
	PublishedAt       *string  `json:"published_at"`
	CoverImage        *string  `json:"cover_image"`
	EnableComments    bool     `json:"enable_comments"`
	Tags              []TagDTO `json:"tags"`
	ChangeDescription *string  `json:"change_description"`
	CreatedAt         string   `json:"created_at"`
	CreatedBy         string   `json:"created_by"`
}

type ProjectLinkDTO struct {
	ID        string  `json:"id"`
	ProjectID string  `json:"project_id"`
	Label     string  `json:"label"`
	URL       string  `json:"url"`
	LinkType  *string `json:"link_type"`
	SortOrder int     `json:"sort_order"`
}

type ProjectDTO struct {
	ID                 string           `json:"id"`
	CreatedAt          string           `json:"created_at"`
	UpdatedAt          string           `json:"updated_at"`
	Title              string           `json:"title"`
	Slug               string           `json:"slug"`
	Content            string           `json:"content"`
	OwnerID            string           `json:"owner_id"`
	Summary            string           `json:"summary"`
	CoverImage         *string          `json:"cover_image"`
	PublishedAt        *string          `json:"published_at"`
	PublishedVersionID *string          `json:"-"`
	CurrentVersionID   *string          `json:"-"`
	SortOrder          int              `json:"sort_order"`
	Tags               []TagDTO         `json:"tags"`
	Links              []ProjectLinkDTO `json:"links"`
	Owner              AuthorDTO        `json:"owner"`
}

type ProjectVersionDTO struct {
	ID                string           `json:"id"`
	VersionNumber     int              `json:"version_number"`
	ProjectID         string           `json:"project_id"`
	Title             string           `json:"title"`
	Slug              string           `json:"slug"`
	Content           string           `json:"content"`
	Summary           string           `json:"summary"`
	PublishedAt       *string          `json:"published_at"`
	CoverImage        *string          `json:"cover_image"`
	SortOrder         int              `json:"sort_order"`
	Tags              []TagDTO         `json:"tags"`
	Links             []ProjectLinkDTO `json:"links"`
	ChangeDescription *string          `json:"change_description"`
	CreatedAt         string           `json:"created_at"`
	CreatedBy         string           `json:"created_by"`
}

type PostPatch struct {
	Title          *string   `json:"title"`
	Slug           *string   `json:"slug"`
	Summary        *string   `json:"summary"`
	Content        *string   `json:"content"`
	CoverImage     *string   `json:"cover_image"`
	PublishedAt    *string   `json:"published_at"`
	EnableComments *bool     `json:"enable_comments"`
	TagIDs         *[]string `json:"tag_ids"`
}

type ProjectPatch struct {
	Title       *string           `json:"title"`
	Slug        *string           `json:"slug"`
	Summary     *string           `json:"summary"`
	Content     *string           `json:"content"`
	CoverImage  *string           `json:"cover_image"`
	PublishedAt *string           `json:"published_at"`
	SortOrder   *int              `json:"sort_order"`
	TagIDs      *[]string         `json:"tag_ids"`
	Links       *[]ProjectLinkDTO `json:"links"`
}

type HomeDocumentDTO struct {
	ID                 string              `json:"id"`
	OwnerID            string              `json:"ownerId"`
	Status             string              `json:"status"`
	UpdatedAt          *string             `json:"updatedAt"`
	PublishedAt        *string             `json:"publishedAt"`
	CurrentVersionID   *string             `json:"currentVersionId"`
	PublishedVersionID *string             `json:"publishedVersionId"`
	Data               map[string]any      `json:"data"`
	Notices            []map[string]string `json:"notices"`
}

type HomeVersionDTO struct {
	ID                string              `json:"id"`
	PageID            string              `json:"page_id"`
	VersionNumber     int                 `json:"version_number"`
	Title             string              `json:"title"`
	Data              map[string]any      `json:"data"`
	Notices           []map[string]string `json:"notices"`
	Summary           *string             `json:"summary"`
	ChangeDescription *string             `json:"change_description"`
	CreatedAt         string              `json:"created_at"`
	CreatedBy         string              `json:"created_by"`
}

type VersionStateItemDTO struct {
	ID                 string  `json:"id"`
	Title              string  `json:"title"`
	Summary            *string `json:"summary"`
	CurrentVersionID   *string `json:"current_version_id"`
	PublishedVersionID *string `json:"published_version_id"`
	Status             string  `json:"status"`
}

type VersionStateVersionDTO struct {
	ID                string  `json:"id"`
	VersionNumber     int     `json:"version_number"`
	Title             string  `json:"title"`
	Summary           *string `json:"summary"`
	BodyMarkdown      string  `json:"body_markdown"`
	ChangeDescription *string `json:"change_description"`
}

type persistedAdminProfile struct {
	ID             string  `json:"id"`
	Email          string  `json:"email"`
	Username       string  `json:"username"`
	Password       string  `json:"password"`
	FullName       *string `json:"full_name"`
	AvatarURL      *string `json:"avatar_url"`
	GitAuthorName  *string `json:"git_author_name"`
	GitAuthorEmail *string `json:"git_author_email"`
}

type persistedTag struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type persistedPost struct {
	ID                 string   `json:"id"`
	CreatedAt          string   `json:"created_at"`
	UpdatedAt          string   `json:"updated_at"`
	Title              string   `json:"title"`
	Slug               string   `json:"slug"`
	Content            string   `json:"content"`
	AuthorID           string   `json:"author_id"`
	Summary            string   `json:"summary"`
	CoverImage         *string  `json:"cover_image"`
	PublishedAt        *string  `json:"published_at"`
	PublishedVersionID *string  `json:"published_version_id"`
	CurrentVersionID   *string  `json:"current_version_id"`
	EnableComments     bool     `json:"enable_comments"`
	TagIDs             []string `json:"tag_ids"`
	AssetKeys          []string `json:"asset_keys"`
	DraftDirty         bool     `json:"draft_dirty"`
}

type ProjectLink struct {
	ID        string  `json:"id"`
	Label     string  `json:"label"`
	URL       string  `json:"url"`
	LinkType  *string `json:"link_type"`
	SortOrder int     `json:"sort_order"`
}

type persistedProject struct {
	ID                 string        `json:"id"`
	CreatedAt          string        `json:"created_at"`
	UpdatedAt          string        `json:"updated_at"`
	Title              string        `json:"title"`
	Slug               string        `json:"slug"`
	Content            string        `json:"content"`
	OwnerID            string        `json:"owner_id"`
	Summary            string        `json:"summary"`
	CoverImage         *string       `json:"cover_image"`
	PublishedAt        *string       `json:"published_at"`
	PublishedVersionID *string       `json:"published_version_id"`
	CurrentVersionID   *string       `json:"current_version_id"`
	SortOrder          int           `json:"sort_order"`
	TagIDs             []string      `json:"tag_ids"`
	AssetKeys          []string      `json:"asset_keys"`
	Links              []ProjectLink `json:"links"`
	DraftDirty         bool          `json:"draft_dirty"`
}

type persistedHome struct {
	ID                 string         `json:"id"`
	OwnerID            string         `json:"owner_id"`
	UpdatedAt          *string        `json:"updated_at"`
	PublishedAt        *string        `json:"published_at"`
	CurrentVersionID   *string        `json:"current_version_id"`
	PublishedVersionID *string        `json:"published_version_id"`
	Data               map[string]any `json:"data"`
	DraftDirty         bool           `json:"draft_dirty"`
}
