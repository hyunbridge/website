import { createParagraphRichContent, type HomePageSection } from "./home-page-definitions"
import {
  createCardsSection,
  createCtaSection,
  createHomeEntryItem,
  createHeroSection,
  createPlainSection,
  createPostFeedSection,
  createProjectFeedSection,
  createTimelineSection,
} from "./home-page-builders"

export type HomeSectionPreset = {
  id: string
  label: string
  description: string
  category: "intro" | "structure" | "dynamic" | "cta"
  type: HomePageSection["type"]
  create: () => HomePageSection
}

export const homeSectionPresets: HomeSectionPreset[] = [
  {
    id: "hero",
    label: "히어로",
    description: "첫 화면 소개와 CTA를 배치합니다.",
    category: "intro",
    type: "hero",
    create: () =>
      createHeroSection({
        title: "히어로 제목",
        content: createParagraphRichContent("소개 문구를 입력하세요."),
        primaryCta: { label: "프로젝트 보기", href: "/projects" },
        secondaryCta: { label: "문의하기", href: "/contact" },
      }),
  },
  {
    id: "plain",
    label: "플레인 블록",
    description: "본문 블록을 자유롭게 추가합니다.",
    category: "intro",
    type: "plain",
    create: () =>
      createPlainSection({
        content: "## 섹션 제목\n\n본문을 입력하세요.",
      }),
  },
  {
    id: "collection-timeline",
    label: "타임라인",
    description: "경력과 활동을 시간 순서로 정리합니다.",
    category: "structure",
    type: "timeline",
    create: () =>
      createTimelineSection({
        items: [
          createHomeEntryItem({
            title: "새 항목",
            content: createParagraphRichContent("내용을 입력하세요."),
          }),
        ],
      }),
  },
  {
    id: "collection-cards",
    label: "카드 컬렉션",
    description: "정보를 카드 형태로 나열합니다.",
    category: "structure",
    type: "cards",
    create: () =>
      createCardsSection({
        theme: "accent",
        items: [
          createHomeEntryItem({
            title: "새 카드",
            content: createParagraphRichContent("내용을 입력하세요."),
          }),
        ],
      }),
  },
  {
    id: "feed-projects",
    label: "프로젝트 피드",
    description: "공개 프로젝트를 자동 노출합니다.",
    category: "dynamic",
    type: "projectFeed",
    create: () => createProjectFeedSection(),
  },
  {
    id: "feed-posts",
    label: "글 피드",
    description: "최신 글을 자동 노출합니다.",
    category: "dynamic",
    type: "postFeed",
    create: () => createPostFeedSection(),
  },
  {
    id: "cta",
    label: "CTA",
    description: "연락 또는 유도 버튼을 추가합니다.",
    category: "cta",
    type: "cta",
    create: () =>
      createCtaSection({
        title: "CTA 제목",
        primaryCta: { label: "문의하기", href: "/contact" },
      }),
  },
]
