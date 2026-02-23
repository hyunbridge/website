import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getProjectBySlug, getProjectPublishedVersion } from "@/lib/project-service"
import { PublicProjectView } from "@/components/project/public-project-view"
import { ErrorBoundary } from "@/components/error-boundary"
import { ErrorMessage } from "@/components/error-message"

type Props = {
  params: Promise<{ slug: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props) {
  try {
    const { slug } = await params
    const project = await getProjectBySlug(slug)

    if (!project) {
      return {
        title: "Project | Hyungyo Seo",
        description: "View project details",
      }
    }

    return {
      title: `${project.title} | Hyungyo Seo`,
      description: project.summary || project.title,
    }
  } catch (error) {
    return {
      title: "Project | Hyungyo Seo",
      description: "View project details",
    }
  }
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params

  return (
    <div className="w-full">
      <ErrorBoundary
        fallback={
          <ErrorMessage
            title="Failed to load project"
            message="There was an error loading this project. Please try again later."
          />
        }
      >
        <Suspense fallback={null}>
          <ProjectDetailWrapper slug={slug} />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

async function ProjectDetailWrapper({ slug }: { slug: string }) {
  try {
    const project = await getProjectBySlug(slug)

    if (!project) {
      notFound()
    }

    let publishedSnapshot = null
    if (project.is_published && project.published_version_id) {
      try {
        publishedSnapshot = await getProjectPublishedVersion(project.published_version_id)
      } catch {
        publishedSnapshot = null
      }
    }

    return <PublicProjectView project={project} publishedSnapshot={publishedSnapshot} />
  } catch (error) {
    return (
      <ErrorMessage
        title="Failed to load project"
        message={error instanceof Error ? error.message : "An unknown error occurred"}
      />
    )
  }
}
