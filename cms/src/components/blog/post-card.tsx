import { formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import type { Post } from "@/lib/blog-service"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@shared/components/ui/card"
import { Badge } from "@shared/components/ui/badge"
import { motion } from "framer-motion"
import { MORPH_LAYOUT_TRANSITION } from "@shared/lib/motion"
import { MorphLink } from "@/components/morph-link"
import {
  SharedTransitionImage,
  SharedTransitionTitle,
} from "@/components/shared-content-transition"

interface PostCardProps {
  post: Post
  isAdmin?: boolean
  index?: number
}

export function PostCard({ post, isAdmin = false, index = 0 }: PostCardProps) {
  const publishedDate = post.published_at ? new Date(post.published_at) : new Date(post.created_at)
  const visibilityLabel = post.published_at ? "공개" : "비공개"

  const formattedDate = formatDistanceToNow(publishedDate, { addSuffix: true, locale: ko })

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.06, duration: 0.45, ...MORPH_LAYOUT_TRANSITION }}
      className="h-full"
    >
      <Card className="h-full flex flex-col hover:shadow-md transition-shadow overflow-hidden border border-border">
        <MorphLink
          href={isAdmin ? `/blog/edit/${post.id}` : `/blog/${post.slug}`}
          morphIntent={isAdmin ? undefined : "blog-detail"}
          morphSource={
            isAdmin
              ? undefined
              : {
                  itemId: post.id,
                  title: post.title,
                  coverImage: post.cover_image,
                }
          }
          className="flex-1 flex flex-col"
        >
          {post.cover_image && (
            <div className="relative">
              <SharedTransitionImage
                kind="blog"
                itemId={post.id}
                src={post.cover_image || "/placeholder.svg"}
                alt={post.title}
                containerClassName="h-48 w-full"
                sizes="(max-width: 1024px) 100vw, 896px"
                imageClassName="transition-opacity duration-300"
              />
            </div>
          )}
          <CardHeader>
            <div className="mb-2">
              <Badge variant={post.published_at ? "default" : "secondary"}>{visibilityLabel}</Badge>
            </div>
            <SharedTransitionTitle kind="blog" itemId={post.id}>
              <CardTitle className="line-clamp-2">{post.title}</CardTitle>
            </SharedTransitionTitle>
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
        </MorphLink>
      </Card>
    </motion.div>
  )
}
