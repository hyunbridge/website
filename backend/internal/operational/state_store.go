package operational

import contentstore "github.com/hyunbridge/website/backend/internal/store"

type Dashboard struct {
	LiveState *LiveState   `json:"live_state,omitempty"`
	Jobs      []ReleaseJob `json:"jobs"`
}

type Store interface {
	Dashboard(limit int) (Dashboard, error)
	GetLiveState() (*LiveState, error)
	EnqueueDeploy(actor string, targetKey string) (ReleaseJob, error)
	ClaimNextDeploy() (*ReleaseJob, error)
	GetActiveDeploy() (*ReleaseJob, error)
	GetRollbackSnapshot(jobID string) (*contentstore.PublishPointerSnapshot, error)
	MarkActiveDeployPreparation(jobID string, rollback contentstore.PublishPointerSnapshot) error
	UpdateActiveDeployDispatch(jobID string, commitSHA string, repoDir string, postCount int, projectCount int, manifest PublishManifest, rollback contentstore.PublishPointerSnapshot, deployHookURL string) error
	CompleteActiveDeploySuccess(jobID string, live contentstore.PublishPointerSnapshot) error
	CompleteActiveDeployFailure(jobID string, reason string) error
}

func cloneJobs(jobs []ReleaseJob, limit int) []ReleaseJob {
	if limit <= 0 || limit > len(jobs) {
		limit = len(jobs)
	}
	items := make([]ReleaseJob, 0, limit)
	for _, job := range jobs[:limit] {
		copyJob := job
		if job.CommitSHA != nil {
			commit := *job.CommitSHA
			copyJob.CommitSHA = &commit
		}
		if job.Logs != nil {
			copyJob.Logs = append([]string{}, job.Logs...)
		}
		if job.Meta != nil {
			copyJob.Meta = cloneMap(job.Meta)
		}
		if job.Manifest != nil {
			copyManifest := *job.Manifest
			if job.Manifest.Changes != nil {
				copyManifest.Changes = append([]PublishManifestChange{}, job.Manifest.Changes...)
			}
			copyJob.Manifest = &copyManifest
		}
		if job.StartedAt != nil {
			value := *job.StartedAt
			copyJob.StartedAt = &value
		}
		if job.CompletedAt != nil {
			value := *job.CompletedAt
			copyJob.CompletedAt = &value
		}
		items = append(items, copyJob)
	}
	return items
}

func cloneLiveState(state *LiveState) *LiveState {
	if state == nil {
		return nil
	}
	copyState := *state
	if state.LastDeployJobID != nil {
		value := *state.LastDeployJobID
		copyState.LastDeployJobID = &value
	}
	if state.LastSuccessfulAt != nil {
		value := *state.LastSuccessfulAt
		copyState.LastSuccessfulAt = &value
	}
	if state.PublicBaseURL != nil {
		value := *state.PublicBaseURL
		copyState.PublicBaseURL = &value
	}
	if state.LivePointers != nil {
		snapshot := clonePublishPointerSnapshot(*state.LivePointers)
		copyState.LivePointers = &snapshot
	}
	return &copyState
}

func clonePublishPointerSnapshot(snapshot contentstore.PublishPointerSnapshot) contentstore.PublishPointerSnapshot {
	clone := contentstore.PublishPointerSnapshot{
		Posts:    append([]contentstore.PublishPointerState{}, snapshot.Posts...),
		Projects: append([]contentstore.PublishPointerState{}, snapshot.Projects...),
		Home:     snapshot.Home,
	}
	return clone
}

func cloneMap(source map[string]any) map[string]any {
	if source == nil {
		return nil
	}
	copyMap := make(map[string]any, len(source))
	for key, value := range source {
		copyMap[key] = value
	}
	return copyMap
}

func normalizeActor(actor string) string {
	if actor == "" {
		return "system"
	}
	return actor
}

func stringPtr(value string) *string {
	if value == "" {
		return nil
	}
	copy := value
	return &copy
}
