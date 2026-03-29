"use client"

import Image from "@shared/components/ui/app-image"

import type { Post } from "@/lib/blog-service"
import type { Project } from "@/lib/project-service"
import type {
  HomeCtaSection,
  HomePageSection,
  HomePlainSection,
  HomePostFeedSection,
  HomeProjectFeedSection,
} from "@/lib/home-page-service"
import {
  formatHomeDisplayDate,
} from "@/components/home/home-site-builder-fields"
import {
  CardsSectionView,
  HeroSectionView,
  TimelineSectionView,
} from "@/components/home/home-site-builder-collection-sections"
import {
  CtaSectionView,
  PlainSectionView,
  PostFeedSectionView,
  ProjectFeedSectionView,
} from "@/components/home/home-site-builder-feed-sections"

type HomeSectionContentProps = {
  section: HomePageSection
  editable: boolean
  onChange: (sectionId: string, updater: (section: HomePageSection) => HomePageSection) => void
  projects: Project[]
  posts: Post[]
}

export function HomeSectionContent({
  section,
  editable,
  onChange,
  projects,
  posts,
}: HomeSectionContentProps) {
  switch (section.type) {
    case "hero":
      return <HeroSectionView section={section} editable={editable} onChange={onChange} />
    case "timeline":
      return <TimelineSectionView section={section} editable={editable} onChange={onChange} />
    case "cards":
      return <CardsSectionView section={section} editable={editable} onChange={onChange} />
    case "projectFeed":
      return (
        <ProjectFeedSectionView
          section={section}
          editable={editable}
          onChange={onChange}
          projects={projects}
        />
      )
    case "postFeed":
      return (
        <PostFeedSectionView
          section={section}
          editable={editable}
          onChange={onChange}
          posts={posts}
        />
      )
    case "cta":
      return <CtaSectionView section={section} editable={editable} onChange={onChange} />
    case "plain":
      return <PlainSectionView section={section} editable={editable} onChange={onChange} />
    default:
      return null
  }
}
