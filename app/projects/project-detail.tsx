"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NotionRenderer } from "react-notion-x"
import { X, MessageSquare, ChevronDown } from "lucide-react"
import "react-notion-x/src/styles.css"
import { useEffect, useState, useRef } from "react"
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion"
import Link from "next/link"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

// Import required components for NotionRenderer
import dynamic from "next/dynamic"
import Image from "next/image"

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
  const [hasScrolled, setHasScrolled] = useState(false)
  const contentRef = useRef(null)
  const containerRef = useRef(null)

  // Scroll animation values
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  })

  // Transform values based on scroll position - enhanced blur effect
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.15])
  const imageBlur = useTransform(scrollYProgress, [0, 0.4], [0, 12])
  const gradientOpacity = useTransform(scrollYProgress, [0, 0.25], [0, 0.95])
  const scrollArrowOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0])

  useEffect(() => {
    setIsMounted(true)

    // If this is a modal, prevent scrolling of the body
    if (isModal) {
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = "auto"
      }
    }

    // Add scroll listener to detect when user has scrolled
    const handleScroll = () => {
      if (window.scrollY > 50 && !hasScrolled) {
        setHasScrolled(true)
      } else if (window.scrollY <= 50 && hasScrolled) {
        setHasScrolled(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [isModal, hasScrolled])

  const isDarkMode = isMounted && document.documentElement.classList.contains("dark")

  const handleClose = () => {
    router.back()
  }

  const handleScrollDown = () => {
    if (contentRef.current) {
      const cardTop = contentRef.current.getBoundingClientRect().top + window.scrollY
      const titleOffset = 100; // Offset to make the title visible

      window.scrollTo({
        top: cardTop - titleOffset,
        behavior: "smooth",
      })
    }
  }

  const content = (
    <div className="relative min-h-screen overflow-hidden" ref={containerRef} style={{ overscrollBehavior: 'none' }}>
      {/* Cover Image with parallax effect */}
      <div className="fixed top-0 left-0 w-full h-[120vh] z-0 overflow-hidden">
        <motion.div
          className="w-full h-full"
          style={{
            scale: imageScale,
          }}
        >
          <motion.img
            src={project.imageUrl || "/placeholder.svg?height=600&width=1200"}
            alt={project.title}
            className="w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{
              filter: `blur(${imageBlur.get()}px)`,
            }}
          />
          <motion.div
            className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background"
            style={{
              opacity: gradientOpacity,
              bottom: '-50px', // Extend gradient below
            }}
          />
        </motion.div>
      </div>

      <div className="relative min-h-screen pt-[70vh]" style={{ overscrollBehavior: 'contain' }}>
        {/* Scroll indicator arrow - Positioned above the content card */}
        <AnimatePresence>
          {!hasScrolled && (
              <motion.div
                  className="absolute left-0 right-0 mx-auto top-[calc(70vh-48px)] w-fit z-20"
                  initial={{ opacity: 1, y: 0 }}
                  animate={{
                    opacity: scrollArrowOpacity,
                    y: [0, 10, 0],
                  }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{
                    opacity: { duration: 0.3 },
                    y: { repeat: Number.POSITIVE_INFINITY, duration: 1.5, ease: "easeInOut" },
                  }}
                  onClick={handleScrollDown}
              >
                <div className="bg-background/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-border/50 cursor-pointer hover:bg-background/90 transition-colors">
                  <ChevronDown className="h-6 w-6 text-foreground" />
                </div>
              </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          ref={contentRef}
          className="bg-card w-full rounded-t-3xl shadow-2xl overflow-hidden border border-border z-10 relative min-h-[80vh]"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{
            boxShadow: "0 -10px 50px rgba(0, 0, 0, 0.15)",
          }}
        >
          {isModal && (
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-card border-b backdrop-blur-md bg-card/80">
              <h2 className="text-xl font-bold">{project.title}</h2>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          )}

          <div className="p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
              {!isModal && <h1 className="text-3xl font-bold mb-4">{project.title}</h1>}

              <div className="flex flex-wrap gap-2 mb-6">
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
                    mapPageUrl={(pageId) => `/projects/${project.slug || pageId}`}
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
                <div className="mt-8 pt-6 border-t">
                  <h3 className="font-medium mb-3">Links</h3>
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

              {/* Contact shortcut card */}
              <div className="mt-12">
                <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
                  <CardHeader>
                    <CardTitle className="text-xl">Have a question about {project.title}?</CardTitle>
                    <CardDescription>
                      Feel free to reach out if you'd like to know more about this project.
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button asChild>
                      <Link href="/contact" className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Get in touch
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )

  return content
}
