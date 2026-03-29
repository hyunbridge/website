"use client"

import Image from "@shared/components/ui/app-image"
import { motion, type HTMLMotionProps } from "framer-motion"
import { GlobeLock, MessageSquare } from "lucide-react"

import { BackLink } from "@/components/ui/back-link"
import Link from "@/components/ui/app-link"
import { MarkdownEditor } from "@/components/editor/markdown-editor"
import { MarkdownPreview } from "@/components/editor/markdown-preview"
import { Badge } from "@shared/components/ui/badge"
import { Button } from "@shared/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@shared/components/ui/card"
import { Skeleton } from "@shared/components/ui/skeleton"
import { StatePanel } from "@shared/components/ui/state-panel"
import { MORPH_LAYOUT_TRANSITION } from "@shared/lib/motion"

import type { Project, ProjectLink, Tag } from "@/lib/project-service"

export function ProjectMeta({
  project,
  authorName,
  formattedDate,
  tags,
  className,
}: {
  project: Project
  authorName: string
  formattedDate: string
  tags: Tag[]
  className?: string
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        {project.owner?.avatar_url ? (
          <Image
            src={project.owner.avatar_url}
            alt={authorName}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full"
            unoptimized
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
            {authorName[0]?.toUpperCase()}
          </div>
        )}
        <span className="text-sm">{authorName}</span>
      </div>

      <span className="text-sm text-muted-foreground">{formattedDate}</span>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="hover:bg-secondary/80 transition-colors">
              {tag.name}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function ProjectLinksSection({
  links,
  motionProps,
}: {
  links: ProjectLink[]
  motionProps?: HTMLMotionProps<"div">
}) {
  if (!links.length) return null

  return (
    <motion.div className="mt-8 pt-6 border-t" {...motionProps}>
      <h3 className="font-medium mb-3">링크</h3>
      <div className="flex flex-wrap gap-2">
        {links.map((link, index) => (
          <Button key={link.id || `${link.url}-${index}`} variant="outline" size="sm" asChild>
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {link.label || link.url}
            </a>
          </Button>
        ))}
      </div>
    </motion.div>
  )
}

export function ProjectContactCard({
  title,
  motionProps,
}: {
  title: string
  motionProps?: HTMLMotionProps<"div">
}) {
  return (
    <motion.div className="mt-12" {...motionProps}>
      <Card className="bg-card/50 border border-border/50">
        <CardHeader>
          <CardTitle className="text-xl">{title}에 대해 궁금한 점이 있나요?</CardTitle>
          <CardDescription>
            프로젝트에 대해 더 자세히 알고 싶다면 편하게 연락해주세요.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href="/contact" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              연락하기
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

export function ProjectReadOnlySkeleton({
  project,
  displayTitle,
  authorName,
  formattedDate,
  projectTags,
  projectLinks,
}: {
  project: Project
  displayTitle: string
  authorName: string
  formattedDate: string
  projectTags: Tag[]
  projectLinks: ProjectLink[]
}) {
  return (
    <motion.div transition={MORPH_LAYOUT_TRANSITION} className="content-article container">
      <div className="content-article__backlink">
        <BackLink href="/projects">전체 프로젝트로 돌아가기</BackLink>
      </div>

      {project.cover_image ? (
        <motion.div
          layoutId={`project-image-${project.id}`}
          transition={MORPH_LAYOUT_TRANSITION}
          className="content-article__cover relative"
        >
          <Image
            src={project.cover_image}
            alt={displayTitle}
            width={1600}
            height={900}
            className="w-full h-64 md:h-80 object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-background/15" />
        </motion.div>
      ) : null}

      <motion.div layoutId={`project-title-${project.id}`} transition={MORPH_LAYOUT_TRANSITION}>
        <h1 className="content-article__title">{displayTitle}</h1>
      </motion.div>

      <ProjectMeta
        project={project}
        authorName={authorName}
        formattedDate={formattedDate}
        tags={projectTags}
        className="content-article__meta"
      />

      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>

      <ProjectLinksSection links={projectLinks} />
      <ProjectContactCard title={displayTitle} />
    </motion.div>
  )
}

export function ProjectNotPublishedState() {
  return (
    <div className="container max-w-4xl mx-auto py-8 md:py-12">
      <StatePanel
        className="max-w-lg"
        size="compact"
        icon={<GlobeLock className="h-5 w-5" />}
        title="아직 공개되지 않았습니다"
        description="이 프로젝트는 아직 작업 중입니다."
        actions={
          <Button variant="outline" asChild>
            <Link href="/projects">전체 프로젝트로 돌아가기</Link>
          </Button>
        }
      />
    </div>
  )
}

export function ProjectContentBody({
  isEditable,
  initialMarkdown,
  projectId,
  onImageUpload,
  onDraftChange,
  motionProps,
}: {
  isEditable: boolean
  initialMarkdown: string
  projectId: string
  onImageUpload: (file: File) => Promise<string>
  onDraftChange: (markdown: string) => void
  motionProps?: HTMLMotionProps<"div">
}) {
  return (
    <motion.div
      className={
        isEditable
          ? "content-article__body content-article__body--editable"
          : "content-article__body content-article__surface"
      }
      {...motionProps}
    >
      {isEditable ? (
        <MarkdownEditor
          content={initialMarkdown}
          className="markdown-content content-article__surface"
          onImageUpload={onImageUpload}
          onChange={(markdown) => {
            if (!projectId) return
            onDraftChange(markdown)
          }}
        />
      ) : (
        <MarkdownPreview className="content-article__surface" content={initialMarkdown} />
      )}
    </motion.div>
  )
}
