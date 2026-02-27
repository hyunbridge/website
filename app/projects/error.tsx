"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import { StatePanel } from "@/components/ui/state-panel"

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
            <StatePanel
                className="max-w-lg"
                tone="danger"
                icon={<AlertTriangle className="h-5 w-5" />}
                title="Failed to load project"
                description={error.message || "Please try again in a moment."}
                detail="If the issue persists, return to the projects list and try opening the page again."
                actions={
                    <>
                        <Button onClick={() => reset()}>Try again</Button>
                        <Button variant="outline" asChild>
                            <Link href="/projects" className="flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Back to projects
                            </Link>
                        </Button>
                    </>
                }
            />
        </div>
    )
}
