"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type { Project } from "@/lib/project-service"
import { MORPH_LAYOUT_TRANSITION } from "@/lib/motion"

export function ProjectList({ projects }: { projects: Project[] }) {
  if (!projects || projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium mb-2">No projects found</h3>
        <p className="text-muted-foreground max-w-md">
          No published projects are available at the moment.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project, index) => (
        <motion.div
          key={project.id}
          layoutId={`project-card-${project.id}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1, duration: 0.5, ...MORPH_LAYOUT_TRANSITION }}
          whileHover={{ y: -5, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
        >
          <Link href={`/projects/${project.slug || project.id}`} className="block h-full">
            <Card className="h-full hover:shadow-md transition-shadow overflow-hidden flex flex-col border border-border">
              {project.cover_image && (
                <motion.div
                  layoutId={`project-image-${project.id}`}
                  transition={MORPH_LAYOUT_TRANSITION}
                  className="relative h-48 w-full overflow-hidden"
                >
                  <Image
                    src={project.cover_image}
                    alt={project.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </motion.div>
              )}
              <CardHeader>
                <motion.div layoutId={`project-title-${project.id}`} transition={MORPH_LAYOUT_TRANSITION}>
                  <CardTitle>{project.title}</CardTitle>
                </motion.div>
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
          </Link>
        </motion.div>
      ))}
    </div>
  )
}
