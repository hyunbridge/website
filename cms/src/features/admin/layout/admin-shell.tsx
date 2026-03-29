"use client"

import type React from "react"
import type { LucideIcon } from "lucide-react"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "@/lib/app-router"
import Link from "@/components/ui/app-link"
import { AuthProvider, useAuth } from "@/contexts/auth-context"
import { NavigationIntentProvider } from "@/components/navigation-intent-provider"
import {
  LayoutDashboard,
  FileText,
  FolderKanban,
  Tags,
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  Rocket,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@shared/lib/utils"
import { Button } from "@shared/components/ui/button"
import { Skeleton } from "@shared/components/ui/skeleton"
import { StatePanel } from "@shared/components/ui/state-panel"
import { motion, AnimatePresence } from "framer-motion"
import { PAGE_TRANSITION } from "@shared/lib/motion"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NavigationIntentProvider>
        <AdminLayoutContent>{children}</AdminLayoutContent>
      </NavigationIntentProvider>
    </AuthProvider>
  )
}

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading, signOut, bootstrapError } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === "/login"
  const [collapsed, setCollapsed] = useState(() => {
    // Check if we're in the browser and if there's a saved preference
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed")
      return saved === "true"
    }
    return false
  })

  useEffect(() => {
    if (!authLoading && !user && !isLoginPage && !bootstrapError) {
      router.replace("/login")
    }
  }, [authLoading, bootstrapError, isLoginPage, router, user])

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed))
  }, [collapsed])

  if (authLoading) {
    return (
      <div className="flex min-h-screen bg-muted/20">
        {/* Skeleton for sidebar */}
        <div className="fixed left-0 top-0 bottom-0 z-20 h-screen w-64 border-r bg-background">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b flex items-center justify-end">
              <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}>
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex-1 p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-8 w-full rounded-md" />
                  {i === 1 && (
                    <div className="ml-6 space-y-2">
                      <Skeleton className="h-6 w-5/6 rounded-md" />
                      <Skeleton className="h-6 w-5/6 rounded-md" />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t mt-auto space-y-2">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </div>
        </div>

        {/* Skeleton for main content */}
        <main className="ml-64 flex-1 overflow-auto">
          <div className="container py-8 space-y-6">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-32 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!user && isLoginPage) {
    return <>{children}</>
  }

  if (!user && bootstrapError && !isLoginPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/20 px-4">
        <StatePanel
          className="max-w-xl"
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="인증 상태를 확인하지 못했습니다"
          description={bootstrapError}
          actions={
            <Button onClick={() => window.location.reload()}>
              다시 시도
            </Button>
          }
        />
      </div>
    )
  }

  if (!user) {
    return null // Will redirect in useEffect
  }

  type NavItemType = {
    name: string
    href: string
    icon: LucideIcon
    subItems?: { name: string; href: string }[]
  }

  const navItems: NavItemType[] = [
    {
      name: "대시보드",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "홈",
      href: "/pages/home",
      icon: LayoutTemplate,
    },
    {
      name: "프로젝트",
      href: "/projects",
      icon: FolderKanban,
    },
    {
      name: "블로그",
      href: "/blog",
      icon: FileText,
    },
    {
      name: "태그",
      href: "/tags",
      icon: Tags,
    },
    {
      name: "배포",
      href: "/deploy",
      icon: Rocket,
    },
  ]

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/"
    }
    return pathname !== "/" && pathname.startsWith(path)
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 bottom-0 z-20 h-screen border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[1px_0_10px_rgba(0,0,0,0.02)]",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex flex-col h-full">
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.href)

              return (
                <div key={item.name} className="mb-1 relative">
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-primary/10 text-primary shadow-sm"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                      collapsed && "justify-center px-2",
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 flex-shrink-0 transition-transform duration-200",
                        active ? "scale-110" : "group-hover:scale-110",
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </Link>

                  {!collapsed && item.subItems && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.name}
                          href={subItem.href}
                          className={cn(
                            "flex items-center px-3 py-1.5 rounded-md text-sm transition-all duration-200",
                            pathname === subItem.href
                              ? "text-primary font-medium bg-primary/5"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                          )}
                        >
                          <span className="truncate">{subItem.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          <div className="px-4 pb-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className={cn(
                "flex items-center gap-2 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 group",
                collapsed && "justify-center p-2",
              )}
              title={collapsed ? "펼치기" : "접기"}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4 group-hover:scale-110 transition-transform" />
              ) : (
                <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              )}
              {!collapsed && <span>접기</span>}
            </button>
          </div>

          <div
            className={cn("p-4 border-t mt-auto", collapsed ? "flex flex-col items-center" : "")}
          >
            <Link
              href="/profile"
              className={cn(
                "group flex items-center gap-2 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all duration-200 mb-2",
                collapsed && "justify-center p-2 w-auto",
              )}
              title={collapsed ? "프로필" : undefined}
            >
              <User className="h-4 w-4 group-hover:scale-110 transition-transform" />
              {!collapsed && <span>프로필</span>}
            </Link>
            <button
              onClick={signOut}
              className={cn(
                "group flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-all duration-200 w-full",
                collapsed && "justify-center p-2 w-auto",
              )}
              title={collapsed ? "로그아웃" : undefined}
            >
              <LogOut className="h-4 w-4 group-hover:scale-110 transition-transform" />
              {!collapsed && <span>로그아웃</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main
        className={cn(
          "flex-1 overflow-auto transition-all duration-300",
          collapsed ? "ml-16" : "ml-64",
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={PAGE_TRANSITION}
            className="container py-8"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
