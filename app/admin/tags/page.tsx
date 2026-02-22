"use client"

import { useState, useEffect } from "react"
import { TagList } from "@/components/blog/tag-list"
import { getAllTags, type Tag } from "@/lib/blog-service"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"

export default function AdminTagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [errorMessage, setErrorMessage] = useState("")

  const fetchTags = async () => {
    try {
      setIsLoading(true)
      setError(null)
      setErrorMessage("")
      const tagsData = await getAllTags()
      setTags(tagsData)
    } catch (err) {
      console.error("Error fetching tags:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      setErrorMessage(err instanceof Error ? err.message : "Failed to load tags. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTags()
  }, [])

  const handleTagsChange = () => {
    fetchTags()
  }

  if (isLoading) {
    return (
      <div>
        <h1 className="text-3xl font-bold mb-6">Tags</h1>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Tags</h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errorMessage}
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={fetchTags}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!error && <TagList tags={tags} isAdmin onTagsChange={handleTagsChange} />}
    </div>
  )
}
