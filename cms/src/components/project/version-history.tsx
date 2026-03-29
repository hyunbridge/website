"use client"

import { getProjectVersions, restoreProjectVersion } from "@/lib/project-service"
import { VersionHistoryPanel } from "@/components/content/version-history-panel"

interface ProjectVersionHistoryProps {
  projectId: string
  publishedVersionId?: string | null
  onVersionRestored: () => void
}

export function ProjectVersionHistory({
  projectId,
  publishedVersionId,
  onVersionRestored,
}: ProjectVersionHistoryProps) {
  return (
    <VersionHistoryPanel
      itemId={projectId}
      publishedVersionId={publishedVersionId}
      onVersionRestored={onVersionRestored}
      loadVersions={getProjectVersions}
      restoreVersion={restoreProjectVersion}
    />
  )
}
