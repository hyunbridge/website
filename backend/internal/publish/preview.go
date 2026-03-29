package publish

import (
	"strings"

	"github.com/hyunbridge/website/backend/internal/store"
)

type PreviewSummary struct {
	PublishCount   int `json:"publish_count"`
	UpdateCount    int `json:"update_count"`
	UnpublishCount int `json:"unpublish_count"`
	TotalCount     int `json:"total_count"`
}

type PreviewItem struct {
	ID                   string  `json:"id"`
	Kind                 string  `json:"kind"`
	Title                string  `json:"title"`
	Slug                 *string `json:"slug,omitempty"`
	ChangeType           string  `json:"change_type"`
	LiveVersionID        *string `json:"live_version_id,omitempty"`
	LiveVersionTitle     *string `json:"live_version_title,omitempty"`
	LiveVersionMessage   *string `json:"live_version_message,omitempty"`
	TargetVersionID      *string `json:"target_version_id,omitempty"`
	TargetVersionTitle   *string `json:"target_version_title,omitempty"`
	TargetVersionMessage *string `json:"target_version_message,omitempty"`
}

type Preview struct {
	Summary PreviewSummary `json:"summary"`
	Items   []PreviewItem  `json:"items"`
}

func BuildPreview(source PublishedSiteSource, liveSnapshot *store.PublishPointerSnapshot) Preview {
	currentSnapshot := source.CapturePublishedPointerSnapshot()
	items := buildPreviewItems(source, currentSnapshot, liveSnapshot)
	summary := PreviewSummary{}
	for _, item := range items {
		switch item.ChangeType {
		case "publish":
			summary.PublishCount++
		case "update":
			summary.UpdateCount++
		case "unpublish":
			summary.UnpublishCount++
		}
	}
	summary.TotalCount = len(items)
	return Preview{
		Summary: summary,
		Items:   items,
	}
}

func buildPreviewItems(source PublishedSiteSource, currentSnapshot store.PublishPointerSnapshot, liveSnapshot *store.PublishPointerSnapshot) []PreviewItem {
	items := make([]PreviewItem, 0)
	live := normalizePreviewSnapshot(liveSnapshot)

	home := source.GetHomeDocument()
	if changeType := previewChangeType(live.Home.PublishedVersionID, currentSnapshot.Home.PublishedVersionID); changeType != "" {
		item := PreviewItem{
			ID:              currentSnapshot.Home.ID,
			Kind:            "home",
			Title:           "홈",
			ChangeType:      changeType,
			LiveVersionID:   clonePreviewVersionID(live.Home.PublishedVersionID),
			TargetVersionID: clonePreviewVersionID(currentSnapshot.Home.PublishedVersionID),
		}
		if item.LiveVersionID != nil {
			if version, err := source.GetHomeVersionByID(*item.LiveVersionID); err == nil {
				item.LiveVersionTitle = stringPtrOrNil(version.Title)
				item.LiveVersionMessage = version.ChangeDescription
			}
		}
		if item.TargetVersionID != nil {
			if version, err := source.GetHomeVersionByID(*item.TargetVersionID); err == nil {
				item.TargetVersionTitle = stringPtrOrNil(version.Title)
				item.TargetVersionMessage = version.ChangeDescription
			}
		}
		if item.ID == "" {
			item.ID = home.ID
		}
		items = append(items, item)
	}

	posts := make(map[string]store.PostDTO)
	for _, post := range source.ListPostDTOs(true) {
		posts[post.ID] = post
	}
	for _, id := range previewStateIDs(currentSnapshot.Posts, live.Posts) {
		currentState, _ := findPreviewState(currentSnapshot.Posts, id)
		liveState, _ := findPreviewState(live.Posts, id)
		changeType := previewChangeType(liveState.PublishedVersionID, currentState.PublishedVersionID)
		if changeType == "" {
			continue
		}

		post, ok := posts[id]
		item := PreviewItem{
			ID:              id,
			Kind:            "post",
			ChangeType:      changeType,
			LiveVersionID:   clonePreviewVersionID(liveState.PublishedVersionID),
			TargetVersionID: clonePreviewVersionID(currentState.PublishedVersionID),
		}
		if ok {
			item.Title = post.Title
			item.Slug = stringPtrOrNil(post.Slug)
		}
		if item.LiveVersionID != nil {
			if version, err := source.GetPostVersionByID(*item.LiveVersionID); err == nil {
				item.LiveVersionTitle = stringPtrOrNil(version.Title)
				item.LiveVersionMessage = version.ChangeDescription
				if item.Title == "" {
					item.Title = version.Title
				}
				if item.Slug == nil {
					item.Slug = stringPtrOrNil(version.Slug)
				}
			}
		}
		if item.TargetVersionID != nil {
			if version, err := source.GetPostVersionByID(*item.TargetVersionID); err == nil {
				item.TargetVersionTitle = stringPtrOrNil(version.Title)
				item.TargetVersionMessage = version.ChangeDescription
				if item.Title == "" {
					item.Title = version.Title
				}
				if item.Slug == nil {
					item.Slug = stringPtrOrNil(version.Slug)
				}
			}
		}
		items = append(items, item)
	}

	projects := make(map[string]store.ProjectDTO)
	for _, project := range source.ListProjectDTOs(true) {
		projects[project.ID] = project
	}
	for _, id := range previewStateIDs(currentSnapshot.Projects, live.Projects) {
		currentState, _ := findPreviewState(currentSnapshot.Projects, id)
		liveState, _ := findPreviewState(live.Projects, id)
		changeType := previewChangeType(liveState.PublishedVersionID, currentState.PublishedVersionID)
		if changeType == "" {
			continue
		}

		project, ok := projects[id]
		item := PreviewItem{
			ID:              id,
			Kind:            "project",
			ChangeType:      changeType,
			LiveVersionID:   clonePreviewVersionID(liveState.PublishedVersionID),
			TargetVersionID: clonePreviewVersionID(currentState.PublishedVersionID),
		}
		if ok {
			item.Title = project.Title
			item.Slug = stringPtrOrNil(project.Slug)
		}
		if item.LiveVersionID != nil {
			if version, err := source.GetProjectVersionByID(*item.LiveVersionID); err == nil {
				item.LiveVersionTitle = stringPtrOrNil(version.Title)
				item.LiveVersionMessage = version.ChangeDescription
				if item.Title == "" {
					item.Title = version.Title
				}
				if item.Slug == nil {
					item.Slug = stringPtrOrNil(version.Slug)
				}
			}
		}
		if item.TargetVersionID != nil {
			if version, err := source.GetProjectVersionByID(*item.TargetVersionID); err == nil {
				item.TargetVersionTitle = stringPtrOrNil(version.Title)
				item.TargetVersionMessage = version.ChangeDescription
				if item.Title == "" {
					item.Title = version.Title
				}
				if item.Slug == nil {
					item.Slug = stringPtrOrNil(version.Slug)
				}
			}
		}
		items = append(items, item)
	}

	return items
}

func normalizePreviewSnapshot(snapshot *store.PublishPointerSnapshot) store.PublishPointerSnapshot {
	if snapshot == nil {
		return store.PublishPointerSnapshot{}
	}
	return *snapshot
}

func previewStateIDs(current []store.PublishPointerState, live []store.PublishPointerState) []string {
	seen := make(map[string]struct{}, len(current)+len(live))
	ids := make([]string, 0, len(current)+len(live))
	for _, state := range current {
		id := strings.TrimSpace(state.ID)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	for _, state := range live {
		id := strings.TrimSpace(state.ID)
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids
}

func findPreviewState(states []store.PublishPointerState, id string) (store.PublishPointerState, bool) {
	for _, state := range states {
		if strings.TrimSpace(state.ID) == id {
			return state, true
		}
	}
	return store.PublishPointerState{ID: id}, false
}

func clonePreviewVersionID(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func previewChangeType(liveVersionID *string, targetVersionID *string) string {
	live := strings.TrimSpace(derefPreviewString(liveVersionID))
	target := strings.TrimSpace(derefPreviewString(targetVersionID))
	switch {
	case live == "" && target == "":
		return ""
	case live == "" && target != "":
		return "publish"
	case live != "" && target == "":
		return "unpublish"
	case live != target:
		return "update"
	default:
		return ""
	}
}

func derefPreviewString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func stringPtrOrNil(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return &value
}
