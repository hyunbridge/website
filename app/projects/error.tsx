"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

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
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Something went wrong!</h2>
            <p className="text-muted-foreground max-w-md mb-6">
                {error.message || "Failed to load projects. Please try again later."}
            </p>
            <Button onClick={() => reset()}>Try again</Button>
        </div>
    )
}
