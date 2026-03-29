"use client"

import { FolderKanban, Newspaper } from "lucide-react"
import Image from "@shared/components/ui/app-image"
import { HomeEmptyState } from "@shared/components/home/home-empty-state"
import Link from "@/components/ui/app-link"

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
  EditableInput,
  EditableLinkButton,
  EditableTextarea,
  formatHomeDisplayDate,
  RichContentField,
} from "@/components/home/home-site-builder-fields"

type HomeSectionChange = (
  sectionId: string,
  updater: (section: HomePageSection) => HomePageSection,
) => void

const SECTION_PADDING = "px-5 py-6 md:px-8 md:py-8"
const SECTION_BODY_TEXT = "mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base"
export function ProjectFeedSectionView({
  section,
  editable,
  onChange,
  projects,
}: {
  section: HomeProjectFeedSection
  editable: boolean
  onChange: HomeSectionChange
  projects: Project[]
}) {
  const update = (updater: (current: HomeProjectFeedSection) => HomeProjectFeedSection) =>
    onChange(section.id, (current) => updater(current as HomeProjectFeedSection))
  const items = projects.slice(0, Math.max(1, Math.min(section.limit, 6)))

  return (
    <div className={SECTION_PADDING}>
      <EditableInput
        value={section.title}
        onChange={(value) => update((current) => ({ ...current, title: value }))}
        editable={editable}
        className="text-2xl font-semibold tracking-tight md:text-[2rem]"
      />
      <EditableTextarea
        value={section.description}
        onChange={(value) => update((current) => ({ ...current, description: value }))}
        editable={editable}
        className={SECTION_BODY_TEXT}
        rows={2}
      />

      {items.length === 0 ? (
        <HomeEmptyState
          title="프로젝트가 없습니다"
          description="현재 공개된 프로젝트가 없습니다."
          icon={<FolderKanban className="h-5 w-5" />}
        />
      ) : section.layout === "spotlight" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <ProjectCard project={items[0] as Project} large />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {(items as Project[]).slice(1).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {(items as Project[]).map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

export function PostFeedSectionView({
  section,
  editable,
  onChange,
  posts,
}: {
  section: HomePostFeedSection
  editable: boolean
  onChange: HomeSectionChange
  posts: Post[]
}) {
  const update = (updater: (current: HomePostFeedSection) => HomePostFeedSection) =>
    onChange(section.id, (current) => updater(current as HomePostFeedSection))
  const items = posts.slice(0, Math.max(1, Math.min(section.limit, 6)))

  return (
    <div className={SECTION_PADDING}>
      <EditableInput
        value={section.title}
        onChange={(value) => update((current) => ({ ...current, title: value }))}
        editable={editable}
        className="text-2xl font-semibold tracking-tight md:text-[2rem]"
      />
      <EditableTextarea
        value={section.description}
        onChange={(value) => update((current) => ({ ...current, description: value }))}
        editable={editable}
        className={SECTION_BODY_TEXT}
        rows={2}
      />

      {items.length === 0 ? (
        <HomeEmptyState
          title="게시글이 없습니다"
          description="새 글이 올라오면 여기에서 확인할 수 있습니다."
          icon={<Newspaper className="h-5 w-5" />}
        />
      ) : section.layout === "cards" ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(items as Post[]).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {(items as Post[]).map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}

export function CtaSectionView({
  section,
  editable,
  onChange,
}: {
  section: HomeCtaSection
  editable: boolean
  onChange: HomeSectionChange
}) {
  const isCentered = section.layout === "centered"
  const update = (updater: (current: HomeCtaSection) => HomeCtaSection) =>
    onChange(section.id, (current) => updater(current as HomeCtaSection))

  return (
    <div className={SECTION_PADDING}>
      <div
        className={`gap-6 ${isCentered ? "mx-auto max-w-3xl text-center" : "mx-auto max-w-5xl grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"}`}
      >
        <div className={isCentered ? "" : "max-w-3xl"}>
          <EditableInput
            value={section.title}
            onChange={(value) => update((current) => ({ ...current, title: value }))}
            editable={editable}
            className="text-2xl font-semibold tracking-tight md:text-[2rem]"
          />
          <RichContentField
            value={section.content}
            onChange={(content) => update((current) => ({ ...current, content }))}
            editable={editable}
            className="mt-4"
            editorClassName="min-h-[10rem]"
          />
        </div>
        <div className={isCentered ? "mx-auto mt-6" : "mt-2 lg:mt-0 lg:justify-self-end"}>
          <EditableLinkButton
            editable={editable}
            label={section.primaryCta.label}
            href={section.primaryCta.href}
            variant="primary"
            onChange={(next) => update((current) => ({ ...current, primaryCta: next }))}
          />
        </div>
      </div>
    </div>
  )
}

export function PlainSectionView({
  section,
  editable,
  onChange,
}: {
  section: HomePlainSection
  editable: boolean
  onChange: HomeSectionChange
}) {
  const update = (updater: (current: HomePlainSection) => HomePlainSection) =>
    onChange(section.id, (current) => updater(current as HomePlainSection))

  return (
    <div className={SECTION_PADDING}>
      <div className="max-w-3xl">
        <RichContentField
          value={section.content}
          onChange={(content) => update((current) => ({ ...current, content }))}
          editable={editable}
          editorClassName="min-h-[10rem]"
        />
      </div>
    </div>
  )
}

function ProjectCard({ project, large = false }: { project: Project; large?: boolean }) {
  return (
    <Link
      href={`/projects/${project.slug || project.id}`}
      className={`group block overflow-hidden rounded-[1.9rem] border border-border/50 bg-background/75 transition-transform hover:-translate-y-1 ${large ? "h-full" : ""}`}
    >
      {project.cover_image ? (
        <div className={`relative w-full overflow-hidden bg-muted ${large ? "h-72" : "h-52"}`}>
          <Image
            src={project.cover_image}
            alt={project.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        </div>
      ) : null}
      <div className="p-5">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{project.title}</h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
          {project.summary}
        </p>
      </div>
    </Link>
  )
}

function PostCard({ post }: { post: Post }) {
  return (
    <Link
      href={`/blog/${post.slug || post.id}`}
      className="group block overflow-hidden rounded-[1.9rem] border border-border/50 bg-background/75 p-5 transition-transform hover:-translate-y-1"
    >
      <div className="text-xs text-muted-foreground">
        {formatHomeDisplayDate(post.published_at || post.created_at)}
      </div>
      <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground">{post.title}</h3>
      {post.summary ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{post.summary}</p>
      ) : null}
    </Link>
  )
}
