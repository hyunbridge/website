import type React from "react"
import { MainNav } from "@/components/main-nav"
import { ThemeProvider } from "@/components/theme-provider"
import { NavigationEvents } from "@/components/navigation-events"
import { RouteTransitionProvider } from "@/components/route-transition-provider"
import { AuthProvider } from "@/contexts/auth-context"

import "./globals.css"

export const metadata = {
  title: "Hyungyo Seo",
  description: "Personal website of Hyungyo Seo"
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <MainNav />
            <main className="pt-16">
              <RouteTransitionProvider>{children}</RouteTransitionProvider>
            </main>
            <NavigationEvents />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
