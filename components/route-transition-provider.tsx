"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { AnimatePresence, LayoutGroup, motion } from "framer-motion"
import { PAGE_TRANSITION } from "@/lib/motion"

export function RouteTransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="relative">
      <LayoutGroup id="app-route-transitions">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            transition={PAGE_TRANSITION}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </LayoutGroup>
    </div>
  )
}
