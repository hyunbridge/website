import { NextResponse } from "next/server"
import { verifyTurnstileToken } from "@/app/actions/verify-cv-download"
import { getCachedPDF, cachePDF } from "@/lib/pdf-cache"
import { getCVData } from "@/lib/notion"

// Generate PDF using Puppeteer
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

    // Fetch current CV data to get the last modified timestamp
    const cv = await getCVData()
    const pageId = Object.keys(cv.recordMap.block)[0]
    const lastModifiedTimestamp = cv.recordMap.block[pageId]?.value?.last_edited_time
    const lastModified = lastModifiedTimestamp ? lastModifiedTimestamp.toString() : null

    // Check if we have a valid cached PDF that matches the current last modified timestamp
    if (lastModified) {
      const cachedPDF = getCachedPDF(lastModified)
      if (cachedPDF) {
        return new NextResponse(cachedPDF, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="CV.pdf"`,
            "X-PDF-Cache": "HIT"
          },
        })
      }
    }

    // Set base URL based on environment
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const targetUrl = `${baseUrl}/cv?print=true`

    // Dynamically import puppeteer at runtime
    const { default: puppeteer } = await import("puppeteer")

    // Use the system-installed Chromium in Alpine
    const browser = await puppeteer.launch({
      args: [
        "--no-sandbox", 
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage",
        "--disable-gpu"
      ],
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    })
    
    const page = await browser.newPage()
    
    try {
      await page.goto(targetUrl, { waitUntil: "networkidle0", timeout: 60000 })

      // Wait for all fonts to be loaded (avoid missing glyphs)
      await page.evaluate(async () => {
        await document.fonts.ready
      })

      const pdfBytes = await page.pdf({ format: "A4", printBackground: true })
      const pdfBuffer = Buffer.from(pdfBytes)
      
      // Cache the newly generated PDF if we have a valid last modified timestamp
      if (lastModified) {
        cachePDF(pdfBuffer, lastModified)
      }
      
      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="CV.pdf"`,
          "X-PDF-Cache": "MISS"
        },
      })
    } finally {
      await browser.close()
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    )
  }
}
