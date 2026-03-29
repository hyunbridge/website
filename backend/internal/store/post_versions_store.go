package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/hyunbridge/website/backend/internal/contentmd"
)

func (s *MongoStore) GetPostVersionState(id string) (VersionStateItemDTO, VersionStateVersionDTO, *VersionStateVersionDTO, error) {
	s.mu.Lock()
	var post persistedPost
	found := false
	history := s.editorialHistory
	for _, candidate := range s.data.Posts {
		if candidate.ID == id {
			post = candidate
			found = true
			break
		}
	}
	s.mu.Unlock()

	if !found {
		return VersionStateItemDTO{}, VersionStateVersionDTO{}, nil, errNotFound
	}

	currentVersionID := s.currentPostVersionIDLocked(post)
	var latestDTO *VersionStateVersionDTO
	if history != nil {
		entries, err := history.History(context.Background(), postHistoryPath(post.ID))
		if err == nil {
			versionEntries := contentVersionEntries(entries)
			if latestEntry, ok := latestHistoryEntry(versionEntries); ok {
				if currentVersionID == nil {
					currentVersionID = &latestEntry.CommitSHA
				}
				latestVersion, dtoErr := postVersionDTOFromEntry(post.ID, latestEntry, len(versionEntries)-1)
				if dtoErr == nil {
					dto := VersionStateVersionDTO{
						ID:                latestVersion.ID,
						VersionNumber:     latestVersion.VersionNumber,
						Title:             latestVersion.Title,
						Summary:           ptrString(latestVersion.Summary),
						BodyMarkdown:      strings.TrimSpace(latestVersion.Content),
						ChangeDescription: latestVersion.ChangeDescription,
					}
					latestDTO = &dto
				}
			}
		}
	}

	item := VersionStateItemDTO{
		ID:                 post.ID,
		Title:              post.Title,
		Summary:            ptrString(post.Summary),
		CurrentVersionID:   currentVersionID,
		PublishedVersionID: s.publishedPostVersionIDLocked(post.ID),
		Status:             ternary(isPublishedAt(post.PublishedAt), "published", "draft"),
	}
	currentDTO := VersionStateVersionDTO{
		ID:                deref(currentVersionID, ""),
		Title:             post.Title,
		Summary:           ptrString(post.Summary),
		BodyMarkdown:      strings.TrimSpace(post.Content),
		ChangeDescription: nil,
	}
	return item, currentDTO, latestDTO, nil
}

func (s *MongoStore) UpdatePostVersion(versionID string, title string, summary string, content string, changeDescription *string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for postIdx := range s.data.Posts {
		if currentVersionID := s.currentPostVersionIDLocked(s.data.Posts[postIdx]); currentVersionID != nil && *currentVersionID == versionID {
			nextVersionID, _, err := s.savePostSnapshotStateLocked(s.data.Posts[postIdx], title, summary, content, s.data.Posts[postIdx].AuthorID, changeDescription)
			if err != nil {
				return "", err
			}
			s.data.Posts[postIdx].Title = title
			s.data.Posts[postIdx].Summary = summary
			s.data.Posts[postIdx].Content = content
			s.data.Posts[postIdx].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			state := s.postPointerStateLocked(s.data.Posts[postIdx].ID)
			state.CurrentVersionID = &nextVersionID
			s.setPostPointerStateLocked(state)
			s.data.Posts[postIdx].DraftDirty = false
			return nextVersionID, s.saveLocked()
		}
	}
	return "", errNotFound
}

func (s *MongoStore) CreatePostVersion(postID string, title string, summary string, content string, actorID string, changeDescription *string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for postIdx := range s.data.Posts {
		if s.data.Posts[postIdx].ID != postID {
			continue
		}
		versionID, _, err := s.savePostSnapshotStateLocked(s.data.Posts[postIdx], title, summary, content, actorID, changeDescription)
		if err != nil {
			return "", err
		}
		s.data.Posts[postIdx].Title = title
		s.data.Posts[postIdx].Summary = summary
		s.data.Posts[postIdx].Content = content
		s.data.Posts[postIdx].AuthorID = strings.TrimSpace(actorID)
		s.data.Posts[postIdx].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		state := s.postPointerStateLocked(s.data.Posts[postIdx].ID)
		state.CurrentVersionID = &versionID
		s.setPostPointerStateLocked(state)
		s.data.Posts[postIdx].DraftDirty = false
		return versionID, s.saveLocked()
	}
	return "", errNotFound
}

func (s *MongoStore) SetPostCurrentVersion(postID, versionID, title, summary string) error {
	s.mu.Lock()
	history := s.editorialHistory
	found := false
	for _, post := range s.data.Posts {
		if post.ID == postID {
			found = true
			break
		}
	}
	s.mu.Unlock()

	_ = title
	_ = summary
	if !found || history == nil {
		return errNotFound
	}

	entry, err := history.Get(context.Background(), postHistoryPath(postID), versionID)
	if err != nil {
		return errNotFound
	}
	document, err := contentmd.ParseEditorialPostDocument(entry.Content)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for postIdx := range s.data.Posts {
		post := &s.data.Posts[postIdx]
		if post.ID != postID {
			continue
		}
		applied := s.applyPostDocumentLocked(*post, document)
		now := time.Now().UTC().Format(time.RFC3339)
		applied.UpdatedAt = now
		applied.DraftDirty = false
		*post = applied
		state := s.postPointerStateLocked(postID)
		state.CurrentVersionID = ptrString(versionID)
		s.setPostPointerStateLocked(state)
		return s.saveLocked()
	}
	return errNotFound
}

func (s *MongoStore) ListPostVersions(postID string) ([]PostVersionDTO, error) {
	s.mu.Lock()
	exists := false
	history := s.editorialHistory
	for _, post := range s.data.Posts {
		if post.ID == postID {
			exists = true
			break
		}
	}
	s.mu.Unlock()

	if !exists {
		return nil, errNotFound
	}
	if history == nil {
		return []PostVersionDTO{}, nil
	}

	entries, err := history.History(context.Background(), postHistoryPath(postID))
	if err != nil {
		return []PostVersionDTO{}, nil
	}
	versionEntries := contentVersionEntries(entries)
	versions := make([]PostVersionDTO, 0, len(versionEntries))
	for idx, entry := range versionEntries {
		version, dtoErr := postVersionDTOFromEntry(postID, entry, idx)
		if dtoErr != nil {
			return nil, dtoErr
		}
		versions = append(versions, version)
	}
	return versions, nil
}

func (s *MongoStore) GetPostVersionByID(versionID string) (PostVersionDTO, error) {
	s.mu.Lock()
	history := s.editorialHistory
	postIDs := make([]string, 0, len(s.data.Posts))
	for _, post := range s.data.Posts {
		postIDs = append(postIDs, post.ID)
	}
	s.mu.Unlock()

	return lookupPostVersionByID(history, versionID, postIDs)
}

func (s *MongoStore) GetPublishedPostVersionByID(versionID string) (PostVersionDTO, error) {
	s.mu.Lock()
	history := s.editorialHistory
	postID, ok := s.findPublishedPostIDLocked(versionID)
	s.mu.Unlock()

	if !ok {
		return PostVersionDTO{}, errNotFound
	}
	return lookupPostVersionForID(history, postID, versionID)
}

func (s *MongoStore) RestorePostVersion(postID string, versionNumber int, userID string) error {
	s.mu.Lock()
	history := s.editorialHistory
	exists := false
	for _, post := range s.data.Posts {
		if post.ID == postID {
			exists = true
			break
		}
	}
	s.mu.Unlock()

	_ = userID
	if !exists {
		return errNotFound
	}
	if history == nil {
		return errNotFound
	}

	entries, err := history.History(context.Background(), postHistoryPath(postID))
	if err != nil {
		return errNotFound
	}
	versionEntries := contentVersionEntries(entries)
	if versionNumber <= 0 || versionNumber > len(versionEntries) {
		return errNotFound
	}
	entry := versionEntries[versionNumber-1]
	document, err := contentmd.ParseEditorialPostDocument(entry.Content)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for postIdx := range s.data.Posts {
		post := &s.data.Posts[postIdx]
		if post.ID != postID {
			continue
		}
		applied := s.applyPostDocumentLocked(*post, document)
		nextVersionID, _, err := s.savePostSnapshotStateLocked(applied, applied.Title, applied.Summary, applied.Content, userID, ptrString(fmt.Sprintf("restore post version %d", versionNumber)))
		if err != nil {
			return err
		}
		now := time.Now().UTC().Format(time.RFC3339)
		applied.UpdatedAt = now
		applied.DraftDirty = false
		*post = applied
		state := s.postPointerStateLocked(postID)
		state.CurrentVersionID = &nextVersionID
		s.setPostPointerStateLocked(state)
		return s.saveLocked()
	}
	return errNotFound
}
