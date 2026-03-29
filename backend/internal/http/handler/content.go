package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/hyunbridge/website/backend/internal/publiccontent"
	"github.com/hyunbridge/website/backend/internal/store"
	"github.com/labstack/echo/v4"
)

type ContentHandler struct {
	content *publiccontent.Service
}

func NewContentHandler(service *publiccontent.Service) ContentHandler {
	return ContentHandler{content: service}
}

func (h ContentHandler) ListPosts(c echo.Context) error {
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	tagID := c.QueryParam("tagId")
	at := c.QueryParam("at")
	posts, err := h.content.ListPosts(c.Request().Context(), at, page, pageSize, tagID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_load_posts"})
	}
	return c.JSON(http.StatusOK, posts)
}

func (h ContentHandler) GetPost(c echo.Context) error {
	at := c.QueryParam("at")
	post, err := h.content.GetPostBySlug(c.Request().Context(), c.Param("slug"), at)
	if err != nil {
		if errors.Is(err, store.ErrNotFound()) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "post_not_found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_load_post"})
	}
	return c.JSON(http.StatusOK, post)
}

func (h ContentHandler) GetPublishedPostVersion(c echo.Context) error {
	version, err := h.content.GetPublishedPostVersionByID(c.Param("versionId"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_version_not_found"})
	}
	return c.JSON(http.StatusOK, map[string]any{
		"id":      version.ID,
		"title":   version.Title,
		"summary": version.Summary,
		"content": version.Content,
	})
}

func (h ContentHandler) ListTags(c echo.Context) error {
	at := c.QueryParam("at")
	tags, err := h.content.ListTags(c.Request().Context(), at)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_load_tags"})
	}
	return c.JSON(http.StatusOK, tags)
}

func (h ContentHandler) ListProjects(c echo.Context) error {
	at := c.QueryParam("at")
	projects, err := h.content.ListProjects(c.Request().Context(), at)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_load_projects"})
	}
	return c.JSON(http.StatusOK, projects)
}

func (h ContentHandler) GetProject(c echo.Context) error {
	at := c.QueryParam("at")
	project, err := h.content.GetProjectBySlug(c.Request().Context(), c.Param("slug"), at)
	if err != nil {
		if errors.Is(err, store.ErrNotFound()) {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "project_not_found"})
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_load_project"})
	}
	return c.JSON(http.StatusOK, project)
}

func (h ContentHandler) GetPublishedProjectVersion(c echo.Context) error {
	version, err := h.content.GetPublishedProjectVersionByID(c.Param("versionId"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_version_not_found"})
	}
	return c.JSON(http.StatusOK, map[string]any{
		"id":      version.ID,
		"title":   version.Title,
		"summary": version.Summary,
		"content": version.Content,
		"links":   version.Links,
	})
}
