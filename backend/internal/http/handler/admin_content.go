package handler

import (
	"net/http"
	"strconv"
	"strings"

	custommiddleware "github.com/hyunbridge/website/backend/internal/http/middleware"
	"github.com/hyunbridge/website/backend/internal/store"
	"github.com/labstack/echo/v4"
)

type AdminContentHandler struct {
	store store.EditorialAdminStore
}

func NewAdminContentHandler(appStore store.EditorialAdminStore) AdminContentHandler {
	return AdminContentHandler{store: appStore}
}

func requireAdminActorID(c echo.Context) (string, error) {
	actor, ok := custommiddleware.AdminActorFromContext(c)
	if !ok || strings.TrimSpace(actor.UserID) == "" {
		return "", c.JSON(http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
	}
	return strings.TrimSpace(actor.UserID), nil
}

func (h AdminContentHandler) ListPosts(c echo.Context) error {
	includeDraft := c.QueryParam("includeDraft") == "true"
	page, _ := strconv.Atoi(c.QueryParam("page"))
	pageSize, _ := strconv.Atoi(c.QueryParam("pageSize"))
	tagID := c.QueryParam("tagId")
	return c.JSON(http.StatusOK, h.store.ListPostDTOsFiltered(includeDraft, page, pageSize, tagID))
}

func (h AdminContentHandler) GetPostByID(c echo.Context) error {
	post, err := h.store.GetPostDTOByID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_not_found"})
	}
	return c.JSON(http.StatusOK, post)
}

func (h AdminContentHandler) CreatePost(c echo.Context) error {
	var req struct {
		Title   string `json:"title"`
		Slug    string `json:"slug"`
		Summary string `json:"summary"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	actorID, actorErr := requireAdminActorID(c)
	if actorErr != nil {
		return actorErr
	}
	post, err := h.store.CreatePost(actorID, req.Title, req.Slug, req.Summary)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_create_post"})
	}
	dto, _ := h.store.GetPostDTOByID(post.ID)
	return c.JSON(http.StatusCreated, dto)
}

func (h AdminContentHandler) PatchPost(c echo.Context) error {
	var patch store.PostPatch
	if err := c.Bind(&patch); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	post, err := h.store.PatchPost(c.Param("id"), patch)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_not_found"})
	}
	return c.JSON(http.StatusOK, post)
}

func (h AdminContentHandler) PublishPost(c echo.Context) error {
	post, err := h.store.SetPostPublished(c.Param("id"), true)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_not_found"})
	}
	return c.JSON(http.StatusOK, post)
}

func (h AdminContentHandler) UnpublishPost(c echo.Context) error {
	post, err := h.store.SetPostPublished(c.Param("id"), false)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_not_found"})
	}
	return c.JSON(http.StatusOK, post)
}

func (h AdminContentHandler) ListProjects(c echo.Context) error {
	includeDraft := c.QueryParam("includeDraft") == "true"
	return c.JSON(http.StatusOK, h.store.ListProjectDTOs(includeDraft))
}

func (h AdminContentHandler) GetProjectByID(c echo.Context) error {
	project, err := h.store.GetProjectDTOByID(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_not_found"})
	}
	return c.JSON(http.StatusOK, project)
}

func (h AdminContentHandler) CreateProject(c echo.Context) error {
	var req struct {
		Title   string `json:"title"`
		Slug    string `json:"slug"`
		Summary string `json:"summary"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	actorID, actorErr := requireAdminActorID(c)
	if actorErr != nil {
		return actorErr
	}
	project, err := h.store.CreateProject(actorID, req.Title, req.Slug, req.Summary)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_create_project"})
	}
	dto, _ := h.store.GetProjectDTOByID(project.ID)
	return c.JSON(http.StatusCreated, dto)
}

func (h AdminContentHandler) PatchProject(c echo.Context) error {
	var patch store.ProjectPatch
	if err := c.Bind(&patch); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	project, err := h.store.PatchProject(c.Param("id"), patch)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_not_found"})
	}
	return c.JSON(http.StatusOK, project)
}

func (h AdminContentHandler) PublishProject(c echo.Context) error {
	project, err := h.store.SetProjectPublished(c.Param("id"), true)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_not_found"})
	}
	return c.JSON(http.StatusOK, project)
}

func (h AdminContentHandler) UnpublishProject(c echo.Context) error {
	project, err := h.store.SetProjectPublished(c.Param("id"), false)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_not_found"})
	}
	return c.JSON(http.StatusOK, project)
}

func (h AdminContentHandler) DeletePost(c echo.Context) error {
	assetKeys, err := h.store.DeletePostWithAssets(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_not_found"})
	}
	return c.JSON(http.StatusOK, assetKeys)
}

func (h AdminContentHandler) GetPostVersionState(c echo.Context) error {
	item, currentVersion, latestVersion, err := h.store.GetPostVersionState(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_not_found"})
	}
	return c.JSON(http.StatusOK, map[string]any{
		"item":           item,
		"currentVersion": currentVersion,
		"latestVersion":  latestVersion,
	})
}

func (h AdminContentHandler) UpdatePostVersion(c echo.Context) error {
	var req struct {
		Title             string  `json:"title"`
		Summary           string  `json:"summary"`
		Content           string  `json:"content"`
		ChangeDescription *string `json:"change_description"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	versionID, err := h.store.UpdatePostVersion(c.Param("versionId"), req.Title, req.Summary, req.Content, req.ChangeDescription)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_version_not_found"})
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true, "id": versionID})
}

func (h AdminContentHandler) CreatePostVersion(c echo.Context) error {
	var req struct {
		PostID            string  `json:"postId"`
		Title             string  `json:"title"`
		Content           string  `json:"content"`
		Summary           string  `json:"summary"`
		ChangeDescription *string `json:"changeDescription"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	actorID, actorErr := requireAdminActorID(c)
	if actorErr != nil {
		return actorErr
	}
	versionID, err := h.store.CreatePostVersion(req.PostID, req.Title, req.Summary, req.Content, actorID, req.ChangeDescription)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_not_found"})
	}
	return c.JSON(http.StatusCreated, map[string]string{"id": versionID})
}

func (h AdminContentHandler) SetPostCurrentVersion(c echo.Context) error {
	var req struct {
		VersionID string `json:"versionId"`
		Title     string `json:"title"`
		Summary   string `json:"summary"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	if err := h.store.SetPostCurrentVersion(c.Param("id"), req.VersionID, req.Title, req.Summary); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_not_found"})
	}
	return c.JSON(http.StatusOK, map[string]bool{"ok": true})
}

func (h AdminContentHandler) ListPostVersions(c echo.Context) error {
	versions, err := h.store.ListPostVersions(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_not_found"})
	}
	return c.JSON(http.StatusOK, versions)
}

func (h AdminContentHandler) GetPostVersion(c echo.Context) error {
	version, err := h.store.GetPostVersionByID(c.Param("versionId"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_version_not_found"})
	}
	return c.JSON(http.StatusOK, version)
}

func (h AdminContentHandler) RestorePostVersion(c echo.Context) error {
	var req struct {
		VersionNumber int `json:"versionNumber"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	actorID, actorErr := requireAdminActorID(c)
	if actorErr != nil {
		return actorErr
	}
	if err := h.store.RestorePostVersion(c.Param("id"), req.VersionNumber, actorID); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "post_version_not_found"})
	}
	return c.JSON(http.StatusOK, map[string]bool{"ok": true})
}

func (h AdminContentHandler) DeleteProject(c echo.Context) error {
	assetKeys, err := h.store.DeleteProjectWithAssets(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_not_found"})
	}
	return c.JSON(http.StatusOK, assetKeys)
}

func (h AdminContentHandler) GetProjectVersionState(c echo.Context) error {
	item, currentVersion, latestVersion, err := h.store.GetProjectVersionState(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_not_found"})
	}
	return c.JSON(http.StatusOK, map[string]any{
		"item":           item,
		"currentVersion": currentVersion,
		"latestVersion":  latestVersion,
	})
}

func (h AdminContentHandler) UpdateProjectVersion(c echo.Context) error {
	var req struct {
		Title             string                 `json:"title"`
		Summary           string                 `json:"summary"`
		Content           string                 `json:"content"`
		Links             []store.ProjectLinkDTO `json:"links"`
		ChangeDescription *string                `json:"change_description"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	versionID, err := h.store.UpdateProjectVersion(c.Param("versionId"), req.Title, req.Summary, req.Content, req.Links, req.ChangeDescription)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_version_not_found"})
	}
	return c.JSON(http.StatusOK, map[string]any{"ok": true, "id": versionID})
}

func (h AdminContentHandler) CreateProjectVersion(c echo.Context) error {
	var req struct {
		ProjectID         string                 `json:"projectId"`
		Title             string                 `json:"title"`
		Content           string                 `json:"content"`
		Summary           string                 `json:"summary"`
		Links             []store.ProjectLinkDTO `json:"links"`
		ChangeDescription *string                `json:"changeDescription"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	actorID, actorErr := requireAdminActorID(c)
	if actorErr != nil {
		return actorErr
	}
	versionID, err := h.store.CreateProjectVersion(req.ProjectID, req.Title, req.Summary, req.Content, req.Links, actorID, req.ChangeDescription)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_not_found"})
	}
	return c.JSON(http.StatusCreated, map[string]string{"id": versionID})
}

func (h AdminContentHandler) SetProjectCurrentVersion(c echo.Context) error {
	var req struct {
		VersionID string `json:"versionId"`
		Title     string `json:"title"`
		Summary   string `json:"summary"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	if err := h.store.SetProjectCurrentVersion(c.Param("id"), req.VersionID, req.Title, req.Summary); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_not_found"})
	}
	return c.JSON(http.StatusOK, map[string]bool{"ok": true})
}

func (h AdminContentHandler) ListProjectVersions(c echo.Context) error {
	versions, err := h.store.ListProjectVersions(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_not_found"})
	}
	return c.JSON(http.StatusOK, versions)
}

func (h AdminContentHandler) GetProjectVersion(c echo.Context) error {
	version, err := h.store.GetProjectVersionByID(c.Param("versionId"))
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_version_not_found"})
	}
	return c.JSON(http.StatusOK, version)
}

func (h AdminContentHandler) RestoreProjectVersion(c echo.Context) error {
	var req struct {
		VersionNumber int `json:"versionNumber"`
	}
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	actorID, actorErr := requireAdminActorID(c)
	if actorErr != nil {
		return actorErr
	}
	if err := h.store.RestoreProjectVersion(c.Param("id"), req.VersionNumber, actorID); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "project_version_not_found"})
	}
	return c.JSON(http.StatusOK, map[string]bool{"ok": true})
}

func (h AdminContentHandler) GetCounts(c echo.Context) error {
	postCount := len(h.store.ListPostDTOs(true))
	projectCount := len(h.store.ListProjectDTOs(true))
	return c.JSON(http.StatusOK, map[string]int{
		"postCount":    postCount,
		"projectCount": projectCount,
	})
}

func (h AdminContentHandler) ListTags(c echo.Context) error {
	return c.JSON(http.StatusOK, h.store.ListTags())
}

func (h AdminContentHandler) CreateTag(c echo.Context) error {
	var req struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Slug) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	tag, err := h.store.CreateTag(req.Name, req.Slug)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed_to_create_tag"})
	}
	return c.JSON(http.StatusCreated, store.TagDTO{ID: tag.ID, Name: tag.Name, Slug: tag.Slug})
}

func (h AdminContentHandler) UpdateTag(c echo.Context) error {
	var req struct {
		Name string `json:"name"`
		Slug string `json:"slug"`
	}
	if err := c.Bind(&req); err != nil || strings.TrimSpace(req.Name) == "" || strings.TrimSpace(req.Slug) == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid_request"})
	}
	tag, err := h.store.UpdateTag(c.Param("id"), req.Name, req.Slug)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "tag_not_found"})
	}
	return c.JSON(http.StatusOK, store.TagDTO{ID: tag.ID, Name: tag.Name, Slug: tag.Slug})
}

func (h AdminContentHandler) DeleteTag(c echo.Context) error {
	if err := h.store.DeleteTag(c.Param("id")); err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "tag_not_found"})
	}
	return c.JSON(http.StatusOK, map[string]bool{"ok": true})
}
