"use client"

import React, { useCallback, useContext } from "react"
import { mergeCSSClasses, type BlockSchema, type InlineContentSchema, type StyleSchema } from "@blocknote/core"
import { BlockNoteViewRaw, ComponentsContext } from "@blocknote/react"
import { components, applyBlockNoteCSSVariablesFromTheme, removeBlockNoteCSSVariables } from "@blocknote/mantine"
import "@blocknote/mantine/style.css"
import { MantineContext, MantineProvider } from "@mantine/core"
import { BLOCKNOTE_APP_THEME } from "@/lib/blocknote-theme"

type ColorScheme = "light" | "dark"

export const AppBlockNoteView = <
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema,
>(
  props: Omit<React.ComponentProps<typeof BlockNoteViewRaw<BSchema, ISchema, SSchema>>, "theme"> & {
    colorScheme: ColorScheme
  },
) => {
  const { className, colorScheme, ...rest } = props

  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    removeBlockNoteCSSVariables(node)
    applyBlockNoteCSSVariablesFromTheme(BLOCKNOTE_APP_THEME, node)
  }, [])

  const mantineContext = useContext(MantineContext)

  const view = (
    <ComponentsContext.Provider value={components}>
      <BlockNoteViewRaw
        data-mantine-color-scheme={colorScheme}
        className={mergeCSSClasses("bn-mantine", className || "")}
        theme={colorScheme}
        {...rest}
        ref={ref}
      />
    </ComponentsContext.Provider>
  )

  if (mantineContext) return view

  return (
    <MantineProvider withCssVariables={false} getRootElement={() => undefined}>
      {view}
    </MantineProvider>
  )
}
