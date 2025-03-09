import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { endpoint, payload } = body

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint is required" }, { status: 400 })
    }

    // Only allow specific Notion API endpoints
    const allowedEndpoints = [
      "loadPageChunk",
      "getRecordValues",
      "queryCollection",
      "loadBlockSubtree",
      "getSignedFileUrls",
    ]

    const endpointName = endpoint.split("/").pop()

    if (!allowedEndpoints.includes(endpointName)) {
      return NextResponse.json({ error: "Endpoint not allowed" }, { status: 403 })
    }

    // Make the request to Notion API
    const notionResponse = await fetch(`https://www.notion.so/api/v3/${endpointName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text()
      console.error(`Notion API error (${notionResponse.status}):`, errorText)
      return NextResponse.json(
        { error: `Notion API returned ${notionResponse.status}` },
        { status: notionResponse.status },
      )
    }

    const data = await notionResponse.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in Notion proxy:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

