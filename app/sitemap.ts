import type { MetadataRoute } from "next"
import { getProjects } from "@/lib/notion"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // 기본 URL 설정
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://hgseo.net"

  // 정적 경로 설정
  const staticRoutes = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/cv`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/projects`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ] as MetadataRoute.Sitemap

  try {
    // 프로젝트 데이터 가져오기
    const projects = await getProjects()

    // 프로젝트 경로 생성
    const projectRoutes = projects.map((project) => {
      const slug = project.slug || project.id
      return {
        url: `${baseUrl}/projects/${slug}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      }
    }) as MetadataRoute.Sitemap

    // 모든 경로 합치기
    return [...staticRoutes, ...projectRoutes]
  } catch (error) {
    console.error("Error generating sitemap:", error)
    // 에러 발생 시 정적 경로만 반환
    return staticRoutes
  }
}
