"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NotionRenderer } from "react-notion-x"
import { X } from "lucide-react"
import "react-notion-x/src/styles.css"
import { useEffect, useState } from "react"
import { motion } from "framer-motion"

// Import required components for NotionRenderer
import dynamic from "next/dynamic"
import Image from "next/image"
import Link from "next/link"

// Dynamically import Prism.js to fix the "Prism is not defined" error
// We need to import the CSS first, then the actual Prism library
import "prismjs/themes/prism-tomorrow.css"
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
const Pdf = dynamic(() => import("react-notion-x/build/third-party/pdf").then((m) => m.Pdf), { ssr: false })
const Modal = dynamic(() => import("react-notion-x/build/third-party/modal").then((m) => m.Modal), { ssr: false })

export function ProjectDetail({ project, isModal = false }) {
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)

    // If this is a modal, prevent scrolling of the body
    if (isModal) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = "auto"
      }
    }
  }, [isModal])

  const isDarkMode = isMounted && document.documentElement.classList.contains("dark")

  const handleClose = () => {
    router.back()
  }

  const content = (
    <motion.div
      className="bg-card w-full rounded-lg shadow-lg overflow-hidden border border-border"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {isModal && (
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-card border-b">
          <h2 className="text-xl font-bold">{project.title}</h2>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
      )}

      <div className="p-6">
        {!isModal && <h1 className="text-3xl font-bold mb-4">{project.title}</h1>}

        {/* Cover Image */}
        <div className="w-full h-64 md:h-80 mb-6 overflow-hidden rounded-lg">
          <motion.img
            src={project.imageUrl || "/placeholder.svg?height=600&width=1200"}
            alt={project.title}
            className="w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {project.tags &&
            project.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
        </div>

        {isMounted && project.recordMap ? (
          <div className="notion-container dark:text-white hide-notion-properties">
            <NotionRenderer
              recordMap={project.recordMap}
              fullPage={false}
              darkMode={isDarkMode}
              components={{
                nextImage: Image,
                nextLink: Link,
                Code,
                Collection,
                Equation,
                Pdf,
                Modal,
              }}
              // Use mapPageUrl to handle Notion links properly
              mapPageUrl={(pageId) => `/projects/${pageId}`}
            />
          </div>
        ) : !isMounted ? (
          <div className="flex justify-center py-8">
            <div className="animate-pulse h-32 w-32 rounded-full bg-muted"></div>
          </div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div dangerouslySetInnerHTML={{ __html: project.content }} />
          </div>
        )}

        {project.links && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-medium mb-2">Links</h3>
            <div className="flex flex-wrap gap-2">
              {project.links.map((link) => (
                <Button key={link.url} variant="outline" size="sm" asChild>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.title}
                  </a>
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )

  return content
}

