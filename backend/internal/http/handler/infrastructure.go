package handler

import (
	"encoding/json"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/hyunbridge/website/backend/internal/config"
	custommiddleware "github.com/hyunbridge/website/backend/internal/http/middleware"
	internalid "github.com/hyunbridge/website/backend/internal/id"
	"github.com/hyunbridge/website/backend/internal/platform/gotenberg"
	"github.com/hyunbridge/website/backend/internal/platform/notion"
	"github.com/hyunbridge/website/backend/internal/platform/objectstorage"
	"github.com/hyunbridge/website/backend/internal/store"
	"github.com/labstack/echo/v4"
)

type InfrastructureHandler struct {
	cfg     config.Config
	storage objectstorage.Client
	notion  notion.Client
	assets  store.AssetAdminStore
}

func NewInfrastructureHandler(cfg config.Config, assets store.AssetAdminStore) InfrastructureHandler {
	return InfrastructureHandler{
		cfg:     cfg,
		storage: objectstorage.New(cfg),
		notion:  notion.New(),
		assets:  assets,
	}
}

const (
	cvPDFPrefix      = "generated/cv"
	cvPDFFallbackKey = cvPDFPrefix + "/cv-latest.pdf"
)

func (h InfrastructureHandler) CreatePresignedUpload(c echo.Context) error {
	var req struct {
		ResourceType string `json:"resourceType"`
		ResourceID   string `json:"resourceId"`
		Filename     string `json:"filename"`
		ContentType  string `json:"contentType"`
	}
	if err := c.Bind(&req); err != nil || req.ContentType == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}

	objectKey, err := buildAssetObjectKey(c, req.ResourceType, req.ResourceID, req.Filename)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	url, err := h.storage.PresignPutObject(objectKey, req.ContentType, time.Hour)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"url":     url,
		"fileUrl": h.storage.PublicURL(objectKey),
		"key":     objectKey,
	})
}

func (h InfrastructureHandler) CompleteAssetUpload(c echo.Context) error {
	var req struct {
		ResourceType string `json:"resourceType"`
		ResourceID   string `json:"resourceId"`
		ObjectKey    string `json:"objectKey"`
	}
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.ObjectKey) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}

	switch strings.TrimSpace(req.ResourceType) {
	case "post":
		if strings.TrimSpace(req.ResourceID) == "" || h.assets == nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
		}
		if err := h.assets.AddPostAsset(req.ResourceID, req.ObjectKey); err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "post_not_found"})
		}
	case "project":
		if strings.TrimSpace(req.ResourceID) == "" || h.assets == nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
		}
		if err := h.assets.AddProjectAsset(req.ResourceID, req.ObjectKey); err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "project_not_found"})
		}
	case "avatar":
		// Avatar uploads are referenced from the profile document and do not need asset tracking.
	default:
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}

	return c.JSON(http.StatusOK, map[string]bool{"ok": true})
}

func (h InfrastructureHandler) DeleteObjects(c echo.Context) error {
	var req struct {
		Keys []string `json:"keys"`
	}
	if err := c.Bind(&req); err != nil || len(req.Keys) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}

	if err := h.storage.DeleteObjects(req.Keys); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

func (h InfrastructureHandler) VerifyProtectedEmail(c echo.Context) error {
	var req struct {
		Token string `json:"token"`
	}
	if err := c.Bind(&req); err != nil || req.Token == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	if err := verifyTurnstile(h.cfg, req.Token); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": err.Error()})
	}
	token, err := h.issueProtectedEmailToken()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]any{
		"success": true,
		"token":   token,
		"email":   h.cfg.ProtectedEmail,
	})
}

func (h InfrastructureHandler) CheckProtectedEmail(c echo.Context) error {
	if h.cfg.ProtectedEmailTokenSecret == "" {
		return c.JSON(http.StatusOK, map[string]any{"success": false, "verified": false})
	}
	token := c.QueryParam("token")
	if token == "" {
		return c.JSON(http.StatusBadRequest, map[string]any{"success": false})
	}
	claims := jwt.MapClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(h.cfg.ProtectedEmailTokenSecret), nil
	}, jwt.WithAudience(h.cfg.ProtectedEmailTokenAudience), jwt.WithIssuer(h.cfg.ProtectedEmailTokenIssuer))
	if err != nil || !parsed.Valid {
		return c.JSON(http.StatusOK, map[string]any{"success": false, "verified": false})
	}
	verified, _ := claims["verified"].(bool)
	email, _ := claims["email"].(string)
	subject, _ := claims["sub"].(string)
	if !verified || strings.TrimSpace(email) != strings.TrimSpace(h.cfg.ProtectedEmail) || strings.TrimSpace(subject) != "protected-email" {
		return c.JSON(http.StatusOK, map[string]any{"success": false, "verified": false})
	}

	return c.JSON(http.StatusOK, map[string]any{
		"success":  true,
		"verified": true,
		"email":    strings.TrimSpace(email),
	})
}

func (h InfrastructureHandler) GetCVPDF(c echo.Context) error {
	token := c.QueryParam("token")
	if err := verifyTurnstile(h.cfg, token); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": err.Error()})
	}

	if h.storage.IsConfigured() {
		cvPayload, err := h.loadCVPayload(c.Request())
		if err != nil {
			return c.JSON(http.StatusBadGateway, map[string]string{"error": err.Error()})
		}

		lastModified := getCVLastModified(cvPayload["recordMap"])
		objectKey := buildCVPDFObjectKey(lastModified)
		downloadURL := h.storage.PublicURL(objectKey)
		exists, err := h.storage.ObjectExists(objectKey)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		if exists {
			return c.JSON(http.StatusOK, map[string]any{
				"downloadUrl": downloadURL,
				"source":      "cache",
			})
		}

		targetURL, err := h.cvRenderTarget(c.Request())
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		pdf, err := gotenberg.ConvertURLToPDF(h.cfg, targetURL)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		if err := h.storage.PutObject(objectstorage.PutObjectInput{
			Key:                objectKey,
			Body:               pdf,
			ContentType:        "application/pdf",
			ContentDisposition: `attachment; filename="CV.pdf"`,
			CacheControl:       getCVPDFCacheControl(lastModified),
			Metadata: map[string]string{
				"filename":   "CV.pdf",
				"source":     "gotenberg",
				"render_url": targetURL,
				"revision":   lastModified,
			},
		}); err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}

		return c.JSON(http.StatusOK, map[string]any{
			"downloadUrl": downloadURL,
			"source":      "generated",
		})
	}

	targetURL, err := h.cvRenderTarget(c.Request())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	pdf, err := gotenberg.ConvertURLToPDF(h.cfg, targetURL)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.Blob(http.StatusOK, "application/pdf", pdf)
}

func (h InfrastructureHandler) GetCVPDFCacheStatus(c echo.Context) error {
	hasCache := false
	var downloadURL string

	if h.storage.IsConfigured() {
		if cvPayload, err := h.loadCVPayload(c.Request()); err == nil {
			lastModified := getCVLastModified(cvPayload["recordMap"])
			objectKey := buildCVPDFObjectKey(lastModified)
			downloadURL = h.storage.PublicURL(objectKey)
			exists, existsErr := h.storage.ObjectExists(objectKey)
			if existsErr == nil {
				hasCache = exists
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]any{
		"hasCache":          hasCache,
		"downloadUrl":       downloadURL,
		"storageConfigured": h.storage.IsConfigured(),
		"gotenbergReady":    h.cfg.GotenbergURL != "",
	})
}

func (h InfrastructureHandler) GetCVContent(c echo.Context) error {
	payload, err := h.loadCVPayload(c.Request())
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, payload)
}

func (h InfrastructureHandler) issueProtectedEmailToken() (string, error) {
	if h.cfg.ProtectedEmailTokenSecret == "" {
		return "", echo.NewHTTPError(http.StatusInternalServerError, "protected email token secret is not configured")
	}
	now := time.Now().UTC()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub":      "protected-email",
		"iss":      h.cfg.ProtectedEmailTokenIssuer,
		"aud":      h.cfg.ProtectedEmailTokenAudience,
		"iat":      now.Unix(),
		"exp":      now.Add(h.cfg.ProtectedEmailTokenTTL).Unix(),
		"verified": true,
		"email":    strings.TrimSpace(h.cfg.ProtectedEmail),
	})
	return token.SignedString([]byte(h.cfg.ProtectedEmailTokenSecret))
}

func (h InfrastructureHandler) cvRenderTarget(request *http.Request) (string, error) {
	if h.cfg.CVSourceURL != "" {
		return h.cfg.CVSourceURL, nil
	}
	base := strings.TrimSuffix(h.cfg.PublicSiteURL, "/")
	if base == "" {
		origin := request.Header.Get("Origin")
		if origin == "" {
			parsed, err := url.Parse(request.URL.String())
			if err != nil {
				return "", err
			}
			origin = parsed.Scheme + "://" + parsed.Host
		}
		base = strings.TrimSuffix(origin, "/")
	}
	if base == "" {
		return "", echo.NewHTTPError(http.StatusInternalServerError, "public site url is not configured")
	}
	return base + "/cv/print", nil
}

func (h InfrastructureHandler) cvPageID() (string, error) {
	for _, candidate := range []string{h.cfg.NotionCVPageID, h.cfg.CVSourceURL} {
		if candidate == "" {
			continue
		}
		pageID, err := notion.ParsePageID(candidate)
		if err == nil {
			return pageID, nil
		}
	}

	return "", echo.NewHTTPError(http.StatusServiceUnavailable, "notion cv page id is not configured")
}

func (h InfrastructureHandler) loadCVPayload(request *http.Request) (map[string]any, error) {
	pageID, err := h.cvPageID()
	if err != nil {
		return nil, err
	}

	recordMap, err := h.notion.GetPage(request.Context(), pageID)
	if err != nil {
		return nil, echo.NewHTTPError(http.StatusBadGateway, "failed_to_load_cv")
	}

	return map[string]any{
		"pageId":    pageID,
		"recordMap": recordMap,
	}, nil
}

func getCVLastModified(recordMap any) string {
	root, ok := recordMap.(map[string]any)
	if !ok {
		return ""
	}
	block, ok := root["block"].(map[string]any)
	if !ok || len(block) == 0 {
		return ""
	}
	for _, value := range block {
		entry, ok := value.(map[string]any)
		if !ok {
			continue
		}
		rawValue, ok := entry["value"].(map[string]any)
		if !ok {
			continue
		}
		if lastEdited := rawValue["last_edited_time"]; lastEdited != nil {
			return strings.TrimSpace(stringifyJSONValue(lastEdited))
		}
		break
	}
	return ""
}

func buildCVPDFObjectKey(lastModified string) string {
	if strings.TrimSpace(lastModified) == "" {
		return cvPDFFallbackKey
	}
	replacer := strings.NewReplacer("/", "-", "\\", "-", ":", "-", " ", "-", ".", "-", "+", "-", "=", "-", "?", "-")
	sanitized := replacer.Replace(lastModified)
	sanitized = strings.Trim(sanitized, "-")
	if sanitized == "" {
		return cvPDFFallbackKey
	}
	return cvPDFPrefix + "/cv-" + sanitized + ".pdf"
}

func getCVPDFCacheControl(lastModified string) string {
	if strings.TrimSpace(lastModified) != "" {
		return "public, max-age=31536000, immutable"
	}
	return "public, max-age=60, stale-while-revalidate=86400"
}

func stringifyJSONValue(value any) string {
	switch typed := value.(type) {
	case string:
		return typed
	case json.Number:
		return typed.String()
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	case int:
		return strconv.Itoa(typed)
	case int64:
		return strconv.FormatInt(typed, 10)
	case nil:
		return ""
	default:
		bytes, err := json.Marshal(typed)
		if err != nil {
			return ""
		}
		return strings.Trim(string(bytes), "\"")
	}
}

func buildAssetObjectKey(c echo.Context, resourceType string, resourceID string, filename string) (string, error) {
	resourceType = strings.TrimSpace(resourceType)
	resourceID = strings.TrimSpace(resourceID)
	extension := strings.ToLower(strings.TrimSpace(filepath.Ext(strings.TrimSpace(filename))))
	objectID := internalid.NewPersistentID()

	switch resourceType {
	case "post", "project":
		if resourceID == "" {
			return "", echo.NewHTTPError(http.StatusBadRequest, "missing_resource_id")
		}
		return "assets/" + resourceID + "/" + objectID + extension, nil
	case "avatar":
		if actor, ok := custommiddleware.AdminActorFromContext(c); ok && strings.TrimSpace(actor.UserID) != "" {
			return "avatars/" + strings.TrimSpace(actor.UserID) + "/" + objectID + extension, nil
		}
		if resourceID == "" {
			return "", echo.NewHTTPError(http.StatusBadRequest, "missing_resource_id")
		}
		return "avatars/" + resourceID + "/" + objectID + extension, nil
	default:
		return "", echo.NewHTTPError(http.StatusBadRequest, "invalid_resource_type")
	}
}
