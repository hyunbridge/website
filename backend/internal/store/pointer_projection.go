package store

import "strings"

func sanitizePersistedDataForStorage(data persistedData) persistedData {
	copied := data

	copied.Posts = append([]persistedPost(nil), data.Posts...)
	for idx := range copied.Posts {
		copied.Posts[idx].CurrentVersionID = nil
		copied.Posts[idx].PublishedVersionID = nil
	}

	copied.Projects = append([]persistedProject(nil), data.Projects...)
	for idx := range copied.Projects {
		copied.Projects[idx].CurrentVersionID = nil
		copied.Projects[idx].PublishedVersionID = nil
	}

	copied.Home = data.Home
	copied.Home.CurrentVersionID = nil
	copied.Home.PublishedVersionID = nil

	return copied
}

func (s *MongoStore) ensurePointerProjectionLocked() {
	if s.pointers.Home.ID == "" {
		s.pointers.Home.ID = s.data.Home.ID
	}
}

func (s *MongoStore) postPointerStateLocked(postID string) PublishPointerState {
	s.ensurePointerProjectionLocked()
	for _, state := range s.pointers.Posts {
		if state.ID == postID {
			return state
		}
	}
	return PublishPointerState{ID: postID}
}

func (s *MongoStore) projectPointerStateLocked(projectID string) PublishPointerState {
	s.ensurePointerProjectionLocked()
	for _, state := range s.pointers.Projects {
		if state.ID == projectID {
			return state
		}
	}
	return PublishPointerState{ID: projectID}
}

func (s *MongoStore) homePointerStateLocked() PublishPointerState {
	s.ensurePointerProjectionLocked()
	return s.pointers.Home
}

func (s *MongoStore) setPostPointerStateLocked(state PublishPointerState) {
	s.ensurePointerProjectionLocked()
	for idx := range s.pointers.Posts {
		if s.pointers.Posts[idx].ID == state.ID {
			s.pointers.Posts[idx] = clonePublishPointerState(state)
			return
		}
	}
	s.pointers.Posts = append(s.pointers.Posts, clonePublishPointerState(state))
}

func (s *MongoStore) setProjectPointerStateLocked(state PublishPointerState) {
	s.ensurePointerProjectionLocked()
	for idx := range s.pointers.Projects {
		if s.pointers.Projects[idx].ID == state.ID {
			s.pointers.Projects[idx] = clonePublishPointerState(state)
			return
		}
	}
	s.pointers.Projects = append(s.pointers.Projects, clonePublishPointerState(state))
}

func (s *MongoStore) removePostPointerStateLocked(postID string) {
	for idx := range s.pointers.Posts {
		if s.pointers.Posts[idx].ID != postID {
			continue
		}
		s.pointers.Posts = append(s.pointers.Posts[:idx], s.pointers.Posts[idx+1:]...)
		return
	}
}

func (s *MongoStore) removeProjectPointerStateLocked(projectID string) {
	for idx := range s.pointers.Projects {
		if s.pointers.Projects[idx].ID != projectID {
			continue
		}
		s.pointers.Projects = append(s.pointers.Projects[:idx], s.pointers.Projects[idx+1:]...)
		return
	}
}

func (s *MongoStore) setHomePointerStateLocked(state PublishPointerState) {
	s.ensurePointerProjectionLocked()
	s.pointers.Home = clonePublishPointerState(state)
	if s.pointers.Home.ID == "" {
		s.pointers.Home.ID = s.data.Home.ID
	}
}

func (s *MongoStore) currentPostVersionIDLocked(post persistedPost) *string {
	state := s.postPointerStateLocked(post.ID)
	if strings.TrimSpace(deref(state.CurrentVersionID, "")) != "" {
		return cloneOptionalString(state.CurrentVersionID)
	}
	return nil
}

func (s *MongoStore) publishedPostVersionIDLocked(postID string) *string {
	state := s.postPointerStateLocked(postID)
	if strings.TrimSpace(deref(state.PublishedVersionID, "")) == "" {
		return nil
	}
	return cloneOptionalString(state.PublishedVersionID)
}

func (s *MongoStore) currentProjectVersionIDLocked(project persistedProject) *string {
	state := s.projectPointerStateLocked(project.ID)
	if strings.TrimSpace(deref(state.CurrentVersionID, "")) != "" {
		return cloneOptionalString(state.CurrentVersionID)
	}
	return nil
}

func (s *MongoStore) publishedProjectVersionIDLocked(projectID string) *string {
	state := s.projectPointerStateLocked(projectID)
	if strings.TrimSpace(deref(state.PublishedVersionID, "")) == "" {
		return nil
	}
	return cloneOptionalString(state.PublishedVersionID)
}

func (s *MongoStore) currentHomeVersionIDLocked() *string {
	state := s.homePointerStateLocked()
	if strings.TrimSpace(deref(state.CurrentVersionID, "")) == "" {
		return nil
	}
	return cloneOptionalString(state.CurrentVersionID)
}

func (s *MongoStore) publishedHomeVersionIDLocked() *string {
	state := s.homePointerStateLocked()
	if strings.TrimSpace(deref(state.PublishedVersionID, "")) == "" {
		return nil
	}
	return cloneOptionalString(state.PublishedVersionID)
}

func clonePublishPointerState(state PublishPointerState) PublishPointerState {
	return PublishPointerState{
		ID:                 state.ID,
		CurrentVersionID:   cloneOptionalString(state.CurrentVersionID),
		PublishedVersionID: cloneOptionalString(state.PublishedVersionID),
		PublishedAt:        cloneOptionalString(state.PublishedAt),
	}
}
