/**
 * Custom Notion client for browser use that proxies requests through our API route
 * to avoid CORS issues
 */

// Function to make requests to our proxy API
async function notionFetch(endpoint: string, payload: any) {
  const response = await fetch("/api/notion-proxy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      endpoint,
      payload,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`Notion API error: ${error.error || response.statusText}`)
  }

  return response.json()
}

// Create a browser-safe Notion client
export const browserNotionClient = {
  // Implement the methods used by react-notion-x
  getPage: async (pageId: string) => {
    // This is a simplified implementation - you may need to make multiple calls
    // to fully replicate the behavior of the notion-client library

    // First, load the page chunk
    const pageChunkData = await notionFetch("loadPageChunk", {
      pageId,
      limit: 100,
      cursor: { stack: [] },
      chunkNumber: 0,
      verticalColumns: false,
    })

    // Then get any additional blocks that might be needed
    // This is a simplified version - the actual implementation would be more complex
    const recordMap = pageChunkData.recordMap

    return recordMap
  },

  // Add other methods as needed
  getBlocks: async (blockIds: string[]) => {
    const { results } = await notionFetch("getRecordValues", {
      requests: blockIds.map((id) => ({ id, table: "block" })),
    })

    return results
  },

  getSignedFileUrls: async (urls: string[]) => {
    const { signedUrls } = await notionFetch("getSignedFileUrls", {
      urls,
    })

    return signedUrls
  },
}

