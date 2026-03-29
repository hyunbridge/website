import { getConfiguredApiBaseUrl } from "@/lib/env"

export const AUTH_TOKEN_STORAGE_KEY = "website.admin.accessToken"

export type RequestOptions = {
  method?: string
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  auth?: boolean
  responseType?: "json" | "blob" | "text"
  headers?: Record<string, string>
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

function isBrowser() {
  return typeof window !== "undefined"
}

export function getApiBaseUrl() {
  return getConfiguredApiBaseUrl().replace(/\/+$/, "")
}

export function getAuthToken() {
  if (!isBrowser()) return null
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

export function setAuthToken(token: string | null) {
  if (!isBrowser()) return
  if (token) {
    window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token)
    return
  }
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
}

function buildURL(path: string, query?: RequestOptions["query"]) {
  const url = new URL(getApiBaseUrl() + path)
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return
      url.searchParams.set(key, String(value))
    })
  }
  return url.toString()
}

async function readErrorPayload(response: Response) {
  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("application/json")) {
    return response.json().catch(() => null)
  }
  return response.text().catch(() => null)
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  }

  if (options.auth) {
    const token = getAuthToken()
    if (!token) {
      throw new ApiError("로그인이 필요합니다.", 401, null)
    }
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(buildURL(path, options.query), {
    method: options.method || (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    return null as T
  }

  return response.json() as Promise<T>
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError
}
