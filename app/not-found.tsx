"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home, SearchX } from "lucide-react"
import { StatePanel } from "@/components/ui/state-panel"

export default function NotFound() {
  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-64px)]">
      <StatePanel
        className="max-w-md"
        icon={<SearchX className="h-5 w-5" />}
        title="Page Not Found"
        description="The page you&apos;re looking for doesn&apos;t exist or has been moved."
        detail="If you believe this is an error, please contact the site administrator."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Return Home
            </Link>
          </Button>
        }
      />
    </div>
  )
}
