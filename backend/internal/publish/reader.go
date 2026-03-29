package publish

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"github.com/hyunbridge/website/backend/internal/contentmd"
	"github.com/hyunbridge/website/backend/internal/store"
)

type Reader struct {
	rootDir string
}

func NewReader(rootDir string) *Reader {
	if rootDir == "" {
		return nil
	}
	return &Reader{rootDir: rootDir}
}

func (r *Reader) GetHomeDocument() (store.HomeDocumentDTO, error) {
	var document store.HomeDocumentDTO
	if err := readJSONFile(filepath.Join(r.rootDir, "pages", "home.json"), &document); err != nil {
		return store.HomeDocumentDTO{}, err
	}
	return document, nil
}

func (r *Reader) ListPosts(page int, pageSize int, tagID string) []store.PostDTO {
	posts, err := r.loadPosts(false)
	if err != nil {
		return []store.PostDTO{}
	}

	filtered := make([]store.PostDTO, 0, len(posts))
	for _, post := range posts {
		if tagID != "" && !hasTag(post.Tags, tagID) {
			continue
		}
		filtered = append(filtered, post)
	}

	sort.Slice(filtered, func(i, j int) bool {
		left := derefString(filtered[i].PublishedAt)
		right := derefString(filtered[j].PublishedAt)
		if left != right {
			return left > right
		}
		return filtered[i].Slug < filtered[j].Slug
	})

	return paginatePosts(filtered, page, pageSize)
}

func (r *Reader) GetPostBySlug(slug string) (store.PostDTO, error) {
	return readPublishedPostFile(filepath.Join(r.rootDir, "posts", slug+".md"), true)
}

func (r *Reader) ListProjects() []store.ProjectDTO {
	projects, err := r.loadProjects(false)
	if err != nil {
		return []store.ProjectDTO{}
	}
	sort.Slice(projects, func(i, j int) bool {
		if projects[i].SortOrder != projects[j].SortOrder {
			return projects[i].SortOrder < projects[j].SortOrder
		}
		left := derefString(projects[i].PublishedAt)
		right := derefString(projects[j].PublishedAt)
		if left != right {
			return left > right
		}
		return projects[i].Slug < projects[j].Slug
	})
	return projects
}

func (r *Reader) GetProjectBySlug(slug string) (store.ProjectDTO, error) {
	return readPublishedProjectFile(filepath.Join(r.rootDir, "projects", slug+".md"), true)
}

func (r *Reader) ListTags() []store.TagDTO {
	seen := map[string]store.TagDTO{}

	posts, _ := r.loadPosts(false)
	for _, post := range posts {
		for _, tag := range post.Tags {
			if tag.ID == "" {
				continue
			}
			seen[tag.ID] = tag
		}
	}

	projects, _ := r.loadProjects(false)
	for _, project := range projects {
		for _, tag := range project.Tags {
			if tag.ID == "" {
				continue
			}
			seen[tag.ID] = tag
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
	return tags
}

func (r *Reader) loadPosts(includeBody bool) ([]store.PostDTO, error) {
	paths, err := publishedMarkdownPaths(filepath.Join(r.rootDir, "posts"))
	if err != nil {
		return nil, err
	}

	items := make([]store.PostDTO, 0, len(paths))
	for _, path := range paths {
		post, readErr := readPublishedPostFile(path, includeBody)
		if readErr != nil {
			return nil, readErr
		}
		items = append(items, post)
	}
	return items, nil
}

func (r *Reader) loadProjects(includeBody bool) ([]store.ProjectDTO, error) {
	paths, err := publishedMarkdownPaths(filepath.Join(r.rootDir, "projects"))
	if err != nil {
		return nil, err
	}

	items := make([]store.ProjectDTO, 0, len(paths))
	for _, path := range paths {
		project, readErr := readPublishedProjectFile(path, includeBody)
		if readErr != nil {
			return nil, readErr
		}
		items = append(items, project)
	}
	return items, nil
}

func publishedMarkdownPaths(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return nil, store.ErrNotFound()
	}
	if err != nil {
		return nil, err
	}

	paths := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}
		paths = append(paths, filepath.Join(dir, entry.Name()))
	}
	sort.Strings(paths)
	return paths, nil
}

func readPublishedPostFile(path string, includeBody bool) (store.PostDTO, error) {
	payload, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return store.PostDTO{}, store.ErrNotFound()
	}
	if err != nil {
		return store.PostDTO{}, err
	}
	document, err := contentmd.ParsePostDocument(payload)
	if err != nil {
		return store.PostDTO{}, err
	}

	post := store.PostDTO{
		ID:             document.ID,
		CreatedAt:      document.CreatedAt,
		UpdatedAt:      fallbackFrontmatterValue(document.PublishedAt, document.CreatedAt),
		Title:          document.Title,
		Slug:           document.Slug,
		Content:        "",
		AuthorID:       "",
		Summary:        document.Summary,
		CoverImage:     document.CoverImage,
		PublishedAt:    nilIfEmpty(document.PublishedAt),
		EnableComments: document.EnableComments,
		Tags:           storeTags(document.Tags),
		Author: store.AuthorDTO{
			FullName:  document.AuthorName,
			AvatarURL: document.AuthorAvatarURL,
		},
	}

	if includeBody {
		post.Content = document.BodyMarkdown
	}

	return post, nil
}

func readPublishedProjectFile(path string, includeBody bool) (store.ProjectDTO, error) {
	payload, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return store.ProjectDTO{}, store.ErrNotFound()
	}
	if err != nil {
		return store.ProjectDTO{}, err
	}
	document, err := contentmd.ParseProjectDocument(payload)
	if err != nil {
		return store.ProjectDTO{}, err
	}

	project := store.ProjectDTO{
		ID:          document.ID,
		CreatedAt:   document.CreatedAt,
		UpdatedAt:   fallbackFrontmatterValue(document.PublishedAt, document.CreatedAt),
		Title:       document.Title,
		Slug:        document.Slug,
		Content:     "",
		OwnerID:     "",
		Summary:     document.Summary,
		CoverImage:  document.CoverImage,
		PublishedAt: nilIfEmpty(document.PublishedAt),
		SortOrder:   document.SortOrder,
		Tags:        storeTags(document.Tags),
		Links:       storeProjectLinks(document.ID, document.Links),
		Owner: store.AuthorDTO{
			FullName:  document.OwnerName,
			AvatarURL: document.OwnerAvatarURL,
		},
	}

	if includeBody {
		project.Content = document.BodyMarkdown
	}

	return project, nil
}

func readJSONFile(path string, target any) error {
	payload, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return store.ErrNotFound()
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(payload, target)
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

func nilIfEmpty(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	copy := value
	return &copy
}

func fallbackFrontmatterValue(primary string, fallback string) string {
	if strings.TrimSpace(primary) != "" {
		return primary
	}
	return fallback
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func storeTags(tags []contentmd.Tag) []store.TagDTO {
	items := make([]store.TagDTO, 0, len(tags))
	for _, tag := range tags {
		if tag.ID == "" {
			continue
		}
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
	for index, link := range links {
		linkID := strings.TrimSpace(link.ID)
		if linkID == "" {
			linkID = projectID + "-link-" + strconv.Itoa(index+1)
		}
		items = append(items, store.ProjectLinkDTO{
			ID:        linkID,
			ProjectID: projectID,
			Label:     link.Label,
			URL:       link.URL,
			LinkType:  link.LinkType,
			SortOrder: link.SortOrder,
		})
	}
	return items
}
