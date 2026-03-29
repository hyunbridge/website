package store

import internalid "github.com/hyunbridge/website/backend/internal/id"

func normalizeHomeDataIDs(data map[string]any) map[string]any {
	if data == nil {
		return nil
	}

	cloned := cloneMap(data)
	rawSections, ok := cloned["sections"].([]any)
	if !ok {
		return cloned
	}

	sections := make([]any, 0, len(rawSections))
	for _, rawSection := range rawSections {
		section, ok := rawSection.(map[string]any)
		if !ok {
			sections = append(sections, rawSection)
			continue
		}

		nextSection := cloneMap(section)
		nextSection["id"] = internalid.CanonicalizeSecondaryPersistentID(stringValueAny(nextSection["id"]))

		switch nextSection["type"] {
		case "hero":
			nextSection["cards"] = normalizeHomeCollectionIDs(nextSection["cards"])
		case "timeline", "cards":
			nextSection["items"] = normalizeHomeCollectionIDs(nextSection["items"])
		}

		sections = append(sections, nextSection)
	}

	cloned["sections"] = sections
	return cloned
}

func normalizeHomeCollectionIDs(value any) []any {
	rawItems, ok := value.([]any)
	if !ok {
		return []any{}
	}

	items := make([]any, 0, len(rawItems))
	for _, rawItem := range rawItems {
		item, ok := rawItem.(map[string]any)
		if !ok {
			items = append(items, rawItem)
			continue
		}

		nextItem := cloneMap(item)
		nextItem["id"] = internalid.CanonicalizeSecondaryPersistentID(stringValueAny(nextItem["id"]))
		items = append(items, nextItem)
	}

	return items
}

func cloneMap(source map[string]any) map[string]any {
	target := make(map[string]any, len(source))
	for key, value := range source {
		target[key] = value
	}
	return target
}

func stringValueAny(value any) string {
	casted, ok := value.(string)
	if !ok {
		return ""
	}
	return casted
}
