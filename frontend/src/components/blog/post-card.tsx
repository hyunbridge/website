import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import Link from "@/components/ui/app-link"
import type { Post } from "@/lib/blog-service"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@shared/components/ui/card"
import { Badge } from "@shared/components/ui/badge"
import { motion } from "framer-motion"
import { MORPH_LAYOUT_TRANSITION } from "@shared/lib/motion"
import { getViewTransitionName } from "@/lib/view-transitions"

interface PostCardProps {
  post: Post
  isAdmin?: boolean
  index?: number
}

export function PostCard({ post, isAdmin = false, index = 0 }: PostCardProps) {
  const publishedDate = post.published_at ? new Date(post.published_at) : new Date(post.created_at)
  const formattedDate = formatDistanceToNow(publishedDate, { addSuffix: true, locale: ko })
  const transitionImageName = getViewTransitionName("blog", post.id, "image")
  const transitionTitleName = getViewTransitionName("blog", post.id, "title")

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.06, duration: 0.45, ...MORPH_LAYOUT_TRANSITION }}
      className="h-full"
    >
      <Card className="h-full flex flex-col overflow-hidden border border-border transition-shadow hover:shadow-md">
        <Link
          href={isAdmin ? `/admin/blog/edit/${post.id}` : `/blog/${post.slug}`}
          className="flex flex-1 flex-col"
        >
          {post.cover_image && (
            <div className="relative">
              <img
                src={post.cover_image || "/placeholder.svg"}
                alt={post.title}
                className="h-48 w-full object-cover transition-opacity duration-300"
                loading="lazy"
                style={!isAdmin ? { viewTransitionName: transitionImageName } : undefined}
              />
            </div>
          )}
          <CardHeader>
            <CardTitle
              className="line-clamp-2"
              style={!isAdmin ? { viewTransitionName: transitionTitleName } : undefined}
            >
              {post.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            <p className="text-sm text-muted-foreground line-clamp-3">{post.summary}</p>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <div className="flex flex-wrap gap-2">
              {post.tags &&
                post.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag.id} variant="outline" className="text-xs">
                    {tag.name}
                  </Badge>
                ))}
              {post.tags && post.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{post.tags.length - 3}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{formattedDate}</p>
          </CardFooter>
        </Link>
      </Card>
    </motion.div>
  )
}
