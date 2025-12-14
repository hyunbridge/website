"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface NotionImageProps {
    src: string
    alt: string
    className?: string
    fill?: boolean
    width?: number
    height?: number
    priority?: boolean
    quality?: number
    style?: React.CSSProperties
}

export function NotionImage({
    src,
    alt,
    className,
    fill = false,
    width,
    height,
    priority = false,
    quality = 75,
    style
}: NotionImageProps) {
    const [isLoading, setIsLoading] = useState(true)
    const [imgSrc, setImgSrc] = useState<string>("")
    const [isError, setIsError] = useState(false)

    useEffect(() => {
        if (!src) {
            setIsError(true)
            setIsLoading(false)
            return
        }

        // Check if it's a Notion URL that needs proxying
        const isNotionUrl =
            src.includes("amazonaws.com") ||
            src.includes("notion-static.com") ||
            src.includes("notion.so") ||
            src.includes("unsplash.com")

        if (isNotionUrl) {
            // Logic to construct a stable CDN-friendly path
            // Format: /api/image/[UUID]/[FILENAME]?url=...
            // If we have a CDN_URL configured, we prepend it.

            let proxyPath = "/api/image"

            try {
                const urlObj = new URL(src)
                // specific logic for notion s3 urls to get a stable path
                // Notion S3 URLs often look like: https://s3.us-west-2.amazonaws.com/secure.notion-static.com/[UUID]/[FILENAME]

                const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
                const uuidMatch = src.match(uuidRegex)

                if (uuidMatch) {
                    const uuid = uuidMatch[1]
                    const filename = urlObj.pathname.split('/').pop() || "image"
                    proxyPath = `/api/image/${uuid}/${filename}`
                }
            } catch (e) {
                // If parsing fails, fall back to simple proxy
                console.warn("Failed to parse Notion URL for stable path", e)
            }

            const cdnUrl = process.env.NEXT_PUBLIC_CDN_URL
            const fullPath = cdnUrl
                ? `${cdnUrl}${proxyPath}?url=${encodeURIComponent(src)}`
                : `${proxyPath}?url=${encodeURIComponent(src)}`

            setImgSrc(fullPath)
        } else {
            // Use directly
            setImgSrc(src)
        }
    }, [src])

    const handleLoad = () => {
        setIsLoading(false)
    }

    const handleError = () => {
        setIsLoading(false)
        setIsError(true)
    }

    return (
        <div className={cn("relative overflow-hidden", className, !fill && "inline-block")} style={style}>
            <AnimatePresence>
                {isLoading && (
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5 }}
                        className="absolute inset-0 z-10"
                    >
                        <Skeleton className="h-full w-full rounded-none" />
                    </motion.div>
                )}
            </AnimatePresence>

            {!isError ? (
                imgSrc && (fill ? (
                    <Image
                        src={imgSrc}
                        alt={alt}
                        fill
                        className={cn("object-cover transition-opacity duration-500", isLoading ? "opacity-0" : "opacity-100")}
                        onLoad={handleLoad}
                        onError={handleError}
                        priority={priority}
                        quality={quality}
                        unoptimized={true} // Since we are already proxying or it's external
                    />
                ) : (
                    <Image
                        src={imgSrc}
                        alt={alt}
                        width={width || 600}
                        height={height || 400}
                        className={cn("object-cover transition-opacity duration-500", isLoading ? "opacity-0" : "opacity-100")}
                        onLoad={handleLoad}
                        onError={handleError}
                        priority={priority}
                        quality={quality}
                        unoptimized={true}
                    />
                ))
            ) : (
                <div className="flex items-center justify-center bg-muted h-full w-full text-muted-foreground text-xs p-2 text-center">
                    Failed to load
                </div>
            )}
        </div>
    )
}
