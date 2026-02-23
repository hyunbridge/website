"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function ProjectDetailSkeleton() {
  return (
    <div className="container max-w-4xl mx-auto py-8 md:py-12">
      <div className="mb-6">
        <Skeleton className="h-4 w-32" />
      </div>

      <Skeleton className="mb-8 h-64 md:h-80 w-full rounded-2xl" />

      <Skeleton className="h-10 md:h-14 w-3/4 mb-4" />

      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>

      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </div>

      <div className="mt-8 pt-6 border-t">
        <Skeleton className="h-5 w-16 mb-3" />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled>
            <Skeleton className="h-4 w-16" />
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Skeleton className="h-4 w-20" />
          </Button>
        </div>
      </div>

      <div className="mt-12">
        <Card className="bg-card/50 border border-border/50">
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-7 w-72 max-w-full" />
            </CardTitle>
            <CardDescription>
              <Skeleton className="h-4 w-80 max-w-full" />
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Skeleton className="h-9 w-32 rounded-md" />
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
