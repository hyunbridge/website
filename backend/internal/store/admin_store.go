package store

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	internalid "github.com/hyunbridge/website/backend/internal/id"
	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
	"golang.org/x/crypto/argon2"
)

func displayNameFromProfile(profile persistedAdminProfile) string {
	if profile.FullName != nil && strings.TrimSpace(*profile.FullName) != "" {
		return strings.TrimSpace(*profile.FullName)
	}
	if strings.TrimSpace(profile.Username) != "" {
		return strings.TrimSpace(profile.Username)
	}
	return "admin"
}

func defaultGitAuthorName(profile persistedAdminProfile) string {
	if profile.GitAuthorName != nil && strings.TrimSpace(*profile.GitAuthorName) != "" {
		return strings.TrimSpace(*profile.GitAuthorName)
	}
	return displayNameFromProfile(profile)
}

func defaultGitAuthorEmail(profile persistedAdminProfile) string {
	if profile.GitAuthorEmail != nil && strings.TrimSpace(*profile.GitAuthorEmail) != "" {
		return strings.TrimSpace(*profile.GitAuthorEmail)
	}
	return strings.TrimSpace(profile.Email)
}

func looksLikeEmail(value string) bool {
	return strings.Contains(strings.TrimSpace(value), "@")
}

func rewriteActorReferences(data *persistedData, previousIDs []string, nextID string) {
	if data == nil || len(previousIDs) == 0 || strings.TrimSpace(nextID) == "" {
		return
	}

	previous := make(map[string]struct{}, len(previousIDs))
	for _, id := range previousIDs {
		id = strings.TrimSpace(id)
		if id != "" {
			previous[id] = struct{}{}
		}
	}
	if len(previous) == 0 {
		return
	}

	if _, ok := previous[strings.TrimSpace(data.Home.OwnerID)]; ok {
		data.Home.OwnerID = nextID
	}
	for idx := range data.Posts {
		if _, ok := previous[strings.TrimSpace(data.Posts[idx].AuthorID)]; ok {
			data.Posts[idx].AuthorID = nextID
		}
	}
	for idx := range data.Projects {
		if _, ok := previous[strings.TrimSpace(data.Projects[idx].OwnerID)]; ok {
			data.Projects[idx].OwnerID = nextID
		}
	}
}

func (s *MongoStore) GetAdminProfile() AdminProfile {
	s.mu.Lock()
	defer s.mu.Unlock()
	return mapPersistedAdminProfile(s.data.AdminProfile)
}

func (s *MongoStore) AuthenticateAdmin(email, password string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.data.AdminProfile.Email == email && compareAdminPassword(s.data.AdminProfile.Password, password)
}

func (s *MongoStore) UpdateAdminProfile(fullName *string, avatarURL *string, gitAuthorName *string, gitAuthorEmail *string) (AdminProfile, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.data.AdminProfile.FullName = fullName
	s.data.AdminProfile.AvatarURL = avatarURL
	s.data.AdminProfile.GitAuthorName = trimOptionalString(gitAuthorName)
	s.data.AdminProfile.GitAuthorEmail = trimOptionalString(gitAuthorEmail)
	if err := s.saveLocked(); err != nil {
		return AdminProfile{}, err
	}
	return mapPersistedAdminProfile(s.data.AdminProfile), nil
}

func (s *MongoStore) UpdateAdminPassword(currentPassword, nextPassword string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !compareAdminPassword(s.data.AdminProfile.Password, currentPassword) {
		return ErrInvalidPassword()
	}
	hashedPassword, err := hashAdminPassword(nextPassword)
	if err != nil {
		return err
	}
	s.data.AdminProfile.Password = hashedPassword
	return s.saveLocked()
}

func (s *MongoStore) normalizeAdminProfileLocked() (bool, error) {
	changed := false

	if s.data.AdminProfile.Email == "" {
		if strings.TrimSpace(s.bootstrapAdminEmail) == "" {
			return false, ErrBootstrapRequired()
		}
		s.data.AdminProfile.Email = strings.TrimSpace(s.bootstrapAdminEmail)
		changed = true
	}
	if s.data.AdminProfile.Username == "" {
		s.data.AdminProfile.Username = "admin"
		changed = true
	} else if looksLikeEmail(s.data.AdminProfile.Username) {
		s.data.AdminProfile.Username = "admin"
		changed = true
	}
	if s.data.AdminProfile.ID == "" || looksLikeEmail(s.data.AdminProfile.ID) {
		previousIDs := []string{s.data.AdminProfile.ID, s.data.AdminProfile.Email}
		s.data.AdminProfile.ID = internalid.NewPersistentID()
		rewriteActorReferences(&s.data, previousIDs, s.data.AdminProfile.ID)
		changed = true
	}

	password := s.data.AdminProfile.Password
	if password == "" {
		if strings.TrimSpace(s.bootstrapAdminPassword) == "" {
			return false, ErrBootstrapRequired()
		}
		hashedPassword, err := hashAdminPassword(strings.TrimSpace(s.bootstrapAdminPassword))
		if err != nil {
			return false, err
		}
		s.data.AdminProfile.Password = hashedPassword
		changed = true
	} else if !isArgon2idHash(password) {
		return false, errors.New("admin password hash must use argon2id")
	}

	return changed, nil
}

func (s *MongoStore) GetOrCreateIdentityProfile(userID, email string) (AdminProfile, error) {
	return s.UpsertIdentityProfile(userID, email, nil, nil, nil, nil)
}

func (s *MongoStore) UpsertIdentityProfile(userID, email string, fullName *string, avatarURL *string, gitAuthorName *string, gitAuthorEmail *string) (AdminProfile, error) {
	if s == nil || s.backend == nil {
		return AdminProfile{}, errors.New("mongo store is not initialized")
	}
	if userID == "" {
		return AdminProfile{}, errors.New("user id is required")
	}
	if email == "" {
		return AdminProfile{}, errors.New("email is required")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	update := bson.M{
		"$set": bson.M{
			"email":      email,
			"updated_at": now,
		},
		"$setOnInsert": bson.M{
			"username":   userID,
			"password":   "",
			"created_at": now,
		},
	}
	if fullName != nil {
		update["$set"].(bson.M)["full_name"] = *fullName
	}
	if avatarURL != nil {
		update["$set"].(bson.M)["avatar_url"] = *avatarURL
	}
	if gitAuthorName != nil {
		update["$set"].(bson.M)["git_author_name"] = strings.TrimSpace(*gitAuthorName)
	}
	if gitAuthorEmail != nil {
		update["$set"].(bson.M)["git_author_email"] = strings.TrimSpace(*gitAuthorEmail)
	}

	_, err := s.backend.database.Collection(mongoCollectionUsers).UpdateOne(
		ctx,
		bson.M{"_id": userID},
		update,
		options.UpdateOne().SetUpsert(true),
	)
	if err != nil {
		return AdminProfile{}, err
	}

	var profile persistedAdminProfile
	err = s.backend.database.Collection(mongoCollectionUsers).FindOne(ctx, bson.M{"_id": userID}).Decode(&profile)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return AdminProfile{}, errNotFound
		}
		return AdminProfile{}, err
	}
	return mapPersistedAdminProfile(profile), nil
}

func isArgon2idHash(password string) bool {
	return strings.HasPrefix(password, "$argon2id$")
}

func mapPersistedAdminProfile(profile persistedAdminProfile) AdminProfile {
	return AdminProfile{
		ID:             profile.ID,
		Email:          profile.Email,
		Username:       profile.Username,
		FullName:       profile.FullName,
		AvatarURL:      profile.AvatarURL,
		GitAuthorName:  trimOptionalString(profile.GitAuthorName),
		GitAuthorEmail: trimOptionalString(profile.GitAuthorEmail),
	}
}

func hashAdminPassword(password string) (string, error) {
	salt := make([]byte, adminPasswordSaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}

	hashedPassword := argon2.IDKey(
		[]byte(password),
		salt,
		adminPasswordIterations,
		adminPasswordMemoryKiB,
		adminPasswordParallelism,
		adminPasswordKeyLength,
	)
	encodedSalt := base64.RawStdEncoding.EncodeToString(salt)
	encodedHash := base64.RawStdEncoding.EncodeToString(hashedPassword)
	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		adminPasswordMemoryKiB,
		adminPasswordIterations,
		adminPasswordParallelism,
		encodedSalt,
		encodedHash,
	), nil
}

func compareAdminPassword(hashedPassword, password string) bool {
	params, salt, expectedHash, err := parseArgon2idHash(hashedPassword)
	if err != nil {
		return false
	}
	computedHash := argon2.IDKey([]byte(password), salt, params.iterations, params.memoryKiB, params.parallelism, uint32(len(expectedHash)))
	return subtle.ConstantTimeCompare(computedHash, expectedHash) == 1
}

type argon2idParams struct {
	iterations  uint32
	memoryKiB   uint32
	parallelism uint8
}

func parseArgon2idHash(encoded string) (argon2idParams, []byte, []byte, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return argon2idParams{}, nil, nil, errors.New("invalid argon2id hash format")
	}

	versionPart := strings.TrimPrefix(parts[2], "v=")
	version, err := strconv.Atoi(versionPart)
	if err != nil || version != argon2.Version {
		return argon2idParams{}, nil, nil, errors.New("unsupported argon2 version")
	}

	var params argon2idParams
	settings := strings.Split(parts[3], ",")
	if len(settings) != 3 {
		return argon2idParams{}, nil, nil, errors.New("invalid argon2id parameters")
	}
	for _, setting := range settings {
		keyValue := strings.SplitN(setting, "=", 2)
		if len(keyValue) != 2 {
			return argon2idParams{}, nil, nil, errors.New("invalid argon2id parameter")
		}
		switch keyValue[0] {
		case "m":
			value, parseErr := strconv.ParseUint(keyValue[1], 10, 32)
			if parseErr != nil {
				return argon2idParams{}, nil, nil, parseErr
			}
			params.memoryKiB = uint32(value)
		case "t":
			value, parseErr := strconv.ParseUint(keyValue[1], 10, 32)
			if parseErr != nil {
				return argon2idParams{}, nil, nil, parseErr
			}
			params.iterations = uint32(value)
		case "p":
			value, parseErr := strconv.ParseUint(keyValue[1], 10, 8)
			if parseErr != nil {
				return argon2idParams{}, nil, nil, parseErr
			}
			params.parallelism = uint8(value)
		default:
			return argon2idParams{}, nil, nil, errors.New("unknown argon2id parameter")
		}
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return argon2idParams{}, nil, nil, err
	}
	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return argon2idParams{}, nil, nil, err
	}
	if len(salt) == 0 || len(hash) == 0 || params.iterations == 0 || params.memoryKiB == 0 || params.parallelism == 0 {
		return argon2idParams{}, nil, nil, errors.New("invalid argon2id hash payload")
	}

	return params, salt, hash, nil
}
