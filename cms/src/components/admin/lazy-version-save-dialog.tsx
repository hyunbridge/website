import { Suspense, lazy } from "react"

import type { VersionSaveDialogProps } from "./version-save-dialog"

const VersionSaveDialog = lazy(async () => {
  const module = await import("./version-save-dialog")
  return { default: module.VersionSaveDialog }
})

export function LazyVersionSaveDialog(props: VersionSaveDialogProps) {
  return (
    <Suspense fallback={null}>
      <VersionSaveDialog {...props} />
    </Suspense>
  )
}
