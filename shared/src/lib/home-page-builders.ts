import {
  createParagraphRichContent,
  generateHomeId,
  homeEntryItemSchema,
  homeHeroCardSchema,
  homeCardSectionSchema,
  homeCtaSectionSchema,
  homeHeroSectionSchema,
  homePageDataSchema,
  homePlainSectionSchema,
  homePostFeedSectionSchema,
  homeProjectFeedSectionSchema,
  homeTimelineSectionSchema,
  type HomeCardSection,
  type HomeCtaSection,
  type HomeEntryItem,
  type HomeHeroCard,
  type HomeHeroSection,
  type HomePageData,
  type HomePageSection,
  type HomePlainSection,
  type HomePostFeedSection,
  type HomeProjectFeedSection,
  type HomeTimelineSection,
} from "./home-page-definitions"

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function createHomeHeroCard(overrides: Partial<HomeHeroCard> = {}): HomeHeroCard {
  return homeHeroCardSchema.parse(overrides)
}

export function createHomeEntryItem(overrides: Partial<HomeEntryItem> = {}): HomeEntryItem {
  return homeEntryItemSchema.parse(overrides)
}

export function createHeroSection(
  overrides: Partial<Omit<HomeHeroSection, "type">> = {},
): HomeHeroSection {
  return homeHeroSectionSchema.parse({
    type: "hero",
    layout: "split",
    theme: "accent",
    visible: true,
    eyebrow: "",
    title: "홈페이지 제목",
    content: createParagraphRichContent("소개 문구를 입력하세요."),
    primaryCta: { label: "자세히 보기", href: "/" },
    secondaryCta: { label: "문의하기", href: "/contact" },
    cards: [],
    ...overrides,
  })
}

export function createTimelineSection(
  overrides: Partial<Omit<HomeTimelineSection, "type">> = {},
): HomeTimelineSection {
  return homeTimelineSectionSchema.parse({
    type: "timeline",
    visible: true,
    theme: "default",
    title: "새 타임라인 섹션",
    intro: createParagraphRichContent("섹션 설명을 입력하세요."),
    items: [],
    ...overrides,
  })
}

export function createCardsSection(
  overrides: Partial<Omit<HomeCardSection, "type">> = {},
): HomeCardSection {
  return homeCardSectionSchema.parse({
    type: "cards",
    visible: true,
    theme: "default",
    title: "새 카드 섹션",
    intro: createParagraphRichContent("섹션 설명을 입력하세요."),
    items: [],
    ...overrides,
  })
}

export function createProjectFeedSection(
  overrides: Partial<Omit<HomeProjectFeedSection, "type">> = {},
): HomeProjectFeedSection {
  return homeProjectFeedSectionSchema.parse({
    type: "projectFeed",
    visible: true,
    theme: "accent",
    layout: "spotlight",
    title: "프로젝트",
    description: "",
    limit: 3,
    ...overrides,
  })
}

export function createPostFeedSection(
  overrides: Partial<Omit<HomePostFeedSection, "type">> = {},
): HomePostFeedSection {
  return homePostFeedSectionSchema.parse({
    type: "postFeed",
    visible: true,
    theme: "default",
    layout: "list",
    title: "글",
    description: "",
    limit: 3,
    ...overrides,
  })
}

export function createCtaSection(
  overrides: Partial<Omit<HomeCtaSection, "type">> = {},
): HomeCtaSection {
  return homeCtaSectionSchema.parse({
    type: "cta",
    visible: true,
    theme: "accent",
    layout: "split",
    title: "CTA 문구를 입력하세요.",
    content: createParagraphRichContent("본문을 입력하세요."),
    primaryCta: { label: "자세히 보기", href: "/" },
    ...overrides,
  })
}

export function createPlainSection(
  overrides: Partial<Omit<HomePlainSection, "type">> = {},
): HomePlainSection {
  return homePlainSectionSchema.parse({
    type: "plain",
    visible: true,
    theme: "default",
    content: createParagraphRichContent("본문을 입력하세요."),
    ...overrides,
  })
}

export function cloneHomePageData(value: HomePageData) {
  return deepClone(value)
}

export function getDefaultHomePageData(): HomePageData {
  return homePageDataSchema.parse({
    sections: [
      createHeroSection({
        id: generateHomeId("hero"),
        title: "홈 제목을 입력하세요.",
        content: createParagraphRichContent("핵심 소개를 짧게 작성하세요."),
        primaryCta: { label: "프로젝트 보기", href: "/projects" },
        secondaryCta: { label: "문의하기", href: "/contact" },
      }),
      createProjectFeedSection({
        id: generateHomeId("project-feed"),
        title: "프로젝트",
      }),
      createPostFeedSection({
        id: generateHomeId("post-feed"),
        title: "글",
      }),
      createCtaSection({
        id: generateHomeId("cta"),
        title: "함께 이야기해요.",
        content: createParagraphRichContent("문의나 협업 제안은 언제든지 환영합니다."),
        primaryCta: { label: "문의하기", href: "/contact" },
      }),
    ],
  })
}

export function getEmptyHomePageData(): HomePageData {
  return homePageDataSchema.parse({
    sections: [],
  })
}

function duplicateTitle(title: string) {
  return title ? `${title} 복사본` : "복사본"
}

export function duplicateHomePageSection(section: HomePageSection): HomePageSection {
  const cloned = deepClone(section)

  if (cloned.type === "hero") {
    return createHeroSection({
      ...cloned,
      id: generateHomeId("hero"),
      title: duplicateTitle(cloned.title),
      cards: cloned.cards.map((card) =>
        homeHeroCardSchema.parse({ ...card, id: generateHomeId("hero-card") }),
      ),
    })
  }

  if (cloned.type === "timeline") {
    return createTimelineSection({
      ...cloned,
      id: generateHomeId("timeline"),
      title: duplicateTitle(cloned.title),
      items: cloned.items.map((item) =>
        homeEntryItemSchema.parse({ ...item, id: generateHomeId("entry") }),
      ),
    })
  }

  if (cloned.type === "cards") {
    return createCardsSection({
      ...cloned,
      id: generateHomeId("cards"),
      title: duplicateTitle(cloned.title),
      items: cloned.items.map((item) =>
        homeEntryItemSchema.parse({ ...item, id: generateHomeId("entry") }),
      ),
    })
  }

  if (cloned.type === "projectFeed") {
    return createProjectFeedSection({
      ...cloned,
      id: generateHomeId("project-feed"),
      title: duplicateTitle(cloned.title),
    })
  }

  if (cloned.type === "postFeed") {
    return createPostFeedSection({
      ...cloned,
      id: generateHomeId("post-feed"),
      title: duplicateTitle(cloned.title),
    })
  }

  if (cloned.type === "cta") {
    return createCtaSection({
      ...cloned,
      id: generateHomeId("cta"),
      title: duplicateTitle(cloned.title),
    })
  }

  return createPlainSection({
    ...cloned,
    id: generateHomeId("plain"),
  })
}
