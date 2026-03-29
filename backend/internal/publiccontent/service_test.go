package publiccontent

import (
	"context"
	"testing"

	"github.com/hyunbridge/website/backend/internal/operational"
	"github.com/hyunbridge/website/backend/internal/store"
)

type stubPublishedContentStore struct{}

func (stubPublishedContentStore) GetPublishedHomeDocument() (store.HomeDocumentDTO, error) {
	return store.HomeDocumentDTO{ID: "home"}, nil
}

func (stubPublishedContentStore) ListPostDTOsFiltered(includeDraft bool, page int, pageSize int, tagID string) []store.PostDTO {
	return []store.PostDTO{
		{
			ID:    "post-1",
			Slug:  "first-post",
			Title: "First Post",
			Tags: []store.TagDTO{
				{ID: "tag-1", Name: "Go", Slug: "go"},
			},
		},
	}
}

func (stubPublishedContentStore) GetPostDTOBySlug(slug string, includeDraft bool) (store.PostDTO, error) {
	return store.PostDTO{}, store.ErrNotFound()
}

func (stubPublishedContentStore) GetPublishedPostVersionByID(versionID string) (store.PostVersionDTO, error) {
	return store.PostVersionDTO{}, store.ErrNotFound()
}

func (stubPublishedContentStore) ListTags() []store.TagDTO {
	return []store.TagDTO{
		{ID: "tag-1", Name: "Go", Slug: "go"},
		{ID: "tag-2", Name: "Astro", Slug: "astro"},
	}
}

func (stubPublishedContentStore) ListProjectDTOs(includeDraft bool) []store.ProjectDTO {
	return []store.ProjectDTO{
		{
			ID:    "project-1",
			Slug:  "first-project",
			Title: "First Project",
			Tags: []store.TagDTO{
				{ID: "tag-2", Name: "Astro", Slug: "astro"},
			},
		},
	}
}

func (stubPublishedContentStore) GetProjectDTOBySlug(slug string, includeDraft bool) (store.ProjectDTO, error) {
	return store.ProjectDTO{}, store.ErrNotFound()
}

func (stubPublishedContentStore) GetPublishedProjectVersionByID(versionID string) (store.ProjectVersionDTO, error) {
	return store.ProjectVersionDTO{}, store.ErrNotFound()
}

type countingSnapshotStore struct {
	postsCalls    int
	projectsCalls int
	homeCalls     int
}

func (s *countingSnapshotStore) ListPosts(ctx context.Context, commitSHA string, page int, pageSize int, tagID string) ([]store.PostDTO, error) {
	s.postsCalls++
	return []store.PostDTO{
		{
			ID:    "post-1",
			Slug:  "first-post",
			Title: "First Post",
			Tags: []store.TagDTO{
				{ID: "tag-1", Name: "Go", Slug: "go"},
			},
		},
	}, nil
}

func (s *countingSnapshotStore) ListProjects(ctx context.Context, commitSHA string) ([]store.ProjectDTO, error) {
	s.projectsCalls++
	return []store.ProjectDTO{
		{
			ID:    "project-1",
			Slug:  "first-project",
			Title: "First Project",
			Tags: []store.TagDTO{
				{ID: "tag-2", Name: "Astro", Slug: "astro"},
			},
		},
	}, nil
}

func (s *countingSnapshotStore) GetPublishedHome(ctx context.Context, commitSHA string) (store.HomeDocumentDTO, error) {
	s.homeCalls++
	return store.HomeDocumentDTO{ID: "home"}, nil
}

type liveStateStore struct {
	commit string
}

func (s *liveStateStore) Dashboard(limit int) (operational.Dashboard, error) {
	return operational.Dashboard{}, nil
}

func (s *liveStateStore) GetLiveState() (*operational.LiveState, error) {
	return &operational.LiveState{ID: "live", LiveCommitSHA: s.commit}, nil
}

func (s *liveStateStore) EnqueueDeploy(actor string, targetKey string) (operational.ReleaseJob, error) {
	panic("unexpected call")
}

func (s *liveStateStore) ClaimNextDeploy() (*operational.ReleaseJob, error) {
	panic("unexpected call")
}

func (s *liveStateStore) GetActiveDeploy() (*operational.ReleaseJob, error) {
	panic("unexpected call")
}

func (s *liveStateStore) GetRollbackSnapshot(jobID string) (*store.PublishPointerSnapshot, error) {
	panic("unexpected call")
}

func (s *liveStateStore) MarkActiveDeployPreparation(jobID string, rollback store.PublishPointerSnapshot) error {
	panic("unexpected call")
}

func (s *liveStateStore) UpdateActiveDeployDispatch(jobID string, commitSHA string, repoDir string, postCount int, projectCount int, manifest operational.PublishManifest, rollback store.PublishPointerSnapshot, deployHookURL string) error {
	panic("unexpected call")
}

func (s *liveStateStore) CompleteActiveDeploySuccess(jobID string, live store.PublishPointerSnapshot) error {
	panic("unexpected call")
}

func (s *liveStateStore) CompleteActiveDeployFailure(jobID string, reason string) error {
	panic("unexpected call")
}

func TestServiceUsesLiveSnapshotForLiveContent(t *testing.T) {
	t.Parallel()

	snapshots := &countingSnapshotStore{}
	live := &liveStateStore{commit: "commit-a"}
	service := NewService(stubPublishedContentStore{}, snapshots, live)

	posts, err := service.ListPosts(context.Background(), "", 1, 10, "")
	if err != nil {
		t.Fatalf("ListPosts returned error: %v", err)
	}
	if len(posts) != 1 {
		t.Fatalf("expected 1 post, got %d", len(posts))
	}

	tags, err := service.ListTags(context.Background(), "")
	if err != nil {
		t.Fatalf("ListTags returned error: %v", err)
	}
	if len(tags) != 2 {
		t.Fatalf("expected 2 tags, got %d", len(tags))
	}

	if snapshots.postsCalls != 1 || snapshots.projectsCalls != 1 || snapshots.homeCalls != 1 {
		t.Fatalf("expected live content to use git snapshot once, got posts=%d projects=%d home=%d", snapshots.postsCalls, snapshots.projectsCalls, snapshots.homeCalls)
	}
}

func TestServiceLoadsExplicitSnapshotByCommit(t *testing.T) {
	t.Parallel()

	snapshots := &countingSnapshotStore{}
	live := &liveStateStore{commit: "commit-a"}
	service := NewService(stubPublishedContentStore{}, snapshots, live)

	posts, err := service.ListPosts(context.Background(), "commit-a", 1, 10, "")
	if err != nil {
		t.Fatalf("ListPosts returned error: %v", err)
	}
	if len(posts) != 1 {
		t.Fatalf("expected 1 post from snapshot, got %d", len(posts))
	}

	if snapshots.postsCalls != 1 {
		t.Fatalf("expected explicit snapshot post load, got %d", snapshots.postsCalls)
	}
}

func TestGetCurrentSiteSnapshotUsesLiveCommitSnapshot(t *testing.T) {
	t.Parallel()

	snapshots := &countingSnapshotStore{}
	live := &liveStateStore{commit: "commit-a"}
	service := NewService(stubPublishedContentStore{}, snapshots, live)

	snapshot, err := service.GetCurrentSiteSnapshot(context.Background())
	if err != nil {
		t.Fatalf("GetCurrentSiteSnapshot returned error: %v", err)
	}
	if snapshot == nil {
		t.Fatal("expected live site snapshot")
	}
	if snapshot.CommitSHA != "commit-a" {
		t.Fatalf("expected commit-a, got %q", snapshot.CommitSHA)
	}
	if snapshots.postsCalls != 1 || snapshots.projectsCalls != 1 || snapshots.homeCalls != 1 {
		t.Fatalf("expected live snapshot load, got posts=%d projects=%d home=%d", snapshots.postsCalls, snapshots.projectsCalls, snapshots.homeCalls)
	}
}
