"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

interface CommentsProps {
  postId: string
}

export function Comments({ postId }: CommentsProps) {
  const { resolvedTheme } = useTheme()
  const commentsRef = useRef<HTMLDivElement>(null)
  const scriptRef = useRef<HTMLScriptElement | null>(null)

  useEffect(() => {
    if (!commentsRef.current) return

    // Remove existing script if it exists
    if (scriptRef.current) {
      scriptRef.current.remove()
    }

    // Clear the comments container
    commentsRef.current.innerHTML = ""

    // Create and append the script
    const script = document.createElement("script")
    script.src = "https://giscus.app/client.js"
    script.setAttribute("data-repo", process.env.NEXT_PUBLIC_GISCUS_REPO || "")
    script.setAttribute("data-repo-id", process.env.NEXT_PUBLIC_GISCUS_REPO_ID || "")
    script.setAttribute("data-category", process.env.NEXT_PUBLIC_GISCUS_CATEGORY || "")
    script.setAttribute("data-category-id", process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID || "")
    script.setAttribute("data-mapping", "specific")
    script.setAttribute("data-term", postId)
    script.setAttribute("data-strict", "1")
    script.setAttribute("data-reactions-enabled", "1")
    script.setAttribute("data-emit-metadata", "0")
    script.setAttribute("data-input-position", "top")
    script.setAttribute("data-theme", resolvedTheme === "dark" ? "dark" : "light")
    script.setAttribute("data-lang", "en")
    script.setAttribute("data-loading", "lazy")
    script.setAttribute("crossorigin", "anonymous")
    script.async = true

    commentsRef.current.appendChild(script)
    scriptRef.current = script

    return () => {
      if (scriptRef.current) {
        scriptRef.current.remove()
      }
    }
  }, [postId, resolvedTheme])

  return <div ref={commentsRef} className="mt-8" />
}
