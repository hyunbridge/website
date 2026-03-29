"use client"

import { MainNav } from "@/components/main-nav"
import { ThemeProvider } from "@shared/components/theme-provider"

export function HeaderShell() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MainNav />
    </ThemeProvider>
  )
}
