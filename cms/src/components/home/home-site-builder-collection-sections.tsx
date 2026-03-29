"use client"

import { Plus, Trash2 } from "lucide-react"

import { Button } from "@shared/components/ui/button"
import { Card, CardContent } from "@shared/components/ui/card"

import type {
  HomeCardSection,
  HomeEntryItem,
  HomeHeroCard,
  HomeHeroSection,
  HomePageSection,
  HomeTimelineSection,
} from "@/lib/home-page-service"
import { createParagraphRichContent, generateHomeId } from "@/lib/home-page-service"
import {
  EditableInput,
  EditableLinkButton,
  IconButton,
  RichContentField,
} from "@/components/home/home-site-builder-fields"

type HomeSectionChange = (
  sectionId: string,
  updater: (section: HomePageSection) => HomePageSection,
) => void

export function HeroSectionView({
  section,
  editable,
  onChange,
}: {
  section: HomeHeroSection
  editable: boolean
  onChange: HomeSectionChange
}) {
  const isCentered = section.layout === "centered"
  const update = (updater: (current: HomeHeroSection) => HomeHeroSection) =>
    onChange(section.id, (current) => updater(current as HomeHeroSection))

  return (
    <div
      className={`grid gap-6 px-5 py-6 md:px-8 md:py-8 ${isCentered ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start xl:gap-10"}`}
    >
      <div className={isCentered ? "mx-auto max-w-4xl text-center" : "max-w-3xl"}>
        <EditableInput
          value={section.eyebrow}
          onChange={(value) => update((current) => ({ ...current, eyebrow: value }))}
          editable={editable}
          className="text-xs font-medium uppercase tracking-[0.32em] text-muted-foreground"
        />
        <EditableInput
          value={section.title}
          onChange={(value) => update((current) => ({ ...current, title: value }))}
          editable={editable}
          className="mt-4 text-3xl font-semibold leading-[1.06] tracking-tight text-foreground sm:text-4xl md:text-5xl"
        />
        <RichContentField
          value={section.content}
          onChange={(content) => update((current) => ({ ...current, content }))}
          editable={editable}
          className="mt-5"
        />
        <div className={`mt-6 flex flex-wrap gap-3 ${isCentered ? "justify-center" : ""}`}>
          <EditableLinkButton
            editable={editable}
            label={section.primaryCta.label}
            href={section.primaryCta.href}
            variant="primary"
            onChange={(next) => update((current) => ({ ...current, primaryCta: next }))}
          />
          <EditableLinkButton
            editable={editable}
            label={section.secondaryCta.label}
            href={section.secondaryCta.href}
            variant="secondary"
            onChange={(next) => update((current) => ({ ...current, secondaryCta: next }))}
          />
        </div>
      </div>

      <div
        className={`grid gap-4 ${isCentered ? "justify-items-center sm:grid-cols-2 xl:grid-cols-3" : "justify-items-start sm:grid-cols-2 xl:grid-cols-1 xl:justify-self-end"}`}
      >
        {section.cards.map((card) => (
          <HeroCardEditor
            key={card.id}
            card={card}
            editable={editable}
            onChange={(nextCard) =>
              update((current) => ({
                ...current,
                cards: current.cards.map((entry) => (entry.id === nextCard.id ? nextCard : entry)),
              }))
            }
            onRemove={() =>
              update((current) => ({
                ...current,
                cards: current.cards.filter((entry) => entry.id !== card.id),
              }))
            }
          />
        ))}
        {editable ? (
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              update((current) => ({
                ...current,
                cards: [
                  ...current.cards,
                  {
                    id: generateHomeId("hero-card"),
                    title: "새 카드",
                    content: createParagraphRichContent("내용을 입력하세요."),
                  },
                ],
              }))
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            카드 추가
          </Button>
        ) : null}
      </div>
    </div>
  )
}

function HeroCardEditor({
  card,
  editable,
  onChange,
  onRemove,
}: {
  card: HomeHeroCard
  editable: boolean
  onChange: (card: HomeHeroCard) => void
  onRemove: () => void
}) {
  return (
    <Card className="w-full max-w-[22rem] rounded-[1.8rem] border-border/50 bg-background/72 shadow-none backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <EditableInput
            value={card.title}
            onChange={(value) => onChange({ ...card, title: value })}
            editable={editable}
            className="text-lg font-semibold tracking-tight text-foreground"
          />
          {editable ? (
            <IconButton label="카드 삭제" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </IconButton>
          ) : null}
        </div>
        <RichContentField
          value={card.content}
          onChange={(content) => onChange({ ...card, content })}
          editable={editable}
          className="mt-4"
          editorClassName="min-h-[8rem]"
        />
      </CardContent>
    </Card>
  )
}

function CollectionSectionEditor({
  section,
  editable,
  onChange,
  isCards,
}: {
  section: HomeTimelineSection | HomeCardSection
  editable: boolean
  onChange: HomeSectionChange
  isCards: boolean
}) {
  const update = (
    updater: (
      current: HomeTimelineSection | HomeCardSection,
    ) => HomeTimelineSection | HomeCardSection,
  ) => onChange(section.id, (current) => updater(current as HomeTimelineSection | HomeCardSection))

  return (
    <div className="px-5 py-6 md:px-8 md:py-8">
      <EditableInput
        value={section.title}
        onChange={(value) => update((current) => ({ ...current, title: value }))}
        editable={editable}
        className="text-2xl font-semibold tracking-tight md:text-[2rem]"
      />
      <RichContentField
        value={section.intro}
        onChange={(intro) => update((current) => ({ ...current, intro }))}
        editable={editable}
        className="mt-4 max-w-3xl"
        editorClassName="min-h-[8rem]"
      />

      <div className={`mt-6 ${isCards ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "space-y-4"}`}>
        {section.items.map((item) => (
          <EntryItemEditor
            key={item.id}
            item={item}
            editable={editable}
            variant={isCards ? "card" : "timeline"}
            onChange={(nextItem) =>
              update((current) => ({
                ...current,
                items: current.items.map((entry) => (entry.id === nextItem.id ? nextItem : entry)),
              }))
            }
            onRemove={() =>
              update((current) => ({
                ...current,
                items: current.items.filter((entry) => entry.id !== item.id),
              }))
            }
          />
        ))}
      </div>

      {editable ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              update((current) => ({
                ...current,
                items: [
                  ...current.items,
                  {
                    id: generateHomeId("entry"),
                    title: "새 항목",
                    content: createParagraphRichContent("내용을 입력하세요."),
                  },
                ],
              }))
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            항목 추가
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function TimelineSectionView(props: {
  section: HomeTimelineSection
  editable: boolean
  onChange: HomeSectionChange
}) {
  return <CollectionSectionEditor {...props} isCards={false} />
}

export function CardsSectionView(props: {
  section: HomeCardSection
  editable: boolean
  onChange: HomeSectionChange
}) {
  return <CollectionSectionEditor {...props} isCards />
}

function EntryItemEditor({
  item,
  editable,
  variant,
  onChange,
  onRemove,
}: {
  item: HomeEntryItem
  editable: boolean
  variant: "card" | "timeline"
  onChange: (item: HomeEntryItem) => void
  onRemove: () => void
}) {
  if (variant === "timeline") {
    return (
      <div className="grid gap-4 md:grid-cols-[1.4rem_minmax(0,46rem)] md:justify-start">
        <div className="relative flex justify-center">
          <span className="absolute inset-y-0 w-px bg-border/70" />
          <span className="relative mt-2 h-3 w-3 rounded-full border-2 border-background bg-foreground" />
        </div>
        <div className="rounded-[1.9rem] border border-border/50 bg-background/70 p-5 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <EditableInput
                value={item.title}
                onChange={(value) => onChange({ ...item, title: value })}
                editable={editable}
                className="text-lg font-semibold tracking-tight text-foreground"
              />
            </div>
            {editable ? (
              <IconButton label="항목 삭제" onClick={onRemove}>
                <Trash2 className="h-4 w-4" />
              </IconButton>
            ) : null}
          </div>
          <RichContentField
            value={item.content}
            onChange={(content) => onChange({ ...item, content })}
            editable={editable}
            className="mt-4"
            editorClassName="min-h-[8rem]"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[1.9rem] border border-border/50 bg-background/70 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <EditableInput
            value={item.title}
            onChange={(value) => onChange({ ...item, title: value })}
            editable={editable}
            className="text-lg font-semibold tracking-tight text-foreground"
          />
        </div>
        {editable ? (
          <IconButton label="항목 삭제" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        ) : null}
      </div>
      <RichContentField
        value={item.content}
        onChange={(content) => onChange({ ...item, content })}
        editable={editable}
        className="mt-4"
        editorClassName="min-h-[8rem]"
      />
    </div>
  )
}
