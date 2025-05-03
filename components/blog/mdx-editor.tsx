"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { uploadToS3 } from "@/lib/s3-service"
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  LinkIcon,
  Code,
  Undo,
  Redo,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import rehypeStringify from "rehype-stringify"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"

interface MDXEditorProps {
  content: string
  onChange: (content: string) => void
  postId?: string
  readOnly?: boolean
}

export function MDXEditor({ content, onChange, postId, readOnly = false }: MDXEditorProps) {
  const [activeTab, setActiveTab] = useState<string>("edit")
  const [markdownContent, setMarkdownContent] = useState<string>(content || "")
  const [renderedHTML, setRenderedHTML] = useState<string>("")
  const [imageUrl, setImageUrl] = useState<string>("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageDialogOpen, setImageDialogOpen] = useState<boolean>(false)
  const [linkUrl, setLinkUrl] = useState<string>("")
  const [linkText, setLinkText] = useState<string>("")
  const [linkDialogOpen, setLinkDialogOpen] = useState<boolean>(false)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Initialize content when component mounts
  useEffect(() => {
    setMarkdownContent(content || "")
    renderMarkdown(content || "")
  }, [content])

  // Render markdown to HTML using remark
  const renderMarkdown = async (markdown: string) => {
    try {
      const result = await unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(remarkRehype)
        .use(rehypeSanitize)
        .use(rehypeStringify)
        .process(markdown)

      setRenderedHTML(String(result))
    } catch (error) {
      console.error("Error rendering markdown:", error)
      setRenderedHTML(`<p>Error rendering markdown</p>`)
    }
  }

  const handleMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setMarkdownContent(newContent)
    onChange(newContent)
    renderMarkdown(newContent)
  }

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    if (value === "preview") {
      renderMarkdown(markdownContent)
    }
  }

  const insertTextAtCursor = (textBefore: string, textAfter = "") => {
    if (readOnly) return

    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = markdownContent.substring(start, end)
    const newText =
      markdownContent.substring(0, start) + textBefore + selectedText + textAfter + markdownContent.substring(end)

    setMarkdownContent(newText)
    onChange(newText)
    renderMarkdown(newText)

    // Set cursor position after the inserted text
    setTimeout(() => {
      textarea.focus()
      const newPosition = start + textBefore.length + selectedText.length
      textarea.setSelectionRange(newPosition, newPosition)
    }, 0)
  }

  const handleBoldClick = () => insertTextAtCursor("**", "**")
  const handleItalicClick = () => insertTextAtCursor("*", "*")
  const handleH1Click = () => insertTextAtCursor("# ")
  const handleH2Click = () => insertTextAtCursor("## ")
  const handleH3Click = () => insertTextAtCursor("### ")
  const handleBulletListClick = () => insertTextAtCursor("- ")
  const handleOrderedListClick = () => insertTextAtCursor("1. ")
  const handleQuoteClick = () => insertTextAtCursor("> ")
  const handleCodeClick = () => insertTextAtCursor("```\n", "\n```")

  const handleImageUpload = async () => {
    if (!imageFile || !postId) return

    try {
      setIsUploading(true)
      // Record is created inside uploadToS3, no extra call needed
      const fileUrl = await uploadToS3(imageFile, postId)

      // Insert the image markdown
      insertTextAtCursor(`![Image](${fileUrl})`)

      setImageDialogOpen(false)
      setImageFile(null)
      setImageUrl("")
    } catch (error) {
      console.error("Error uploading image:", error)
      alert("Failed to upload image")
    } finally {
      setIsUploading(false)
    }
  }

  const handleImageUrlInsert = () => {
    if (!imageUrl) return

    insertTextAtCursor(`![Image](${imageUrl})`)
    setImageDialogOpen(false)
    setImageUrl("")
  }

  const handleLinkInsert = () => {
    if (!linkUrl) return

    const linkMarkdown = linkText ? `[${linkText}](${linkUrl})` : `[${linkUrl}](${linkUrl})`
    insertTextAtCursor(linkMarkdown)
    setLinkDialogOpen(false)
    setLinkUrl("")
    setLinkText("")
  }

  const handleUndo = () => {
    document.execCommand("undo")
  }

  const handleRedo = () => {
    document.execCommand("redo")
  }

  if (readOnly) {
    return <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderedHTML }} />
  }

  return (
    <div className="border rounded-md">
      <div className="border-b p-2 flex flex-wrap gap-1">
        <Button variant="ghost" size="icon" onClick={handleBoldClick}>
          <Bold className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleItalicClick}>
          <Italic className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleH1Click}>
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleH2Click}>
          <Heading2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleH3Click}>
          <Heading3 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleBulletListClick}>
          <List className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleOrderedListClick}>
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleQuoteClick}>
          <Quote className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleCodeClick}>
          <Code className="h-4 w-4" />
        </Button>
        <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <ImageIcon className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Insert Image</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="image-url">Image URL</Label>
                <Input
                  id="image-url"
                  placeholder="https://example.com/image.jpg"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
                <Button onClick={handleImageUrlInsert} disabled={!imageUrl} className="mt-2">
                  Insert URL
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="image-upload">Or upload an image</Label>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                />
                <Button onClick={handleImageUpload} disabled={!imageFile || !postId || isUploading} className="mt-2">
                  {isUploading ? "Uploading..." : "Upload & Insert"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon">
              <LinkIcon className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Insert Link</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="link-text">Link Text</Label>
                <Input
                  id="link-text"
                  placeholder="Click here"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="link-url">URL</Label>
                <Input
                  id="link-url"
                  placeholder="https://example.com"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleLinkInsert} disabled={!linkUrl}>
                Insert
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleUndo}>
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleRedo}>
            <Redo className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="mx-2 mt-2">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="p-4">
          <Textarea
            ref={textareaRef}
            value={markdownContent}
            onChange={handleMarkdownChange}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Write your content in Markdown..."
          />
        </TabsContent>
        <TabsContent value="preview" className="p-4">
          <div className="prose dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderedHTML }} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function MDXEditorSkeleton() {
  return (
    <div className="border rounded-md">
      <div className="border-b p-2">
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="p-4">
        <Skeleton className="h-[300px] w-full" />
      </div>
    </div>
  )
}
