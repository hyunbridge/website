package publiccontent

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/hyunbridge/website/backend/internal/contentmd"
	"github.com/hyunbridge/website/backend/internal/gitrepo"
	internalid "github.com/hyunbridge/website/backend/internal/id"
	"github.com/hyunbridge/website/backend/internal/store"
)

type profileReader interface {
	GetAdminProfile() store.AdminProfile
}

type gitAuthorProfileResolver interface {
	ResolveAdminProfileByGitAuthor(authorName string, authorEmail string) (store.AdminProfile, bool)
}

type Reader struct {
	repo     *gitrepo.Repository
	profiles profileReader
}

type homeSnapshot struct {
	ID          string         `json:"id"`
	Title       string         `json:"title"`
	Data        map[string]any `json:"data"`
	Summary     *string        `json:"summary,omitempty"`
	PublishedAt *string        `json:"published_at,omitempty"`
}

func NewReader(repo *gitrepo.Repository, profiles profileReader) *Reader {
	if repo == nil {
		return nil
	}
	return &Reader{repo: repo, profiles: profiles}
}

func (r *Reader) ListPosts(ctx context.Context, commitSHA string, page int, pageSize int, tagID string) ([]store.PostDTO, error) {
	paths, err := r.repo.ListFilesAtCommit(ctx, commitSHA, "posts/", ".md")
	if err != nil {
		return nil, err
	}

	items := make([]store.PostDTO, 0, len(paths))
	for _, relativePath := range paths {
		post, readErr := r.readPostByPath(ctx, commitSHA, relativePath)
		if readErr != nil {
			return nil, readErr
		}
		if post.PublishedAt == nil {
			continue
		}
		if tagID != "" && !hasTag(post.Tags, tagID) {
			continue
		}
		items = append(items, post)
	}

	sort.Slice(items, func(i, j int) bool {
		left := derefString(items[i].PublishedAt)
		right := derefString(items[j].PublishedAt)
		if left != right {
			return left > right
		}
		return items[i].Slug < items[j].Slug
	})

	return paginatePosts(items, page, pageSize), nil
}

func (r *Reader) GetPostBySlug(ctx context.Context, slug string, commitSHA string) (store.PostDTO, error) {
	paths, err := r.repo.ListFilesAtCommit(ctx, commitSHA, "posts/", ".md")
	if err != nil {
		return store.PostDTO{}, err
	}
	for _, relativePath := range paths {
		post, readErr := r.readPostByPath(ctx, commitSHA, relativePath)
		if readErr != nil {
			return store.PostDTO{}, readErr
		}
		if post.PublishedAt == nil {
			continue
		}
		if post.Slug == slug {
			return post, nil
		}
	}
	return store.PostDTO{}, store.ErrNotFound()
}

func (r *Reader) ListProjects(ctx context.Context, commitSHA string) ([]store.ProjectDTO, error) {
	paths, err := r.repo.ListFilesAtCommit(ctx, commitSHA, "projects/", ".md")
	if err != nil {
		return nil, err
	}

	items := make([]store.ProjectDTO, 0, len(paths))
	for _, relativePath := range paths {
		project, readErr := r.readProjectByPath(ctx, commitSHA, relativePath)
		if readErr != nil {
			return nil, readErr
		}
		if project.PublishedAt == nil {
			continue
		}
		items = append(items, project)
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].SortOrder != items[j].SortOrder {
			return items[i].SortOrder < items[j].SortOrder
		}
		left := derefString(items[i].PublishedAt)
		right := derefString(items[j].PublishedAt)
		if left != right {
			return left > right
		}
		return items[i].Slug < items[j].Slug
	})

	return items, nil
}

func (r *Reader) GetProjectBySlug(ctx context.Context, slug string, commitSHA string) (store.ProjectDTO, error) {
	paths, err := r.repo.ListFilesAtCommit(ctx, commitSHA, "projects/", ".md")
	if err != nil {
		return store.ProjectDTO{}, err
	}
	for _, relativePath := range paths {
		project, readErr := r.readProjectByPath(ctx, commitSHA, relativePath)
		if readErr != nil {
			return store.ProjectDTO{}, readErr
		}
		if project.PublishedAt == nil {
			continue
		}
		if project.Slug == slug {
			return project, nil
		}
	}
	return store.ProjectDTO{}, store.ErrNotFound()
}

func (r *Reader) ListTags(ctx context.Context, commitSHA string) ([]store.TagDTO, error) {
	posts, err := r.ListPosts(ctx, commitSHA, 0, 0, "")
	if err != nil {
		return nil, err
	}
	projects, err := r.ListProjects(ctx, commitSHA)
	if err != nil {
		return nil, err
	}

	seen := map[string]store.TagDTO{}
	for _, post := range posts {
		for _, tag := range post.Tags {
			if strings.TrimSpace(tag.ID) != "" {
				seen[tag.ID] = tag
			}
		}
	}
	for _, project := range projects {
		for _, tag := range project.Tags {
			if strings.TrimSpace(tag.ID) != "" {
				seen[tag.ID] = tag
			}
		}
	}

	tags := make([]store.TagDTO, 0, len(seen))
	for _, tag := range seen {
		tags = append(tags, tag)
	}
	sort.Slice(tags, func(i, j int) bool {
		if tags[i].Name != tags[j].Name {
			return tags[i].Name < tags[j].Name
		}
		return tags[i].Slug < tags[j].Slug
	})
	return tags, nil
}

func (r *Reader) GetPublishedHome(ctx context.Context, commitSHA string) (store.HomeDocumentDTO, error) {
	homePayload, err := r.repo.FileAtCommit(ctx, filepath.ToSlash(filepath.Join("pages", "home.json")), commitSHA)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return store.HomeDocumentDTO{}, store.ErrNotFound()
		}
		return store.HomeDocumentDTO{}, err
	}

	var snapshot homeSnapshot
	if err := json.Unmarshal(homePayload, &snapshot); err != nil {
		return store.HomeDocumentDTO{}, err
	}
	if snapshot.PublishedAt == nil || strings.TrimSpace(*snapshot.PublishedAt) == "" {
		return store.HomeDocumentDTO{}, store.ErrNotFound()
	}
	metadata, err := r.documentMetadata(ctx, commitSHA, filepath.ToSlash(filepath.Join("pages", "home.json")))
	if err != nil {
		return store.HomeDocumentDTO{}, err
	}

	return store.HomeDocumentDTO{
		ID:                 snapshot.ID,
		OwnerID:            fallbackString(r.resolveAuthorID(metadata.AuthorName, metadata.AuthorEmail), ""),
		Status:             "published",
		PublishedAt:        cloneOptionalString(snapshot.PublishedAt),
		CurrentVersionID:   nilIfEmpty(metadata.VersionID),
		PublishedVersionID: nilIfEmpty(metadata.VersionID),
		Data:               snapshot.Data,
		Notices:            []map[string]string{},
	}, nil
}

func (r *Reader) readPostByPath(ctx context.Context, commitSHA string, relativePath string) (store.PostDTO, error) {
	payload, err := r.repo.FileAtCommit(ctx, relativePath, commitSHA)
	if err != nil {
		return store.PostDTO{}, err
	}
	document, err := contentmd.ParseEditorialPostDocument(payload)
	if err != nil {
		return store.PostDTO{}, err
	}
	id := strings.TrimSuffix(filepath.Base(relativePath), filepath.Ext(relativePath))
	metadata, err := r.documentMetadata(ctx, commitSHA, relativePath)
	if err != nil {
		return store.PostDTO{}, err
	}
	authorProfile, hasAuthorProfile := r.resolveAuthorProfile(metadata.AuthorName, metadata.AuthorEmail)
	authorDTO := store.AuthorDTO{FullName: fallbackString(metadata.AuthorName, "관리자")}
	authorID := ""
	if hasAuthorProfile {
		authorDTO.FullName = displayName(authorProfile)
		authorDTO.AvatarURL = cloneOptionalString(authorProfile.AvatarURL)
		authorID = authorProfile.ID
	}
	return store.PostDTO{
		ID:             id,
		CreatedAt:      metadata.CreatedAt,
		UpdatedAt:      fallbackString(metadata.UpdatedAt, metadata.CreatedAt),
		Title:          document.Title,
		Slug:           document.Slug,
		Content:        document.BodyMarkdown,
		AuthorID:       authorID,
		Summary:        document.Summary,
		CoverImage:     document.CoverImage,
		PublishedAt:    nilIfEmpty(document.PublishedAt),
		EnableComments: document.EnableComments,
		Tags:           storeTags(document.Tags),
		Author:         authorDTO,
	}, nil
}

func (r *Reader) readProjectByPath(ctx context.Context, commitSHA string, relativePath string) (store.ProjectDTO, error) {
	payload, err := r.repo.FileAtCommit(ctx, relativePath, commitSHA)
	if err != nil {
		return store.ProjectDTO{}, err
	}
	document, err := contentmd.ParseEditorialProjectDocument(payload)
	if err != nil {
		return store.ProjectDTO{}, err
	}
	id := strings.TrimSuffix(filepath.Base(relativePath), filepath.Ext(relativePath))
	metadata, err := r.documentMetadata(ctx, commitSHA, relativePath)
	if err != nil {
		return store.ProjectDTO{}, err
	}
	ownerProfile, hasOwnerProfile := r.resolveAuthorProfile(metadata.AuthorName, metadata.AuthorEmail)
	ownerDTO := store.AuthorDTO{FullName: fallbackString(metadata.AuthorName, "관리자")}
	ownerID := ""
	if hasOwnerProfile {
		ownerDTO.FullName = displayName(ownerProfile)
		ownerDTO.AvatarURL = cloneOptionalString(ownerProfile.AvatarURL)
		ownerID = ownerProfile.ID
	}
	return store.ProjectDTO{
		ID:          id,
		CreatedAt:   metadata.CreatedAt,
		UpdatedAt:   fallbackString(metadata.UpdatedAt, metadata.CreatedAt),
		Title:       document.Title,
		Slug:        document.Slug,
		Content:     document.BodyMarkdown,
		OwnerID:     ownerID,
		Summary:     document.Summary,
		CoverImage:  document.CoverImage,
		PublishedAt: nilIfEmpty(document.PublishedAt),
		SortOrder:   document.SortOrder,
		Tags:        storeTags(document.Tags),
		Links:       storeProjectLinks(id, document.Links),
		Owner:       ownerDTO,
	}, nil
}

func (r *Reader) authorDTO() store.AuthorDTO {
	if r == nil || r.profiles == nil {
		return store.AuthorDTO{FullName: "익명"}
	}
	profile := r.profiles.GetAdminProfile()
	return store.AuthorDTO{
		FullName:  displayName(profile),
		AvatarURL: cloneOptionalString(profile.AvatarURL),
	}
}

func displayName(profile store.AdminProfile) string {
	if profile.FullName != nil && strings.TrimSpace(*profile.FullName) != "" {
		return strings.TrimSpace(*profile.FullName)
	}
	if strings.TrimSpace(profile.Username) != "" {
		return strings.TrimSpace(profile.Username)
	}
	return "관리자"
}

type documentMetadata struct {
	CreatedAt   string
	UpdatedAt   string
	VersionID   string
	AuthorName  string
	AuthorEmail string
}

func (r *Reader) documentMetadata(ctx context.Context, commitSHA string, relativePath string) (documentMetadata, error) {
	commits, err := r.repo.CommitsForPath(ctx, relativePath, "", commitSHA)
	if err != nil {
		return documentMetadata{}, err
	}
	if len(commits) == 0 {
		return documentMetadata{}, nil
	}

	createdAt := commits[0].CreatedAt
	latest := commits[len(commits)-1]

	return documentMetadata{
		CreatedAt:   createdAt,
		UpdatedAt:   latest.CreatedAt,
		VersionID:   latest.SHA,
		AuthorName:  strings.TrimSpace(latest.Author),
		AuthorEmail: strings.TrimSpace(latest.AuthorEmail),
	}, nil
}

func (r *Reader) resolveAuthorID(authorName string, authorEmail string) string {
	profile, ok := r.resolveAuthorProfile(authorName, authorEmail)
	if !ok {
		return ""
	}
	return strings.TrimSpace(profile.ID)
}

func (r *Reader) resolveAuthorProfile(authorName string, authorEmail string) (store.AdminProfile, bool) {
	if resolver, ok := r.profiles.(gitAuthorProfileResolver); ok {
		return resolver.ResolveAdminProfileByGitAuthor(authorName, authorEmail)
	}
	return store.AdminProfile{}, false
}

func storeTags(tags []contentmd.Tag) []store.TagDTO {
	items := make([]store.TagDTO, 0, len(tags))
	for _, tag := range tags {
		items = append(items, store.TagDTO{
			ID:   tag.ID,
			Name: tag.Name,
			Slug: tag.Slug,
		})
	}
	return items
}

func storeProjectLinks(projectID string, links []contentmd.Link) []store.ProjectLinkDTO {
	items := make([]store.ProjectLinkDTO, 0, len(links))
	for _, link := range links {
		linkID := internalid.CanonicalizeSecondaryPersistentID(link.ID)
		items = append(items, store.ProjectLinkDTO{
			ID:        linkID,
			ProjectID: projectID,
			Label:     link.Label,
			URL:       link.URL,
			LinkType:  cloneOptionalString(link.LinkType),
			SortOrder: link.SortOrder,
		})
	}
	return items
}

func nilIfEmpty(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}

func cloneOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func fallbackString(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value != "" {
		return value
	}
	return fallback
}

func hasTag(tags []store.TagDTO, tagID string) bool {
	for _, tag := range tags {
		if tag.ID == tagID {
			return true
		}
	}
	return false
}

func paginatePosts(posts []store.PostDTO, page int, pageSize int) []store.PostDTO {
	if page <= 0 || pageSize <= 0 {
		return posts
	}
	start := (page - 1) * pageSize
	if start >= len(posts) {
		return []store.PostDTO{}
	}
	end := start + pageSize
	if end > len(posts) {
		end = len(posts)
	}
	return posts[start:end]
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}
