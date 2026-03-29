"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { useAuth } from "@/contexts/auth-context"
import { getPosts, type Post } from "@/lib/blog-service"
import {
  getDefaultHomePageData,
  getEmptyHomePageData,
  getHomePage,
  getHomePageDataNotices,
  getHomePageVersions,
  saveHomePageDraft,
  saveHomePageVersion,
  type HomePageData,
  type HomePageDocument,
  type HomePageNotice,
} from "@/lib/home-page-service"
import { getProjects, type Project } from "@/lib/project-service"
import { buildDefaultVersionMessage } from "@/lib/version-utils"
import { type EditorSaveStatus as SaveStatus } from "@/components/content/editor-save-status"

type UseHomeBuilderDraftResult = {
  authLoading: boolean
  error: string | null
  isLoading: boolean
  isSavingVersion: boolean
  notices: HomePageNotice[]
  page: HomePageDocument | null
  draftData: HomePageData
  posts: Post[]
  projects: Project[]
  saveStatus: SaveStatus
  showHistory: boolean
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>
  showSaveDialog: boolean
  setShowSaveDialog: React.Dispatch<React.SetStateAction<boolean>>
  versionMessage: string
  setVersionMessage: React.Dispatch<React.SetStateAction<string>>
  hasVersionableDraft: boolean
  applyDraftData: (nextData: HomePageData) => void
  openSaveDialog: () => void
  handleSaveVersion: (message: string) => Promise<void>
  handleVersionRestored: (restored: HomePageDocument) => void
}

export function useHomeBuilderDraft(): UseHomeBuilderDraftResult {
  const { user, isLoading: authLoading } = useAuth()
  const [page, setPage] = useState<HomePageDocument | null>(null)
  const [draftData, setDraftData] = useState<HomePageData>(getDefaultHomePageData())
  const [projects, setProjects] = useState<Project[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingVersion, setIsSavingVersion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved")
  const [showHistory, setShowHistory] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [versionMessage, setVersionMessage] = useState(buildDefaultVersionMessage("home"))
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isAutoSavingRef = useRef(false)
  const queuedAutoSaveRef = useRef(false)
  const hasInitializedRef = useRef(false)
  const lastSavedSnapshotRef = useRef(JSON.stringify(getEmptyHomePageData()))
  const committedVersionSnapshotRef = useRef(JSON.stringify(getEmptyHomePageData()))
  const draftSnapshotRef = useRef(JSON.stringify(draftData))
  const latestDraftRef = useRef(draftData)
  const notices = Array.from(
    new Map(
      [...(page?.notices || []), ...getHomePageDataNotices(draftData)].map(
        (notice) => [`${notice.code}:${notice.message}`, notice] as const,
      ),
    ).values(),
  ) as HomePageNotice[]
  const hasUnsavedChanges = draftSnapshotRef.current !== lastSavedSnapshotRef.current
  const hasVersionableDraft = draftSnapshotRef.current !== committedVersionSnapshotRef.current

  useEffect(() => {
    latestDraftRef.current = draftData
  }, [draftData])

  const clearAutoSaveTimer = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
  }, [])

  const applyDraftData = useCallback((nextData: HomePageData) => {
    latestDraftRef.current = nextData
    draftSnapshotRef.current = JSON.stringify(nextData)
    setDraftData(nextData)
    setError(null)
    setSaveStatus(
      draftSnapshotRef.current === lastSavedSnapshotRef.current ? "saved" : "pending",
    )
  }, [])

  const performAutoSave = useCallback(async () => {
    if (authLoading || isLoading || isSavingVersion || !user || !hasInitializedRef.current) return

    const draftToSave = latestDraftRef.current
    const snapshotBeforeSave = draftSnapshotRef.current

    if (snapshotBeforeSave === lastSavedSnapshotRef.current) {
      setSaveStatus((current) => (current === "error" ? current : "saved"))
      return
    }

    if (isAutoSavingRef.current) {
      queuedAutoSaveRef.current = true
      return
    }

    isAutoSavingRef.current = true
    setSaveStatus("saving")
    setError(null)

    try {
      const saved = await saveHomePageDraft({
        data: draftToSave,
        changeDescription: "Auto save",
      })

      setPage(saved)
      lastSavedSnapshotRef.current = JSON.stringify(saved.data)
      setSaveStatus("saved")

      if (draftSnapshotRef.current === snapshotBeforeSave) {
        latestDraftRef.current = saved.data
        draftSnapshotRef.current = JSON.stringify(saved.data)
        setDraftData(saved.data)
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "홈 페이지를 자동 저장하지 못했습니다.",
      )
      setSaveStatus("error")
    } finally {
      isAutoSavingRef.current = false

      const hasQueuedChanges =
        queuedAutoSaveRef.current || draftSnapshotRef.current !== lastSavedSnapshotRef.current

      queuedAutoSaveRef.current = false

      if (hasQueuedChanges) {
        void performAutoSave()
      }
    }
  }, [authLoading, isLoading, isSavingVersion, user])

  useEffect(() => {
    return () => {
      clearAutoSaveTimer()
    }
  }, [clearAutoSaveTimer])

  useEffect(() => {
    if (authLoading || !user) return

    let mounted = true

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const [homePage, projectList, postList] = await Promise.all([
          getHomePage(true),
          getProjects(true),
          getPosts(1, 6, true),
        ])

        if (!mounted) return

        const nextData = homePage?.data || getDefaultHomePageData()
        setPage(homePage)
        setDraftData(nextData)
        latestDraftRef.current = nextData
        draftSnapshotRef.current = JSON.stringify(nextData)
        committedVersionSnapshotRef.current = draftSnapshotRef.current
        setProjects(projectList)
        setPosts(postList)
        lastSavedSnapshotRef.current = JSON.stringify(nextData)

        if (homePage?.currentVersionId) {
          const versions = await getHomePageVersions()
          const currentVersion = versions.find((version) => version.id === homePage.currentVersionId)
          if (currentVersion) {
            committedVersionSnapshotRef.current = JSON.stringify(currentVersion.data)
          }
        }

        queuedAutoSaveRef.current = false
        isAutoSavingRef.current = false
        hasInitializedRef.current = true
        setSaveStatus("saved")
      } catch (loadError) {
        if (!mounted) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "홈 페이지 데이터를 불러오지 못했습니다.",
        )
        setSaveStatus("error")
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [authLoading, user])

  useEffect(() => {
    if (authLoading || isLoading || isSavingVersion || !user) return
    if (!hasInitializedRef.current) return

    if (!hasUnsavedChanges) {
      setSaveStatus((current) => (current === "error" ? current : "saved"))
      return
    }

    clearAutoSaveTimer()
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null
      void performAutoSave()
    }, 1000)

    return () => {
      clearAutoSaveTimer()
    }
  }, [
    authLoading,
    clearAutoSaveTimer,
    hasUnsavedChanges,
    isLoading,
    isSavingVersion,
    performAutoSave,
    user,
  ])

  const openSaveDialog = useCallback(() => {
    setVersionMessage(buildDefaultVersionMessage("home"))
    setShowSaveDialog(true)
  }, [])

  const handleSaveVersion = useCallback(
    async (message: string) => {
      if (!user || saveStatus === "pending" || saveStatus === "saving" || !hasVersionableDraft) {
        return
      }

      const draftToSave = latestDraftRef.current
      const snapshotBeforeSave = draftSnapshotRef.current
      clearAutoSaveTimer()
      queuedAutoSaveRef.current = false
      setIsSavingVersion(true)
      setSaveStatus("saving")
      setError(null)

      try {
        const saved = await saveHomePageDraft({
          data: draftToSave,
          changeDescription: "Draft changes",
        })
        if (!saved.id) {
          throw new Error("홈 페이지 식별자를 찾을 수 없습니다.")
        }

        const nextPage = await saveHomePageVersion(message)
        setPage(nextPage)
        const nextSavedData = nextPage.data
        if (nextSavedData) {
          lastSavedSnapshotRef.current = JSON.stringify(nextSavedData)
          committedVersionSnapshotRef.current = lastSavedSnapshotRef.current

          if (draftSnapshotRef.current === snapshotBeforeSave) {
            latestDraftRef.current = nextSavedData
            draftSnapshotRef.current = JSON.stringify(nextSavedData)
            setDraftData(nextSavedData)
          }
        }
        setSaveStatus("saved")
        setShowSaveDialog(false)
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "홈 페이지 버전을 저장하지 못했습니다.",
        )
        setSaveStatus("error")
      } finally {
        setIsSavingVersion(false)
      }
    },
    [clearAutoSaveTimer, hasVersionableDraft, saveStatus, user],
  )

  const handleVersionRestored = useCallback((restored: HomePageDocument) => {
    setPage(restored)
    latestDraftRef.current = restored.data
    draftSnapshotRef.current = JSON.stringify(restored.data)
    committedVersionSnapshotRef.current = draftSnapshotRef.current
    lastSavedSnapshotRef.current = draftSnapshotRef.current
    setDraftData(restored.data)
    setSaveStatus("saved")
    setShowHistory(false)
  }, [])

  return {
    authLoading,
    error,
    isLoading,
    isSavingVersion,
    notices,
    page,
    draftData,
    posts,
    projects,
    saveStatus,
    showHistory,
    setShowHistory,
    showSaveDialog,
    setShowSaveDialog,
    versionMessage,
    setVersionMessage,
    hasVersionableDraft,
    applyDraftData,
    openSaveDialog,
    handleSaveVersion,
    handleVersionRestored,
  }
}
