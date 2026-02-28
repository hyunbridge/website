"use client"

import type React from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { MORPH_LAYOUT_TRANSITION } from "@/lib/motion"
import { cn } from "@/lib/utils"

type SharedContentKind = "blog" | "project"

export function getSharedContentLayoutId(kind: SharedContentKind, element: "image" | "title", itemId: string) {
  return `${kind}-${element}-${itemId}`
}

type SharedTransitionImageProps = {
  kind: SharedContentKind
  itemId: string
  src: string
  alt: string
  containerClassName?: string
  imageClassName?: string
  overlayClassName?: string
  sizes?: string
  priority?: boolean
}

export function SharedTransitionImage({
  kind,
  itemId,
  src,
  alt,
  containerClassName,
  imageClassName,
  overlayClassName,
  sizes,
  priority = false,
}: SharedTransitionImageProps) {
  return (
    <motion.div
      layoutId={getSharedContentLayoutId(kind, "image", itemId)}
      transition={MORPH_LAYOUT_TRANSITION}
      className={cn("relative overflow-hidden", containerClassName)}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        className={cn("object-cover", imageClassName)}
        unoptimized
        priority={priority}
      />
      {overlayClassName ? <div className={cn("pointer-events-none absolute inset-0", overlayClassName)} /> : null}
    </motion.div>
  )
}

type SharedTransitionTitleProps = {
  kind: SharedContentKind
  itemId: string
  children: React.ReactNode
  className?: string
}

export function SharedTransitionTitle({ kind, itemId, children, className }: SharedTransitionTitleProps) {
  return (
    <motion.div
      layoutId={getSharedContentLayoutId(kind, "title", itemId)}
      transition={MORPH_LAYOUT_TRANSITION}
      className={className}
    >
      {children}
    </motion.div>
  )
}
