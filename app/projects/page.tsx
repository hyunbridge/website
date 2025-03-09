import { Suspense } from "react"
import { getProjects } from "@/lib/notion"
import { ProjectList } from "./project-list"
import { ProjectSkeleton } from "@/components/skeletons"
import { ErrorBoundary } from "@/components/error-boundary"
import { ErrorMessage } from "@/components/error-message"

export const metadata = {
  title: "Projects | Hyungyo Seo",
  description: "View my projects and work",
}

export default async function ProjectsPage() {
  return (
    <div className="container py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">Projects</h1>
      <ErrorBoundary
        fallback={
          <ErrorMessage
            title="Failed to load projects"
            message="There was an error loading the projects. Please check your Notion configuration or try again later."
          />
        }
      >
        <Suspense fallback={<ProjectSkeleton />}>
          <ProjectListWrapper />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

async function ProjectListWrapper() {
  try {
    const projects = await getProjects()
    return <ProjectList projects={projects} />
  } catch (error) {
    return (
      <ErrorMessage
        title="Failed to load projects"
        message={error instanceof Error ? error.message : "An unknown error occurred"}
      />
    )
  }
}

