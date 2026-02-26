import { cache } from "react"
import { NotionAPI } from "notion-client"

// Public CV page uses unauthenticated Notion access
const notionAPI = new NotionAPI()

// Page IDs
const CV_PAGE_ID = process.env.NOTION_CV_PAGE_ID || "" // This is a page ID

// Function to get a Notion page with blocks - server-side only
export const getNotionPage = cache(async (pageId: string) => {
  try {
    // This will only run on the server
    const recordMap = await notionAPI.getPage(pageId)
    return recordMap
  } catch (error) {
    console.error("Error fetching Notion page:", error)
    return null
  }
})

// Get CV data from Notion - fetches a single page
export const getCVData = cache(async () => {
  if (!CV_PAGE_ID) {
    throw new Error("CV page ID is not configured")
  }

  try {
    // Get the CV page directly using the page ID
    const recordMap = await getNotionPage(CV_PAGE_ID)

    if (!recordMap) {
      throw new Error("Failed to fetch CV page content")
    }

    // For a single page, we don't need to extract properties
    // The entire page will be rendered using NotionRenderer
    return {
      pageId: CV_PAGE_ID,
      recordMap,
    }
  } catch (error) {
    console.error("Error fetching CV data:", error)
    throw error
  }
})
