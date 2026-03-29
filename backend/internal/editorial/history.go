package editorial

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"

	"github.com/hyunbridge/website/backend/internal/gitrepo"
	"gopkg.in/yaml.v3"
)

type History struct {
	repo *gitrepo.Repository
}

type Entry struct {
	CommitSHA   string
	CreatedAt   string
	Author      string
	AuthorEmail string
	Message     string
	Content     []byte
}

const CommitMetadataSchemaVersion = 1

type CommitMetadata struct {
	SchemaVersion int    `yaml:"schema_version"`
	Kind          string `yaml:"kind"`
	DocumentID    string `yaml:"document_id,omitempty"`
	Title         string `yaml:"title,omitempty"`
}

func NewHistory(repoConfig gitrepo.Config) *History {
	if strings.TrimSpace(repoConfig.Path) == "" {
		return nil
	}
	repoConfig.RemoteName = fallback(repoConfig.RemoteName, gitrepo.DefaultRemoteName)
	repo, err := gitrepo.New(repoConfig)
	if err != nil {
		return nil
	}
	return &History{repo: repo}
}

func (h *History) Repository() *gitrepo.Repository {
	if h == nil {
		return nil
	}
	return h.repo
}

func (h *History) EnsureReady(ctx context.Context) error {
	if h == nil || h.repo == nil {
		return errors.New("content repository is not configured")
	}
	return h.repo.EnsureReady(ctx)
}

func (h *History) Save(ctx context.Context, relativePath string, payload []byte, subject string, body string) (Entry, error) {
	return h.SaveAs(ctx, relativePath, payload, subject, body, nil)
}

func (h *History) SaveAs(ctx context.Context, relativePath string, payload []byte, subject string, body string, author *gitrepo.AuthorIdentity) (Entry, error) {
	if h == nil || h.repo == nil {
		return Entry{}, errors.New("content repository is not configured")
	}
	commit, err := h.repo.CommitFileAs(ctx, relativePath, payload, subject, body, author)
	if err != nil {
		return Entry{}, err
	}
	return Entry{
		CommitSHA:   commit.SHA,
		CreatedAt:   commit.CreatedAt,
		Author:      commit.Author,
		AuthorEmail: commit.AuthorEmail,
		Message:     commit.Summary,
		Content:     append([]byte(nil), payload...),
	}, nil
}

func (h *History) SaveFiles(ctx context.Context, files map[string][]byte, subject string, body string) (Entry, error) {
	return h.SaveFilesAs(ctx, files, subject, body, nil)
}

func (h *History) SaveFilesAs(ctx context.Context, files map[string][]byte, subject string, body string, author *gitrepo.AuthorIdentity) (Entry, error) {
	if h == nil || h.repo == nil {
		return Entry{}, errors.New("content repository is not configured")
	}
	commit, err := h.repo.CommitFilesAs(ctx, files, subject, body, author)
	if err != nil {
		return Entry{}, err
	}
	return Entry{
		CommitSHA:   commit.SHA,
		CreatedAt:   commit.CreatedAt,
		Author:      commit.Author,
		AuthorEmail: commit.AuthorEmail,
		Message:     commit.Summary,
	}, nil
}

func (h *History) History(ctx context.Context, relativePath string) ([]Entry, error) {
	if h == nil || h.repo == nil {
		return nil, errors.New("content repository is not configured")
	}
	commits, err := h.repo.FileHistory(ctx, relativePath)
	if err != nil {
		return nil, err
	}

	entries := make([]Entry, 0, len(commits))
	for _, commit := range commits {
		content, readErr := h.repo.FileAtCommit(ctx, relativePath, commit.SHA)
		if readErr != nil {
			if errors.Is(readErr, os.ErrNotExist) {
				continue
			}
			return nil, readErr
		}
		entries = append(entries, Entry{
			CommitSHA:   commit.SHA,
			CreatedAt:   commit.CreatedAt,
			Author:      commit.Author,
			AuthorEmail: commit.AuthorEmail,
			Message:     commit.Summary,
			Content:     content,
		})
	}
	return entries, nil
}

func (h *History) Get(ctx context.Context, relativePath string, commitSHA string) (Entry, error) {
	if h == nil || h.repo == nil {
		return Entry{}, errors.New("content repository is not configured")
	}
	commit, err := h.repo.GetCommit(ctx, commitSHA)
	if err != nil {
		return Entry{}, err
	}
	content, err := h.repo.FileAtCommit(ctx, relativePath, commitSHA)
	if err != nil {
		return Entry{}, err
	}
	return Entry{
		CommitSHA:   commit.SHA,
		CreatedAt:   commit.CreatedAt,
		Author:      commit.Author,
		AuthorEmail: commit.AuthorEmail,
		Message:     commit.Summary,
		Content:     content,
	}, nil
}

func (h *History) CommitBody(ctx context.Context, commitSHA string) (string, error) {
	if h == nil || h.repo == nil {
		return "", errors.New("content repository is not configured")
	}
	return h.repo.CommitBody(ctx, commitSHA)
}

func ParseCommitMetadata(body string) CommitMetadata {
	body = strings.TrimSpace(body)
	if body == "" {
		return CommitMetadata{}
	}

	var metadata CommitMetadata
	if err := decodeYAMLStrict(body, &metadata); err != nil {
		return CommitMetadata{}
	}
	if metadata.SchemaVersion != CommitMetadataSchemaVersion || strings.TrimSpace(metadata.Kind) == "" {
		return CommitMetadata{}
	}
	return metadata
}

func decodeYAMLStrict(body string, target any) error {
	decoder := yaml.NewDecoder(strings.NewReader(body))
	decoder.KnownFields(true)
	return decoder.Decode(target)
}

func MarshalCommitBody(metadata CommitMetadata) string {
	body, err := yaml.Marshal(metadata)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(body))
}

func PrettyJSON(value any) ([]byte, error) {
	return json.MarshalIndent(value, "", "  ")
}

func fallback(value string, fallbackValue string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallbackValue
	}
	return value
}
