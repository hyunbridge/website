"use client"

import { useState, useEffect } from "react"
import { useRouter } from "@/lib/app-router"
import { Button } from "@shared/components/ui/button"
import { Alert, AlertDescription } from "@shared/components/ui/alert"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@shared/components/ui/card"
import { Badge } from "@shared/components/ui/badge"
import { Skeleton } from "@shared/components/ui/skeleton"
import { Plus, Loader2, AlertCircle, RefreshCw, GripVertical, FolderSearch } from "lucide-react"
import { getProjects, createProject, reorderProjects, type Project } from "@/lib/project-service"
import { useAuth } from "@/contexts/auth-context"
import Link from "@/components/ui/app-link"
import Image from "@shared/components/ui/app-image"
import { StatePanel } from "@shared/components/ui/state-panel"
import { motion, AnimatePresence } from "framer-motion"
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
import { buildDraftSlug } from "@/lib/slug"

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
      setError(err instanceof Error ? err.message : "프로젝트를 불러오지 못했습니다.")
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
      const draftTitle = "제목 없는 프로젝트"
      const newProject = await createProject({
        title: draftTitle,
        slug: buildDraftSlug(draftTitle, "project"),
        summary: "",
      })
      router.push(`/projects/edit/${newProject.id}`)
    } catch (err) {
      console.error("Error creating project:", err)
      setError(err instanceof Error ? err.message : "프로젝트를 만들지 못했습니다.")
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
      await reorderProjects(reordered.map((p, i) => ({ id: p.id, sort_order: i })))
    } catch (err) {
      console.error("Error reordering projects:", err)
      setError("순서를 저장하지 못했습니다. 새로고침합니다...")
      fetchProjects()
    } finally {
      setIsReordering(false)
    }
  }

  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <h1 className="text-3xl font-bold">프로젝트</h1>
        <div className="flex items-center gap-3">
          {isReordering ? (
            <div className="text-sm text-muted-foreground flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              순서 저장 중...
            </div>
          ) : null}
          <Button onClick={handleCreateProject} disabled={isCreating || isReordering}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />새 프로젝트
              </>
            )}
          </Button>
        </div>
      </motion.div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={fetchProjects}
              disabled={isLoading}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              다시 시도
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <AdminProjectListSkeleton />
      ) : projects.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <StatePanel
            className="max-w-lg"
            size="compact"
            icon={<FolderSearch className="h-5 w-5" />}
            title="아직 프로젝트가 없습니다"
            description="첫 프로젝트를 만들어 시작해보세요."
          />
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              <AnimatePresence>
                {projects.map((project) => (
                  <SortableProjectCard key={project.id} project={project} disabled={isReordering} />
                ))}
              </AnimatePresence>
            </motion.div>
          </SortableContext>
          <DragOverlay>
            {activeProject ? <ProjectCardOverlay project={activeProject} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  )
}

function SortableProjectCard({
  project,
  disabled = false,
}: {
  project: Project
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  const isPublic = !!project.published_at
  const statusBadgeClass = isPublic
    ? "bg-black/80 text-white border-white/10"
    : "bg-background/80 text-foreground border-border/50"

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
    >
      <Card className="h-full group hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col border border-border/60 hover:border-primary/30 cursor-default">
        {project.cover_image ? (
          <div className="relative h-48 w-full overflow-hidden bg-muted">
            <Image
              src={project.cover_image}
              alt={project.title || "프로젝트 커버"}
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-x-0 top-0 p-3 flex items-center justify-between gap-2">
              <Badge variant="outline" className={`backdrop-blur ${statusBadgeClass}`}>
                {isPublic ? "공개" : "비공개"}
              </Badge>
              <button
                type="button"
                disabled={disabled}
                aria-label={
                  disabled ? "정렬 순서를 저장하고 있습니다" : "드래그해 프로젝트 순서 변경"
                }
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
            <Badge variant="outline" className={`backdrop-blur ${statusBadgeClass}`}>
              {isPublic ? "공개" : "비공개"}
            </Badge>
            <button
              type="button"
              disabled={disabled}
              aria-label={
                disabled ? "정렬 순서를 저장하고 있습니다" : "드래그해 프로젝트 순서 변경"
              }
              className="p-1.5 rounded-md backdrop-blur bg-background/80 border border-border/50 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
        )}

        <Link href={`/projects/edit/${project.id}`} className="flex-1 flex flex-col">
          <CardHeader>
            <CardTitle>{project.title || "제목 없음"}</CardTitle>
          </CardHeader>
          <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground line-clamp-3">
              {project.summary || "아직 요약이 없습니다."}
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
    </motion.div>
  )
}

function ProjectCardOverlay({ project }: { project: Project }) {
  const isPublic = !!project.published_at
  const statusBadgeClass = isPublic
    ? "bg-black/80 text-white border-white/10"
    : "bg-background/80 text-foreground border-border/50"

  return (
    <Card className="h-full hover:shadow-md overflow-hidden flex flex-col border border-border shadow-xl rotate-2 scale-105">
      {project.cover_image ? (
        <div className="relative h-48 w-full overflow-hidden bg-muted">
          <Image
            src={project.cover_image}
            alt={project.title || "프로젝트 커버"}
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-x-0 top-0 p-3 flex items-center justify-between gap-2">
            <Badge variant="outline" className={`backdrop-blur ${statusBadgeClass}`}>
              {isPublic ? "공개" : "비공개"}
            </Badge>
            <div className="p-1.5 rounded-md backdrop-blur bg-background/80 border border-border/50 text-muted-foreground">
              <GripVertical className="h-4 w-4" />
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4 flex items-center justify-between gap-2">
          <Badge variant="outline" className={`backdrop-blur ${statusBadgeClass}`}>
            {isPublic ? "공개" : "비공개"}
          </Badge>
          <div className="p-1.5 rounded-md backdrop-blur bg-background/80 border border-border/50 text-muted-foreground">
            <GripVertical className="h-4 w-4" />
          </div>
        </div>
      )}
      <CardHeader>
        <CardTitle>{project.title || "제목 없음"}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {project.summary || "아직 요약이 없습니다."}
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
