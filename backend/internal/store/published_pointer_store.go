package store

import (
	"context"
)

func (s *MongoStore) SyncPublishedContentPointers() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, post := range s.data.Posts {
		state := s.postPointerStateLocked(post.ID)
		state.ID = post.ID
		state.PublishedAt = cloneOptionalString(post.PublishedAt)
		if isPublishedAt(post.PublishedAt) {
			if state.CurrentVersionID == nil {
				state.CurrentVersionID = s.latestPostVersionIDLocked(post.ID)
			}
			state.PublishedVersionID = cloneOptionalString(state.CurrentVersionID)
			if state.PublishedVersionID == nil {
				state.PublishedAt = nil
				s.data.Posts = updatePostPublishedAt(s.data.Posts, post.ID, nil)
			}
		} else {
			state.PublishedVersionID = nil
			state.PublishedAt = nil
		}
		s.setPostPointerStateLocked(state)
	}

	for _, project := range s.data.Projects {
		state := s.projectPointerStateLocked(project.ID)
		state.ID = project.ID
		state.PublishedAt = cloneOptionalString(project.PublishedAt)
		if isPublishedAt(project.PublishedAt) {
			if state.CurrentVersionID == nil {
				state.CurrentVersionID = s.latestProjectVersionIDLocked(project.ID)
			}
			state.PublishedVersionID = cloneOptionalString(state.CurrentVersionID)
			if state.PublishedVersionID == nil {
				state.PublishedAt = nil
				s.data.Projects = updateProjectPublishedAt(s.data.Projects, project.ID, nil)
			}
		} else {
			state.PublishedVersionID = nil
			state.PublishedAt = nil
		}
		s.setProjectPointerStateLocked(state)
	}

	homeState := s.homePointerStateLocked()
	homeState.ID = s.data.Home.ID
	homeState.PublishedAt = cloneOptionalString(s.data.Home.PublishedAt)
	if isPublishedAt(s.data.Home.PublishedAt) {
		if homeState.CurrentVersionID == nil {
			homeState.CurrentVersionID = s.latestHomeVersionIDLocked()
		}
		homeState.PublishedVersionID = cloneOptionalString(homeState.CurrentVersionID)
		if homeState.PublishedVersionID == nil {
			homeState.PublishedAt = nil
			s.data.Home.PublishedAt = nil
		}
	} else {
		homeState.PublishedVersionID = nil
		homeState.PublishedAt = nil
	}
	s.setHomePointerStateLocked(homeState)

	if err := s.applyPublishedPointersLocked(); err != nil {
		return err
	}

	return s.saveLocked()
}

func (s *MongoStore) CapturePublishedPointerSnapshot() PublishPointerSnapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ensurePointerProjectionLocked()

	snapshot := PublishPointerSnapshot{
		Posts:    make([]PublishPointerState, 0, len(s.pointers.Posts)),
		Projects: make([]PublishPointerState, 0, len(s.pointers.Projects)),
		Home:     clonePublishPointerState(s.pointers.Home),
	}

	for _, state := range s.pointers.Posts {
		snapshot.Posts = append(snapshot.Posts, clonePublishPointerState(state))
	}
	for _, state := range s.pointers.Projects {
		snapshot.Projects = append(snapshot.Projects, clonePublishPointerState(state))
	}

	return snapshot
}

func (s *MongoStore) RestorePublishedPointerSnapshot(snapshot PublishPointerSnapshot) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.pointers = PublishPointerSnapshot{
		Posts:    make([]PublishPointerState, 0, len(snapshot.Posts)),
		Projects: make([]PublishPointerState, 0, len(snapshot.Projects)),
		Home:     clonePublishPointerState(snapshot.Home),
	}
	for _, state := range snapshot.Posts {
		s.pointers.Posts = append(s.pointers.Posts, clonePublishPointerState(state))
	}
	for _, state := range snapshot.Projects {
		s.pointers.Projects = append(s.pointers.Projects, clonePublishPointerState(state))
	}
	s.ensurePointerProjectionLocked()

	for idx := range s.data.Posts {
		state := s.postPointerStateLocked(s.data.Posts[idx].ID)
		s.data.Posts[idx].PublishedAt = cloneOptionalString(state.PublishedAt)
	}
	for idx := range s.data.Projects {
		state := s.projectPointerStateLocked(s.data.Projects[idx].ID)
		s.data.Projects[idx].PublishedAt = cloneOptionalString(state.PublishedAt)
	}
	s.data.Home.PublishedAt = cloneOptionalString(s.homePointerStateLocked().PublishedAt)

	if err := s.applyPublishedPointersLocked(); err != nil {
		return err
	}

	return s.saveLocked()
}

func (s *MongoStore) latestPostVersionIDLocked(postID string) *string {
	if s.editorialHistory == nil {
		return nil
	}
	entries, err := s.editorialHistory.History(context.Background(), postHistoryPath(postID))
	if err != nil || len(entries) == 0 {
		return nil
	}
	latest := entries[len(entries)-1].CommitSHA
	return &latest
}

func (s *MongoStore) latestProjectVersionIDLocked(projectID string) *string {
	if s.editorialHistory == nil {
		return nil
	}
	entries, err := s.editorialHistory.History(context.Background(), projectHistoryPath(projectID))
	if err != nil || len(entries) == 0 {
		return nil
	}
	latest := entries[len(entries)-1].CommitSHA
	return &latest
}

func (s *MongoStore) latestHomeVersionIDLocked() *string {
	if s.editorialHistory == nil {
		return nil
	}
	entries, err := s.editorialHistory.History(context.Background(), homeHistoryPath())
	if err != nil || len(entries) == 0 {
		return nil
	}
	latest := entries[len(entries)-1].CommitSHA
	return &latest
}

func (s *MongoStore) findPublishedPostIDLocked(versionID string) (string, bool) {
	for _, state := range s.pointers.Posts {
		if state.PublishedVersionID != nil && *state.PublishedVersionID == versionID {
			return state.ID, true
		}
	}
	return "", false
}

func (s *MongoStore) findPublishedProjectIDLocked(versionID string) (string, bool) {
	for _, state := range s.pointers.Projects {
		if state.PublishedVersionID != nil && *state.PublishedVersionID == versionID {
			return state.ID, true
		}
	}
	return "", false
}

func updatePostPublishedAt(posts []persistedPost, postID string, publishedAt *string) []persistedPost {
	for idx := range posts {
		if posts[idx].ID == postID {
			posts[idx].PublishedAt = cloneOptionalString(publishedAt)
			break
		}
	}
	return posts
}

func updateProjectPublishedAt(projects []persistedProject, projectID string, publishedAt *string) []persistedProject {
	for idx := range projects {
		if projects[idx].ID == projectID {
			projects[idx].PublishedAt = cloneOptionalString(publishedAt)
			break
		}
	}
	return projects
}
