package publish

import (
	"context"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"testing"

	"github.com/hyunbridge/website/backend/internal/gitrepo"
	"github.com/hyunbridge/website/backend/internal/operational"
	"github.com/hyunbridge/website/backend/internal/store"
)

type stubPublisherSource struct {
	posts           []store.PostDTO
	postVersions    map[string]store.PostVersionDTO
	projects        []store.ProjectDTO
	projectVersions map[string]store.ProjectVersionDTO
	home            store.HomeDocumentDTO
	homeVersions    map[string]store.HomeVersionDTO
	syncCalls       int
	restoreCalls    int
}

type stubOperationalStore struct {
	queue             []operational.ReleaseJob
	active            *operational.ReleaseJob
	rollbackSnapshots map[string]store.PublishPointerSnapshot
	successes         []string
	failures          []string
	nextID            int
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func (s *stubOperationalStore) Dashboard(limit int) (operational.Dashboard, error) {
	return operational.Dashboard{}, nil
}

func (s *stubOperationalStore) GetLiveState() (*operational.LiveState, error) {
	return nil, nil
}

func (s *stubOperationalStore) EnqueueDeploy(actor string, targetKey string) (operational.ReleaseJob, error) {
	for _, queued := range s.queue {
		if queued.Meta["target_key"] == targetKey {
			return queued, nil
		}
	}
	if s.active != nil && s.active.Meta["target_key"] == targetKey {
		return *s.active, nil
	}
	s.nextID++
	job := operational.ReleaseJob{
		ID:          fmt.Sprintf("job-%d", s.nextID),
		Type:        operational.ReleaseJobTypeDeploy,
		Status:      operational.ReleaseJobStatusQueued,
		RequestedBy: actor,
		Logs:        []string{"queued"},
		Meta:        map[string]any{"target_key": targetKey},
		CreatedAt:   "2026-03-22T00:00:00Z",
		UpdatedAt:   "2026-03-22T00:00:00Z",
	}
	s.queue = append(s.queue, job)
	return job, nil
}

func (s *stubOperationalStore) ClaimNextDeploy() (*operational.ReleaseJob, error) {
	if s.active != nil || len(s.queue) == 0 {
		return nil, nil
	}
	job := s.queue[0]
	s.queue = s.queue[1:]
	job.Status = operational.ReleaseJobStatusDispatching
	s.active = &job
	return s.active, nil
}

func (s *stubOperationalStore) GetActiveDeploy() (*operational.ReleaseJob, error) {
	if s.active == nil {
		return nil, nil
	}
	job := *s.active
	return &job, nil
}

func (s *stubOperationalStore) GetRollbackSnapshot(jobID string) (*store.PublishPointerSnapshot, error) {
	snapshot, ok := s.rollbackSnapshots[jobID]
	if !ok {
		return nil, nil
	}
	copySnapshot := snapshot
	return &copySnapshot, nil
}

func (s *stubOperationalStore) MarkActiveDeployPreparation(jobID string, rollback store.PublishPointerSnapshot) error {
	if s.active == nil || s.active.ID != jobID {
		return nil
	}
	if s.rollbackSnapshots == nil {
		s.rollbackSnapshots = map[string]store.PublishPointerSnapshot{}
	}
	s.rollbackSnapshots[jobID] = rollback
	return nil
}

func (s *stubOperationalStore) UpdateActiveDeployDispatch(jobID string, commitSHA string, _ string, _ int, _ int, manifest operational.PublishManifest, rollback store.PublishPointerSnapshot, deployHookURL string) error {
	if s.active == nil || s.active.ID != jobID {
		return nil
	}
	_ = s.MarkActiveDeployPreparation(jobID, rollback)
	if strings.TrimSpace(deployHookURL) != "" {
		s.active.Status = operational.ReleaseJobStatusWaitingResult
	}
	s.active.CommitSHA = &commitSHA
	s.active.Manifest = &manifest
	return nil
}

func (s *stubOperationalStore) CompleteActiveDeploySuccess(jobID string, live store.PublishPointerSnapshot) error {
	if s.active != nil && s.active.ID == jobID {
		s.active.Status = operational.ReleaseJobStatusSucceeded
		if s.rollbackSnapshots == nil {
			s.rollbackSnapshots = map[string]store.PublishPointerSnapshot{}
		}
		s.rollbackSnapshots["live"] = live
		s.successes = append(s.successes, jobID)
		s.active = nil
	}
	return nil
}

func (s *stubOperationalStore) CompleteActiveDeployFailure(jobID string, reason string) error {
	if s.active != nil && s.active.ID == jobID {
		s.active.Status = operational.ReleaseJobStatusFailed
		s.failures = append(s.failures, reason)
		s.active = nil
	}
	return nil
}

func (s stubPublisherSource) ListPostDTOs(includeDraft bool) []store.PostDTO {
	return s.posts
}

func (s stubPublisherSource) GetPostVersionByID(versionID string) (store.PostVersionDTO, error) {
	return s.postVersions[versionID], nil
}

func (s stubPublisherSource) ListProjectDTOs(includeDraft bool) []store.ProjectDTO {
	return s.projects
}

func (s stubPublisherSource) GetProjectVersionByID(versionID string) (store.ProjectVersionDTO, error) {
	return s.projectVersions[versionID], nil
}

func (s stubPublisherSource) GetHomeDocument() store.HomeDocumentDTO {
	return s.home
}

func (s stubPublisherSource) GetHomeVersionByID(versionID string) (store.HomeVersionDTO, error) {
	return s.homeVersions[versionID], nil
}

func (s *stubPublisherSource) SyncPublishedContentPointers() error {
	s.syncCalls++
	return nil
}

func (s stubPublisherSource) CapturePublishedPointerSnapshot() store.PublishPointerSnapshot {
	snapshot := store.PublishPointerSnapshot{
		Posts:    make([]store.PublishPointerState, 0, len(s.posts)),
		Projects: make([]store.PublishPointerState, 0, len(s.projects)),
		Home: store.PublishPointerState{
			ID:                 s.home.ID,
			CurrentVersionID:   s.home.CurrentVersionID,
			PublishedVersionID: s.home.PublishedVersionID,
			PublishedAt:        s.home.PublishedAt,
		},
	}
	for _, post := range s.posts {
		snapshot.Posts = append(snapshot.Posts, store.PublishPointerState{
			ID:                 post.ID,
			CurrentVersionID:   post.CurrentVersionID,
			PublishedVersionID: post.PublishedVersionID,
			PublishedAt:        post.PublishedAt,
		})
	}
	for _, project := range s.projects {
		snapshot.Projects = append(snapshot.Projects, store.PublishPointerState{
			ID:                 project.ID,
			CurrentVersionID:   project.CurrentVersionID,
			PublishedVersionID: project.PublishedVersionID,
			PublishedAt:        project.PublishedAt,
		})
	}
	return snapshot
}

func (s *stubPublisherSource) RestorePublishedPointerSnapshot(snapshot store.PublishPointerSnapshot) error {
	s.restoreCalls++
	return nil
}

func (s stubPublisherSource) ListTags() []store.TagDTO {
	return nil
}

func newTestRepository(t *testing.T, seed bool) *gitrepo.Repository {
	t.Helper()

	repo, err := gitrepo.New(gitrepo.Config{
		Path:      filepath.Join(t.TempDir(), "content.git"),
		Branch:    "main",
		UserName:  "Test Publisher",
		UserEmail: "publisher@example.com",
	})
	if err != nil {
		t.Fatalf("create test repository: %v", err)
	}
	if err := repo.EnsureReady(context.Background()); err != nil {
		t.Fatalf("ensure test repository: %v", err)
	}
	if seed {
		if _, err := repo.CommitFile(context.Background(), ".keep", []byte("init\n"), "init", ""); err != nil {
			t.Fatalf("seed test repository: %v", err)
		}
	}
	return repo
}

func TestFilesystemPublisherSyncsPublishedPointersAgainstSingleRepo(t *testing.T) {
	t.Parallel()

	versionID := "version-post-001"
	publishedAt := "2026-03-18T00:00:00Z"
	source := &stubPublisherSource{
		posts: []store.PostDTO{
			{
				ID:                 "post-001",
				CreatedAt:          "2026-03-18T00:00:00Z",
				UpdatedAt:          "2026-03-18T00:00:00Z",
				Title:              "Git Publish",
				Slug:               "git-publish",
				Summary:            "publish repo commit",
				PublishedAt:        &publishedAt,
				CurrentVersionID:   &versionID,
				PublishedVersionID: &versionID,
				EnableComments:     true,
				Author:             store.AuthorDTO{FullName: "Admin"},
			},
		},
		postVersions: map[string]store.PostVersionDTO{
			versionID: {
				ID:      versionID,
				Title:   "Git Publish",
				Summary: "publish repo commit",
				Content: "hello",
			},
		},
		home: store.HomeDocumentDTO{
			ID:               "home",
			Status:           "published",
			CurrentVersionID: &versionID,
		},
		homeVersions: map[string]store.HomeVersionDTO{
			versionID: {
				ID:     versionID,
				PageID: "home",
				Title:  "Homepage",
				Data:   map[string]any{"version": 1},
			},
		},
	}

	repo := newTestRepository(t, true)
	headBefore, err := repo.HeadCommitSHA(context.Background())
	if err != nil {
		t.Fatalf("read repo head before sync: %v", err)
	}

	deployHookCalls := 0
	opsStore := &stubOperationalStore{}
	publisher := NewFilesystemPublisher(source, repo, opsStore, "https://deploy.example.test/hook")
	publisher.httpClient = &http.Client{
		Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
			deployHookCalls++
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       http.NoBody,
				Header:     make(http.Header),
				Request:    request,
			}, nil
		}),
	}

	if err := publisher.Sync(context.Background()); err != nil {
		t.Fatalf("Sync returned error: %v", err)
	}

	headAfter, err := repo.HeadCommitSHA(context.Background())
	if err != nil {
		t.Fatalf("read repo head after sync: %v", err)
	}
	if strings.TrimSpace(headBefore) != strings.TrimSpace(headAfter) {
		t.Fatalf("expected publish sync to reuse existing editorial repo head, got before=%s after=%s", headBefore, headAfter)
	}
	if source.syncCalls != 1 {
		t.Fatalf("expected published pointers to sync once, got %d", source.syncCalls)
	}
	if deployHookCalls != 1 {
		t.Fatalf("expected deploy hook to be called once, got %d", deployHookCalls)
	}
	if opsStore.active == nil || opsStore.active.Status != operational.ReleaseJobStatusWaitingResult {
		t.Fatalf("expected active deploy to wait for external result, got %#v", opsStore.active)
	}
}

func TestFilesystemPublisherSkipsDeployHookWhenUnconfigured(t *testing.T) {
	t.Parallel()

	versionID := "version-home-001"
	source := &stubPublisherSource{
		home: store.HomeDocumentDTO{
			ID:                 "home",
			Status:             "published",
			CurrentVersionID:   &versionID,
			PublishedVersionID: &versionID,
		},
		homeVersions: map[string]store.HomeVersionDTO{
			versionID: {
				ID:     versionID,
				PageID: "home",
				Title:  "Homepage",
				Data:   map[string]any{"version": 1},
			},
		},
	}

	repo := newTestRepository(t, true)

	opsStore := &stubOperationalStore{}
	publisher := NewFilesystemPublisher(source, repo, opsStore, "")
	if err := publisher.Sync(context.Background()); err != nil {
		t.Fatalf("Sync returned error without deploy hook: %v", err)
	}
	if source.syncCalls != 1 {
		t.Fatalf("expected published pointers to sync once, got %d", source.syncCalls)
	}
	if len(opsStore.successes) != 1 {
		t.Fatalf("expected immediate local deploy success, got %d", len(opsStore.successes))
	}
	if opsStore.active != nil {
		t.Fatalf("expected no active deploy after local-only success, got %#v", opsStore.active)
	}
}

func TestFilesystemPublisherHandlesCloudflareSuccessNotification(t *testing.T) {
	t.Parallel()

	source := &stubPublisherSource{}
	opsStore := &stubOperationalStore{
		active: &operational.ReleaseJob{
			ID:          "job-1",
			Type:        operational.ReleaseJobTypeDeploy,
			Status:      operational.ReleaseJobStatusWaitingResult,
			RequestedBy: "admin",
			Logs:        []string{"external_deploy_started"},
			Meta:        map[string]any{"trigger_mode": "cloudflare_pages_deploy_hook"},
			CreatedAt:   "2026-03-22T00:00:00Z",
			UpdatedAt:   "2026-03-22T00:00:00Z",
		},
	}

	publisher := NewFilesystemPublisher(source, newTestRepository(t, false), opsStore, "https://example.com/hook")
	payload := []byte(`{"name":"Pages project updates","text":"Deployment success","alert_type":"pages_project_updates","data":{"status":"success"}}`)
	if err := publisher.HandleCloudflareNotification(context.Background(), payload); err != nil {
		t.Fatalf("HandleCloudflareNotification returned error: %v", err)
	}
	if len(opsStore.successes) != 1 {
		t.Fatalf("expected success completion, got %d", len(opsStore.successes))
	}
	if opsStore.active != nil {
		t.Fatalf("expected no active deploy after success webhook, got %#v", opsStore.active)
	}
}

func TestFilesystemPublisherDeduplicatesMatchingActiveDeploy(t *testing.T) {
	t.Parallel()

	versionID := "version-home-001"
	source := &stubPublisherSource{
		home: store.HomeDocumentDTO{
			ID:                 "home",
			Status:             "published",
			CurrentVersionID:   &versionID,
			PublishedVersionID: &versionID,
		},
		homeVersions: map[string]store.HomeVersionDTO{
			versionID: {
				ID:     versionID,
				PageID: "home",
				Title:  "Homepage",
				Data:   map[string]any{"version": 1},
			},
		},
	}

	targetKey := buildDeployTargetKey(context.Background(), newTestRepository(t, false), BuildPreview(source, nil))
	opsStore := &stubOperationalStore{
		active: &operational.ReleaseJob{
			ID:          "job-1",
			Type:        operational.ReleaseJobTypeDeploy,
			Status:      operational.ReleaseJobStatusWaitingResult,
			RequestedBy: "admin",
			Logs:        []string{"external_deploy_started"},
			Meta:        map[string]any{"target_key": targetKey},
			CreatedAt:   "2026-03-22T00:00:00Z",
			UpdatedAt:   "2026-03-22T00:00:00Z",
		},
	}

	publisher := NewFilesystemPublisher(source, newTestRepository(t, false), opsStore, "https://example.com/hook")
	if err := publisher.Sync(context.Background()); err != nil {
		t.Fatalf("Sync returned error: %v", err)
	}
	if opsStore.nextID != 0 {
		t.Fatalf("expected no additional queued job, got %d", opsStore.nextID)
	}
	if len(opsStore.queue) != 0 {
		t.Fatalf("expected empty queue, got %d", len(opsStore.queue))
	}
}

func TestFilesystemPublisherRecoversStaleDispatchingJob(t *testing.T) {
	t.Parallel()

	source := &stubPublisherSource{}
	startedAt := "2000-01-01T00:00:00Z"
	snapshot := store.PublishPointerSnapshot{
		Home: store.PublishPointerState{ID: "home"},
	}
	opsStore := &stubOperationalStore{
		active: &operational.ReleaseJob{
			ID:          "job-stale",
			Type:        operational.ReleaseJobTypeDeploy,
			Status:      operational.ReleaseJobStatusDispatching,
			RequestedBy: "admin",
			Logs:        []string{"dispatching"},
			Meta:        map[string]any{"target_key": "stale"},
			CreatedAt:   "2000-01-01T00:00:00Z",
			UpdatedAt:   "2000-01-01T00:00:00Z",
			StartedAt:   &startedAt,
		},
		rollbackSnapshots: map[string]store.PublishPointerSnapshot{
			"job-stale": snapshot,
		},
	}

	publisher := NewFilesystemPublisher(source, newTestRepository(t, false), opsStore, "")
	if err := publisher.processNext(context.Background()); err != nil {
		t.Fatalf("processNext returned error: %v", err)
	}
	if source.restoreCalls != 1 {
		t.Fatalf("expected one rollback restore call, got %d", source.restoreCalls)
	}
	if len(opsStore.failures) != 1 {
		t.Fatalf("expected stale job failure, got %d", len(opsStore.failures))
	}
}
