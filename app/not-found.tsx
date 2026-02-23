"use client"

import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, SearchX } from "lucide-react"

export default function NotFound() {
  return (
    <div className="container flex items-center justify-center min-h-[calc(100vh-64px)]">
      <Card className="max-w-md w-full bg-card/80">
        <CardHeader>
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <SearchX className="h-5 w-5" />
          </div>
          <CardTitle className="text-2xl">Page Not Found</CardTitle>
          <CardDescription>The page you're looking for doesn't exist or has been moved.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <NotFoundContent />
          </Suspense>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Return Home
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function NotFoundContent() {
  // This component can safely use useSearchParams() because it's wrapped in Suspense
  return (
    <p className="text-muted-foreground">If you believe this is an error, please contact the site administrator.</p>
  )
}
