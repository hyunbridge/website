package handler

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

func (h AuthHandler) Me(c echo.Context) error {
	claims, ok := c.Get("claims").(map[string]any)
	if !ok {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}

	subject, _ := claims["sub"].(string)
	email, _ := claims["email"].(string)
	role, _ := claims["role"].(string)

	return c.JSON(http.StatusOK, map[string]string{
		"id":    subject,
		"email": email,
		"role":  role,
	})
}
