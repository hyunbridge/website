"use client"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Home, FolderKanban, FileText, BookOpen, Menu, Github, Linkedin, Mail, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useMobileMenu } from "@/hooks/use-mobile-menu"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

const navItems = [
  {
    name: "Home",
    href: "/",
    icon: Home,
  },
  {
    name: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    name: "CV (Korean)",
    href: "/cv",
    icon: FileText,
  },
  // {
  //   name: "Blog",
  //   href: "https://blog.example.com",
  //   icon: BookOpen,
  //   external: true,
  // },
]

const contactItems = [
  {
    name: "GitHub",
    href: "https://github.com/hyunbridge",
    icon: Github,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/hgseo/",
    icon: Linkedin,
  },
  {
    name: "Email",
    href: "mailto:***REMOVED***",
    icon: Mail,
  },
]

export function MainNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { isOpen, setIsOpen } = useMobileMenu()

  const handleNavigation = (href: string, external?: boolean) => {
    if (external) {
      window.open(href, "_blank")
    } else {
      router.push(href)
      setIsOpen(false)
    }
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16">
      <div className="h-full backdrop-blur-md bg-background/80 border-b">
        <div className="container h-full mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <span className="font-semibold">Hyungyo Seo</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex gap-6 mx-auto md:mx-0">
            {navItems.map((item) => {
              const isActive = pathname === item.href

              return (
                <button
                  key={item.name}
                  onClick={() => handleNavigation(item.href, item.external)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground relative",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.name}</span>
                  {isActive && (
                    <motion.div
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                      layoutId="navbar-indicator"
                      transition={{ type: "spring", duration: 0.3 }}
                    />
                  )}
                </button>
              )
            })}

            {/* Get in touch dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground relative",
                    "text-muted-foreground",
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>Get in touch</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {contactItems.map((item) => (
                  <DropdownMenuItem key={item.name} asChild>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop Theme Toggle */}
            <div className="hidden md:block">
              <ThemeToggle />
            </div>

            {/* Mobile Menu Trigger */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="p-0">
                <MobileMenu pathname={pathname} onNavigate={handleNavigation} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  )
}

function MobileMenu({ pathname, onNavigate }) {
  return (
    <div className="flex flex-col h-full py-6">
      <div className="px-6 mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Menu</h2>
      </div>
      <div className="flex-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href

          return (
            <button
              key={item.name}
              onClick={() => onNavigate(item.href, item.external)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-4 rounded-md text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
              {item.external && (
                <span className="ml-auto text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">External</span>
              )}
            </button>
          )
        })}

        {/* Get in touch section in mobile menu */}
        <div className="mt-4 px-3">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Get in touch</h3>
          {contactItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full px-3 py-3 rounded-md text-base font-medium transition-colors hover:bg-accent hover:text-accent-foreground text-muted-foreground"
            >
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Mobile Theme Toggle */}
      <div className="mt-auto border-t pt-4 px-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Dark Mode</span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}

