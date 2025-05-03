import type React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"

async function getBlogPostCount() {
  const { count, error } = await supabase.from("posts").select("*", { count: "exact", head: true })

  if (error) {
    console.error("Error fetching blog post count:", error)
    return 0
  }

  return count || 0
}

async function getRecentPosts(limit = 5) {
  const { data, error } = await supabase
    .from("posts")
    .select("id, title, slug, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching recent posts:", error)
    return []
  }

  return data || []
}

export default async function AdminDashboard() {
  const postCount = await getBlogPostCount()
  const recentPosts = await getRecentPosts(5)

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <DashboardCard
          title="Blog Posts"
          value={postCount.toString()}
          description="Total blog posts"
          icon={<FileText className="h-5 w-5" />}
          href="/admin/blog/posts"
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Blog Posts</CardTitle>
            <CardDescription>Latest blog posts published on your site</CardDescription>
          </CardHeader>
          <CardContent>
            {recentPosts.length > 0 ? (
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
            <div className="flex justify-end mt-4">
              <Link href="/admin/blog/posts" className="text-sm text-primary hover:underline">
                View all posts
              </Link>
            </div>
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
}: {
  title: string
  value: string
  description: string
  icon: React.ReactNode
  href?: string
}) {
  const content = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="bg-primary/10 p-2 rounded-full text-primary">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
