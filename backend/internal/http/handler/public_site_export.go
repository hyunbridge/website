package handler

import (
	"net/http"
	"time"

	"github.com/hyunbridge/website/backend/internal/publiccontent"
	"github.com/hyunbridge/website/backend/internal/store"
	"github.com/labstack/echo/v4"
)

type PublicSiteExportHandler struct {
	content *publiccontent.Service
}

type publicSiteRelease struct {
	LiveCommitSHA string `json:"live_commit_sha"`
	GeneratedAt   string `json:"generated_at"`
}

type publicSiteExportResponse struct {
	Release  publicSiteRelease      `json:"release"`
	Home     *store.HomeDocumentDTO `json:"home"`
	Posts    []store.PostDTO        `json:"posts"`
	Projects []store.ProjectDTO     `json:"projects"`
	Tags     []store.TagDTO         `json:"tags"`
}

func NewPublicSiteExportHandler(content *publiccontent.Service) PublicSiteExportHandler {
	return PublicSiteExportHandler{content: content}
}

func (h PublicSiteExportHandler) GetExport(c echo.Context) error {
	if h.content == nil {
		return c.JSON(http.StatusNotImplemented, map[string]string{"error": "content_repo_not_configured"})
	}

	ctx := c.Request().Context()
	snapshot, err := h.content.GetCurrentSiteSnapshot(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_resolve_live_commit"})
	}
	if snapshot == nil {
		return c.JSON(http.StatusServiceUnavailable, map[string]string{"error": "published_content_unavailable"})
	}
	c.Response().Header().Set(echo.HeaderCacheControl, "no-store, max-age=0")
	if snapshot.CommitSHA != "" {
		c.Response().Header().Set("X-Published-Commit-SHA", snapshot.CommitSHA)
	}

	return c.JSON(http.StatusOK, publicSiteExportResponse{
		Release: publicSiteRelease{
			LiveCommitSHA: snapshot.CommitSHA,
			GeneratedAt:   time.Now().UTC().Format(time.RFC3339),
		},
		Home:     snapshot.Home,
		Posts:    snapshot.Posts,
		Projects: snapshot.Projects,
		Tags:     snapshot.Tags,
	})
}
