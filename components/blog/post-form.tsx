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
import { X, Plus, ImageIcon } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

interface PostFormProps {
  post?: Post
  isEdit?: boolean
}

export function PostForm({ post, isEdit = false }: PostFormProps) {
  const router = useRouter()
  const { user } = useAuth()

  const [title, setTitle] = useState<string>(post?.title || "")
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
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isCoverImageUploading, setIsCoverImageUploading] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<string>("content")
  const [errors, setErrors] = useState<Record<string, string>>({})

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
      const fileUrl = await uploadToS3(coverImageFile)
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

    setIsLoading(true)

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
        await updatePost(post.id, postData, tagIds)
      } else {
        await createPost(postData, tagIds)
      }

      router.push("/admin/blog/posts")
      router.refresh()
    } catch (error) {
      console.error("Error saving post:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Edit Post" : "Create New Post"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="seo">SEO & Meta</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={handleTitleChange}
                  className={errors.title ? "border-destructive" : ""}
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Slug</Label>
                <div className="flex gap-2">
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className={errors.slug ? "border-destructive" : ""}
                  />
                  <Button type="button" variant="outline" onClick={generateSlug}>
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
                <Label>Content</Label>
                <TiptapEditor content={content} onChange={setContent} postId={post?.id} />
                {errors.content && <p className="text-sm text-destructive">{errors.content}</p>}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
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
                  >
                    {isCoverImageUploading ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </div>

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
                      <Button type="button" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        New Tag
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

            <TabsContent value="seo" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meta-title">Meta Title</Label>
                <Input
                  id="meta-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Same as post title by default"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meta-description">Meta Description</Label>
                <Textarea
                  id="meta-description"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Same as post summary by default"
                />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : isEdit ? "Update Post" : "Create Post"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}

