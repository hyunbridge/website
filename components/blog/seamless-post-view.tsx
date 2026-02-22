"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { BlockNoteEditor } from "./blocknote-editor"
import { Comments } from "./comments"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Check,
    Loader2,
    AlertCircle,
    Globe,
    GlobeLock,
    Tag as TagIcon,
    ImageIcon,
    X,
    Plus,
    History,
    Send,
    ChevronDown,
    Trash2,
} from "lucide-react"
import {
    addPostTag,
    createPostVersionFromSnapshot,
    createTag,
    deletePost,
    getAllTags,
    getPostPublishedVersion,
    getPostVersioningState,
    publishPost,
    recordPostImage,
    removePostTag,
    renamePost,
    setPostCurrentVersion,
    type Tag,
    type Post,
    unpublishPost,
    updatePostCoverImage,
    updatePostVersionSnapshot,
} from "@/lib/blog-service"
import Link from "next/link"
import { format } from "date-fns"
import { VersionHistory } from "./version-history"
import { textSimilarity, blocksToText, SIMILARITY_THRESHOLD } from "./blocknote-inner"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getPresignedUrl } from "@/lib/s3-service"

type SaveStatus = "idle" | "saving" | "saved" | "error"

type Props = {
    post: Post
    mode?: "view" | "edit"
}

export function SeamlessPostView({ post: initialPost, mode = "view" }: Props) {
    const router = useRouter()
    const { user } = useAuth()
    const [post, setPost] = useState(initialPost)
    const [saveStatus, setSaveStatus] = useState<SaveStatus>(mode === "edit" ? "saved" : "idle")
    const [title, setTitle] = useState(post.title)
    const [isPublished, setIsPublished] = useState(post.is_published)
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [postTags, setPostTags] = useState<Tag[]>(post.tags || [])
    const [newTagName, setNewTagName] = useState("")
    const [showHistory, setShowHistory] = useState(false)
    const [isSavingVersion, setIsSavingVersion] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const titleSaveTimer = useRef<NodeJS.Timeout | null>(null)
    const autoVersionSaveTimer = useRef<NodeJS.Timeout | null>(null)
    const currentContentRef = useRef<string>(post.content || "")
    const [draftContentForCompare, setDraftContentForCompare] = useState(post.content || "")

    const isAuthor = user?.id === post.author_id
    // edit mode requires being the author; view mode never enables editing
    const isEditable = mode === "edit" && isAuthor

    // Published version data (fetched for readers)
    const [publishedVersion, setPublishedVersion] = useState<{ title: string; content: string; summary?: string | null } | null>(null)
    const [publishedVersionLoading, setPublishedVersionLoading] = useState(mode === "view")

    // Fetch published version content for readers and draft-vs-published comparison in edit mode
    useEffect(() => {
        const pvId = (post as any).published_version_id
        if (!pvId || !post.is_published) {
            setPublishedVersionLoading(false)
            setPublishedVersion(null)
            return // No published version
        }

        setPublishedVersionLoading(true)
            ; (async () => {
                try {
                    const data = await getPostPublishedVersion(pvId)
                    if (data) setPublishedVersion({ title: data.title, content: data.content || "[]", summary: data.summary })
                } catch {
                    // Published version fetch failed — will show "not published"
                } finally {
                    setPublishedVersionLoading(false)
                }
            })()
    }, [isEditable, post])

    // Author sees draft; reader sees published version ONLY (no draft fallback)
    const displayContent = isEditable ? post.content : publishedVersion?.content
    const displayTitle = isEditable ? title : (publishedVersion?.title || title)

    useEffect(() => {
        return () => {
            if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
            if (autoVersionSaveTimer.current) clearTimeout(autoVersionSaveTimer.current)
        }
    }, [])

    const initialBlocks = (() => {
        if (!displayContent) return undefined
        try {
            const parsed = JSON.parse(displayContent)
            return Array.isArray(parsed) ? parsed : undefined
        } catch {
            return undefined
        }
    })()

    // Fetch tags when author
    useEffect(() => {
        if (isEditable) {
            getAllTags().then(setAllTags).catch(console.error)
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
            if (!user?.id) throw new Error("No user")
            const { item: currentPost, currentVersion, latestVersion } = await getPostVersioningState(post.id)
            const currentText = blocksToText(currentVersion.body_text || "[]")

            if (latestVersion) {
                const prevText = blocksToText(latestVersion.body_text || "[]")
                const similarity = textSimilarity(prevText, currentText)

                if (!options?.forceNewVersion && similarity >= SIMILARITY_THRESHOLD) {
                    const isPublishedSnapshot = !!currentPost.published_version_id && latestVersion.id === currentPost.published_version_id

                    if (!isPublishedSnapshot) {
                        // Small change → update existing latest version (only if it's not the published snapshot)
                        await updatePostVersionSnapshot(latestVersion.id, {
                            title: currentVersion.title || currentPost.title || "Untitled",
                            content: currentVersion.body_text || "[]",
                            summary: currentVersion.summary || currentPost.summary || "",
                            change_description: description || latestVersion.change_description,
                        })
                        return latestVersion.id
                    }
                }
            }

            // Big change or no previous version → create new version
            const nextNum = latestVersion ? latestVersion.version_number + 1 : 1
            const newVersionId = await createPostVersionFromSnapshot({
                postId: post.id,
                versionNumber: nextNum,
                bodyFormat: currentVersion.body_format || "json",
                title: currentVersion.title || currentPost.title || "Untitled",
                content: currentVersion.body_text || "[]",
                summary: currentVersion.summary || currentPost.summary || "",
                createdBy: user.id,
                changeDescription: description || `Version ${nextNum}`,
                snapshotStatus: "draft",
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
            return null
        }
    }

    // Manual save version
    const handleSaveVersion = async () => {
        if (isSavingVersion) return
        if (autoVersionSaveTimer.current) clearTimeout(autoVersionSaveTimer.current)
        setIsSavingVersion(true)
        setSaveStatus("saving")
        const versionId = await smartSaveVersion("Manual save", { forceNewVersion: true })
        setSaveStatus(versionId ? "saved" : "error")
        setIsSavingVersion(false)
    }

    // Publish = save version + set published_version_id pointer
    const handlePublish = async () => {
        if (isSavingVersion) return
        if (autoVersionSaveTimer.current) clearTimeout(autoVersionSaveTimer.current)
        setIsSavingVersion(true)
        setSaveStatus("saving")
        try {
            // 1. Save version (returns the version ID)
            const versionId = await smartSaveVersion("Published")
            if (!versionId) throw new Error("Failed to save version")

            // 2. Point published_version_id to this version
            const { published_at: now } = await publishPost(post.id, versionId)

            setIsPublished(true)
            setPost((prev) => ({ ...prev, is_published: true, published_at: now, published_version_id: versionId } as any))
            setPublishedVersion((prev) => ({
                title,
                content: currentContentRef.current || prev?.content || "[]",
                summary: prev?.summary ?? null,
            }))
            setSaveStatus("saved")
        } catch (err) {
            console.error("Publish failed:", err)
            setSaveStatus("error")
        } finally {
            setIsSavingVersion(false)
        }
    }

    // Track if draft differs from published version
    const hasDraftChanges = useMemo(() => {
        if (!isPublished) return false // Not published, no comparison to make
        if (!publishedVersion) return true // Published but can't load version = assume changed
        const pubText = blocksToText(publishedVersion.content || "[]")
        const draftText = blocksToText(draftContentForCompare || "[]")
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
            router.push("/admin/blog/posts")
        } catch (err) {
            console.error("Delete failed:", err)
            setIsDeleting(false)
        }
    }

    // Unpublish — clear pointer and is_published
    const handleUnpublish = async () => {
        if (autoVersionSaveTimer.current) clearTimeout(autoVersionSaveTimer.current)
        setSaveStatus("saving")
        try {
            await unpublishPost(post.id)
            setIsPublished(false)
            setPost((prev) => ({ ...prev, is_published: false, published_at: null, published_version_id: null } as any))
            setSaveStatus("saved")
        } catch {
            setSaveStatus("error")
        }
    }

    // Auto-save title with debounce
    const handleTitleChange = useCallback(
        (newTitle: string) => {
            setTitle(newTitle)
            if (!isEditable || !post.id) return

            if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
            titleSaveTimer.current = setTimeout(async () => {
                setSaveStatus("saving")
                try {
                    // Generate slug from title
                    const slug = newTitle
                        .toLowerCase()
                        .replace(/[^\w\s-]/gi, "")
                        .replace(/\s+/g, "-")
                        .replace(/-+/g, "-")
                        .trim()

                    await renamePost(post.id, newTitle, slug)
                    setSaveStatus("saved")
                } catch {
                    setSaveStatus("error")
                }
            }, 1000)
        },
        [isEditable, post.id],
    )

    // Tag management
    const handleAddTag = async (tag: Tag) => {
        if (postTags.find((t) => t.id === tag.id)) return
        setPostTags((prev) => [...prev, tag])
        try {
            await addPostTag(post.id, tag.id)
        } catch (err) {
            console.error("Failed to add tag:", err)
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
                const fileName = `assets/${post.id}/cover.${file.name.split(".").pop()}`
                const contentType = file.type
                const { url, fileUrl } = await getPresignedUrl(fileName, contentType)
                await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: file })
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

    const authorName = post.author?.full_name || "Anonymous"
    const publishedDate = post.published_at
        ? new Date(post.published_at)
        : new Date(post.created_at)
    const formattedDate = format(publishedDate, "MMMM d, yyyy")

    const availableTags = allTags.filter(
        (t) => !postTags.find((pt) => pt.id === t.id),
    )

    // Non-author readers: show loading state or "not published" message
    if (!isEditable) {
        if (publishedVersionLoading) {
            return (
                <div className="container max-w-4xl mx-auto py-8 md:py-12">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-muted rounded w-3/4" />
                        <div className="h-4 bg-muted rounded w-1/4" />
                        <div className="space-y-2 mt-8">
                            <div className="h-4 bg-muted rounded w-full" />
                            <div className="h-4 bg-muted rounded w-5/6" />
                            <div className="h-4 bg-muted rounded w-4/6" />
                        </div>
                    </div>
                </div>
            )
        }

        if (!displayContent) {
            // No published version available — don't expose draft
            return (
                <div className="container max-w-4xl mx-auto py-8 md:py-12 text-center">
                    <GlobeLock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h1 className="text-2xl font-bold mb-2">Not Yet Published</h1>
                    <p className="text-muted-foreground">This post is still being worked on.</p>
                    <Link href="/blog" className="text-sm text-primary hover:underline mt-4 inline-block">
                        ← Back to all posts
                    </Link>
                </div>
            )
        }
    }

    return (
        <div className="container max-w-4xl mx-auto py-8 md:py-12">
            {/* Back link */}
            <div className="mb-6">
                <Link
                    href={mode === "edit" ? "/admin/blog/posts" : "/blog"}
                    className="text-sm text-muted-foreground hover:underline"
                >
                    {mode === "edit" ? "← Back to admin" : "← Back to all posts"}
                </Link>
            </div>

            {/* Author edit toolbar */}
            {isEditable && (
                <div className="mb-6 flex flex-wrap items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
                    {/* Save status — clickable for manual save */}
                    <button
                        onClick={handleSaveVersion}
                        disabled={isSavingVersion || saveStatus === "saving"}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:cursor-default"
                    >
                        {saveStatus === "saving" && (
                            <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Saving…</span>
                            </>
                        )}
                        {saveStatus === "saved" && (
                            <>
                                <Check className="h-3 w-3 text-green-500" />
                                <span>Saved</span>
                            </>
                        )}
                        {saveStatus === "error" && (
                            <>
                                <AlertCircle className="h-3 w-3 text-destructive" />
                                <span>Error saving</span>
                            </>
                        )}
                        {saveStatus === "idle" && (
                            <span className="text-muted-foreground/60">Draft</span>
                        )}
                    </button>

                    <div className="flex-1" />

                    {/* Cover image */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleCoverImageUpload}
                        className="text-xs"
                    >
                        <ImageIcon className="h-3.5 w-3.5 mr-1" />
                        Cover
                    </Button>

                    {/* Tags popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-xs">
                                <TagIcon className="h-3.5 w-3.5 mr-1" />
                                Tags
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72">
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-1.5">
                                    {postTags.map((tag) => (
                                        <Badge
                                            key={tag.id}
                                            variant="secondary"
                                            className="gap-1 cursor-pointer"
                                            onClick={() => handleRemoveTag(tag.id)}
                                        >
                                            {tag.name}
                                            <X className="h-3 w-3" />
                                        </Badge>
                                    ))}
                                </div>
                                <div className="border-t pt-2 space-y-2">
                                    {availableTags.map((tag) => (
                                        <button
                                            key={tag.id}
                                            onClick={() => handleAddTag(tag)}
                                            className="block w-full text-left text-sm px-2 py-1 rounded hover:bg-muted transition-colors"
                                        >
                                            {tag.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2 border-t pt-2">
                                    <Input
                                        placeholder="New tag…"
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                                        className="h-8 text-sm"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleCreateTag}
                                        className="h-8"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Version history */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowHistory(!showHistory)}
                        className="text-xs"
                    >
                        <History className="h-3.5 w-3.5 mr-1" />
                        History
                    </Button>

                    {/* Publish / Update with dropdown */}
                    <div className="flex items-center">
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handlePublish}
                            disabled={isSavingVersion || (isPublished && !hasDraftChanges)}
                            className="text-xs gap-1.5 rounded-r-none"
                        >
                            <Send className="h-3.5 w-3.5" />
                            {isSavingVersion
                                ? "Publishing…"
                                : isPublished
                                    ? hasDraftChanges
                                        ? "Update"
                                        : "Published"
                                    : "Publish"}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="px-1.5 rounded-l-none border-l border-primary-foreground/20"
                                >
                                    <ChevronDown className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                {isPublished && (
                                    <DropdownMenuItem
                                        onClick={handleUnpublish}
                                        className="text-sm gap-2"
                                    >
                                        <GlobeLock className="h-3.5 w-3.5" />
                                        Unpublish
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    onClick={handleDelete}
                                    className="text-sm gap-2 text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            )}

            {/* Version history panel */}
            {isEditable && showHistory && (
                <div className="mb-6">
                    <VersionHistory
                        postId={post.id}
                        publishedVersionId={(post as any).published_version_id || null}
                        onVersionRestored={() => {
                            setShowHistory(false)
                            window.location.reload()
                        }}
                    />
                </div>
            )}

            {/* Cover image */}
            {post.cover_image && (
                <div className="mb-8 rounded-2xl overflow-hidden">
                    <img
                        src={post.cover_image}
                        alt={title}
                        className="w-full h-64 md:h-80 object-cover"
                    />
                </div>
            )}

            {/* Title — editable for author, static for viewers */}
            {isEditable ? (
                <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full text-3xl md:text-5xl font-bold mb-4 bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50"
                    placeholder="Post title…"
                />
            ) : (
                <h1 className="text-3xl md:text-5xl font-bold mb-4">{displayTitle}</h1>
            )}

            {/* Author & meta info */}
            <div className="flex flex-wrap items-center gap-4 mb-8">
                <div className="flex items-center gap-2">
                    {post.author?.avatar_url ? (
                        <img
                            src={post.author.avatar_url}
                            alt={authorName}
                            className="w-8 h-8 rounded-full"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                            {authorName[0]?.toUpperCase()}
                        </div>
                    )}
                    <span className="text-sm">{authorName}</span>
                </div>

                <span className="text-sm text-muted-foreground">{formattedDate}</span>

                {postTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {postTags.map((tag) => (
                            <Link key={tag.id} href={`/blog/tags/${tag.id}`}>
                                <Badge
                                    variant="secondary"
                                    className="hover:bg-secondary/80 transition-colors"
                                >
                                    {tag.name}
                                </Badge>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* BlockNote editor/viewer */}
            <div className="blocknote-seamless">
                <BlockNoteEditor
                    initialContent={initialBlocks}
                    editable={isEditable}
                    postId={post.id}
                    onSaveStatusChange={setSaveStatus}
                    onAutosaveCommitted={() => {
                        if (!isEditable || isSavingVersion) return
                        if (autoVersionSaveTimer.current) clearTimeout(autoVersionSaveTimer.current)
                        autoVersionSaveTimer.current = setTimeout(() => {
                            smartSaveVersion("Auto save").catch(() => {})
                        }, 1500)
                    }}
                    onChange={(blocks) => {
                        const serialized = JSON.stringify(blocks)
                        currentContentRef.current = serialized
                        setDraftContentForCompare(serialized)
                    }}
                />
            </div>

            {/* Comments */}
            {post.enable_comments && !isEditable && <Comments postId={post.id} />}
        </div>
    )
}
