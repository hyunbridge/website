import { Suspense } from "react"
import { getCVData } from "@/lib/notion"
import { CVContent } from "./cv-content"
import { CVSkeleton } from "./cv-skeleton"
import { PrintButton } from "./print-button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ErrorBoundary } from "@/components/error-boundary"
import { ErrorMessage } from "@/components/error-message"

export const metadata = {
  title: "CV | Hyungyo Seo",
  description: "Curriculum vitae",
}

export default async function CVPage() {
  return (
    <div className="container py-8 md:py-12">
      <Card className="bg-card w-full rounded-lg shadow-lg overflow-hidden print:shadow-none print:border-none print:bg-transparent">
        <CardHeader className="bg-card flex flex-row items-center justify-between">
          <h1 className="text-3xl md:text-4xl font-bold">Hyungyo Seo</h1>
          <PrintButton className="print:hidden" />
        </CardHeader>
        <CardContent>
          <ErrorBoundary
            fallback={
              <ErrorMessage
                title="Failed to load CV"
                message="There was an error loading the CV. Please check your Notion configuration or try again later."
              />
            }
          >
            <Suspense fallback={<CVSkeleton />}>
              <CVContentWrapper />
            </Suspense>
          </ErrorBoundary>
        </CardContent>
      </Card>
    </div>
  )
}

async function CVContentWrapper() {
  try {
    const cv = await getCVData()
    return <CVContent cv={cv} isDirectAccess={true} />
  } catch (error) {
    return (
      <ErrorMessage
        title="Failed to load CV"
        message={error instanceof Error ? error.message : "An unknown error occurred"}
      />
    )
  }
}

