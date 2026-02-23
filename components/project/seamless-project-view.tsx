"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { BlockNoteEditor } from "./blocknote-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Check,
    Loader2,
    AlertCircle,
    GlobeLock,
    Tag as TagIcon,
    ImageIcon,
    X,
    Plus,
    History,
    Send,
    ChevronDown,
    Trash2,
    Settings,
    MessageSquare,
} from "lucide-react"
import {
    updateProject,
    addProjectTag,
    createProjectVersionFromSnapshot,
    deleteProject,
    getProjectPublishedVersion,
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
import Link from "next/link"
import { format } from "date-fns"
import { motion } from "framer-motion"
import { MORPH_LAYOUT_TRANSITION } from "@/lib/motion"
import { VersionHistory } from "./version-history"
import { textSimilarity, blocksToText, SIMILARITY_THRESHOLD } from "./blocknote-inner"
import { Label } from "@/components/ui/label"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
import { useNavigationIntent } from "@/components/navigation-intent-provider"

type SaveStatus = "idle" | "saving" | "saved" | "error"

type Props = {
    project: Project
    mode?: "view" | "edit"
}

export function SeamlessProjectView({ project: initialProject, mode = "view" }: Props) {
    const router = useRouter()
    const pathname = usePathname()
    const { getRecentIntent } = useNavigationIntent()
    const { user } = useAuth()
    const [project, setProject] = useState(initialProject)
    const [saveStatus, setSaveStatus] = useState<SaveStatus>(mode === "edit" ? "saved" : "idle")
    const [title, setTitle] = useState(project.title)
    const [summary, setSummary] = useState(project.summary || "")
    const [isPublished, setIsPublished] = useState(project.is_published)
    const [allTags, setAllTags] = useState<Tag[]>([])
    const [projectTags, setProjectTags] = useState<Tag[]>(project.tags || [])
    const [projectLinks, setProjectLinks] = useState(project.links || [])
    const [settingsSummaryDraft, setSettingsSummaryDraft] = useState(project.summary || "")

    const [settingsLinksDraft, setSettingsLinksDraft] = useState(project.links || [])
    const [newTagName, setNewTagName] = useState("")
    const [showHistory, setShowHistory] = useState(false)
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [isSavingVersion, setIsSavingVersion] = useState(false)
    const [isSavingSettings, setIsSavingSettings] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const titleSaveTimer = useRef<NodeJS.Timeout | null>(null)
    const autoVersionSaveTimer = useRef<NodeJS.Timeout | null>(null)
    const currentContentRef = useRef<string>(project.content || "")
    const [draftContentForCompare, setDraftContentForCompare] = useState(project.content || "")


    const [newLinkLabel, setNewLinkLabel] = useState("")
    const [newLinkUrl, setNewLinkUrl] = useState("")

    const isAuthor = user?.id === project.owner_id
    // edit mode requires being the author; view mode never enables editing
    const isEditable = mode === "edit" && isAuthor

    // Published version data (fetched for readers)
    const [publishedVersion, setPublishedVersion] = useState<{ title: string; content: string; summary?: string | null } | null>(null)
    const [publishedVersionLoading, setPublishedVersionLoading] = useState(mode === "view")
    const [deferSecondaryReveal, setDeferSecondaryReveal] = useState(false)

    // Fetch published version content for readers and draft-vs-published comparison in edit mode
    useEffect(() => {
        const pvId = (project as any).published_version_id
        if (!pvId || !project.is_published) {
            setPublishedVersionLoading(false)
            setPublishedVersion(null)
            return // No published version
        }

        setPublishedVersionLoading(true)
            ; (async () => {
                try {
                    const data = await getProjectPublishedVersion(pvId)
                    if (data) setPublishedVersion({ title: data.title, content: data.content || "[]", summary: data.summary })
                } catch {
                    // Published version fetch failed — will show "not published"
                } finally {
                    setPublishedVersionLoading(false)
                }
            })()
    }, [isEditable, project])

    // Author sees draft; reader sees published version ONLY (no draft fallback)
    const displayContent = isEditable ? project.content : publishedVersion?.content
    const displayTitle = isEditable ? title : (publishedVersion?.title || title)

    useEffect(() => {
        return () => {
            if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
            if (autoVersionSaveTimer.current) clearTimeout(autoVersionSaveTimer.current)
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
        (rawTitle: string) => {
            const slug = rawTitle
                .toLowerCase()
                .replace(/[^\w\s-]/gi, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-")
                .trim()
            return slug || project.slug || `project-${project.id.slice(0, 8)}`
        },
        [project.id, project.slug],
    )

    const flushTitleNow = useCallback(
        async (nextTitle: string) => {
            if (!isEditable || !project.id) return
            const slug = buildSafeSlug(nextTitle)
            await renameProject(project.id, nextTitle, slug)
            setProject((prev) => ({ ...prev, title: nextTitle, slug }))
        },
        [isEditable, project.id, buildSafeSlug],
    )

    const flushDraftContentNow = useCallback(async () => {
        if (!isEditable || !project.id) return
        await saveProjectDraftContent(project.id, currentContentRef.current || "[]")
    }, [isEditable, project.id])

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
        if (!isEditable || !project.id) return null
        try {
            if (!user?.id) throw new Error("No user")
            const { item: currentProject, currentVersion, latestVersion } = await getProjectVersioningState(project.id)
            const currentText = blocksToText(currentVersion.body_text || "[]")

            if (latestVersion) {
                const prevText = blocksToText(latestVersion.body_text || "[]")
                const similarity = textSimilarity(prevText, currentText)

                if (!options?.forceNewVersion && similarity >= SIMILARITY_THRESHOLD) {
                    const isPublishedSnapshot = !!currentProject.published_version_id && latestVersion.id === currentProject.published_version_id

                    if (!isPublishedSnapshot) {
                        // Small change → update existing latest version (only if it's not the published snapshot)
                        await updateProjectVersionSnapshot(latestVersion.id, {
                            title: currentVersion.title || currentProject.title || "Untitled",
                            content: currentVersion.body_text || "[]",
                            summary: currentVersion.summary || currentProject.summary || "",
                            change_description: description || latestVersion.change_description,
                        })
                        return latestVersion.id
                    }
                }
            }

            // Big change or no previous version → create new version
            const nextNum = latestVersion ? latestVersion.version_number + 1 : 1
            const newVersionId = await createProjectVersionFromSnapshot({
                projectId: project.id,
                versionNumber: nextNum,
                bodyFormat: currentVersion.body_format || "json",
                title: currentVersion.title || currentProject.title || "Untitled",
                content: currentVersion.body_text || "[]",
                summary: currentVersion.summary || currentProject.summary || "",
                createdBy: user.id,
                changeDescription: description || `Version ${nextNum}`,
                snapshotStatus: "draft",
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
            return null
        }
    }

    // Manual save version
    const handleSaveVersion = async () => {
        if (isSavingVersion) return
        if (autoVersionSaveTimer.current) clearTimeout(autoVersionSaveTimer.current)
        setIsSavingVersion(true)
        setSaveStatus("saving")

        try {
            if (titleSaveTimer.current) {
                clearTimeout(titleSaveTimer.current)
                titleSaveTimer.current = null
            }
            await flushTitleNow(title)
            await flushDraftContentNow()
        } catch (err) {
            console.error("Pre-save flush failed:", err)
            setSaveStatus("error")
            setIsSavingVersion(false)
            return
        }

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
            if (titleSaveTimer.current) {
                clearTimeout(titleSaveTimer.current)
                titleSaveTimer.current = null
            }
            await flushTitleNow(title)
            await flushDraftContentNow()

            // 1. Save version (returns the version ID)
            const versionId = await smartSaveVersion("Published")
            if (!versionId) throw new Error("Failed to save version")

            // 2. Point published_version_id to this version
            const { published_at: now } = await publishProject(project.id, versionId)

            setIsPublished(true)
            setProject((prev) => ({ ...prev, is_published: true, published_at: now, published_version_id: versionId } as any))
            setPublishedVersion((prev) => ({
                title,
                content: currentContentRef.current || prev?.content || "[]",
                summary,
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

    // Delete project
    const handleDelete = async () => {
        if (isDeleting) return
        if (!confirm("Are you sure you want to delete this project? This cannot be undone.")) return
        setIsDeleting(true)
        try {
            await deleteProject(project.id)
            router.push("/admin/projects")
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
            await unpublishProject(project.id)
            setIsPublished(false)
            setProject((prev) => ({ ...prev, is_published: false, published_at: null, published_version_id: null } as any))
            setSaveStatus("saved")
        } catch {
            setSaveStatus("error")
        }
    }

    // Auto-save title with debounce
    const handleTitleChange = useCallback(
        (newTitle: string) => {
            setTitle(newTitle)
            if (!isEditable || !project.id) return

            if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current)
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
                const fileName = `assets/${project.id}/cover.${file.name.split(".").pop()}`
                const contentType = file.type
                const { url, fileUrl } = await getPresignedUrl(fileName, contentType)
                await fetch(url, { method: "PUT", headers: { "Content-Type": contentType }, body: file })
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

    const authorName = project.owner?.full_name || "Anonymous"
    const publishedDate = project.published_at
        ? new Date(project.published_at)
        : new Date(project.created_at)
    const formattedDate = format(publishedDate, "MMMM d, yyyy")

    const availableTags = allTags.filter(
        (t) => !projectTags.find((pt) => pt.id === t.id),
    )

    const normalizedProjectLinksPayload = useMemo(
        () =>
            settingsLinksDraft.map((link) => ({
                label: (link.label || "").trim(),
                url: (link.url || "").trim(),
                link_type: link.link_type || undefined,
            })).filter((link) => link.label || link.url),
        [settingsLinksDraft],
    )

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
                id: `${project.id}:${Date.now()}`,
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
            prev
                .filter((_, i) => i !== index)
                .map((link, i) => ({ ...link, sort_order: i })),
        )
    }

    const openSettingsModal = () => {
        setSettingsSummaryDraft(summary)
        setSettingsLinksDraft(projectLinks)
        setNewLinkLabel("")
        setNewLinkUrl("")
        setShowSettingsModal(true)
    }

    const handleSaveSettings = async () => {
        if (!isEditable || isSavingSettings) return
        setIsSavingSettings(true)
        try {
            const updatedProject = await updateProject(
                project.id,
                {
                    summary: settingsSummaryDraft,
                },
                undefined,
                normalizedProjectLinksPayload,
            )
            setProject(updatedProject)
            setSummary(updatedProject.summary || "")

            setProjectLinks(updatedProject.links || [])
            setShowSettingsModal(false)
        } catch (error) {
            console.error("Failed to save settings:", error)
        } finally {
            setIsSavingSettings(false)
        }
    }

    // Non-author readers: show loading state or "not published" message
    if (!isEditable) {
        if (publishedVersionLoading) {
            return (
                <motion.div transition={MORPH_LAYOUT_TRANSITION} className="container max-w-4xl mx-auto py-8 md:py-12">
                    <div className="mb-6">
                        <Link href="/projects" className="text-sm text-muted-foreground hover:underline">
                            ← Back to all projects
                        </Link>
                    </div>

                    {project.cover_image && (
                        <motion.div
                            layoutId={`project-image-${project.id}`}
                            transition={MORPH_LAYOUT_TRANSITION}
                            className="mb-8 rounded-2xl overflow-hidden relative"
                        >
                            <img
                                src={project.cover_image}
                                alt={displayTitle}
                                className="w-full h-64 md:h-80 object-cover"
                            />
                            <div className="absolute inset-0 bg-background/15" />
                        </motion.div>
                    )}

                    <motion.div layoutId={`project-title-${project.id}`} transition={MORPH_LAYOUT_TRANSITION}>
                        <h1 className="text-3xl md:text-5xl font-bold mb-4">{displayTitle}</h1>
                    </motion.div>

                    <div className="flex flex-wrap items-center gap-4 mb-8">
                        <div className="flex items-center gap-2">
                            {project.owner?.avatar_url ? (
                                <img
                                    src={project.owner.avatar_url}
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

                        {projectTags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {projectTags.map((tag) => (
                                    <Badge key={tag.id} variant="secondary">
                                        {tag.name}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <Skeleton className="h-5 w-40" />
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-11/12" />
                            <Skeleton className="h-4 w-10/12" />
                            <Skeleton className="h-4 w-full" />
                        </div>
                        <Skeleton className="h-36 w-full rounded-xl" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Skeleton className="h-28 w-full rounded-xl" />
                            <Skeleton className="h-28 w-full rounded-xl" />
                        </div>
                    </div>

                    {projectLinks.length > 0 && (
                        <div className="mt-8 pt-6 border-t">
                            <h3 className="font-medium mb-3">Links</h3>
                            <div className="flex flex-wrap gap-2">
                                {projectLinks.map((link, index) => (
                                    <Button
                                        key={link.id || `${link.url}-${index}`}
                                        variant="outline"
                                        size="sm"
                                        asChild
                                    >
                                        <a href={link.url} target="_blank" rel="noopener noreferrer">
                                            {link.label || link.url}
                                        </a>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-12">
                        <Card className="bg-card/50 border border-border/50">
                            <CardHeader>
                                <CardTitle className="text-xl">Have a question about {displayTitle}?</CardTitle>
                                <CardDescription>
                                    Reach out if you want more details about the project.
                                </CardDescription>
                            </CardHeader>
                            <CardFooter>
                                <Button asChild>
                                    <Link href="/contact" className="flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        Get in touch
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                </motion.div>
            )
        }

        if (!displayContent) {
            // No published version available — don't expose draft
            return (
                <div className="container max-w-4xl mx-auto py-8 md:py-12 text-center">
                    <GlobeLock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <h1 className="text-2xl font-bold mb-2">Not Yet Published</h1>
                    <p className="text-muted-foreground">This project is still being worked on.</p>
                    <Link href="/projects" className="text-sm text-primary hover:underline mt-4 inline-block">
                        ← Back to all projects
                    </Link>
                </div>
            )
        }
    }

    return (
        <motion.div transition={MORPH_LAYOUT_TRANSITION} className="container max-w-4xl mx-auto py-8 md:py-12">
            {/* Back link */}
            <div className="mb-6">
                <Link
                    href={mode === "edit" ? "/admin/projects" : "/projects"}
                    className="text-sm text-muted-foreground hover:underline"
                >
                    {mode === "edit" ? "← Back to admin" : "← Back to all projects"}
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

                    <Button variant="ghost" size="sm" className="text-xs" onClick={openSettingsModal}>
                        <Settings className="h-3.5 w-3.5 mr-1" />
                        Settings
                    </Button>

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
                                    {projectTags.map((tag) => (
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
                        projectId={project.id}
                        publishedVersionId={(project as any).published_version_id || null}
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
                    className="mb-8 rounded-2xl overflow-hidden"
                >
                    <img
                        src={project.cover_image}
                        alt={title}
                        className="w-full h-64 md:h-80 object-cover"
                    />
                </motion.div>
            )}

            {/* Title — editable for author, static for viewers */}
            {isEditable ? (
                <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    className="w-full text-3xl md:text-5xl font-bold mb-4 bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50"
                    placeholder="Project title…"
                />
            ) : (
                <motion.div layoutId={`project-title-${project.id}`} transition={MORPH_LAYOUT_TRANSITION}>
                    <h1 className="text-3xl md:text-5xl font-bold mb-4">{displayTitle}</h1>
                </motion.div>
            )}

            {/* Author & meta info */}
            <motion.div className="flex flex-wrap items-center gap-4 mb-8" {...secondaryRevealMotion}>
                <div className="flex items-center gap-2">
                    {project.owner?.avatar_url ? (
                        <img
                            src={project.owner.avatar_url}
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

                {projectTags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {projectTags.map((tag) => (
                            <Badge
                                key={tag.id}
                                variant="secondary"
                                className="hover:bg-secondary/80 transition-colors"
                            >
                                {tag.name}
                            </Badge>
                        ))}
                    </div>
                )}
            </motion.div>

            {/* BlockNote editor/viewer */}
            <motion.div className="blocknote-seamless" {...secondaryRevealMotion}>
                <BlockNoteEditor
                    initialContent={initialBlocks}
                    editable={isEditable}
                    projectId={project.id}
                    onSaveStatusChange={setSaveStatus}
                    onAutosaveCommitted={() => {
                        if (!isEditable || isSavingVersion) return
                        if (autoVersionSaveTimer.current) clearTimeout(autoVersionSaveTimer.current)
                        autoVersionSaveTimer.current = setTimeout(() => {
                            smartSaveVersion("Auto save").catch(() => { })
                        }, 1500)
                    }}
                    onChange={(blocks) => {
                        const serialized = JSON.stringify(blocks)
                        currentContentRef.current = serialized
                        setDraftContentForCompare(serialized)
                    }}
                />
            </motion.div>

            {projectLinks.length > 0 && (
                <motion.div className="mt-8 pt-6 border-t" {...secondaryRevealMotion}>
                    <h3 className="font-medium mb-3">Links</h3>
                    <div className="flex flex-wrap gap-2">
                        {projectLinks.map((link, index) => (
                            <Button
                                key={link.id || `${link.url}-${index}`}
                                variant="outline"
                                size="sm"
                                asChild
                            >
                                <a href={link.url} target="_blank" rel="noopener noreferrer">
                                    {link.label || link.url}
                                </a>
                            </Button>
                        ))}
                    </div>
                </motion.div>
            )}

            {!isEditable && (
                <motion.div className="mt-12" {...secondaryRevealMotion}>
                    <Card className="bg-card/50 border border-border/50">
                        <CardHeader>
                            <CardTitle className="text-xl">Have a question about {displayTitle}?</CardTitle>
                            <CardDescription>
                                Reach out if you want more details about the project.
                            </CardDescription>
                        </CardHeader>
                        <CardFooter>
                            <Button asChild>
                                <Link href="/contact" className="flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    Get in touch
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                </motion.div>
            )}

            <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
                <DialogContent className="sm:max-w-xl bg-background/90 backdrop-blur-xl border-border/60">
                    <DialogHeader>
                        <DialogTitle>Project Settings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs">Summary</Label>
                            <Textarea
                                value={settingsSummaryDraft}
                                onChange={(e) => setSettingsSummaryDraft(e.target.value)}
                                placeholder="Short summary for project cards and previews"
                                className="min-h-20 text-sm"
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Metadata only. Saved immediately to the live project (not versioned).
                            </p>
                        </div>

                        <div className="space-y-2 border-t pt-3">
                            <Label className="text-xs">Links</Label>
                            <div className="space-y-2">
                                {settingsLinksDraft.length === 0 && (
                                    <p className="text-xs text-muted-foreground">No links added yet</p>
                                )}
                                {settingsLinksDraft.map((link, index) => (
                                    <div key={link.id || `${link.url}-${index}`} className="flex items-center gap-2">
                                        <div className="min-w-0 flex-1 rounded-md border px-2 py-1.5">
                                            <p className="text-xs font-medium truncate">{link.label || "Untitled link"}</p>
                                            <p className="text-[11px] text-muted-foreground truncate">{link.url}</p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => handleRemoveProjectLink(index)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <div className="space-y-2 rounded-md border p-2">
                                <Input
                                    value={newLinkLabel}
                                    onChange={(e) => setNewLinkLabel(e.target.value)}
                                    placeholder="Label (e.g. GitHub)"
                                    className="h-8 text-sm"
                                />
                                <div className="flex gap-2">
                                    <Input
                                        value={newLinkUrl}
                                        onChange={(e) => setNewLinkUrl(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleAddProjectLink()}
                                        placeholder="https://..."
                                        className="h-8 text-sm"
                                    />
                                    <Button type="button" variant="outline" size="sm" onClick={handleAddProjectLink} className="h-8">
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setShowSettingsModal(false)} disabled={isSavingSettings}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={handleSaveSettings} disabled={isSavingSettings}>
                            {isSavingSettings ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                "Save Settings"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </motion.div>
    )
}
