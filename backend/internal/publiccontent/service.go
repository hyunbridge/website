package publiccontent

import (
	"context"
	"errors"
	"slices"
	"strings"
	"sync"

	"github.com/hyunbridge/website/backend/internal/operational"
	"github.com/hyunbridge/website/backend/internal/store"
)

type snapshotStore interface {
	ListPosts(ctx context.Context, commitSHA string, page int, pageSize int, tagID string) ([]store.PostDTO, error)
	ListProjects(ctx context.Context, commitSHA string) ([]store.ProjectDTO, error)
	GetPublishedHome(ctx context.Context, commitSHA string) (store.HomeDocumentDTO, error)
}

type Service struct {
	current  store.PublishedContentStore
	snapshot snapshotStore
	live     operational.Store
	cacheMu  sync.RWMutex
	cache    *SiteSnapshot
}

func NewService(current store.PublishedContentStore, snapshot snapshotStore, live operational.Store) *Service {
	if current == nil {
		return nil
	}
	return &Service{
		current:  current,
		snapshot: snapshot,
		live:     live,
	}
}

func (s *Service) ListPosts(ctx context.Context, at string, page int, pageSize int, tagID string) ([]store.PostDTO, error) {
	snapshot, err := s.resolveSnapshot(ctx, at)
	if err != nil {
		return nil, err
	}
	if snapshot == nil {
		return s.current.ListPostDTOsFiltered(false, page, pageSize, tagID), nil
	}
	return paginatePostDTOs(filterPosts(snapshot.Posts, tagID), page, pageSize), nil
}

func (s *Service) GetPostBySlug(ctx context.Context, slug string, at string) (store.PostDTO, error) {
	snapshot, err := s.resolveSnapshot(ctx, at)
	if err != nil {
		return store.PostDTO{}, err
	}
	if snapshot == nil {
		return s.current.GetPostDTOBySlug(slug, false)
	}
	for _, post := range snapshot.Posts {
		if post.Slug == slug {
			return post, nil
		}
	}
	return store.PostDTO{}, store.ErrNotFound()
}

func (s *Service) ListTags(ctx context.Context, at string) ([]store.TagDTO, error) {
	snapshot, err := s.resolveSnapshot(ctx, at)
	if err != nil {
		return nil, err
	}
	if snapshot == nil {
		return s.current.ListTags(), nil
	}
	return cloneTags(snapshot.Tags), nil
}

func (s *Service) ListProjects(ctx context.Context, at string) ([]store.ProjectDTO, error) {
	snapshot, err := s.resolveSnapshot(ctx, at)
	if err != nil {
		return nil, err
	}
	if snapshot == nil {
		return s.current.ListProjectDTOs(false), nil
	}
	return append([]store.ProjectDTO{}, snapshot.Projects...), nil
}

func (s *Service) GetProjectBySlug(ctx context.Context, slug string, at string) (store.ProjectDTO, error) {
	snapshot, err := s.resolveSnapshot(ctx, at)
	if err != nil {
		return store.ProjectDTO{}, err
	}
	if snapshot == nil {
		return s.current.GetProjectDTOBySlug(slug, false)
	}
	for _, project := range snapshot.Projects {
		if project.Slug == slug {
			return project, nil
		}
	}
	return store.ProjectDTO{}, store.ErrNotFound()
}

func (s *Service) GetHome(ctx context.Context, at string) (store.HomeDocumentDTO, error) {
	snapshot, err := s.resolveSnapshot(ctx, at)
	if err != nil {
		return store.HomeDocumentDTO{}, err
	}
	if snapshot == nil || snapshot.Home == nil {
		return s.current.GetPublishedHomeDocument()
	}
	return *cloneHomeDocument(snapshot.Home), nil
}

func (s *Service) GetPublishedPostVersionByID(versionID string) (store.PostVersionDTO, error) {
	return s.current.GetPublishedPostVersionByID(versionID)
}

func (s *Service) GetPublishedProjectVersionByID(versionID string) (store.ProjectVersionDTO, error) {
	return s.current.GetPublishedProjectVersionByID(versionID)
}

func (s *Service) ResolveCurrentCommit(ctx context.Context) (string, error) {
	return s.resolveCommit(ctx, "")
}

func (s *Service) GetCurrentSiteSnapshot(ctx context.Context) (*SiteSnapshot, error) {
	if s == nil || s.current == nil {
		return nil, nil
	}

	snapshot, err := s.resolveSnapshot(ctx, "")
	if err != nil {
		return nil, err
	}
	if snapshot != nil {
		return snapshot, nil
	}

	posts := s.current.ListPostDTOsFiltered(false, 0, 0, "")
	projects := s.current.ListProjectDTOs(false)

	var home *store.HomeDocumentDTO
	document, err := s.current.GetPublishedHomeDocument()
	if err == nil {
		home = &document
	} else if !errors.Is(err, store.ErrNotFound()) {
		return nil, err
	}

	commitSHA, err := s.resolveCommit(ctx, "")
	if err != nil {
		return nil, err
	}
	return buildSiteSnapshot(commitSHA, posts, projects, home), nil
}

func (s *Service) resolveSnapshot(ctx context.Context, at string) (*SiteSnapshot, error) {
	if s == nil || s.snapshot == nil {
		return nil, nil
	}
	commitSHA, err := s.resolveCommit(ctx, at)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(commitSHA) == "" {
		return nil, nil
	}
	return s.loadSnapshot(ctx, commitSHA)
}

func (s *Service) resolveCommit(ctx context.Context, at string) (string, error) {
	if strings.TrimSpace(at) != "" {
		return strings.TrimSpace(at), nil
	}
	if s == nil || s.live == nil {
		return "", nil
	}
	liveState, err := s.live.GetLiveState()
	if err != nil {
		return "", err
	}
	if liveState == nil {
		return "", nil
	}
	return strings.TrimSpace(liveState.LiveCommitSHA), nil
}

func (s *Service) loadSnapshot(ctx context.Context, commitSHA string) (*SiteSnapshot, error) {
	if s == nil || s.snapshot == nil {
		return nil, nil
	}
	commitSHA = strings.TrimSpace(commitSHA)
	if commitSHA == "" {
		return nil, nil
	}
	if cached := s.getCachedSnapshot(commitSHA); cached != nil {
		return cached, nil
	}
	posts, err := s.snapshot.ListPosts(ctx, commitSHA, 0, 0, "")
	if err != nil {
		return nil, err
	}
	projects, err := s.snapshot.ListProjects(ctx, commitSHA)
	if err != nil {
		return nil, err
	}

	var home *store.HomeDocumentDTO
	document, err := s.snapshot.GetPublishedHome(ctx, commitSHA)
	if err == nil {
		home = &document
	} else if !errors.Is(err, store.ErrNotFound()) {
		return nil, err
	}

	snapshot := buildSiteSnapshot(commitSHA, posts, projects, home)
	s.setCachedSnapshot(snapshot)
	return snapshot, nil
}

func (s *Service) getCachedSnapshot(commitSHA string) *SiteSnapshot {
	s.cacheMu.RLock()
	defer s.cacheMu.RUnlock()
	if s.cache == nil || s.cache.CommitSHA != commitSHA {
		return nil
	}
	return cloneSiteSnapshot(s.cache)
}

func (s *Service) setCachedSnapshot(snapshot *SiteSnapshot) {
	if snapshot == nil {
		return
	}
	s.cacheMu.Lock()
	defer s.cacheMu.Unlock()
	s.cache = cloneSiteSnapshot(snapshot)
}

func filterPosts(posts []store.PostDTO, tagID string) []store.PostDTO {
	tagID = strings.TrimSpace(tagID)
	if tagID == "" {
		return append([]store.PostDTO{}, posts...)
	}
	items := make([]store.PostDTO, 0, len(posts))
	for _, post := range posts {
		if slices.ContainsFunc(post.Tags, func(tag store.TagDTO) bool {
			return tag.ID == tagID
		}) {
			items = append(items, post)
		}
	}
	return items
}

func paginatePostDTOs(posts []store.PostDTO, page int, pageSize int) []store.PostDTO {
	if len(posts) == 0 {
		return []store.PostDTO{}
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 || pageSize > len(posts) {
		pageSize = len(posts)
	}
	start := (page - 1) * pageSize
	if start >= len(posts) {
		return []store.PostDTO{}
	}
	end := start + pageSize
	if end > len(posts) {
		end = len(posts)
	}
	return append([]store.PostDTO{}, posts[start:end]...)
}
