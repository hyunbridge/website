package app

import (
	"log/slog"

	"github.com/hyunbridge/website/backend/internal/config"
	httpx "github.com/hyunbridge/website/backend/internal/http"
	"github.com/labstack/echo/v4"
)

func NewServer(cfg config.Config, logger *slog.Logger) (*echo.Echo, error) {
	return httpx.NewRouter(cfg, logger)
}
