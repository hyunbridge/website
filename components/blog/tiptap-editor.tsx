"use client"

import type React from "react"

import { useState, useCallback, useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Image from "@tiptap/extension-image"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import { Markdown } from "tiptap-markdown"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { uploadToS3 } from "@/lib/s3-service"
import { recordPostImage } from "@/lib/blog-service"
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

interface TiptapEditorProps {
  content: string
  onChange: (content: string) => void
  postId?: string
  readOnly?: boolean
}

export function TiptapEditor({ content, onChange, postId, readOnly = false }: TiptapEditorProps) {
  const [activeTab, setActiveTab] = useState<string>("visual")
  const [markdownContent, setMarkdownContent] = useState<string>("")
  const [imageUrl, setImageUrl] = useState<string>("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageDialogOpen, setImageDialogOpen] = useState<boolean>(false)
  const [linkUrl, setLinkUrl] = useState<string>("")
  const [linkDialogOpen, setLinkDialogOpen] = useState<boolean>(false)
  const [isUploading, setIsUploading] = useState<boolean>(false)
  const [editorInitialized, setEditorInitialized] = useState<boolean>(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          HTMLAttributes: {
            class: "bg-muted p-2 rounded-md font-mono text-sm overflow-x-auto",
          },
        },
      }),
      Image,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: "Write something...",
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: "-",
        linkify: true,
      }),
    ],
    content: content || "",
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      const markdown = editor.storage.markdown.getMarkdown()
      onChange(html)
      setMarkdownContent(markdown)
    },
    onCreate: () => {
      setEditorInitialized(true)
    },
  })

  // Initialize content when editor is ready
  useEffect(() => {
    if (editor && content && editorInitialized) {
      try {
        // Check if content is HTML (starts with <) or Markdown
        if (content.trim().startsWith("<")) {
          editor.commands.setContent(content)
        } else {
          editor.commands.setContent(content, true) // Parse as Markdown
        }

        // Update markdown content
        if (editor.storage.markdown) {
          setMarkdownContent(editor.storage.markdown.getMarkdown())
        }
      } catch (error) {
        console.error("Error setting editor content:", error)
      }
    }
  }, [editor, content, editorInitialized])

  const handleMarkdownChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const markdown = e.target.value
      setMarkdownContent(markdown)

      if (editor) {
        try {
          // Parse markdown and update the editor
          editor.commands.setContent(markdown, true)
          onChange(editor.getHTML())
        } catch (error) {
          console.error("Error updating editor from markdown:", error)
        }
      }
    },
    [editor, onChange],
  )

  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value)

      if (value === "markdown" && editor) {
        try {
          // Get Markdown from the editor
          const markdown = editor.storage.markdown.getMarkdown()
          setMarkdownContent(markdown)
        } catch (error) {
          console.error("Error getting markdown from editor:", error)
        }
      } else if (value === "visual" && editor) {
        try {
          // Update the visual editor from Markdown
          editor.commands.setContent(markdownContent, true)
        } catch (error) {
          console.error("Error updating editor from markdown:", error)
        }
      }
    },
    [editor, markdownContent],
  )

  const handleImageUpload = useCallback(async () => {
    if (!imageFile || !postId) {
      console.error("Cannot upload image: No file or postId provided.");
      return;
    }

    try {
      setIsUploading(true);
      // Pass postId parameter
      const fileUrl = await uploadToS3(imageFile, postId);

      // Record the image in the database
      try {
        await recordPostImage(postId, fileUrl);
        console.log("Image has been recorded in the database.");
      } catch (recordError) {
        console.error("Error recording image in database:", recordError);
        console.log("Image will be displayed in the post but not recorded in the database.");
      }

      // Insert the image into the editor
      editor?.chain().focus().setImage({ src: fileUrl, alt: "Blog image" }).run();

      setImageDialogOpen(false);
      setImageFile(null);
      setImageUrl("");
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image.");
    } finally {
      setIsUploading(false);
    }
  }, [editor, imageFile, postId]);

  const handleImageUrlInsert = useCallback(() => {
    if (!imageUrl) return

    editor?.chain().focus().setImage({ src: imageUrl, alt: "Blog image" }).run()
    setImageDialogOpen(false)
    setImageUrl("")
  }, [editor, imageUrl])

  const handleLinkInsert = useCallback(() => {
    if (!linkUrl) return

    editor?.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run()
    setLinkDialogOpen(false)
    setLinkUrl("")
  }, [editor, linkUrl])
  if (readOnly) {
    return (
      <div className="p-4 prose dark:prose-invert max-w-none">
        <EditorContent editor={editor} className="outline-none" />
      </div>
    )
  }

  if (!editor) {
    return (
      <div className="border rounded-md p-4 flex items-center justify-center h-[300px]">
        <div className="animate-pulse">Loading editor...</div>
      </div>
    )
  }

  return (
    <div className="border rounded-md">
      {!readOnly && (
        <div className="border-b p-2 flex flex-wrap gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "bg-accent" : ""}
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? "bg-accent" : ""}
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive("heading", { level: 1 }) ? "bg-accent" : ""}
          >
            <Heading1 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive("heading", { level: 2 }) ? "bg-accent" : ""}
          >
            <Heading2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive("heading", { level: 3 }) ? "bg-accent" : ""}
          >
            <Heading3 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive("bulletList") ? "bg-accent" : ""}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive("orderedList") ? "bg-accent" : ""}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive("blockquote") ? "bg-accent" : ""}
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={editor.isActive("codeBlock") ? "bg-accent" : ""}
          >
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
            >
              <Redo className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      <Tabs value={activeTab} onValueChange={handleTabChange} className={readOnly ? "hidden" : ""}>
        <TabsList className="mx-2 mt-2">
          <TabsTrigger value="visual">Visual</TabsTrigger>
          <TabsTrigger value="markdown">Markdown</TabsTrigger>
        </TabsList>
        <TabsContent value="visual" className="p-4">
          <EditorContent editor={editor} className="prose dark:prose-invert max-w-none min-h-[300px]" />
        </TabsContent>
        <TabsContent value="markdown" className="p-4">
          <Textarea
            value={markdownContent}
            onChange={handleMarkdownChange}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Write markdown here..."
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
