import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { StatePanel } from "@/components/ui/state-panel"

interface ErrorMessageProps {
  title?: string
  message: string
  className?: string
}

export function ErrorMessage({ title = "Error", message, className }: ErrorMessageProps) {
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
