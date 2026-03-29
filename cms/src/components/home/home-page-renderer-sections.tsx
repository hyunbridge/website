import Image from "@shared/components/ui/app-image"
import { HomeEmptyState } from "@shared/components/home/home-empty-state"
import { FolderKanban, Newspaper } from "lucide-react"
import Link from "@/components/ui/app-link"

import type { Post } from "@/lib/blog-service"
import type { Project } from "@/lib/project-service"
import {
  HomeHoverLift,
  HomeScrollCue,
} from "@shared/components/home/home-motion"
import { renderMarkdown } from "@shared/lib/markdown"
import { sanitizeHomeHref } from "@shared/lib/home-page-utils"
import type {
  HomeCardSection,
  HomeCtaSection,
  HomeHeroCard,
  HomeHeroSection,
  HomePageSection,
  HomePlainSection,
  HomePostFeedSection,
  HomeProjectFeedSection,
  HomeRichContent,
  HomeTimelineSection,
  HomeTheme,
} from "@/lib/home-page-service"

type HomeSectionViewProps = {
  section: HomePageSection
  nextSectionId?: string
  projects: Project[]
  posts: Post[]
}

const SECTION_PADDING = "px-5 py-6 md:px-8 md:py-8"
const SECTION_BODY_TEXT = "mt-4 max-w-3xl text-sm leading-7 text-muted-foreground md:text-base"
function formatDate(dateString: string | null | undefined) {
  if (!dateString) return ""
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateString))
}

export function getHomeSectionThemeClasses(theme: HomeTheme) {
  if (theme === "accent") {
    return "border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(245,249,255,0.94))] dark:border-slate-700/70 dark:bg-[linear-gradient(180deg,rgba(37,32,24,0.96),rgba(15,23,42,0.92))]"
  }
  return "border-border/60 bg-white/92 dark:bg-card/82 dark:border-border/60"
}

function HomeRichContentView({
  value,
  className = "",
}: {
  value: HomeRichContent
  className?: string
}) {
  const rendered = renderMarkdown(value)
  if (!rendered) {
    return null
  }

  return (
    <div
      className={`markdown-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  )
}

function HeroCardView({ card }: { card: HomeHeroCard }) {
  return (
    <HomeHoverLift className="w-full max-w-[22rem]">
      <div className="rounded-[1.8rem] border border-border/50 bg-background/72 p-5 shadow-[0_18px_56px_rgba(15,23,42,0.08)] backdrop-blur">
        <h3 className="text-lg font-semibold tracking-tight text-foreground">{card.title}</h3>
        <HomeRichContentView value={card.content} className="mt-4 text-sm text-muted-foreground" />
      </div>
    </HomeHoverLift>
  )
}

function HeroSectionView({
  section,
  nextSectionId,
}: {
  section: HomeHeroSection
  nextSectionId?: string
}) {
  const isCentered = section.layout === "centered"
  const eyebrow = section.eyebrow.trim()
  const primaryHref = sanitizeHomeHref(section.primaryCta.href, "/")
  const secondaryHref = sanitizeHomeHref(section.secondaryCta.href, "/")

  return (
    <div
      className={`grid gap-6 ${SECTION_PADDING} ${isCentered ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start xl:gap-10"}`}
    >
      <div className={isCentered ? "mx-auto max-w-4xl text-center" : "max-w-3xl"}>
        {eyebrow ? (
          <p className="text-xs font-medium uppercase tracking-[0.32em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-4 text-3xl font-semibold leading-[1.06] tracking-tight text-foreground sm:text-4xl md:text-5xl">
          {section.title}
        </h1>
        <HomeRichContentView
          value={section.content}
          className="mt-5 text-base text-muted-foreground"
        />
        <div className={`mt-6 flex flex-wrap gap-3 ${isCentered ? "justify-center" : ""}`}>
          <Link
            href={primaryHref}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform duration-300 hover:-translate-y-0.5"
          >
            {section.primaryCta.label}
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/76 px-5 py-3 text-sm font-medium text-foreground transition-transform duration-300 hover:-translate-y-0.5"
          >
            {section.secondaryCta.label}
          </Link>
        </div>
      </div>

      <div
        className={`grid gap-4 ${isCentered ? "justify-items-center sm:grid-cols-2 xl:grid-cols-3" : "justify-items-start sm:grid-cols-2 xl:grid-cols-1 xl:justify-self-end"}`}
      >
        {section.cards.map((card) => (
          <HeroCardView key={card.id} card={card} />
        ))}
      </div>

      {nextSectionId ? (
        <div className="col-span-full mt-2 flex justify-center">
          <HomeScrollCue href={`#${nextSectionId}`} />
        </div>
      ) : null}
    </div>
  )
}

function CollectionSectionView({ section }: { section: HomeTimelineSection | HomeCardSection }) {
  return (
    <div className={SECTION_PADDING}>
      <h2 className="text-2xl font-semibold tracking-tight md:text-[2rem]">{section.title}</h2>
      <HomeRichContentView value={section.intro} className={SECTION_BODY_TEXT} />

      {section.type === "cards" ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {section.items.map((item) => (
            <HomeHoverLift key={item.id}>
              <div className="rounded-[1.9rem] border border-border/50 bg-background/70 p-5 shadow-[0_18px_56px_rgba(15,23,42,0.06)] backdrop-blur">
                <h3 className="text-lg font-semibold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <HomeRichContentView
                  value={item.content}
                  className="mt-4 text-sm text-muted-foreground"
                />
              </div>
            </HomeHoverLift>
          ))}
        </div>
      ) : (
        <div className="mt-8 space-y-5">
          {section.items.map((item) => (
            <div
              key={item.id}
              className="grid gap-4 md:grid-cols-[1.4rem_minmax(0,46rem)] md:justify-start"
            >
              <div className="relative flex justify-center">
                <span className="absolute inset-y-0 w-px bg-border/70" />
                <span className="relative mt-2 h-3 w-3 rounded-full border-2 border-background bg-foreground" />
              </div>
              <HomeHoverLift>
                <div className="rounded-[1.9rem] border border-border/50 bg-background/72 p-5 shadow-[0_16px_48px_rgba(15,23,42,0.06)] backdrop-blur">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    {item.title}
                  </h3>
                  <HomeRichContentView
                    value={item.content}
                    className="mt-4 text-sm text-muted-foreground"
                  />
                </div>
              </HomeHoverLift>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project, large = false }: { project: Project; large?: boolean }) {
  return (
    <Link
      href={`/projects/${project.slug || project.id}`}
      className={`group block overflow-hidden rounded-[1.9rem] border border-border/50 bg-background/75 shadow-[0_18px_56px_rgba(15,23,42,0.08)] transition-transform duration-300 hover:-translate-y-1 ${large ? "h-full" : ""}`}
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
      className="group block overflow-hidden rounded-[1.9rem] border border-border/50 bg-background/75 p-5 shadow-[0_18px_56px_rgba(15,23,42,0.06)] transition-transform duration-300 hover:-translate-y-1"
    >
      <div className="text-xs text-muted-foreground">
        {formatDate(post.published_at || post.created_at)}
      </div>
      <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground">{post.title}</h3>
      {post.summary ? (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{post.summary}</p>
      ) : null}
    </Link>
  )
}

function ProjectFeedSectionView({
  section,
  projects,
}: {
  section: HomeProjectFeedSection
  projects: Project[]
}) {
  const items = projects.slice(0, Math.max(1, Math.min(section.limit, 6)))
  const [featuredProject, ...remainingProjects] = items

  return (
    <div className={SECTION_PADDING}>
      <h2 className="text-2xl font-semibold tracking-tight md:text-[2rem]">{section.title}</h2>
      {section.description ? (
        <p className={SECTION_BODY_TEXT.replace("mt-4", "mt-3").replace("max-w-3xl", "max-w-2xl")}>
          {section.description}
        </p>
      ) : null}

      {items.length === 0 ? (
        <HomeEmptyState
          title="프로젝트가 없습니다"
          description="현재 공개된 프로젝트가 없습니다."
          icon={<FolderKanban className="h-5 w-5" />}
        />
      ) : section.layout === "spotlight" ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          {featuredProject ? <ProjectCard project={featuredProject} large /> : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {remainingProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

function PostFeedSectionView({ section, posts }: { section: HomePostFeedSection; posts: Post[] }) {
  const items = posts.slice(0, Math.max(1, Math.min(section.limit, 6)))

  return (
    <div className={SECTION_PADDING}>
      <h2 className="text-2xl font-semibold tracking-tight md:text-[2rem]">{section.title}</h2>
      {section.description ? (
        <p className={SECTION_BODY_TEXT.replace("mt-4", "mt-3").replace("max-w-3xl", "max-w-2xl")}>
          {section.description}
        </p>
      ) : null}

      {items.length === 0 ? (
        <HomeEmptyState
          title="게시글이 없습니다"
          description="새 글이 올라오면 여기에서 확인할 수 있습니다."
          icon={<Newspaper className="h-5 w-5" />}
        />
      ) : section.layout === "cards" ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}

function CtaSectionView({ section }: { section: HomeCtaSection }) {
  const isCentered = section.layout === "centered"
  const primaryHref = sanitizeHomeHref(section.primaryCta.href, "/")

  return (
    <div className={SECTION_PADDING}>
      <div
        className={`gap-6 ${isCentered ? "mx-auto max-w-3xl text-center" : "mx-auto max-w-5xl grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"}`}
      >
        <div className={isCentered ? "" : "max-w-3xl"}>
          <h2 className="text-2xl font-semibold tracking-tight md:text-[2rem]">{section.title}</h2>
          <HomeRichContentView
            value={section.content}
            className="mt-4 text-base leading-7 text-muted-foreground"
          />
        </div>
        <div className={isCentered ? "mx-auto mt-6" : "mt-2 lg:mt-0 lg:justify-self-end"}>
          <Link
            href={primaryHref}
            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-transform duration-300 hover:-translate-y-0.5"
          >
            {section.primaryCta.label}
          </Link>
        </div>
      </div>
    </div>
  )
}

function PlainSectionView({ section }: { section: HomePlainSection }) {
  return (
    <div className={SECTION_PADDING}>
      <div className="max-w-3xl">
        <HomeRichContentView
          value={section.content}
          className="text-base leading-7 text-foreground [&_blockquote]:text-muted-foreground [&_li]:text-muted-foreground [&_p]:text-muted-foreground"
        />
      </div>
    </div>
  )
}

export function HomeSectionView({
  section,
  nextSectionId,
  projects,
  posts,
}: HomeSectionViewProps) {
  if (section.type === "hero") {
    return <HeroSectionView section={section} nextSectionId={nextSectionId} />
  }
  if (section.type === "timeline" || section.type === "cards") {
    return <CollectionSectionView section={section} />
  }
  if (section.type === "projectFeed") {
    return <ProjectFeedSectionView section={section} projects={projects} />
  }
  if (section.type === "postFeed") {
    return <PostFeedSectionView section={section} posts={posts} />
  }
  if (section.type === "cta") {
    return <CtaSectionView section={section} />
  }
  return <PlainSectionView section={section} />
}
