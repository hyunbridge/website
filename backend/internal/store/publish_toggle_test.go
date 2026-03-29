package store

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/hyunbridge/website/backend/internal/editorial"
	"github.com/hyunbridge/website/backend/internal/gitrepo"
)

func newTestEditorialHistory(t *testing.T) *editorial.History {
	t.Helper()

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
	return history
}

func TestSetProjectPublishedDoesNotCreateSnapshotCommit(t *testing.T) {
	t.Parallel()

	history := newTestEditorialHistory(t)
	entry, err := history.Save(
		context.Background(),
		projectHistoryPath("project-1"),
		[]byte("project snapshot"),
		"Project snapshot",
		buildEditorialCommitBody("project", "project-1", "Project"),
	)
	if err != nil {
		t.Fatalf("save project snapshot: %v", err)
	}

	store := &MongoStore{
		editorialHistory: history,
		data: persistedData{
			Projects: []persistedProject{
				{
					ID:               "project-1",
					OwnerID:          "owner-1",
					Title:            "Project",
					Slug:             "project",
					CurrentVersionID: &entry.CommitSHA,
				},
			},
		},
	}

	dto, err := store.SetProjectPublished("project-1", true)
	if err != nil {
		t.Fatalf("SetProjectPublished returned error: %v", err)
	}
	if got := deref(dto.PublishedVersionID, ""); got != entry.CommitSHA {
		t.Fatalf("expected published version %q, got %q", entry.CommitSHA, got)
	}

	entries, err := history.History(context.Background(), projectHistoryPath("project-1"))
	if err != nil {
		t.Fatalf("project history: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected publish toggle to avoid new snapshot commit, got %d entries", len(entries))
	}
}

func TestSetPostPublishedDoesNotCreateSnapshotCommit(t *testing.T) {
	t.Parallel()

	history := newTestEditorialHistory(t)
	entry, err := history.Save(
		context.Background(),
		postHistoryPath("post-1"),
		[]byte("post snapshot"),
		"Post snapshot",
		buildEditorialCommitBody("post", "post-1", "Post"),
	)
	if err != nil {
		t.Fatalf("save post snapshot: %v", err)
	}

	store := &MongoStore{
		editorialHistory: history,
		data: persistedData{
			Posts: []persistedPost{
				{
					ID:               "post-1",
					AuthorID:         "author-1",
					Title:            "Post",
					Slug:             "post",
					CurrentVersionID: &entry.CommitSHA,
				},
			},
		},
	}

	dto, err := store.SetPostPublished("post-1", true)
	if err != nil {
		t.Fatalf("SetPostPublished returned error: %v", err)
	}
	if got := deref(dto.PublishedVersionID, ""); got != entry.CommitSHA {
		t.Fatalf("expected published version %q, got %q", entry.CommitSHA, got)
	}

	entries, err := history.History(context.Background(), postHistoryPath("post-1"))
	if err != nil {
		t.Fatalf("post history: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected publish toggle to avoid new snapshot commit, got %d entries", len(entries))
	}
}
