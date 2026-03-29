"use client"

import { getPostVersions, restorePostVersion } from "@/lib/blog-service"
import { VersionHistoryPanel } from "@/components/content/version-history-panel"

interface PostVersionHistoryProps {
  postId: string
  publishedVersionId?: string | null
  onVersionRestored: () => void
}

export function PostVersionHistory({
  postId,
  publishedVersionId,
  onVersionRestored,
}: PostVersionHistoryProps) {
  return (
    <VersionHistoryPanel
      itemId={postId}
      publishedVersionId={publishedVersionId}
      onVersionRestored={onVersionRestored}
      loadVersions={getPostVersions}
      restoreVersion={restorePostVersion}
    />
  )
}
