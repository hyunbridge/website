"use client"

import type { Project } from "@/lib/project-service"
import { SeamlessProjectView } from "@/components/project/seamless-project-view"

export function ProjectDetail({ project }: { project: Project }) {
  return <SeamlessProjectView project={project} mode="view" />
}
