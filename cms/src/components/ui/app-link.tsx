import type { AnchorHTMLAttributes, PropsWithChildren, Ref } from "react"
import { forwardRef } from "react"
import { Link as RouterLink } from "react-router-dom"

export type LinkProps = PropsWithChildren<
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string
    prefetch?: boolean
    replace?: boolean
    scroll?: boolean
  }
>

function isExternalHref(href: string) {
  return (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  )
}

function AppLinkImpl(
  { href, children, prefetch: _prefetch, replace, scroll: _scroll, onClick, ...props }: LinkProps,
  ref: Ref<HTMLAnchorElement>,
) {
  if (isExternalHref(href)) {
    return (
      <a href={href} ref={ref} onClick={onClick} {...props}>
        {children}
      </a>
    )
  }

  return (
    <RouterLink to={href} replace={replace} ref={ref} onClick={onClick} {...props}>
      {children}
    </RouterLink>
  )
}

const AppLink = forwardRef<HTMLAnchorElement, LinkProps>(AppLinkImpl)

export default AppLink
