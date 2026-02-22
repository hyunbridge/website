import { Suspense } from "react"
import { getProjects } from "@/lib/project-service"
import { ProjectList } from "./project-list"
import { ProjectSkeleton } from "@/components/skeletons"
import { ErrorBoundary } from "@/components/error-boundary"
import { ErrorMessage } from "@/components/error-message"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Projects | Hyungyo Seo",
  description: "View my projects and work",
}

export default async function ProjectsPage() {
  return (
    <div className="container py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">Projects</h1>
      <Suspense fallback={<ProjectSkeleton />}>
        <ProjectListWrapper />
      </Suspense>
    </div>
  )
}

async function ProjectListWrapper() {
  const projects = await getProjects(true)
  return <ProjectList projects={projects} />
}
