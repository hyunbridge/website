import { useCallback, useMemo } from "react"
import {
  useLocation,
  useNavigate,
  useParams as useReactRouterParams,
  useSearchParams as useReactRouterSearchParams,
} from "react-router-dom"

export function useRouter() {
  const navigate = useNavigate()
  const location = useLocation()

  const currentHref = `${location.pathname}${location.search}${location.hash}`

  const push = useCallback(
    (href: string) => {
      if (href === currentHref) {
        return
      }
      navigate(href)
    },
    [currentHref, navigate],
  )

  const replace = useCallback(
    (href: string) => {
      if (href === currentHref) {
        return
      }
      navigate(href, { replace: true })
    },
    [currentHref, navigate],
  )

  const back = useCallback(() => navigate(-1), [navigate])
  const forward = useCallback(() => navigate(1), [navigate])
  const refresh = useCallback(() => window.location.reload(), [])
  const prefetch = useCallback(async (_href: string) => {}, [])

  return useMemo(
    () => ({
      push,
      replace,
      back,
      forward,
      refresh,
      prefetch,
    }),
    [back, forward, prefetch, push, refresh, replace],
  )
}

export function usePathname() {
  return useLocation().pathname
}

export function useSearchParams() {
  return useReactRouterSearchParams()[0]
}

export function useParams<T extends Record<string, string | undefined>>() {
  return useReactRouterParams() as T
}

export function redirect(href: string): never {
  window.location.assign(href)
  throw new Error(`Redirecting to ${href}`)
}

export function notFound(): never {
  throw new Error("Not Found")
}
