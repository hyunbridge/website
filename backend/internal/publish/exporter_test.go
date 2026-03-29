package publish

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/hyunbridge/website/backend/internal/store"
)

type stubPostSource struct {
	posts           []store.PostDTO
	postVersions    map[string]store.PostVersionDTO
	projects        []store.ProjectDTO
	projectVersions map[string]store.ProjectVersionDTO
	home            store.HomeDocumentDTO
	homeVersions    map[string]store.HomeVersionDTO
	tags            []store.TagDTO
}

func (s stubPostSource) ListPostDTOs(includeDraft bool) []store.PostDTO {
	return s.posts
}

func (s stubPostSource) GetPostVersionByID(versionID string) (store.PostVersionDTO, error) {
	version, ok := s.postVersions[versionID]
	if !ok {
		return store.PostVersionDTO{}, store.ErrNotFound()
	}
	return version, nil
}

func (s stubPostSource) ListProjectDTOs(includeDraft bool) []store.ProjectDTO {
	return s.projects
}

func (s stubPostSource) GetProjectVersionByID(versionID string) (store.ProjectVersionDTO, error) {
	version, ok := s.projectVersions[versionID]
	if !ok {
		return store.ProjectVersionDTO{}, store.ErrNotFound()
	}
	return version, nil
}

func (s stubPostSource) GetHomeDocument() store.HomeDocumentDTO {
	return s.home
}

func (s stubPostSource) GetHomeVersionByID(versionID string) (store.HomeVersionDTO, error) {
	version, ok := s.homeVersions[versionID]
	if !ok {
		return store.HomeVersionDTO{}, store.ErrNotFound()
	}
	return version, nil
}

func (s stubPostSource) SyncPublishedContentPointers() error {
	return nil
}

func (s stubPostSource) CapturePublishedPointerSnapshot() store.PublishPointerSnapshot {
	return store.PublishPointerSnapshot{}
}

func (s stubPostSource) RestorePublishedPointerSnapshot(snapshot store.PublishPointerSnapshot) error {
	return nil
}

func (s stubPostSource) ListTags() []store.TagDTO {
	return s.tags
}

func TestExportPublishedPostsWritesMarkdownDocuments(t *testing.T) {
	t.Parallel()

	publishedVersionID := "version-post-001"
	publishedAt := "2026-03-15T00:00:00Z"
	postSource := stubPostSource{
		posts: []store.PostDTO{
			{
				ID:                 "post-001",
				CreatedAt:          "2026-03-14T00:00:00Z",
				UpdatedAt:          "2026-03-15T12:00:00Z",
				Title:              "Git Native Publishing",
				Slug:               "git-native-publishing",
				Summary:            "Move published content out of the database.",
				PublishedAt:        &publishedAt,
				CurrentVersionID:   &publishedVersionID,
				PublishedVersionID: &publishedVersionID,
				EnableComments:     true,
				Tags: []store.TagDTO{
					{ID: "tag-001", Name: "architecture", Slug: "architecture"},
				},
				Author: store.AuthorDTO{
					FullName: "Admin User",
				},
			},
		},
		postVersions: map[string]store.PostVersionDTO{
			publishedVersionID: {
				ID:      publishedVersionID,
				PostID:  "post-001",
				Title:   "Git Native Publishing",
				Summary: "Move published content out of the database.",
				Content: "hello",
			},
		},
		home: store.HomeDocumentDTO{
			ID:                 "home",
			Status:             "published",
			CurrentVersionID:   &publishedVersionID,
			PublishedVersionID: &publishedVersionID,
		},
		homeVersions: map[string]store.HomeVersionDTO{
			publishedVersionID: {
				ID:     publishedVersionID,
				PageID: "home",
				Title:  "Homepage",
				Data: map[string]any{
					"version": 1,
				},
			},
		},
		tags: []store.TagDTO{
			{ID: "tag-001", Name: "architecture", Slug: "architecture"},
		},
	}

	exportRoot := filepath.Join(t.TempDir(), "published")
	exporter := NewExporter(postSource)
	exporter.now = func() time.Time {
		return time.Date(2026, time.March, 16, 12, 0, 0, 0, time.UTC)
	}

	documents, err := exporter.ExportPublishedPosts(context.Background(), exportRoot)
	if err != nil {
		t.Fatalf("ExportPublishedPosts returned error: %v", err)
	}

	if len(documents) == 0 {
		t.Fatal("expected published posts to be exported")
	}

	postPayload, err := os.ReadFile(filepath.Join(exportRoot, "posts", documents[0].Slug+".md"))
	if err != nil {
		t.Fatalf("failed to read exported markdown: %v", err)
	}

	markdown := string(postPayload)
	if strings.Contains(markdown, "publishedVersionId:") || strings.Contains(markdown, "updatedAt:") {
		t.Fatalf("expected internal publish metadata to be omitted, got %s", markdown)
	}
	if !strings.Contains(markdown, "hello") {
		t.Fatalf("expected markdown body in exported document, got %s", markdown)
	}

	releasePayload, err := os.ReadFile(filepath.Join(exportRoot, "meta", "release.json"))
	if err != nil {
		t.Fatalf("failed to read release metadata: %v", err)
	}
	if !strings.Contains(string(releasePayload), `"generated_at": "2026-03-16T12:00:00Z"`) {
		t.Fatalf("unexpected release metadata: %s", string(releasePayload))
	}
}

func TestExportPublishedPostsUsesPublishedVersionInsteadOfCurrentDraft(t *testing.T) {
	t.Parallel()

	publishedVersionID := "version-post-published"
	currentVersionID := "version-post-draft"
	publishedAt := "2026-03-15T00:00:00Z"
	postSource := stubPostSource{
		posts: []store.PostDTO{
			{
				ID:                 "post-001",
				CreatedAt:          "2026-03-14T00:00:00Z",
				UpdatedAt:          "2026-03-15T12:00:00Z",
				Title:              "Git Native Publishing",
				Slug:               "git-native-publishing",
				Summary:            "Move published content out of the database.",
				PublishedAt:        &publishedAt,
				CurrentVersionID:   &currentVersionID,
				PublishedVersionID: &publishedVersionID,
				EnableComments:     true,
				Author:             store.AuthorDTO{FullName: "Admin User"},
			},
		},
		postVersions: map[string]store.PostVersionDTO{
			publishedVersionID: {
				ID:      publishedVersionID,
				PostID:  "post-001",
				Title:   "Published Version",
				Summary: "published",
				Content: "published body",
			},
			currentVersionID: {
				ID:      currentVersionID,
				PostID:  "post-001",
				Title:   "Draft Version",
				Summary: "draft",
				Content: "draft body",
			},
		},
	}

	exportRoot := filepath.Join(t.TempDir(), "published")
	exporter := NewExporter(postSource)
	documents, err := exporter.ExportPublishedPosts(context.Background(), exportRoot)
	if err != nil {
		t.Fatalf("ExportPublishedPosts returned error: %v", err)
	}
	if len(documents) != 1 {
		t.Fatalf("expected one exported post, got %d", len(documents))
	}
	if documents[0].BodyMarkdown != "published body" {
		t.Fatalf("expected published body, got %q", documents[0].BodyMarkdown)
	}
	if strings.Contains(documents[0].BodyMarkdown, "draft") {
		t.Fatalf("draft body leaked into published export: %q", documents[0].BodyMarkdown)
	}
}

func TestExportPublishedProjectsUsesPublishedVersionInsteadOfCurrentDraft(t *testing.T) {
	t.Parallel()

	publishedVersionID := "version-project-published"
	currentVersionID := "version-project-draft"
	publishedAt := "2026-03-15T00:00:00Z"
	projectSource := stubPostSource{
		projects: []store.ProjectDTO{
			{
				ID:                 "project-001",
				CreatedAt:          "2026-03-14T00:00:00Z",
				UpdatedAt:          "2026-03-15T12:00:00Z",
				Title:              "Git Native Project",
				Slug:               "git-native-project",
				Summary:            "Ship a markdown publish repo.",
				PublishedAt:        &publishedAt,
				CurrentVersionID:   &currentVersionID,
				PublishedVersionID: &publishedVersionID,
				Owner:              store.AuthorDTO{FullName: "Admin User"},
			},
		},
		projectVersions: map[string]store.ProjectVersionDTO{
			publishedVersionID: {
				ID:        publishedVersionID,
				ProjectID: "project-001",
				Title:     "Published Project Version",
				Summary:   "published",
				Content:   "published project body",
				Links: []store.ProjectLinkDTO{
					{ID: "link-published", ProjectID: "project-001", Label: "Published", URL: "https://published.example.com", SortOrder: 0},
				},
			},
			currentVersionID: {
				ID:        currentVersionID,
				ProjectID: "project-001",
				Title:     "Draft Project Version",
				Summary:   "draft",
				Content:   "draft project body",
				Links: []store.ProjectLinkDTO{
					{ID: "link-draft", ProjectID: "project-001", Label: "Draft", URL: "https://draft.example.com", SortOrder: 0},
				},
			},
		},
	}

	exportRoot := filepath.Join(t.TempDir(), "published")
	exporter := NewExporter(projectSource)
	export, err := exporter.ExportPublishedSite(context.Background(), exportRoot)
	if err != nil {
		t.Fatalf("ExportPublishedSite returned error: %v", err)
	}
	if len(export.Projects) != 1 {
		t.Fatalf("expected one exported project, got %d", len(export.Projects))
	}
	if export.Projects[0].BodyMarkdown != "published project body" {
		t.Fatalf("expected published project body, got %q", export.Projects[0].BodyMarkdown)
	}
	if len(export.Projects[0].Links) != 1 || export.Projects[0].Links[0].URL != "https://published.example.com" {
		t.Fatalf("expected published project links, got %#v", export.Projects[0].Links)
	}
}

func TestReaderLoadsPublishedMarkdownDocuments(t *testing.T) {
	t.Parallel()

	rootDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(rootDir, "posts"), 0o755); err != nil {
		t.Fatalf("mkdir posts: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(rootDir, "projects"), 0o755); err != nil {
		t.Fatalf("mkdir projects: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(rootDir, "pages"), 0o755); err != nil {
		t.Fatalf("mkdir pages: %v", err)
	}

	postDocument := `---
id: "post-001"
slug: "git-native-publishing"
title: "Git Native Publishing"
summary: "Move published content out of the database."
createdAt: "2026-03-14T00:00:00Z"
publishedAt: "2026-03-15T00:00:00Z"
enableComments: true
coverImage: null
authorName: "Admin User"
authorAvatarUrl: null
tags:
  - id: "tag-001"
    name: "architecture"
    slug: "architecture"
---

# Hello

This is **published** content.
`
	projectDocument := `---
id: "project-001"
slug: "git-native-project"
title: "Git Native Project"
summary: "Ship a markdown publish repo."
createdAt: "2026-03-14T00:00:00Z"
publishedAt: "2026-03-16T00:00:00Z"
sortOrder: 2
coverImage: null
ownerName: "Admin User"
ownerAvatarUrl: null
tags:
  - id: "tag-001"
    name: "architecture"
    slug: "architecture"
links:
  - label: "Demo"
    url: "https://example.com"
    linkType: "demo"
    sortOrder: 1
---

Paragraph with [link](https://example.com).
`
	homePayload := `{"id":"home","status":"published","data":{"version":1}}`

	if err := os.WriteFile(filepath.Join(rootDir, "posts", "git-native-publishing.md"), []byte(postDocument), 0o644); err != nil {
		t.Fatalf("write post: %v", err)
	}
	if err := os.WriteFile(filepath.Join(rootDir, "projects", "git-native-project.md"), []byte(projectDocument), 0o644); err != nil {
		t.Fatalf("write project: %v", err)
	}
	if err := os.WriteFile(filepath.Join(rootDir, "pages", "home.json"), []byte(homePayload), 0o644); err != nil {
		t.Fatalf("write home: %v", err)
	}

	reader := NewReader(rootDir)
	post, err := reader.GetPostBySlug("git-native-publishing")
	if err != nil {
		t.Fatalf("GetPostBySlug returned error: %v", err)
	}
	if !strings.Contains(post.Content, "**published**") {
		t.Fatalf("expected markdown body, got %#v", post.Content)
	}
	if len(reader.ListTags()) != 1 {
		t.Fatalf("expected derived tags from markdown documents")
	}

	project, err := reader.GetProjectBySlug("git-native-project")
	if err != nil {
		t.Fatalf("GetProjectBySlug returned error: %v", err)
	}
	if len(project.Links) != 1 || project.Links[0].URL != "https://example.com" {
		t.Fatalf("expected parsed project links, got %#v", project.Links)
	}

	home, err := reader.GetHomeDocument()
	if err != nil {
		t.Fatalf("GetHomeDocument returned error: %v", err)
	}
	if home.ID != "home" {
		t.Fatalf("expected home document, got %#v", home)
	}
}

func TestExportPublishedSiteAllowsMissingHome(t *testing.T) {
	t.Parallel()

	exportRoot := filepath.Join(t.TempDir(), "published")
	exporter := NewExporter(stubPostSource{})

	exported, err := exporter.ExportPublishedSite(context.Background(), exportRoot)
	if err != nil {
		t.Fatalf("ExportPublishedSite returned error: %v", err)
	}
	if exported.Home != nil {
		t.Fatalf("expected nil home export, got %#v", exported.Home)
	}
	if _, err := os.Stat(filepath.Join(exportRoot, "pages", "home.json")); !os.IsNotExist(err) {
		t.Fatalf("expected home.json to be omitted, got err=%v", err)
	}
}
