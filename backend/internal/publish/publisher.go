package publish

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/hyunbridge/website/backend/internal/gitrepo"
	"github.com/hyunbridge/website/backend/internal/operational"
	"github.com/hyunbridge/website/backend/internal/store"
	"gopkg.in/yaml.v3"
)

type SitePublisher interface {
	Sync(ctx context.Context) error
	HandleCloudflareNotification(ctx context.Context, body []byte) error
}

type FilesystemPublisher struct {
	source        PublishedSiteSource
	repo          *gitrepo.Repository
	opsStore      operational.Store
	deployHookURL string
	httpClient    *http.Client
}

type actorContextKey struct{}

type cloudflareNotification struct {
	Name               string         `json:"name"`
	Text               string         `json:"text"`
	Data               map[string]any `json:"data"`
	AlertType          string         `json:"alert_type"`
	AlertEvent         string         `json:"alert_event"`
	AlertCorrelationID string         `json:"alert_correlation_id"`
}

func WithActor(ctx context.Context, actor string) context.Context {
	if actor == "" {
		return ctx
	}
	return context.WithValue(ctx, actorContextKey{}, actor)
}

func actorFromContext(ctx context.Context) string {
	actor, _ := ctx.Value(actorContextKey{}).(string)
	return actor
}

func normalizeActor(actor string) string {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return "system"
	}
	return actor
}

func NewFilesystemPublisher(source PublishedSiteSource, repo *gitrepo.Repository, opsStore operational.Store, deployHookURL string) *FilesystemPublisher {
	if source == nil || repo == nil || opsStore == nil {
		return nil
	}
	return &FilesystemPublisher{
		source:        source,
		repo:          repo,
		opsStore:      opsStore,
		deployHookURL: strings.TrimSpace(deployHookURL),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (p *FilesystemPublisher) Sync(ctx context.Context) error {
	if p == nil {
		return nil
	}
	preview := BuildPreview(p.source, p.liveSnapshot())
	targetKey := buildDeployTargetKey(ctx, p.repo, preview)
	if _, err := p.opsStore.EnqueueDeploy(actorFromContext(ctx), targetKey); err != nil {
		return err
	}
	return p.processNext(ctx)
}

func (p *FilesystemPublisher) HandleCloudflareNotification(ctx context.Context, body []byte) error {
	if p == nil || p.opsStore == nil {
		return nil
	}

	var notification cloudflareNotification
	if err := json.Unmarshal(body, &notification); err != nil {
		return err
	}

	outcome := classifyCloudflareNotification(notification)
	if outcome == "" || outcome == "started" {
		return nil
	}

	activeJob, err := p.opsStore.GetActiveDeploy()
	if err != nil || activeJob == nil {
		return err
	}
	if strings.TrimSpace(activeJob.Status) != operational.ReleaseJobStatusWaitingResult {
		return nil
	}

	switch outcome {
	case "success":
		if err := p.opsStore.CompleteActiveDeploySuccess(activeJob.ID, p.source.CapturePublishedPointerSnapshot()); err != nil {
			return err
		}
	case "failure":
		snapshot, err := p.opsStore.GetRollbackSnapshot(activeJob.ID)
		if err != nil {
			return err
		}
		if snapshot != nil {
			if err := p.source.RestorePublishedPointerSnapshot(*snapshot); err != nil {
				return err
			}
		}
		reason := strings.TrimSpace(notification.Text)
		if reason == "" {
			reason = "cloudflare deployment failed"
		}
		if err := p.opsStore.CompleteActiveDeployFailure(activeJob.ID, reason); err != nil {
			return err
		}
	default:
		return nil
	}

	return p.processNext(ctx)
}

func (p *FilesystemPublisher) processNext(ctx context.Context) error {
	if p == nil || p.opsStore == nil {
		return nil
	}
	if err := p.recoverStaleDispatchingJob(); err != nil {
		return err
	}
	job, err := p.opsStore.ClaimNextDeploy()
	if err != nil || job == nil {
		return err
	}
	return p.dispatchClaimedJob(ctx, *job)
}

func (p *FilesystemPublisher) dispatchClaimedJob(ctx context.Context, job operational.ReleaseJob) error {
	if p.repo == nil {
		return p.failAndContinue(job.ID, "editorial git repository is not initialized")
	}
	if err := p.repo.EnsureReady(ctx); err != nil {
		return p.failAndContinue(job.ID, err.Error())
	}

	preview := BuildPreview(p.source, p.liveSnapshot())
	snapshot := p.source.CapturePublishedPointerSnapshot()
	if err := p.opsStore.MarkActiveDeployPreparation(job.ID, snapshot); err != nil {
		return p.failAndContinue(job.ID, err.Error())
	}

	if err := p.source.SyncPublishedContentPointers(); err != nil {
		_ = p.source.RestorePublishedPointerSnapshot(snapshot)
		return p.failAndContinue(job.ID, err.Error())
	}

	commitSHA, err := p.repo.HeadCommitSHA(ctx)
	if err != nil {
		_ = p.source.RestorePublishedPointerSnapshot(snapshot)
		return p.failAndContinue(job.ID, err.Error())
	}

	manifest := buildDeployManifest(actorFromContext(ctx), strings.TrimSpace(commitSHA), preview)
	posts := p.source.ListPostDTOs(false)
	projects := p.source.ListProjectDTOs(false)
	if err := p.opsStore.UpdateActiveDeployDispatch(
		job.ID,
		strings.TrimSpace(commitSHA),
		p.repo.Path(),
		len(posts),
		len(projects),
		manifest,
		snapshot,
		p.deployHookURL,
	); err != nil {
		_ = p.source.RestorePublishedPointerSnapshot(snapshot)
		return p.failAndContinue(job.ID, err.Error())
	}

	if strings.TrimSpace(p.deployHookURL) == "" {
		if err := p.opsStore.CompleteActiveDeploySuccess(job.ID, p.source.CapturePublishedPointerSnapshot()); err != nil {
			return err
		}
		return p.processNext(ctx)
	}

	if err := p.triggerDeployHook(ctx); err != nil {
		_ = p.source.RestorePublishedPointerSnapshot(snapshot)
		return p.failAndContinue(job.ID, fmt.Sprintf("trigger cloudflare pages deploy hook: %v", err))
	}

	return nil
}

func (p *FilesystemPublisher) liveSnapshot() *store.PublishPointerSnapshot {
	if p == nil || p.opsStore == nil {
		return nil
	}
	state, err := p.opsStore.GetLiveState()
	if err != nil || state == nil {
		return nil
	}
	return state.LivePointers
}

func (p *FilesystemPublisher) failAndContinue(jobID string, reason string) error {
	if p == nil || p.opsStore == nil {
		return nil
	}
	if err := p.opsStore.CompleteActiveDeployFailure(jobID, reason); err != nil {
		return err
	}
	return p.processNext(context.Background())
}

func (p *FilesystemPublisher) triggerDeployHook(ctx context.Context) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, p.deployHookURL, http.NoBody)
	if err != nil {
		return err
	}
	response, err := p.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return nil
	}
	payload, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
	if len(payload) == 0 {
		return fmt.Errorf("unexpected status %d", response.StatusCode)
	}
	return fmt.Errorf("unexpected status %d: %s", response.StatusCode, strings.TrimSpace(string(payload)))
}

func buildDeployManifest(actor string, siteCommit string, preview Preview) operational.PublishManifest {
	actor = normalizeActor(actor)
	manifest := operational.PublishManifest{
		SchemaVersion: operational.DeployManifestSchemaVersion,
		Kind:          "deploy",
		PublishedAt:   timeNowUTC(),
		Actor:         actor,
		SiteCommit:    siteCommit,
		Summary: operational.PublishManifestSummary{
			PublishCount:   preview.Summary.PublishCount,
			UpdateCount:    preview.Summary.UpdateCount,
			UnpublishCount: preview.Summary.UnpublishCount,
			TotalCount:     preview.Summary.TotalCount,
		},
		Changes: make([]operational.PublishManifestChange, 0, len(preview.Items)),
	}

	for _, item := range preview.Items {
		manifest.Changes = append(manifest.Changes, operational.PublishManifestChange{
			Kind:       item.Kind,
			DocumentID: item.ID,
			Title:      item.Title,
			Slug:       item.Slug,
			ChangeType: item.ChangeType,
			From:       item.LiveVersionID,
			To:         item.TargetVersionID,
		})
	}

	return manifest
}

func buildDeployManifestYAML(actor string, siteCommit string, preview Preview) (string, error) {
	manifest := buildDeployManifest(actor, siteCommit, preview)
	body, err := yaml.Marshal(manifest)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(body)), nil
}

func classifyCloudflareNotification(notification cloudflareNotification) string {
	alertType := strings.ToLower(strings.TrimSpace(notification.AlertType))
	if alertType != "" && !strings.Contains(alertType, "pages") {
		return ""
	}

	if status := normalizedNotificationStatus(notification.Data); status != "" {
		switch status {
		case "success", "succeeded", "successful":
			return "success"
		case "failed", "failure", "error":
			return "failure"
		case "started", "queued", "in_progress", "running":
			return "started"
		}
	}

	joined := strings.ToLower(strings.Join([]string{
		notification.Name,
		notification.Text,
		notification.AlertType,
		notification.AlertEvent,
		extractNotificationDataText(notification.Data),
	}, " "))

	switch {
	case containsAny(joined, "deployment failed", "deploy failed", "build failed", " failed ", " failure ", "error"):
		return "failure"
	case containsAny(joined, "deployment success", "deploy success", "successful", " succeeded ", "successfully"):
		return "success"
	case containsAny(joined, "deployment started", "deploy started", "started", "in progress", "queued"):
		return "started"
	default:
		return ""
	}
}

func normalizedNotificationStatus(data map[string]any) string {
	for _, key := range []string{"status", "result", "deployment_status", "state"} {
		value, ok := data[key]
		if !ok {
			continue
		}
		text := strings.ToLower(strings.TrimSpace(fmt.Sprint(value)))
		if text != "" {
			return text
		}
	}
	return ""
}

func extractNotificationDataText(data map[string]any) string {
	if len(data) == 0 {
		return ""
	}
	parts := make([]string, 0, len(data))
	for _, key := range []string{"status", "result", "event", "deployment_status", "project_name", "environment"} {
		value, ok := data[key]
		if !ok {
			continue
		}
		parts = append(parts, fmt.Sprint(value))
	}
	return strings.ToLower(strings.Join(parts, " "))
}

func buildDeployTargetKey(ctx context.Context, repo *gitrepo.Repository, preview Preview) string {
	payload := map[string]any{
		"summary": preview.Summary,
		"items":   preview.Items,
	}
	if repo != nil {
		if head, err := repo.HeadCommitSHA(ctx); err == nil && strings.TrimSpace(head) != "" {
			payload["head"] = strings.TrimSpace(head)
		}
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return ""
	}
	return string(encoded)
}

func (p *FilesystemPublisher) recoverStaleDispatchingJob() error {
	activeJob, err := p.opsStore.GetActiveDeploy()
	if err != nil || activeJob == nil {
		return err
	}
	if strings.TrimSpace(activeJob.Status) != operational.ReleaseJobStatusDispatching {
		return nil
	}
	if !isJobOlderThan(activeJob.StartedAt, 2*time.Minute) {
		return nil
	}

	snapshot, err := p.opsStore.GetRollbackSnapshot(activeJob.ID)
	if err != nil {
		return err
	}
	if snapshot != nil {
		if err := p.source.RestorePublishedPointerSnapshot(*snapshot); err != nil {
			return err
		}
	}
	return p.failAndContinue(activeJob.ID, "deploy dispatcher was interrupted")
}

func isJobOlderThan(value *string, duration time.Duration) bool {
	if value == nil || strings.TrimSpace(*value) == "" {
		return false
	}
	timestamp, err := time.Parse(time.RFC3339, strings.TrimSpace(*value))
	if err != nil {
		return false
	}
	return time.Since(timestamp) > duration
}

func containsAny(haystack string, needles ...string) bool {
	for _, needle := range needles {
		if strings.Contains(haystack, strings.ToLower(needle)) {
			return true
		}
	}
	return false
}

func timeNowUTC() string {
	return time.Now().UTC().Format(time.RFC3339)
}
