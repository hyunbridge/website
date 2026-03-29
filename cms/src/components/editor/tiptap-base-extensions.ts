"use client"

import { type AnyExtension } from "@tiptap/core"
import { StarterKit } from "@tiptap/starter-kit"
import { Markdown } from "@tiptap/markdown"
import { Image } from "@tiptap/extension-image"
import { Table } from "@tiptap/extension-table"
import { TableRow } from "@tiptap/extension-table-row"
import { TableHeader } from "@tiptap/extension-table-header"
import { TableCell } from "@tiptap/extension-table-cell"
import { TaskList } from "@tiptap/extension-task-list"
import { TaskItem } from "@tiptap/extension-task-item"

type BaseExtensionOptions = {
  editable?: boolean
}

export function createBaseTiptapExtensions(options: BaseExtensionOptions = {}): AnyExtension[] {
  const { editable = false } = options

  return [
    StarterKit.configure({
      link: {
        openOnClick: !editable,
      },
    }),
    Image,
    Table.configure({
      allowTableNodeSelection: true,
      cellMinWidth: 120,
      resizable: false,
    }),
    TableRow,
    TableHeader,
    TableCell,
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    Markdown.configure({
      markedOptions: {
        gfm: true,
      },
    }),
  ]
}
