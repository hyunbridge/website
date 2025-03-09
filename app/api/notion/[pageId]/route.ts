import { type NextRequest, NextResponse } from "next/server"
import { NotionAPI } from "notion-client"

// Initialize the Notion API client
const notionAPI = new NotionAPI()

export async function GET(request: NextRequest, { params }: { params: { pageId: string } }) {
  const { pageId } = params

  if (!pageId) {
    return NextResponse.json({ error: "Page ID is required" }, { status: 400 })
  }

  try {
    // Fetch the page data from Notion
    const recordMap = await notionAPI.getPage(pageId)

    return NextResponse.json(recordMap)
  } catch (error) {
    console.error("Error fetching Notion page:", error)
    return NextResponse.json({ error: "Failed to fetch Notion page" }, { status: 500 })
  }
}

