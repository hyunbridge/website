import { lazy, Suspense, type ReactNode } from "react"
import { Link, Outlet, useParams } from "react-router-dom"
import { AlertCircle, FileText, FolderKanban } from "lucide-react"
import { getBlogPostCount, getPostsByTagId, getRecentPosts } from "@/lib/blog-service"
import { getProjectCount, getRecentProjects } from "@/lib/project-service"
import { AdminPostList } from "@/components/blog/admin-post-list"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card"
import { Button } from "@shared/components/ui/button"
import { Alert, AlertDescription } from "@shared/components/ui/alert"
import { Skeleton } from "@shared/components/ui/skeleton"
import AdminLayout from "@/features/admin/layout/admin-shell"
import NotFoundPage from "@/pages/not-found-page"
import { useResource } from "../lib/use-resource"
import { Toaster } from "@shared/components/ui/toaster"
import AdminProfilePage from "@/features/admin/pages/profile-page"
import { motion } from "framer-motion"

const AdminLoginPage = lazy(() => import("@/features/admin/pages/login-page"))
const AdminBlogPostsPage = lazy(() => import("@/features/admin/pages/blog-posts-page"))
const EditPostPage = lazy(() => import("@/features/admin/pages/blog-edit-page"))
const AdminProjectsPage = lazy(() => import("@/features/admin/pages/projects-page"))
const EditProjectPage = lazy(() => import("@/features/admin/pages/project-edit-page"))
const AdminHomeBuilderPage = lazy(() => import("@/features/admin/pages/home-builder-page"))
const AdminTagsPage = lazy(() => import("@/features/admin/pages/tags-page"))
const AdminDeployPage = lazy(() => import("@/features/admin/pages/deploy-page"))

function LoadingPage() {
  return (
    <div className="container py-8 space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  )
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="container py-8">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  )
}

function RouteSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingPage />}>{children}</Suspense>
}

export function AdminLayoutRoute() {
  return (
    <AdminLayout>
      <>
        <Outlet />
        <Toaster />
      </>
    </AdminLayout>
  )
}

export function AdminLoginRoute() {
  return (
    <RouteSuspense>
      <AdminLoginPage />
    </RouteSuspense>
  )
}

export function AdminDashboardRoute() {
  const { data, error, isLoading } = useResource(async () => {
    const [postCount, projectCount, recentPosts, recentProjects] = await Promise.all([
      getBlogPostCount(),
      getProjectCount(),
      getRecentPosts(5),
      getRecentProjects(5),
    ])
    return { postCount, projectCount, recentPosts, recentProjects }
  }, [])

  if (isLoading) return <LoadingPage />
  if (error || !data) return <ErrorPage message={error || "대시보드를 불러오지 못했습니다."} />

  const containerState = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const itemState = {
    hidden: { opacity: 0, y: 15 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
      </motion.div>
      <motion.div
        variants={containerState}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-6 md:grid-cols-2"
      >
        <motion.div variants={itemState}>
          <Card className="overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span>블로그 글</span>
              </CardTitle>
              <CardDescription>전체 게시글 수</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-4xl font-bold tracking-tighter text-primary">
                {data.postCount}
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={itemState}>
          <Card className="overflow-hidden border-border/50 shadow-sm transition-all hover:shadow-md">
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" />
                <span>프로젝트</span>
              </CardTitle>
              <CardDescription>등록된 프로젝트 수</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-4xl font-bold tracking-tighter text-primary">
                {data.projectCount}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div
        variants={containerState}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        <motion.div variants={itemState}>
          <Card className="h-full border-border/50 shadow-sm flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>최근 블로그 글</span>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-xs hover:bg-primary/5 text-muted-foreground"
                >
                  <Link to="/blog">전체보기</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 flex-1">
              {data.recentPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full border border-dashed rounded-lg">
                  <FileText className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">등록된 글이 없습니다.</p>
                </div>
              ) : (
                data.recentPosts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/blog/edit/${post.id}`}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/50 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm hover:bg-muted/30"
                  >
                    <div className="font-medium truncate mr-4 group-hover:text-primary transition-colors">
                      {post.title}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap mt-1 sm:mt-0 bg-secondary/50 px-2 py-1 rounded w-fit">
                      {new Date(post.created_at).toLocaleDateString("ko-KR")}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemState}>
          <Card className="h-full border-border/50 shadow-sm flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>최근 프로젝트</span>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-xs hover:bg-primary/5 text-muted-foreground"
                >
                  <Link to="/projects">전체보기</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 flex-1">
              {data.recentProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground h-full border border-dashed rounded-lg">
                  <FolderKanban className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-sm">등록된 프로젝트가 없습니다.</p>
                </div>
              ) : (
                data.recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/edit/${project.id}`}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-border/50 bg-card p-3 transition-all hover:border-primary/30 hover:shadow-sm hover:bg-muted/30"
                  >
                    <div className="font-medium truncate mr-4 group-hover:text-primary transition-colors">
                      {project.title}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap mt-1 sm:mt-0 bg-secondary/50 px-2 py-1 rounded w-fit">
                      {new Date(project.created_at).toLocaleDateString("ko-KR")}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}

export function AdminBlogPostsRoute() {
  return (
    <RouteSuspense>
      <AdminBlogPostsPage />
    </RouteSuspense>
  )
}

export function AdminBlogEditRoute() {
  return (
    <RouteSuspense>
      <EditPostPage />
    </RouteSuspense>
  )
}

export function AdminProjectsRoute() {
  return (
    <RouteSuspense>
      <AdminProjectsPage />
    </RouteSuspense>
  )
}

export function AdminProjectEditRoute() {
  return (
    <RouteSuspense>
      <EditProjectPage />
    </RouteSuspense>
  )
}

export function AdminHomeRoute() {
  return (
    <RouteSuspense>
      <AdminHomeBuilderPage />
    </RouteSuspense>
  )
}

export function AdminTagsRoute() {
  return (
    <RouteSuspense>
      <AdminTagsPage />
    </RouteSuspense>
  )
}

export function AdminDeployRoute() {
  return (
    <RouteSuspense>
      <AdminDeployPage />
    </RouteSuspense>
  )
}

export function AdminTagsPostsRoute() {
  const { id = "" } = useParams()
  const { data, error, isLoading } = useResource(() => getPostsByTagId(id, 1, 10, false), [id])

  if (isLoading) return <LoadingPage />
  if (error === "tag_not_found") return <NotFoundRoute />
  if (error || !data || !data.tag)
    return <ErrorPage message={error || "태그 글을 불러오지 못했습니다."} />

  return (
    <div className="space-y-6">
      <div>
        <Button variant="outline" asChild>
          <Link to="/tags">전체 태그로 돌아가기</Link>
        </Button>
      </div>
      <h1 className="text-3xl font-bold">&quot;{data.tag.name}&quot; 태그가 포함된 게시글</h1>
      <AdminPostList initialPosts={data.posts} tagId={id} />
    </div>
  )
}

export function AdminProfileRoute() {
  return <AdminProfilePage />
}

export function NotFoundRoute() {
  return <NotFoundPage />
}
