"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle } from "lucide-react"
import { NotionImage } from "@/components/notion-image"
import Link from "next/link"

export function ProjectList({ projects }: { projects: any[] }) {
  if (!projects || projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-medium mb-2">No projects found</h3>
        <p className="text-muted-foreground max-w-md">
          No published projects were found in your Notion database. Make sure you have projects with the "Published"
          status.
        </p>
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
          transition={{ delay: index * 0.1, duration: 0.5 }}
          whileHover={{ y: -5, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
        >
          <Link href={`/projects/${project.slug || project.id}`} className="block h-full">
            <Card className="h-full hover:shadow-md transition-shadow overflow-hidden flex flex-col border border-border">
              <div className="relative h-48 w-full overflow-hidden">
                <NotionImage
                  src={project.imageUrl || "/placeholder.svg?height=400&width=600"}
                  alt={project.title}
                  fill
                  className="w-full h-full"
                />
              </div>
              <CardHeader>
                <CardTitle>{project.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">{project.summary}</p>
              </CardContent>
              <CardFooter>
                <div className="flex flex-wrap gap-2">
                  {project.tags &&
                    project.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
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
