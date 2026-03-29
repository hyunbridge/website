"use client"

export interface VersionHistoryEntry {
  id: string
  version_number: number
  title: string
  content: string
  summary?: string
  change_description: string | null
  created_at: string
  created_by: string | null
  creator?: {
    id: string
    username: string
    full_name: string | null
  } | null
}
