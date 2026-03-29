package domain

type SummaryCard struct {
	ID          string   `json:"id"`
	Slug        string   `json:"slug"`
	Title       string   `json:"title"`
	Summary     string   `json:"summary"`
	PublishedAt string   `json:"publishedAt"`
	Tags        []string `json:"tags"`
}

type HomePayload struct {
	Hero             HomeHero      `json:"hero"`
	Highlights       []Highlight   `json:"highlights"`
	LatestPosts      []SummaryCard `json:"latestPosts"`
	FeaturedProjects []SummaryCard `json:"featuredProjects"`
}

type HomeHero struct {
	Badge        string `json:"badge"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	PrimaryCTA   CTA    `json:"primaryCta"`
	SecondaryCTA CTA    `json:"secondaryCta"`
}

type CTA struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

type Highlight struct {
	Title       string `json:"title"`
	Value       string `json:"value"`
	Description string `json:"description"`
}

type PostDetail struct {
	SummaryCard
	Body []string `json:"body"`
}

type ProjectLink struct {
	Label string `json:"label"`
	Href  string `json:"href"`
}

type ProjectDetail struct {
	SummaryCard
	Links []ProjectLink `json:"links"`
	Body  []string      `json:"body"`
}
