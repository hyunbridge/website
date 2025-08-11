"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { PostEditor } from "@/components/blog/post-editor"
import { VersionHistory } from "@/components/blog/version-history"
import { getPostById } from "@/lib/blog-service"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function EditPostPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNewPost = searchParams?.get("isNew") === "true"
  const [post, setPost] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [errorDetails, setErrorDetails] = useState("")
  const [activeTab, setActiveTab] = useState("edit")

  const fetchPost = async () => {
    if (!params.id) return

    setIsLoading(true)
    setError("")
    setErrorDetails("")
    
    try {
      const postData = await getPostById(params.id)
      setPost(postData)
    } catch (err) {
      console.error("Error fetching post:", err)
      setError("Failed to load post")
      setErrorDetails(err instanceof Error ? err.message : "An unknown error occurred while loading the post. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPost()
  }, [params.id])

  const handleVersionRestored = async () => {
    setActiveTab("edit")
    await fetchPost()
  }

  const handleRetry = () => {
    fetchPost()
  }

  if (error) {
    return (
      <div>
        <div className="flex flex-col mb-8">
          <h1 className="text-3xl font-bold">{isNewPost ? "Create Post" : "Edit Post"}</h1>
          <Link href="/admin/blog/posts" className="text-sm text-muted-foreground hover:underline mt-2">
            ← Back to post list
          </Link>
        </div>
        
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to Load Post</AlertTitle>
          <AlertDescription className="mt-2">
            <div className="space-y-2">
              <p>{errorDetails}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/admin/blog/posts")}
                >
                  Back to Posts
                </Button>
              </div>
            </div>
          </AlertDescription>
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
