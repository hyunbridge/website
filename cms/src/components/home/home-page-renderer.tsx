import {
  HomeAmbientCard,
  HomeSectionReveal,
} from "@shared/components/home/home-motion"
import { StatePanel } from "@shared/components/ui/state-panel"

import type { Post } from "@/lib/blog-service"
import type { Project } from "@/lib/project-service"
import type { HomePageData, HomePageNotice } from "@/lib/home-page-service"

import {
  getHomeSectionThemeClasses,
  HomeSectionView,
} from "@/components/home/home-page-renderer-sections"

type HomePageRendererProps = {
  data: HomePageData
  notices?: HomePageNotice[]
  projects: Project[]
  posts: Post[]
}

function readEmptyStateCopy(notices: HomePageNotice[]) {
  const primaryNotice = notices[0]
  if (!primaryNotice) {
    return {
      title: "홈 구성이 아직 없습니다",
      description: "홈을 구성하면 이곳에 내용이 표시됩니다.",
    }
  }
  if (primaryNotice.code === "hidden-home") {
    return {
      title: "표시할 홈 섹션이 없습니다",
      description: primaryNotice.message,
    }
  }
  if (primaryNotice.code === "invalid-home-data" || primaryNotice.code === "invalid-home-sections") {
    return {
      title: "홈 데이터를 읽지 못했습니다",
      description: primaryNotice.message,
    }
  }
  return {
    title: "홈 구성이 아직 없습니다",
    description: primaryNotice.message,
  }
}

export function HomePageRenderer({ data, notices = [], projects, posts }: HomePageRendererProps) {
  const sections = data.sections.filter((section) => section.visible)
  const hasSections = sections.length > 0

  if (!hasSections) {
    const emptyState = readEmptyStateCopy(notices)
    return (
      <div className="container py-8 md:py-12">
        <div className="flex items-center justify-center py-12">
          <StatePanel
            className="max-w-lg"
            size="compact"
            title={emptyState.title}
            description={emptyState.description}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-x-clip rounded-[2.5rem] bg-[#f5f0e7] pb-14 text-foreground shadow-[0_30px_120px_rgba(15,23,42,0.12)] dark:bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(251,191,36,0.16),transparent_24%),radial-gradient(circle_at_88%_10%,rgba(14,165,233,0.14),transparent_24%),linear-gradient(180deg,#f7f1e8_0%,#f4efe7_42%,#f7f4ee_100%)] dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98)_0%,rgba(2,6,23,1)_100%)]" />
      <div className="relative z-10 px-4 py-6 md:px-6 md:py-8">
        <div className="space-y-6">
          {sections.map((section, index) => (
            <HomeSectionReveal
              key={section.id}
              id={section.id}
              className="mx-auto max-w-6xl scroll-mt-24"
              delay={index * 0.04}
            >
              <HomeAmbientCard
                className={`rounded-[2.25rem] border shadow-[0_24px_80px_rgba(15,23,42,0.09)] ${getHomeSectionThemeClasses(section.theme)}`}
              >
                <HomeSectionView
                  section={section}
                  nextSectionId={sections[index + 1]?.id}
                  projects={projects}
                  posts={posts}
                />
              </HomeAmbientCard>
            </HomeSectionReveal>
          ))}
        </div>
      </div>
    </div>
  )
}
