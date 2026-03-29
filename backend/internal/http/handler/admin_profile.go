package handler

import (
	"errors"
	"net/http"

	custommiddleware "github.com/hyunbridge/website/backend/internal/http/middleware"
	"github.com/hyunbridge/website/backend/internal/store"
	"github.com/labstack/echo/v4"
)

type AdminProfileHandler struct {
	store         store.AdminProfileStore
	identityStore store.IdentityProfileStore
}

func NewAdminProfileHandler(profileStore store.AdminProfileStore, identityStore store.IdentityProfileStore) AdminProfileHandler {
	return AdminProfileHandler{store: profileStore, identityStore: identityStore}
}

func (h AdminProfileHandler) GetProfile(c echo.Context) error {
	profile, err := h.resolveProfile(c)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_load_profile"})
	}
	return c.JSON(http.StatusOK, map[string]any{
		"username":         profile.Username,
		"full_name":        profile.FullName,
		"avatar_url":       profile.AvatarURL,
		"email":            profile.Email,
		"git_author_name":  profile.GitAuthorName,
		"git_author_email": profile.GitAuthorEmail,
	})
}

func (h AdminProfileHandler) UpdateProfile(c echo.Context) error {
	var req struct {
		FullName       *string `json:"full_name"`
		AvatarURL      *string `json:"avatar_url"`
		GitAuthorName  *string `json:"git_author_name"`
		GitAuthorEmail *string `json:"git_author_email"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}

	profile, err := h.updateProfile(c, req.FullName, req.AvatarURL, req.GitAuthorName, req.GitAuthorEmail)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_update_profile"})
	}
	return c.JSON(http.StatusOK, map[string]any{
		"username":         profile.Username,
		"full_name":        profile.FullName,
		"avatar_url":       profile.AvatarURL,
		"email":            profile.Email,
		"git_author_name":  profile.GitAuthorName,
		"git_author_email": profile.GitAuthorEmail,
	})
}

func (h AdminProfileHandler) UpdatePassword(c echo.Context) error {
	var req struct {
		CurrentPassword string `json:"current_password"`
		Password        string `json:"password"`
	}
	if err := c.Bind(&req); err != nil || len(req.CurrentPassword) < 8 || len(req.Password) < 8 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_password"})
	}
	if err := h.store.UpdateAdminPassword(req.CurrentPassword, req.Password); err != nil {
		if errors.Is(err, store.ErrInvalidPassword()) {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "invalid_current_password"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_update_password"})
	}
	return c.JSON(http.StatusOK, map[string]bool{"ok": true})
}

func (h AdminProfileHandler) resolveProfile(c echo.Context) (store.AdminProfile, error) {
	if actor, ok := custommiddleware.AdminActorFromContext(c); ok && actor.AuthType == "bridge" && h.identityStore != nil {
		return h.identityStore.GetOrCreateIdentityProfile(actor.UserID, actor.Email)
	}

	return h.store.GetAdminProfile(), nil
}

func (h AdminProfileHandler) updateProfile(c echo.Context, fullName *string, avatarURL *string, gitAuthorName *string, gitAuthorEmail *string) (store.AdminProfile, error) {
	if actor, ok := custommiddleware.AdminActorFromContext(c); ok && actor.AuthType == "bridge" && h.identityStore != nil {
		return h.identityStore.UpsertIdentityProfile(actor.UserID, actor.Email, fullName, avatarURL, gitAuthorName, gitAuthorEmail)
	}

	return h.store.UpdateAdminProfile(fullName, avatarURL, gitAuthorName, gitAuthorEmail)
}
