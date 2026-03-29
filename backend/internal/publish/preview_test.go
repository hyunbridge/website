package publish

import (
	"testing"

	"github.com/hyunbridge/website/backend/internal/store"
)

func TestBuildPreviewUsesLivePointerSnapshot(t *testing.T) {
	t.Parallel()

	versionID := "version-post-001"
	publishedAt := "2026-03-29T00:00:00Z"
	source := &stubPublisherSource{
		posts: []store.PostDTO{
			{
				ID:                 "post-001",
				Title:              "Published Post",
				Slug:               "published-post",
				PublishedAt:        &publishedAt,
				CurrentVersionID:   &versionID,
				PublishedVersionID: &versionID,
			},
		},
		postVersions: map[string]store.PostVersionDTO{
			versionID: {
				ID:    versionID,
				Title: "Published Post",
				Slug:  "published-post",
			},
		},
	}

	preview := BuildPreview(source, nil)
	if preview.Summary.TotalCount != 1 {
		t.Fatalf("expected one publishable change, got %d", preview.Summary.TotalCount)
	}
	if preview.Items[0].ChangeType != "publish" {
		t.Fatalf("expected publish change, got %q", preview.Items[0].ChangeType)
	}
}

func TestBuildPreviewShowsUnpublishForRemovedPublishedPointer(t *testing.T) {
	t.Parallel()

	liveVersionID := "version-post-live"
	source := &stubPublisherSource{
		postVersions: map[string]store.PostVersionDTO{
			liveVersionID: {
				ID:    liveVersionID,
				Title: "Removed Post",
				Slug:  "removed-post",
			},
		},
	}

	liveSnapshot := &store.PublishPointerSnapshot{
		Posts: []store.PublishPointerState{
			{
				ID:                 "post-removed",
				PublishedVersionID: &liveVersionID,
			},
		},
	}

	preview := BuildPreview(source, liveSnapshot)
	if preview.Summary.TotalCount != 1 {
		t.Fatalf("expected one unpublish change, got %d", preview.Summary.TotalCount)
	}
	if preview.Items[0].ChangeType != "unpublish" {
		t.Fatalf("expected unpublish change, got %q", preview.Items[0].ChangeType)
	}
	if preview.Items[0].Title != "Removed Post" {
		t.Fatalf("expected version-derived title, got %q", preview.Items[0].Title)
	}
}
