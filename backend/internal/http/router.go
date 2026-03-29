package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/hyunbridge/website/backend/internal/auth"
	"github.com/hyunbridge/website/backend/internal/config"
	"github.com/hyunbridge/website/backend/internal/editorial"
	"github.com/hyunbridge/website/backend/internal/http/handler"
	custommiddleware "github.com/hyunbridge/website/backend/internal/http/middleware"
	"github.com/hyunbridge/website/backend/internal/operational"
	"github.com/hyunbridge/website/backend/internal/publiccontent"
	"github.com/hyunbridge/website/backend/internal/publish"
	"github.com/hyunbridge/website/backend/internal/store"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func NewRouter(cfg config.Config, logger *slog.Logger) (*echo.Echo, error) {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Validator = &customValidator{validator: validator.New()}

	e.HTTPErrorHandler = func(err error, c echo.Context) {
		if c.Response().Committed {
			return
		}

		var httpErr *echo.HTTPError
		if errors.As(err, &httpErr) {
			status := httpErr.Code
			message := strings.TrimSpace(http.StatusText(status))
			if raw, ok := httpErr.Message.(string); ok && strings.TrimSpace(raw) != "" {
				message = strings.TrimSpace(raw)
			}
			logger.Warn("request failed", "error", err, "status", status, "path", c.Path(), "method", c.Request().Method)
			_ = c.JSON(status, map[string]string{"error": message})
			return
		}

		logger.Error("request failed", "error", err, "path", c.Path(), "method", c.Request().Method)
		_ = c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal_server_error"})
	}

	e.Use(middleware.RequestID())
	e.Use(middleware.Recover())
	e.Use(middleware.Gzip())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: cfg.CORSAllowedOrigins,
		AllowMethods: []string{http.MethodGet, http.MethodHead, http.MethodPut, http.MethodPatch, http.MethodPost, http.MethodDelete},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept, echo.HeaderAuthorization, "X-Admin-Bridge-Secret", "X-Admin-User-Id", "X-Admin-User-Email"},
	}))

	healthHandler := handler.NewHealthHandler(cfg)
	editorialHistory := editorial.NewHistory(cfg.ContentRepositoryConfig())
	if editorialHistory != nil {
		logger.Info(
			"content repository configured",
			"content_repo_dir",
			cfg.ContentRepoDir,
			"content_repo_source_configured",
			cfg.ContentRepoSourceURL != "",
			"content_repo_auth_configured",
			cfg.ContentRepoSourcePassword != "",
		)
		if err := editorialHistory.EnsureReady(context.Background()); err != nil {
			return nil, err
		}
	}
	mongoStore, err := store.NewMongoStore(
		cfg.MongoURL,
		cfg.MongoDatabaseName,
		cfg.BootstrapAdminEmail,
		cfg.BootstrapAdminPassword,
		editorialHistory,
	)
	if err != nil {
		return nil, err
	}
	var workspaceStore store.WorkspaceStore = mongoStore

	operationalStore, err := newOperationalStore(cfg, editorialHistory)
	if err != nil {
		return nil, err
	}

	if editorialHistory == nil {
		return nil, errors.New("content repository is not configured")
	}
	publisher := publish.NewFilesystemPublisher(workspaceStore, editorialHistory.Repository(), operationalStore, cfg.CloudflarePagesDeployHookURL)
	publicReader := publiccontent.NewReader(editorialHistory.Repository(), workspaceStore)
	publicService := publiccontent.NewService(workspaceStore, publicReader, operationalStore)

	contentHandler := handler.NewContentHandler(publicService)
	tokenService := auth.NewTokenService(cfg)
	authHandler := handler.NewAuthHandler(cfg, tokenService, workspaceStore)
	adminContentHandler := handler.NewAdminContentHandler(workspaceStore)
	adminHomeHandler := handler.NewAdminHomeHandler(workspaceStore)
	publicHomeHandler := handler.NewPublicHomeHandler(publicService)
	publicSiteExportHandler := handler.NewPublicSiteExportHandler(publicService)
	adminDeployHandler := handler.NewAdminDeployHandler(operationalStore, publisher, workspaceStore, cfg.CloudflareWebhookSecret)
	var identityProfileStore store.IdentityProfileStore
	if typedStore, ok := workspaceStore.(store.IdentityProfileStore); ok {
		identityProfileStore = typedStore
	}
	var assetAdminStore store.AssetAdminStore
	if typedStore, ok := workspaceStore.(store.AssetAdminStore); ok {
		assetAdminStore = typedStore
	}
	adminProfileHandler := handler.NewAdminProfileHandler(workspaceStore, identityProfileStore)
	infrastructureHandler := handler.NewInfrastructureHandler(cfg, assetAdminStore)
	adminJWT := custommiddleware.RequireAdminJWT(cfg)
	adminProfileAccess := custommiddleware.RequireAdminJWTOrBridge(cfg)
	optionalAdminAccess := custommiddleware.OptionalAdminJWTOrBridge(cfg)

	e.GET("/healthz", healthHandler.Readiness)
	e.GET("/api/v1/healthz", healthHandler.Readiness)

	api := e.Group("/api/v1")
	api.GET("/system/info", healthHandler.Info)
	api.GET("/site/export", publicSiteExportHandler.GetExport)
	api.GET("/site/home", publicHomeHandler.GetHome, optionalAdminAccess, custommiddleware.RequireAdminForSnapshotQuery("at"))
	api.GET("/posts", contentHandler.ListPosts, optionalAdminAccess, custommiddleware.RequireAdminForSnapshotQuery("at"))
	api.GET("/posts/:slug", contentHandler.GetPost, optionalAdminAccess, custommiddleware.RequireAdminForSnapshotQuery("at"))
	api.GET("/posts/versions/:versionId", contentHandler.GetPublishedPostVersion)
	api.GET("/tags", contentHandler.ListTags, optionalAdminAccess, custommiddleware.RequireAdminForSnapshotQuery("at"))
	api.GET("/projects", contentHandler.ListProjects, optionalAdminAccess, custommiddleware.RequireAdminForSnapshotQuery("at"))
	api.GET("/projects/:slug", contentHandler.GetProject, optionalAdminAccess, custommiddleware.RequireAdminForSnapshotQuery("at"))
	api.GET("/projects/versions/:versionId", contentHandler.GetPublishedProjectVersion)
	api.POST("/contact/verify-turnstile", infrastructureHandler.VerifyProtectedEmail)
	api.GET("/contact/email-status", infrastructureHandler.CheckProtectedEmail)
	api.GET("/cv/content", infrastructureHandler.GetCVContent)
	api.GET("/cv/pdf", infrastructureHandler.GetCVPDF)
	api.GET("/cv/pdf-cache-status", infrastructureHandler.GetCVPDFCacheStatus)
	api.POST("/admin/login", authHandler.Login)
	api.GET("/admin/me", authHandler.Me, adminJWT)
	api.POST("/assets/presign", infrastructureHandler.CreatePresignedUpload, adminJWT)
	api.POST("/assets/complete", infrastructureHandler.CompleteAssetUpload, adminJWT)
	api.POST("/assets/delete", infrastructureHandler.DeleteObjects, adminJWT)
	api.GET("/admin/dashboard", adminContentHandler.GetCounts, adminJWT)
	api.GET("/admin/posts", adminContentHandler.ListPosts, adminJWT)
	api.GET("/admin/posts/:id", adminContentHandler.GetPostByID, adminJWT)
	api.POST("/admin/posts", adminContentHandler.CreatePost, adminJWT)
	api.PATCH("/admin/posts/:id", adminContentHandler.PatchPost, adminJWT)
	api.POST("/admin/posts/:id/publish", adminContentHandler.PublishPost, adminJWT)
	api.DELETE("/admin/posts/:id/publish", adminContentHandler.UnpublishPost, adminJWT)
	api.DELETE("/admin/posts/:id", adminContentHandler.DeletePost, adminJWT)
	api.GET("/admin/posts/:id/version-state", adminContentHandler.GetPostVersionState, adminJWT)
	api.POST("/admin/posts/versions", adminContentHandler.CreatePostVersion, adminJWT)
	api.GET("/admin/posts/versions/:versionId", adminContentHandler.GetPostVersion, adminJWT)
	api.PATCH("/admin/posts/versions/:versionId", adminContentHandler.UpdatePostVersion, adminJWT)
	api.POST("/admin/posts/:id/current-version", adminContentHandler.SetPostCurrentVersion, adminJWT)
	api.GET("/admin/posts/:id/versions", adminContentHandler.ListPostVersions, adminJWT)
	api.POST("/admin/posts/:id/restore", adminContentHandler.RestorePostVersion, adminJWT)
	api.GET("/admin/projects", adminContentHandler.ListProjects, adminJWT)
	api.GET("/admin/projects/:id", adminContentHandler.GetProjectByID, adminJWT)
	api.POST("/admin/projects", adminContentHandler.CreateProject, adminJWT)
	api.PATCH("/admin/projects/:id", adminContentHandler.PatchProject, adminJWT)
	api.POST("/admin/projects/:id/publish", adminContentHandler.PublishProject, adminJWT)
	api.DELETE("/admin/projects/:id/publish", adminContentHandler.UnpublishProject, adminJWT)
	api.DELETE("/admin/projects/:id", adminContentHandler.DeleteProject, adminJWT)
	api.GET("/admin/projects/:id/version-state", adminContentHandler.GetProjectVersionState, adminJWT)
	api.POST("/admin/projects/versions", adminContentHandler.CreateProjectVersion, adminJWT)
	api.GET("/admin/projects/versions/:versionId", adminContentHandler.GetProjectVersion, adminJWT)
	api.PATCH("/admin/projects/versions/:versionId", adminContentHandler.UpdateProjectVersion, adminJWT)
	api.POST("/admin/projects/:id/current-version", adminContentHandler.SetProjectCurrentVersion, adminJWT)
	api.GET("/admin/projects/:id/versions", adminContentHandler.ListProjectVersions, adminJWT)
	api.POST("/admin/projects/:id/restore", adminContentHandler.RestoreProjectVersion, adminJWT)
	api.GET("/admin/tags", adminContentHandler.ListTags, adminJWT)
	api.POST("/admin/tags", adminContentHandler.CreateTag, adminJWT)
	api.PATCH("/admin/tags/:id", adminContentHandler.UpdateTag, adminJWT)
	api.DELETE("/admin/tags/:id", adminContentHandler.DeleteTag, adminJWT)
	api.GET("/admin/home", adminHomeHandler.GetHome, adminJWT)
	api.POST("/admin/home/save", adminHomeHandler.SaveHome, adminJWT)
	api.POST("/admin/home/current-version", adminHomeHandler.SaveHomeVersion, adminJWT)
	api.GET("/admin/home/versions", adminHomeHandler.ListVersions, adminJWT)
	api.POST("/admin/home/restore", adminHomeHandler.RestoreVersion, adminJWT)
	api.GET("/admin/deploy", adminDeployHandler.GetDashboard, adminJWT)
	api.GET("/admin/deploy/preview", adminDeployHandler.GetPreview, adminJWT)
	api.POST("/admin/deploy/sync", adminDeployHandler.Sync, adminJWT)
	api.POST("/integrations/cloudflare/pages/deploy-webhook", adminDeployHandler.HandleCloudflareWebhook)
	api.GET("/admin/publish", adminDeployHandler.GetDashboard, adminJWT)
	api.GET("/admin/publish/preview", adminDeployHandler.GetPreview, adminJWT)
	api.POST("/admin/publish/sync", adminDeployHandler.Sync, adminJWT)
	api.GET("/admin/profile", adminProfileHandler.GetProfile, adminProfileAccess)
	api.PATCH("/admin/profile", adminProfileHandler.UpdateProfile, adminProfileAccess)
	api.POST("/admin/profile/password", adminProfileHandler.UpdatePassword, adminJWT)

	return e, nil
}

type customValidator struct {
	validator *validator.Validate
}

func (cv *customValidator) Validate(i interface{}) error {
	return cv.validator.Struct(i)
}

func newOperationalStore(cfg config.Config, history *editorial.History) (operational.Store, error) {
	if history == nil {
		return operational.NewMongoStore(context.Background(), cfg.MongoURL, cfg.MongoDatabaseName, nil, cfg.PublicSiteURL)
	}
	return operational.NewMongoStore(context.Background(), cfg.MongoURL, cfg.MongoDatabaseName, history.Repository(), cfg.PublicSiteURL)
}
