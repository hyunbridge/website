import type { AnchorHTMLAttributes, PropsWithChildren, Ref } from "react"
import { forwardRef } from "react"

type LinkHref =
  | string
  | {
      pathname?: string | null
      hash?: string | null
      search?: string | null
    }

export type LinkProps = PropsWithChildren<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: LinkHref
    prefetch?: boolean
    replace?: boolean
    scroll?: boolean
  }
>

function AppLinkImpl(
  { href, children, prefetch: _prefetch, replace: _replace, scroll: _scroll, ...props }: LinkProps,
  ref: Ref<HTMLAnchorElement>,
) {
  const resolvedHref =
    typeof href === "string"
      ? href
      : `${href.pathname || ""}${href.search || ""}${href.hash || ""}` || "#"

  return (
    <a href={resolvedHref} ref={ref} {...props}>
      {children}
    </a>
  )
}

const AppLink = forwardRef<HTMLAnchorElement, LinkProps>(AppLinkImpl)

export default AppLink
