"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { format } from "date-fns"
import type { Project } from "@/lib/project-service"
import { BlockNoteEditor } from "./blocknote-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { StatePanel } from "@/components/ui/state-panel"
import { GlobeLock, MessageSquare } from "lucide-react"
import { motion } from "framer-motion"
import { MORPH_LAYOUT_TRANSITION } from "@/lib/motion"
import { useNavigationIntent } from "@/components/navigation-intent-provider"

type PublishedSnapshot = {
  title: string
  content: string
  summary?: string | null
} | null

function parseBlockNoteJson(content?: string | null) {
  if (!content) return undefined
  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export function PublicProjectView({
  project,
  publishedSnapshot,
}: {
  project: Project
  publishedSnapshot: PublishedSnapshot
}) {
  const pathname = usePathname()
  const { getRecentIntent } = useNavigationIntent()
  const [deferSecondaryReveal, setDeferSecondaryReveal] = useState(false)
  const displayTitle = publishedSnapshot?.title || project.title
  const displayContent = publishedSnapshot?.content
  const initialBlocks = parseBlockNoteJson(displayContent)
  const authorName = project.owner?.full_name || "Anonymous"
  const formattedDate = format(new Date(project.published_at || project.created_at), "MMMM d, yyyy")

  const secondaryRevealMotion = deferSecondaryReveal
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.16, delay: 0.1 },
      }
    : {
        initial: false as const,
        animate: { opacity: 1 },
        transition: { duration: 0.12 },
      }

  useEffect(() => {
    const intent = getRecentIntent()
    const isMorphArrival = !!intent && intent.kind === "projects-detail" && intent.href === pathname
    if (!isMorphArrival) {
      const timer = window.setTimeout(() => setDeferSecondaryReveal(false), 0)
      return () => window.clearTimeout(timer)
    }

    const showTimer = window.setTimeout(() => setDeferSecondaryReveal(true), 0)
    const hideTimer = window.setTimeout(() => setDeferSecondaryReveal(false), 220)
    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [pathname, getRecentIntent])

  if (!displayContent) {
    return (
      <div className="container max-w-4xl mx-auto py-8 md:py-12">
        <StatePanel
          className="max-w-lg"
          size="compact"
          icon={<GlobeLock className="h-5 w-5" />}
          title="Not yet published"
          description="This project is still being worked on."
          actions={
            <Button variant="outline" asChild>
              <Link href="/projects">Back to all projects</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <motion.div transition={MORPH_LAYOUT_TRANSITION} className="container max-w-4xl mx-auto py-8 md:py-12">
      <div className="mb-6">
        <Link href="/projects" className="text-sm text-muted-foreground hover:underline">
          ← Back to all projects
        </Link>
      </div>

      {project.cover_image && (
        <motion.div
          layoutId={`project-image-${project.id}`}
          transition={MORPH_LAYOUT_TRANSITION}
          className="mb-8 rounded-2xl overflow-hidden"
        >
          <Image
            src={project.cover_image}
            alt={displayTitle}
            width={1600}
            height={900}
            className="w-full h-64 md:h-80 object-cover"
            unoptimized
          />
        </motion.div>
      )}

      <motion.div layoutId={`project-title-${project.id}`} transition={MORPH_LAYOUT_TRANSITION}>
        <h1 className="text-3xl md:text-5xl font-bold mb-4">{displayTitle}</h1>
      </motion.div>

      <motion.div className="flex flex-wrap items-center gap-4 mb-8" {...secondaryRevealMotion}>
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

        {(project.tags?.length || 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="hover:bg-secondary/80 transition-colors">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div className="blocknote-seamless" data-readonly="true" {...secondaryRevealMotion}>
        <BlockNoteEditor initialContent={initialBlocks} editable={false} />
      </motion.div>

      {(project.links?.length || 0) > 0 && (
        <motion.div className="mt-8 pt-6 border-t" {...secondaryRevealMotion}>
          <h3 className="font-medium mb-3">Links</h3>
          <div className="flex flex-wrap gap-2">
            {project.links.map((link, index) => (
              <Button key={link.id || `${link.url}-${index}`} variant="outline" size="sm" asChild>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  {link.label || link.url}
                </a>
              </Button>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div className="mt-12" {...secondaryRevealMotion}>
        <Card className="bg-card/50 border border-border/50">
          <CardHeader>
            <CardTitle className="text-xl">Have a question about {displayTitle}?</CardTitle>
            <CardDescription>
              Reach out if you want more details about the project.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button asChild>
              <Link href="/contact" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Get in touch
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </motion.div>
  )
}
