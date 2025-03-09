import { cache } from "react"
import { Client } from "@notionhq/client"
import { NotionAPI } from "notion-client"

// Initialize the Notion clients
const notionClient = process.env.NOTION_API_KEY ? new Client({ auth: process.env.NOTION_API_KEY }) : null

// Use a server-side only NotionAPI instance
const notionAPI = new NotionAPI(process.env.NOTION_API_KEY ? { authToken: process.env.NOTION_API_KEY } : {})

// Page and Database IDs
const CV_PAGE_ID = process.env.NOTION_CV_PAGE_ID || "" // This is a page ID
const PROJECTS_DATABASE_ID = process.env.NOTION_PROJECTS_DATABASE_ID || ""

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

// Get projects from Notion
export const getProjects = cache(async () => {
  if (!notionClient || !PROJECTS_DATABASE_ID) {
    throw new Error("Notion API key or Projects database ID is not configured")
  }

  try {
    // Fetch projects from Notion
    const response = await notionClient.databases.query({
      database_id: PROJECTS_DATABASE_ID,
      filter: {
        property: "Status",
        status: {
          equals: "Published",
        },
      },
    })

    if (response.results.length === 0) {
      return []
    }

    // Map Notion results to project objects
    const projects = await Promise.all(
      response.results.map(async (page) => {
        const pageId = page.id

        try {
          // Extract project data from properties
          const title = extractTitle(page) || "Untitled Project"
          const description = extractRichText(page, "Description") || ""
          const summary = extractRichText(page, "Summary") || ""
          const imageUrl = extractCoverImage(page) || "/placeholder.svg?height=400&width=600"
          const tags = extractMultiSelect(page, "Tags") || []

          // Get links
          const githubUrl = extractUrl(page, "GitHub") || ""
          const demoUrl = extractUrl(page, "Demo") || ""

          const links = []
          if (githubUrl) links.push({ title: "GitHub", url: githubUrl })
          if (demoUrl) links.push({ title: "Live Demo", url: demoUrl })

          // Get the page content - this runs server-side only
          const recordMap = await getNotionPage(pageId)

          return {
            id: pageId,
            title,
            description,
            summary,
            imageUrl,
            tags: Array.isArray(tags) ? tags : [tags],
            recordMap,
            links,
          }
        } catch (err) {
          console.error(`Error processing project ${pageId}:`, err)
          throw err
        }
      }),
    )

    return projects
  } catch (error) {
    console.error("Error fetching projects:", error)
    throw error
  }
})

// Get projects by ID
export const getProjectById = cache(async (projectId: string) => {
  if (!notionClient) {
    throw new Error("Notion API key is not configured")
  }

  try {
    const page = await notionClient.pages.retrieve({ page_id: projectId })
    if (!page) {
      throw new Error(`No project found for ID: ${projectId}`)
    }

    const recordMap = await getNotionPage(projectId)
    if (!recordMap) {
      throw new Error(`Failed to fetch project content for ID: ${projectId}`)
    }

    const title = extractTitle(page) || "Untitled Project"
    const description = extractRichText(page, "Description") || ""
    const summary = extractRichText(page, "Summary") || ""
    const imageUrl = extractCoverImage(page) || "/placeholder.svg?height=400&width=600"
    const tags = extractMultiSelect(page, "Tags") || []

    const githubUrl = extractUrl(page, "GitHub") || ""
    const demoUrl = extractUrl(page, "Demo") || ""

    const links = []
    if (githubUrl) links.push({ title: "GitHub", url: githubUrl })
    if (demoUrl) links.push({ title: "Live Demo", url: demoUrl })

    return {
      id: projectId,
      title,
      description,
      summary,
      imageUrl,
      tags: Array.isArray(tags) ? tags : [tags],
      recordMap,
      links,
    }
  } catch (error) {
    console.error(`Error fetching project ${projectId}:`, error)
    throw error
  }
})

// Safe property extraction functions
function extractTitle(page) {
  try {
    const titleProperty = page.properties.Name || page.properties.Title
    if (!titleProperty || !titleProperty.title || !Array.isArray(titleProperty.title)) {
      return null
    }
    return titleProperty.title.map((t) => t.plain_text).join("")
  } catch (error) {
    console.error("Error extracting title:", error)
    return null
  }
}

function extractRichText(page, propertyName) {
  try {
    const property = page.properties[propertyName]
    if (!property || !property.rich_text || !Array.isArray(property.rich_text)) {
      return null
    }
    return property.rich_text.map((t) => t.plain_text).join("")
  } catch (error) {
    console.error(`Error extracting rich text for ${propertyName}:`, error)
    return null
  }
}

function extractMultiSelect(page, propertyName) {
  try {
    const property = page.properties[propertyName]
    if (!property || !property.multi_select || !Array.isArray(property.multi_select)) {
      return []
    }
    return property.multi_select.map((s) => s.name)
  } catch (error) {
    console.error(`Error extracting multi-select for ${propertyName}:`, error)
    return []
  }
}

function extractUrl(page, propertyName) {
  try {
    const property = page.properties[propertyName]
    if (!property || !property.url) {
      return null
    }
    return property.url
  } catch (error) {
    console.error(`Error extracting URL for ${propertyName}:`, error)
    return null
  }
}

function extractFileUrl(page, propertyName) {
  try {
    const property = page.properties[propertyName]
    if (!property || !property.files || !Array.isArray(property.files) || property.files.length === 0) {
      return null
    }

    const file = property.files[0]
    if (file.type === "external") {
      return file.external.url
    } else if (file.type === "file") {
      return file.file.url
    }
    return null
  } catch (error) {
    console.error(`Error extracting file URL for ${propertyName}:`, error)
    return null
  }
}

function extractCoverImage(page) {
  try {
    if (!page.cover) {
      return null
    }

    if (page.cover.type === "external") {
      return page.cover.external.url
    } else if (page.cover.type === "file") {
      return page.cover.file.url
    }

    return null
  } catch (error) {
    console.error("Error extracting cover image:", error)
    return null
  }
}

