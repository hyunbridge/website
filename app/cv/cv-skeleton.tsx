import { Skeleton } from "@/components/ui/skeleton"

export function CVSkeleton() {
  return (
    <div className="space-y-8">
      {/* Personal Information */}
      <div className="text-center mb-8">
        <Skeleton className="h-8 w-48 mx-auto mb-2" />
        <Skeleton className="h-4 w-32 mx-auto mb-2" />
        <div className="mt-2 flex justify-center gap-x-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>

      {/* Summary Section */}
      <section>
        <Skeleton className="h-6 w-32 mb-3" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </section>

      {/* Experience Section */}
      <section>
        <Skeleton className="h-6 w-32 mb-3" />
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <Skeleton className="h-5 w-40 mb-1" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
              <ul className="space-y-2 pl-5">
                <li className="flex items-start">
                  <Skeleton className="h-3 w-3 mt-1 rounded-full mr-2 flex-shrink-0" />
                  <Skeleton className="h-3 w-full" />
                </li>
                <li className="flex items-start">
                  <Skeleton className="h-3 w-3 mt-1 rounded-full mr-2 flex-shrink-0" />
                  <Skeleton className="h-3 w-full" />
                </li>
                <li className="flex items-start">
                  <Skeleton className="h-3 w-3 mt-1 rounded-full mr-2 flex-shrink-0" />
                  <Skeleton className="h-3 w-5/6" />
                </li>
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Education Section */}
      <section>
        <Skeleton className="h-6 w-32 mb-3" />
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <div className="flex justify-between items-start">
                <div>
                  <Skeleton className="h-5 w-40 mb-1" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Skills Section */}
      <section>
        <Skeleton className="h-6 w-32 mb-3" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-5 w-24 mb-1" />
              <Skeleton className="h-4 w-full" />
            </div>
          ))}
        </div>
      </section>

      {/* Last updated */}
      <div className="pt-4">
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  )
}

