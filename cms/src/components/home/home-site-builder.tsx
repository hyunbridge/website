"use client"

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable"
import { HomeBuilderAddSectionPicker } from "@/components/home/home-builder-add-section-picker"
import {
  SectionInsertMarker,
  SectionShell,
} from "@/components/home/home-site-builder-layout"
import {
  duplicateSection,
  insertSection,
  removeSection,
  reorderSections,
  updateSection,
} from "@/components/home/home-site-builder-state"
import type { Post } from "@/lib/blog-service"
import type { Project } from "@/lib/project-service"
import {
  homeSectionPresets,
  type HomePageData,
  type HomePageSection,
} from "@/lib/home-page-service"

type HomeSiteBuilderProps = {
  data: HomePageData
  projects: Project[]
  posts: Post[]
  editable?: boolean
  onChange?: (next: HomePageData) => void
}

export function HomeSiteBuilder({
  data,
  projects,
  posts,
  editable = false,
  onChange,
}: HomeSiteBuilderProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const sections = editable ? data.sections : data.sections.filter((section) => section.visible)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    onChange?.(reorderSections(data, String(active.id), String(over.id)))
  }

  const handleSectionChange = (
    sectionId: string,
    updater: (section: HomePageSection) => HomePageSection,
  ) => {
    onChange?.(updateSection(data, sectionId, updater))
  }

  return (
    <div className="relative overflow-x-clip rounded-[2.5rem] bg-[#f5f0e7] pb-14 text-foreground shadow-[0_30px_120px_rgba(15,23,42,0.12)] dark:bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(251,191,36,0.16),transparent_24%),radial-gradient(circle_at_88%_10%,rgba(14,165,233,0.14),transparent_24%),linear-gradient(180deg,#f7f1e8_0%,#f4efe7_42%,#f7f4ee_100%)] dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.98)_0%,rgba(2,6,23,1)_100%)]" />
      <div className="relative z-10 px-4 py-6 md:px-6 md:py-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={editable ? handleDragEnd : undefined}
        >
          <SortableContext
            items={sections.map((section) => section.id)}
            strategy={rectSortingStrategy}
          >
            {sections.length === 0 && editable ? (
              <div className="rounded-[2rem] border border-dashed border-border/60 bg-background/60 px-6 py-12 text-center">
                <div className="mx-auto max-w-md">
                  <p className="text-lg font-semibold tracking-tight">첫 섹션을 추가하세요</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    섹션을 선택해 추가하세요.
                  </p>
                  <HomeBuilderAddSectionPicker
                    presets={homeSectionPresets}
                    className="mt-5"
                    label="첫 블록 추가"
                    onSelect={(preset) => onChange?.(insertSection(data, 0, preset.create()))}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {sections.map((section, index) => (
                  <div key={section.id} className="space-y-3">
                    {editable ? (
                      <SectionInsertMarker
                        onSelect={(preset) =>
                          onChange?.(insertSection(data, index, preset.create()))
                        }
                      />
                    ) : null}
                    <SectionShell
                      section={section}
                      editable={editable}
                      onSectionChange={handleSectionChange}
                      onDuplicate={() => onChange?.(duplicateSection(data, section.id))}
                      onRemove={() => onChange?.(removeSection(data, section.id))}
                      projects={projects}
                      posts={posts}
                    />
                  </div>
                ))}
                {editable ? (
                  <SectionInsertMarker
                    onSelect={(preset) =>
                      onChange?.(insertSection(data, data.sections.length, preset.create()))
                    }
                  />
                ) : null}
              </div>
            )}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
