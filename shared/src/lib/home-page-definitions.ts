import { z } from "zod"

import { createTemporaryId } from "./client-ids"
import { sanitizeHomeHref } from "./home-page-utils"

const HERO_LAYOUT_VALUES = ["split", "centered"] as const
const PROJECT_FEED_LAYOUT_VALUES = ["spotlight", "grid"] as const
const POST_FEED_LAYOUT_VALUES = ["list", "cards"] as const
const CTA_LAYOUT_VALUES = ["split", "centered"] as const

export const HOME_PAGE_SCHEMA_VERSION = 1

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type FallbackValue<T> = T | (() => T)
type UnknownRecord = Record<string, unknown>

function resolveFallback<T>(fallback: FallbackValue<T>) {
  return typeof fallback === "function" ? (fallback as () => T)() : fallback
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function objectInput(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {}
}

function clampNumber(value: number, min?: number, max?: number) {
  let next = value
  if (typeof min === "number") next = Math.max(min, next)
  if (typeof max === "number") next = Math.min(max, next)
  return next
}

function stringField(fallback = "") {
  return z.preprocess((value) => (typeof value === "string" ? value : fallback), z.string())
}

function richContentField(fallback: FallbackValue<string> = "") {
  return z.preprocess(
    (value) => (typeof value === "string" ? value : resolveFallback(fallback)),
    z.string(),
  )
}

function booleanField(fallback: boolean) {
  return z.preprocess((value) => (typeof value === "boolean" ? value : fallback), z.boolean())
}

function numberField(fallback: number, min?: number, max?: number) {
  return z.preprocess(
    (value) => (typeof value === "number" && !Number.isNaN(value) ? value : fallback),
    z.number().transform((value) => clampNumber(value, min, max)),
  )
}

function enumField<const T extends readonly [string, ...string[]]>(values: T, fallback: T[number]) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && (values as readonly string[]).includes(value) ? value : fallback,
    z.enum(values),
  )
}

function idField(fallback: FallbackValue<string>) {
  return z.preprocess(
    (value) => (typeof value === "string" ? value : resolveFallback(fallback)),
    z.string(),
  )
}

export function nullableStringField() {
  return z.preprocess((value) => (typeof value === "string" ? value : null), z.string().nullable())
}

function makeLinkSchema(fallback: { label: string; href: string }) {
  return z.preprocess(
    objectInput,
    z.object({
      label: stringField(fallback.label),
      href: z.preprocess(
        (value) =>
          sanitizeHomeHref(typeof value === "string" ? value : fallback.href, fallback.href),
        z.string(),
      ),
    }),
  )
}

export const homeThemeSchema = z.enum(["default", "accent"])
export const homeHeroLayoutSchema = z.enum(HERO_LAYOUT_VALUES)
export const homeProjectFeedLayoutSchema = z.enum(PROJECT_FEED_LAYOUT_VALUES)
export const homePostFeedLayoutSchema = z.enum(POST_FEED_LAYOUT_VALUES)
export const homeCtaLayoutSchema = z.enum(CTA_LAYOUT_VALUES)
export const homeLinkSchema = makeLinkSchema({ label: "", href: "/" })

export type HomeTheme = z.infer<typeof homeThemeSchema>
export type HomeRichContent = string
export type HomeHeroLayout = z.infer<typeof homeHeroLayoutSchema>
export type HomeProjectFeedLayout = z.infer<typeof homeProjectFeedLayoutSchema>
export type HomePostFeedLayout = z.infer<typeof homePostFeedLayoutSchema>
export type HomeCtaLayout = z.infer<typeof homeCtaLayoutSchema>
export type HomeLink = z.infer<typeof homeLinkSchema>

export function generateHomeId(prefix: string) {
  return createTemporaryId(prefix)
}

export function createParagraphRichContent(text = ""): HomeRichContent {
  return text
}

export const homeHeroCardSchema = z.object({
  id: idField(() => generateHomeId("hero-card")),
  title: stringField("새 카드"),
  content: richContentField(() => createParagraphRichContent("내용을 입력하세요.")),
})

export const homeEntryItemSchema = z.object({
  id: idField(() => generateHomeId("entry")),
  title: stringField("새 항목"),
  content: richContentField(() => createParagraphRichContent("내용을 입력하세요.")),
})

export type HomeHeroCard = z.infer<typeof homeHeroCardSchema>
export type HomeEntryItem = z.infer<typeof homeEntryItemSchema>

export const homeHeroSectionSchema = z.object({
  id: idField("hero"),
  type: z.literal("hero"),
  visible: booleanField(true),
  layout: enumField(HERO_LAYOUT_VALUES, "split"),
  theme: enumField(["default", "accent"], "accent"),
  eyebrow: stringField(""),
  title: stringField("홈페이지 제목"),
  content: richContentField(() => createParagraphRichContent("소개 문구를 입력하세요.")),
  primaryCta: makeLinkSchema({ label: "자세히 보기", href: "/" }),
  secondaryCta: makeLinkSchema({ label: "문의하기", href: "/contact" }),
  cards: z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(homeHeroCardSchema)),
})

const homeCollectionSectionBaseSchema = z.object({
  id: idField(() => generateHomeId("section")),
  visible: booleanField(true),
  theme: enumField(["default", "accent"], "default"),
  title: stringField("새 섹션"),
  intro: richContentField(() => createParagraphRichContent("섹션 설명을 입력하세요.")),
  items: z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(homeEntryItemSchema)),
})

export const homeTimelineSectionSchema = homeCollectionSectionBaseSchema.extend({
  id: idField(() => generateHomeId("timeline")),
  type: z.literal("timeline"),
  title: stringField("새 타임라인 섹션"),
})

export const homeCardSectionSchema = homeCollectionSectionBaseSchema.extend({
  id: idField(() => generateHomeId("cards")),
  type: z.literal("cards"),
  title: stringField("새 카드 섹션"),
})

const homeFeedSectionBaseSchema = z.object({
  id: idField(() => generateHomeId("feed")),
  visible: booleanField(true),
  theme: enumField(["default", "accent"], "default"),
  title: stringField(""),
  description: stringField(""),
  limit: numberField(3, 1, 6),
})

export const homeProjectFeedSectionSchema = homeFeedSectionBaseSchema.extend({
  type: z.literal("projectFeed"),
  layout: enumField(PROJECT_FEED_LAYOUT_VALUES, "spotlight"),
  theme: enumField(["default", "accent"], "accent"),
  title: stringField("프로젝트"),
})

export const homePostFeedSectionSchema = homeFeedSectionBaseSchema.extend({
  type: z.literal("postFeed"),
  layout: enumField(POST_FEED_LAYOUT_VALUES, "list"),
  title: stringField("글"),
})

export const homeCtaSectionSchema = z.object({
  id: idField(() => generateHomeId("cta")),
  type: z.literal("cta"),
  visible: booleanField(true),
  layout: enumField(CTA_LAYOUT_VALUES, "split"),
  theme: enumField(["default", "accent"], "accent"),
  title: stringField("CTA 문구를 입력하세요."),
  content: richContentField(() => createParagraphRichContent("본문을 입력하세요.")),
  primaryCta: makeLinkSchema({ label: "자세히 보기", href: "/" }),
})

export const homePlainSectionSchema = z.object({
  id: idField(() => generateHomeId("plain")),
  type: z.literal("plain"),
  visible: booleanField(true),
  theme: enumField(["default", "accent"], "default"),
  content: richContentField(() => createParagraphRichContent("본문을 입력하세요.")),
})

export const homePageSectionSchema = z.discriminatedUnion("type", [
  homeHeroSectionSchema,
  homeTimelineSectionSchema,
  homeCardSectionSchema,
  homeProjectFeedSectionSchema,
  homePostFeedSectionSchema,
  homeCtaSectionSchema,
  homePlainSectionSchema,
])

export const homePageDataSchema = z.object({
  schemaVersion: z.preprocess(() => HOME_PAGE_SCHEMA_VERSION, z.literal(HOME_PAGE_SCHEMA_VERSION)),
  sections: z.array(homePageSectionSchema),
})

const strictHomeLinkSchema = z.object({
  label: z.string(),
  href: z.string(),
})

const strictHomeHeroCardSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  content: z.string(),
})

const strictHomeEntryItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  content: z.string(),
})

const strictHomeHeroSectionSchema = z.object({
  id: z.string().min(1),
  type: z.literal("hero"),
  visible: z.boolean(),
  layout: homeHeroLayoutSchema,
  theme: homeThemeSchema,
  eyebrow: z.string(),
  title: z.string(),
  content: z.string(),
  primaryCta: strictHomeLinkSchema,
  secondaryCta: strictHomeLinkSchema,
  cards: z.array(strictHomeHeroCardSchema),
})

const strictHomeCollectionSectionBaseSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
  theme: homeThemeSchema,
  title: z.string(),
  intro: z.string(),
  items: z.array(strictHomeEntryItemSchema),
})

const strictHomeTimelineSectionSchema = strictHomeCollectionSectionBaseSchema.extend({
  type: z.literal("timeline"),
})

const strictHomeCardSectionSchema = strictHomeCollectionSectionBaseSchema.extend({
  type: z.literal("cards"),
})

const strictHomeFeedSectionBaseSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
  theme: homeThemeSchema,
  title: z.string(),
  description: z.string(),
  limit: z.number().int().min(1).max(6),
})

const strictHomeProjectFeedSectionSchema = strictHomeFeedSectionBaseSchema.extend({
  type: z.literal("projectFeed"),
  layout: homeProjectFeedLayoutSchema,
})

const strictHomePostFeedSectionSchema = strictHomeFeedSectionBaseSchema.extend({
  type: z.literal("postFeed"),
  layout: homePostFeedLayoutSchema,
})

const strictHomeCtaSectionSchema = z.object({
  id: z.string().min(1),
  type: z.literal("cta"),
  visible: z.boolean(),
  layout: homeCtaLayoutSchema,
  theme: homeThemeSchema,
  title: z.string(),
  content: z.string(),
  primaryCta: strictHomeLinkSchema,
})

const strictHomePlainSectionSchema = z.object({
  id: z.string().min(1),
  type: z.literal("plain"),
  visible: z.boolean(),
  theme: homeThemeSchema,
  content: z.string(),
})

export const strictHomePageSectionSchema = z.discriminatedUnion("type", [
  strictHomeHeroSectionSchema,
  strictHomeTimelineSectionSchema,
  strictHomeCardSectionSchema,
  strictHomeProjectFeedSectionSchema,
  strictHomePostFeedSectionSchema,
  strictHomeCtaSectionSchema,
  strictHomePlainSectionSchema,
])

export const strictHomePageDataSchema = z.object({
  schemaVersion: z.literal(HOME_PAGE_SCHEMA_VERSION),
  sections: z.array(strictHomePageSectionSchema),
})

export type HomeHeroSection = z.infer<typeof homeHeroSectionSchema>
export type HomeTimelineSection = z.infer<typeof homeTimelineSectionSchema>
export type HomeCardSection = z.infer<typeof homeCardSectionSchema>
export type HomeProjectFeedSection = z.infer<typeof homeProjectFeedSectionSchema>
export type HomePostFeedSection = z.infer<typeof homePostFeedSectionSchema>
export type HomeCtaSection = z.infer<typeof homeCtaSectionSchema>
export type HomePlainSection = z.infer<typeof homePlainSectionSchema>
export type HomePageSection = z.infer<typeof homePageSectionSchema>
export type HomePageData = z.infer<typeof homePageDataSchema>
