"use client"
import { motion } from "framer-motion"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { ErrorMessage } from "@/components/error-message"
import { AlertTriangle } from "lucide-react"
import { useState } from "react"
import { NotionImage } from "@/components/notion-image"

export function ProjectList({ projects, error }) {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)

  const handleProjectClick = (project) => {
    if (isNavigating) return

    setIsNavigating(true)

    // Use slug if available, otherwise use ID
    const projectPath = project.slug || project.id

    // Prefetch the project detail page to make transition faster
    router.prefetch(`/projects/${projectPath}`)
    router.push(`/projects/${projectPath}`)
  }

  if (error) {
    return <ErrorMessage title="Failed to load projects" message={error} />
  }

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
          <Card
            className={`h-full cursor-pointer hover:shadow-md transition-shadow overflow-hidden flex flex-col border border-border ${isNavigating ? "pointer-events-none" : ""}`}
            onClick={() => handleProjectClick(project)}
          >
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
                  project.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
              </div>
            </CardFooter>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}
