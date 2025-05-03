"use client"

import { useEffect } from "react"

/**
 * Hook to show a confirmation dialog when the user tries to leave the page
 * @param shouldWarn Boolean or callback that returns a boolean indicating if the warning should be shown
 */
export function useBeforeUnload(shouldWarn: boolean | (() => boolean)) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const shouldShowWarning = typeof shouldWarn === "function" ? shouldWarn() : shouldWarn

      if (shouldShowWarning) {
        // Standard way to show a confirmation dialog before leaving the page
        e.preventDefault()
        e.returnValue = ""
        return ""
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [shouldWarn])
}
