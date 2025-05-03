"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { PostEditor } from "@/components/blog/post-editor"
import { VersionHistory } from "@/components/blog/version-history"
import { getPostById } from "@/lib/blog-service"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function EditPostPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNewPost = searchParams?.get("isNew") === "true"
  const [post, setPost] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [activeTab, setActiveTab] = useState("edit")

  useEffect(() => {
    async function fetchPost() {
      if (!params.id) return

      setIsLoading(true)
      try {
        const postData = await getPostById(params.id)
        console.log("Fetched post data:", postData)
        setPost(postData)
      } catch (err) {
        console.error("Error fetching post:", err)
        setError("Failed to load post")
      } finally {
        setIsLoading(false)
      }
    }

    fetchPost()
  }, [params.id])

  const handleVersionRestored = async () => {
    // Reload the post after a version is restored
    if (!params.id) return

    setIsLoading(true)
    try {
      const postData = await getPostById(params.id)
      setPost(postData)
      setActiveTab("edit") // Switch back to edit tab
    } catch (err) {
      console.error("Error fetching post after version restore:", err)
      setError("Failed to load updated post")
    } finally {
      setIsLoading(false)
    }
  }

  if (error) {
    return (
      <div>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col mb-8">
        <h1 className="text-3xl font-bold">{isNewPost ? "Create Post" : "Edit Post"}</h1>
        <Link href="/admin/blog/posts" className="text-sm text-muted-foreground hover:underline mt-2">
          ← Back to post list
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="edit">{isNewPost ? "Create Post" : "Edit Post"}</TabsTrigger>
          {!isNewPost && <TabsTrigger value="history">Version History</TabsTrigger>}
        </TabsList>

        <TabsContent value="edit">
          <PostEditor post={post} isEdit isLoading={isLoading} enableVersioning={!isNewPost} isNew={isNewPost} />
        </TabsContent>

        {!isNewPost && (
          <TabsContent value="history">
            {post && <VersionHistory postId={post.id} onVersionRestored={handleVersionRestored} />}
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
