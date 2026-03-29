package operational

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/hyunbridge/website/backend/internal/contentmd"
	"github.com/hyunbridge/website/backend/internal/gitrepo"
	"gopkg.in/yaml.v3"
)

const (
	deployTagPrefix = "refs/tags/publish/"
	deployLiveRef   = "refs/publish/deploy/live"
)

type GitStore struct {
	repo          *gitrepo.Repository
	publicBaseURL *string
	now           func() time.Time
}

func NewGitStore(repo *gitrepo.Repository, publicBaseURL string) (*GitStore, error) {
	if repo == nil {
		return nil, errors.New("editorial git repository is not configured")
	}
	publicBaseURL = strings.TrimSpace(publicBaseURL)
	return &GitStore{
		repo:          repo,
		publicBaseURL: stringPtr(publicBaseURL),
		now:           time.Now,
	}, nil
}

func (s *GitStore) Dashboard(limit int) (Dashboard, error) {
	if s == nil || s.repo == nil {
		return Dashboard{}, nil
	}
	if limit <= 0 {
		limit = 20
	}

	jobs, err := s.listDeployJobs(limit)
	if err != nil {
		return Dashboard{}, err
	}

	liveState, err := s.readLiveState(jobs)
	if err != nil {
		return Dashboard{}, err
	}

	return Dashboard{
		LiveState: liveState,
		Jobs:      jobs,
	}, nil
}

func (s *GitStore) GetLiveState() (*LiveState, error) {
	if s == nil || s.repo == nil {
		return nil, nil
	}
	return s.readLiveState(nil)
}

func (s *GitStore) RecordDeploySuccess(_ string, commitSHA string, _ string, _ int, _ int, manifestYAML string) error {
	if s == nil || s.repo == nil {
		return nil
	}

	now := s.now().UTC()
	tagName := "publish/" + now.Format("20060102-150405.000000000Z")
	subject := "deploy: " + now.Format(time.RFC3339)
	tagObjectSHA, err := s.repo.CreateAnnotatedTag(context.Background(), tagName, strings.TrimSpace(commitSHA), subject, strings.TrimSpace(manifestYAML))
	if err != nil {
		return err
	}

	return s.repo.UpdateReference(context.Background(), deployLiveRef, tagObjectSHA)
}

func (s *GitStore) RecordDeployFailure(_ string, _ string) error {
	return nil
}

func (s *GitStore) listDeployJobs(limit int) ([]ReleaseJob, error) {
	tags, err := s.repo.ListTags(context.Background(), deployTagPrefix, limit)
	if err != nil {
		return nil, err
	}

	jobs := make([]ReleaseJob, 0, len(tags))
	for _, tag := range tags {
		createdAt := strings.TrimSpace(tag.CreatedAt)
		manifest := parseDeployManifest(tag.Body)
		if manifest != nil {
			for index := range manifest.Changes {
				fromMetadata, fromBody := s.loadSnapshotParts(manifest.Changes[index], strings.TrimSpace(derefString(manifest.Changes[index].From)))
				toMetadata, toBody := s.loadSnapshotParts(manifest.Changes[index], strings.TrimSpace(derefString(manifest.Changes[index].To)))
				manifest.Changes[index].FromMetadata = fromMetadata
				manifest.Changes[index].ToMetadata = toMetadata
				manifest.Changes[index].FromBody = fromBody
				manifest.Changes[index].ToBody = toBody
				manifest.Changes[index].Diff = s.loadChangeDiff(manifest.Changes[index])
				manifest.Changes[index].Commits = s.listChangeCommits(manifest.Changes[index])
			}
			if createdAt == "" {
				createdAt = strings.TrimSpace(manifest.PublishedAt)
			}
		}

		meta := map[string]any{
			"tag_name":   tag.Name,
			"ref_name":   tag.RefName,
			"tag_object": tag.TagObjectSHA,
		}
		if manifest != nil {
			meta["site_commit"] = manifest.SiteCommit
			meta["total_count"] = manifest.Summary.TotalCount
			meta["publish_count"] = manifest.Summary.PublishCount
			meta["update_count"] = manifest.Summary.UpdateCount
			meta["unpublish_count"] = manifest.Summary.UnpublishCount
		}

		requestedBy := "system"
		if manifest != nil {
			requestedBy = normalizeActor(manifest.Actor)
		}
		jobs = append(jobs, ReleaseJob{
			ID:          tag.Name,
			Type:        "deploy",
			Status:      "succeeded",
			CommitSHA:   stringPtr(strings.TrimSpace(tag.TargetCommitSHA)),
			RequestedBy: requestedBy,
			Logs:        compactStrings(tag.Subject),
			Meta:        meta,
			Manifest:    manifest,
			CreatedAt:   createdAt,
			UpdatedAt:   createdAt,
		})
	}

	return jobs, nil
}

func (s *GitStore) readLiveState(jobs []ReleaseJob) (*LiveState, error) {
	tagObjectSHA, liveCommit, err := s.repo.ResolveReference(context.Background(), deployLiveRef)
	if err != nil {
		if isMissingGitRefError(err) {
			return nil, nil
		}
		return nil, err
	}
	if strings.TrimSpace(tagObjectSHA) == "" {
		return nil, nil
	}

	tagRefName, err := s.repo.FirstReferencePointingTo(context.Background(), tagObjectSHA, deployTagPrefix)
	if err != nil {
		return nil, err
	}
	liveTagName := strings.TrimPrefix(strings.TrimSpace(tagRefName), "refs/tags/")

	var lastSuccessfulAt *string
	if liveTagName != "" {
		for _, job := range jobs {
			if job.ID == liveTagName {
				lastSuccessfulAt = stringPtr(job.CreatedAt)
				break
			}
		}
	}

	return &LiveState{
		ID:               "live",
		LiveCommitSHA:    liveCommit,
		LastDeployJobID:  stringPtr(liveTagName),
		LastSuccessfulAt: lastSuccessfulAt,
		PublicBaseURL:    stringPtr(derefString(s.publicBaseURL)),
	}, nil
}

func compactStrings(values ...string) []string {
	items := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			items = append(items, value)
		}
	}
	return items
}

func (s *GitStore) listChangeCommits(change PublishManifestChange) []PublishManifestCommit {
	path := deployChangePath(change)
	if path == "" || strings.TrimSpace(derefString(change.To)) == "" {
		return nil
	}

	commits, err := s.repo.CommitsForPath(
		context.Background(),
		path,
		strings.TrimSpace(derefString(change.From)),
		strings.TrimSpace(derefString(change.To)),
	)
	if err != nil {
		return nil
	}

	items := make([]PublishManifestCommit, 0, len(commits))
	for _, commit := range commits {
		diff, diffErr := s.repo.CommitDiff(context.Background(), commit.SHA, path)
		if diffErr != nil {
			diff = ""
		}
		items = append(items, PublishManifestCommit{
			SHA:       commit.SHA,
			CreatedAt: commit.CreatedAt,
			Author:    commit.Author,
			Message:   strings.TrimSpace(commit.Summary),
			Diff:      diff,
		})
	}

	return items
}

func (s *GitStore) loadChangeDiff(change PublishManifestChange) string {
	path := deployChangePath(change)
	if path == "" {
		return ""
	}

	diff, err := s.repo.DiffPath(
		context.Background(),
		strings.TrimSpace(derefString(change.From)),
		strings.TrimSpace(derefString(change.To)),
		path,
	)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(diff)
}

func (s *GitStore) loadSnapshotParts(change PublishManifestChange, commitSHA string) (string, string) {
	path := deployChangePath(change)
	if path == "" || strings.TrimSpace(commitSHA) == "" {
		return "", ""
	}

	payload, err := s.repo.FileAtCommit(context.Background(), path, commitSHA)
	if err != nil {
		return "", ""
	}

	switch strings.TrimSpace(change.Kind) {
	case "home":
		var raw map[string]any
		if err := json.Unmarshal(payload, &raw); err != nil {
			return "", strings.TrimSpace(string(payload))
		}

		body := ""
		if data, ok := raw["data"]; ok {
			body = formatJSONValue(data)
		}
		delete(raw, "data")

		delete(raw, "id")
		return formatJSONValue(raw), body
	case "post":
		document, err := contentmd.ParseEditorialPostDocument(payload)
		if err != nil {
			return "", strings.TrimSpace(string(payload))
		}
		return formatJSONValue(contentmd.EditorialPostMetadata(document)), strings.TrimSpace(document.BodyMarkdown)
	case "project":
		document, err := contentmd.ParseEditorialProjectDocument(payload)
		if err != nil {
			return "", strings.TrimSpace(string(payload))
		}
		return formatJSONValue(contentmd.EditorialProjectMetadata(document)), strings.TrimSpace(document.BodyMarkdown)
	default:
		return "", strings.TrimSpace(string(payload))
	}
}

func formatJSONValue(value any) string {
	if value == nil {
		return ""
	}
	encoded, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(encoded))
}

func deployChangePath(change PublishManifestChange) string {
	switch strings.TrimSpace(change.Kind) {
	case "home":
		return "pages/home.json"
	case "post":
		if strings.TrimSpace(change.DocumentID) == "" {
			return ""
		}
		return "posts/" + change.DocumentID + ".md"
	case "project":
		if strings.TrimSpace(change.DocumentID) == "" {
			return ""
		}
		return "projects/" + change.DocumentID + ".md"
	default:
		return ""
	}
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func parseUnixTimestamp(value string) (string, error) {
	unixSeconds, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil {
		return "", err
	}
	return time.Unix(unixSeconds, 0).UTC().Format(time.RFC3339), nil
}

func isMissingGitRefError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "not found") ||
		strings.Contains(message, "unknown revision") ||
		strings.Contains(message, "ambiguous argument") ||
		strings.Contains(message, "bad revision") ||
		strings.Contains(message, "Needed a single revision") ||
		strings.Contains(message, "not a valid object name")
}

func parseDeployManifest(body string) *PublishManifest {
	body = strings.TrimSpace(body)
	if body == "" {
		return nil
	}

	var manifest PublishManifest
	if err := decodeYAMLStrict(body, &manifest); err != nil {
		return nil
	}
	if manifest.SchemaVersion != DeployManifestSchemaVersion || strings.TrimSpace(manifest.Kind) != "deploy" {
		return nil
	}
	manifest.Actor = normalizeActor(manifest.Actor)
	return &manifest
}

func decodeYAMLStrict(body string, target any) error {
	decoder := yaml.NewDecoder(strings.NewReader(body))
	decoder.KnownFields(true)
	return decoder.Decode(target)
}
