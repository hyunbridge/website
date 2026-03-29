package notion

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"
)

const apiBaseURL = "https://www.notion.so/api/v3"

var (
	pageIDRegex      = regexp.MustCompile(`\b([\da-f]{32})\b`)
	pageIDUUIDRegex  = regexp.MustCompile(`\b([\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12})\b`)
	errInvalidPageID = errors.New("invalid notion page id")
	errPageNotFound  = errors.New("notion page not found")
)

type Client struct {
	httpClient *http.Client
}

func New() Client {
	return Client{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

func ParsePageID(value string) (string, error) {
	value = strings.TrimSpace(strings.Split(value, "?")[0])
	if value == "" {
		return "", errInvalidPageID
	}

	lower := strings.ToLower(value)
	if match := pageIDRegex.FindStringSubmatch(lower); len(match) > 1 {
		return idToUUID(match[1]), nil
	}
	if match := pageIDUUIDRegex.FindStringSubmatch(lower); len(match) > 1 {
		return match[1], nil
	}

	return "", errInvalidPageID
}

func (c Client) GetPage(ctx context.Context, pageRef string) (map[string]any, error) {
	pageID, err := ParsePageID(pageRef)
	if err != nil {
		return nil, err
	}

	pageChunk := map[string]any{}
	if err := c.post(ctx, "loadPageChunk", map[string]any{
		"pageId":          pageID,
		"limit":           100,
		"chunkNumber":     0,
		"cursor":          map[string]any{"stack": []any{}},
		"verticalColumns": false,
	}, &pageChunk); err != nil {
		return nil, err
	}

	recordMap, ok := asMap(pageChunk["recordMap"])
	if !ok {
		return nil, errPageNotFound
	}
	blockMap, ok := asMap(recordMap["block"])
	if !ok || len(blockMap) == 0 {
		return nil, errPageNotFound
	}

	ensureMap(recordMap, "collection")
	ensureMap(recordMap, "collection_view")
	ensureMap(recordMap, "notion_user")
	ensureMap(recordMap, "collection_query")
	ensureMap(recordMap, "signed_urls")

	for {
		pending := pendingBlockIDs(recordMap, pageID)
		if len(pending) == 0 {
			break
		}

		requests := make([]map[string]any, 0, len(pending))
		for _, blockID := range pending {
			requests = append(requests, map[string]any{
				"table":   "block",
				"id":      blockID,
				"version": -1,
			})
		}

		blocksResponse := map[string]any{}
		if err := c.post(ctx, "syncRecordValuesMain", map[string]any{"requests": requests}, &blocksResponse); err != nil {
			return nil, err
		}

		nextBlocks, ok := asMapPath(blocksResponse, "recordMap", "block")
		if !ok || len(nextBlocks) == 0 {
			break
		}
		mergeMaps(blockMap, nextBlocks)
	}

	if err := c.addSignedURLs(ctx, recordMap, pageID); err != nil {
		return nil, err
	}

	return recordMap, nil
}

func (c Client) addSignedURLs(ctx context.Context, recordMap map[string]any, pageID string) error {
	blockMap, ok := asMap(recordMap["block"])
	if !ok {
		return nil
	}
	signedURLs := ensureMap(recordMap, "signed_urls")

	type signedURLRequest struct {
		PermissionRecord map[string]string `json:"permissionRecord"`
		URL              string            `json:"url"`
	}

	requests := make([]signedURLRequest, 0)
	for _, blockID := range contentBlockIDs(recordMap, pageID) {
		block := unwrapValue(blockMap[blockID])
		blockObj, ok := block.(map[string]any)
		if !ok {
			continue
		}
		source := signedURLSource(blockObj)
		if source == "" {
			continue
		}

		requests = append(requests, signedURLRequest{
			PermissionRecord: map[string]string{
				"table": "block",
				"id":    stringValue(blockObj["id"]),
			},
			URL: source,
		})
	}

	if len(requests) == 0 {
		return nil
	}

	var response struct {
		SignedURLs []string `json:"signedUrls"`
	}
	if err := c.post(ctx, "getSignedFileUrls", map[string]any{"urls": requests}, &response); err != nil {
		return nil
	}

	for idx, signedURL := range response.SignedURLs {
		if idx >= len(requests) || signedURL == "" {
			continue
		}
		signedURLs[requests[idx].PermissionRecord["id"]] = signedURL
	}

	return nil
}

func pendingBlockIDs(recordMap map[string]any, pageID string) []string {
	blockMap, ok := asMap(recordMap["block"])
	if !ok {
		return nil
	}

	pending := make([]string, 0)
	for _, blockID := range contentBlockIDs(recordMap, pageID) {
		if _, exists := blockMap[blockID]; !exists {
			pending = append(pending, blockID)
		}
	}
	return pending
}

func contentBlockIDs(recordMap map[string]any, pageID string) []string {
	blockMap, ok := asMap(recordMap["block"])
	if !ok {
		return nil
	}

	rootBlockID := pageID
	if _, exists := blockMap[rootBlockID]; !exists {
		for blockID := range blockMap {
			rootBlockID = blockID
			break
		}
	}

	seen := make(map[string]struct{})
	var walk func(string)
	walk = func(blockID string) {
		if blockID == "" {
			return
		}
		if _, exists := seen[blockID]; exists {
			return
		}
		seen[blockID] = struct{}{}

		block := unwrapValue(blockMap[blockID])
		blockObj, ok := block.(map[string]any)
		if !ok {
			return
		}

		for _, refID := range pageReferences(blockObj["properties"]) {
			walk(refID)
		}

		if format, ok := asMap(blockObj["format"]); ok {
			if pointer, ok := asMap(format["transclusion_reference_pointer"]); ok {
				walk(stringValue(pointer["id"]))
			}
		}

		content := stringSlice(blockObj["content"])
		if len(content) == 0 {
			return
		}

		blockType := stringValue(blockObj["type"])
		if blockID != rootBlockID && (blockType == "page" || blockType == "collection_view_page") {
			return
		}

		for _, childID := range content {
			walk(childID)
		}
	}

	walk(rootBlockID)

	ids := make([]string, 0, len(seen))
	for blockID := range seen {
		ids = append(ids, blockID)
	}
	slices.Sort(ids)
	return ids
}

func pageReferences(value any) []string {
	refs := make([]string, 0)

	var walk func(any)
	walk = func(current any) {
		switch typed := current.(type) {
		case []any:
			if len(typed) > 1 {
				tag, tagOK := typed[0].(string)
				refID, idOK := typed[1].(string)
				if tagOK && idOK && tag == "p" {
					refs = append(refs, refID)
				}
			}
			for _, item := range typed {
				walk(item)
			}
		case map[string]any:
			for _, item := range typed {
				walk(item)
			}
		}
	}

	walk(value)
	return refs
}

func signedURLSource(block map[string]any) string {
	switch stringValue(block["type"]) {
	case "page":
		format, ok := asMap(block["format"])
		if !ok {
			return ""
		}
		source := stringValue(format["page_cover"])
		if needsSignedURL(source) {
			return source
		}
	case "pdf", "audio", "video", "file":
		source := propertySource(block)
		if needsSignedURL(source) {
			return source
		}
	case "image":
		if len(stringSlice(block["file_ids"])) == 0 {
			return ""
		}
		source := propertySource(block)
		if needsSignedURL(source) {
			return source
		}
	}

	return ""
}

func propertySource(block map[string]any) string {
	properties, ok := asMap(block["properties"])
	if !ok {
		return ""
	}
	return firstNestedString(properties["source"])
}

func firstNestedString(value any) string {
	switch typed := value.(type) {
	case []any:
		for _, item := range typed {
			if text := firstNestedString(item); text != "" {
				return text
			}
		}
	case string:
		return typed
	}
	return ""
}

func needsSignedURL(source string) bool {
	return strings.Contains(source, "secure.notion-static.com") ||
		strings.Contains(source, "prod-files-secure") ||
		strings.Contains(source, "attachment:")
}

func (c Client) post(ctx context.Context, endpoint string, body any, out any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, apiBaseURL+"/"+endpoint, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Accept", "application/json")

	response, err := c.httpClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("notion api %s returned %d", endpoint, response.StatusCode)
	}

	return json.NewDecoder(response.Body).Decode(out)
}

func asMap(value any) (map[string]any, bool) {
	typed, ok := value.(map[string]any)
	return typed, ok
}

func asMapPath(value any, path ...string) (map[string]any, bool) {
	current := value
	for _, segment := range path {
		next, ok := asMap(current)
		if !ok {
			return nil, false
		}
		current = next[segment]
	}
	return asMap(current)
}

func ensureMap(target map[string]any, key string) map[string]any {
	if current, ok := asMap(target[key]); ok {
		return current
	}
	next := map[string]any{}
	target[key] = next
	return next
}

func mergeMaps(target map[string]any, source map[string]any) {
	for key, value := range source {
		target[key] = value
	}
}

func unwrapValue(value any) any {
	current := value
	for {
		obj, ok := current.(map[string]any)
		if !ok {
			return current
		}
		next, exists := obj["value"]
		if !exists {
			return obj
		}
		current = next
	}
}

func stringValue(value any) string {
	text, _ := value.(string)
	return text
}

func stringSlice(value any) []string {
	items, ok := value.([]any)
	if !ok {
		return nil
	}

	result := make([]string, 0, len(items))
	for _, item := range items {
		if text, ok := item.(string); ok && text != "" {
			result = append(result, text)
		}
	}
	return result
}

func idToUUID(id string) string {
	if len(id) != 32 {
		return id
	}
	return fmt.Sprintf("%s-%s-%s-%s-%s", id[0:8], id[8:12], id[12:16], id[16:20], id[20:32])
}
