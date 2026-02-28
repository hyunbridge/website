"use client"

import type { MouseEventHandler, ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { MorphLink } from "@/components/morph-link"
import type { NavigationIntentKind, NavigationIntentPayload } from "@/components/navigation-intent-provider"

interface BackLinkProps {
  href: string
  children: ReactNode
  className?: string
  morphIntent?: NavigationIntentKind
  morphSource?: NavigationIntentPayload
  preferHistoryBack?: boolean
}

export function BackLink({
  href,
  children,
  className,
  morphIntent,
  morphSource,
  preferHistoryBack = false,
}: BackLinkProps) {
  const router = useRouter()
  const linkClassName = cn(
    "inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline",
    className,
  )

  const handleClick: MouseEventHandler<HTMLAnchorElement> = (event) => {
    if (!preferHistoryBack) return

    try {
      const referrer = document.referrer ? new URL(document.referrer) : null
      const currentOrigin = window.location.origin
      const targetPathname = new URL(href, currentOrigin).pathname

      if (referrer && referrer.origin === currentOrigin && referrer.pathname === targetPathname) {
        event.preventDefault()
        router.back()
      }
    } catch {
      // Fall back to normal link navigation if URL parsing fails.
    }
  }

  if (morphIntent) {
    return (
      <MorphLink
        href={href}
        morphIntent={morphIntent}
        morphSource={morphSource}
        className={linkClassName}
        onClick={handleClick}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>{children}</span>
      </MorphLink>
    )
  }

  return (
    <Link href={href} className={linkClassName} onClick={handleClick}>
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>{children}</span>
    </Link>
  )
}
