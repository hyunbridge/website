package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/hyunbridge/website/backend/internal/config"
	"github.com/labstack/echo/v4"
)

const adminActorContextKey = "admin_actor"

type AdminActor struct {
	UserID   string
	Email    string
	AuthType string
}

func RequireAdminJWT(cfg config.Config) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			claims, err := parseAdminJWT(cfg, c.Request().Header.Get("Authorization"))
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": err.Error()})
			}

			c.Set("claims", claims)
			subject, _ := claims["sub"].(string)
			email, _ := claims["email"].(string)
			c.Set(adminActorContextKey, AdminActor{
				UserID:   strings.TrimSpace(subject),
				Email:    strings.TrimSpace(email),
				AuthType: "jwt",
			})
			return next(c)
		}
	}
}

func RequireAdminJWTOrBridge(cfg config.Config) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			request := c.Request()
			bridgeSecret := strings.TrimSpace(request.Header.Get("X-Admin-Bridge-Secret"))
			if bridgeSecret != "" {
				if cfg.AdminBridgeSecret == "" || bridgeSecret != cfg.AdminBridgeSecret {
					return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				}

				userID := strings.TrimSpace(request.Header.Get("X-Admin-User-Id"))
				email := strings.TrimSpace(request.Header.Get("X-Admin-User-Email"))
				if userID == "" {
					return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing_bridge_user"})
				}

				c.Set(adminActorContextKey, AdminActor{
					UserID:   userID,
					Email:    email,
					AuthType: "bridge",
				})
				return next(c)
			}

			claims, err := parseAdminJWT(cfg, request.Header.Get("Authorization"))
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": err.Error()})
			}

			c.Set("claims", claims)
			subject, _ := claims["sub"].(string)
			email, _ := claims["email"].(string)
			c.Set(adminActorContextKey, AdminActor{
				UserID:   strings.TrimSpace(subject),
				Email:    strings.TrimSpace(email),
				AuthType: "jwt",
			})
			return next(c)
		}
	}
}

func OptionalAdminJWTOrBridge(cfg config.Config) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			request := c.Request()
			bridgeSecret := strings.TrimSpace(request.Header.Get("X-Admin-Bridge-Secret"))
			if bridgeSecret != "" {
				if cfg.AdminBridgeSecret == "" || bridgeSecret != cfg.AdminBridgeSecret {
					return next(c)
				}

				userID := strings.TrimSpace(request.Header.Get("X-Admin-User-Id"))
				email := strings.TrimSpace(request.Header.Get("X-Admin-User-Email"))
				if userID != "" {
					c.Set(adminActorContextKey, AdminActor{
						UserID:   userID,
						Email:    email,
						AuthType: "bridge",
					})
				}
				return next(c)
			}

			claims, err := parseAdminJWT(cfg, request.Header.Get("Authorization"))
			if err == nil {
				c.Set("claims", claims)
				subject, _ := claims["sub"].(string)
				email, _ := claims["email"].(string)
				c.Set(adminActorContextKey, AdminActor{
					UserID:   strings.TrimSpace(subject),
					Email:    strings.TrimSpace(email),
					AuthType: "jwt",
				})
			}

			return next(c)
		}
	}
}

func RequireAdminForSnapshotQuery(param string) echo.MiddlewareFunc {
	queryKey := strings.TrimSpace(param)
	if queryKey == "" {
		queryKey = "at"
	}

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if strings.TrimSpace(c.QueryParam(queryKey)) == "" {
				return next(c)
			}
			if _, ok := AdminActorFromContext(c); ok {
				return next(c)
			}
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "snapshot_auth_required"})
		}
	}
}

func AdminActorFromContext(c echo.Context) (AdminActor, bool) {
	actor, ok := c.Get(adminActorContextKey).(AdminActor)
	return actor, ok
}

func parseAdminJWT(cfg config.Config, authHeader string) (map[string]any, error) {
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, errors.New("missing_or_invalid_authorization_header")
	}

	tokenString := strings.TrimPrefix(authHeader, "Bearer ")
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return []byte(cfg.JWTSecret), nil
	}, jwt.WithAudience(cfg.JWTAudience), jwt.WithIssuer(cfg.JWTIssuer))
	if err != nil || !token.Valid {
		return nil, errors.New("unauthorized")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, errors.New("unauthorized")
	}

	return map[string]any(claims), nil
}
