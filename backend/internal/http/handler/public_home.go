package handler

import (
	"errors"
	"net/http"

	"github.com/hyunbridge/website/backend/internal/publiccontent"
	"github.com/hyunbridge/website/backend/internal/store"
	"github.com/labstack/echo/v4"
)

type PublicHomeHandler struct {
	content *publiccontent.Service
}

func NewPublicHomeHandler(service *publiccontent.Service) PublicHomeHandler {
	return PublicHomeHandler{content: service}
}

func (h PublicHomeHandler) GetHome(c echo.Context) error {
	document, err := h.content.GetHome(c.Request().Context(), c.QueryParam("at"))
	if err != nil {
		if errors.Is(err, store.ErrNotFound()) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "home_not_found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_load_home"})
	}
	return c.JSON(http.StatusOK, document)
}
