import { z } from "zod"

import {
  HOME_PAGE_SCHEMA_VERSION,
  homePageDataSchema,
  nullableStringField,
  strictHomePageDataSchema,
  homePageSectionSchema,
  type HomePageData,
} from "./home-page-definitions"
import { getDefaultHomePageData, getEmptyHomePageData } from "./home-page-builders"

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

export const homePageNoticeSchema = z.object({
  code: z.string(),
  message: z.string(),
})

export const homePageDocumentSchema = z.object({
  id: nullableStringField(),
  ownerId: nullableStringField(),
  status: z.preprocess(
    (value) =>
      value === "draft" || value === "published" || value === "archived" ? value : "draft",
    z.enum(["draft", "published", "archived"]),
  ),
  updatedAt: nullableStringField(),
  publishedAt: nullableStringField(),
  currentVersionId: nullableStringField().optional(),
  publishedVersionId: nullableStringField().optional(),
  data: z.unknown().transform((value) => inspectHomePageData(value).data),
  notices: z.preprocess(
    (value) => (Array.isArray(value) ? value : []),
    z.array(homePageNoticeSchema),
  ),
})

export type HomePageNotice = z.infer<typeof homePageNoticeSchema>
export type HomePageDocument = z.infer<typeof homePageDocumentSchema>

export function getHomePageDataNotices(data: HomePageData): HomePageNotice[] {
  if (data.sections.length === 0) {
    return [{ code: "empty-home", message: "홈 섹션이 없어 현재 빈 홈으로 표시됩니다." }]
  }

  if (!data.sections.some((section) => section.visible)) {
    return [
      {
        code: "hidden-home",
        message: "모든 섹션이 숨김 상태라 현재 공개 홈에는 내용이 표시되지 않습니다.",
      },
    ]
  }

  return []
}

function safeParseSection(value: unknown) {
  if (!isRecord(value) || typeof value.type !== "string") {
    return null
  }
  return homePageSectionSchema.safeParse(value)
}

export function inspectHomePageData(
  value: unknown,
  options: { fallback?: "empty" | "default" } = {},
): { data: HomePageData; notices: HomePageNotice[] } {
  const fallback =
    options.fallback === "default" ? getDefaultHomePageData() : getEmptyHomePageData()

  if (!isRecord(value)) {
    return {
      data: fallback,
      notices: [
        {
          code: "invalid-home-data",
          message: "저장된 홈 데이터 형식이 올바르지 않아 내용을 복구하지 못했습니다.",
        },
      ],
    }
  }

  if (!Array.isArray(value.sections)) {
    return {
      data: fallback,
      notices: [
        {
          code: "invalid-home-sections",
          message: "저장된 홈 섹션 정보를 읽지 못해 내용을 복구하지 못했습니다.",
        },
      ],
    }
  }

  const parsedSections = value.sections.map(safeParseSection)
  const sections = parsedSections
    .filter((result): result is Exclude<typeof result, null> => result !== null)
    .filter((result) => result.success)
    .map((result) => result.data)
  const droppedSectionCount = value.sections.length - sections.length

  const data = homePageDataSchema.parse({
    schemaVersion: HOME_PAGE_SCHEMA_VERSION,
    sections,
  })

  const notices: HomePageNotice[] = []

  if (droppedSectionCount > 0) {
    notices.push({
      code: "invalid-home-section-items",
      message: `복구할 수 없는 홈 섹션 ${droppedSectionCount}개를 제외했습니다.`,
    })
  }

  notices.push(...getHomePageDataNotices(data))

  return { data, notices }
}

export function normalizeHomePageData(value: unknown): HomePageData {
  return inspectHomePageData(value).data
}

export function parseStrictHomePageData(value: unknown): HomePageData {
  return strictHomePageDataSchema.parse(value)
}
