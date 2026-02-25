import type React from "react"
import { NavigationIntentProvider } from "@/components/navigation-intent-provider"
import { RouteTransitionProvider } from "@/components/route-transition-provider"
import { AuthProvider } from "@/contexts/auth-context"

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NavigationIntentProvider>
        <RouteTransitionProvider>{children}</RouteTransitionProvider>
      </NavigationIntentProvider>
    </AuthProvider>
  )
}
