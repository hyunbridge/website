"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { type Post, type Tag, createPost, updatePost, getAllTags, createTag } from "@/lib/blog-service"
import { uploadToS3 } from "@/lib/s3-service"
import { TiptapEditor } from "./tiptap-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DeletePostButton } from "./delete-post-button"
import { X, Plus, ImageIcon, Save, Eye, Calendar, TagIcon } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { format } from "date-fns"
import { useBeforeUnload } from "@/hooks/use-before-unload"

interface PostEditorProps {
  post?: Post
  isEdit?: boolean
  isLoading?: boolean
  enableVersioning?: boolean
  isNew?: boolean
}

export function PostEditor({
  post,
  isEdit = false,
  isLoading = false,
  enableVersioning = false,
  isNew = false,
}: PostEditorProps) {
  const router = useRouter()
  const { user } = useAuth()

  // If isNew is true, clear the title
  const [title, setTitle] = useState<string>(isNew ? "" : post?.title || "")
  const [slug, setSlug] = useState<string>(post?.slug || "")
  const [summary, setSummary] = useState<string>(post?.summary || "")
  const [content, setContent] = useState<string>(post?.content || "")
  const [coverImage, setCoverImage] = useState<string>(post?.cover_image || "")
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null)
  const [isPublished, setIsPublished] = useState<boolean>(post?.is_published || false)
  const [publishedAt, setPublishedAt] = useState<string>(
    post?.published_at
      ? new Date(post.published_at).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  )
  const [enableComments, setEnableComments] = useState<boolean>(post?.enable_comments || true)
  const [selectedTags, setSelectedTags] = useState<Tag[]>(post?.tags || [])
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [newTagName, setNewTagName] = useState<string>("")
  const [isTagDialogOpen, setIsTagDialogOpen] = useState<boolean>(false)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isCoverImageUploading, setIsCoverImageUploading] = useState<boolean>(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<string>("metadata")
  const [createdPostId, setCreatedPostId] = useState<string | null>(null)

  // Add warning when leaving the page with unsaved changes
  useBeforeUnload(
    // Only show warning if there are unsaved changes
    title !== post?.title ||
      slug !== post?.slug ||
      summary !== post?.summary ||
      content !== post?.content ||
      coverImage !== post?.cover_image ||
      isPublished !== post?.is_published ||
      enableComments !== post?.enable_comments,
  )

  // Update state when post data changes
  useEffect(() => {
    if (post) {
      // If isNew is true, clear the title, otherwise use post.title
      setTitle(isNew ? "" : post.title || "")
      setSlug(post.slug || "")
      setSummary(post.summary || "")
      setContent(post.content || "")
      setCoverImage(post.cover_image || "")
      setIsPublished(post.is_published || false)
      setPublishedAt(
        post.published_at
          ? new Date(post.published_at).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      )
      setEnableComments(post.enable_comments || true)
      setSelectedTags(post.tags || [])
    }
  }, [post, isNew])

  useEffect(() => {
    async function fetchTags() {
      try {
        const tags = await getAllTags()
        setAvailableTags(tags)
      } catch (error) {
        console.error("Error fetching tags:", error)
      }
    }

    fetchTags()
  }, [])

  const generateSlug = () => {
    const slugValue = title
      .toLowerCase()
      .replace(/[^\w\s]/gi, "")
      .replace(/\s+/g, "-")

    setSlug(slugValue)
  }

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    if (!isEdit || !post?.slug) {
      // Auto-generate slug from title if not in edit mode or if no slug exists
      const slugValue = e.target.value
        .toLowerCase()
        .replace(/[^\w\s]/gi, "")
        .replace(/\s+/g, "-")

      setSlug(slugValue)
    }
  }

  const handleTagSelect = (tagId: string) => {
    const tag = availableTags.find((t) => t.id === tagId)
    if (tag && !selectedTags.some((t) => t.id === tag.id)) {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const handleTagRemove = (tagId: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag.id !== tagId))
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return

    try {
      const newTag = await createTag(newTagName)
      setAvailableTags([...availableTags, newTag])
      setSelectedTags([...selectedTags, newTag])
      setNewTagName("")
      setIsTagDialogOpen(false)
    } catch (error) {
      console.error("Error creating tag:", error)
    }
  }

  const handleCoverImageUpload = async () => {
    if (!coverImageFile) return

    try {
      setIsCoverImageUploading(true)
      // post.id가 항상 존재하게 됨
      const fileUrl = await uploadToS3(coverImageFile, post?.id || "")
      setCoverImage(fileUrl)
      setCoverImageFile(null)
    } catch (error) {
      console.error("Error uploading cover image:", error)
    } finally {
      setIsCoverImageUploading(false)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!title) newErrors.title = "Title is required"
    if (!slug) newErrors.slug = "Slug is required"
    if (!summary) newErrors.summary = "Summary is required"
    if (!content) newErrors.content = "Content is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return
    if (!user) return

    setIsSaving(true)

    try {
      const postData = {
        title,
        slug,
        content,
        author_id: user.id,
        summary,
        cover_image: coverImage,
        is_published: isPublished,
        published_at: isPublished ? publishedAt : null,
        enable_comments: enableComments,
      }

      const tagIds = selectedTags.map((tag) => tag.id)

      if (isEdit && post) {
        await updatePost(
          post.id,
          postData,
          tagIds,
          enableVersioning,
          user.id,
          `Manual update by ${user.email}`,
        )
      } else if (createdPostId) {
        // If temporary post already exists, update it
        await updatePost(
          createdPostId,
          postData,
          tagIds,
          false,
          user.id,
          `Initial creation by ${user.email}`,
        )
      } else {
        // If no temporary post exists (should not happen)
        const newPost = await createPost(postData, tagIds)
        setCreatedPostId(newPost.id)
      }

      router.push("/admin/blog/posts")
      router.refresh()
    } catch (error) {
      console.error("Error saving post:", error)
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <PostEditorSkeleton />
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content panel */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={handleTitleChange}
                placeholder={isNew ? "Enter post title..." : "Post title"}
                className={errors.title ? "border-destructive" : ""}
              />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Content</Label>
              <TiptapEditor content={content} onChange={setContent} postId={post?.id || ""} />
              {errors.content && <p className="text-sm text-destructive">{errors.content}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sidebar panel */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Post Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="metadata">
                  <span className="flex items-center gap-1">
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Metadata</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger value="publish">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span className="hidden sm:inline">Publish</span>
                  </span>
                </TabsTrigger>
                <TabsTrigger value="tags">
                  <span className="flex items-center gap-1">
                    <TagIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Tags</span>
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="metadata" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <div className="flex gap-2">
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className={errors.slug ? "border-destructive" : ""}
                    />
                    <Button type="button" variant="outline" onClick={generateSlug} size="sm">
                      Generate
                    </Button>
                  </div>
                  {errors.slug && <p className="text-sm text-destructive">{errors.slug}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">Summary</Label>
                  <Textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className={errors.summary ? "border-destructive" : ""}
                  />
                  {errors.summary && <p className="text-sm text-destructive">{errors.summary}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Cover Image</Label>
                  {coverImage && (
                    <div className="relative w-full h-48 mb-2">
                      <img
                        src={coverImage || "/placeholder.svg"}
                        alt="Cover"
                        className="w-full h-full object-cover rounded-md"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => setCoverImage("")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {!coverImage && (
                    <div className="border border-dashed rounded-md p-4 text-center">
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">No cover image selected</p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCoverImageFile(e.target.files?.[0] || null)}
                    />
                    <Button
                      type="button"
                      onClick={handleCoverImageUpload}
                      disabled={!coverImageFile || isCoverImageUploading}
                      size="sm"
                    >
                      {isCoverImageUploading ? "Uploading..." : "Upload"}
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="publish" className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="published">Published</Label>
                    <Switch id="published" checked={isPublished} onCheckedChange={setIsPublished} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isPublished ? "This post is visible to everyone" : "This post is a draft"}
                  </p>
                </div>

                {isPublished && (
                  <div className="space-y-2">
                    <Label htmlFor="published-date">Publish Date</Label>
                    <Input
                      id="published-date"
                      type="date"
                      value={publishedAt}
                      onChange={(e) => setPublishedAt(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      {publishedAt
                        ? `Will be published on ${format(new Date(publishedAt), "MMMM d, yyyy")}`
                        : "Select a date"}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="comments">Enable Comments</Label>
                    <Switch id="comments" checked={enableComments} onCheckedChange={setEnableComments} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {enableComments ? "Comments are enabled for this post" : "Comments are disabled for this post"}
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="tags" className="space-y-4">
                <div className="space-y-2">
                  <Label>Tags</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedTags.map((tag) => (
                      <Badge key={tag.id} variant="secondary" className="flex items-center gap-1">
                        {tag.name}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0"
                          onClick={() => handleTagRemove(tag.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                    {selectedTags.length === 0 && <p className="text-sm text-muted-foreground">No tags selected</p>}
                  </div>
                  <div className="flex gap-2">
                    <Select onValueChange={handleTagSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a tag" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableTags
                          .filter((tag) => !selectedTags.some((t) => t.id === tag.id))
                          .map((tag) => (
                            <SelectItem key={tag.id} value={tag.id}>
                              {tag.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
                      <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="icon">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create New Tag</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="tag-name">Tag Name</Label>
                            <Input id="tag-name" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="button" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                            Create
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="flex justify-between w-full">
              <Button onClick={handleSubmit} disabled={isSaving} className="gap-2">
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : isEdit ? "Update" : "Publish"}
              </Button>
              {isEdit && post && <DeletePostButton postId={post.id} postTitle={post.title} />}
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

function PostEditorSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main content skeleton */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <Skeleton className="h-10 w-full" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[500px] w-full" />
          </CardContent>
        </Card>
      </div>

      {/* Sidebar skeleton */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-40" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-24 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-48 w-full" />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <div className="flex justify-between w-full">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
