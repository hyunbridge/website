"use client"

import type React from "react"
import Link, { type LinkProps } from "@/components/ui/app-link"
import { useRouter } from "@/lib/app-router"
import { useNavigationIntent } from "@/components/navigation-intent-provider"
import type {
  NavigationIntentKind,
  NavigationIntentPayload,
} from "@/components/navigation-intent-provider"

type MorphIntent = NavigationIntentKind

type Props = LinkProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    morphIntent?: MorphIntent
    morphSource?: NavigationIntentPayload
  }

export function MorphLink({
  href,
  morphIntent,
  morphSource,
  onClick,
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Props) {
  const router = useRouter()
  const { markIntent } = useNavigationIntent()
  const hrefString = typeof href === "string" ? href : ""

  const prefetch = () => {
    if (!hrefString) return
    router.prefetch(hrefString)
  }

  const markNavigationIntent = () => {
    if (!morphIntent) return
    markIntent({ kind: morphIntent, href: hrefString, ...morphSource })
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
