package handler

import (
	"net/http"
	"strings"

	"github.com/hyunbridge/website/backend/internal/config"
	"github.com/labstack/echo/v4"
)

type HealthHandler struct {
	cfg config.Config
}

func NewHealthHandler(cfg config.Config) HealthHandler {
	return HealthHandler{cfg: cfg}
}

func (h HealthHandler) Readiness(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
}

func (h HealthHandler) Info(c echo.Context) error {
	payload := map[string]any{
		"service": "website-api",
		"version": "0.1.0",
		"targets": []string{
			"admin-auth",
			"content-api",
			"asset-api",
			"cv-jobs",
		},
	}
	if strings.ToLower(strings.TrimSpace(h.cfg.AppEnv)) != "production" {
		payload["env"] = h.cfg.AppEnv
	}
	return c.JSON(http.StatusOK, payload)
}
