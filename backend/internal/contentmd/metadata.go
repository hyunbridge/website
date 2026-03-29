package contentmd

func EditorialPostMetadata(doc EditorialPostDocument) map[string]any {
	return map[string]any{
		"id":             doc.ID,
		"slug":           doc.Slug,
		"title":          doc.Title,
		"summary":        doc.Summary,
		"publishedAt":    doc.PublishedAt,
		"coverImage":     doc.CoverImage,
		"enableComments": doc.EnableComments,
		"tags":           tagMetadata(doc.Tags),
	}
}

func EditorialProjectMetadata(doc EditorialProjectDocument) map[string]any {
	return map[string]any{
		"id":          doc.ID,
		"slug":        doc.Slug,
		"title":       doc.Title,
		"summary":     doc.Summary,
		"publishedAt": doc.PublishedAt,
		"coverImage":  doc.CoverImage,
		"sortOrder":   doc.SortOrder,
		"tags":        tagMetadata(doc.Tags),
		"links":       linkMetadata(doc.Links),
	}
}

func tagMetadata(tags []Tag) []map[string]string {
	items := make([]map[string]string, 0, len(tags))
	for _, tag := range tags {
		items = append(items, map[string]string{
			"id":   tag.ID,
			"name": tag.Name,
			"slug": tag.Slug,
		})
	}
	return items
}

func linkMetadata(links []Link) []map[string]any {
	items := make([]map[string]any, 0, len(links))
	for _, link := range links {
		items = append(items, map[string]any{
			"id":        emptyToNil(link.ID),
			"label":     link.Label,
			"url":       link.URL,
			"linkType":  emptyToNilPtr(link.LinkType),
			"sortOrder": link.SortOrder,
		})
	}
	return items
}

func emptyToNil(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func emptyToNilPtr(value *string) any {
	if value == nil || *value == "" {
		return nil
	}
	return *value
}
