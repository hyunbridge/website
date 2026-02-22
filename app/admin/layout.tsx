"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { LayoutDashboard, FileText, FolderKanban, Tags, LogOut, User, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const isLoginPage = pathname === "/admin/login"
  const [collapsed, setCollapsed] = useState(() => {
    // Check if we're in the browser and if there's a saved preference
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebarCollapsed")
      return saved === "true"
    }
    return false
  })

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/admin/login")
    }
  }, [user, authLoading, router])

  // Save collapsed state to localStorage
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed))
  }, [collapsed])

  if (authLoading) {
    return (
      <div className="flex min-h-screen bg-muted/20">
        {/* Skeleton for sidebar */}
        <div className="fixed left-0 top-16 bottom-0 z-20 h-[calc(100vh-4rem)] w-64 border-r bg-background">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b flex items-center justify-end">
              <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)}>
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
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
        <main className="flex-1 ml-64 overflow-auto pt-16">
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

  if (!user) {
    return null // Will redirect in useEffect
  }

  const navItems = [
    {
      name: "Dashboard",
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      name: "Projects",
      href: "/admin/projects",
      icon: FolderKanban,
    },
    {
      name: "Blog",
      href: "/admin/blog",
      icon: FileText,
    },
    {
      name: "Tags",
      href: "/admin/tags",
      icon: Tags,
    },
  ]

  const isActive = (path: string) => {
    if (path === "/admin") {
      return pathname === "/admin"
    }
    return pathname !== "/admin" && pathname.startsWith(path)
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 bottom-0 z-20 h-[calc(100vh-4rem)] border-r bg-background transition-all duration-300",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex flex-col h-full">
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.href)

              return (
                <div key={item.name} className="mb-1">
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      active ? "bg-muted text-primary font-semibold" : "hover:bg-muted/50 text-foreground/80",
                      collapsed && "justify-center px-2",
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                  </Link>

                  {!collapsed && item.subItems && (
                    <div className="ml-6 mt-1 space-y-1">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.name}
                          href={subItem.href}
                          className={cn(
                            "flex items-center px-3 py-1.5 rounded-md text-sm transition-colors",
                            pathname === subItem.href
                              ? "text-primary font-medium"
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
                "flex items-center gap-2 px-3 py-2 w-full rounded-md text-sm font-medium hover:bg-muted/50 transition-colors",
                collapsed && "justify-center p-2"
              )}
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>

          <div className={cn("p-4 border-t mt-auto", collapsed ? "flex flex-col items-center" : "")}>
            <Link
              href="/admin/profile"
              className={cn(
                "flex items-center gap-2 px-3 py-2 w-full rounded-md text-sm font-medium hover:bg-muted/50 transition-colors mb-2",
                collapsed && "justify-center p-2 w-auto",
              )}
              title={collapsed ? "Profile" : undefined}
            >
              <User className="h-4 w-4" />
              {!collapsed && <span>Profile</span>}
            </Link>
            <button
              onClick={signOut}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors w-full",
                collapsed && "justify-center p-2 w-auto",
              )}
              title={collapsed ? "Logout" : undefined}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={cn("flex-1 overflow-auto transition-all duration-300", collapsed ? "ml-16" : "ml-64")}>
        <div className="container py-8">{children}</div>
      </main>
    </div>
  )
}
