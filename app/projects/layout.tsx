import type React from "react"
import { NavigationIntentProvider } from "@/components/navigation-intent-provider"
import { RouteTransitionProvider } from "@/components/route-transition-provider"

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavigationIntentProvider>
      <RouteTransitionProvider>{children}</RouteTransitionProvider>
    </NavigationIntentProvider>
  )
}

