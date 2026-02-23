"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { PAGE_TRANSITION } from "@/lib/motion"
import { useNavigationIntent } from "@/components/navigation-intent-provider"

const MORPH_FREEZE_MS = 220

function isMorphDestination(pathname: string, intentHref: string) {
  return pathname === intentHref
}

export function RouteTransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { getRecentIntent, clearIntent } = useNavigationIntent()
  const [displayPathname, setDisplayPathname] = useState(pathname)
  const [displayChildren, setDisplayChildren] = useState(children)
  const isAdminRoute = displayPathname.startsWith("/admin")
  const prefersMorphOnlyTransition = displayPathname.startsWith("/projects") || displayPathname.startsWith("/blog")
  const rootTransitionKey = isAdminRoute ? "/admin-shell" : displayPathname
  const freezeTimeoutRef = useRef<number | null>(null)
  const pendingRef = useRef<{ pathname: string; children: React.ReactNode } | null>(null)
  const isFrozenRef = useRef(false)

  useEffect(() => {
    return () => {
      if (freezeTimeoutRef.current) {
        window.clearTimeout(freezeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (pathname === displayPathname) {
      if (!isFrozenRef.current) {
        setDisplayChildren((prev) => (prev === children ? prev : children))
      } else {
        pendingRef.current = { pathname, children }
      }
      return
    }

    const recentIntent = getRecentIntent()
    const shouldFreeze = !!recentIntent && isMorphDestination(pathname, recentIntent.href)

    if (!shouldFreeze) {
      if (freezeTimeoutRef.current) {
        window.clearTimeout(freezeTimeoutRef.current)
        freezeTimeoutRef.current = null
      }
      isFrozenRef.current = false
      pendingRef.current = null
      setDisplayPathname(pathname)
      setDisplayChildren(children)
      clearIntent()
      return
    }

    pendingRef.current = { pathname, children }
    isFrozenRef.current = true

    if (freezeTimeoutRef.current) {
      window.clearTimeout(freezeTimeoutRef.current)
    }

    freezeTimeoutRef.current = window.setTimeout(() => {
      const pending = pendingRef.current
      if (pending) {
        setDisplayPathname(pending.pathname)
        setDisplayChildren(pending.children)
      }
      pendingRef.current = null
      isFrozenRef.current = false
      freezeTimeoutRef.current = null
      clearIntent()
    }, MORPH_FREEZE_MS)
  }, [pathname, children, displayPathname, getRecentIntent, clearIntent])

  return (
    <div className="relative bg-background">
      <LayoutGroup id="app-route-transitions">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={rootTransitionKey}
            initial={
              prefersMorphOnlyTransition
                ? { y: 0 }
                : isAdminRoute
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 8 }
            }
            animate={{ opacity: 1, y: 0 }}
            exit={
              prefersMorphOnlyTransition
                ? { y: 0 }
                : isAdminRoute
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 8 }
            }
            transition={PAGE_TRANSITION}
            className="bg-background"
          >
            {displayChildren}
          </motion.div>
        </AnimatePresence>
      </LayoutGroup>
    </div>
  )
}
