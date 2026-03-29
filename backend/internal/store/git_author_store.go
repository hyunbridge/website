package store

import (
	"context"
	"strings"
	"time"

	"github.com/hyunbridge/website/backend/internal/gitrepo"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
)

func normalizeGitAuthorValue(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func (s *MongoStore) gitAuthorIdentityLocked(actorID string) *gitrepo.AuthorIdentity {
	profile, ok := s.profileByIDLocked(actorID)
	if !ok {
		profile = s.data.AdminProfile
	}

	name := strings.TrimSpace(defaultGitAuthorName(profile))
	email := strings.TrimSpace(defaultGitAuthorEmail(profile))
	if name == "" && email == "" {
		return nil
	}
	return &gitrepo.AuthorIdentity{
		Name:  name,
		Email: email,
	}
}

func (s *MongoStore) resolveActorIDForGitAuthorLocked(authorName string, authorEmail string) string {
	profile, ok := s.profileByGitAuthorLocked(authorName, authorEmail)
	if !ok {
		return ""
	}
	return strings.TrimSpace(profile.ID)
}

func (s *MongoStore) ResolveAdminProfileByGitAuthor(authorName string, authorEmail string) (AdminProfile, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()

	profile, ok := s.profileByGitAuthorLocked(authorName, authorEmail)
	if !ok {
		return AdminProfile{}, false
	}
	return mapPersistedAdminProfile(profile), true
}

func (s *MongoStore) profileByIDLocked(userID string) (persistedAdminProfile, bool) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return persistedAdminProfile{}, false
	}
	if s.data.AdminProfile.ID == userID {
		return s.data.AdminProfile, true
	}
	if s.backend == nil || s.backend.database == nil {
		return persistedAdminProfile{}, false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var profile persistedAdminProfile
	err := s.backend.database.Collection(mongoCollectionUsers).FindOne(ctx, bson.M{"_id": userID}).Decode(&profile)
	if err != nil {
		return persistedAdminProfile{}, false
	}
	return profile, true
}

func (s *MongoStore) profileByGitAuthorLocked(authorName string, authorEmail string) (persistedAdminProfile, bool) {
	authorName = strings.TrimSpace(authorName)
	authorEmail = strings.TrimSpace(authorEmail)

	if gitAuthorMatchesProfile(s.data.AdminProfile, authorName, authorEmail) {
		return s.data.AdminProfile, true
	}
	if s.backend == nil || s.backend.database == nil {
		return persistedAdminProfile{}, false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filters := make([]bson.M, 0, 4)
	if authorEmail != "" {
		filters = append(filters,
			bson.M{"git_author_email": authorEmail},
			bson.M{"email": authorEmail},
		)
	}
	if authorName != "" {
		filters = append(filters,
			bson.M{"git_author_name": authorName},
			bson.M{"full_name": authorName},
			bson.M{"username": authorName},
		)
	}
	if len(filters) == 0 {
		return persistedAdminProfile{}, false
	}

	var profile persistedAdminProfile
	err := s.backend.database.Collection(mongoCollectionUsers).FindOne(ctx, bson.M{"$or": filters}).Decode(&profile)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return persistedAdminProfile{}, false
		}
		return persistedAdminProfile{}, false
	}
	return profile, true
}

func gitAuthorMatchesProfile(profile persistedAdminProfile, authorName string, authorEmail string) bool {
	authorName = strings.TrimSpace(authorName)
	authorEmail = strings.TrimSpace(authorEmail)

	if authorEmail != "" {
		if strings.EqualFold(authorEmail, defaultGitAuthorEmail(profile)) || strings.EqualFold(authorEmail, strings.TrimSpace(profile.Email)) {
			return true
		}
	}
	if authorName != "" {
		fullName := ""
		if profile.FullName != nil {
			fullName = strings.TrimSpace(*profile.FullName)
		}
		return authorName == defaultGitAuthorName(profile) ||
			authorName == fullName ||
			authorName == strings.TrimSpace(profile.Username)
	}
	return false
}
