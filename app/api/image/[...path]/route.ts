import { NextRequest, NextResponse } from "next/server"
import { unstable_cache } from "next/cache"

export const runtime = "edge"

// Function to fetch and cache image data
// The second argument 'keys' determines the cache key.
// We pass [cleanUrl] as the key, effectively ignoring the query params of the actual fetch URL for caching purposes.
// This means if we request A?token=1 and A?token=2, if we use A as the key, the second request will hit the cache of the first.
const getCachedImage = async (fetchUrl: string, cacheKey: string) => {
    const cachedFetcher = unstable_cache(
        async () => {
            const response = await fetch(fetchUrl)
            if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.statusText}`)
            }
            const arrayBuffer = await response.arrayBuffer()
            const base64 = Buffer.from(arrayBuffer).toString("base64")
            return {
                content: base64,
                contentType: response.headers.get("Content-Type") || "application/octet-stream",
            }
        },
        [cacheKey], // The stable cache key
        {
            revalidate: 3600 * 24 * 30, // Cache for 30 days
            tags: ["notion-image"],
        }
    )

    return cachedFetcher()
}

export async function GET(
    request: NextRequest,
    _context: { params: Promise<{ path: string[] }> }
) {
    const { searchParams } = new URL(request.url)
    const url = searchParams.get("url")

    // We don't strictly *need* to use the path params for fetching since we have the 'url' query param,
    // but we can validate that the path matches the URL if we wanted to be strict.
    // For now, we just rely on 'url' being present. The path is mainly for the CDN.

    if (!url) {
        return new NextResponse("Missing URL parameter", { status: 400 })
    }

    try {
        const imageUrl = new URL(url)

        // Basic security check
        const allowedHosts = [
            "s3.us-west-2.amazonaws.com",
            "prod-files-secure.s3.us-west-2.amazonaws.com",
            "secure.notion-static.com",
            "images.unsplash.com"
        ]

        if (!allowedHosts.some(host => imageUrl.hostname.endsWith(host))) {
            if (!imageUrl.hostname.includes("amazonaws") && !imageUrl.hostname.includes("notion")) {
                return new NextResponse("Invalid image source", { status: 400 })
            }
        }

        // cacheKey is the URL without query parameters (stripped of signature)
        // Or if we have params.path, we could use that as the key, but the image URL origin + pathname is robust.
        const cacheKey = `${imageUrl.origin}${imageUrl.pathname}`

        let imageData
        try {
            imageData = await getCachedImage(url, cacheKey)
        } catch (fetchError) {
            console.error("Fetch error:", fetchError)
            return new NextResponse("Failed to fetch image", { status: 502 })
        }

        const buffer = Buffer.from(imageData.content, "base64")

        const headers = new Headers()
        headers.set("Content-Type", imageData.contentType)
        headers.set("Cache-Control", "public, max-age=31536000, immutable")

        return new NextResponse(buffer, {
            status: 200,
            headers,
        })

    } catch (error) {
        console.error("Error proxying image:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
