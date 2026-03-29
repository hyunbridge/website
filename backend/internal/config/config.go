package config

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/hyunbridge/website/backend/internal/gitrepo"
	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv                       string
	HTTPAddr                     string
	LogLevel                     slog.Level
	JWTIssuer                    string
	JWTAudience                  string
	JWTSecret                    string
	AccessTokenTTL               time.Duration
	BootstrapAdminEmail          string
	BootstrapAdminPassword       string
	S3Bucket                     string
	S3Region                     string
	S3Endpoint                   string
	S3AccessKey                  string
	S3SecretKey                  string
	S3PublicBaseURL              string
	GotenbergURL                 string
	GotenbergUsername            string
	GotenbergPassword            string
	PublicSiteURL                string
	CloudflarePagesDeployHookURL string
	CloudflareWebhookSecret      string
	ContentRepoDir               string
	ContentRepoSourceURL         string
	ContentRepoSourceUsername    string
	ContentRepoSourcePassword    string
	MongoURL                     string
	MongoDatabaseName            string
	EditorialGitBranch           string
	EditorialGitUserName         string
	EditorialGitUserEmail        string
	CVSourceURL                  string
	NotionCVPageID               string
	ProtectedEmail               string
	ProtectedEmailTokenSecret    string
	ProtectedEmailTokenIssuer    string
	ProtectedEmailTokenAudience  string
	ProtectedEmailTokenTTL       time.Duration
	TurnstileSecret              string
	AssetGCSecret                string
	AdminBridgeSecret            string
	CORSAllowedOrigins           []string
}

func Load() Config {
	envBaseDir := loadEnv()

	return Config{
		AppEnv:                       getEnv("APP_ENV", "development"),
		HTTPAddr:                     getEnv("HTTP_ADDR", ":8080"),
		LogLevel:                     parseLogLevel(getEnv("LOG_LEVEL", "info")),
		JWTIssuer:                    getEnv("JWT_ISSUER", "website-api"),
		JWTAudience:                  getEnv("JWT_AUDIENCE", "website-admin"),
		JWTSecret:                    getEnv("JWT_SECRET", ""),
		AccessTokenTTL:               getDurationEnv("ACCESS_TOKEN_TTL", 12*time.Hour),
		BootstrapAdminEmail:          getEnv("BOOTSTRAP_ADMIN_EMAIL", ""),
		BootstrapAdminPassword:       getEnv("BOOTSTRAP_ADMIN_PASSWORD", ""),
		S3Bucket:                     getEnv("S3_BUCKET", ""),
		S3Region:                     getEnv("S3_REGION", "auto"),
		S3Endpoint:                   getEnv("S3_ENDPOINT", ""),
		S3AccessKey:                  getEnv("S3_ACCESS_KEY", ""),
		S3SecretKey:                  getEnv("S3_SECRET_KEY", ""),
		S3PublicBaseURL:              getEnv("S3_PUBLIC_BASE_URL", ""),
		GotenbergURL:                 getEnv("GOTENBERG_URL", ""),
		GotenbergUsername:            getEnv("GOTENBERG_USERNAME", ""),
		GotenbergPassword:            getEnv("GOTENBERG_PASSWORD", ""),
		PublicSiteURL:                getEnv("PUBLIC_SITE_URL", ""),
		CloudflarePagesDeployHookURL: getEnv("CLOUDFLARE_PAGES_DEPLOY_HOOK_URL", ""),
		CloudflareWebhookSecret:      getEnv("CLOUDFLARE_WEBHOOK_SECRET", ""),
		ContentRepoDir:               getPathEnv("CONTENT_REPO_DIR", "/tmp/website-content-repo.git", envBaseDir),
		ContentRepoSourceURL:         getEnv("CONTENT_REPO_SOURCE_URL", ""),
		ContentRepoSourceUsername:    getEnv("CONTENT_REPO_SOURCE_USERNAME", ""),
		ContentRepoSourcePassword:    getEnv("CONTENT_REPO_SOURCE_PASSWORD", ""),
		MongoURL:                     getEnv("MONGO_URL", "mongodb://localhost:27017"),
		MongoDatabaseName:            getEnv("MONGO_DATABASE_NAME", "website"),
		EditorialGitBranch:           getEnv("EDITORIAL_GIT_BRANCH", "main"),
		EditorialGitUserName:         getEnv("EDITORIAL_GIT_USER_NAME", "Website Editorial"),
		EditorialGitUserEmail:        getEnv("EDITORIAL_GIT_USER_EMAIL", "editorial@local.invalid"),
		CVSourceURL:                  getEnv("CV_SOURCE_URL", ""),
		NotionCVPageID:               getEnv("NOTION_CV_PAGE_ID", ""),
		ProtectedEmail:               getEnv("PROTECTED_EMAIL", ""),
		ProtectedEmailTokenSecret:    getEnv("PROTECTED_EMAIL_TOKEN_SECRET", ""),
		ProtectedEmailTokenIssuer:    getEnv("PROTECTED_EMAIL_TOKEN_ISSUER", "website-protected-email"),
		ProtectedEmailTokenAudience:  getEnv("PROTECTED_EMAIL_TOKEN_AUDIENCE", "protected-email"),
		ProtectedEmailTokenTTL:       getDurationEnv("PROTECTED_EMAIL_TOKEN_TTL", 30*time.Minute),
		TurnstileSecret:              getEnv("TURNSTILE_SECRET", ""),
		AssetGCSecret:                getEnv("ASSET_GC_SECRET", ""),
		AdminBridgeSecret:            getEnv("ADMIN_BRIDGE_SECRET", ""),
		CORSAllowedOrigins:           getCSVEnv("CORS_ALLOWED_ORIGINS", []string{"http://localhost:3000", "http://localhost:3001", "http://localhost:4173", "http://localhost:4321"}),
	}
}

func (cfg Config) ValidateForServer() error {
	if strings.EqualFold(strings.TrimSpace(cfg.AppEnv), "production") {
		if err := validateRequiredSecret("JWT_SECRET", cfg.JWTSecret, "change-me"); err != nil {
			return err
		}
		if cfg.AdminBridgeSecret != "" {
			if err := validateRequiredSecret("ADMIN_BRIDGE_SECRET", cfg.AdminBridgeSecret, "change-me"); err != nil {
				return err
			}
		}
		if cfg.ProtectedEmail != "" {
			if err := validateRequiredSecret("PROTECTED_EMAIL_TOKEN_SECRET", cfg.ProtectedEmailTokenSecret, "change-me-protected-email"); err != nil {
				return err
			}
		}
		if cfg.BootstrapAdminEmail != "" || cfg.BootstrapAdminPassword != "" {
			if strings.TrimSpace(cfg.BootstrapAdminEmail) == "" || strings.TrimSpace(cfg.BootstrapAdminPassword) == "" {
				return fmt.Errorf("BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be provided together")
			}
			if strings.TrimSpace(cfg.BootstrapAdminPassword) == "change-me-now" {
				return fmt.Errorf("BOOTSTRAP_ADMIN_PASSWORD must not use the default placeholder in production")
			}
		}
	}

	return nil
}

func (cfg Config) ContentRepositoryConfig() gitrepo.Config {
	return gitrepo.Config{
		Path:           cfg.ContentRepoDir,
		RemoteURL:      cfg.ContentRepoSourceURL,
		RemoteName:     gitrepo.DefaultRemoteName,
		RemoteUsername: cfg.ContentRepoSourceUsername,
		RemotePassword: cfg.ContentRepoSourcePassword,
		Branch:         cfg.EditorialGitBranch,
		UserName:       cfg.EditorialGitUserName,
		UserEmail:      cfg.EditorialGitUserEmail,
	}
}

func loadEnv() string {
	candidates := []string{".env", filepath.Join("backend", ".env")}
	for _, candidate := range candidates {
		if err := godotenv.Load(candidate); err == nil {
			dir := filepath.Dir(candidate)
			if dir == "." {
				cwd, cwdErr := os.Getwd()
				if cwdErr == nil {
					return cwd
				}
			}
			absDir, absErr := filepath.Abs(dir)
			if absErr == nil {
				return absDir
			}
			return dir
		}
	}
	cwd, err := os.Getwd()
	if err != nil {
		return "."
	}
	return cwd
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}

func getPathEnv(key, fallback string, baseDir string) string {
	value := strings.TrimSpace(getEnv(key, fallback))
	if value == "" || filepath.IsAbs(value) {
		return value
	}
	if strings.TrimSpace(baseDir) == "" {
		return value
	}
	return filepath.Clean(filepath.Join(baseDir, value))
}

func parseLogLevel(value string) slog.Level {
	switch value {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func getDurationEnv(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}

	return parsed
}

func getCSVEnv(key string, fallback []string) []string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}

	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		item := strings.TrimSpace(part)
		if item == "" {
			continue
		}
		items = append(items, item)
	}

	if len(items) == 0 {
		return fallback
	}

	return items
}

func validateRequiredSecret(key, value string, placeholders ...string) error {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fmt.Errorf("%s is required in production", key)
	}
	for _, placeholder := range placeholders {
		if trimmed == strings.TrimSpace(placeholder) {
			return fmt.Errorf("%s must not use the default placeholder in production", key)
		}
	}
	return nil
}
