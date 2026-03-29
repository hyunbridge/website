import { getAllTags, getPosts } from "@/lib/blog-service"
import { getProjects } from "@/lib/project-service"

const BUILD_PAGE_SIZE = 100

export async function getAllPublishedPostsForBuild() {
  const posts: Awaited<ReturnType<typeof getPosts>> = []
  let page = 1

  while (true) {
    const nextPosts = await getPosts(page, BUILD_PAGE_SIZE)
    posts.push(...nextPosts)
    if (nextPosts.length < BUILD_PAGE_SIZE) {
      break
    }
    page += 1
  }

  return posts
}

export async function getAllPublishedProjectsForBuild() {
  return getProjects()
}

export async function getAllPublishedTagsForBuild() {
  return getAllTags()
}
