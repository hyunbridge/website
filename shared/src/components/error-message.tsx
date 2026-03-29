import { AlertTriangle } from "lucide-react"

import { StatePanel } from "@shared/components/ui/state-panel"
import { cn } from "@shared/lib/utils"

interface ErrorMessageProps {
  title?: string
  message: string
  className?: string
}

export function ErrorMessage({ title = "오류", message, className }: ErrorMessageProps) {
  return (
    <StatePanel
      className={cn("max-w-lg", className)}
      tone="danger"
      size="compact"
      icon={<AlertTriangle className="h-5 w-5" />}
      title={title}
      description={message}
    />
  )
}
