package main

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/hyunbridge/website/backend/internal/app"
	"github.com/hyunbridge/website/backend/internal/config"
	"github.com/hyunbridge/website/backend/internal/store"
)

func main() {
	cfg := config.Load()
	if err := cfg.ValidateForServer(); err != nil {
		fmt.Fprintf(os.Stderr, "invalid server configuration: %v\n", err)
		os.Exit(1)
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: cfg.LogLevel,
	}))

	server, err := app.NewServer(cfg, logger)
	if err != nil {
		if store.IsBootstrapRequired(err) {
			logger.Error("server bootstrap required", "error", err, "hint", "run `go run ./cmd/install -admin-email <email> -admin-password-stdin` first")
		} else {
			logger.Error("failed to initialize api server", "error", err)
		}
		os.Exit(1)
	}

	logger.Info("starting api server", "addr", cfg.HTTPAddr, "env", cfg.AppEnv)

	if err := server.Start(cfg.HTTPAddr); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
