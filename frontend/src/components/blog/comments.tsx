"use client"

import { useEffect, useRef, useState } from "react"

interface CommentsProps {
  postId: string
}

export function Comments({ postId }: CommentsProps) {
  const commentsRef = useRef<HTMLDivElement>(null)
  const scriptRef = useRef<HTMLScriptElement | null>(null)
  const [theme, setTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const updateTheme = () => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

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
    script.setAttribute("data-repo", import.meta.env.PUBLIC_GISCUS_REPO || "")
    script.setAttribute("data-repo-id", import.meta.env.PUBLIC_GISCUS_REPO_ID || "")
    script.setAttribute("data-category", import.meta.env.PUBLIC_GISCUS_CATEGORY || "")
    script.setAttribute("data-category-id", import.meta.env.PUBLIC_GISCUS_CATEGORY_ID || "")
    script.setAttribute("data-mapping", "specific")
    script.setAttribute("data-term", postId)
    script.setAttribute("data-strict", "1")
    script.setAttribute("data-reactions-enabled", "1")
    script.setAttribute("data-emit-metadata", "0")
    script.setAttribute("data-input-position", "top")
    script.setAttribute("data-theme", theme)
    script.setAttribute("data-lang", "ko")
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
  }, [postId, theme])

  return <div ref={commentsRef} className="mt-8" />
}
