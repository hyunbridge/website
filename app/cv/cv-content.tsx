"use client"

import "./cv-print.css"
import { NotionRenderer } from "react-notion-x"
import "react-notion-x/src/styles.css"
import { useEffect, useState, useRef, type ComponentProps } from "react"

// Import required components for NotionRenderer
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"
import { FileWarning } from "lucide-react"
import { StatePanel } from "@/components/ui/state-panel"

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

type CVContentProps = {
  cv: {
    recordMap?: unknown
  } | null
  printMode?: boolean
}

type NotionRendererRecordMap = ComponentProps<typeof NotionRenderer>["recordMap"]

// Helper function to get last modified date
export function getLastModifiedTimestamp(recordMap: unknown): string | null {
  if (!recordMap || typeof recordMap !== "object" || !("block" in recordMap)) return null

  const block = recordMap.block
  if (!block || typeof block !== "object") return null

  const pageId = Object.keys(block)[0]
  const lastEditedTime = (block as Record<string, { value?: { last_edited_time?: string | number | null } } | null | undefined>)[pageId]?.value?.last_edited_time

  return lastEditedTime?.toString() || null
}

// Format the timestamp to human-readable format
export function formatLastModified(timestamp: string | number | null): string {
  if (!timestamp) return "Unknown"
  const normalizedTimestamp = typeof timestamp === "string" ? Number(timestamp) : timestamp
  const date = new Date(normalizedTimestamp)

  if (Number.isNaN(date.getTime())) {
    return "Unknown"
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function CVContent({ cv, printMode = false }: CVContentProps) {
  const [mounted, setMounted] = useState(false)
  const [printReady, setPrintReady] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(frameId)
  }, [])

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

  useEffect(() => {
    if (!mounted || !printMode) return

    const frameId = window.requestAnimationFrame(() => setPrintReady(true))
    return () => window.cancelAnimationFrame(frameId)
  }, [mounted, printMode])

  const isDarkMode = !printMode && mounted && document.documentElement.classList.contains("dark")
  const currentCv = cv

  if (!currentCv || !currentCv.recordMap) {
    return (
      <StatePanel
        className="max-w-lg"
        tone="danger"
        size="compact"
        icon={<FileWarning className="h-5 w-5" />}
        title="CV not found"
        description="The CV content could not be loaded."
      />
    )
  }

  const lastEditedTimestamp = getLastModifiedTimestamp(currentCv.recordMap)
  const formattedDate = formatLastModified(lastEditedTimestamp)

  return (
    <div
      ref={containerRef}
      className="notion-container print:notion-container dark:text-white"
      data-cv-print-ready={printMode && printReady ? "true" : undefined}
    >
      <NotionRenderer
        recordMap={currentCv.recordMap as NotionRendererRecordMap}
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
