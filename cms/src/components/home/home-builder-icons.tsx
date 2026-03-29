"use client"

import {
  BookOpen,
  ContactRound,
  FileText,
  FolderKanban,
  LayoutTemplate,
  Mail,
  Sparkles,
} from "lucide-react"
import type { HomePageSection, HomeSectionPreset } from "@/lib/home-page-service"

export function HomeBuilderSectionIcon({
  section,
  className,
}: {
  section: HomePageSection
  className?: string
}) {
  if (section.type === "hero") return <LayoutTemplate className={className} />
  if (section.type === "cta") return <Mail className={className} />
  if (section.type === "projectFeed") return <FolderKanban className={className} />
  if (section.type === "postFeed") return <BookOpen className={className} />
  if (section.type === "plain") return <FileText className={className} />
  return section.type === "timeline" ? (
    <Sparkles className={className} />
  ) : (
    <LayoutTemplate className={className} />
  )
}

export function HomeBuilderPresetIcon({
  preset,
  className,
}: {
  preset: HomeSectionPreset
  className?: string
}) {
  if (preset.type === "projectFeed") return <FolderKanban className={className} />
  if (preset.type === "postFeed") return <BookOpen className={className} />
  if (preset.type === "cta") return <ContactRound className={className} />
  if (preset.type === "plain") return <FileText className={className} />
  return preset.type === "timeline" ? (
    <Sparkles className={className} />
  ) : (
    <LayoutTemplate className={className} />
  )
}
