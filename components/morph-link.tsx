"use client"

import type React from "react"
import Link, { type LinkProps } from "next/link"
import { useRouter } from "next/navigation"
import { useNavigationIntent } from "@/components/navigation-intent-provider"

type MorphIntent = "projects-detail" | "blog-detail"

type Props = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    morphIntent?: MorphIntent
  }

export function MorphLink({ href, morphIntent, onClick, onMouseEnter, onFocus, onTouchStart, ...props }: Props) {
  const router = useRouter()
  const { markIntent } = useNavigationIntent()
  const hrefString = typeof href === "string" ? href : href.pathname || ""

  const prefetch = () => {
    if (!hrefString) return
    router.prefetch(hrefString)
  }

  const markNavigationIntent = () => {
    if (!morphIntent) return
    markIntent({ kind: morphIntent, href: hrefString })
  }

  return (
    <Link
      href={href}
      {...props}
      onMouseEnter={(e) => {
        prefetch()
        onMouseEnter?.(e)
      }}
      onFocus={(e) => {
        prefetch()
        onFocus?.(e)
      }}
      onTouchStart={(e) => {
        prefetch()
        onTouchStart?.(e)
      }}
      onClick={(e) => {
        markNavigationIntent()
        onClick?.(e)
      }}
    />
  )
}
