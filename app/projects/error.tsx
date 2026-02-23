"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error)
    }, [error])

    return (
        <div className="container flex items-center justify-center min-h-[calc(100vh-64px)] py-8">
            <Card className="max-w-lg w-full border-destructive/20 bg-card/80">
                <CardHeader>
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-2xl">Failed to load project</CardTitle>
                    <CardDescription>
                        {error.message || "Please try again in a moment."}
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    If the issue persists, return to the projects list and try opening the page again.
                </CardContent>
                <CardFooter className="flex gap-2">
                    <Button onClick={() => reset()}>Try again</Button>
                    <Button variant="outline" asChild>
                        <Link href="/projects" className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to projects
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
