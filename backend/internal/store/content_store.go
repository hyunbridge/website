package store

import (
	"errors"

	"github.com/hyunbridge/website/backend/internal/domain"
)

var (
	errNotFound        = errors.New("not_found")
	errInvalidPassword = errors.New("invalid_current_password")
)

func ErrNotFound() error {
	return errNotFound
}

func ErrInvalidPassword() error {
	return errInvalidPassword
}

type ContentStore interface {
	GetHome() domain.HomePayload
	ListPosts() []domain.SummaryCard
	GetPost(slug string) (domain.PostDetail, error)
	ListProjects() []domain.SummaryCard
	GetProject(slug string) (domain.ProjectDetail, error)
}

type MemoryContentStore struct {
	home     domain.HomePayload
	posts    []domain.PostDetail
	projects []domain.ProjectDetail
}

func NewMemoryContentStore() *MemoryContentStore {
	posts := []domain.PostDetail{
		{
			SummaryCard: domain.SummaryCard{
				ID:          "post-migration-001",
				Slug:        "leaving-supabase-without-breaking-content",
				Title:       "Leaving Supabase Without Breaking Content",
				Summary:     "The new product keeps the editorial model but moves ownership of auth, content, and assets into a Go API.",
				PublishedAt: "2026-03-15T00:00:00Z",
				Tags:        []string{"architecture", "migration"},
			},
			Body: []string{
				"The old site treated Supabase as both database and application backend. That kept the stack small, but it also pushed auth and data rules into a hosted dependency we no longer want at the center of the product.",
				"The new product draws a harder line. The frontend becomes a static React build, while the Go backend owns all admin authentication, content reads and writes, and asset workflows.",
				"This first milestone keeps the UI light but proves the contract: public content is read through the backend, and admin entry starts with a server-issued token.",
			},
		},
		{
			SummaryCard: domain.SummaryCard{
				ID:          "post-ops-001",
				Slug:        "oracle-free-tier-without-fantasy-ha",
				Title:       "Oracle Free Tier Without Fantasy HA",
				Summary:     "A realistic way to run a portfolio product on small ARM instances without pretending free infrastructure is multi-region resilient.",
				PublishedAt: "2026-03-14T00:00:00Z",
				Tags:        []string{"ops", "oracle-cloud"},
			},
			Body: []string{
				"Always Free is enough for a disciplined personal product, but not enough to claim serious high availability. The new architecture accepts that and optimizes for clean recovery paths, low complexity, and fast redeploys.",
				"That means static frontend hosting, a compact Go API, MongoDB-backed state, and clear ownership of the moving parts.",
			},
		},
	}

	projects := []domain.ProjectDetail{
		{
			SummaryCard: domain.SummaryCard{
				ID:          "project-portfolio-001",
				Slug:        "portfolio-platform-rebuild",
				Title:       "Portfolio Platform Rebuild",
				Summary:     "A product split that turns a coupled Next.js + Supabase app into a static frontend plus Go API.",
				PublishedAt: "2026-03-15T00:00:00Z",
				Tags:        []string{"go", "react", "mongo"},
			},
			Links: []domain.ProjectLink{
				{Label: "API contract", Href: "/api/v1/system/info"},
				{Label: "Health check", Href: "/healthz"},
			},
			Body: []string{
				"The project rebuild focuses on reducing coupling. Public routes can cache aggressively, while the backend becomes the only place that knows how content, authentication, and assets work.",
				"This is a better fit for small Oracle ARM instances because the frontend is almost free to serve and the API runtime stays lean.",
			},
		},
		{
			SummaryCard: domain.SummaryCard{
				ID:          "project-pdf-001",
				Slug:        "cv-pdf-pipeline",
				Title:       "CV PDF Pipeline",
				Summary:     "A service boundary for CV generation and cacheable artifacts instead of rendering everything in a single web process.",
				PublishedAt: "2026-03-13T00:00:00Z",
				Tags:        []string{"jobs", "pdf", "storage"},
			},
			Links: []domain.ProjectLink{
				{Label: "Gotenberg", Href: "https://gotenberg.dev"},
			},
			Body: []string{
				"PDF generation belongs in a job-oriented backend boundary, not in a frontend framework runtime that is also handling public page traffic.",
				"The new product keeps that separation explicit from the start.",
			},
		},
	}

	return &MemoryContentStore{
		home: domain.HomePayload{
			Hero: domain.HomeHero{
				Badge:        "Static React + Go API",
				Title:        "A quieter product stack with clearer boundaries.",
				Description:  "HGSEO Studio is being rebuilt as a static React frontend with a server-owned Go backend for auth, content, assets, and operational workflows.",
				PrimaryCTA:   domain.CTA{Label: "Read posts", Href: "/posts"},
				SecondaryCTA: domain.CTA{Label: "View projects", Href: "/projects"},
			},
			Highlights: []domain.Highlight{
				{Title: "Frontend runtime", Value: "Static", Description: "Public pages deploy as cacheable assets instead of a coupled app server."},
				{Title: "Backend ownership", Value: "Go / Echo", Description: "Auth, content, and asset flows move into a compact API."},
				{Title: "Data layer", Value: "MongoDB", Description: "Authoring state lives in Mongo without Supabase auth coupling or browser-owned policies."},
			},
			LatestPosts:      []domain.SummaryCard{posts[0].SummaryCard, posts[1].SummaryCard},
			FeaturedProjects: []domain.SummaryCard{projects[0].SummaryCard, projects[1].SummaryCard},
		},
		posts:    posts,
		projects: projects,
	}
}

func (m *MemoryContentStore) GetHome() domain.HomePayload {
	return m.home
}

func (m *MemoryContentStore) ListPosts() []domain.SummaryCard {
	items := make([]domain.SummaryCard, 0, len(m.posts))
	for _, post := range m.posts {
		items = append(items, post.SummaryCard)
	}
	return items
}

func (m *MemoryContentStore) GetPost(slug string) (domain.PostDetail, error) {
	for _, post := range m.posts {
		if post.Slug == slug {
			return post, nil
		}
	}

	return domain.PostDetail{}, errNotFound
}

func (m *MemoryContentStore) ListProjects() []domain.SummaryCard {
	items := make([]domain.SummaryCard, 0, len(m.projects))
	for _, project := range m.projects {
		items = append(items, project.SummaryCard)
	}
	return items
}

func (m *MemoryContentStore) GetProject(slug string) (domain.ProjectDetail, error) {
	for _, project := range m.projects {
		if project.Slug == slug {
			return project, nil
		}
	}

	return domain.ProjectDetail{}, errNotFound
}
