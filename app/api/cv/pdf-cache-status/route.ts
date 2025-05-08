import { NextResponse } from "next/server"
import { getCacheInfo } from "@/lib/pdf-cache"

/**
 * Simple API to check the status of the PDF cache
 * Can be useful for debugging or monitoring
 */
export async function GET() {
  const cacheInfo = getCacheInfo()
  
  return NextResponse.json({
    hasCache: cacheInfo.hasCache,
    lastCached: cacheInfo.timestamp,
    lastModified: cacheInfo.lastModified,
  })
}
