"use client"

import type React from "react"
import { createContext, useCallback, useContext, useMemo, useState } from "react"

export type NavigationIntentKind = "projects-detail" | "blog-detail" | "projects-list" | "blog-list"

export type NavigationIntentPayload = {
  itemId?: string
  title?: string
  coverImage?: string | null
}

type NavigationIntent = {
  kind: NavigationIntentKind
  href: string
  createdAt: number
} & NavigationIntentPayload

type PendingNavigationIntent = Omit<NavigationIntent, "createdAt">

type NavigationIntentContextValue = {
  markIntent: (intent: PendingNavigationIntent) => void
  getRecentIntent: () => NavigationIntent | null
  clearIntent: () => void
}

const INTENT_TTL_MS = 5000

const NavigationIntentContext = createContext<NavigationIntentContextValue | null>(null)

export function NavigationIntentProvider({ children }: { children: React.ReactNode }) {
  const [intent, setIntent] = useState<NavigationIntent | null>(null)

  const markIntent = useCallback((nextIntent: PendingNavigationIntent) => {
    setIntent({
      ...nextIntent,
      createdAt: Date.now(),
    })
  }, [])

  const getRecentIntent = useCallback(() => {
    if (!intent) return null
    if (Date.now() - intent.createdAt > INTENT_TTL_MS) return null
    return intent
  }, [intent])

  const clearIntent = useCallback(() => {
    setIntent(null)
  }, [])

  const value = useMemo(
    () => ({
      markIntent,
      getRecentIntent,
      clearIntent,
    }),
    [markIntent, getRecentIntent, clearIntent],
  )

  return <NavigationIntentContext.Provider value={value}>{children}</NavigationIntentContext.Provider>
}

export function useNavigationIntent() {
  const context = useContext(NavigationIntentContext)
  if (!context) {
    throw new Error("useNavigationIntent must be used within NavigationIntentProvider")
  }
  return context
}
