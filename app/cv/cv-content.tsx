"use client"

import { NotionRenderer } from "react-notion-x"
import { ErrorMessage } from "@/components/error-message"
import "react-notion-x/src/styles.css"
import { useEffect, useState } from "react"
import { browserNotionClient } from "@/lib/notion-client-browser"
import { CVSkeleton } from "./cv-skeleton"

// Import required components for NotionRenderer
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"

// Dynamically import Prism.js to fix the "Prism is not defined" error
import "prismjs/themes/prism.css"
import "prismjs"
// Additional Prism components for line numbers and other features
import "prismjs/components/prism-bash"
import "prismjs/components/prism-javascript"
import "prismjs/components/prism-typescript"
import "prismjs/components/prism-css"
import "prismjs/components/prism-jsx"
import "prismjs/components/prism-tsx"
import "prismjs/components/prism-json"

// Dynamic imports for NotionRenderer components
const Code = dynamic(() => import("react-notion-x/build/third-party/code").then((m) => m.Code), { ssr: false })
const Collection = dynamic(() => import("react-notion-x/build/third-party/collection").then((m) => m.Collection), {
  ssr: false,
})
const Equation = dynamic(() => import("react-notion-x/build/third-party/equation").then((m) => m.Equation), {
  ssr: false,
})

export function CVContent({ cv, isDirectAccess = false }) {
  const [mounted, setMounted] = useState(false)
  const [clientCv, setClientCv] = useState(cv)
  const [loading, setLoading] = useState(!isDirectAccess)
  const [error, setError] = useState(null)

  // Client-side fetch for CV data when navigating from another page
  useEffect(() => {
    setMounted(true)

    // If we already have the CV data from SSR, don't fetch again
    if (isDirectAccess && cv) return

    async function fetchCVData() {
      try {
        setLoading(true)
        // Get the CV page ID from environment variable
        const cvPageId = process.env.NEXT_NOTION_CV_PAGE_ID

        if (!cvPageId) {
          throw new Error("CV page ID not found")
        }

        // Use the browser-safe Notion client to fetch the page
        const recordMap = await browserNotionClient.getPage(cvPageId)

        setClientCv({
          pageId: cvPageId,
          recordMap,
        })
      } catch (err) {
        console.error("Error loading CV:", err)
        setError("Failed to load CV content. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    if (!isDirectAccess) {
      fetchCVData()
    }
  }, [cv, isDirectAccess])

  const isDarkMode = mounted && document.documentElement.classList.contains("dark")
  const currentCv = clientCv || cv

  if (loading) {
    return <CVSkeleton />
  }

  if (error) {
    return <ErrorMessage title="Failed to load CV" message={error} />
  }

  if (!currentCv || !currentCv.recordMap) {
    return <ErrorMessage title="CV not found" message="The CV content could not be loaded." />
  }

  // If we have a Notion record map, render it with NotionRenderer
  if (mounted) {
    const lastEdited = () => {
      const pageId = Object.keys(currentCv.recordMap.block)[0] // First block is the page block
      const lastEditedTimestamp = currentCv.recordMap.block[pageId]?.value?.last_edited_time

      if (!lastEditedTimestamp) return "Unknown"

      // Format date as "17 Dec 2024"
      const date = new Date(lastEditedTimestamp)
      const formattedDate = date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })

      return formattedDate
    }

    return (
      <div className="notion-container print:notion-container dark:text-white">
        <NotionRenderer
          recordMap={currentCv.recordMap}
          fullPage={false}
          darkMode={isDarkMode}
          components={{
            nextImage: Image,
            nextLink: Link,
            Code,
            Collection,
            Equation,
          }}
          // Use mapPageUrl to handle Notion links properly
          mapPageUrl={(pageId) => `/cv?id=${pageId}`}
        />
        <p className="text-sm italic text-muted-foreground">Last updated on {lastEdited()}.</p>
      </div>
    )
  }

  return <CVSkeleton />
}

