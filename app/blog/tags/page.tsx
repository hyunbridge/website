import { Suspense } from "react"
import { TagList } from "@/components/blog/tag-list"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = {
  title: "Blog Tags | Hyungyo Seo",
  description: "Browse blog posts by tags",
}

export default async function BlogTagsPage() {
  return (
    <div className="container py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">Blog Tags</h1>
      <Suspense fallback={<LoadingSkeleton />}>
        <TagList />
      </Suspense>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="h-6 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
