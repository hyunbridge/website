import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"

interface BackLinkProps {
  href: string
  children: ReactNode
  className?: string
}

export function BackLink({ href, children, className }: BackLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline",
        className,
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <span>{children}</span>
    </Link>
  )
}
