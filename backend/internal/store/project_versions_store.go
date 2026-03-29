package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/hyunbridge/website/backend/internal/contentmd"
)

func (s *MongoStore) GetProjectVersionState(id string) (VersionStateItemDTO, VersionStateVersionDTO, *VersionStateVersionDTO, error) {
	s.mu.Lock()
	var project persistedProject
	found := false
	history := s.editorialHistory
	for _, candidate := range s.data.Projects {
		if candidate.ID == id {
			project = candidate
			found = true
			break
		}
	}
	s.mu.Unlock()

	if !found {
		return VersionStateItemDTO{}, VersionStateVersionDTO{}, nil, errNotFound
	}

	currentVersionID := s.currentProjectVersionIDLocked(project)
	var latestDTO *VersionStateVersionDTO
	if history != nil {
		entries, err := history.History(context.Background(), projectHistoryPath(project.ID))
		if err == nil {
			versionEntries := contentVersionEntries(entries)
			if latestEntry, ok := latestHistoryEntry(versionEntries); ok {
				if currentVersionID == nil {
					currentVersionID = &latestEntry.CommitSHA
				}
				latestVersion, dtoErr := projectVersionDTOFromEntry(project.ID, latestEntry, len(versionEntries)-1)
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
		ID:                 project.ID,
		Title:              project.Title,
		Summary:            ptrString(project.Summary),
		CurrentVersionID:   currentVersionID,
		PublishedVersionID: s.publishedProjectVersionIDLocked(project.ID),
		Status:             ternary(isPublishedAt(project.PublishedAt), "published", "draft"),
	}
	currentDTO := VersionStateVersionDTO{
		ID:                deref(currentVersionID, ""),
		Title:             project.Title,
		Summary:           ptrString(project.Summary),
		BodyMarkdown:      strings.TrimSpace(project.Content),
		ChangeDescription: nil,
	}
	return item, currentDTO, latestDTO, nil
}

func (s *MongoStore) UpdateProjectVersion(versionID string, title string, summary string, content string, links []ProjectLinkDTO, changeDescription *string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for projectIdx := range s.data.Projects {
		if currentVersionID := s.currentProjectVersionIDLocked(s.data.Projects[projectIdx]); currentVersionID != nil && *currentVersionID == versionID {
			nextLinks := normalizePersistedProjectLinks(s.data.Projects[projectIdx].ID, toPersistedLinks(links))
			nextVersionID, _, err := s.saveProjectSnapshotStateLocked(s.data.Projects[projectIdx], title, summary, content, nextLinks, s.data.Projects[projectIdx].OwnerID, changeDescription)
			if err != nil {
				return "", err
			}
			s.data.Projects[projectIdx].Title = title
			s.data.Projects[projectIdx].Summary = summary
			s.data.Projects[projectIdx].Content = content
			s.data.Projects[projectIdx].Links = nextLinks
			s.data.Projects[projectIdx].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
			state := s.projectPointerStateLocked(s.data.Projects[projectIdx].ID)
			state.CurrentVersionID = &nextVersionID
			s.setProjectPointerStateLocked(state)
			s.data.Projects[projectIdx].DraftDirty = false
			return nextVersionID, s.saveLocked()
		}
	}
	return "", errNotFound
}

func (s *MongoStore) CreateProjectVersion(projectID string, title string, summary string, content string, links []ProjectLinkDTO, actorID string, changeDescription *string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for projectIdx := range s.data.Projects {
		if s.data.Projects[projectIdx].ID != projectID {
			continue
		}
		nextLinks := normalizePersistedProjectLinks(s.data.Projects[projectIdx].ID, toPersistedLinks(links))
		versionID, _, err := s.saveProjectSnapshotStateLocked(s.data.Projects[projectIdx], title, summary, content, nextLinks, actorID, changeDescription)
		if err != nil {
			return "", err
		}
		s.data.Projects[projectIdx].Title = title
		s.data.Projects[projectIdx].Summary = summary
		s.data.Projects[projectIdx].Content = content
		s.data.Projects[projectIdx].Links = nextLinks
		s.data.Projects[projectIdx].OwnerID = strings.TrimSpace(actorID)
		s.data.Projects[projectIdx].UpdatedAt = time.Now().UTC().Format(time.RFC3339)
		state := s.projectPointerStateLocked(s.data.Projects[projectIdx].ID)
		state.CurrentVersionID = &versionID
		s.setProjectPointerStateLocked(state)
		s.data.Projects[projectIdx].DraftDirty = false
		return versionID, s.saveLocked()
	}
	return "", errNotFound
}

func (s *MongoStore) SetProjectCurrentVersion(projectID, versionID, title, summary string) error {
	s.mu.Lock()
	history := s.editorialHistory
	found := false
	for _, project := range s.data.Projects {
		if project.ID == projectID {
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

	entry, err := history.Get(context.Background(), projectHistoryPath(projectID), versionID)
	if err != nil {
		return errNotFound
	}
	document, err := contentmd.ParseEditorialProjectDocument(entry.Content)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for projectIdx := range s.data.Projects {
		project := &s.data.Projects[projectIdx]
		if project.ID != projectID {
			continue
		}
		applied := s.applyProjectDocumentLocked(*project, document)
		now := time.Now().UTC().Format(time.RFC3339)
		applied.UpdatedAt = now
		applied.DraftDirty = false
		*project = applied
		state := s.projectPointerStateLocked(projectID)
		state.CurrentVersionID = ptrString(versionID)
		s.setProjectPointerStateLocked(state)
		return s.saveLocked()
	}
	return errNotFound
}

func (s *MongoStore) ListProjectVersions(projectID string) ([]ProjectVersionDTO, error) {
	s.mu.Lock()
	exists := false
	history := s.editorialHistory
	for _, project := range s.data.Projects {
		if project.ID == projectID {
			exists = true
			break
		}
	}
	s.mu.Unlock()

	if !exists {
		return nil, errNotFound
	}
	if history == nil {
		return []ProjectVersionDTO{}, nil
	}

	entries, err := history.History(context.Background(), projectHistoryPath(projectID))
	if err != nil {
		return []ProjectVersionDTO{}, nil
	}
	versionEntries := contentVersionEntries(entries)
	versions := make([]ProjectVersionDTO, 0, len(versionEntries))
	for idx, entry := range versionEntries {
		version, dtoErr := projectVersionDTOFromEntry(projectID, entry, idx)
		if dtoErr != nil {
			return nil, dtoErr
		}
		versions = append(versions, version)
	}
	return versions, nil
}

func (s *MongoStore) GetProjectVersionByID(versionID string) (ProjectVersionDTO, error) {
	s.mu.Lock()
	history := s.editorialHistory
	projectIDs := make([]string, 0, len(s.data.Projects))
	for _, project := range s.data.Projects {
		projectIDs = append(projectIDs, project.ID)
	}
	s.mu.Unlock()

	return lookupProjectVersionByID(history, versionID, projectIDs)
}

func (s *MongoStore) GetPublishedProjectVersionByID(versionID string) (ProjectVersionDTO, error) {
	s.mu.Lock()
	history := s.editorialHistory
	projectID, ok := s.findPublishedProjectIDLocked(versionID)
	s.mu.Unlock()

	if !ok {
		return ProjectVersionDTO{}, errNotFound
	}
	return lookupProjectVersionForID(history, projectID, versionID)
}

func (s *MongoStore) RestoreProjectVersion(projectID string, versionNumber int, userID string) error {
	s.mu.Lock()
	history := s.editorialHistory
	exists := false
	for _, project := range s.data.Projects {
		if project.ID == projectID {
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

	entries, err := history.History(context.Background(), projectHistoryPath(projectID))
	if err != nil {
		return errNotFound
	}
	versionEntries := contentVersionEntries(entries)
	if versionNumber <= 0 || versionNumber > len(versionEntries) {
		return errNotFound
	}
	entry := versionEntries[versionNumber-1]
	document, err := contentmd.ParseEditorialProjectDocument(entry.Content)
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	for projectIdx := range s.data.Projects {
		project := &s.data.Projects[projectIdx]
		if project.ID != projectID {
			continue
		}
		applied := s.applyProjectDocumentLocked(*project, document)
		nextVersionID, _, err := s.saveProjectSnapshotStateLocked(applied, applied.Title, applied.Summary, applied.Content, applied.Links, userID, ptrString(fmt.Sprintf("restore project version %d", versionNumber)))
		if err != nil {
			return err
		}
		now := time.Now().UTC().Format(time.RFC3339)
		applied.UpdatedAt = now
		applied.DraftDirty = false
		*project = applied
		state := s.projectPointerStateLocked(projectID)
		state.CurrentVersionID = &nextVersionID
		s.setProjectPointerStateLocked(state)
		return s.saveLocked()
	}
	return errNotFound
}
