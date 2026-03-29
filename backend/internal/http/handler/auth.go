package handler

import (
	"net/http"
	"strings"

	"github.com/go-playground/validator/v10"
	"github.com/hyunbridge/website/backend/internal/auth"
	"github.com/hyunbridge/website/backend/internal/config"
	"github.com/hyunbridge/website/backend/internal/store"
	"github.com/labstack/echo/v4"
)

type AuthHandler struct {
	cfg          config.Config
	tokenService auth.TokenService
	validator    *validator.Validate
	store        store.AdminAuthStore
}

type LoginRequest struct {
	Email        string `json:"email" validate:"required,email"`
	Password     string `json:"password" validate:"required,min=8"`
	CaptchaToken string `json:"captchaToken"`
}

func NewAuthHandler(cfg config.Config, tokenService auth.TokenService, authStore store.AdminAuthStore) AuthHandler {
	return AuthHandler{
		cfg:          cfg,
		tokenService: tokenService,
		validator:    validator.New(),
		store:        authStore,
	}
}

func (h AuthHandler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	if err := h.validator.Struct(req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_credentials_shape"})
	}
	if !shouldBypassTurnstile(h.cfg) && strings.TrimSpace(req.CaptchaToken) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "captcha_required"})
	}
	if err := verifyTurnstile(h.cfg, req.CaptchaToken); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": err.Error()})
	}

	if !h.store.AuthenticateAdmin(req.Email, req.Password) {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid_credentials"})
	}

	token, err := h.tokenService.IssueAdminToken(h.store.GetAdminProfile())
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_issue_token"})
	}

	return c.JSON(http.StatusOK, token)
}
