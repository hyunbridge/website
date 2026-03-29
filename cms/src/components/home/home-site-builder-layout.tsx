"use client"

import type { ReactNode } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Grid2x2, LayoutTemplate, List, Palette, Rows3 } from "lucide-react"

import { Button } from "@shared/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { HomeBuilderAddSectionPicker } from "@/components/home/home-builder-add-section-picker"
import { HomeBuilderSectionIcon } from "@/components/home/home-builder-icons"
import { HomeBuilderSectionToolbar } from "@/components/home/home-builder-section-toolbar"
import { HomeSectionContent } from "@/components/home/home-site-builder-sections"
import type { Post } from "@/lib/blog-service"
import type { Project } from "@/lib/project-service"
import { homeSectionPresets } from "@/lib/home-page-service"
import type {
  HomeCtaSection,
  HomeHeroSection,
  HomePageData,
  HomePageSection,
  HomePostFeedSection,
  HomeProjectFeedSection,
  HomeTheme,
} from "@/lib/home-page-service"

const sectionTypeLabel: Record<HomePageSection["type"], string> = {
  hero: "히어로",
  timeline: "타임라인",
  cards: "카드",
  projectFeed: "프로젝트",
  postFeed: "글",
  cta: "CTA",
  plain: "플레인",
}

const themeOptions: Array<{ value: HomeTheme; label: string }> = [
  { value: "default", label: "기본" },
  { value: "accent", label: "강조" },
]

function getThemeClasses(theme: HomeTheme) {
  if (theme === "accent") {
    return "border-amber-200/70 bg-[linear-gradient(180deg,rgba(255,252,244,0.98),rgba(245,249,255,0.94))] dark:border-slate-700/70 dark:bg-[linear-gradient(180deg,rgba(37,32,24,0.96),rgba(15,23,42,0.92))]"
  }
  return "border-border/60 bg-white/92 dark:bg-card/82 dark:border-border/60"
}

export function SectionShell({
  section,
  editable,
  onSectionChange,
  onDuplicate,
  onRemove,
  projects,
  posts,
}: {
  section: HomePageSection
  editable: boolean
  onSectionChange: (
    sectionId: string,
    updater: (section: HomePageSection) => HomePageSection,
  ) => void
  onDuplicate: () => void
  onRemove: () => void
  projects: Project[]
  posts: Post[]
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: !editable,
  })

  return (
    <section
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.72 : 1,
      }}
      className={`mx-auto max-w-6xl ${section.visible ? "" : editable ? "opacity-60" : "hidden"}`}
    >
      <div
        className={`overflow-hidden rounded-[2.25rem] border shadow-[0_20px_70px_rgba(15,23,42,0.08)] ${getThemeClasses(section.theme)}`}
      >
        {editable ? (
          <HomeBuilderSectionToolbar
            section={section}
            title={sectionTypeLabel[section.type]}
            icon={<HomeBuilderSectionIcon section={section} className="h-3.5 w-3.5" />}
            controls={
              <div className="flex flex-wrap items-center gap-2">
                <ToolbarDropdownControl
                  label="테마"
                  value={section.theme}
                  icon={<Palette className="h-3.5 w-3.5" />}
                  options={themeOptions}
                  onChange={(value) =>
                    onSectionChange(section.id, (current) => ({
                      ...current,
                      theme: value as HomeTheme,
                    }))
                  }
                />
                {getSectionLayoutControls(section, onSectionChange)}
              </div>
            }
            onVisibilityChange={(checked) =>
              onSectionChange(section.id, (current) => ({ ...current, visible: checked }))
            }
            onDuplicate={onDuplicate}
            onRemove={onRemove}
            attributes={attributes}
            listeners={listeners}
          />
        ) : null}

        <HomeSectionContent
          section={section}
          editable={editable}
          onChange={onSectionChange}
          projects={projects}
          posts={posts}
        />
      </div>
    </section>
  )
}

export function SectionInsertMarker({
  onSelect,
}: {
  onSelect: (preset: (typeof homeSectionPresets)[number]) => void
}) {
  return (
    <div className="group flex items-center gap-3 py-1">
      <div className="h-px flex-1 bg-border/60 transition-colors group-hover:bg-foreground/20" />
      <HomeBuilderAddSectionPicker presets={homeSectionPresets} compact onSelect={onSelect} />
      <div className="h-px flex-1 bg-border/60 transition-colors group-hover:bg-foreground/20" />
    </div>
  )
}

function getSectionLayoutControls(
  section: HomePageSection,
  onSectionChange: (
    sectionId: string,
    updater: (section: HomePageSection) => HomePageSection,
  ) => void,
) {
  if (section.type === "hero") {
    return (
      <ToolbarDropdownControl
        label="레이아웃"
        value={section.layout}
        icon={<LayoutTemplate className="h-3.5 w-3.5" />}
        options={[
          { value: "split", label: "분할" },
          { value: "centered", label: "중앙" },
        ]}
        onChange={(value) =>
          onSectionChange(section.id, (current) => ({
            ...(current as HomeHeroSection),
            layout: value as HomeHeroSection["layout"],
          }))
        }
      />
    )
  }

  if (section.type === "projectFeed") {
    return (
      <>
        <ToolbarDropdownControl
          label="레이아웃"
          value={section.layout}
          icon={<LayoutTemplate className="h-3.5 w-3.5" />}
          options={[
            { value: "spotlight", label: "스포트라이트" },
            { value: "grid", label: "그리드" },
          ]}
          onChange={(value) =>
            onSectionChange(section.id, (current) => ({
              ...(current as HomeProjectFeedSection),
              layout: value as HomeProjectFeedSection["layout"],
            }))
          }
        />
        <ToolbarDropdownControl
          label="노출 수"
          value={String(section.limit)}
          icon={<Rows3 className="h-3.5 w-3.5" />}
          options={["2", "3", "4", "5", "6"].map((value) => ({ value, label: value }))}
          onChange={(value) =>
            onSectionChange(section.id, (current) => ({
              ...(current as HomeProjectFeedSection),
              limit: Number(value),
            }))
          }
        />
      </>
    )
  }

  if (section.type === "postFeed") {
    return (
      <>
        <ToolbarDropdownControl
          label="레이아웃"
          value={section.layout}
          icon={
            section.layout === "cards" ? (
              <Grid2x2 className="h-3.5 w-3.5" />
            ) : (
              <List className="h-3.5 w-3.5" />
            )
          }
          options={[
            { value: "list", label: "리스트" },
            { value: "cards", label: "카드" },
          ]}
          onChange={(value) =>
            onSectionChange(section.id, (current) => ({
              ...(current as HomePostFeedSection),
              layout: value as HomePostFeedSection["layout"],
            }))
          }
        />
        <ToolbarDropdownControl
          label="노출 수"
          value={String(section.limit)}
          icon={<Rows3 className="h-3.5 w-3.5" />}
          options={["2", "3", "4", "5", "6"].map((value) => ({ value, label: value }))}
          onChange={(value) =>
            onSectionChange(section.id, (current) => ({
              ...(current as HomePostFeedSection),
              limit: Number(value),
            }))
          }
        />
      </>
    )
  }

  if (section.type === "cta") {
    return (
      <ToolbarDropdownControl
        label="레이아웃"
        value={section.layout}
        icon={<LayoutTemplate className="h-3.5 w-3.5" />}
        options={[
          { value: "split", label: "분할" },
          { value: "centered", label: "중앙" },
        ]}
        onChange={(value) =>
          onSectionChange(section.id, (current) => ({
            ...(current as HomeCtaSection),
            layout: value as HomeCtaSection["layout"],
          }))
        }
      />
    )
  }

  return null
}

function ToolbarDropdownControl({
  label,
  value,
  icon,
  options,
  onChange,
}: {
  label: string
  value: string
  icon: ReactNode
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  const selected = options.find((option) => option.value === value)?.label || value

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-2 text-foreground shadow-none">
          {icon}
          <span className="text-muted-foreground">{label}</span>
          <span>{selected}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export type { HomePageData }
