"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Image from "@shared/components/ui/app-image"
import { usePathname, useRouter } from "@/lib/app-router"
import { Comments } from "./comments"
import { BackLink } from "@/components/ui/back-link"
import { Button } from "@shared/components/ui/button"
import {
  addPostTag,
  createPostVersionFromSnapshot,
  createTag,
  deletePost,
  getAllTags,
  getPostPublishedVersion,
  getPostVersions,
  getPostVersioningState,
  publishPost,
  recordPostImage,
  removePostTag,
  renamePost,
  savePostDraftContent,
  setPostCurrentVersion,
  type Tag,
  type Post,
  unpublishPost,
  updatePost,
  updatePostCoverImage,
  updatePostVersionSnapshot,
} from "@/lib/blog-service"
import Link from "@/components/ui/app-link"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { MORPH_LAYOUT_TRANSITION } from "@shared/lib/motion"
import { PostVersionHistory } from "./version-history"
import { textSimilarity, contentToText, SIMILARITY_THRESHOLD } from "@/lib/content-versioning"
import { Label } from "@shared/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { uploadToS3 } from "@/lib/s3-service"
import { useNavigationIntent } from "@/components/navigation-intent-provider"
import { LazyVersionSaveDialog } from "@/components/admin/lazy-version-save-dialog"
import { buildDefaultVersionMessage } from "@/lib/version-utils"
import { buildEntitySlug, normalizeSlugInput } from "@/lib/slug"
import { toast } from "@shared/hooks/use-toast"
import {
  type EditorSaveStatus as SaveStatus,
} from "@/components/content/editor-save-status"
import { buildPostEditorialSnapshot } from "@/lib/editorial-snapshots"
import { ContentSettingsDialog } from "@/components/content/content-settings-dialog"
import { ContentTagPopover } from "@/components/content/content-tag-popover"
import { ContentEditorToolbar } from "@/components/content/content-editor-toolbar"
import { useVersionState } from "@/components/content/use-version-state"
import {
  PostContentBody,
  PostMeta,
  PostNotPublishedState,
  PostReadOnlySkeleton,
} from "@/components/blog/post-editor-sections"

type Props = {
  post: Post
  mode?: "view" | "edit"
}

export function PostEditorView({ post: initialPost, mode = "view" }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const { getRecentIntent } = useNavigationIntent()
  const [post, setPost] = useState(() => ({
    ...initialPost,
    content: initialPost.content || "",
  }))
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(mode === "edit" ? "saved" : "idle")
  const [title, setTitle] = useState(post.title)
  const [isPublished, setIsPublished] = useState(!!post.published_at)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [postTags, setPostTags] = useState<Tag[]>(post.tags || [])
  const [settingsSummaryDraft, setSettingsSummaryDraft] = useState(post.summary || "")
  const [settingsSlugDraft, setSettingsSlugDraft] = useState(post.slug || "")
  const [settingsEnableCommentsDraft, setSettingsEnableCommentsDraft] = useState(
    !!post.enable_comments,
  )
  const [settingsPublishedDraft, setSettingsPublishedDraft] = useState(!!post.published_at)
  const [newTagName, setNewTagName] = useState("")
  const [showHistory, setShowHistory] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [versionMessage, setVersionMessage] = useState(
    buildDefaultVersionMessage("post", post.title),
  )
  const [isSavingVersion, setIsSavingVersion] = useState(false)
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const titleSaveTimer = useRef<NodeJS.Timeout | null>(null)
  const contentSaveTimer = useRef<NodeJS.Timeout | null>(null)
  const currentContentRef = useRef<string>(initialPost.content || "")
  const [draftContentForCompare, setDraftContentForCompare] = useState(initialPost.content || "")

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
    const isMorphArrival = !!intent && intent.kind === "blog-detail" && intent.href === pathname
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
      return buildEntitySlug(rawValue, fallbackSlug, "untitled", post.id)
    },
    [post.id],
  )

  const flushTitleNow = useCallback(
    async (nextTitle: string) => {
      if (!isEditable || !post.id) return
      const currentDerivedSlug = normalizeSlugInput(post.title || "")
      const shouldPreserveCustomSlug = !!post.slug && post.slug !== currentDerivedSlug
      const slug = shouldPreserveCustomSlug ? post.slug : buildSafeSlug(nextTitle, post.slug)
      await renamePost(post.id, nextTitle, slug)
      setPost((prev) => ({ ...prev, title: nextTitle, slug }))
    },
    [isEditable, post.id, post.slug, post.title, buildSafeSlug, normalizeSlugInput],
  )

  const flushDraftContentNow = useCallback(async () => {
    if (!isEditable || !post.id) return
    if (contentSaveTimer.current) {
      clearTimeout(contentSaveTimer.current)
      contentSaveTimer.current = null
    }
    await savePostDraftContent(post.id, currentContentRef.current || "")
  }, [isEditable, post.id])

  const {
    committedVersionSnapshot,
    publishedVersion,
    publishedVersionId,
    publishedVersionLoading,
    refreshVersionState,
    setCommittedVersionSnapshot,
  } = useVersionState({
    itemId: post.id,
    emptySnapshot: buildPostEditorialSnapshot({
      title: "",
      slug: "",
      summary: "",
      publishedAt: null,
      coverImage: null,
      enableComments: false,
      tags: [],
      content: "",
    }),
    loadState: getPostVersioningState,
    loadVersions: getPostVersions,
    loadPublishedVersion: getPostPublishedVersion,
    getVersionId: (version) => version.id,
    buildSnapshotFromVersion: (version) =>
      buildPostEditorialSnapshot({
        title: version.title || "",
        slug: version.slug || "",
        summary: version.summary || "",
        publishedAt: version.published_at || null,
        coverImage: version.cover_image || null,
        enableComments: !!version.enable_comments,
        tags: version.tags || [],
        content: version.content || "",
      }),
  })

  // In admin read-only mode, fall back to the current draft if the published snapshot is unavailable.
  const displayContent = isEditable
    ? post.content || ""
    : (publishedVersion?.content ?? post.content ?? "")
  const displayTitle = isEditable ? title : (publishedVersion?.title ?? title)
  const draftPublishedAt = settingsPublishedDraft ? (post.published_at || new Date().toISOString()) : null

  const versionDraftSnapshot = useMemo(
    () =>
      buildPostEditorialSnapshot({
        title: title || "",
        slug: buildSafeSlug(settingsSlugDraft, buildSafeSlug(title)),
        summary: settingsSummaryDraft || "",
        publishedAt: draftPublishedAt,
        coverImage: post.cover_image || null,
        enableComments: settingsEnableCommentsDraft,
        tags: postTags,
        content: draftContentForCompare || "",
      }),
    [
      buildSafeSlug,
      draftPublishedAt,
      draftContentForCompare,
      post.cover_image,
      postTags,
      settingsEnableCommentsDraft,
      settingsSlugDraft,
      settingsSummaryDraft,
      title,
    ],
  )

  const hasVersionableDraft = versionDraftSnapshot !== committedVersionSnapshot

  const flushVersionSettingsNow = useCallback(
    async (nextTitle: string) => {
      if (!isEditable || !post.id) return
      const nextSlug = buildSafeSlug(settingsSlugDraft, buildSafeSlug(nextTitle))
      if (
        (post.summary || "") === settingsSummaryDraft &&
        (post.slug || "") === nextSlug &&
        derefOptionalString(post.published_at) === derefOptionalString(draftPublishedAt) &&
        !!post.enable_comments === settingsEnableCommentsDraft
      ) {
        return
      }
      const updatedPost = await updatePost(post.id, {
        summary: settingsSummaryDraft,
        slug: nextSlug,
        published_at: draftPublishedAt ?? "",
        enable_comments: settingsEnableCommentsDraft,
      })
      setPost(updatedPost)
      setSettingsSummaryDraft(updatedPost.summary || "")
      setSettingsSlugDraft(updatedPost.slug || "")
      setSettingsEnableCommentsDraft(!!updatedPost.enable_comments)
      setIsPublished(!!updatedPost.published_at)
    },
    [
      buildSafeSlug,
      draftPublishedAt,
      isEditable,
      post.enable_comments,
      post.id,
      post.published_at,
      post.slug,
      post.summary,
      settingsEnableCommentsDraft,
      settingsSlugDraft,
      settingsSummaryDraft,
    ],
  )

  const handleEditorImageUpload = useCallback(
    async (file: File) => {
      if (!post.id) return ""
      return uploadToS3(file, { resourceType: "post", resourceID: post.id })
    },
    [post.id],
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
    if (!isEditable || !post.id) return null
    try {
      const {
        item: currentPost,
        currentVersion,
        latestVersion,
      } = await getPostVersioningState(post.id)
      const currentVersionContent = currentVersion.body_markdown || ""
      const currentText = contentToText(currentVersionContent)

      if (latestVersion) {
        const prevVersionContent = latestVersion.body_markdown || ""
        const prevText = contentToText(prevVersionContent)
        const similarity = textSimilarity(prevText, currentText)

        if (!options?.forceNewVersion && similarity >= SIMILARITY_THRESHOLD && currentVersion.id) {
          const isLiveSnapshot =
            !!currentPost.published_version_id &&
            currentVersion.id === currentPost.published_version_id

          if (!isLiveSnapshot) {
            const updatedVersionId = await updatePostVersionSnapshot(currentVersion.id, {
              title: currentVersion.title || currentPost.title || "Untitled",
              content: currentVersionContent,
              summary: currentVersion.summary || currentPost.summary || "",
              change_description: description || currentVersion.change_description,
            })
            await setPostCurrentVersion(
              post.id,
              updatedVersionId,
              currentVersion.title || currentPost.title || "Untitled",
              currentVersion.summary || currentPost.summary || "",
            )
            return updatedVersionId
          }
        }
      }

      // Big change or no previous version → create new version
      const nextNum = latestVersion ? latestVersion.version_number + 1 : 1
      const newVersionId = await createPostVersionFromSnapshot({
        postId: post.id,
        title: currentVersion.title || currentPost.title || "Untitled",
        content: currentVersionContent,
        summary: currentVersion.summary || currentPost.summary || "",
        changeDescription: description || `Version ${nextNum}`,
      })
      await setPostCurrentVersion(
        post.id,
        newVersionId,
        currentVersion.title || currentPost.title || "Untitled",
        currentVersion.summary || currentPost.summary || "",
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
    setVersionMessage(buildDefaultVersionMessage("post", title))
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
      const nextPost = settingsPublishedDraft ? await publishPost(post.id) : await unpublishPost(post.id)
      setPost(nextPost)
      setIsPublished(!!nextPost.published_at)
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

  // Delete post
  const handleDelete = async () => {
    if (isDeleting) return
    if (!confirm("Are you sure you want to delete this post? This cannot be undone.")) return
    setIsDeleting(true)
    try {
      await deletePost(post.id)
      router.push("/blog")
    } catch (err) {
      console.error("Delete failed:", err)
      toast({
        title: "게시글을 삭제하지 못했습니다",
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
      if (!isEditable || !post.id) return

      if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
      setSaveStatus("pending")
      titleSaveTimer.current = setTimeout(async () => {
        setSaveStatus("saving")
        try {
          await flushTitleNow(newTitle)
          setSaveStatus("saved")
        } catch {
          setSaveStatus("error")
        }
      }, 1000)
    },
    [isEditable, post.id, flushTitleNow],
  )

  // Tag management
  const handleAddTag = async (tag: Tag) => {
    if (postTags.find((t) => t.id === tag.id)) return
    setPostTags((prev) => [...prev, tag])
    try {
      await addPostTag(post.id, tag.id)
    } catch (err) {
      console.error("Failed to add tag:", err)
      toast({
        title: "태그를 추가하지 못했습니다",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
      setPostTags((prev) => prev.filter((t) => t.id !== tag.id))
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    const removed = postTags.find((t) => t.id === tagId)
    setPostTags((prev) => prev.filter((t) => t.id !== tagId))
    try {
      await removePostTag(post.id, tagId)
    } catch (err) {
      console.error("Failed to remove tag:", err)
      toast({
        title: "태그를 제거하지 못했습니다",
        description: err instanceof Error ? err.message : "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      })
      if (removed) setPostTags((prev) => [...prev, removed])
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
        const fileUrl = await uploadToS3(file, { resourceType: "post", resourceID: post.id })
        await recordPostImage(post.id, fileUrl, "cover")
        await updatePostCoverImage(post.id, fileUrl)

        setPost((prev) => ({ ...prev, cover_image: fileUrl }))
        setSaveStatus("saved")
      } catch {
        setSaveStatus("error")
      }
    }
    input.click()
  }

  const authorName = post.author?.full_name || "이름 없음"
  const publishedDate = post.published_at ? new Date(post.published_at) : new Date(post.created_at)
  const formattedDate = format(publishedDate, "yyyy.MM.dd")

  const availableTags = allTags.filter((t) => !postTags.find((pt) => pt.id === t.id))

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

  const openSettingsModal = () => {
    setSettingsSummaryDraft(post.summary || "")
    setSettingsSlugDraft(post.slug || buildSafeSlug(title))
    setSettingsEnableCommentsDraft(!!post.enable_comments)
    setSettingsPublishedDraft(isPublished)
    setShowSettingsModal(true)
  }

  const handleSaveSettings = async () => {
    if (!isEditable || isSavingSettings) return
    setIsSavingSettings(true)
    try {
      const updatedPost = await updatePost(post.id, {
        summary: settingsSummaryDraft,
        slug: buildSafeSlug(settingsSlugDraft, buildSafeSlug(title)),
        published_at: draftPublishedAt ?? "",
        enable_comments: settingsEnableCommentsDraft,
      })
      setIsPublished(!!updatedPost.published_at)
      setPost(updatedPost)
      setSettingsSlugDraft(updatedPost.slug || "")
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
        <PostReadOnlySkeleton
          post={post}
          displayTitle={displayTitle}
          authorName={authorName}
          formattedDate={formattedDate}
          postTags={postTags}
        />
      )
    }

    if (!displayContent) {
      return <PostNotPublishedState />
    }
  }

  return (
    <motion.div transition={MORPH_LAYOUT_TRANSITION} className="content-article container">
      {/* Back link */}
      <div className="content-article__backlink">
        <BackLink href={mode === "edit" ? "/blog" : "/blog"}>
          {mode === "edit" ? "관리 화면으로 돌아가기" : "전체 글로 돌아가기"}
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
            selectedTags={postTags}
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
          <PostVersionHistory
            postId={post.id}
            publishedVersionId={publishedVersionId}
            onVersionRestored={() => {
              setShowHistory(false)
              window.location.reload()
            }}
          />
        </div>
      )}

      {/* Cover image */}
      {post.cover_image && (
        <motion.div
          layoutId={`blog-image-${post.id}`}
          transition={MORPH_LAYOUT_TRANSITION}
          className="content-article__cover"
        >
          <Image
            src={post.cover_image}
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
          placeholder="게시글 제목…"
        />
      ) : (
        <motion.div layoutId={`blog-title-${post.id}`} transition={MORPH_LAYOUT_TRANSITION}>
          <h1 className="content-article__title">{displayTitle}</h1>
        </motion.div>
      )}

      {/* Author & meta info */}
      <PostMeta
        post={post}
        authorName={authorName}
        formattedDate={formattedDate}
        tags={postTags}
        className="content-article__meta"
      />

      <PostContentBody
        isEditable={isEditable}
        initialMarkdown={initialMarkdown}
        postId={post.id}
        onImageUpload={handleEditorImageUpload}
        onDraftChange={(markdown) => {
          currentContentRef.current = markdown
          setDraftContentForCompare(markdown)
          if (!post.id) return

          setSaveStatus("pending")
          if (contentSaveTimer.current) clearTimeout(contentSaveTimer.current)

          contentSaveTimer.current = setTimeout(() => {
            setSaveStatus("saving")
            savePostDraftContent(post.id, currentContentRef.current)
              .then(() => setSaveStatus("saved"))
              .catch(() => setSaveStatus("error"))
          }, 1000)
        }}
        motionProps={secondaryRevealMotion}
      />

      {/* Comments */}
      {post.enable_comments && !isEditable && (
        <motion.div {...secondaryRevealMotion}>
          <Comments postId={post.id} />
        </motion.div>
      )}

      <ContentSettingsDialog
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
        title="게시글 설정"
        slugInputId="post-settings-slug"
        slugValue={settingsSlugDraft}
        onSlugChange={setSettingsSlugDraft}
        slugPlaceholder="post-slug"
        urlPreview={`/blog/${buildSafeSlug(settingsSlugDraft, buildSafeSlug(title))}`}
        summaryValue={settingsSummaryDraft}
        onSummaryChange={setSettingsSummaryDraft}
        summaryPlaceholder="게시글 카드와 미리보기에 표시할 짧은 요약"
        summaryHint="저장하면 글 정보에 바로 반영됩니다."
        publicationSwitchId="post-settings-publication"
        isPublished={settingsPublishedDraft}
        onPublishedChange={setSettingsPublishedDraft}
        isSaving={isSavingSettings}
        onSave={handleSaveSettings}
        metadataChildren={
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label htmlFor="post-settings-comments" className="text-xs">
                댓글
              </Label>
              <p className="text-[11px] text-muted-foreground">
                공개 게시글 페이지에서 댓글을 허용합니다.
              </p>
            </div>
            <Switch
              id="post-settings-comments"
              checked={settingsEnableCommentsDraft}
              onCheckedChange={setSettingsEnableCommentsDraft}
            />
          </div>
        }
      />
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
