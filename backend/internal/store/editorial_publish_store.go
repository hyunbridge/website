package store

import (
	"context"
	"errors"
	"strings"
)

func (s *MongoStore) applyPublishedPointersLocked() error {
	if s.editorialHistory == nil {
		return errors.New("content repository is not configured")
	}

	if err := s.syncPublishedRefsLocked(); err != nil {
		return err
	}
	return nil
}

func (s *MongoStore) syncPublishedRefsLocked() error {
	if s.editorialHistory == nil || s.editorialHistory.Repository() == nil {
		return errors.New("content repository is not configured")
	}
	repo := s.editorialHistory.Repository()
	ctx := context.Background()
	s.ensurePointerProjectionLocked()

	for _, post := range s.data.Posts {
		state := s.postPointerStateLocked(post.ID)
		refName := postLiveRef(post.ID)
		if state.PublishedVersionID == nil || strings.TrimSpace(deref(state.PublishedAt, "")) == "" {
			if err := repo.DeleteReference(ctx, refName); err != nil {
				return err
			}
			continue
		}
		if err := repo.UpdateReference(ctx, refName, *state.PublishedVersionID); err != nil {
			return err
		}
	}
	for _, project := range s.data.Projects {
		state := s.projectPointerStateLocked(project.ID)
		refName := projectLiveRef(project.ID)
		if state.PublishedVersionID == nil || strings.TrimSpace(deref(state.PublishedAt, "")) == "" {
			if err := repo.DeleteReference(ctx, refName); err != nil {
				return err
			}
			continue
		}
		if err := repo.UpdateReference(ctx, refName, *state.PublishedVersionID); err != nil {
			return err
		}
	}
	homeState := s.homePointerStateLocked()
	if homeState.PublishedVersionID == nil || strings.TrimSpace(deref(homeState.PublishedAt, "")) == "" {
		return repo.DeleteReference(ctx, homeLiveRef())
	}
	return repo.UpdateReference(ctx, homeLiveRef(), *homeState.PublishedVersionID)
}
