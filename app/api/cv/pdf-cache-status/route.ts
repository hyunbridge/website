import { NextResponse } from "next/server"
import { buildCVPdfObjectKey, getCVLastModified } from "@/lib/cv-pdf"
import { getCVData } from "@/lib/notion"
import { isObjectStorageConfigured, objectExists } from "@/lib/object-storage"

export async function GET() {
  if (!isObjectStorageConfigured()) {
    return NextResponse.json({
      hasCache: false,
      storageConfigured: false,
    })
  }

  const cv = await getCVData()
  const lastModified = getCVLastModified(cv.recordMap)
  const objectKey = buildCVPdfObjectKey(lastModified)
  const hasCache = await objectExists(objectKey)

  return NextResponse.json({
    hasCache,
    storageConfigured: true,
  })
}
