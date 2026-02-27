"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import NProgress from "nprogress"
import "nprogress/nprogress.css"
import { Suspense } from "react"

// Configure NProgress
NProgress.configure({
  showSpinner: false,
  minimum: 0.1,
  easing: "ease",
  speed: 300,
})

export function NavigationEvents() {
  return (
    <Suspense fallback={null}>
      <NavigationEventsContent />
    </Suspense>
  )
}

function NavigationEventsContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    NProgress.done()
    const resetNavigationTimeout = window.setTimeout(() => {
      setIsNavigating(false)
    }, 0)

    // Create a timeout to detect slow navigations
    const timeout = setTimeout(() => {
      if (isNavigating) {
        NProgress.start()
      }
    }, 100)

    return () => {
      clearTimeout(resetNavigationTimeout)
      clearTimeout(timeout)
    }
  }, [pathname, searchParams, isNavigating])

  useEffect(() => {
    const handleRouteChangeStart = () => {
      setIsNavigating(true)
    }

    const handleRouteChangeComplete = () => {
      setIsNavigating(false)
      NProgress.done()
    }

    window.addEventListener("beforeunload", handleRouteChangeStart)
    window.addEventListener("load", handleRouteChangeComplete)

    return () => {
      window.removeEventListener("beforeunload", handleRouteChangeStart)
      window.removeEventListener("load", handleRouteChangeComplete)
    }
  }, [])

  return null
}
