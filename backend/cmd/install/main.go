package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"

	"github.com/hyunbridge/website/backend/internal/config"
	"github.com/hyunbridge/website/backend/internal/editorial"
	"github.com/hyunbridge/website/backend/internal/store"
)

func main() {
	var adminEmail string
	var adminPassword string
	var passwordFromStdin bool

	flag.StringVar(&adminEmail, "admin-email", "", "initial administrator email")
	flag.StringVar(&adminPassword, "admin-password", "", "initial administrator password")
	flag.BoolVar(&passwordFromStdin, "admin-password-stdin", false, "read the administrator password from stdin")
	flag.Parse()

	if passwordFromStdin {
		passwordBytes, err := io.ReadAll(os.Stdin)
		if err != nil {
			fmt.Fprintf(os.Stderr, "read admin password from stdin: %v\n", err)
			os.Exit(1)
		}
		adminPassword = strings.TrimSpace(string(passwordBytes))
	}

	adminEmail = strings.TrimSpace(adminEmail)
	adminPassword = strings.TrimSpace(adminPassword)
	if adminEmail == "" || adminPassword == "" {
		fmt.Fprintln(os.Stderr, "install requires -admin-email and either -admin-password or -admin-password-stdin")
		os.Exit(2)
	}

	cfg := config.Load()
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: cfg.LogLevel,
	}))

	editorialHistory := editorial.NewHistory(cfg.ContentRepositoryConfig())
	if editorialHistory != nil {
		if err := editorialHistory.EnsureReady(context.Background()); err != nil {
			logger.Error("failed to prepare content repository", "error", err, "content_repo_dir", cfg.ContentRepoDir)
			os.Exit(1)
		}
	}

	if err := store.BootstrapMongoStore(
		cfg.MongoURL,
		cfg.MongoDatabaseName,
		adminEmail,
		adminPassword,
		editorialHistory,
	); err != nil {
		if store.IsBootstrapAlreadyInitialized(err) {
			logger.Error("installation skipped", "error", err)
			os.Exit(1)
		}
		logger.Error("failed to install backend state", "error", err)
		os.Exit(1)
	}

	logger.Info("backend installation completed", "admin_email", adminEmail, "mongo_database", cfg.MongoDatabaseName)
}
