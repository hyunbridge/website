package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/hyunbridge/website/backend/internal/contentmd"
	"github.com/hyunbridge/website/backend/internal/domain"
	"github.com/hyunbridge/website/backend/internal/editorial"
	internalid "github.com/hyunbridge/website/backend/internal/id"
	"gopkg.in/yaml.v3"
)

type MongoStore struct {
	mu                     sync.Mutex
	backend                *mongoStateBackend
	bootstrapAdminEmail    string
	bootstrapAdminPassword string
	editorialHistory       *editorial.History
	data                   persistedData
	pointers               PublishPointerSnapshot
}

const (
	adminPasswordSaltLength  = 16
	adminPasswordMemoryKiB   = 64 * 1024
	adminPasswordIterations  = 3
	adminPasswordParallelism = 2
	adminPasswordKeyLength   = 32
)

func NewMongoStore(mongoURL, mongoDatabaseName, bootstrapAdminEmail, bootstrapAdminPassword string, editorialHistory *editorial.History) (*MongoStore, error) {
	backend, err := newMongoStateBackend(mongoURL, mongoDatabaseName)
	if err != nil {
		return nil, err
	}
	store := &MongoStore{
		backend:                backend,
		bootstrapAdminEmail:    bootstrapAdminEmail,
		bootstrapAdminPassword: bootstrapAdminPassword,
		editorialHistory:       editorialHistory,
	}

	if err := store.load(); err != nil {
		return nil, err
	}

	return store, nil
}

func BootstrapMongoStore(mongoURL, mongoDatabaseName, bootstrapAdminEmail, bootstrapAdminPassword string, editorialHistory *editorial.History) error {
	backend, err := newMongoStateBackend(mongoURL, mongoDatabaseName)
	if err != nil {
		return err
	}

	if _, ok, err := backend.Load(); err != nil {
		return err
	} else if ok {
		return ErrBootstrapAlreadyInitialized()
	}

	store := &MongoStore{
		backend:                backend,
		bootstrapAdminEmail:    strings.TrimSpace(bootstrapAdminEmail),
		bootstrapAdminPassword: strings.TrimSpace(bootstrapAdminPassword),
		editorialHistory:       editorialHistory,
	}

	store.data, err = seedPersistedData(store.bootstrapAdminEmail, store.bootstrapAdminPassword)
	if err != nil {
		return err
	}

	return store.saveLocked()
}

func (s *MongoStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	changed := false
	data, ok, err := s.backend.Load()
	if err != nil {
		return err
	}
	if !ok {
		if strings.TrimSpace(s.bootstrapAdminEmail) == "" || strings.TrimSpace(s.bootstrapAdminPassword) == "" {
			return ErrBootstrapRequired()
		}
		s.data, err = seedPersistedData(s.bootstrapAdminEmail, s.bootstrapAdminPassword)
		if err != nil {
			return err
		}
		changed = true
	} else {
		s.data = data
	}
	s.ensurePointerProjectionLocked()

	normalized, err := s.normalizeAdminProfileLocked()
	if err != nil {
		return err
	}
	changed = changed || normalized

	reconciled, err := s.reconcileEditorialStateLocked()
	if err != nil {
		return err
	}
	changed = changed || reconciled

	if changed {
		return s.saveLocked()
	}

	return nil
}

func (s *MongoStore) saveLocked() error {
	if s.backend == nil {
		return nil
	}
	return s.backend.Save(sanitizePersistedDataForStorage(s.data))
}

func (s *MongoStore) savePostSnapshotStateLocked(post persistedPost, title string, summary string, content string, actorID string, changeDescription *string) (string, string, error) {
	if s.editorialHistory == nil {
		return "", "", errors.New("content repository is not configured")
	}
	snapshot := []byte(contentmd.BuildEditorialPostMarkdown(s.postSnapshotDocumentLocked(post, title, summary, content)))
	subject := fallbackEditorialMessage(changeDescription, title)
	body := buildEditorialCommitBody("post", post.ID, title)
	entry, err := s.editorialHistory.SaveAs(context.Background(), postHistoryPath(post.ID), snapshot, subject, body, s.gitAuthorIdentityLocked(actorID))
	if err != nil {
		return "", "", err
	}
	return entry.CommitSHA, entry.CreatedAt, nil
}

func (s *MongoStore) savePostSnapshotLocked(post persistedPost, actorID string, changeDescription *string) (string, string, error) {
	return s.savePostSnapshotStateLocked(post, post.Title, post.Summary, post.Content, actorID, changeDescription)
}

func (s *MongoStore) saveProjectSnapshotStateLocked(project persistedProject, title string, summary string, content string, links []ProjectLink, actorID string, changeDescription *string) (string, string, error) {
	if s.editorialHistory == nil {
		return "", "", errors.New("content repository is not configured")
	}
	snapshot := []byte(contentmd.BuildEditorialProjectMarkdown(s.projectSnapshotDocumentLocked(project, title, summary, content, links)))
	subject := fallbackEditorialMessage(changeDescription, title)
	body := buildEditorialCommitBody("project", project.ID, title)
	entry, err := s.editorialHistory.SaveAs(context.Background(), projectHistoryPath(project.ID), snapshot, subject, body, s.gitAuthorIdentityLocked(actorID))
	if err != nil {
		return "", "", err
	}
	return entry.CommitSHA, entry.CreatedAt, nil
}

func (s *MongoStore) saveProjectSnapshotLocked(project persistedProject, actorID string, changeDescription *string) (string, string, error) {
	return s.saveProjectSnapshotStateLocked(project, project.Title, project.Summary, project.Content, project.Links, actorID, changeDescription)
}

func fallbackEditorialMessage(changeDescription *string, fallback string) string {
	if changeDescription != nil && strings.TrimSpace(*changeDescription) != "" {
		return strings.TrimSpace(*changeDescription)
	}
	return fallback
}

func publishChangeDescription(kind string, published bool) *string {
	action := "unpublish"
	if published {
		action = "publish"
	}
	message := strings.TrimSpace(action + " " + kind)
	return &message
}

func buildEditorialCommitBody(kind string, documentID string, title string) string {
	metadata := editorial.CommitMetadata{
		SchemaVersion: editorial.CommitMetadataSchemaVersion,
		Kind:          strings.TrimSpace(kind),
		DocumentID:    strings.TrimSpace(documentID),
		Title:         strings.TrimSpace(title),
	}
	body, err := yaml.Marshal(metadata)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(body))
}

func (s *MongoStore) loadPublishedPostDocumentLocked(post persistedPost) (contentmd.EditorialPostDocument, bool) {
	publishedVersionID := s.publishedPostVersionIDLocked(post.ID)
	if s.editorialHistory == nil || publishedVersionID == nil || strings.TrimSpace(*publishedVersionID) == "" {
		return contentmd.EditorialPostDocument{}, false
	}
	entry, err := s.editorialHistory.Get(context.Background(), postHistoryPath(post.ID), *publishedVersionID)
	if err != nil {
		return contentmd.EditorialPostDocument{}, false
	}
	document, err := contentmd.ParseEditorialPostDocument(entry.Content)
	if err != nil {
		return contentmd.EditorialPostDocument{}, false
	}
	return document, true
}

func (s *MongoStore) loadPublishedProjectDocumentLocked(project persistedProject) (contentmd.EditorialProjectDocument, bool) {
	publishedVersionID := s.publishedProjectVersionIDLocked(project.ID)
	if s.editorialHistory == nil || publishedVersionID == nil || strings.TrimSpace(*publishedVersionID) == "" {
		return contentmd.EditorialProjectDocument{}, false
	}
	entry, err := s.editorialHistory.Get(context.Background(), projectHistoryPath(project.ID), *publishedVersionID)
	if err != nil {
		return contentmd.EditorialProjectDocument{}, false
	}
	document, err := contentmd.ParseEditorialProjectDocument(entry.Content)
	if err != nil {
		return contentmd.EditorialProjectDocument{}, false
	}
	return document, true
}

func (s *MongoStore) reconcileEditorialStateLocked() (bool, error) {
	if s.editorialHistory == nil || s.editorialHistory.Repository() == nil {
		return false, nil
	}

	ctx := context.Background()
	repo := s.editorialHistory.Repository()

	postPaths, err := repo.ListFiles(ctx, "posts/", ".md")
	if err != nil {
		return false, err
	}
	projectPaths, err := repo.ListFiles(ctx, "projects/", ".md")
	if err != nil {
		return false, err
	}
	pagePaths, err := repo.ListFiles(ctx, "pages/", ".json")
	if err != nil {
		return false, err
	}
	postStates, gitTags, err := s.loadGitPostStatesLocked(ctx, postPaths)
	if err != nil {
		return false, err
	}
	projectStates, projectTags, err := s.loadGitProjectStatesLocked(ctx, projectPaths)
	if err != nil {
		return false, err
	}
	for id, tag := range projectTags {
		gitTags[id] = tag
	}
	postPublishStates, err := s.loadGitLiveRefsLocked(ctx, postLiveRefPrefix())
	if err != nil {
		return false, err
	}
	projectPublishStates, err := s.loadGitLiveRefsLocked(ctx, projectLiveRefPrefix())
	if err != nil {
		return false, err
	}
	homePublishState, err := s.loadGitHomeLiveRefLocked(ctx)
	if err != nil {
		return false, err
	}

	changed := false

	nextPosts, postsChanged := s.reconcilePostsLocked(postStates, postPublishStates)
	s.data.Posts = nextPosts
	changed = changed || postsChanged

	nextProjects, projectsChanged := s.reconcileProjectsLocked(projectStates, projectPublishStates)
	s.data.Projects = nextProjects
	changed = changed || projectsChanged

	homeChanged, err := s.reconcileHomeLocked(ctx, pagePaths, homePublishState)
	if err != nil {
		return false, err
	}
	changed = changed || homeChanged

	nextTags, tagsChanged := s.reconcileTagsLocked(gitTags)
	s.data.Tags = nextTags
	changed = changed || tagsChanged

	return changed, nil
}

func (s *MongoStore) loadGitPostStatesLocked(ctx context.Context, paths []string) (map[string]gitBackedPostState, map[string]persistedTag, error) {
	states := make(map[string]gitBackedPostState, len(paths))
	tags := map[string]persistedTag{}

	for _, relativePath := range paths {
		entries, err := s.editorialHistory.History(ctx, relativePath)
		if err != nil {
			return nil, nil, err
		}
		latest, ok := latestHistoryEntry(entries)
		if !ok {
			continue
		}
		versionEntries := contentVersionEntries(entries)
		version, ok := latestHistoryEntry(versionEntries)
		if !ok {
			version = latest
		}
		first, ok := firstHistoryEntry(versionEntries)
		if !ok {
			first = version
		}
		document, err := contentmd.ParseEditorialPostDocument(latest.Content)
		if err != nil {
			return nil, nil, err
		}
		id := strings.TrimSuffix(filepath.Base(relativePath), filepath.Ext(relativePath))
		states[id] = gitBackedPostState{id: id, first: first, latest: latest, version: version, document: document}
		for _, tag := range document.Tags {
			tags[tag.ID] = persistedTag{ID: tag.ID, Name: tag.Name, Slug: tag.Slug}
		}
	}

	return states, tags, nil
}

func (s *MongoStore) loadGitProjectStatesLocked(ctx context.Context, paths []string) (map[string]gitBackedProjectState, map[string]persistedTag, error) {
	states := make(map[string]gitBackedProjectState, len(paths))
	tags := map[string]persistedTag{}

	for _, relativePath := range paths {
		entries, err := s.editorialHistory.History(ctx, relativePath)
		if err != nil {
			return nil, nil, err
		}
		latest, ok := latestHistoryEntry(entries)
		if !ok {
			continue
		}
		versionEntries := contentVersionEntries(entries)
		version, ok := latestHistoryEntry(versionEntries)
		if !ok {
			version = latest
		}
		first, ok := firstHistoryEntry(versionEntries)
		if !ok {
			first = version
		}
		document, err := contentmd.ParseEditorialProjectDocument(latest.Content)
		if err != nil {
			return nil, nil, err
		}
		id := strings.TrimSuffix(filepath.Base(relativePath), filepath.Ext(relativePath))
		states[id] = gitBackedProjectState{id: id, first: first, latest: latest, version: version, document: document}
		for _, tag := range document.Tags {
			tags[tag.ID] = persistedTag{ID: tag.ID, Name: tag.Name, Slug: tag.Slug}
		}
	}

	return states, tags, nil
}

func (s *MongoStore) loadGitLiveRefsLocked(ctx context.Context, prefix string) (map[string]gitLiveRefState, error) {
	if s.editorialHistory == nil || s.editorialHistory.Repository() == nil {
		return map[string]gitLiveRefState{}, nil
	}

	refs, err := s.editorialHistory.Repository().ListReferences(ctx, prefix)
	if err != nil {
		return nil, err
	}

	states := make(map[string]gitLiveRefState, len(refs))
	for _, ref := range refs {
		id := strings.TrimPrefix(ref.Name, strings.TrimSpace(prefix))
		id = strings.TrimSpace(id)
		if id == "" {
			continue
		}
		states[id] = gitLiveRefState{
			PublishedVersionID: ptrString(strings.TrimSpace(ref.TargetCommitSHA)),
		}
	}
	return states, nil
}

func (s *MongoStore) loadGitHomeLiveRefLocked(ctx context.Context) (*gitLiveRefState, error) {
	if s.editorialHistory == nil || s.editorialHistory.Repository() == nil {
		return nil, nil
	}
	refs, err := s.editorialHistory.Repository().ListReferences(ctx, homeLiveRef())
	if err != nil {
		return nil, err
	}
	for _, ref := range refs {
		if strings.TrimSpace(ref.Name) != homeLiveRef() || strings.TrimSpace(ref.TargetCommitSHA) == "" {
			continue
		}
		return &gitLiveRefState{PublishedVersionID: ptrString(strings.TrimSpace(ref.TargetCommitSHA))}, nil
	}
	return nil, nil
}

func (s *MongoStore) reconcilePostsLocked(gitStates map[string]gitBackedPostState, publishStates map[string]gitLiveRefState) ([]persistedPost, bool) {
	existing := make(map[string]persistedPost, len(s.data.Posts))
	for _, post := range s.data.Posts {
		existing[post.ID] = post
	}

	changed := false
	nextPosts := make([]persistedPost, 0, len(gitStates)+len(existing))

	keys := make([]string, 0, len(gitStates))
	for id := range gitStates {
		keys = append(keys, id)
	}
	sort.Strings(keys)

	for _, id := range keys {
		state := gitStates[id]
		post, ok := existing[id]
		creatorID := fallbackString(s.resolveActorIDForGitAuthorLocked(state.first.Author, state.first.AuthorEmail), s.data.AdminProfile.ID)
		if !ok {
			post = persistedPost{
				ID:        id,
				AuthorID:  creatorID,
				CreatedAt: state.first.CreatedAt,
			}
			changed = true
		}

		nextCurrentVersionID := state.version.CommitSHA
		if !post.DraftDirty || strings.TrimSpace(deref(s.currentPostVersionIDLocked(post), "")) != nextCurrentVersionID {
			post = s.applyPostDocumentLocked(post, state.document)
			post.DraftDirty = false
			changed = true
		}

		post.CreatedAt = fallbackString(state.first.CreatedAt, post.CreatedAt)
		post.AuthorID = fallbackString(post.AuthorID, creatorID)
		post.UpdatedAt = fallbackString(state.version.CreatedAt, post.UpdatedAt)
		pointerState := PublishPointerState{
			ID:               id,
			CurrentVersionID: ptrString(nextCurrentVersionID),
		}
		if publishState, ok := publishStates[id]; ok {
			if historyContainsCommit(state.latest, publishState.PublishedVersionID, s.editorialHistory, postHistoryPath(id)) {
				pointerState.PublishedVersionID = cloneOptionalString(publishState.PublishedVersionID)
				pointerState.PublishedAt = cloneOptionalString(post.PublishedAt)
				if strings.TrimSpace(state.document.PublishedAt) != "" {
					post.PublishedAt = publishedAtFromDocument(state.document.PublishedAt, state.version.CreatedAt)
					pointerState.PublishedAt = cloneOptionalString(post.PublishedAt)
				}
			} else {
				post.PublishedAt = nil
			}
		} else {
			post.PublishedAt = nil
		}
		s.setPostPointerStateLocked(pointerState)

		if !ok || !persistedPostsEqual(existing[id], post) {
			changed = true
		}
		nextPosts = append(nextPosts, post)
		delete(existing, id)
	}

	for _, post := range existing {
		s.removePostPointerStateLocked(post.ID)
		if !post.DraftDirty {
			nextPosts = append(nextPosts, post)
			continue
		}
		changed = true
	}

	sort.Slice(nextPosts, func(i, j int) bool {
		return nextPosts[i].CreatedAt > nextPosts[j].CreatedAt
	})
	return nextPosts, changed
}

func (s *MongoStore) reconcileProjectsLocked(gitStates map[string]gitBackedProjectState, publishStates map[string]gitLiveRefState) ([]persistedProject, bool) {
	existing := make(map[string]persistedProject, len(s.data.Projects))
	for _, project := range s.data.Projects {
		existing[project.ID] = project
	}

	changed := false
	nextProjects := make([]persistedProject, 0, len(gitStates)+len(existing))

	keys := make([]string, 0, len(gitStates))
	for id := range gitStates {
		keys = append(keys, id)
	}
	sort.Strings(keys)

	for _, id := range keys {
		state := gitStates[id]
		project, ok := existing[id]
		ownerID := fallbackString(s.resolveActorIDForGitAuthorLocked(state.first.Author, state.first.AuthorEmail), s.data.AdminProfile.ID)
		if !ok {
			project = persistedProject{
				ID:        id,
				OwnerID:   ownerID,
				CreatedAt: state.first.CreatedAt,
			}
			changed = true
		}

		nextCurrentVersionID := state.version.CommitSHA
		if !project.DraftDirty || strings.TrimSpace(deref(s.currentProjectVersionIDLocked(project), "")) != nextCurrentVersionID {
			project = s.applyProjectDocumentLocked(project, state.document)
			project.DraftDirty = false
			changed = true
		}

		project.CreatedAt = fallbackString(state.first.CreatedAt, project.CreatedAt)
		project.OwnerID = fallbackString(project.OwnerID, ownerID)
		project.UpdatedAt = fallbackString(state.version.CreatedAt, project.UpdatedAt)
		pointerState := PublishPointerState{
			ID:               id,
			CurrentVersionID: ptrString(nextCurrentVersionID),
		}
		if publishState, ok := publishStates[id]; ok {
			if historyContainsCommit(state.latest, publishState.PublishedVersionID, s.editorialHistory, projectHistoryPath(id)) {
				pointerState.PublishedVersionID = cloneOptionalString(publishState.PublishedVersionID)
				pointerState.PublishedAt = cloneOptionalString(project.PublishedAt)
				if strings.TrimSpace(state.document.PublishedAt) != "" {
					project.PublishedAt = publishedAtFromDocument(state.document.PublishedAt, state.version.CreatedAt)
					pointerState.PublishedAt = cloneOptionalString(project.PublishedAt)
				}
			} else {
				project.PublishedAt = nil
			}
		} else {
			project.PublishedAt = nil
		}
		s.setProjectPointerStateLocked(pointerState)

		if !ok || !persistedProjectsEqual(existing[id], project) {
			changed = true
		}
		nextProjects = append(nextProjects, project)
		delete(existing, id)
	}

	for _, project := range existing {
		s.removeProjectPointerStateLocked(project.ID)
		if !project.DraftDirty {
			nextProjects = append(nextProjects, project)
			continue
		}
		changed = true
	}

	sort.Slice(nextProjects, func(i, j int) bool {
		if nextProjects[i].SortOrder != nextProjects[j].SortOrder {
			return nextProjects[i].SortOrder < nextProjects[j].SortOrder
		}
		return nextProjects[i].CreatedAt > nextProjects[j].CreatedAt
	})
	return nextProjects, changed
}

func (s *MongoStore) reconcileHomeLocked(ctx context.Context, pagePaths []string, publishState *gitLiveRefState) (bool, error) {
	hasHome := false
	for _, path := range pagePaths {
		if path == homeHistoryPath() {
			hasHome = true
			break
		}
	}
	if !hasHome || s.editorialHistory == nil {
		return false, nil
	}

	entries, err := s.editorialHistory.History(ctx, homeHistoryPath())
	if err != nil {
		return false, err
	}
	latest, ok := latestHistoryEntry(entries)
	if !ok {
		return false, nil
	}

	var snapshot editorialHomeSnapshot
	if err := json.Unmarshal(latest.Content, &snapshot); err != nil {
		return false, err
	}

	changed := false
	if !s.data.Home.DraftDirty || strings.TrimSpace(deref(s.currentHomeVersionIDLocked(), "")) != latest.CommitSHA {
		s.data.Home.Data = snapshot.Data
		s.data.Home.DraftDirty = false
		changed = true
	}

	if s.data.Home.ID == "" {
		s.data.Home.ID = snapshot.ID
		changed = true
	}
	if s.data.Home.OwnerID == "" {
		s.data.Home.OwnerID = fallbackString(s.resolveActorIDForGitAuthorLocked(latest.Author, latest.AuthorEmail), s.data.AdminProfile.ID)
		changed = true
	}
	homePointerState := PublishPointerState{ID: s.data.Home.ID, CurrentVersionID: ptrString(latest.CommitSHA)}

	if publishState != nil {
		nextPublishedVersionID := cloneOptionalString(publishState.PublishedVersionID)
		if !historyContainsCommit(latest, nextPublishedVersionID, s.editorialHistory, homeHistoryPath()) {
			nextPublishedVersionID = nil
		}
		nextPublishedAt := cloneOptionalString(s.data.Home.PublishedAt)
		if nextPublishedVersionID != nil {
			if publishedEntry, err := s.editorialHistory.Get(ctx, homeHistoryPath(), *nextPublishedVersionID); err == nil {
				var publishedSnapshot editorialHomeSnapshot
				if unmarshalErr := json.Unmarshal(publishedEntry.Content, &publishedSnapshot); unmarshalErr == nil {
					if publishedSnapshot.PublishedAt != nil && strings.TrimSpace(*publishedSnapshot.PublishedAt) != "" {
						nextPublishedAt = cloneOptionalString(publishedSnapshot.PublishedAt)
					}
				}
			}
		}
		if deref(s.publishedHomeVersionIDLocked(), "") != deref(nextPublishedVersionID, "") ||
			deref(s.data.Home.PublishedAt, "") != deref(nextPublishedAt, "") {
			s.data.Home.PublishedAt = nextPublishedAt
			changed = true
		}
		homePointerState.PublishedVersionID = nextPublishedVersionID
		homePointerState.PublishedAt = cloneOptionalString(nextPublishedAt)
	} else if s.data.Home.PublishedAt != nil {
		s.data.Home.PublishedAt = nil
		changed = true
	}
	s.setHomePointerStateLocked(homePointerState)

	return changed, nil
}

func (s *MongoStore) reconcileTagsLocked(gitTags map[string]persistedTag) ([]persistedTag, bool) {
	existing := make(map[string]persistedTag, len(s.data.Tags))
	for _, tag := range s.data.Tags {
		existing[tag.ID] = tag
	}

	required := map[string]persistedTag{}
	for _, post := range s.data.Posts {
		for _, tagID := range post.TagIDs {
			if tag, ok := gitTags[tagID]; ok {
				required[tagID] = tag
				continue
			}
			if tag, ok := existing[tagID]; ok {
				required[tagID] = tag
			}
		}
	}
	for _, project := range s.data.Projects {
		for _, tagID := range project.TagIDs {
			if tag, ok := gitTags[tagID]; ok {
				required[tagID] = tag
				continue
			}
			if tag, ok := existing[tagID]; ok {
				required[tagID] = tag
			}
		}
	}

	items := make([]persistedTag, 0, len(required))
	for _, tag := range required {
		items = append(items, tag)
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].Name != items[j].Name {
			return items[i].Name < items[j].Name
		}
		return items[i].Slug < items[j].Slug
	})
	return items, !persistedTagsEqual(s.data.Tags, items)
}

func historyContainsCommit(latest editorial.Entry, commitSHA *string, history *editorial.History, relativePath string) bool {
	if commitSHA == nil || strings.TrimSpace(*commitSHA) == "" || history == nil {
		return false
	}
	if strings.TrimSpace(*commitSHA) == latest.CommitSHA {
		return true
	}
	_, err := history.Get(context.Background(), relativePath, strings.TrimSpace(*commitSHA))
	return err == nil
}

func publishedAtFromDocument(documentValue string, fallback string) *string {
	if strings.TrimSpace(documentValue) != "" {
		return ptrString(documentValue)
	}
	return ptrString(fallback)
}

func persistedPostsEqual(left persistedPost, right persistedPost) bool {
	return left.ID == right.ID &&
		left.CreatedAt == right.CreatedAt &&
		left.UpdatedAt == right.UpdatedAt &&
		left.Title == right.Title &&
		left.Slug == right.Slug &&
		left.Content == right.Content &&
		left.AuthorID == right.AuthorID &&
		left.Summary == right.Summary &&
		deref(left.CoverImage, "") == deref(right.CoverImage, "") &&
		deref(left.PublishedAt, "") == deref(right.PublishedAt, "") &&
		left.EnableComments == right.EnableComments &&
		slices.Equal(left.TagIDs, right.TagIDs) &&
		slices.Equal(left.AssetKeys, right.AssetKeys) &&
		left.DraftDirty == right.DraftDirty
}

func persistedProjectsEqual(left persistedProject, right persistedProject) bool {
	return left.ID == right.ID &&
		left.CreatedAt == right.CreatedAt &&
		left.UpdatedAt == right.UpdatedAt &&
		left.Title == right.Title &&
		left.Slug == right.Slug &&
		left.Content == right.Content &&
		left.OwnerID == right.OwnerID &&
		left.Summary == right.Summary &&
		deref(left.CoverImage, "") == deref(right.CoverImage, "") &&
		deref(left.PublishedAt, "") == deref(right.PublishedAt, "") &&
		left.SortOrder == right.SortOrder &&
		slices.Equal(left.TagIDs, right.TagIDs) &&
		slices.Equal(left.AssetKeys, right.AssetKeys) &&
		slices.Equal(left.Links, right.Links) &&
		left.DraftDirty == right.DraftDirty
}

func persistedTagsEqual(left []persistedTag, right []persistedTag) bool {
	return slices.Equal(left, right)
}

func postVersionDTOFromEntry(postID string, entry editorial.Entry, index int) (PostVersionDTO, error) {
	document, err := contentmd.ParseEditorialPostDocument(entry.Content)
	if err != nil {
		return PostVersionDTO{}, err
	}
	return PostVersionDTO{
		ID:                entry.CommitSHA,
		VersionNumber:     index + 1,
		PostID:            postID,
		Title:             document.Title,
		Slug:              document.Slug,
		Content:           document.BodyMarkdown,
		Summary:           document.Summary,
		PublishedAt:       trimOptionalString(ptrString(strings.TrimSpace(document.PublishedAt))),
		CoverImage:        cloneOptionalString(document.CoverImage),
		EnableComments:    document.EnableComments,
		Tags:              tagDTOsFromContentTags(document.Tags),
		ChangeDescription: trimOptionalString(ptrString(strings.TrimSpace(entry.Message))),
		CreatedAt:         entry.CreatedAt,
		CreatedBy:         strings.TrimSpace(entry.Author),
	}, nil
}

func projectVersionDTOFromEntry(projectID string, entry editorial.Entry, index int) (ProjectVersionDTO, error) {
	document, err := contentmd.ParseEditorialProjectDocument(entry.Content)
	if err != nil {
		return ProjectVersionDTO{}, err
	}
	return ProjectVersionDTO{
		ID:                entry.CommitSHA,
		VersionNumber:     index + 1,
		ProjectID:         projectID,
		Title:             document.Title,
		Slug:              document.Slug,
		Content:           document.BodyMarkdown,
		Summary:           document.Summary,
		PublishedAt:       trimOptionalString(ptrString(strings.TrimSpace(document.PublishedAt))),
		CoverImage:        cloneOptionalString(document.CoverImage),
		SortOrder:         document.SortOrder,
		Tags:              tagDTOsFromContentTags(document.Tags),
		Links:             projectLinkDTOs(projectID, persistedLinksFromContent(document.Links)),
		ChangeDescription: trimOptionalString(ptrString(strings.TrimSpace(entry.Message))),
		CreatedAt:         entry.CreatedAt,
		CreatedBy:         strings.TrimSpace(entry.Author),
	}, nil
}

func homeVersionDTOFromEntry(entry editorial.Entry, index int) (HomeVersionDTO, error) {
	var snapshot editorialHomeSnapshot
	if err := json.Unmarshal(entry.Content, &snapshot); err != nil {
		return HomeVersionDTO{}, err
	}
	return HomeVersionDTO{
		ID:                entry.CommitSHA,
		PageID:            snapshot.ID,
		VersionNumber:     index + 1,
		Title:             snapshot.Title,
		Data:              snapshot.Data,
		Notices:           []map[string]string{},
		Summary:           snapshot.Summary,
		ChangeDescription: trimOptionalString(ptrString(strings.TrimSpace(entry.Message))),
		CreatedAt:         entry.CreatedAt,
		CreatedBy:         strings.TrimSpace(entry.Author),
	}, nil
}

func latestHistoryEntry(entries []editorial.Entry) (editorial.Entry, bool) {
	if len(entries) == 0 {
		return editorial.Entry{}, false
	}
	return entries[len(entries)-1], true
}

func firstHistoryEntry(entries []editorial.Entry) (editorial.Entry, bool) {
	if len(entries) == 0 {
		return editorial.Entry{}, false
	}
	return entries[0], true
}

func contentVersionEntries(entries []editorial.Entry) []editorial.Entry {
	if len(entries) == 0 {
		return nil
	}
	return append([]editorial.Entry(nil), entries...)
}

func (s *MongoStore) postSnapshotDocumentLocked(post persistedPost, title string, summary string, content string) contentmd.EditorialPostDocument {
	return contentmd.EditorialPostDocument{
		ID:             post.ID,
		Slug:           post.Slug,
		Title:          title,
		Summary:        summary,
		PublishedAt:    deref(post.PublishedAt, ""),
		CoverImage:     cloneOptionalString(post.CoverImage),
		EnableComments: post.EnableComments,
		Tags:           contentTagsFromDTOs(s.resolveTags(post.TagIDs)),
		BodyMarkdown:   content,
	}
}

func (s *MongoStore) projectSnapshotDocumentLocked(project persistedProject, title string, summary string, content string, links []ProjectLink) contentmd.EditorialProjectDocument {
	return contentmd.EditorialProjectDocument{
		ID:           project.ID,
		Slug:         project.Slug,
		Title:        title,
		Summary:      summary,
		PublishedAt:  deref(project.PublishedAt, ""),
		CoverImage:   cloneOptionalString(project.CoverImage),
		SortOrder:    project.SortOrder,
		Tags:         contentTagsFromDTOs(s.resolveTags(project.TagIDs)),
		Links:        contentLinksFromPersisted(links),
		BodyMarkdown: content,
	}
}

func contentTagsFromDTOs(tags []TagDTO) []contentmd.Tag {
	items := make([]contentmd.Tag, 0, len(tags))
	for _, tag := range tags {
		items = append(items, contentmd.Tag{
			ID:   tag.ID,
			Name: tag.Name,
			Slug: tag.Slug,
		})
	}
	return items
}

func tagDTOsFromContentTags(tags []contentmd.Tag) []TagDTO {
	items := make([]TagDTO, 0, len(tags))
	for _, tag := range tags {
		items = append(items, TagDTO{
			ID:   tag.ID,
			Name: tag.Name,
			Slug: tag.Slug,
		})
	}
	return items
}

func contentLinksFromPersisted(links []ProjectLink) []contentmd.Link {
	items := make([]contentmd.Link, 0, len(links))
	for _, link := range links {
		items = append(items, contentmd.Link{
			ID:        link.ID,
			Label:     link.Label,
			URL:       link.URL,
			LinkType:  cloneOptionalString(link.LinkType),
			SortOrder: link.SortOrder,
		})
	}
	return items
}

func persistedLinksFromContent(links []contentmd.Link) []ProjectLink {
	items := make([]ProjectLink, 0, len(links))
	for _, link := range links {
		items = append(items, ProjectLink{
			ID:        strings.TrimSpace(link.ID),
			Label:     link.Label,
			URL:       link.URL,
			LinkType:  cloneOptionalString(link.LinkType),
			SortOrder: link.SortOrder,
		})
	}
	return items
}

func trimOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func seedPersistedData(adminEmail, adminPassword string) (persistedData, error) {
	adminEmail = strings.TrimSpace(adminEmail)
	adminPassword = strings.TrimSpace(adminPassword)
	if adminEmail == "" || adminPassword == "" {
		return persistedData{}, ErrBootstrapRequired()
	}

	hashedPassword, err := hashAdminPassword(adminPassword)
	if err != nil {
		return persistedData{}, err
	}

	return persistedData{
		AdminProfile: persistedAdminProfile{
			ID:             internalid.NewPersistentID(),
			Email:          adminEmail,
			Username:       "admin",
			Password:       hashedPassword,
			GitAuthorName:  ptrString("admin"),
			GitAuthorEmail: ptrString(adminEmail),
		},
		Tags:     []persistedTag{},
		Posts:    []persistedPost{},
		Projects: []persistedProject{},
		Home: persistedHome{
			ID:                 "home-page",
			OwnerID:            "",
			UpdatedAt:          nil,
			PublishedAt:        nil,
			CurrentVersionID:   nil,
			PublishedVersionID: nil,
			Data:               nil,
		},
	}, nil
}

func ptrString(value string) *string { return &value }

func cloneOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

func fallbackString(value string, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func isPublishedAt(value *string) bool {
	return strings.TrimSpace(deref(value, "")) != ""
}

func (s *MongoStore) ListPosts() []domain.SummaryCard {
	s.mu.Lock()
	defer s.mu.Unlock()

	items := make([]domain.SummaryCard, 0, len(s.data.Posts))
	for _, post := range s.data.Posts {
		if s.publishedPostVersionIDLocked(post.ID) == nil {
			continue
		}
		if document, ok := s.loadPublishedPostDocumentLocked(post); ok {
			post = s.applyPostDocumentLocked(post, document)
			items = append(items, s.mapPostToSummary(post))
		}
	}
	return items
}

func (s *MongoStore) GetPost(slug string) (domain.PostDetail, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, post := range s.data.Posts {
		if s.publishedPostVersionIDLocked(post.ID) == nil {
			continue
		}
		if document, ok := s.loadPublishedPostDocumentLocked(post); ok {
			post = s.applyPostDocumentLocked(post, document)
			if post.Slug != slug {
				continue
			}
			return s.mapPostToDetail(post), nil
		}
	}
	return domain.PostDetail{}, errNotFound
}

func (s *MongoStore) ListProjects() []domain.SummaryCard {
	s.mu.Lock()
	defer s.mu.Unlock()

	items := make([]domain.SummaryCard, 0, len(s.data.Projects))
	for _, project := range s.data.Projects {
		if s.publishedProjectVersionIDLocked(project.ID) == nil {
			continue
		}
		if document, ok := s.loadPublishedProjectDocumentLocked(project); ok {
			project = s.applyProjectDocumentLocked(project, document)
			items = append(items, s.mapProjectToSummary(project))
		}
	}
	return items
}

func (s *MongoStore) GetProject(slug string) (domain.ProjectDetail, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, project := range s.data.Projects {
		if s.publishedProjectVersionIDLocked(project.ID) == nil {
			continue
		}
		if document, ok := s.loadPublishedProjectDocumentLocked(project); ok {
			project = s.applyProjectDocumentLocked(project, document)
			if project.Slug != slug {
				continue
			}
			return s.mapProjectToDetail(project), nil
		}
	}
	return domain.ProjectDetail{}, errNotFound
}

func (s *MongoStore) mapPostToSummary(post persistedPost) domain.SummaryCard {
	return domain.SummaryCard{
		ID:          post.ID,
		Slug:        post.Slug,
		Title:       post.Title,
		Summary:     post.Summary,
		PublishedAt: deref(post.PublishedAt, post.CreatedAt),
		Tags:        s.tagNames(post.TagIDs),
	}
}

func (s *MongoStore) mapPostToDetail(post persistedPost) domain.PostDetail {
	return domain.PostDetail{
		SummaryCard: s.mapPostToSummary(post),
		Body:        markdownSections(post.Content),
	}
}

func (s *MongoStore) mapProjectToSummary(project persistedProject) domain.SummaryCard {
	return domain.SummaryCard{
		ID:          project.ID,
		Slug:        project.Slug,
		Title:       project.Title,
		Summary:     project.Summary,
		PublishedAt: deref(project.PublishedAt, project.CreatedAt),
		Tags:        s.tagNames(project.TagIDs),
	}
}

func (s *MongoStore) mapProjectToDetail(project persistedProject) domain.ProjectDetail {
	links := make([]domain.ProjectLink, 0, len(project.Links))
	for _, link := range project.Links {
		links = append(links, domain.ProjectLink{
			Label: link.Label,
			Href:  link.URL,
		})
	}
	return domain.ProjectDetail{
		SummaryCard: s.mapProjectToSummary(project),
		Links:       links,
		Body:        markdownSections(project.Content),
	}
}

func (s *MongoStore) tagNames(ids []string) []string {
	names := make([]string, 0, len(ids))
	for _, tagID := range ids {
		for _, tag := range s.data.Tags {
			if tag.ID == tagID {
				names = append(names, tag.Name)
				break
			}
		}
	}
	return names
}

func deref(value *string, fallback string) string {
	if value == nil {
		return fallback
	}
	return *value
}

func markdownSections(content string) []string {
	normalized := strings.ReplaceAll(content, "\r\n", "\n")
	parts := strings.Split(normalized, "\n\n")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			items = append(items, part)
		}
	}
	return items
}

func stringValue(value any, fallback string) string {
	if casted, ok := value.(string); ok && casted != "" {
		return casted
	}
	return fallback
}

func upsertTag(tags []persistedTag, name, slug string) ([]persistedTag, persistedTag) {
	name = strings.TrimSpace(name)
	slug = strings.TrimSpace(slug)
	for _, tag := range tags {
		if tag.Slug == slug {
			return tags, tag
		}
	}
	tag := persistedTag{ID: internalid.NewPersistentID(), Name: name, Slug: slug}
	return append(tags, tag), tag
}

func addUnique(values []string, next string) []string {
	if slices.Contains(values, next) {
		return values
	}
	return append(values, next)
}

func ternary(condition bool, whenTrue, whenFalse string) string {
	if condition {
		return whenTrue
	}
	return whenFalse
}

func toPersistedLinks(links []ProjectLinkDTO) []ProjectLink {
	persisted := make([]ProjectLink, 0, len(links))
	for _, link := range links {
		persisted = append(persisted, ProjectLink{
			ID:        link.ID,
			Label:     link.Label,
			URL:       link.URL,
			LinkType:  link.LinkType,
			SortOrder: link.SortOrder,
		})
	}
	return persisted
}

func (s *MongoStore) ListAllPosts() []persistedPost {
	s.mu.Lock()
	defer s.mu.Unlock()
	items := append([]persistedPost(nil), s.data.Posts...)
	slices.SortFunc(items, func(left, right persistedPost) int {
		if left.CreatedAt == right.CreatedAt {
			return strings.Compare(right.ID, left.ID)
		}
		return strings.Compare(right.CreatedAt, left.CreatedAt)
	})
	return items
}

func (s *MongoStore) ListPostDTOs(includeDraft bool) []PostDTO {
	posts := s.ListAllPosts()
	items := make([]PostDTO, 0, len(posts))
	for _, post := range posts {
		if includeDraft {
			items = append(items, s.toPostDTO(post))
			continue
		}
		if dto, ok := s.toPublishedPostDTO(post); ok {
			items = append(items, dto)
		}
	}
	return items
}

func normalizePage(page int) int {
	if page < 1 {
		return 1
	}
	return page
}

func normalizePageSize(pageSize int) int {
	if pageSize < 1 {
		return 10
	}
	return pageSize
}

func paginateItems[T any](items []T, page int, pageSize int) []T {
	page = normalizePage(page)
	pageSize = normalizePageSize(pageSize)
	start := (page - 1) * pageSize
	if start >= len(items) {
		return []T{}
	}
	end := start + pageSize
	if end > len(items) {
		end = len(items)
	}
	return items[start:end]
}

func (s *MongoStore) ListPostDTOsFiltered(includeDraft bool, page int, pageSize int, tagID string) []PostDTO {
	items := s.ListPostDTOs(includeDraft)
	if tagID != "" {
		filtered := make([]PostDTO, 0, len(items))
		for _, post := range items {
			if slices.ContainsFunc(post.Tags, func(tag TagDTO) bool { return tag.ID == tagID }) {
				filtered = append(filtered, post)
			}
		}
		items = filtered
	}
	return paginateItems(items, page, pageSize)
}

func (s *MongoStore) GetPostByID(id string) (persistedPost, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, post := range s.data.Posts {
		if post.ID == id {
			return post, nil
		}
	}
	return persistedPost{}, errNotFound
}

func (s *MongoStore) GetPostDTOByID(id string) (PostDTO, error) {
	post, err := s.GetPostByID(id)
	if err != nil {
		return PostDTO{}, err
	}
	return s.toPostDTO(post), nil
}

func (s *MongoStore) GetPostDTOBySlug(slug string, includeDraft bool) (PostDTO, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, post := range s.data.Posts {
		if includeDraft {
			if post.Slug != slug {
				continue
			}
			return s.toPostDTO(post), nil
		}
		if dto, ok := s.toPublishedPostDTO(post); ok {
			if dto.Slug == slug {
				return dto, nil
			}
		}
	}
	return PostDTO{}, errNotFound
}

func (s *MongoStore) CreatePost(authorID, title, slug, summary string) (persistedPost, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC().Format(time.RFC3339)
	postID := internalid.NewPersistentID()
	post := persistedPost{
		ID:             postID,
		CreatedAt:      now,
		UpdatedAt:      now,
		Title:          title,
		Slug:           slug,
		Content:        "",
		AuthorID:       authorID,
		Summary:        summary,
		EnableComments: true,
		DraftDirty:     true,
	}

	s.data.Posts = append([]persistedPost{post}, s.data.Posts...)
	return post, s.saveLocked()
}

func (s *MongoStore) UpdatePost(id string, updater func(*persistedPost) error) (persistedPost, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.data.Posts {
		if s.data.Posts[i].ID == id {
			if err := updater(&s.data.Posts[i]); err != nil {
				return persistedPost{}, err
			}
			s.data.Posts[i].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			return s.data.Posts[i], s.saveLocked()
		}
	}
	return persistedPost{}, errNotFound
}

func (s *MongoStore) PatchPost(id string, patch PostPatch) (PostDTO, error) {
	post, err := s.UpdatePost(id, func(current *persistedPost) error {
		if patch.Title != nil {
			current.Title = *patch.Title
		}
		if patch.Slug != nil {
			current.Slug = *patch.Slug
		}
		if patch.Summary != nil {
			current.Summary = *patch.Summary
		}
		if patch.Content != nil {
			current.Content = *patch.Content
		}
		if patch.CoverImage != nil {
			current.CoverImage = patch.CoverImage
		}
		if patch.PublishedAt != nil {
			current.PublishedAt = trimOptionalString(ptrString(strings.TrimSpace(*patch.PublishedAt)))
		}
		if patch.EnableComments != nil {
			current.EnableComments = *patch.EnableComments
		}
		if patch.TagIDs != nil {
			current.TagIDs = *patch.TagIDs
		}
		current.DraftDirty = true
		return nil
	})
	if err != nil {
		return PostDTO{}, err
	}
	return s.toPostDTO(post), nil
}

func (s *MongoStore) ListProjectDTOs(includeDraft bool) []ProjectDTO {
	projects := s.ListAllProjects()
	items := make([]ProjectDTO, 0, len(projects))
	for _, project := range projects {
		if includeDraft {
			items = append(items, s.toProjectDTO(project))
			continue
		}
		if dto, ok := s.toPublishedProjectDTO(project); ok {
			items = append(items, dto)
		}
	}
	slices.SortFunc(items, func(a, b ProjectDTO) int {
		return a.SortOrder - b.SortOrder
	})
	return items
}

func (s *MongoStore) SetPostPublished(id string, published bool) (PostDTO, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for idx := range s.data.Posts {
		post := &s.data.Posts[idx]
		if post.ID != id {
			continue
		}

		if published {
			if !isPublishedAt(post.PublishedAt) {
				now := time.Now().UTC().Format(time.RFC3339)
				post.PublishedAt = &now
			}
			currentVersionID := s.currentPostVersionIDLocked(*post)
			if currentVersionID == nil {
				currentVersionID = s.latestPostVersionIDLocked(post.ID)
			}
			if currentVersionID == nil {
				return PostDTO{}, fmt.Errorf("post has no saved version to publish")
			}
			s.setPostPointerStateLocked(PublishPointerState{
				ID:                 post.ID,
				CurrentVersionID:   cloneOptionalString(currentVersionID),
				PublishedVersionID: cloneOptionalString(currentVersionID),
				PublishedAt:        cloneOptionalString(post.PublishedAt),
			})
		} else {
			post.PublishedAt = nil
			state := s.postPointerStateLocked(post.ID)
			state.PublishedVersionID = nil
			state.PublishedAt = nil
			s.setPostPointerStateLocked(state)
		}
		if err := s.applyPublishedPointersLocked(); err != nil {
			return PostDTO{}, err
		}
		dto := s.toPostDTO(*post)
		return dto, s.saveLocked()
	}

	return PostDTO{}, errNotFound
}

func (s *MongoStore) GetProjectDTOBySlug(slug string, includeDraft bool) (ProjectDTO, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, project := range s.data.Projects {
		if includeDraft {
			if project.Slug != slug {
				continue
			}
			return s.toProjectDTO(project), nil
		}
		if dto, ok := s.toPublishedProjectDTO(project); ok {
			if dto.Slug == slug {
				return dto, nil
			}
		}
	}
	return ProjectDTO{}, errNotFound
}

func (s *MongoStore) DeletePost(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.data.Posts {
		if s.data.Posts[i].ID == id {
			s.data.Posts = append(s.data.Posts[:i], s.data.Posts[i+1:]...)
			s.removePostPointerStateLocked(id)
			return s.saveLocked()
		}
	}
	return errNotFound
}

func (s *MongoStore) DeletePostWithAssets(id string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.data.Posts {
		if s.data.Posts[i].ID == id {
			assetKeys := append([]string(nil), s.data.Posts[i].AssetKeys...)
			s.data.Posts = append(s.data.Posts[:i], s.data.Posts[i+1:]...)
			s.removePostPointerStateLocked(id)
			return assetKeys, s.saveLocked()
		}
	}
	return nil, errNotFound
}

func (s *MongoStore) ListAllProjects() []persistedProject {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]persistedProject(nil), s.data.Projects...)
}

func (s *MongoStore) GetProjectByID(id string) (persistedProject, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, project := range s.data.Projects {
		if project.ID == id {
			return project, nil
		}
	}
	return persistedProject{}, errNotFound
}

func (s *MongoStore) GetProjectDTOByID(id string) (ProjectDTO, error) {
	project, err := s.GetProjectByID(id)
	if err != nil {
		return ProjectDTO{}, err
	}
	return s.toProjectDTO(project), nil
}

func (s *MongoStore) CreateProject(ownerID, title, slug, summary string) (persistedProject, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UTC().Format(time.RFC3339)
	projectID := internalid.NewPersistentID()
	project := persistedProject{
		ID:         projectID,
		CreatedAt:  now,
		UpdatedAt:  now,
		Title:      title,
		Slug:       slug,
		Content:    "",
		OwnerID:    ownerID,
		Summary:    summary,
		SortOrder:  len(s.data.Projects),
		DraftDirty: true,
	}
	s.data.Projects = append(s.data.Projects, project)
	return project, s.saveLocked()
}

func (s *MongoStore) UpdateProject(id string, updater func(*persistedProject) error) (persistedProject, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for i := range s.data.Projects {
		if s.data.Projects[i].ID == id {
			if err := updater(&s.data.Projects[i]); err != nil {
				return persistedProject{}, err
			}
			s.data.Projects[i].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			return s.data.Projects[i], s.saveLocked()
		}
	}
	return persistedProject{}, errNotFound
}

func (s *MongoStore) PatchProject(id string, patch ProjectPatch) (ProjectDTO, error) {
	project, err := s.UpdateProject(id, func(current *persistedProject) error {
		if patch.Title != nil {
			current.Title = *patch.Title
		}
		if patch.Slug != nil {
			current.Slug = *patch.Slug
		}
		if patch.Summary != nil {
			current.Summary = *patch.Summary
		}
		if patch.Content != nil {
			current.Content = *patch.Content
		}
		if patch.CoverImage != nil {
			current.CoverImage = patch.CoverImage
		}
		if patch.PublishedAt != nil {
			current.PublishedAt = trimOptionalString(ptrString(strings.TrimSpace(*patch.PublishedAt)))
		}
		if patch.SortOrder != nil {
			current.SortOrder = *patch.SortOrder
		}
		if patch.TagIDs != nil {
			current.TagIDs = *patch.TagIDs
		}
		if patch.Links != nil {
			nextLinks := make([]ProjectLink, 0, len(*patch.Links))
			for _, link := range *patch.Links {
				nextLinks = append(nextLinks, ProjectLink{
					ID:        link.ID,
					Label:     link.Label,
					URL:       link.URL,
					LinkType:  link.LinkType,
					SortOrder: link.SortOrder,
				})
			}
			current.Links = normalizePersistedProjectLinks(current.ID, nextLinks)
		}
		current.DraftDirty = true
		return nil
	})
	if err != nil {
		return ProjectDTO{}, err
	}
	return s.toProjectDTO(project), nil
}

func (s *MongoStore) SetProjectPublished(id string, published bool) (ProjectDTO, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for idx := range s.data.Projects {
		project := &s.data.Projects[idx]
		if project.ID != id {
			continue
		}

		if published {
			if !isPublishedAt(project.PublishedAt) {
				now := time.Now().UTC().Format(time.RFC3339)
				project.PublishedAt = &now
			}
			currentVersionID := s.currentProjectVersionIDLocked(*project)
			if currentVersionID == nil {
				currentVersionID = s.latestProjectVersionIDLocked(project.ID)
			}
			if currentVersionID == nil {
				return ProjectDTO{}, fmt.Errorf("project has no saved version to publish")
			}
			s.setProjectPointerStateLocked(PublishPointerState{
				ID:                 project.ID,
				CurrentVersionID:   cloneOptionalString(currentVersionID),
				PublishedVersionID: cloneOptionalString(currentVersionID),
				PublishedAt:        cloneOptionalString(project.PublishedAt),
			})
		} else {
			project.PublishedAt = nil
			state := s.projectPointerStateLocked(project.ID)
			state.PublishedVersionID = nil
			state.PublishedAt = nil
			s.setProjectPointerStateLocked(state)
		}
		if err := s.applyPublishedPointersLocked(); err != nil {
			return ProjectDTO{}, err
		}
		dto := s.toProjectDTO(*project)
		return dto, s.saveLocked()
	}

	return ProjectDTO{}, errNotFound
}

func (s *MongoStore) DeleteProject(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.data.Projects {
		if s.data.Projects[i].ID == id {
			s.data.Projects = append(s.data.Projects[:i], s.data.Projects[i+1:]...)
			s.removeProjectPointerStateLocked(id)
			return s.saveLocked()
		}
	}
	return errNotFound
}

func (s *MongoStore) DeleteProjectWithAssets(id string) ([]string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.data.Projects {
		if s.data.Projects[i].ID == id {
			assetKeys := append([]string(nil), s.data.Projects[i].AssetKeys...)
			s.data.Projects = append(s.data.Projects[:i], s.data.Projects[i+1:]...)
			s.removeProjectPointerStateLocked(id)
			return assetKeys, s.saveLocked()
		}
	}
	return nil, errNotFound
}

func (s *MongoStore) AddPostAsset(id, objectKey string) error {
	_, err := s.UpdatePost(id, func(current *persistedPost) error {
		if objectKey != "" {
			current.AssetKeys = addUnique(current.AssetKeys, objectKey)
		}
		return nil
	})
	return err
}

func (s *MongoStore) AddProjectAsset(id, objectKey string) error {
	_, err := s.UpdateProject(id, func(current *persistedProject) error {
		if objectKey != "" {
			current.AssetKeys = addUnique(current.AssetKeys, objectKey)
		}
		return nil
	})
	return err
}

func (s *MongoStore) ListTags() []TagDTO {
	s.mu.Lock()
	defer s.mu.Unlock()
	tags := make([]TagDTO, 0, len(s.data.Tags))
	for _, tag := range s.data.Tags {
		tags = append(tags, TagDTO{ID: tag.ID, Name: tag.Name, Slug: tag.Slug})
	}
	slices.SortFunc(tags, func(left, right TagDTO) int {
		if left.Name == right.Name {
			return strings.Compare(left.Slug, right.Slug)
		}
		return strings.Compare(left.Name, right.Name)
	})
	return tags
}

func (s *MongoStore) CreateTag(name, slug string) (persistedTag, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	var tag persistedTag
	s.data.Tags, tag = upsertTag(s.data.Tags, name, slug)
	return tag, s.saveLocked()
}

func (s *MongoStore) UpdateTag(id, name, slug string) (persistedTag, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.data.Tags {
		if s.data.Tags[i].ID == id {
			s.data.Tags[i].Name = strings.TrimSpace(name)
			s.data.Tags[i].Slug = strings.TrimSpace(slug)
			return s.data.Tags[i], s.saveLocked()
		}
	}
	return persistedTag{}, errNotFound
}

func (s *MongoStore) DeleteTag(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.data.Tags {
		if s.data.Tags[i].ID == id {
			s.data.Tags = append(s.data.Tags[:i], s.data.Tags[i+1:]...)
			return s.saveLocked()
		}
	}
	return errNotFound
}

func (s *MongoStore) applyPostDocumentLocked(post persistedPost, document contentmd.EditorialPostDocument) persistedPost {
	if strings.TrimSpace(post.ID) == "" && strings.TrimSpace(document.ID) != "" {
		post.ID = strings.TrimSpace(document.ID)
	}
	post.Title = document.Title
	post.Slug = document.Slug
	post.Summary = document.Summary
	post.Content = strings.TrimSpace(document.BodyMarkdown)
	post.CoverImage = cloneOptionalString(document.CoverImage)
	post.PublishedAt = publishedAtFromDocument(document.PublishedAt, "")
	post.EnableComments = document.EnableComments
	post.TagIDs = s.upsertContentTagsLocked(document.Tags)
	return post
}

func (s *MongoStore) applyProjectDocumentLocked(project persistedProject, document contentmd.EditorialProjectDocument) persistedProject {
	if strings.TrimSpace(project.ID) == "" && strings.TrimSpace(document.ID) != "" {
		project.ID = strings.TrimSpace(document.ID)
	}
	project.Title = document.Title
	project.Slug = document.Slug
	project.Summary = document.Summary
	project.Content = strings.TrimSpace(document.BodyMarkdown)
	project.CoverImage = cloneOptionalString(document.CoverImage)
	project.PublishedAt = publishedAtFromDocument(document.PublishedAt, "")
	project.SortOrder = document.SortOrder
	project.TagIDs = s.upsertContentTagsLocked(document.Tags)
	project.Links = normalizePersistedProjectLinks(project.ID, persistedLinksFromContent(document.Links))
	return project
}

func (s *MongoStore) upsertContentTagsLocked(tags []contentmd.Tag) []string {
	tagIDs := make([]string, 0, len(tags))
	for _, tag := range tags {
		name := strings.TrimSpace(tag.Name)
		slug := strings.TrimSpace(tag.Slug)
		if name == "" && slug == "" {
			continue
		}

		existingIndex := -1
		for index := range s.data.Tags {
			switch {
			case strings.TrimSpace(tag.ID) != "" && s.data.Tags[index].ID == strings.TrimSpace(tag.ID):
				existingIndex = index
			case slug != "" && s.data.Tags[index].Slug == slug:
				existingIndex = index
			case slug == "" && name != "" && s.data.Tags[index].Name == name:
				existingIndex = index
			}
			if existingIndex >= 0 {
				break
			}
		}

		if existingIndex >= 0 {
			if name != "" {
				s.data.Tags[existingIndex].Name = name
			}
			if slug != "" {
				s.data.Tags[existingIndex].Slug = slug
			}
			tagIDs = addUnique(tagIDs, s.data.Tags[existingIndex].ID)
			continue
		}

		nextID := strings.TrimSpace(tag.ID)
		if nextID == "" {
			nextID = internalid.NewPersistentID()
		}
		nextName := name
		if nextName == "" {
			nextName = slug
		}
		if nextName == "" || slug == "" {
			continue
		}
		nextTag := persistedTag{
			ID:   nextID,
			Name: nextName,
			Slug: slug,
		}
		s.data.Tags = append(s.data.Tags, nextTag)
		tagIDs = addUnique(tagIDs, nextTag.ID)
	}
	return tagIDs
}

func normalizePersistedProjectLinks(projectID string, links []ProjectLink) []ProjectLink {
	items := make([]ProjectLink, 0, len(links))
	for _, link := range links {
		link.ID = internalid.CanonicalizeSecondaryPersistentID(link.ID)
		items = append(items, link)
	}
	return items
}

func (s *MongoStore) toPostDTO(post persistedPost) PostDTO {
	currentVersionID := s.currentPostVersionIDLocked(post)
	publishedVersionID := s.publishedPostVersionIDLocked(post.ID)
	return PostDTO{
		ID:                 post.ID,
		CreatedAt:          post.CreatedAt,
		UpdatedAt:          post.UpdatedAt,
		Title:              post.Title,
		Slug:               post.Slug,
		Content:            post.Content,
		AuthorID:           post.AuthorID,
		Summary:            post.Summary,
		CoverImage:         post.CoverImage,
		PublishedAt:        post.PublishedAt,
		PublishedVersionID: publishedVersionID,
		CurrentVersionID:   currentVersionID,
		EnableComments:     post.EnableComments,
		Tags:               s.resolveTags(post.TagIDs),
		Author:             AuthorDTO{FullName: displayNameFromProfile(s.data.AdminProfile), AvatarURL: s.data.AdminProfile.AvatarURL},
	}
}

func (s *MongoStore) toPublishedPostDTO(post persistedPost) (PostDTO, bool) {
	dto := s.toPostDTO(post)
	if dto.PublishedVersionID == nil {
		return PostDTO{}, false
	}
	if document, ok := s.loadPublishedPostDocumentLocked(post); ok {
		dto.Title = document.Title
		dto.Slug = document.Slug
		dto.Summary = document.Summary
		dto.Content = document.BodyMarkdown
		dto.CoverImage = cloneOptionalString(document.CoverImage)
		dto.EnableComments = document.EnableComments
		dto.Tags = storeTagsFromContent(document.Tags)
		dto.Author = AuthorDTO{FullName: displayNameFromProfile(s.data.AdminProfile), AvatarURL: s.data.AdminProfile.AvatarURL}
		dto.CurrentVersionID = dto.PublishedVersionID
		return dto, true
	}
	return PostDTO{}, false
}

func (s *MongoStore) toProjectDTO(project persistedProject) ProjectDTO {
	project.Links = normalizePersistedProjectLinks(project.ID, project.Links)
	links := projectLinkDTOs(project.ID, project.Links)
	currentVersionID := s.currentProjectVersionIDLocked(project)
	publishedVersionID := s.publishedProjectVersionIDLocked(project.ID)
	return ProjectDTO{
		ID:                 project.ID,
		CreatedAt:          project.CreatedAt,
		UpdatedAt:          project.UpdatedAt,
		Title:              project.Title,
		Slug:               project.Slug,
		Content:            project.Content,
		OwnerID:            project.OwnerID,
		Summary:            project.Summary,
		CoverImage:         project.CoverImage,
		PublishedAt:        project.PublishedAt,
		PublishedVersionID: publishedVersionID,
		CurrentVersionID:   currentVersionID,
		SortOrder:          project.SortOrder,
		Tags:               s.resolveTags(project.TagIDs),
		Links:              links,
		Owner:              AuthorDTO{FullName: displayNameFromProfile(s.data.AdminProfile), AvatarURL: s.data.AdminProfile.AvatarURL},
	}
}

func (s *MongoStore) toPublishedProjectDTO(project persistedProject) (ProjectDTO, bool) {
	dto := s.toProjectDTO(project)
	if dto.PublishedVersionID == nil {
		return ProjectDTO{}, false
	}
	if document, ok := s.loadPublishedProjectDocumentLocked(project); ok {
		dto.Title = document.Title
		dto.Slug = document.Slug
		dto.Summary = document.Summary
		dto.Content = document.BodyMarkdown
		dto.CoverImage = cloneOptionalString(document.CoverImage)
		dto.SortOrder = document.SortOrder
		dto.Tags = storeTagsFromContent(document.Tags)
		dto.Owner = AuthorDTO{FullName: displayNameFromProfile(s.data.AdminProfile), AvatarURL: s.data.AdminProfile.AvatarURL}
		dto.CurrentVersionID = dto.PublishedVersionID
		dto.Links = storeProjectLinksFromContent(project.ID, document.Links)
		return dto, true
	}
	return ProjectDTO{}, false
}

func projectLinkDTOs(projectID string, links []ProjectLink) []ProjectLinkDTO {
	items := make([]ProjectLinkDTO, 0, len(links))
	for _, link := range links {
		items = append(items, ProjectLinkDTO{
			ID:        link.ID,
			ProjectID: projectID,
			Label:     link.Label,
			URL:       link.URL,
			LinkType:  link.LinkType,
			SortOrder: link.SortOrder,
		})
	}
	return items
}

func storeTagsFromContent(tags []contentmd.Tag) []TagDTO {
	items := make([]TagDTO, 0, len(tags))
	for _, tag := range tags {
		if strings.TrimSpace(tag.ID) == "" {
			continue
		}
		items = append(items, TagDTO{
			ID:   tag.ID,
			Name: tag.Name,
			Slug: tag.Slug,
		})
	}
	return items
}

func storeProjectLinksFromContent(projectID string, links []contentmd.Link) []ProjectLinkDTO {
	items := make([]ProjectLinkDTO, 0, len(links))
	for _, link := range links {
		linkID := internalid.CanonicalizeSecondaryPersistentID(link.ID)
		items = append(items, ProjectLinkDTO{
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

func (s *MongoStore) resolveTags(ids []string) []TagDTO {
	tags := make([]TagDTO, 0, len(ids))
	for _, id := range ids {
		for _, tag := range s.data.Tags {
			if tag.ID == id {
				tags = append(tags, TagDTO{ID: tag.ID, Name: tag.Name, Slug: tag.Slug})
			}
		}
	}
	return tags
}

func lookupPostVersionByID(history *editorial.History, versionID string, postIDs []string) (PostVersionDTO, error) {
	if history == nil {
		return PostVersionDTO{}, errNotFound
	}
	if metadata := editorialCommitMetadata(history, versionID); metadata.Kind == "post" && strings.TrimSpace(metadata.DocumentID) != "" {
		return lookupPostVersionForID(history, metadata.DocumentID, versionID)
	}
	for _, postID := range postIDs {
		version, err := lookupPostVersionForID(history, postID, versionID)
		if err == nil {
			return version, nil
		}
	}
	return PostVersionDTO{}, errNotFound
}

func lookupProjectVersionByID(history *editorial.History, versionID string, projectIDs []string) (ProjectVersionDTO, error) {
	if history == nil {
		return ProjectVersionDTO{}, errNotFound
	}
	if metadata := editorialCommitMetadata(history, versionID); metadata.Kind == "project" && strings.TrimSpace(metadata.DocumentID) != "" {
		return lookupProjectVersionForID(history, metadata.DocumentID, versionID)
	}
	for _, projectID := range projectIDs {
		version, err := lookupProjectVersionForID(history, projectID, versionID)
		if err == nil {
			return version, nil
		}
	}
	return ProjectVersionDTO{}, errNotFound
}

func lookupPostVersionForID(history *editorial.History, postID string, versionID string) (PostVersionDTO, error) {
	entry, index, err := findEntryInHistory(history, postHistoryPath(postID), versionID)
	if err != nil {
		return PostVersionDTO{}, err
	}
	return postVersionDTOFromEntry(postID, entry, index)
}

func lookupProjectVersionForID(history *editorial.History, projectID string, versionID string) (ProjectVersionDTO, error) {
	entry, index, err := findEntryInHistory(history, projectHistoryPath(projectID), versionID)
	if err != nil {
		return ProjectVersionDTO{}, err
	}
	return projectVersionDTOFromEntry(projectID, entry, index)
}

func findEntryInHistory(history *editorial.History, relativePath string, versionID string) (editorial.Entry, int, error) {
	if history == nil {
		return editorial.Entry{}, 0, errNotFound
	}
	entries, err := history.History(context.Background(), relativePath)
	if err != nil {
		return editorial.Entry{}, 0, errNotFound
	}
	for idx, entry := range entries {
		if entry.CommitSHA == versionID {
			return entry, idx, nil
		}
	}
	return editorial.Entry{}, 0, errNotFound
}

func editorialCommitMetadata(history *editorial.History, versionID string) editorial.CommitMetadata {
	if history == nil {
		return editorial.CommitMetadata{}
	}
	body, err := history.CommitBody(context.Background(), versionID)
	if err != nil {
		return editorial.CommitMetadata{}
	}
	return editorial.ParseCommitMetadata(body)
}
