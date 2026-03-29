package store

import (
	"path/filepath"
	"strings"

	"github.com/hyunbridge/website/backend/internal/contentmd"
	"github.com/hyunbridge/website/backend/internal/editorial"
)

func postHistoryPath(postID string) string {
	return filepath.ToSlash(filepath.Join("posts", postID+".md"))
}

func projectHistoryPath(projectID string) string {
	return filepath.ToSlash(filepath.Join("projects", projectID+".md"))
}

func homeHistoryPath() string {
	return filepath.ToSlash(filepath.Join("pages", "home.json"))
}

func postLiveRef(postID string) string {
	return "refs/publish/live/posts/" + strings.TrimSpace(postID)
}

func projectLiveRef(projectID string) string {
	return "refs/publish/live/projects/" + strings.TrimSpace(projectID)
}

func postLiveRefPrefix() string {
	return "refs/publish/live/posts/"
}

func projectLiveRefPrefix() string {
	return "refs/publish/live/projects/"
}

func homeLiveRef() string {
	return "refs/publish/live/home"
}

type gitBackedPostState struct {
	id       string
	first    editorial.Entry
	latest   editorial.Entry
	version  editorial.Entry
	document contentmd.EditorialPostDocument
}

type gitBackedProjectState struct {
	id       string
	first    editorial.Entry
	latest   editorial.Entry
	version  editorial.Entry
	document contentmd.EditorialProjectDocument
}

type gitLiveRefState struct {
	PublishedVersionID *string
}
