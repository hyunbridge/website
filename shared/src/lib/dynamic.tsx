import type { ComponentType, ReactElement } from "react"
import { lazy, Suspense } from "react"

type Loader<TProps> = () => Promise<ComponentType<TProps> | { default: ComponentType<TProps> }>

export default function dynamic<TProps>(
  loader: Loader<TProps>,
  options?: { ssr?: boolean; loading?: ComponentType },
) {
  const LazyComponent = lazy(async (): Promise<{ default: ComponentType<TProps> }> => {
    const loaded = await loader()
    if ("default" in loaded) {
      return loaded
    }
    return { default: loaded }
  })

  return function DynamicComponent(props: TProps): ReactElement {
    const Loading = options?.loading
    const ResolvedComponent = LazyComponent as unknown as ComponentType<Record<string, unknown>>
    return (
      <Suspense fallback={Loading ? <Loading /> : null}>
        <ResolvedComponent {...(props as Record<string, unknown>)} />
      </Suspense>
    )
  }
}
