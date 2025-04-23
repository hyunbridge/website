import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getProjectBySlug } from "@/lib/notion"
import { ProjectDetail } from "../project-detail"
import { ProjectDetailSkeleton } from "../project-detail-skeleton"
import { ErrorBoundary } from "@/components/error-boundary"
import { ErrorMessage } from "@/components/error-message"

export async function generateMetadata({ params }) {
  try {
    const project = await getProjectBySlug(params.slug)

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
    <div className="w-full">
      <ErrorBoundary
        fallback={
          <ErrorMessage
            title="Failed to load project"
            message="There was an error loading this project. Please check your Notion configuration or try again later."
          />
        }
      >
        <Suspense fallback={<ProjectDetailSkeleton />}>
          <ProjectDetailWrapper slug={params.slug} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

async function ProjectDetailWrapper({ slug }) {
  try {
    const project = await getProjectBySlug(slug)

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
