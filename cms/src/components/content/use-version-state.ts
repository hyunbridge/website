"use client"

import { useCallback, useEffect, useState } from "react"

type PublishedVersionContent = {
  title: string
  content: string
  summary?: string | null
}

type VersionStateResponse = {
  item: {
    current_version_id: string | null
    published_version_id: string | null
  }
}

type UseVersionStateOptions<TVersion, TSnapshot> = {
  itemId?: string | null
  emptySnapshot: TSnapshot
  loadState: (itemId: string) => Promise<VersionStateResponse>
  loadVersions: (itemId: string) => Promise<TVersion[]>
  loadPublishedVersion: (versionId: string) => Promise<PublishedVersionContent | null | undefined>
  getVersionId: (version: TVersion) => string
  buildSnapshotFromVersion: (version: TVersion) => TSnapshot
}

export function useVersionState<TVersion, TSnapshot>({
  itemId,
  emptySnapshot,
  loadState,
  loadVersions,
  loadPublishedVersion,
  getVersionId,
  buildSnapshotFromVersion,
}: UseVersionStateOptions<TVersion, TSnapshot>) {
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null)
  const [publishedVersion, setPublishedVersion] = useState<PublishedVersionContent | null>(null)
  const [publishedVersionLoading, setPublishedVersionLoading] = useState(false)
  const [committedVersionSnapshot, setCommittedVersionSnapshot] = useState(emptySnapshot)
  const [versionStateError, setVersionStateError] = useState<Error | null>(null)

  const refreshVersionState = useCallback(
    async (options?: { syncCommitted?: boolean }) => {
      if (!itemId) {
        setVersionStateError(null)
        setPublishedVersionId(null)
        if (options?.syncCommitted) {
          setCommittedVersionSnapshot(emptySnapshot)
        }
        return
      }

      try {
        const state = await loadState(itemId)
        setVersionStateError(null)
        setPublishedVersionId(state.item.published_version_id ?? null)

        if (!options?.syncCommitted) return

        if (!state.item.current_version_id) {
          setCommittedVersionSnapshot(emptySnapshot)
          return
        }

        const versions = await loadVersions(itemId)
        const currentVersion = versions.find(
          (version) => getVersionId(version) === state.item.current_version_id,
        )
        setCommittedVersionSnapshot(
          currentVersion ? buildSnapshotFromVersion(currentVersion) : emptySnapshot,
        )
      } catch (error) {
        setVersionStateError(
          error instanceof Error ? error : new Error("버전 상태를 불러오지 못했습니다."),
        )
      }
    },
    [
      buildSnapshotFromVersion,
      emptySnapshot,
      getVersionId,
      itemId,
      loadState,
      loadVersions,
    ],
  )

  useEffect(() => {
    void refreshVersionState({ syncCommitted: true })
  }, [refreshVersionState])

  useEffect(() => {
    if (!publishedVersionId) {
      setPublishedVersionLoading(false)
      setPublishedVersion(null)
      return
    }

    setPublishedVersionLoading(true)
    void loadPublishedVersion(publishedVersionId)
      .then((version) => {
        setVersionStateError(null)
        setPublishedVersion(version ?? null)
      })
      .catch((error) => {
        setVersionStateError(
          error instanceof Error ? error : new Error("공개 버전을 불러오지 못했습니다."),
        )
        setPublishedVersion(null)
      })
      .finally(() => {
        setPublishedVersionLoading(false)
      })
  }, [loadPublishedVersion, publishedVersionId])

  return {
    committedVersionSnapshot,
    publishedVersion,
    publishedVersionId,
    publishedVersionLoading,
    refreshVersionState,
    setCommittedVersionSnapshot,
    versionStateError,
  }
}
