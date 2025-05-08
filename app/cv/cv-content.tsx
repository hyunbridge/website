"use client"

import "./cv-print.css"
import { NotionRenderer } from "react-notion-x"
import { ErrorMessage } from "@/components/error-message"
import "react-notion-x/src/styles.css"
import { useEffect, useState, useRef } from "react"
import { browserNotionClient } from "@/lib/notion-client-browser"
import { CVSkeleton } from "./cv-skeleton"

// Import required components for NotionRenderer
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"

// Dynamically import Prism.js to fix the "Prism is not defined" error
import "prismjs/themes/prism.css"
import "prismjs"
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

// Helper function to get last modified date
export function getLastModifiedTimestamp(recordMap: any): string | null {
  if (!recordMap || !recordMap.block) return null
  const pageId = Object.keys(recordMap.block)[0]
  return recordMap.block[pageId]?.value?.last_edited_time || null
}

// Format the timestamp to human-readable format
export function formatLastModified(timestamp: number | null): string {
  if (!timestamp) return "Unknown"
  const date = new Date(timestamp)
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function CVContent({ cv, isDirectAccess = false }) {
  const [mounted, setMounted] = useState(false)
  const [clientCv, setClientCv] = useState(cv)
  const [loading, setLoading] = useState(!isDirectAccess)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)

    if (isDirectAccess && cv) return

    async function fetchCVData() {
      try {
        setLoading(true)
        const cvPageId = process.env.NEXT_NOTION_CV_PAGE_ID
        if (!cvPageId) throw new Error("CV page ID not found")
        const recordMap = await browserNotionClient.getPage(cvPageId)
        setClientCv({ pageId: cvPageId, recordMap })
      } catch (err) {
        setError("Failed to load CV content. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    if (!isDirectAccess) {
      fetchCVData()
    }
  }, [cv, isDirectAccess])

  // Group each Heading and its content until the next Heading or HR into one section
  useEffect(() => {
    if (!mounted) return
    const container = containerRef.current
    if (!container) return

    const elements = Array.from(container.children)
    container.innerHTML = ""
    
    let sectionDiv: HTMLDivElement | null = null

    elements.forEach((el) => {
      const tag = el.tagName
      
      // Start a new section when encountering a Heading
      if (/^H[1-6]$/.test(tag)) {
        const level = tag[1]
        sectionDiv = document.createElement("div")
        sectionDiv.className = `print-section-h${level}`
        container.appendChild(sectionDiv)
        sectionDiv.appendChild(el)
      }
      // End the current section when encountering an HR
      else if (tag === "HR") {
        container.appendChild(el)
        sectionDiv = null
      } 
      // Add to current section if one exists
      else if (sectionDiv) {
        sectionDiv.appendChild(el)
      } 
      // Add directly to container if no section is active
      else {
        container.appendChild(el)
      }

      // Override image loading & decoding attributes for print
      const imgs = container.querySelectorAll('img') || []
      imgs.forEach((img) => {
        img.loading = "eager"
        img.decoding = "sync"
      })
    })
  }, [mounted])

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

  if (mounted) {
    const lastEditedTimestamp = getLastModifiedTimestamp(currentCv.recordMap)
    const formattedDate = formatLastModified(lastEditedTimestamp)

    return (
      <div ref={containerRef} className="notion-container print:notion-container dark:text-white">
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
          mapPageUrl={(pageId) => `/cv?id=${pageId}`}
        />
        <p className="text-sm italic text-muted-foreground">Last updated on {formattedDate}.</p>
      </div>
    )
  }

  return <CVSkeleton />
}
