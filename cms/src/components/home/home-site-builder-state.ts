import { arrayMove } from "@dnd-kit/sortable"

import {
  duplicateHomePageSection,
  type HomePageData,
  type HomePageSection,
} from "@/lib/home-page-service"

export function updateSection(
  data: HomePageData,
  sectionId: string,
  updater: (section: HomePageSection) => HomePageSection,
) {
  return {
    ...data,
    sections: data.sections.map((section) =>
      section.id === sectionId ? updater(section) : section,
    ),
  }
}

export function reorderSections(data: HomePageData, activeId: string, overId: string) {
  const oldIndex = data.sections.findIndex((section) => section.id === activeId)
  const newIndex = data.sections.findIndex((section) => section.id === overId)
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return data
  return { ...data, sections: arrayMove(data.sections, oldIndex, newIndex) }
}

export function removeSection(data: HomePageData, sectionId: string) {
  return {
    ...data,
    sections: data.sections.filter((section) => section.id !== sectionId),
  }
}

export function insertSection(data: HomePageData, index: number, section: HomePageSection) {
  const sections = [...data.sections]
  sections.splice(index, 0, section)
  return {
    ...data,
    sections,
  }
}

export function duplicateSection(data: HomePageData, sectionId: string) {
  const index = data.sections.findIndex((section) => section.id === sectionId)
  if (index === -1) return data

  const source = data.sections[index]
  const copy = duplicateHomePageSection(source)
  const sections = [...data.sections]
  sections.splice(index + 1, 0, copy)

  return {
    ...data,
    sections,
  }
}
