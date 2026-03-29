"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Image from "@shared/components/ui/app-image"
import { usePathname, useRouter } from "@/lib/app-router"
import { BackLink } from "@/components/ui/back-link"
import { Button } from "@shared/components/ui/button"
import {
  updateProject,
  addProjectTag,
  createProjectVersionFromSnapshot,
  deleteProject,
  getProjectPublishedVersion,
  getProjectVersions,
  getProjectVersioningState,
  publishProject,
  recordProjectImage,
  removeProjectTag,
  renameProject,
  saveProjectDraftContent,
  setProjectCurrentVersion,
  type Tag,
  type Project,
  unpublishProject,
  updateProjectCoverImage,
  updateProjectVersionSnapshot,
} from "@/lib/project-service"
import { createTag, getAllTags } from "@/lib/blog-service"
import Link from "@/components/ui/app-link"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { MORPH_LAYOUT_TRANSITION } from "@shared/lib/motion"
import { createTemporaryId } from "@shared/lib/client-ids"
import { ProjectVersionHistory } from "./version-history"
import { textSimilarity, contentToText, SIMILARITY_THRESHOLD } from "@/lib/content-versioning"
import { Label } from "@shared/components/ui/label"
import { buildEntitySlug, normalizeSlugInput } from "@/lib/slug"
import { uploadToS3 } from "@/lib/s3-service"
import { useNavigationIntent } from "@/components/navigation-intent-provider"
import { LazyVersionSaveDialog } from "@/components/admin/lazy-version-save-dialog"
import { buildDefaultVersionMessage } from "@/lib/version-utils"
import { toast } from "@shared/hooks/use-toast"
import {
  type EditorSaveStatus as SaveStatus,
} from "@/components/content/editor-save-status"
import { buildProjectEditorialSnapshot, normalizeEditorialLinks } from "@/lib/editorial-snapshots"
import { ContentSettingsDialog } from "@/components/content/content-settings-dialog"
import { ContentTagPopover } from "@/components/content/content-tag-popover"
import { ContentEditorToolbar } from "@/components/content/content-editor-toolbar"
import { ProjectLinkSettingsEditor } from "@/components/content/project-link-settings-editor"
import { useVersionState } from "@/components/content/use-version-state"
import {
  ProjectContactCard,
  ProjectContentBody,
  ProjectLinksSection,
  ProjectMeta,
  ProjectNotPublishedState,
  ProjectReadOnlySkeleton,
} from "@/components/project/project-editor-sections"

type Props = {
  project: Project
  mode?: "view" | "edit"
}

export function ProjectEditorView({ project: initialProject, mode = "view" }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { getRecentIntent } = useNavigationIntent()
  const [project, setProject] = useState(() => ({
    ...initialProject,
    content: initialProject.content || "",
  }))
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(mode === "edit" ? "saved" : "idle")
  const [title, setTitle] = useState(project.title)
  const [summary, setSummary] = useState(project.summary || "")
  const [isPublished, setIsPublished] = useState(!!project.published_at)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [projectTags, setProjectTags] = useState<Tag[]>(project.tags || [])
  const [projectLinks, setProjectLinks] = useState(project.links || [])
  const [settingsSummaryDraft, setSettingsSummaryDraft] = useState(project.summary || "")
  const [settingsSlugDraft, setSettingsSlugDraft] = useState(project.slug || "")
  const [settingsPublishedDraft, setSettingsPublishedDraft] = useState(!!project.published_at)

  const [settingsLinksDraft, setSettingsLinksDraft] = useState(project.links || [])
  const [newTagName, setNewTagName] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [versionMessage, setVersionMessage] = useState(
    buildDefaultVersionMessage("project", project.title),
  )
  const [isSavingVersion, setIsSavingVersion] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const titleSaveTimer = useRef<NodeJS.Timeout | null>(null)
  const contentSaveTimer = useRef<NodeJS.Timeout | null>(null)
  const currentContentRef = useRef<string>(initialProject.content || "")
  const [draftContentForCompare, setDraftContentForCompare] = useState(initialProject.content || "")

  const [newLinkLabel, setNewLinkLabel] = useState("")
  const [newLinkUrl, setNewLinkUrl] = useState("")

  const isEditable = mode === "edit"

  const [deferSecondaryReveal, setDeferSecondaryReveal] = useState(false)

  useEffect(() => {
    return () => {
      if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
      if (contentSaveTimer.current) clearTimeout(contentSaveTimer.current)
    }
  }, [])

  useEffect(() => {
    if (mode !== "view") return
    const intent = getRecentIntent()
    const isMorphArrival = !!intent && intent.kind === "projects-detail" && intent.href === pathname
    if (!isMorphArrival) {
      setDeferSecondaryReveal(false)
      return
    }

    setDeferSecondaryReveal(true)
    const timer = window.setTimeout(() => setDeferSecondaryReveal(false), 220)
    return () => window.clearTimeout(timer)
  }, [mode, pathname, getRecentIntent])

  const buildSafeSlug = useCallback(
    (rawValue: string, fallbackSlug?: string | null) => {
      return buildEntitySlug(rawValue, fallbackSlug, "project", project.id)
    },
    [project.id],
  )

  const flushTitleNow = useCallback(
    async (nextTitle: string) => {
      if (!isEditable || !project.id) return
      const currentDerivedSlug = normalizeSlugInput(project.title || "")
      const shouldPreserveCustomSlug = !!project.slug && project.slug !== currentDerivedSlug
      const slug = shouldPreserveCustomSlug ? project.slug : buildSafeSlug(nextTitle, project.slug)
      await renameProject(project.id, nextTitle, slug)
      setProject((prev) => ({ ...prev, title: nextTitle, slug }))
    },
    [isEditable, project.id, project.slug, project.title, buildSafeSlug, normalizeSlugInput],
  )

  const flushDraftContentNow = useCallback(async () => {
    if (!isEditable || !project.id) return
    if (contentSaveTimer.current) {
      clearTimeout(contentSaveTimer.current)
      contentSaveTimer.current = null
    }
    await saveProjectDraftContent(project.id, currentContentRef.current || "")
  }, [isEditable, project.id])

  const {
    committedVersionSnapshot,
    publishedVersion,
    publishedVersionId,
    publishedVersionLoading,
    refreshVersionState,
    setCommittedVersionSnapshot,
  } = useVersionState({
    itemId: project.id,
    emptySnapshot: buildProjectEditorialSnapshot({
      title: "",
      slug: "",
      summary: "",
      publishedAt: null,
      coverImage: null,
      sortOrder: 0,
      tags: [],
      links: [],
      content: "",
    }),
    loadState: getProjectVersioningState,
    loadVersions: getProjectVersions,
    loadPublishedVersion: getProjectPublishedVersion,
    getVersionId: (version) => version.id,
    buildSnapshotFromVersion: (version) =>
      buildProjectEditorialSnapshot({
        title: version.title || "",
        slug: version.slug || "",
        summary: version.summary || "",
        publishedAt: version.published_at || null,
        coverImage: version.cover_image || null,
        sortOrder: version.sort_order || 0,
        tags: version.tags || [],
        links: normalizeEditorialLinks(version.links || []),
        content: version.content || "",
      }),
  })

  // In admin read-only mode, fall back to the current draft if the published snapshot is unavailable.
  const displayContent = isEditable
    ? project.content || ""
    : (publishedVersion?.content ?? project.content ?? "")
  const displayTitle = isEditable ? title : (publishedVersion?.title ?? title)

  const normalizedProjectLinksPayload = useMemo(
    () =>
      settingsLinksDraft
        .map((link) => ({
          label: (link.label || "").trim(),
          url: (link.url || "").trim(),
          link_type: link.link_type || undefined,
        }))
        .filter((link) => link.label || link.url),
    [settingsLinksDraft],
  )
  const draftPublishedAt = settingsPublishedDraft
    ? (project.published_at || new Date().toISOString())
    : null

  const versionDraftSnapshot = useMemo(
    () =>
      buildProjectEditorialSnapshot({
        title: title || "",
        slug: buildSafeSlug(settingsSlugDraft, buildSafeSlug(title)),
        summary: settingsSummaryDraft || "",
        publishedAt: draftPublishedAt,
        coverImage: project.cover_image || null,
        sortOrder: project.sort_order || 0,
        tags: projectTags,
        links: normalizedProjectLinksPayload,
        content: draftContentForCompare || "",
      }),
    [
      buildSafeSlug,
      draftPublishedAt,
      draftContentForCompare,
      normalizedProjectLinksPayload,
      project.cover_image,
      project.sort_order,
      projectTags,
      settingsSlugDraft,
      settingsSummaryDraft,
      title,
    ],
  )

  const hasVersionableDraft = versionDraftSnapshot !== committedVersionSnapshot

  const flushVersionSettingsNow = useCallback(
    async (nextTitle: string) => {
      if (!isEditable || !project.id) return
      const nextSlug = buildSafeSlug(settingsSlugDraft, buildSafeSlug(nextTitle))
      const currentLinksPayload = (project.links || [])
        .map((link) => ({
          label: (link.label || "").trim(),
          url: (link.url || "").trim(),
          link_type: link.link_type || undefined,
        }))
        .filter((link) => link.label || link.url)

      if (
        (project.summary || "") === settingsSummaryDraft &&
        (project.slug || "") === nextSlug &&
        derefOptionalString(project.published_at) === derefOptionalString(draftPublishedAt) &&
        JSON.stringify(currentLinksPayload) === JSON.stringify(normalizedProjectLinksPayload)
      ) {
        return
      }

      const updatedProject = await updateProject(
        project.id,
        {
          summary: settingsSummaryDraft,
          slug: nextSlug,
          published_at: draftPublishedAt ?? "",
        },
        undefined,
        normalizedProjectLinksPayload,
      )
      setSummary(updatedProject.summary || "")
      setSettingsSummaryDraft(updatedProject.summary || "")
      setSettingsSlugDraft(updatedProject.slug || "")
      setProjectLinks(updatedProject.links || [])
      setProject(updatedProject)
      setIsPublished(!!updatedProject.published_at)
    },
    [
      buildSafeSlug,
      draftPublishedAt,
      isEditable,
      normalizedProjectLinksPayload,
      project.id,
      project.links,
      project.published_at,
      project.slug,
      project.summary,
      settingsSlugDraft,
      settingsSummaryDraft,
    ],
  )

  const handleEditorImageUpload = useCallback(
    async (file: File) => {
      if (!project.id) return ""
      return uploadToS3(file, { resourceType: "project", resourceID: project.id })
    },
    [project.id],
  )

  const initialMarkdown = displayContent || ""

  // Fetch tags when editable
  useEffect(() => {
    if (isEditable) {
      getAllTags()
        .then(setAllTags)
        .catch((error) => {
          toast({
            title: "태그 목록을 불러오지 못했습니다",
            description:
              error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
            variant: "destructive",
          })
        })
    }
  }, [isEditable])

  // Smart version save: compare similarity, create new or update existing
  // Returns the version ID on success, null on failure
  const smartSaveVersion = async (
    description?: string,
    options?: { forceNewVersion?: boolean },
  ): Promise<string | null> => {
    if (!isEditable || !project.id) return null
    try {
      const {
        item: currentProject,
        currentVersion,
        latestVersion,
      } = await getProjectVersioningState(project.id)
      const currentVersionContent = currentVersion.body_markdown || ""
      const currentText = contentToText(currentVersionContent)

      if (latestVersion) {
        const prevVersionContent = latestVersion.body_markdown || ""
        const prevText = contentToText(prevVersionContent)
        const similarity = textSimilarity(prevText, currentText)

        if (!options?.forceNewVersion && similarity >= SIMILARITY_THRESHOLD && currentVersion.id) {
          const isLiveSnapshot =
            !!currentProject.published_version_id &&
            currentVersion.id === currentProject.published_version_id

          if (!isLiveSnapshot) {
            const updatedVersionId = await updateProjectVersionSnapshot(currentVersion.id, {
              title: currentVersion.title || currentProject.title || "Untitled",
              content: currentVersionContent,
              summary: currentVersion.summary || currentProject.summary || "",
              change_description: description || currentVersion.change_description,
            })
            await setProjectCurrentVersion(
              project.id,
              updatedVersionId,
              currentVersion.title || currentProject.title || "Untitled",
              currentVersion.summary || currentProject.summary || "",
            )
            return updatedVersionId
          }
        }
      }

      // Big change or no previous version → create new version
      const nextNum = latestVersion ? latestVersion.version_number + 1 : 1
      const newVersionId = await createProjectVersionFromSnapshot({
        projectId: project.id,
        title: currentVersion.title || currentProject.title || "Untitled",
        content: currentVersionContent,
        summary: currentVersion.summary || currentProject.summary || "",
        changeDescription: description || `Version ${nextNum}`,
      })
      await setProjectCurrentVersion(
        project.id,
        newVersionId,
        currentVersion.title || currentProject.title || "Untitled",
        currentVersion.summary || currentProject.summary || "",
      )
      return newVersionId
    } catch (err) {
      console.error("Version save failed:", err)
      toast({
        title: "버전을 저장하지 못했습니다",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
      return null
    }
  }

  // Manual save version
  const openSaveDialog = useCallback(() => {
    setVersionMessage(buildDefaultVersionMessage("project", title))
    setShowSaveDialog(true)
  }, [title])

  const handleSaveVersion = async (message: string) => {
    if (isSavingVersion || saveStatus === "pending" || saveStatus === "saving" || !hasVersionableDraft) return
    setIsSavingVersion(true)
    setSaveStatus("saving")

    try {
      if (titleSaveTimer.current) {
        clearTimeout(titleSaveTimer.current)
        titleSaveTimer.current = null
      }
      await flushTitleNow(title)
      await flushVersionSettingsNow(title)
      await flushDraftContentNow()
    } catch (err) {
      console.error("Pre-save flush failed:", err)
      toast({
        title: "초안 저장을 완료하지 못했습니다",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
      setSaveStatus("error")
      setIsSavingVersion(false)
      return
    }

    const versionId = await smartSaveVersion(message, { forceNewVersion: true })
    if (versionId) {
      const nextProject = settingsPublishedDraft
        ? await publishProject(project.id)
        : await unpublishProject(project.id)
      setProject(nextProject)
      setIsPublished(!!nextProject.published_at)
      setProjectLinks(nextProject.links || [])
      setCommittedVersionSnapshot(versionDraftSnapshot)
      await refreshVersionState()
      setShowSaveDialog(false)
    }
    setSaveStatus(versionId ? "saved" : "error")
    setIsSavingVersion(false)
  }

  // Track if draft differs from published version
  const hasDraftChanges = useMemo(() => {
    if (!isPublished) return false
    if (!publishedVersion) return true // Published but can't load version = assume changed
    const pubText = contentToText(publishedVersion.content || "")
    const draftText = contentToText(draftContentForCompare || "")
    const titleChanged = (publishedVersion.title || "") !== (title || "")
    return titleChanged || textSimilarity(pubText, draftText) < SIMILARITY_THRESHOLD
  }, [isPublished, publishedVersion, draftContentForCompare, title])

  // Delete project
  const handleDelete = async () => {
    if (isDeleting) return
    if (!confirm("Are you sure you want to delete this project? This cannot be undone.")) return
    setIsDeleting(true)
    try {
      await deleteProject(project.id)
      router.push("/projects")
    } catch (err) {
      console.error("Delete failed:", err)
      toast({
        title: "프로젝트를 삭제하지 못했습니다",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
      setIsDeleting(false)
    }
  }

  // Auto-save title with debounce
  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      if (!isEditable || !project.id) return

      if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
      setSaveStatus("pending")
      titleSaveTimer.current = setTimeout(async () => {
        setSaveStatus("saving")
        try {
          // Generate slug from title
          await flushTitleNow(newTitle)
          setSaveStatus("saved")
        } catch {
          setSaveStatus("error")
        }
      }, 1000)
    },
    [isEditable, project.id, flushTitleNow],
  )

  // Tag management
  const handleAddTag = async (tag: Tag) => {
    if (projectTags.find((t) => t.id === tag.id)) return
    setProjectTags((prev) => [...prev, tag])
    try {
      await addProjectTag(project.id, tag.id)
    } catch (err) {
      console.error("Failed to add tag:", err)
      toast({
        title: "태그를 추가하지 못했습니다",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
      setProjectTags((prev) => prev.filter((t) => t.id !== tag.id))
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    const removed = projectTags.find((t) => t.id === tagId)
    setProjectTags((prev) => prev.filter((t) => t.id !== tagId))
    try {
      await removeProjectTag(project.id, tagId)
    } catch (err) {
      console.error("Failed to remove tag:", err)
      toast({
        title: "태그를 제거하지 못했습니다",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
      if (removed) setProjectTags((prev) => [...prev, removed])
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    try {
      const tag = await createTag(newTagName.trim())
      setAllTags((prev) => [...prev, tag])
      await handleAddTag(tag)
      setNewTagName("")
    } catch (err) {
      console.error("Failed to create tag:", err)
      toast({
        title: "태그를 만들지 못했습니다",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
    }
  }

  // Cover image upload
  const handleCoverImageUpload = async () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setSaveStatus("saving")
      try {
        const fileUrl = await uploadToS3(file, { resourceType: "project", resourceID: project.id })
        await recordProjectImage(project.id, fileUrl, "cover")
        await updateProjectCoverImage(project.id, fileUrl)

        setProject((prev) => ({ ...prev, cover_image: fileUrl }))
        setSaveStatus("saved")
      } catch {
        setSaveStatus("error")
      }
    }
    input.click()
  }

  const authorName = project.owner?.full_name || "이름 없음"
  const publishedDate = project.published_at
    ? new Date(project.published_at)
    : new Date(project.created_at)
  const formattedDate = format(publishedDate, "yyyy.MM.dd")

  const availableTags = allTags.filter((t) => !projectTags.find((pt) => pt.id === t.id))

  const secondaryRevealMotion = deferSecondaryReveal
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.16, delay: 0.1 },
      }
    : {
        initial: false as const,
        animate: { opacity: 1 },
        transition: { duration: 0.12 },
      }

  const handleAddProjectLink = () => {
    const label = newLinkLabel.trim()
    const url = newLinkUrl.trim()
    if (!label && !url) return
    setSettingsLinksDraft((prev) => [
      ...prev,
      {
        id: createTemporaryId("project-link"),
        project_id: project.id,
        label: label || url,
        url,
        link_type: null,
        sort_order: prev.length,
      },
    ])
    setNewLinkLabel("")
    setNewLinkUrl("")
  }

  const handleRemoveProjectLink = (index: number) => {
    setSettingsLinksDraft((prev) =>
      prev.filter((_, i) => i !== index).map((link, i) => ({ ...link, sort_order: i })),
    )
  }

  const openSettingsModal = () => {
    setSettingsSummaryDraft(summary)
    setSettingsSlugDraft(project.slug || buildSafeSlug(title))
    setSettingsPublishedDraft(isPublished)
    setSettingsLinksDraft(projectLinks)
    setNewLinkLabel("")
    setNewLinkUrl("")
    setShowSettingsModal(true)
  }

  const handleSaveSettings = async () => {
    if (!isEditable || isSavingSettings) return
    setIsSavingSettings(true)
    try {
      const nextSlug = buildSafeSlug(settingsSlugDraft, buildSafeSlug(title))
      const updatedProject = await updateProject(
        project.id,
        {
          summary: settingsSummaryDraft,
          slug: nextSlug,
          published_at: draftPublishedAt ?? "",
        },
        undefined,
        normalizedProjectLinksPayload,
      )
      setSummary(updatedProject.summary || "")
      setSettingsSlugDraft(updatedProject.slug || "")
      setIsPublished(!!updatedProject.published_at)
      setProjectLinks(updatedProject.links || [])
      setProject(updatedProject)
      await refreshVersionState()
      setShowSettingsModal(false)
    } catch (error) {
      console.error("Failed to save settings:", error)
      toast({
        title: "설정을 저장하지 못했습니다",
        description: error instanceof Error ? error.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  function derefOptionalString(value: string | null | undefined) {
    return value || ""
  }

  // Read-only mode: show loading state or "not published" message
  if (!isEditable) {
    if (publishedVersionLoading) {
      return (
        <ProjectReadOnlySkeleton
          project={project}
          displayTitle={displayTitle}
          authorName={authorName}
          formattedDate={formattedDate}
          projectTags={projectTags}
          projectLinks={projectLinks}
        />
      )
    }

    if (!displayContent) {
      return <ProjectNotPublishedState />
    }
  }

  return (
    <motion.div transition={MORPH_LAYOUT_TRANSITION} className="content-article container">
      {/* Back link */}
      <div className="content-article__backlink">
        <BackLink href={mode === "edit" ? "/projects" : "/projects"}>
          {mode === "edit" ? "관리 화면으로 돌아가기" : "전체 프로젝트로 돌아가기"}
        </BackLink>
      </div>

      {/* Author edit toolbar */}
      {isEditable && (
        <ContentEditorToolbar
          saveStatus={saveStatus}
          saveDisabled={
            isSavingVersion ||
            saveStatus === "pending" ||
            saveStatus === "saving" ||
            !hasVersionableDraft
          }
          isSavingVersion={isSavingVersion}
          onOpenSaveDialog={openSaveDialog}
          onOpenSettings={openSettingsModal}
          onOpenHistory={() => setShowHistory(!showHistory)}
          onOpenCoverUpload={handleCoverImageUpload}
          onDelete={handleDelete}
        >
          <ContentTagPopover
            selectedTags={projectTags}
            availableTags={availableTags}
            newTagName={newTagName}
            onNewTagNameChange={setNewTagName}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onCreateTag={handleCreateTag}
          />
        </ContentEditorToolbar>
      )}

      {/* Version history panel */}
      {isEditable && showHistory && (
        <div className="mb-6">
          <ProjectVersionHistory
            projectId={project.id}
            publishedVersionId={publishedVersionId}
            onVersionRestored={() => {
              setShowHistory(false)
              window.location.reload()
            }}
          />
        </div>
      )}

      {/* Cover image */}
      {project.cover_image && (
        <motion.div
          layoutId={`project-image-${project.id}`}
          transition={MORPH_LAYOUT_TRANSITION}
          className="content-article__cover"
        >
          <Image
            src={project.cover_image}
            alt={title}
            width={1600}
            height={900}
            className="w-full h-64 md:h-80 object-cover"
            unoptimized
          />
        </motion.div>
      )}

      {/* Title — editable for author, static for viewers */}
      {isEditable ? (
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="content-article__title-input"
          placeholder="프로젝트 제목…"
        />
      ) : (
        <motion.div layoutId={`project-title-${project.id}`} transition={MORPH_LAYOUT_TRANSITION}>
          <h1 className="content-article__title">{displayTitle}</h1>
        </motion.div>
      )}

      {/* Author & meta info */}
      <ProjectMeta
        project={project}
        authorName={authorName}
        formattedDate={formattedDate}
        tags={projectTags}
        className="content-article__meta"
      />

      <ProjectContentBody
        isEditable={isEditable}
        initialMarkdown={initialMarkdown}
        projectId={project.id}
        onImageUpload={handleEditorImageUpload}
        onDraftChange={(markdown) => {
          currentContentRef.current = markdown
          setDraftContentForCompare(markdown)
          if (!project.id) return

          if (contentSaveTimer.current) clearTimeout(contentSaveTimer.current)
          setSaveStatus("pending")
          contentSaveTimer.current = setTimeout(() => {
            setSaveStatus("saving")
            saveProjectDraftContent(project.id, markdown)
              .then(() => setSaveStatus("saved"))
              .catch(() => setSaveStatus("error"))
          }, 1000)
        }}
        motionProps={secondaryRevealMotion}
      />

      <ProjectLinksSection links={projectLinks} motionProps={secondaryRevealMotion} />

      {!isEditable && (
        <ProjectContactCard title={displayTitle} motionProps={secondaryRevealMotion} />
      )}

      <ContentSettingsDialog
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
        title="프로젝트 설정"
        slugInputId="project-settings-slug"
        slugValue={settingsSlugDraft}
        onSlugChange={setSettingsSlugDraft}
        slugPlaceholder="project-slug"
        urlPreview={`/projects/${buildSafeSlug(settingsSlugDraft, buildSafeSlug(title))}`}
        summaryValue={settingsSummaryDraft}
        onSummaryChange={setSettingsSummaryDraft}
        summaryPlaceholder="프로젝트 카드와 미리보기에 표시할 짧은 요약"
        summaryHint="저장하면 프로젝트 정보에 바로 반영됩니다."
        publicationSwitchId="project-settings-publication"
        isPublished={settingsPublishedDraft}
        onPublishedChange={setSettingsPublishedDraft}
        isSaving={isSavingSettings}
        onSave={handleSaveSettings}
      >
        <ProjectLinkSettingsEditor
          links={settingsLinksDraft}
          newLinkLabel={newLinkLabel}
          newLinkUrl={newLinkUrl}
          onNewLinkLabelChange={setNewLinkLabel}
          onNewLinkUrlChange={setNewLinkUrl}
          onAddLink={handleAddProjectLink}
          onRemoveLink={handleRemoveProjectLink}
        />
      </ContentSettingsDialog>
      <LazyVersionSaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        title="버전 저장"
        description="지금 상태를 저장된 버전으로 남깁니다."
        message={versionMessage}
        onMessageChange={setVersionMessage}
        onConfirm={() => void handleSaveVersion(versionMessage.trim())}
        isSaving={isSavingVersion}
        confirmLabel="저장"
      />
    </motion.div>
  )
}
