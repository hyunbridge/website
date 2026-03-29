package handler

import (
	"net/http"

	custommiddleware "github.com/hyunbridge/website/backend/internal/http/middleware"
	"github.com/hyunbridge/website/backend/internal/store"
	"github.com/labstack/echo/v4"
)

type AdminHomeHandler struct {
	store store.HomeAdminStore
}

func NewAdminHomeHandler(appStore store.HomeAdminStore) AdminHomeHandler {
	return AdminHomeHandler{store: appStore}
}

func requireHomeAdminActorID(c echo.Context) (string, error) {
	actor, ok := custommiddleware.AdminActorFromContext(c)
	if !ok || actor.UserID == "" {
		return "", c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}
	return actor.UserID, nil
}

func (h AdminHomeHandler) GetHome(c echo.Context) error {
	return c.JSON(http.StatusOK, h.store.GetHomeDocument())
}

func (h AdminHomeHandler) SaveHome(c echo.Context) error {
	var req struct {
		Data              map[string]any `json:"data"`
		ChangeDescription string         `json:"changeDescription"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	actorID, actorErr := requireHomeAdminActorID(c)
	if actorErr != nil {
		return actorErr
	}
	doc, err := h.store.SaveHomeDraft(actorID, req.Data, req.ChangeDescription)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_save_home"})
	}
	return c.JSON(http.StatusOK, doc)
}

func (h AdminHomeHandler) SaveHomeVersion(c echo.Context) error {
	var req struct {
		ChangeDescription string `json:"changeDescription"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	actorID, actorErr := requireHomeAdminActorID(c)
	if actorErr != nil {
		return actorErr
	}
	doc, err := h.store.SaveHomeVersion(actorID, req.ChangeDescription)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_save_home_version"})
	}
	return c.JSON(http.StatusOK, doc)
}

func (h AdminHomeHandler) ListVersions(c echo.Context) error {
	return c.JSON(http.StatusOK, h.store.ListHomeVersions())
}

func (h AdminHomeHandler) RestoreVersion(c echo.Context) error {
	var req struct {
		VersionNumber int `json:"versionNumber"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	actorID, actorErr := requireHomeAdminActorID(c)
	if actorErr != nil {
		return actorErr
	}
	doc, err := h.store.RestoreHomeVersion(req.VersionNumber, actorID)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "home_version_not_found"})
	}
	return c.JSON(http.StatusOK, doc)
}
