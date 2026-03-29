import type { CSSProperties, ImgHTMLAttributes } from "react"
import { forwardRef } from "react"

type AppImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> & {
  src: string
  alt: string
  width?: number
  height?: number
  fill?: boolean
  sizes?: string
  priority?: boolean
  unoptimized?: boolean
}

const AppImage = forwardRef<HTMLImageElement, AppImageProps>(function AppImage(
  { src, alt, fill, style, className, width, height, sizes, loading, ...props },
  ref,
) {
  const mergedStyle: CSSProperties = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        ...style,
      }
    : { ...style }

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      loading={loading || "lazy"}
      className={className}
      style={mergedStyle}
      {...props}
    />
  )
})

export default AppImage
