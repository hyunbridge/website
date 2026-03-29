package auth

import (
	"errors"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/hyunbridge/website/backend/internal/config"
	"github.com/hyunbridge/website/backend/internal/store"
)

type TokenService struct {
	cfg config.Config
}

type AccessToken struct {
	AccessToken string `json:"accessToken"`
	ExpiresIn   int64  `json:"expiresIn"`
}

func NewTokenService(cfg config.Config) TokenService {
	return TokenService{cfg: cfg}
}

func (ts TokenService) IssueAdminToken(profile store.AdminProfile) (AccessToken, error) {
	if ts.cfg.JWTSecret == "" {
		return AccessToken{}, errors.New("jwt secret is not configured")
	}
	subject := strings.TrimSpace(profile.ID)
	if subject == "" {
		return AccessToken{}, errors.New("admin profile id is required")
	}

	now := time.Now().UTC()
	expiresAt := now.Add(ts.cfg.AccessTokenTTL)

	claims := jwt.MapClaims{
		"sub":      subject,
		"iss":      ts.cfg.JWTIssuer,
		"aud":      ts.cfg.JWTAudience,
		"iat":      now.Unix(),
		"exp":      expiresAt.Unix(),
		"role":     "admin",
		"email":    strings.TrimSpace(profile.Email),
		"username": strings.TrimSpace(profile.Username),
	}
	if profile.FullName != nil && strings.TrimSpace(*profile.FullName) != "" {
		claims["name"] = strings.TrimSpace(*profile.FullName)
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	signedToken, err := token.SignedString([]byte(ts.cfg.JWTSecret))
	if err != nil {
		return AccessToken{}, err
	}

	return AccessToken{
		AccessToken: signedToken,
		ExpiresIn:   int64(ts.cfg.AccessTokenTTL / time.Second),
	}, nil
}
