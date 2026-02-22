import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FileText, AlertCircle, RefreshCw } from "lucide-react"
import Link from "next/link"
import { getBlogPostCount, getRecentPosts, type RecentPostSummary } from "@/lib/blog-service"

export default async function AdminDashboard() {
  let postCount = 0
  let recentPosts: RecentPostSummary[] = []
  let hasPostCountError = false
  let hasRecentPostsError = false
  let postCountError = ""
  let recentPostsError = ""

  try {
    postCount = await getBlogPostCount()
  } catch (error) {
    hasPostCountError = true
    postCountError = error instanceof Error ? error.message : "Unknown error occurred"
  }

  try {
    recentPosts = await getRecentPosts(5)
  } catch (error) {
    hasRecentPostsError = true
    recentPostsError = error instanceof Error ? error.message : "Unknown error occurred"
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {(hasPostCountError || hasRecentPostsError) && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some data could not be loaded. 
            {hasPostCountError && " Unable to fetch blog post count."}
            {hasRecentPostsError && " Unable to fetch recent posts."}
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <DashboardCard
          title="Blog Posts"
          value={hasPostCountError ? "Error" : postCount.toString()}
          description={hasPostCountError ? postCountError : "Total blog posts"}
          icon={<FileText className="h-5 w-5" />}
          href="/admin/blog/posts"
          hasError={hasPostCountError}
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Blog Posts</CardTitle>
            <CardDescription>Latest blog posts published on your site</CardDescription>
          </CardHeader>
          <CardContent>
            {hasRecentPostsError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {recentPostsError}
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : recentPosts.length > 0 ? (
              <div className="space-y-4">
                {recentPosts.map((post) => (
                  <div key={post.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <Link href={`/blog/${post.slug}`} className="font-medium hover:text-primary">
                        {post.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">{new Date(post.created_at).toLocaleDateString()}</p>
                    </div>
                    <Link
                      href={`/admin/blog/edit/${post.id}`}
                      className="text-xs bg-muted px-2 py-1 rounded hover:bg-muted/80"
                    >
                      Edit
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No recent blog posts</p>
            )}
            {!hasRecentPostsError && (
              <div className="flex justify-end mt-4">
                <Link href="/admin/blog/posts" className="text-sm text-primary hover:underline">
                  View all posts
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function DashboardCard({
  title,
  value,
  description,
  icon,
  href,
  hasError,
}: {
  title: string
  value: string
  description: string
  icon: React.ReactNode
  href?: string
  hasError?: boolean
}) {
  const content = (
    <Card className={hasError ? "border-destructive/50" : ""}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-full ${hasError ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
          {hasError ? <AlertCircle className="h-5 w-5" /> : icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${hasError ? "text-destructive" : ""}`}>{value}</div>
        <p className={`text-xs ${hasError ? "text-destructive/80" : "text-muted-foreground"}`}>{description}</p>
      </CardContent>
    </Card>
  )

  if (href && !hasError) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
