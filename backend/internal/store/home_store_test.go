package store

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"

	"github.com/hyunbridge/website/backend/internal/editorial"
	"github.com/hyunbridge/website/backend/internal/gitrepo"
	internalid "github.com/hyunbridge/website/backend/internal/id"
)

func defaultHomeData() map[string]any {
	heroID := internalid.NewPersistentID()
	projectFeedID := internalid.NewPersistentID()
	postFeedID := internalid.NewPersistentID()
	ctaID := internalid.NewPersistentID()

	return map[string]any{
		"schemaVersion": 1,
		"sections": []map[string]any{
			{
				"id":      heroID,
				"type":    "hero",
				"visible": true,
				"layout":  "split",
				"theme":   "accent",
				"eyebrow": "Engineering-led portfolio",
				"title":   "A quieter product stack with clearer boundaries.",
				"content": "HGSEO Studio is being rebuilt as a static React frontend with a server-owned Go backend.",
				"primaryCta": map[string]any{
					"label": "Read posts",
					"href":  "/blog",
				},
				"secondaryCta": map[string]any{
					"label": "View projects",
					"href":  "/projects",
				},
				"cards": []map[string]any{},
			},
			{
				"id":          projectFeedID,
				"type":        "projectFeed",
				"visible":     true,
				"theme":       "accent",
				"layout":      "spotlight",
				"title":       "Projects",
				"description": "",
				"limit":       3,
			},
			{
				"id":          postFeedID,
				"type":        "postFeed",
				"visible":     true,
				"theme":       "default",
				"layout":      "list",
				"title":       "Posts",
				"description": "",
				"limit":       3,
			},
			{
				"id":      ctaID,
				"type":    "cta",
				"visible": true,
				"theme":   "accent",
				"layout":  "split",
				"title":   "Work together on something clear and durable.",
				"content": "Questions, consulting, and product collaboration are all welcome.",
				"primaryCta": map[string]any{
					"label": "Contact",
					"href":  "/contact",
				},
			},
		},
	}
}

func TestGetPublishedHomeDocumentUsesPublishedPointer(t *testing.T) {
	t.Parallel()

	repo, err := gitrepo.New(gitrepo.Config{
		Path:      filepath.Join(t.TempDir(), "content.git"),
		Branch:    "main",
		UserName:  "Test Author",
		UserEmail: "author@example.com",
	})
	if err != nil {
		t.Fatalf("create repo: %v", err)
	}
	if err := repo.EnsureReady(context.Background()); err != nil {
		t.Fatalf("ensure repo: %v", err)
	}

	history := editorial.NewHistory(gitrepo.Config{
		Path:      repo.Path(),
		Branch:    "main",
		UserName:  "Test Author",
		UserEmail: "author@example.com",
	})
	if history == nil {
		t.Fatal("expected editorial history")
	}

	publishedAt := "2026-03-28T00:00:00Z"
	payload, err := json.MarshalIndent(editorialHomeSnapshot{
		ID:          "home-page",
		Title:       "Homepage",
		Data:        defaultHomeData(),
		Summary:     ptrString("Homepage"),
		PublishedAt: &publishedAt,
	}, "", "  ")
	if err != nil {
		t.Fatalf("marshal home snapshot: %v", err)
	}
	entry, err := history.Save(context.Background(), homeHistoryPath(), payload, "Homepage", buildEditorialCommitBody("home", "home-page", "Homepage"))
	if err != nil {
		t.Fatalf("save home snapshot: %v", err)
	}

	store := &MongoStore{
		editorialHistory: history,
		pointers: PublishPointerSnapshot{
			Home: PublishPointerState{
				ID:                 "home-page",
				CurrentVersionID:   ptrString("draft-version"),
				PublishedVersionID: &entry.CommitSHA,
				PublishedAt:        &publishedAt,
			},
		},
		data: persistedData{
			Home: persistedHome{
				ID:          "home-page",
				OwnerID:     "admin-1",
				PublishedAt: &publishedAt,
				Data:        defaultHomeData(),
			},
		},
	}

	document, err := store.GetPublishedHomeDocument()
	if err != nil {
		t.Fatalf("GetPublishedHomeDocument returned error: %v", err)
	}
	if document.Status != "published" {
		t.Fatalf("expected derived published status, got %q", document.Status)
	}
	if got := deref(document.PublishedVersionID, ""); got != entry.CommitSHA {
		t.Fatalf("expected published version %q, got %q", entry.CommitSHA, got)
	}
}

func TestDeriveHomeStatusUsesPublishedPointer(t *testing.T) {
	t.Parallel()

	status := deriveHomeStatus(persistedHome{
		ID:          "home-page",
		PublishedAt: ptrString("2026-03-28T00:00:00Z"),
	})
	if status != "published" {
		t.Fatalf("expected published status, got %q", status)
	}
}

func TestSaveHomeVersionPublishesCurrentVersion(t *testing.T) {
	t.Parallel()

	history := newTestEditorialHistory(t)
	store := &MongoStore{
		editorialHistory: history,
		data: persistedData{
			Home: persistedHome{
				ID:      "home-page",
				OwnerID: "admin-1",
				Data:    defaultHomeData(),
			},
		},
	}

	document, err := store.SaveHomeVersion("admin-1", "save home")
	if err != nil {
		t.Fatalf("SaveHomeVersion returned error: %v", err)
	}
	if document.CurrentVersionID == nil {
		t.Fatal("expected current version id")
	}
	if document.PublishedVersionID == nil {
		t.Fatal("expected published version id")
	}
	if *document.CurrentVersionID != *document.PublishedVersionID {
		t.Fatalf("expected current and published version to match, got current=%q published=%q", *document.CurrentVersionID, *document.PublishedVersionID)
	}
	if document.PublishedAt == nil || *document.PublishedAt == "" {
		t.Fatal("expected published timestamp")
	}

	ref, err := history.Repository().ListReferences(context.Background(), homeLiveRef())
	if err != nil {
		t.Fatalf("list references: %v", err)
	}
	if len(ref) != 1 || ref[0].TargetCommitSHA != *document.PublishedVersionID {
		t.Fatalf("expected home live ref to target published version, got %#v", ref)
	}
}
