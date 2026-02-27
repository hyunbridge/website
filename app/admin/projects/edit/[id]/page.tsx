"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getProjectById } from "@/lib/project-service"
import { SeamlessProjectView } from "@/components/project/seamless-project-view"
import type { Project } from "@/lib/project-service"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { StatePanel } from "@/components/ui/state-panel"

export default function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params)
    const router = useRouter()
    const { user, isLoading: authLoading } = useAuth()
    const [project, setProject] = useState<Project | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState("")

    useEffect(() => {
        if (authLoading) return

        if (!user) {
            router.replace("/")
            return
        }

        async function fetchProject() {
            try {
                const data = await getProjectById(resolvedParams.id)
                if (!data) {
                    setError("Project not found")
                    return
                }
                if (data.owner_id !== user!.id) {
                    setError("You don't have permission to edit this project.")
                    return
                }
                setProject(data)
            } catch {
                setError("Project not found")
            } finally {
                setLoading(false)
            }
        }
        fetchProject()
    }, [resolvedParams.id, user, authLoading, router])

    if (error) {
        return (
            <div className="container flex items-center justify-center py-8 md:py-12">
                <StatePanel
                    className="max-w-lg"
                    tone="danger"
                    size="compact"
                    icon={<AlertTriangle className="h-5 w-5" />}
                    title="Unable to open project"
                    description={error}
                    actions={
                        <Button variant="outline" asChild>
                            <Link href="/admin/projects" className="flex items-center gap-2">
                                <ArrowLeft className="h-4 w-4" />
                                Back to projects
                            </Link>
                        </Button>
                    }
                />
            </div>
        )
    }

    if (loading || authLoading || !project) {
        return (
            <div className="container max-w-4xl mx-auto py-8 md:py-12">
                {/* Back link skeleton */}
                <div className="mb-6">
                    <Skeleton className="h-4 w-32" />
                </div>
                {/* Toolbar skeleton */}
                <Skeleton className="h-12 w-full rounded-xl mb-6" />
                {/* Title skeleton */}
                <Skeleton className="h-10 w-3/4 mb-4" />
                {/* Meta skeleton */}
                <div className="flex items-center gap-4 mb-8">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                </div>
                {/* Content skeleton */}
                <div className="space-y-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-4/6" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/6" />
                </div>
            </div>
        )
    }

    return <SeamlessProjectView project={project} mode="edit" />
}
