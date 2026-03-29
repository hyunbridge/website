import type { ReactNode } from "react"

import { StatePanel } from "@shared/components/ui/state-panel"

export function HomeEmptyState({
  title,
  description,
  icon,
  className,
}: {
  title: string
  description: string
  icon?: ReactNode
  className?: string
}) {
  return (
    <StatePanel
      title={title}
      description={description}
      icon={icon}
      size="compact"
      className={["mt-6 max-w-none border-border/60 bg-background/65 backdrop-blur-sm", className]
        .filter(Boolean)
        .join(" ")}
    />
  )
}
