package contentmd

import (
	"strings"
	"testing"
)

func TestBuildEditorialPostMarkdownUsesConsistentEmptyRepresentations(t *testing.T) {
	t.Parallel()

	doc := EditorialPostDocument{
		ID:             "01HV8JQ4Z6M9S6A7M3KQX2N1YB",
		Slug:           "example-post",
		Title:          "Example",
		Summary:        "",
		PublishedAt:    "",
		CoverImage:     nil,
		EnableComments: true,
		Tags:           nil,
		BodyMarkdown:   "hello",
	}

	markdown := BuildEditorialPostMarkdown(doc)

	assertContains(t, markdown, `id: "01HV8JQ4Z6M9S6A7M3KQX2N1YB"`)
	assertContains(t, markdown, `summary: ""`)
	assertContains(t, markdown, "publishedAt: null")
	assertContains(t, markdown, "coverImage: null")
	assertContains(t, markdown, "tags: []")
	assertNotContains(t, markdown, "tags:\n---")
}

func TestBuildEditorialProjectMarkdownUsesConsistentEmptyRepresentations(t *testing.T) {
	t.Parallel()

	doc := EditorialProjectDocument{
		ID:           "01HV8JQ4Z6M9S6A7M3KQX2N1YC",
		Slug:         "example-project",
		Title:        "Example Project",
		Summary:      "",
		PublishedAt:  "",
		CoverImage:   nil,
		SortOrder:    0,
		Tags:         nil,
		Links:        nil,
		BodyMarkdown: "body",
	}

	markdown := BuildEditorialProjectMarkdown(doc)

	assertContains(t, markdown, `id: "01HV8JQ4Z6M9S6A7M3KQX2N1YC"`)
	assertContains(t, markdown, `summary: ""`)
	assertContains(t, markdown, "publishedAt: null")
	assertContains(t, markdown, "coverImage: null")
	assertContains(t, markdown, "tags: []")
	assertContains(t, markdown, "links: []")
}

func TestParseEditorialProjectDocumentRoundTripsEmptyCollections(t *testing.T) {
	t.Parallel()

	markdown := `---
id: "01HV8JQ4Z6M9S6A7M3KQX2N1YD"
slug: "example-project"
title: "Example Project"
summary: ""
publishedAt: null
sortOrder: 0
coverImage: null
tags: []
links: []
---

body
`

	document, err := ParseEditorialProjectDocument([]byte(markdown))
	if err != nil {
		t.Fatalf("ParseEditorialProjectDocument returned error: %v", err)
	}
	if document.ID != "01HV8JQ4Z6M9S6A7M3KQX2N1YD" {
		t.Fatalf("expected id to round-trip, got %q", document.ID)
	}
	if document.Summary != "" {
		t.Fatalf("expected empty summary, got %q", document.Summary)
	}
	if document.PublishedAt != "" {
		t.Fatalf("expected empty publishedAt, got %q", document.PublishedAt)
	}
	if document.CoverImage != nil {
		t.Fatalf("expected nil cover image, got %#v", document.CoverImage)
	}
	if len(document.Tags) != 0 {
		t.Fatalf("expected no tags, got %#v", document.Tags)
	}
	if len(document.Links) != 0 {
		t.Fatalf("expected no links, got %#v", document.Links)
	}
}

func assertContains(t *testing.T, body string, needle string) {
	t.Helper()
	if !strings.Contains(body, needle) {
		t.Fatalf("expected %q in markdown:\n%s", needle, body)
	}
}

func assertNotContains(t *testing.T, body string, needle string) {
	t.Helper()
	if strings.Contains(body, needle) {
		t.Fatalf("did not expect %q in markdown:\n%s", needle, body)
	}
}
