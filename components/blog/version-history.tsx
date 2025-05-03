"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { getPostVersions, restorePostVersion } from "@/lib/blog-service"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { History, RotateCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { TiptapEditor } from "./tiptap-editor"
import { useToast } from "@/hooks/use-toast"

interface VersionHistoryProps {
  postId: string
  onVersionRestored: () => void
}

interface Version {
  id: string
  version_number: number
  post_id: string
  title: string
  content: string
  change_description: string | null
  created_at: string
  created_by: string | null
  creator?: {
    id: string
    username: string
    full_name: string | null
  } | null
}

export function VersionHistory({ postId, onVersionRestored }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<Error | null>(null)
  const [isRestoring, setIsRestoring] = useState<boolean>(false)
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    async function fetchVersions() {
      if (!postId) return

      setIsLoading(true)
      try {
        const versionsData = await getPostVersions(postId)
        console.log("Fetched versions:", versionsData) // Add logging
        setVersions(versionsData || [])
        setError(null)
      } catch (err) {
        console.error("Error fetching versions:", err)
        setError(err instanceof Error ? err : new Error('Unknown error'))
        setVersions([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchVersions()
  }, [postId])

  const handleRestoreVersion = async (version: Version) => {
    if (!user || !version) return

    setIsRestoring(true)
    try {
      await restorePostVersion(postId, version.version_number, user.id)
      toast({
        title: "Version restored",
        description: `Successfully restored to version ${version.version_number}`,
      })
      setIsDialogOpen(false)
      onVersionRestored()
    } catch (err) {
      console.error("Error restoring version:", err)
      toast({
        title: "Error",
        description: "Failed to restore version. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsRestoring(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border rounded-md p-4">
                <div className="flex justify-between mb-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-5 w-32" />
                </div>
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
          <CardDescription>Error loading version history</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load version history. Please try again later.</p>
        </CardContent>
      </Card>
    )
  }

  if (!versions || versions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
          <CardDescription>No previous versions found</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">This post doesn't have any saved versions yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Version History
        </CardTitle>
        <CardDescription>
          This post has {versions.length} saved version{versions.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          {versions.map((version) => (
            <AccordionItem key={version.id} value={`version-${version.version_number}`}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">v{version.version_number}</Badge>
                    <span className="font-medium">{version.title}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <span>{format(new Date(version.created_at), "MMM d, yyyy h:mm a")}</span>
                    {version.creator && <span>by {version.creator.full_name || version.creator.username}</span>}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  {version.change_description && (
                    <div className="text-sm">
                      <span className="font-medium">Change description:</span> {version.change_description}
                    </div>
                  )}
                  <div className="border rounded-md p-4 bg-muted/30">
                    <div className="prose dark:prose-invert max-w-none">
                      <TiptapEditor content={version.content} onChange={() => {}} readOnly />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Dialog
                      open={isDialogOpen && selectedVersion?.id === version.id}
                      onOpenChange={(open) => {
                        setIsDialogOpen(open)
                        if (!open) setSelectedVersion(null)
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => setSelectedVersion(version)}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Restore this version
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Restore Version</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to restore to version {version.version_number}? This will create a new
                            version with the restored content.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isRestoring}>
                            Cancel
                          </Button>
                          <Button onClick={() => handleRestoreVersion(version)} disabled={isRestoring}>
                            {isRestoring ? "Restoring..." : "Restore"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  )
}
