import { useCallback, useSyncExternalStore } from "react"

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback)
  window.addEventListener("hashchange", callback)
  return () => {
    window.removeEventListener("popstate", callback)
    window.removeEventListener("hashchange", callback)
  }
}

function getPathname() {
  return typeof window === "undefined" ? "/" : window.location.pathname
}

function getSearch() {
  return typeof window === "undefined" ? "" : window.location.search
}

export function useRouter() {
  return {
    push: useCallback((href: string) => window.location.assign(href), []),
    replace: useCallback((href: string) => window.location.replace(href), []),
    back: useCallback(() => window.history.back(), []),
    forward: useCallback(() => window.history.forward(), []),
    refresh: useCallback(() => window.location.reload(), []),
    prefetch: useCallback(async (_href: string) => {}, []),
  }
}

export function usePathname() {
  return useSyncExternalStore(subscribe, getPathname, () => "/")
}

export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, getSearch, () => "")
  return new URLSearchParams(search)
}

export function useParams<T extends Record<string, string | undefined>>() {
  return {} as T
}

export function redirect(href: string): never {
  if (typeof window !== "undefined") {
    window.location.assign(href)
  }
  throw new Error(`Redirecting to ${href}`)
}

export function notFound(): never {
  throw new Error("Not Found")
}
