package store

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/hyunbridge/website/backend/internal/domain"
)

type editorialHomeSnapshot struct {
	ID          string         `json:"id"`
	Title       string         `json:"title"`
	Data        map[string]any `json:"data"`
	Summary     *string        `json:"summary,omitempty"`
	PublishedAt *string        `json:"published_at,omitempty"`
}

func (s *MongoStore) saveHomeSnapshotStateLocked(data map[string]any, actorID string, changeDescription *string) (string, string, error) {
	if s.editorialHistory == nil {
		return "", "", fmt.Errorf("content repository is not configured")
	}
	normalizedData := normalizeHomeDataIDs(data)
	snapshot, err := json.MarshalIndent(editorialHomeSnapshot{
		ID:          s.data.Home.ID,
		Title:       "Homepage",
		Data:        normalizedData,
		Summary:     ptrString("Homepage"),
		PublishedAt: cloneOptionalString(s.data.Home.PublishedAt),
	}, "", "  ")
	if err != nil {
		return "", "", err
	}
	subject := fallbackEditorialMessage(changeDescription, "Homepage")
	body := buildEditorialCommitBody("home", s.data.Home.ID, "Homepage")
	entry, err := s.editorialHistory.SaveAs(context.Background(), homeHistoryPath(), snapshot, subject, body, s.gitAuthorIdentityLocked(actorID))
	if err != nil {
		return "", "", err
	}
	return entry.CommitSHA, entry.CreatedAt, nil
}

func (s *MongoStore) saveHomeSnapshotLocked(actorID string, changeDescription *string) (string, string, error) {
	return s.saveHomeSnapshotStateLocked(s.data.Home.Data, actorID, changeDescription)
}

func (s *MongoStore) GetHome() domain.HomePayload {
	s.mu.Lock()
	defer s.mu.Unlock()

	home := s.data.Home
	home.CurrentVersionID = s.currentHomeVersionIDLocked()
	home.PublishedVersionID = s.publishedHomeVersionIDLocked()

	posts := append([]persistedPost(nil), s.data.Posts...)
	for idx := range posts {
		posts[idx].CurrentVersionID = s.currentPostVersionIDLocked(posts[idx])
		posts[idx].PublishedVersionID = s.publishedPostVersionIDLocked(posts[idx].ID)
	}

	projects := append([]persistedProject(nil), s.data.Projects...)
	for idx := range projects {
		projects[idx].CurrentVersionID = s.currentProjectVersionIDLocked(projects[idx])
		projects[idx].PublishedVersionID = s.publishedProjectVersionIDLocked(projects[idx].ID)
	}

	return mapHomeToPayload(home, posts, projects)
}

func mapHomeToPayload(home persistedHome, posts []persistedPost, projects []persistedProject) domain.HomePayload {
	title := "HGSEO Studio"
	description := "Static React frontend with a Go backend."
	badge := "Static React + Go API"
	primaryLabel := "Read posts"
	primaryHref := "/blog"
	secondaryLabel := "View projects"
	secondaryHref := "/projects"

	if home.Data != nil {
		if sections, ok := home.Data["sections"].([]any); ok && len(sections) > 0 {
			if hero, ok := sections[0].(map[string]any); ok {
				title = stringValue(hero["title"], title)
				description = stringValue(hero["content"], description)
				badge = stringValue(hero["eyebrow"], badge)
				if primaryCTA, ok := hero["primaryCta"].(map[string]any); ok {
					primaryLabel = stringValue(primaryCTA["label"], primaryLabel)
					primaryHref = stringValue(primaryCTA["href"], primaryHref)
				}
				if secondaryCTA, ok := hero["secondaryCta"].(map[string]any); ok {
					secondaryLabel = stringValue(secondaryCTA["label"], secondaryLabel)
					secondaryHref = stringValue(secondaryCTA["href"], secondaryHref)
				}
			}
		}
	}

	latestPosts := make([]domain.SummaryCard, 0)
	for _, post := range posts {
		if post.PublishedVersionID != nil {
			latestPosts = append(latestPosts, domain.SummaryCard{
				ID:          post.ID,
				Slug:        post.Slug,
				Title:       post.Title,
				Summary:     post.Summary,
				PublishedAt: deref(post.PublishedAt, post.CreatedAt),
			})
		}
		if len(latestPosts) == 3 {
			break
		}
	}

	featuredProjects := make([]domain.SummaryCard, 0)
	for _, project := range projects {
		if project.PublishedVersionID != nil {
			featuredProjects = append(featuredProjects, domain.SummaryCard{
				ID:          project.ID,
				Slug:        project.Slug,
				Title:       project.Title,
				Summary:     project.Summary,
				PublishedAt: deref(project.PublishedAt, project.CreatedAt),
			})
		}
		if len(featuredProjects) == 3 {
			break
		}
	}

	highlights := []domain.Highlight{
		{Title: "Frontend runtime", Value: "Static", Description: "Public pages deploy as cacheable assets instead of a coupled app server."},
		{Title: "Backend ownership", Value: "Go / Echo", Description: "Auth, content, and asset flows move into a compact API."},
		{Title: "Persistence", Value: "MongoDB", Description: "Application state is persisted in MongoDB instead of a local JSON file."},
	}
	if home.Data != nil {
		if sections, ok := home.Data["sections"].([]any); ok && len(sections) > 0 {
			if hero, ok := sections[0].(map[string]any); ok {
				if cards, ok := hero["cards"].([]any); ok && len(cards) > 0 {
					highlights = make([]domain.Highlight, 0, len(cards))
					for _, rawCard := range cards {
						card, ok := rawCard.(map[string]any)
						if !ok {
							continue
						}
						highlights = append(highlights, domain.Highlight{
							Title:       stringValue(card["title"], ""),
							Value:       stringValue(card["content"], ""),
							Description: "",
						})
					}
				}
			}
		}
	}

	return domain.HomePayload{
		Hero: domain.HomeHero{
			Badge:        badge,
			Title:        title,
			Description:  description,
			PrimaryCTA:   domain.CTA{Label: primaryLabel, Href: primaryHref},
			SecondaryCTA: domain.CTA{Label: secondaryLabel, Href: secondaryHref},
		},
		Highlights:       highlights,
		LatestPosts:      latestPosts,
		FeaturedProjects: featuredProjects,
	}
}

func (s *MongoStore) GetHomeDocument() HomeDocumentDTO {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.homeDocumentLocked()
}

func (s *MongoStore) GetPublishedHomeDocument() (HomeDocumentDTO, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	publishedVersionID := s.publishedHomeVersionIDLocked()
	if strings.TrimSpace(deref(publishedVersionID, "")) == "" {
		return HomeDocumentDTO{}, errNotFound
	}
	if s.editorialHistory != nil {
		entry, err := s.editorialHistory.Get(context.Background(), homeHistoryPath(), *publishedVersionID)
		if err == nil {
			var snapshot editorialHomeSnapshot
			if unmarshalErr := json.Unmarshal(entry.Content, &snapshot); unmarshalErr == nil {
				ownerID := fallbackString(s.resolveActorIDForGitAuthorLocked(entry.Author, entry.AuthorEmail), s.data.Home.OwnerID)
				return HomeDocumentDTO{
					ID:                 s.data.Home.ID,
					OwnerID:            ownerID,
					Status:             "published",
					UpdatedAt:          s.data.Home.UpdatedAt,
					PublishedAt:        cloneOptionalString(snapshot.PublishedAt),
					CurrentVersionID:   publishedVersionID,
					PublishedVersionID: publishedVersionID,
					Data:               snapshot.Data,
					Notices:            []map[string]string{},
				}, nil
			}
		}
	}
	return HomeDocumentDTO{}, errNotFound
}

func (s *MongoStore) SaveHomeDraft(userID string, data map[string]any, changeDescription string) (HomeDocumentDTO, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = changeDescription
	now := time.Now().UTC().Format(time.RFC3339)
	s.data.Home.Data = normalizeHomeDataIDs(data)
	s.data.Home.OwnerID = strings.TrimSpace(userID)
	s.data.Home.UpdatedAt = &now
	s.data.Home.DraftDirty = true

	return s.homeDocumentLocked(), s.saveLocked()
}

func (s *MongoStore) SaveHomeVersion(userID string, changeDescription string) (HomeDocumentDTO, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	ownerID := strings.TrimSpace(userID)
	if ownerID == "" {
		ownerID = s.data.Home.OwnerID
	}
	versionID, _, err := s.saveHomeSnapshotLocked(ownerID, ptrString(fallbackEditorialMessage(ptrString(changeDescription), "홈 구성 업데이트")))
	if err != nil {
		return HomeDocumentDTO{}, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	s.data.Home.OwnerID = ownerID
	s.data.Home.UpdatedAt = &now
	state := s.homePointerStateLocked()
	state.CurrentVersionID = &versionID
	if !isPublishedAt(s.data.Home.PublishedAt) {
		s.data.Home.PublishedAt = &now
	}
	state.PublishedVersionID = &versionID
	state.PublishedAt = cloneOptionalString(s.data.Home.PublishedAt)
	s.setHomePointerStateLocked(state)
	s.data.Home.DraftDirty = false
	if err := s.applyPublishedPointersLocked(); err != nil {
		return HomeDocumentDTO{}, err
	}
	return s.homeDocumentLocked(), s.saveLocked()
}

func (s *MongoStore) ListHomeVersions() []HomeVersionDTO {
	s.mu.Lock()
	history := s.editorialHistory
	s.mu.Unlock()

	if history == nil {
		return []HomeVersionDTO{}
	}

	entries, err := history.History(context.Background(), homeHistoryPath())
	if err != nil {
		return []HomeVersionDTO{}
	}

	items := make([]HomeVersionDTO, 0, len(entries))
	for idx, entry := range entries {
		version, dtoErr := homeVersionDTOFromEntry(entry, idx)
		if dtoErr != nil {
			return []HomeVersionDTO{}
		}
		items = append(items, version)
	}
	return items
}

func (s *MongoStore) GetHomeVersionByID(versionID string) (HomeVersionDTO, error) {
	s.mu.Lock()
	history := s.editorialHistory
	s.mu.Unlock()

	if history == nil {
		return HomeVersionDTO{}, errNotFound
	}

	entries, err := history.History(context.Background(), homeHistoryPath())
	if err != nil {
		return HomeVersionDTO{}, errNotFound
	}
	for idx, entry := range entries {
		if entry.CommitSHA == versionID {
			return homeVersionDTOFromEntry(entry, idx)
		}
	}
	return HomeVersionDTO{}, errNotFound
}

func (s *MongoStore) RestoreHomeVersion(versionNumber int, userID string) (HomeDocumentDTO, error) {
	s.mu.Lock()
	history := s.editorialHistory
	s.mu.Unlock()
	_ = userID

	if history == nil {
		return HomeDocumentDTO{}, errNotFound
	}

	entries, err := history.History(context.Background(), homeHistoryPath())
	if err != nil || versionNumber <= 0 || versionNumber > len(entries) {
		return HomeDocumentDTO{}, errNotFound
	}
	entry := entries[versionNumber-1]
	var snapshot editorialHomeSnapshot
	if err := json.Unmarshal(entry.Content, &snapshot); err != nil {
		return HomeDocumentDTO{}, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()
	nextVersionID, _, err := s.saveHomeSnapshotStateLocked(snapshot.Data, userID, ptrString(fmt.Sprintf("restore home version %d", versionNumber)))
	if err != nil {
		return HomeDocumentDTO{}, err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	s.data.Home.Data = snapshot.Data
	s.data.Home.UpdatedAt = &now
	state := s.homePointerStateLocked()
	state.CurrentVersionID = &nextVersionID
	s.setHomePointerStateLocked(state)
	s.data.Home.DraftDirty = false
	return s.homeDocumentLocked(), s.saveLocked()
}

func (s *MongoStore) homeDocumentLocked() HomeDocumentDTO {
	currentVersionID := s.currentHomeVersionIDLocked()
	publishedVersionID := s.publishedHomeVersionIDLocked()
	return HomeDocumentDTO{
		ID:                 s.data.Home.ID,
		OwnerID:            s.data.Home.OwnerID,
		Status:             deriveHomeStatus(s.data.Home),
		UpdatedAt:          s.data.Home.UpdatedAt,
		PublishedAt:        s.data.Home.PublishedAt,
		CurrentVersionID:   currentVersionID,
		PublishedVersionID: publishedVersionID,
		Data:               s.data.Home.Data,
		Notices:            []map[string]string{},
	}
}

func deriveHomeStatus(home persistedHome) string {
	if isPublishedAt(home.PublishedAt) {
		return "published"
	}
	return "draft"
}
