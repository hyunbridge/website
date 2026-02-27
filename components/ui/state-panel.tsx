import type { ReactNode } from "react"
import { Info } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatePanelProps {
  title: string
  description?: string
  detail?: string
  icon?: ReactNode
  actions?: ReactNode
  tone?: "default" | "danger"
  size?: "default" | "compact"
  className?: string
}

export function StatePanel({
  title,
  description,
  detail,
  icon,
  actions,
  tone = "default",
  size = "default",
  className,
}: StatePanelProps) {
  const isDanger = tone === "danger"
  const isCompact = size === "compact"

  return (
    <div
      className={cn(
        "mx-auto w-full rounded-2xl border border-dashed px-6 text-center",
        isCompact ? "py-8" : "py-10",
        isDanger ? "border-destructive/40 bg-destructive/5" : "border-border/70 bg-card/50",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full",
          isDanger ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
        )}
      >
        {icon ?? <Info className="h-5 w-5" />}
      </div>
      <h2 className={cn("font-semibold tracking-tight", isCompact ? "text-xl" : "text-2xl")}>{title}</h2>
      {description ? (
        <p className={cn("mt-2 text-muted-foreground", isCompact ? "text-sm" : "text-base")}>{description}</p>
      ) : null}
      {detail ? (
        <p className={cn("mt-4 text-sm text-muted-foreground", isCompact ? "" : "mx-auto max-w-md")}>{detail}</p>
      ) : null}
      {actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  )
}
