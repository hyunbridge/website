package handler

import (
	"io"
	"net/http"
	"strings"

	adminmiddleware "github.com/hyunbridge/website/backend/internal/http/middleware"
	"github.com/hyunbridge/website/backend/internal/operational"
	"github.com/hyunbridge/website/backend/internal/publish"
	"github.com/hyunbridge/website/backend/internal/store"
	"github.com/labstack/echo/v4"
)

type AdminDeployHandler struct {
	state         operational.Store
	publisher     publish.SitePublisher
	store         publish.PublishedSiteSource
	webhookSecret string
}

type deployPreviewResponse struct {
	LiveState *operational.LiveState `json:"live_state,omitempty"`
	Summary   publish.PreviewSummary `json:"summary"`
	Items     []publish.PreviewItem  `json:"items"`
}

func NewAdminDeployHandler(state operational.Store, publisher publish.SitePublisher, appStore publish.PublishedSiteSource, webhookSecret string) AdminDeployHandler {
	return AdminDeployHandler{state: state, publisher: publisher, store: appStore, webhookSecret: strings.TrimSpace(webhookSecret)}
}

func (h AdminDeployHandler) GetDashboard(c echo.Context) error {
	if h.state == nil {
		return c.JSON(http.StatusNotImplemented, map[string]string{"error": "deploy_state_not_supported"})
	}

	dashboard, err := h.state.Dashboard(20)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_load_deploy_dashboard"})
	}
	return c.JSON(http.StatusOK, dashboard)
}

func (h AdminDeployHandler) GetPreview(c echo.Context) error {
	if h.store == nil {
		return c.JSON(http.StatusNotImplemented, map[string]string{"error": "deploy_state_not_supported"})
	}

	var liveState *operational.LiveState
	if h.state != nil {
		state, err := h.state.GetLiveState()
		if err == nil {
			liveState = state
		}
	}

	preview := publish.BuildPreview(h.store, liveStateSnapshot(liveState))

	return c.JSON(http.StatusOK, deployPreviewResponse{
		LiveState: liveState,
		Summary:   preview.Summary,
		Items:     preview.Items,
	})
}

func (h AdminDeployHandler) Sync(c echo.Context) error {
	if h.publisher == nil {
		return c.JSON(http.StatusNotImplemented, map[string]string{"error": "content_repo_not_configured"})
	}

	ctx := publish.WithActor(c.Request().Context(), currentActor(c))
	if err := h.publisher.Sync(ctx); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_enqueue_deploy"})
	}

	return h.GetDashboard(c)
}

func (h AdminDeployHandler) HandleCloudflareWebhook(c echo.Context) error {
	if h.publisher == nil {
		return c.JSON(http.StatusNotImplemented, map[string]string{"error": "content_repo_not_configured"})
	}
	if h.webhookSecret != "" && strings.TrimSpace(c.Request().Header.Get("cf-webhook-auth")) != h.webhookSecret {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid_webhook_secret"})
	}

	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_webhook_payload"})
	}
	if err := h.publisher.HandleCloudflareNotification(c.Request().Context(), body); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "failed_to_process_deploy_notification"})
	}
	return c.JSON(http.StatusAccepted, map[string]string{"status": "accepted"})
}

func currentActor(c echo.Context) string {
	if actor, ok := adminmiddleware.AdminActorFromContext(c); ok {
		if userID := strings.TrimSpace(actor.UserID); userID != "" {
			return userID
		}
	}

	claims, ok := c.Get("claims").(map[string]any)
	if !ok {
		return "system"
	}

	subject, _ := claims["sub"].(string)
	subject = strings.TrimSpace(subject)
	if subject == "" {
		return "system"
	}
	return subject
}

func liveStateSnapshot(state *operational.LiveState) *store.PublishPointerSnapshot {
	if state == nil {
		return nil
	}
	return state.LivePointers
}
