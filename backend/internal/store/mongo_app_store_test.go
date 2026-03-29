package store

import "testing"

func TestSeedPersistedDataCreatesAdminAndHome(t *testing.T) {
	t.Parallel()

	data, err := seedPersistedData("admin@example.com", "change-me-now")
	if err != nil {
		t.Fatalf("seedPersistedData returned error: %v", err)
	}

	if data.AdminProfile.Email != "admin@example.com" {
		t.Fatalf("expected seeded admin email, got %q", data.AdminProfile.Email)
	}
	if !compareAdminPassword(data.AdminProfile.Password, "change-me-now") {
		t.Fatal("expected seeded admin password hash to validate")
	}
	if data.Home.ID == "" {
		t.Fatalf("expected seeded home document, got %#v", data.Home)
	}
	if data.Home.Data != nil || data.Home.UpdatedAt != nil || data.Home.PublishedAt != nil {
		t.Fatalf("expected seeded home state to start empty, got %#v", data.Home)
	}
	if data.Home.CurrentVersionID != nil || data.Home.PublishedVersionID != nil {
		t.Fatalf("expected seed data to defer git snapshot pointers until bootstrap, got %#v", data.Home)
	}
	if len(data.Posts) != 0 || len(data.Projects) != 0 || len(data.Tags) != 0 {
		t.Fatalf("expected empty editorial collections, got posts=%d projects=%d tags=%d", len(data.Posts), len(data.Projects), len(data.Tags))
	}
}

func TestSeedPersistedDataRequiresBootstrapCredentials(t *testing.T) {
	t.Parallel()

	if _, err := seedPersistedData("", ""); !IsBootstrapRequired(err) {
		t.Fatalf("expected bootstrap required error, got %v", err)
	}
}

func TestUpsertTagUsesProvidedSlug(t *testing.T) {
	t.Parallel()

	tags, tag := upsertTag(nil, " Hello World ", "annyeonghaseyo-segye")
	if len(tags) != 1 {
		t.Fatalf("expected 1 tag, got %d", len(tags))
	}
	if tag.Name != "Hello World" {
		t.Fatalf("expected trimmed name, got %q", tag.Name)
	}
	if tag.Slug != "annyeonghaseyo-segye" {
		t.Fatalf("expected provided slug, got %q", tag.Slug)
	}
}

func TestNormalizeHomeDataIDsCanonicalizesTemporaryNestedIDs(t *testing.T) {
	t.Parallel()

	data := map[string]any{
		"schemaVersion": 1,
		"sections": []any{
			map[string]any{
				"id":    "tmp_hero_a1b2c3",
				"type":  "hero",
				"cards": []any{map[string]any{"id": "tmp_hero-card_d4e5f6", "title": "Card"}},
			},
			map[string]any{
				"id":    "tmp_timeline_123456",
				"type":  "timeline",
				"items": []any{map[string]any{"id": "tmp_entry_abcdef", "title": "Entry"}},
			},
		},
	}

	normalized := normalizeHomeDataIDs(data)
	sections, ok := normalized["sections"].([]any)
	if !ok || len(sections) != 2 {
		t.Fatalf("expected two sections, got %#v", normalized["sections"])
	}

	hero := sections[0].(map[string]any)
	if hero["id"] == "tmp_hero_a1b2c3" || hero["id"] == "" {
		t.Fatalf("expected hero id to be rewritten, got %#v", hero["id"])
	}
	heroCards := hero["cards"].([]any)
	heroCard := heroCards[0].(map[string]any)
	if heroCard["id"] == "tmp_hero-card_d4e5f6" || heroCard["id"] == "" {
		t.Fatalf("expected hero card id to be rewritten, got %#v", heroCard["id"])
	}

	timeline := sections[1].(map[string]any)
	if timeline["id"] == "tmp_timeline_123456" || timeline["id"] == "" {
		t.Fatalf("expected timeline id to be rewritten, got %#v", timeline["id"])
	}
	items := timeline["items"].([]any)
	item := items[0].(map[string]any)
	if item["id"] == "tmp_entry_abcdef" || item["id"] == "" {
		t.Fatalf("expected timeline item id to be rewritten, got %#v", item["id"])
	}
}

func TestNormalizePersistedProjectLinksCanonicalizesTemporaryIDs(t *testing.T) {
	t.Parallel()

	links := normalizePersistedProjectLinks("project-1", []ProjectLink{
		{ID: "tmp_project-link_a1b2c3", Label: "Demo", URL: "https://example.com"},
		{ID: "", Label: "Repo", URL: "https://github.com/example/repo"},
	})

	if len(links) != 2 {
		t.Fatalf("expected two links, got %d", len(links))
	}
	for _, link := range links {
		if link.ID == "" {
			t.Fatalf("expected canonical link id, got %#v", link)
		}
		if link.ID == "tmp_project-link_a1b2c3" {
			t.Fatalf("expected temporary link id to be rewritten, got %#v", link)
		}
	}
	if links[0].ID == links[1].ID {
		t.Fatalf("expected unique link ids, got %#v", links)
	}
}
