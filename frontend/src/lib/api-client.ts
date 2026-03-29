type QueryValue = string | number | boolean | null | undefined

function getConfiguredApiBaseUrl() {
  const configured =
    (import.meta.env.PUBLIC_API_BASE_URL as string | undefined) ||
    process.env.PUBLIC_API_BASE_URL

  if (configured) {
    return configured
  }

  if (import.meta.env.DEV) {
    return "http://localhost:8080/api/v1"
  }

  throw new Error("PUBLIC_API_BASE_URL is required for the frontend")
}

export function getApiBaseUrl() {
  return getConfiguredApiBaseUrl().replace(/\/+$/, "")
}

export function buildApiUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(getApiBaseUrl() + path)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.data = data
  }
}

async function readErrorPayload(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null)
  }

  return response.text().catch(() => null)
}

export async function apiRequest<T>(
  path: string,
  options: {
    query?: Record<string, QueryValue>
    headers?: HeadersInit
    cache?: RequestCache
    responseType?: "json" | "blob" | "text"
  } = {},
): Promise<T> {
  const response = await fetch(buildApiUrl(path, options.query), {
    headers: options.headers,
    cache: options.cache,
  })

  if (!response.ok) {
    const payload = await readErrorPayload(response)
    const message =
      (payload &&
        typeof payload === "object" &&
        "error" in payload &&
        typeof payload.error === "string" &&
        payload.error) ||
      (typeof payload === "string" && payload) ||
      `Request failed with status ${response.status}`
    throw new ApiError(message, response.status, payload)
  }

  if (options.responseType === "blob") {
    return (await response.blob()) as T
  }

  if (options.responseType === "text") {
    return (await response.text()) as T
  }

  if (response.status === 204) {
    return null as T
  }

  return response.json() as Promise<T>
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}
