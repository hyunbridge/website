import { NextResponse } from "next/server"
import { verifyTurnstileToken } from "@/app/actions/verify-cv-download"
import { buildCVPdfObjectKey, getCVLastModified, getCVPdfCacheControl, getCVRenderTargetUrl } from "@/lib/cv-pdf"
import { convertUrlToPdf } from "@/lib/gotenberg"
import { getCVData } from "@/lib/notion"
import { getSignedDownloadUrl, isObjectStorageConfigured, objectExists, uploadObject } from "@/lib/object-storage"

const DOWNLOAD_FILENAME = "CV.pdf"
const DOWNLOAD_URL_TTL_SECONDS = Number(process.env.CV_PDF_DOWNLOAD_URL_TTL_SECONDS || 60)

export async function GET(request: Request) {
  try {
    // Get Turnstile token from request
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json(
        { error: "Turnstile token required" },
        { status: 401 }
      )
    }

    // Check if Cloudflare secret key is configured
    if (!process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    // Verify token directly with Turnstile
    const verification = await verifyTurnstileToken(token)

    // Return 401 if not verified
    if (!verification.success || !verification.verified) {
      return NextResponse.json(
        { error: verification.error || "Authentication required" },
        { status: 401 }
      )
    }

    if (!isObjectStorageConfigured()) {
      return NextResponse.json(
        { error: "Object storage is not configured" },
        { status: 500 }
      )
    }

    // Fetch current CV data to derive the revisioned object key
    const cv = await getCVData()
    const lastModified = getCVLastModified(cv.recordMap)
    const objectKey = buildCVPdfObjectKey(lastModified)

    if (await objectExists(objectKey)) {
      const downloadUrl = await getSignedDownloadUrl({
        key: objectKey,
        contentDisposition: `attachment; filename="${DOWNLOAD_FILENAME}"`,
        contentType: "application/pdf",
        expiresIn: DOWNLOAD_URL_TTL_SECONDS,
      })

      return NextResponse.json({
        downloadUrl,
        source: "cache",
      }, {
        headers: {
          "Cache-Control": "no-store",
        },
      })
    }

    const targetUrl = getCVRenderTargetUrl(request.url)
    const pdfBuffer = await convertUrlToPdf(targetUrl)
    await uploadObject({
      key: objectKey,
      body: pdfBuffer,
      contentType: "application/pdf",
      contentDisposition: `attachment; filename="${DOWNLOAD_FILENAME}"`,
      cacheControl: getCVPdfCacheControl(lastModified),
      metadata: {
        filename: DOWNLOAD_FILENAME,
        source: "gotenberg",
        render_url: targetUrl,
        ...(lastModified ? { revision: lastModified } : {}),
      },
    })

    const downloadUrl = await getSignedDownloadUrl({
      key: objectKey,
      contentDisposition: `attachment; filename="${DOWNLOAD_FILENAME}"`,
      contentType: "application/pdf",
      expiresIn: DOWNLOAD_URL_TTL_SECONDS,
    })

    return NextResponse.json({
      downloadUrl,
      source: "generated",
    }, {
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("Failed to prepare CV PDF:", error)
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    )
  }
}
