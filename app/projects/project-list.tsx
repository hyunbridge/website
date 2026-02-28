"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FolderSearch } from "lucide-react"
import type { Project } from "@/lib/project-service"
import { MORPH_LAYOUT_TRANSITION } from "@/lib/motion"
import { MorphLink } from "@/components/morph-link"
import { StatePanel } from "@/components/ui/state-panel"
import { SharedTransitionImage, SharedTransitionTitle } from "@/components/shared-content-transition"

export function ProjectList({ projects }: { projects: Project[] }) {
  if (!projects || projects.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <StatePanel
          className="max-w-lg"
          size="compact"
          icon={<FolderSearch className="h-5 w-5" />}
          title="No projects found"
          description="No published projects are available at the moment."
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project, index) => (
        <motion.div
          key={project.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.5, ...MORPH_LAYOUT_TRANSITION }}
        >
          <MorphLink
            href={`/projects/${project.slug || project.id}`}
            morphIntent="projects-detail"
            morphSource={{
              itemId: project.id,
              title: project.title,
              coverImage: project.cover_image,
            }}
            className="block h-full"
          >
            <Card className="h-full hover:shadow-md transition-shadow overflow-hidden flex flex-col border border-border">
              {project.cover_image && (
                <SharedTransitionImage
                  kind="project"
                  itemId={project.id}
                  src={project.cover_image}
                  alt={project.title}
                  containerClassName="h-48 w-full"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              )}
              <CardHeader>
                <SharedTransitionTitle kind="project" itemId={project.id}>
                  <CardTitle>{project.title}</CardTitle>
                </SharedTransitionTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">{project.summary}</p>
              </CardContent>
              <CardFooter>
                <div className="flex flex-wrap gap-2">
                  {project.tags &&
                    project.tags.map((tag) => (
                      <Badge key={tag.id} variant="secondary">
                        {tag.name}
                      </Badge>
                    ))}
                </div>
              </CardFooter>
            </Card>
          </MorphLink>
        </motion.div>
      ))}
    </div>
  )
}
