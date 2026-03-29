package contentmd

import (
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"gopkg.in/yaml.v3"
)

type Tag struct {
	ID   string
	Name string
	Slug string
}

type Link struct {
	ID        string
	Label     string
	URL       string
	LinkType  *string
	SortOrder int
}

type EditorialPostDocument struct {
	ID             string
	Slug           string
	Title          string
	Summary        string
	PublishedAt    string
	CoverImage     *string
	EnableComments bool
	Tags           []Tag
	BodyMarkdown   string
}

type EditorialProjectDocument struct {
	ID           string
	Slug         string
	Title        string
	Summary      string
	PublishedAt  string
	CoverImage   *string
	SortOrder    int
	Tags         []Tag
	Links        []Link
	BodyMarkdown string
}

type PostDocument struct {
	ID                string
	Slug              string
	Title             string
	Summary           string
	CreatedAt         string
	PublishedAt       string
	CoverImage        *string
	EnableComments    bool
	AuthorName        string
	AuthorAvatarURL   *string
	Tags              []Tag
	CreatedBy         string
	ChangeDescription *string
	BodyMarkdown      string
}

type ProjectDocument struct {
	ID                string
	Slug              string
	Title             string
	Summary           string
	CreatedAt         string
	PublishedAt       string
	CoverImage        *string
	SortOrder         int
	OwnerName         string
	OwnerAvatarURL    *string
	Tags              []Tag
	Links             []Link
	CreatedBy         string
	ChangeDescription *string
	BodyMarkdown      string
}

type markdownDocument struct {
	fields   map[string]string
	sections map[string][]map[string]string
	body     string
}

func BuildEditorialPostMarkdown(doc EditorialPostDocument) string {
	var builder strings.Builder
	builder.WriteString("---\n")
	writeFrontmatterString(&builder, "id", doc.ID)
	writeFrontmatterString(&builder, "slug", doc.Slug)
	writeFrontmatterString(&builder, "title", doc.Title)
	writeFrontmatterString(&builder, "summary", doc.Summary)
	writeFrontmatterOptionalString(&builder, "publishedAt", doc.PublishedAt)
	writeFrontmatterBool(&builder, "enableComments", doc.EnableComments)
	writeFrontmatterNullableString(&builder, "coverImage", doc.CoverImage)
	writeFrontmatterTags(&builder, doc.Tags)
	builder.WriteString("---\n\n")
	builder.WriteString(strings.TrimSpace(strings.ReplaceAll(doc.BodyMarkdown, "\r\n", "\n")))
	builder.WriteString("\n")
	return builder.String()
}

func BuildEditorialProjectMarkdown(doc EditorialProjectDocument) string {
	var builder strings.Builder
	builder.WriteString("---\n")
	writeFrontmatterString(&builder, "id", doc.ID)
	writeFrontmatterString(&builder, "slug", doc.Slug)
	writeFrontmatterString(&builder, "title", doc.Title)
	writeFrontmatterString(&builder, "summary", doc.Summary)
	writeFrontmatterOptionalString(&builder, "publishedAt", doc.PublishedAt)
	writeFrontmatterInt(&builder, "sortOrder", doc.SortOrder)
	writeFrontmatterNullableString(&builder, "coverImage", doc.CoverImage)
	writeFrontmatterTags(&builder, doc.Tags)
	writeFrontmatterLinks(&builder, doc.Links)
	builder.WriteString("---\n\n")
	builder.WriteString(strings.TrimSpace(strings.ReplaceAll(doc.BodyMarkdown, "\r\n", "\n")))
	builder.WriteString("\n")
	return builder.String()
}

func BuildPostMarkdown(doc PostDocument) string {
	var builder strings.Builder
	builder.WriteString("---\n")
	writeFrontmatterString(&builder, "id", doc.ID)
	writeFrontmatterString(&builder, "slug", doc.Slug)
	writeFrontmatterString(&builder, "title", doc.Title)
	writeFrontmatterString(&builder, "summary", doc.Summary)
	writeFrontmatterString(&builder, "createdAt", doc.CreatedAt)
	writeFrontmatterOptionalString(&builder, "publishedAt", doc.PublishedAt)
	writeFrontmatterBool(&builder, "enableComments", doc.EnableComments)
	writeFrontmatterNullableString(&builder, "coverImage", doc.CoverImage)
	writeFrontmatterString(&builder, "authorName", doc.AuthorName)
	writeFrontmatterNullableString(&builder, "authorAvatarUrl", doc.AuthorAvatarURL)
	writeFrontmatterOptionalString(&builder, "createdBy", doc.CreatedBy)
	writeFrontmatterNullableString(&builder, "changeDescription", doc.ChangeDescription)
	writeFrontmatterTags(&builder, doc.Tags)
	builder.WriteString("---\n\n")
	builder.WriteString(strings.TrimSpace(strings.ReplaceAll(doc.BodyMarkdown, "\r\n", "\n")))
	builder.WriteString("\n")
	return builder.String()
}

func BuildProjectMarkdown(doc ProjectDocument) string {
	var builder strings.Builder
	builder.WriteString("---\n")
	writeFrontmatterString(&builder, "id", doc.ID)
	writeFrontmatterString(&builder, "slug", doc.Slug)
	writeFrontmatterString(&builder, "title", doc.Title)
	writeFrontmatterString(&builder, "summary", doc.Summary)
	writeFrontmatterString(&builder, "createdAt", doc.CreatedAt)
	writeFrontmatterOptionalString(&builder, "publishedAt", doc.PublishedAt)
	writeFrontmatterInt(&builder, "sortOrder", doc.SortOrder)
	writeFrontmatterNullableString(&builder, "coverImage", doc.CoverImage)
	writeFrontmatterString(&builder, "ownerName", doc.OwnerName)
	writeFrontmatterNullableString(&builder, "ownerAvatarUrl", doc.OwnerAvatarURL)
	writeFrontmatterOptionalString(&builder, "createdBy", doc.CreatedBy)
	writeFrontmatterNullableString(&builder, "changeDescription", doc.ChangeDescription)
	writeFrontmatterTags(&builder, doc.Tags)
	writeFrontmatterLinks(&builder, doc.Links)
	builder.WriteString("---\n\n")
	builder.WriteString(strings.TrimSpace(strings.ReplaceAll(doc.BodyMarkdown, "\r\n", "\n")))
	builder.WriteString("\n")
	return builder.String()
}

func ParseEditorialPostDocument(payload []byte) (EditorialPostDocument, error) {
	document, err := parseMarkdownDocument(payload)
	if err != nil {
		return EditorialPostDocument{}, err
	}
	return EditorialPostDocument{
		ID:             document.fields["id"],
		Slug:           document.fields["slug"],
		Title:          document.fields["title"],
		Summary:        document.fields["summary"],
		PublishedAt:    document.fields["publishedAt"],
		CoverImage:     nilIfEmpty(document.fields["coverImage"]),
		EnableComments: parseBool(document.fields["enableComments"]),
		Tags:           parseTags(document.sections["tags"]),
		BodyMarkdown:   document.body,
	}, nil
}

func ParseEditorialProjectDocument(payload []byte) (EditorialProjectDocument, error) {
	document, err := parseMarkdownDocument(payload)
	if err != nil {
		return EditorialProjectDocument{}, err
	}
	return EditorialProjectDocument{
		ID:           document.fields["id"],
		Slug:         document.fields["slug"],
		Title:        document.fields["title"],
		Summary:      document.fields["summary"],
		PublishedAt:  document.fields["publishedAt"],
		CoverImage:   nilIfEmpty(document.fields["coverImage"]),
		SortOrder:    parseInt(document.fields["sortOrder"]),
		Tags:         parseTags(document.sections["tags"]),
		Links:        parseLinks(document.sections["links"]),
		BodyMarkdown: document.body,
	}, nil
}

func ParsePostDocument(payload []byte) (PostDocument, error) {
	document, err := parseMarkdownDocument(payload)
	if err != nil {
		return PostDocument{}, err
	}
	return PostDocument{
		ID:                document.fields["id"],
		Slug:              document.fields["slug"],
		Title:             document.fields["title"],
		Summary:           document.fields["summary"],
		CreatedAt:         document.fields["createdAt"],
		PublishedAt:       document.fields["publishedAt"],
		CoverImage:        nilIfEmpty(document.fields["coverImage"]),
		EnableComments:    parseBool(document.fields["enableComments"]),
		AuthorName:        document.fields["authorName"],
		AuthorAvatarURL:   nilIfEmpty(document.fields["authorAvatarUrl"]),
		Tags:              parseTags(document.sections["tags"]),
		CreatedBy:         document.fields["createdBy"],
		ChangeDescription: nilIfEmpty(document.fields["changeDescription"]),
		BodyMarkdown:      document.body,
	}, nil
}

func ParseProjectDocument(payload []byte) (ProjectDocument, error) {
	document, err := parseMarkdownDocument(payload)
	if err != nil {
		return ProjectDocument{}, err
	}
	return ProjectDocument{
		ID:                document.fields["id"],
		Slug:              document.fields["slug"],
		Title:             document.fields["title"],
		Summary:           document.fields["summary"],
		CreatedAt:         document.fields["createdAt"],
		PublishedAt:       document.fields["publishedAt"],
		CoverImage:        nilIfEmpty(document.fields["coverImage"]),
		SortOrder:         parseInt(document.fields["sortOrder"]),
		OwnerName:         document.fields["ownerName"],
		OwnerAvatarURL:    nilIfEmpty(document.fields["ownerAvatarUrl"]),
		Tags:              parseTags(document.sections["tags"]),
		Links:             parseLinks(document.sections["links"]),
		CreatedBy:         document.fields["createdBy"],
		ChangeDescription: nilIfEmpty(document.fields["changeDescription"]),
		BodyMarkdown:      document.body,
	}, nil
}

func parseMarkdownDocument(payload []byte) (markdownDocument, error) {
	content := strings.ReplaceAll(string(payload), "\r\n", "\n")
	if !strings.HasPrefix(content, "---\n") {
		return markdownDocument{}, errors.New("markdown document is missing frontmatter")
	}

	parts := strings.SplitN(content, "\n---\n", 2)
	if len(parts) != 2 {
		return markdownDocument{}, errors.New("markdown document has invalid frontmatter")
	}

	fields, sections, err := parseFrontmatter(strings.TrimPrefix(parts[0], "---\n"))
	if err != nil {
		return markdownDocument{}, err
	}

	return markdownDocument{
		fields:   fields,
		sections: sections,
		body:     strings.TrimSpace(parts[1]),
	}, nil
}

func parseFrontmatter(raw string) (map[string]string, map[string][]map[string]string, error) {
	var payload map[string]any
	if err := yaml.Unmarshal([]byte(raw), &payload); err != nil {
		return nil, nil, errors.New("markdown document has invalid frontmatter")
	}

	fields := make(map[string]string)
	sections := make(map[string][]map[string]string)

	for key, value := range payload {
		switch typed := value.(type) {
		case []any:
			items, ok := normalizeSection(typed)
			if !ok {
				return nil, nil, errors.New("markdown document has invalid frontmatter")
			}
			sections[key] = items
		default:
			fields[key] = stringifyValue(typed)
		}
	}

	return fields, sections, nil
}

func normalizeSection(values []any) ([]map[string]string, bool) {
	items := make([]map[string]string, 0, len(values))
	for _, value := range values {
		record, ok := value.(map[string]any)
		if !ok {
			return nil, false
		}
		item := make(map[string]string, len(record))
		for key, child := range record {
			item[key] = stringifyValue(child)
		}
		items = append(items, item)
	}
	return items, true
}

func parseTags(items []map[string]string) []Tag {
	tags := make([]Tag, 0, len(items))
	for _, item := range items {
		tags = append(tags, Tag{
			ID:   item["id"],
			Name: item["name"],
			Slug: item["slug"],
		})
	}
	return tags
}

func parseLinks(items []map[string]string) []Link {
	links := make([]Link, 0, len(items))
	for _, item := range items {
		links = append(links, Link{
			ID:        item["id"],
			Label:     item["label"],
			URL:       item["url"],
			LinkType:  nilIfEmpty(item["linkType"]),
			SortOrder: parseInt(item["sortOrder"]),
		})
	}
	return links
}

func stringifyValue(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	case bool:
		if typed {
			return "true"
		}
		return "false"
	case int:
		return strconv.Itoa(typed)
	case int64:
		return strconv.FormatInt(typed, 10)
	case float64:
		if typed == float64(int64(typed)) {
			return strconv.FormatInt(int64(typed), 10)
		}
		return strconv.FormatFloat(typed, 'f', -1, 64)
	default:
		payload, err := json.Marshal(typed)
		if err != nil {
			return ""
		}
		return string(payload)
	}
}

func parseBool(value string) bool {
	return strings.EqualFold(strings.TrimSpace(value), "true")
}

func parseInt(value string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return 0
	}
	return parsed
}

func nilIfEmpty(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	copyValue := value
	return &copyValue
}

func writeFrontmatterString(builder *strings.Builder, key string, value string) {
	builder.WriteString(key + `: "` + escapeFrontmatter(value) + "\"\n")
}

func writeFrontmatterOptionalString(builder *strings.Builder, key string, value string) {
	if strings.TrimSpace(value) == "" {
		builder.WriteString(key + ": null\n")
		return
	}
	writeFrontmatterString(builder, key, value)
}

func writeFrontmatterNullableString(builder *strings.Builder, key string, value *string) {
	if value == nil || strings.TrimSpace(*value) == "" {
		builder.WriteString(key + ": null\n")
		return
	}
	writeFrontmatterString(builder, key, *value)
}

func writeFrontmatterTags(builder *strings.Builder, tags []Tag) {
	if len(tags) == 0 {
		builder.WriteString("tags: []\n")
		return
	}
	builder.WriteString("tags:\n")
	for _, tag := range tags {
		builder.WriteString(`  - id: "` + escapeFrontmatter(tag.ID) + "\"\n")
		builder.WriteString(`    name: "` + escapeFrontmatter(tag.Name) + "\"\n")
		builder.WriteString(`    slug: "` + escapeFrontmatter(tag.Slug) + "\"\n")
	}
}

func writeFrontmatterLinks(builder *strings.Builder, links []Link) {
	if len(links) == 0 {
		builder.WriteString("links: []\n")
		return
	}
	builder.WriteString("links:\n")
	for _, link := range links {
		builder.WriteString(`  - id: "` + escapeFrontmatter(link.ID) + "\"\n")
		builder.WriteString(`    label: "` + escapeFrontmatter(link.Label) + "\"\n")
		builder.WriteString(`    url: "` + escapeFrontmatter(link.URL) + "\"\n")
		if link.LinkType != nil {
			builder.WriteString(`    linkType: "` + escapeFrontmatter(*link.LinkType) + "\"\n")
		} else {
			builder.WriteString("    linkType: null\n")
		}
		builder.WriteString("    sortOrder: " + strconv.Itoa(link.SortOrder) + "\n")
	}
}

func writeFrontmatterBool(builder *strings.Builder, key string, value bool) {
	builder.WriteString(key + ": " + strconv.FormatBool(value) + "\n")
}

func writeFrontmatterInt(builder *strings.Builder, key string, value int) {
	builder.WriteString(key + ": " + strconv.Itoa(value) + "\n")
}

func escapeFrontmatter(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, "\n", " ")
	return strings.ReplaceAll(value, `"`, `\"`)
}
