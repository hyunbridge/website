"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Plus, Loader2, AlertCircle, RefreshCw, GripVertical } from "lucide-react"
import { getProjects, createProject, reorderProjects, type Project } from "@/lib/project-service"
import { useAuth } from "@/contexts/auth-context"
import Link from "next/link"
import Chance from "chance"
import Image from "next/image"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

const chance = new Chance()

export default function AdminProjectsPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [projects, setProjects] = useState<Project[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [isReordering, setIsReordering] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activeId, setActiveId] = useState<string | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    )

    const fetchProjects = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const allProjects = await getProjects(false) // include drafts
            setProjects(allProjects)
        } catch (err) {
            console.error("Error fetching projects:", err)
            setError(err instanceof Error ? err.message : "Failed to load projects.")
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchProjects()
    }, [])

    const handleCreateProject = async () => {
        if (!user) return
        setIsCreating(true)
        try {
            const randomWord1 = chance.word({ length: chance.integer({ min: 3, max: 7 }) })
            const randomWord2 = chance.word({ length: chance.integer({ min: 3, max: 7 }) })
            const randomNum = chance.integer({ min: 10, max: 99 })

            const newProject = await createProject({
                title: "Untitled Project",
                slug: `${randomWord1}-${randomWord2}-${randomNum}`,
                summary: "",
                is_published: false,
                owner_id: user.id,
            })
            router.push(`/admin/projects/edit/${newProject.id}`)
        } catch (err) {
            console.error("Error creating project:", err)
            setError(err instanceof Error ? err.message : "Failed to create project.")
        } finally {
            setIsCreating(false)
        }
    }

    const handleDragStart = (event: DragStartEvent) => {
        if (isReordering) return
        setActiveId(event.active.id as string)
    }

    const handleDragCancel = () => {
        setActiveId(null)
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveId(null)
        if (isReordering) return
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = projects.findIndex((p) => p.id === active.id)
        const newIndex = projects.findIndex((p) => p.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return

        const reordered = arrayMove(projects, oldIndex, newIndex)
        setProjects(reordered)
        setIsReordering(true)
        setError(null)

        try {
            await reorderProjects(
                reordered.map((p, i) => ({ id: p.id, sort_order: i })),
            )
        } catch (err) {
            console.error("Error reordering projects:", err)
            setError("Failed to save order. Refreshing...")
            fetchProjects()
        } finally {
            setIsReordering(false)
        }
    }

    const activeProject = activeId ? projects.find((p) => p.id === activeId) : null

    return (
        <div>
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold">Projects</h1>
                <div className="flex items-center gap-3">
                    {isReordering ? (
                        <div className="text-sm text-muted-foreground flex items-center">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving order...
                        </div>
                    ) : null}
                    <Button onClick={handleCreateProject} disabled={isCreating || isReordering}>
                    {isCreating ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Creating...
                        </>
                    ) : (
                        <>
                            <Plus className="h-4 w-4 mr-2" />
                            New Project
                        </>
                    )}
                    </Button>
                </div>
            </div>

            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                        {error}
                        <Button variant="outline" size="sm" className="ml-2" onClick={fetchProjects} disabled={isLoading}>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {isLoading ? (
                <AdminProjectListSkeleton />
            ) : projects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <p>No projects yet. Create your first project!</p>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragCancel={handleDragCancel}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={projects.map((p) => p.id)} strategy={rectSortingStrategy}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projects.map((project) => (
                                <SortableProjectCard key={project.id} project={project} disabled={isReordering} />
                            ))}
                        </div>
                    </SortableContext>
                    <DragOverlay>
                        {activeProject ? <ProjectCardOverlay project={activeProject} /> : null}
                    </DragOverlay>
                </DndContext>
            )}
        </div>
    )
}

function SortableProjectCard({ project, disabled = false }: { project: Project; disabled?: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: project.id, disabled })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    }
    const isPublished = project.is_published && project.published_version_id
    const statusBadgeClass = isPublished
        ? "bg-black/80 text-white border-white/10"
        : "bg-background/80 text-foreground border-border/50"

    return (
        <div ref={setNodeRef} style={style}>
            <Card className="h-full hover:shadow-md transition-shadow overflow-hidden flex flex-col border border-border cursor-default">
                {project.cover_image ? (
                    <div className="relative h-48 w-full overflow-hidden bg-muted">
                        <Image
                            src={project.cover_image}
                            alt={project.title || "Project cover"}
                            fill
                            className="object-cover"
                            unoptimized
                        />
                        <div className="absolute inset-x-0 top-0 p-3 flex items-center justify-between gap-2">
                            <Badge
                                variant="outline"
                                className={`backdrop-blur ${statusBadgeClass}`}
                            >
                                {isPublished ? "Published" : "Draft"}
                            </Badge>
                            <button
                                type="button"
                                disabled={disabled}
                                aria-label={disabled ? "Reordering is being saved" : "Drag to reorder project"}
                                className="p-1.5 rounded-md backdrop-blur bg-background/80 border border-border/50 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                {...attributes}
                                {...listeners}
                            >
                                <GripVertical className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="px-4 pt-4 flex items-center justify-between gap-2">
                        <Badge
                            variant="outline"
                            className={`backdrop-blur ${statusBadgeClass}`}
                        >
                            {isPublished ? "Published" : "Draft"}
                        </Badge>
                        <button
                            type="button"
                            disabled={disabled}
                            aria-label={disabled ? "Reordering is being saved" : "Drag to reorder project"}
                            className="p-1.5 rounded-md backdrop-blur bg-background/80 border border-border/50 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            {...attributes}
                            {...listeners}
                        >
                            <GripVertical className="h-4 w-4" />
                        </button>
                    </div>
                )}

                <Link href={`/admin/projects/edit/${project.id}`} className="flex-1 flex flex-col">
                    <CardHeader>
                        <CardTitle>{project.title || "Untitled"}</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <p className="text-sm text-muted-foreground line-clamp-3">
                            {project.summary || "No summary yet."}
                        </p>
                    </CardContent>
                    <CardFooter>
                        <div className="flex flex-wrap gap-2">
                            {project.tags.map((tag) => (
                                <Badge key={tag.id} variant="secondary">
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    </CardFooter>
                </Link>
            </Card>
        </div>
    )
}

function ProjectCardOverlay({ project }: { project: Project }) {
    const isPublished = project.is_published && project.published_version_id
    const statusBadgeClass = isPublished
        ? "bg-black/80 text-white border-white/10"
        : "bg-background/80 text-foreground border-border/50"

    return (
        <Card className="h-full hover:shadow-md overflow-hidden flex flex-col border border-border shadow-xl rotate-2 scale-105">
            {project.cover_image ? (
                <div className="relative h-48 w-full overflow-hidden bg-muted">
                    <Image
                        src={project.cover_image}
                        alt={project.title || "Project cover"}
                        fill
                        className="object-cover"
                        unoptimized
                    />
                    <div className="absolute inset-x-0 top-0 p-3 flex items-center justify-between gap-2">
                        <Badge
                            variant="outline"
                            className={`backdrop-blur ${statusBadgeClass}`}
                        >
                            {isPublished ? "Published" : "Draft"}
                        </Badge>
                        <div className="p-1.5 rounded-md backdrop-blur bg-background/80 border border-border/50 text-muted-foreground">
                            <GripVertical className="h-4 w-4" />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="px-4 pt-4 flex items-center justify-between gap-2">
                    <Badge
                        variant="outline"
                        className={`backdrop-blur ${statusBadgeClass}`}
                    >
                        {isPublished ? "Published" : "Draft"}
                    </Badge>
                    <div className="p-1.5 rounded-md backdrop-blur bg-background/80 border border-border/50 text-muted-foreground">
                        <GripVertical className="h-4 w-4" />
                    </div>
                </div>
            )}
            <CardHeader>
                <CardTitle>{project.title || "Untitled"}</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground line-clamp-3">
                    {project.summary || "No summary yet."}
                </p>
            </CardContent>
            <CardFooter>
                <div className="flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                        <Badge key={tag.id} variant="secondary">
                            {tag.name}
                        </Badge>
                    ))}
                </div>
            </CardFooter>
        </Card>
    )
}

function AdminProjectListSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                    <div className="h-48 w-full">
                        <Skeleton className="h-full w-full" />
                    </div>
                    <CardHeader className="pb-2">
                        <Skeleton className="h-6 w-2/3" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                    <CardFooter>
                        <div className="flex gap-2">
                            <Skeleton className="h-5 w-16 rounded-full" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                    </CardFooter>
                </Card>
            ))}
        </div>
    )
}
