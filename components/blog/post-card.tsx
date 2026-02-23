import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import type { Post } from "@/lib/blog-service"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"
import { MORPH_LAYOUT_TRANSITION } from "@/lib/motion"

interface PostCardProps {
  post: Post
  isAdmin?: boolean
}

export function PostCard({ post, isAdmin = false }: PostCardProps) {
  const publishedDate = post.published_at ? new Date(post.published_at) : new Date(post.created_at)

  const formattedDate = formatDistanceToNow(publishedDate, { addSuffix: true })

  return (
    <motion.div layoutId={`blog-card-${post.id}`} transition={MORPH_LAYOUT_TRANSITION} className="h-full">
      <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
        <Link href={isAdmin ? `/admin/blog/edit/${post.id}` : `/blog/${post.slug}`} className="flex-1 flex flex-col">
          {post.cover_image && (
            <motion.div
              layoutId={`blog-image-${post.id}`}
              transition={MORPH_LAYOUT_TRANSITION}
              className="relative h-48 w-full overflow-hidden"
            >
              <img
                src={post.cover_image || "/placeholder.svg"}
                alt={post.title}
                className="object-cover w-full h-full transition-transform duration-300 hover:scale-105"
              />
              {!post.is_published && (
                <Badge variant="secondary" className="absolute top-2 right-2">
                  Draft
                </Badge>
              )}
            </motion.div>
          )}
          <CardHeader>
            <motion.div layoutId={`blog-title-${post.id}`} transition={MORPH_LAYOUT_TRANSITION}>
              <CardTitle className="line-clamp-2">{post.title}</CardTitle>
            </motion.div>
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
