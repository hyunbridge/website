package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"github.com/hyunbridge/website/backend/internal/config"
	"github.com/hyunbridge/website/backend/internal/editorial"
	"github.com/hyunbridge/website/backend/internal/publish"
	"github.com/hyunbridge/website/backend/internal/store"
)

func main() {
	var outDir string
	flag.StringVar(&outDir, "out", "", "target directory for published content artifacts")
	flag.Parse()

	if outDir == "" {
		fmt.Fprintln(os.Stderr, "publish-export requires -out")
		os.Exit(2)
	}

	cfg := config.Load()

	editorialHistory := editorial.NewHistory(cfg.ContentRepositoryConfig())
	appStore, err := store.NewMongoStore(
		cfg.MongoURL,
		cfg.MongoDatabaseName,
		cfg.BootstrapAdminEmail,
		cfg.BootstrapAdminPassword,
		editorialHistory,
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "initialize store: %v\n", err)
		os.Exit(1)
	}

	exporter := publish.NewExporter(appStore)
	exported, err := exporter.ExportPublishedSite(context.Background(), outDir)
	if err != nil {
		fmt.Fprintf(os.Stderr, "export published site: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("exported %d posts, %d projects, and home to %s\n", len(exported.Posts), len(exported.Projects), outDir)
}
