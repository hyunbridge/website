"use client"

import { Extension, type Editor } from "@tiptap/core"
import { TextSelection } from "@tiptap/pm/state"

function moveCurrentBlock(editor: Editor, direction: "up" | "down") {
  const { state, view } = editor
  const { doc, selection } = state

  if (!selection.empty || doc.childCount < 2) {
    return false
  }

  const { $from } = selection
  if ($from.depth < 1) {
    return false
  }

  const index = $from.index(0)
  const currentNode = doc.child(index)
  const currentPos = $from.before(1)

  if (direction === "up") {
    if (index === 0) {
      return false
    }

    const previousNode = doc.child(index - 1)
    const insertPos = currentPos - previousNode.nodeSize
    const tr = state.tr.delete(currentPos, currentPos + currentNode.nodeSize)

    tr.insert(insertPos, currentNode)
    tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)))
    view.dispatch(tr.scrollIntoView())
    return true
  }

  if (index >= doc.childCount - 1) {
    return false
  }

  const nextNode = doc.child(index + 1)
  const insertPos = currentPos + nextNode.nodeSize
  const tr = state.tr.delete(currentPos, currentPos + currentNode.nodeSize)

  tr.insert(insertPos, currentNode)
  tr.setSelection(TextSelection.near(tr.doc.resolve(insertPos + 1)))
  view.dispatch(tr.scrollIntoView())
  return true
}

function resetEmptyBlock(editor: Editor) {
  const { selection } = editor.state
  if (!selection.empty) {
    return false
  }

  const { $from } = selection
  const parent = $from.parent
  if (!parent.isTextblock || parent.type.name === "paragraph") {
    return false
  }

  if ($from.parentOffset !== 0 || parent.textContent.length > 0) {
    return false
  }

  if (editor.isActive("blockquote")) {
    return editor.commands.unsetBlockquote()
  }

  if (editor.isActive("heading") || editor.isActive("codeBlock")) {
    return editor.commands.clearNodes()
  }

  return false
}

export const TiptapBlockUx = Extension.create({
  name: "tiptapBlockUx",

  addKeyboardShortcuts() {
    return {
      Backspace: () => resetEmptyBlock(this.editor),
      "Mod-Shift-ArrowUp": () => moveCurrentBlock(this.editor, "up"),
      "Mod-Shift-ArrowDown": () => moveCurrentBlock(this.editor, "down"),
    }
  },
})
