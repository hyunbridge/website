package publish

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/hyunbridge/website/backend/internal/contentmd"
	"github.com/hyunbridge/website/backend/internal/store"
)

type PublishedSiteSource interface {
	ListPostDTOs(includeDraft bool) []store.PostDTO
	GetPostVersionByID(versionID string) (store.PostVersionDTO, error)
	ListProjectDTOs(includeDraft bool) []store.ProjectDTO
	GetProjectVersionByID(versionID string) (store.ProjectVersionDTO, error)
	GetHomeDocument() store.HomeDocumentDTO
	GetHomeVersionByID(versionID string) (store.HomeVersionDTO, error)
	CapturePublishedPointerSnapshot() store.PublishPointerSnapshot
	RestorePublishedPointerSnapshot(snapshot store.PublishPointerSnapshot) error
	SyncPublishedContentPointers() error
	ListTags() []store.TagDTO
}

type Exporter struct {
	source PublishedSiteSource
	now    func() time.Time
}

type PublishedTag struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

type PublishedAuthor struct {
	FullName  string  `json:"full_name"`
	AvatarURL *string `json:"avatar_url"`
}

type PublishedPostDocument struct {
	ID             string          `json:"id"`
	Slug           string          `json:"slug"`
	Title          string          `json:"title"`
	Summary        string          `json:"summary"`
	CreatedAt      string          `json:"created_at"`
	PublishedAt    string          `json:"published_at"`
	CoverImage     *string         `json:"cover_image"`
	EnableComments bool            `json:"enable_comments"`
	Tags           []PublishedTag  `json:"tags"`
	Author         PublishedAuthor `json:"author"`
	BodyMarkdown   string          `json:"content"`
}

type PublishedProjectDocument struct {
	ID           string                 `json:"id"`
	Slug         string                 `json:"slug"`
	Title        string                 `json:"title"`
	Summary      string                 `json:"summary"`
	CreatedAt    string                 `json:"created_at"`
	PublishedAt  string                 `json:"published_at"`
	CoverImage   *string                `json:"cover_image"`
	SortOrder    int                    `json:"sort_order"`
	Tags         []PublishedTag         `json:"tags"`
	Links        []store.ProjectLinkDTO `json:"links"`
	Owner        PublishedAuthor        `json:"owner"`
	BodyMarkdown string                 `json:"content"`
}

type SiteReleaseMetadata struct {
	SchemaVersion int    `json:"schema_version"`
	GeneratedAt   string `json:"generated_at"`
}

type SiteExport struct {
	Posts    []PublishedPostDocument    `json:"posts"`
	Projects []PublishedProjectDocument `json:"projects"`
	Home     *store.HomeDocumentDTO     `json:"home"`
	Release  SiteReleaseMetadata        `json:"release"`
}

func NewExporter(source PublishedSiteSource) *Exporter {
	return &Exporter{source: source, now: time.Now}
}

func (e *Exporter) ExportPublishedSite(ctx context.Context, rootDir string) (SiteExport, error) {
	if e.source == nil {
		return SiteExport{}, errors.New("published site source is required")
	}
	if strings.TrimSpace(rootDir) == "" {
		return SiteExport{}, errors.New("root output directory is required")
	}

	posts, err := e.exportPosts(ctx)
	if err != nil {
		return SiteExport{}, err
	}
	projects, err := e.exportProjects(ctx)
	if err != nil {
		return SiteExport{}, err
	}
	home := e.source.GetHomeDocument()
	var exportedHome *store.HomeDocumentDTO
	if home.PublishedVersionID != nil && strings.TrimSpace(*home.PublishedVersionID) != "" {
		homeVersion, err := e.source.GetHomeVersionByID(*home.PublishedVersionID)
		if err != nil {
			return SiteExport{}, fmt.Errorf("load published home version: %w", err)
		}
		exportedHome = &store.HomeDocumentDTO{
			ID:                 home.ID,
			OwnerID:            home.OwnerID,
			Status:             home.Status,
			UpdatedAt:          home.UpdatedAt,
			PublishedAt:        home.PublishedAt,
			CurrentVersionID:   home.PublishedVersionID,
			PublishedVersionID: home.PublishedVersionID,
			Data:               homeVersion.Data,
			Notices:            []map[string]string{},
		}
	}

	export := SiteExport{
		Posts:    posts,
		Projects: projects,
		Home:     exportedHome,
		Release: SiteReleaseMetadata{
			SchemaVersion: 1,
			GeneratedAt:   e.now().UTC().Format(time.RFC3339),
		},
	}

	if err := writePublishedSite(rootDir, export); err != nil {
		return SiteExport{}, err
	}

	return export, nil
}

func (e *Exporter) ExportPublishedPosts(ctx context.Context, rootDir string) ([]PublishedPostDocument, error) {
	export, err := e.ExportPublishedSite(ctx, rootDir)
	if err != nil {
		return nil, err
	}
	return export.Posts, nil
}

func (e *Exporter) exportPosts(ctx context.Context) ([]PublishedPostDocument, error) {
	posts := e.source.ListPostDTOs(false)
	documents := make([]PublishedPostDocument, 0, len(posts))

	for _, post := range posts {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if post.PublishedVersionID == nil || strings.TrimSpace(*post.PublishedVersionID) == "" {
			continue
		}
		version, err := e.source.GetPostVersionByID(*post.PublishedVersionID)
		if err != nil {
			return nil, fmt.Errorf("load published version for post %q: %w", post.ID, err)
		}

		publishedAt := ""
		if post.PublishedAt != nil {
			publishedAt = *post.PublishedAt
		}

		tags := make([]PublishedTag, 0, len(post.Tags))
		for _, tag := range post.Tags {
			tags = append(tags, PublishedTag{ID: tag.ID, Name: tag.Name, Slug: tag.Slug})
		}

		documents = append(documents, PublishedPostDocument{
			ID:             post.ID,
			Slug:           post.Slug,
			Title:          post.Title,
			Summary:        post.Summary,
			CreatedAt:      post.CreatedAt,
			PublishedAt:    publishedAt,
			CoverImage:     post.CoverImage,
			EnableComments: post.EnableComments,
			Tags:           tags,
			Author:         PublishedAuthor{FullName: post.Author.FullName, AvatarURL: post.Author.AvatarURL},
			BodyMarkdown:   strings.TrimSpace(version.Content),
		})
	}

	sort.Slice(documents, func(i, j int) bool {
		if documents[i].PublishedAt != documents[j].PublishedAt {
			return documents[i].PublishedAt > documents[j].PublishedAt
		}
		return documents[i].Slug < documents[j].Slug
	})

	return documents, nil
}

func (e *Exporter) exportProjects(ctx context.Context) ([]PublishedProjectDocument, error) {
	projects := e.source.ListProjectDTOs(false)
	documents := make([]PublishedProjectDocument, 0, len(projects))

	for _, project := range projects {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if project.PublishedVersionID == nil || strings.TrimSpace(*project.PublishedVersionID) == "" {
			continue
		}
		version, err := e.source.GetProjectVersionByID(*project.PublishedVersionID)
		if err != nil {
			return nil, fmt.Errorf("load published version for project %q: %w", project.ID, err)
		}

		publishedAt := ""
		if project.PublishedAt != nil {
			publishedAt = *project.PublishedAt
		}

		tags := make([]PublishedTag, 0, len(project.Tags))
		for _, tag := range project.Tags {
			tags = append(tags, PublishedTag{ID: tag.ID, Name: tag.Name, Slug: tag.Slug})
		}

		documents = append(documents, PublishedProjectDocument{
			ID:           project.ID,
			Slug:         project.Slug,
			Title:        project.Title,
			Summary:      project.Summary,
			CreatedAt:    project.CreatedAt,
			PublishedAt:  publishedAt,
			CoverImage:   project.CoverImage,
			SortOrder:    project.SortOrder,
			Tags:         tags,
			Links:        version.Links,
			Owner:        PublishedAuthor{FullName: project.Owner.FullName, AvatarURL: project.Owner.AvatarURL},
			BodyMarkdown: strings.TrimSpace(version.Content),
		})
	}

	sort.Slice(documents, func(i, j int) bool {
		if documents[i].SortOrder != documents[j].SortOrder {
			return documents[i].SortOrder < documents[j].SortOrder
		}
		if documents[i].PublishedAt != documents[j].PublishedAt {
			return documents[i].PublishedAt > documents[j].PublishedAt
		}
		return documents[i].Slug < documents[j].Slug
	})

	return documents, nil
}

func writePublishedSite(rootDir string, export SiteExport) error {
	paths := []string{
		filepath.Join(rootDir, "posts"),
		filepath.Join(rootDir, "projects"),
		filepath.Join(rootDir, "pages"),
		filepath.Join(rootDir, "meta"),
	}
	for _, path := range paths {
		if err := os.MkdirAll(path, 0o755); err != nil {
			return err
		}
	}

	if err := clearGeneratedFiles(filepath.Join(rootDir, "posts"), ".md"); err != nil {
		return err
	}
	if err := clearGeneratedFiles(filepath.Join(rootDir, "projects"), ".md"); err != nil {
		return err
	}

	for _, post := range export.Posts {
		if err := os.WriteFile(filepath.Join(rootDir, "posts", post.Slug+".md"), []byte(contentmd.BuildPostMarkdown(contentmd.PostDocument{
			ID:              post.ID,
			Slug:            post.Slug,
			Title:           post.Title,
			Summary:         post.Summary,
			CreatedAt:       post.CreatedAt,
			PublishedAt:     post.PublishedAt,
			CoverImage:      post.CoverImage,
			EnableComments:  post.EnableComments,
			AuthorName:      post.Author.FullName,
			AuthorAvatarURL: post.Author.AvatarURL,
			Tags:            contentTags(post.Tags),
			BodyMarkdown:    post.BodyMarkdown,
		})), 0o644); err != nil {
			return err
		}
	}

	for _, project := range export.Projects {
		if err := os.WriteFile(filepath.Join(rootDir, "projects", project.Slug+".md"), []byte(contentmd.BuildProjectMarkdown(contentmd.ProjectDocument{
			ID:             project.ID,
			Slug:           project.Slug,
			Title:          project.Title,
			Summary:        project.Summary,
			CreatedAt:      project.CreatedAt,
			PublishedAt:    project.PublishedAt,
			CoverImage:     project.CoverImage,
			SortOrder:      project.SortOrder,
			OwnerName:      project.Owner.FullName,
			OwnerAvatarURL: project.Owner.AvatarURL,
			Tags:           contentTags(project.Tags),
			Links:          contentLinks(project.Links),
			BodyMarkdown:   project.BodyMarkdown,
		})), 0o644); err != nil {
			return err
		}
	}

	homePath := filepath.Join(rootDir, "pages", "home.json")
	if export.Home == nil {
		if err := os.Remove(homePath); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
	} else if err := writeJSONFile(homePath, export.Home); err != nil {
		return err
	}
	return writeJSONFile(filepath.Join(rootDir, "meta", "release.json"), export.Release)
}

func clearGeneratedFiles(dir string, suffix string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), suffix) {
			continue
		}
		if err := os.Remove(filepath.Join(dir, entry.Name())); err != nil {
			return err
		}
	}
	return nil
}

func writeJSONFile(path string, value any) error {
	payload, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	payload = append(payload, '\n')
	return os.WriteFile(path, payload, 0o644)
}

func contentTags(tags []PublishedTag) []contentmd.Tag {
	items := make([]contentmd.Tag, 0, len(tags))
	for _, tag := range tags {
		items = append(items, contentmd.Tag{ID: tag.ID, Name: tag.Name, Slug: tag.Slug})
	}
	return items
}

func contentLinks(links []store.ProjectLinkDTO) []contentmd.Link {
	items := make([]contentmd.Link, 0, len(links))
	for _, link := range links {
		items = append(items, contentmd.Link{
			ID:        link.ID,
			Label:     link.Label,
			URL:       link.URL,
			LinkType:  link.LinkType,
			SortOrder: link.SortOrder,
		})
	}
	return items
}
