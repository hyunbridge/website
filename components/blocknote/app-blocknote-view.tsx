"use client"

import React, { useContext } from "react"
import { mergeCSSClasses, type BlockSchema, type InlineContentSchema, type StyleSchema } from "@blocknote/core"
import { BlockNoteViewRaw, ComponentsContext } from "@blocknote/react"
import { components } from "@blocknote/mantine"
import "@blocknote/mantine/style.css"
import { MantineContext, MantineProvider } from "@mantine/core"

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

  const mantineContext = useContext(MantineContext)

  const view = (
    <ComponentsContext.Provider value={components}>
      <BlockNoteViewRaw
        data-mantine-color-scheme={colorScheme}
        className={mergeCSSClasses("bn-mantine", className || "")}
        theme={colorScheme}
        {...rest}
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
