import type { APIRoute } from "astro"
import { getPublicSiteUrl } from "@/lib/site-url"

export const GET: APIRoute = async () => {
  const siteUrl = getPublicSiteUrl()
  const body = `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  })
}
