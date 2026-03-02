function getGotenbergEndpoint(pathname: string): string {
  const baseUrl = process.env.GOTENBERG_URL

  if (!baseUrl) {
    throw new Error("GOTENBERG_URL is not configured")
  }

  return `${baseUrl.replace(/\/$/, "")}${pathname}`
}

function getAuthorizationHeader(): string | null {
  const username = process.env.GOTENBERG_USERNAME
  const password = process.env.GOTENBERG_PASSWORD

  if (!username || !password) {
    return null
  }

  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
}

type GotenbergError = Error & {
  status?: number
  targetUrl?: string
}

export async function convertUrlToPdf(targetUrl: string): Promise<Buffer> {
  const formData = new FormData()
  formData.set("url", targetUrl)
  formData.set("printBackground", "true")
  formData.set("preferCssPageSize", "true")
  formData.set("waitForSelector", "[data-cv-print-ready='true']")

  const headers = new Headers()
  const authorization = getAuthorizationHeader()
  if (authorization) {
    headers.set("Authorization", authorization)
  }

  const response = await fetch(getGotenbergEndpoint("/forms/chromium/convert/url"), {
    method: "POST",
    headers,
    body: formData,
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "")
    const error = new Error(`Gotenberg request failed for ${targetUrl} with status ${response.status}: ${errorBody}`) as GotenbergError
    error.status = response.status
    error.targetUrl = targetUrl
    throw error
  }

  const pdfBytes = await response.arrayBuffer()
  return Buffer.from(pdfBytes)
}
