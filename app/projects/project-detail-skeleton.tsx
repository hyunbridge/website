"use client"

import { Skeleton } from "@/components/ui/skeleton"

export function ProjectDetailSkeleton() {
  return (
    <div className="w-full min-h-screen">
      {/* Fixed background skeleton */}
      <div className="fixed top-0 left-0 w-full h-[100vh] z-0">
        <Skeleton className="w-full h-full rounded-none" />
      </div>

      {/* Content skeleton */}
      <div className="relative min-h-screen pt-[70vh]">
        <div className="bg-card w-full rounded-t-3xl shadow-2xl overflow-hidden">
          <div className="p-6 md:p-8 max-w-4xl mx-auto">
            <Skeleton className="h-10 w-2/3 mb-6" />

            <div className="flex flex-wrap gap-2 mb-6">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>

            <div className="space-y-4 mb-8">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>

            <div className="space-y-6">
              <div>
                <Skeleton className="h-6 w-1/3 mb-2" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                </div>
              </div>

              <div>
                <Skeleton className="h-6 w-1/4 mb-2" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                </div>
              </div>

              <div>
                <Skeleton className="h-6 w-1/3 mb-2" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-32 w-full rounded-md" />
                  <Skeleton className="h-32 w-full rounded-md" />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t">
              <Skeleton className="h-5 w-16 mb-4" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-24 rounded-md" />
                <Skeleton className="h-9 w-28 rounded-md" />
              </div>
            </div>

            {/* Contact card skeleton */}
            <div className="mt-12">
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
