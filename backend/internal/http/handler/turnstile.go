package handler

import (
	"strings"

	"github.com/hyunbridge/website/backend/internal/config"
	"github.com/hyunbridge/website/backend/internal/platform/turnstile"
)

func shouldBypassTurnstile(cfg config.Config) bool {
	return strings.TrimSpace(cfg.TurnstileSecret) == "" && strings.ToLower(strings.TrimSpace(cfg.AppEnv)) != "production"
}

func verifyTurnstile(cfg config.Config, token string) error {
	if shouldBypassTurnstile(cfg) {
		return nil
	}
	return turnstile.Verify(cfg.TurnstileSecret, token)
}
