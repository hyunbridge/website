export function triggerBrowserDownload(url: string, filename?: string) {
  const link = document.createElement("a")
  link.href = url
  link.rel = "noopener"
  if (filename) {
    link.download = filename
  }
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export async function downloadFileFromResponse(response: Response, filename: string) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    const data = await response.json().catch(() => null)
    if (!data?.downloadUrl) {
      throw new Error("Failed to read download URL")
    }
    triggerBrowserDownload(data.downloadUrl)
    return
  }

  const blob = await response.blob()
  const objectURL = window.URL.createObjectURL(blob)
  try {
    triggerBrowserDownload(objectURL, filename)
  } finally {
    window.URL.revokeObjectURL(objectURL)
  }
}
