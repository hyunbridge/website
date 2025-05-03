"use client"

import { useState, useEffect } from "react"
import { TagList } from "@/components/blog/tag-list"
import { getAllTags } from "@/lib/blog-service"
import { Skeleton } from "@/components/ui/skeleton"

export default function BlogTagsPage() {
  const [tags, setTags] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTags = async () => {
    try {
      setIsLoading(true)
      const tagsData = await getAllTags()
      setTags(tagsData)
      setError(null)
    } catch (err) {
      console.error("Error fetching tags:", err)
      setError("Failed to load tags")
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

  if (error) {
    return (
      <div className="py-10 text-center">
        <p className="text-destructive mb-4">{error}</p>
        <button 
          onClick={fetchTags}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Tags</h1>
      <TagList tags={tags} isAdmin onTagsChange={handleTagsChange} />
    </div>
  )
}
