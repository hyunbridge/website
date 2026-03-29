import type { APIRoute } from "astro"
import { getAllPublishedPostsForBuild, getAllPublishedProjectsForBuild } from "@/lib/static-content"
import { getPublicSiteUrl } from "@/lib/site-url"

function xmlEscape(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

export const GET: APIRoute = async () => {
  const siteUrl = getPublicSiteUrl()
  const [posts, projects] = await Promise.all([
    getAllPublishedPostsForBuild(),
    getAllPublishedProjectsForBuild(),
  ])

  const urls = [
    "",
    "/blog",
    "/blog/tags",
    "/projects",
    "/contact",
    "/cv",
    ...posts.map((post) => `/blog/${post.slug}`),
    ...projects.map((project) => `/projects/${project.slug || project.id}`),
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((path) => `  <url><loc>${xmlEscape(`${siteUrl}${path}`)}</loc></url>`)
    .join("\n")}\n</urlset>`

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  })
}
