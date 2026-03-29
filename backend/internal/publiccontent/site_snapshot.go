package publiccontent

import (
	"sort"
	"strings"

	"github.com/hyunbridge/website/backend/internal/store"
)

type SiteSnapshot struct {
	CommitSHA string
	Home      *store.HomeDocumentDTO
	Posts     []store.PostDTO
	Projects  []store.ProjectDTO
	Tags      []store.TagDTO
}

func buildSiteSnapshot(commitSHA string, posts []store.PostDTO, projects []store.ProjectDTO, home *store.HomeDocumentDTO) *SiteSnapshot {
	return &SiteSnapshot{
		CommitSHA: strings.TrimSpace(commitSHA),
		Home:      cloneHomeDocument(home),
		Posts:     clonePosts(posts),
		Projects:  cloneProjects(projects),
		Tags:      collectTags(posts, projects),
	}
}

func cloneSiteSnapshot(snapshot *SiteSnapshot) *SiteSnapshot {
	if snapshot == nil {
		return nil
	}
	return &SiteSnapshot{
		CommitSHA: snapshot.CommitSHA,
		Home:      cloneHomeDocument(snapshot.Home),
		Posts:     clonePosts(snapshot.Posts),
		Projects:  cloneProjects(snapshot.Projects),
		Tags:      cloneTags(snapshot.Tags),
	}
}

func collectTags(posts []store.PostDTO, projects []store.ProjectDTO) []store.TagDTO {
	seen := map[string]store.TagDTO{}
	for _, post := range posts {
		for _, tag := range post.Tags {
			if strings.TrimSpace(tag.ID) != "" {
				seen[tag.ID] = tag
			}
		}
	}
	for _, project := range projects {
		for _, tag := range project.Tags {
			if strings.TrimSpace(tag.ID) != "" {
				seen[tag.ID] = tag
			}
		}
	}

	tags := make([]store.TagDTO, 0, len(seen))
	for _, tag := range seen {
		tags = append(tags, tag)
	}
	sort.Slice(tags, func(i, j int) bool {
		if tags[i].Name != tags[j].Name {
			return tags[i].Name < tags[j].Name
		}
		return tags[i].Slug < tags[j].Slug
	})
	return tags
}

func clonePosts(posts []store.PostDTO) []store.PostDTO {
	if len(posts) == 0 {
		return []store.PostDTO{}
	}
	items := make([]store.PostDTO, 0, len(posts))
	for _, post := range posts {
		copyPost := post
		copyPost.CoverImage = cloneOptionalString(post.CoverImage)
		copyPost.PublishedAt = cloneOptionalString(post.PublishedAt)
		copyPost.PublishedVersionID = cloneOptionalString(post.PublishedVersionID)
		copyPost.CurrentVersionID = cloneOptionalString(post.CurrentVersionID)
		copyPost.Author = store.AuthorDTO{
			FullName:  post.Author.FullName,
			AvatarURL: cloneOptionalString(post.Author.AvatarURL),
		}
		if len(post.Tags) > 0 {
			copyPost.Tags = append([]store.TagDTO{}, post.Tags...)
		} else {
			copyPost.Tags = []store.TagDTO{}
		}
		items = append(items, copyPost)
	}
	return items
}

func cloneTags(tags []store.TagDTO) []store.TagDTO {
	if len(tags) == 0 {
		return []store.TagDTO{}
	}
	return append([]store.TagDTO{}, tags...)
}

func cloneProjects(projects []store.ProjectDTO) []store.ProjectDTO {
	if len(projects) == 0 {
		return []store.ProjectDTO{}
	}
	items := make([]store.ProjectDTO, 0, len(projects))
	for _, project := range projects {
		copyProject := project
		copyProject.CoverImage = cloneOptionalString(project.CoverImage)
		copyProject.PublishedAt = cloneOptionalString(project.PublishedAt)
		copyProject.PublishedVersionID = cloneOptionalString(project.PublishedVersionID)
		copyProject.CurrentVersionID = cloneOptionalString(project.CurrentVersionID)
		copyProject.Owner = store.AuthorDTO{
			FullName:  project.Owner.FullName,
			AvatarURL: cloneOptionalString(project.Owner.AvatarURL),
		}
		if len(project.Tags) > 0 {
			copyProject.Tags = append([]store.TagDTO{}, project.Tags...)
		} else {
			copyProject.Tags = []store.TagDTO{}
		}
		if len(project.Links) > 0 {
			copyProject.Links = append([]store.ProjectLinkDTO{}, project.Links...)
		} else {
			copyProject.Links = []store.ProjectLinkDTO{}
		}
		items = append(items, copyProject)
	}
	return items
}

func cloneHomeDocument(document *store.HomeDocumentDTO) *store.HomeDocumentDTO {
	if document == nil {
		return nil
	}
	copyDocument := *document
	copyDocument.UpdatedAt = cloneOptionalString(document.UpdatedAt)
	copyDocument.PublishedAt = cloneOptionalString(document.PublishedAt)
	copyDocument.CurrentVersionID = cloneOptionalString(document.CurrentVersionID)
	copyDocument.PublishedVersionID = cloneOptionalString(document.PublishedVersionID)
	if len(document.Notices) > 0 {
		copyDocument.Notices = make([]map[string]string, 0, len(document.Notices))
		for _, notice := range document.Notices {
			if notice == nil {
				copyDocument.Notices = append(copyDocument.Notices, nil)
				continue
			}
			copyNotice := make(map[string]string, len(notice))
			for key, value := range notice {
				copyNotice[key] = value
			}
			copyDocument.Notices = append(copyDocument.Notices, copyNotice)
		}
	} else {
		copyDocument.Notices = []map[string]string{}
	}
	return &copyDocument
}
