import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getProjectById } from "@/lib/notion"
import { ProjectDetail } from "../project-detail"
import { ProjectSkeleton } from "@/components/skeletons"
import { ErrorBoundary } from "@/components/error-boundary"
import { ErrorMessage } from "@/components/error-message"

export async function generateMetadata({ params }) {
  try {
    const project = await getProjectById(params.id)

    return {
      title: `${project.title} | Hyungyo Seo`,
      description: project.description || project.summary,
    }
  } catch (error) {
    return {
      title: "Project | Hyungyo Seo",
      description: "View project details",
    }
  }
}

export default function ProjectPage({ params }) {
  return (
    <div className="container py-8 md:py-12">
      <ErrorBoundary
        fallback={
          <ErrorMessage
            title="Failed to load project"
            message="There was an error loading this project. Please check your Notion configuration or try again later."
          />
        }
      >
        <Suspense fallback={<ProjectSkeleton />}>
          <ProjectDetailWrapper id={params.id} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

async function ProjectDetailWrapper({ id }) {
  try {
    const project = await getProjectById(id)

    if (!project) {
      notFound()
    }

    return <ProjectDetail project={project} />
  } catch (error) {
    return (
      <ErrorMessage
        title="Failed to load project"
        message={error instanceof Error ? error.message : "An unknown error occurred"}
      />
    )
  }
}

