import { cache } from "react"
import { apiRequest } from "@/lib/api-client"

type CVResponse = {
  pageId: string
  recordMap: unknown
}

export const getCVData = cache(async (): Promise<CVResponse> => {
  return apiRequest<CVResponse>("/cv/content", {
    cache: "no-store",
  })
})
