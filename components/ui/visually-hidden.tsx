import type React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

type VisuallyHiddenProps = React.HTMLAttributes<HTMLSpanElement> & {
  asChild?: boolean
}

export function VisuallyHidden({ asChild = false, className, ...props }: VisuallyHiddenProps) {
  const Comp = asChild ? Slot : "span"
  return (
    <Comp
      className={cn(
        "absolute w-[1px] h-[1px] p-0 -m-[1px] overflow-hidden clip-rect-0 whitespace-nowrap border-0",
        className,
      )}
      {...props}
    />
  )
}
