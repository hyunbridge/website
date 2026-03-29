"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import { BubbleMenu, FloatingMenu } from "@tiptap/react/menus"
import { Placeholder } from "@tiptap/extension-placeholder"
import { DragHandle } from "@tiptap/extension-drag-handle"
import { CellSelection, isInTable, selectedRect } from "@tiptap/pm/tables"
import {
  Bold,
  CheckSquare2,
  Columns2,
  Code2,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  Plus,
  Quote,
  Rows2,
  Table2,
  Strikethrough,
  Trash2,
} from "lucide-react"

import { createMarkdownSlashCommandExtension } from "@/components/editor/markdown-slash-menu"
import { createBaseTiptapExtensions } from "@/components/editor/tiptap-base-extensions"
import { TiptapBlockUx } from "@/components/editor/tiptap-block-ux"
import { cn } from "@shared/lib/utils"

type MarkdownEditorProps = {
  content?: string
  onChange?: (markdown: string) => void
  onImageUpload?: (file: File) => Promise<string>
  className?: string
}

const EMPTY_MARKDOWN = ""

async function pickImageFile() {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.style.display = "none"
    document.body.appendChild(input)

    const cleanup = () => {
      input.remove()
    }

    input.addEventListener(
      "change",
      () => {
        const file = input.files?.[0] ?? null
        cleanup()
        resolve(file)
      },
      { once: true },
    )

    input.addEventListener(
      "cancel",
      () => {
        cleanup()
        resolve(null)
      },
      { once: true },
    )

    input.click()
  })
}

async function insertImages(
  editor: Editor,
  files: File[],
  onImageUpload: (file: File) => Promise<string>,
  position?: number,
) {
  const imageFiles = files.filter((file) => file.type.startsWith("image/"))
  if (imageFiles.length === 0) return false

  for (const [index, file] of imageFiles.entries()) {
    const url = await onImageUpload(file)
    if (!url) continue

    let chain = editor.chain().focus()
    if (typeof position === "number" && index === 0) {
      chain = chain.setTextSelection(position)
    }

    chain.setImage({ src: url, alt: file.name }).run()
  }

  return true
}

function ToolbarButton({
  active = false,
  disabled = false,
  onClick,
  title,
  children,
  className,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn(
        "tiptap-toolbar__button",
        active && "is-active",
        disabled && "is-disabled",
        className,
      )}
      onMouseDown={(event) => {
        event.preventDefault()
        if (disabled) return
        onClick()
      }}
      title={title}
      aria-label={title}
      aria-disabled={disabled}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

function shouldShowBubbleMenu({ editor, from, to }: { editor: Editor; from: number; to: number }) {
  if (!editor.isEditable) return false
  if (editor.isActive("codeBlock")) return false
  if (editor.isActive("table")) return false
  return from !== to
}

function shouldShowFloatingBlockMenu({ editor }: { editor: Editor }) {
  if (!editor.isEditable) return false

  const { selection } = editor.state
  if (!selection.empty) return false

  const { $from } = selection
  const parent = $from.parent
  if (!parent.isTextblock) return false
  if (parent.type.spec.code) return false
  if (parent.textContent.length > 0) return false

  const blocked = new Set([
    "blockquote",
    "codeBlock",
    "table",
    "tableRow",
    "tableCell",
    "tableHeader",
  ])
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if (blocked.has($from.node(depth).type.name)) return false
  }

  return true
}

function EditorBubbleToolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previousHref = editor.getAttributes("link").href as string | undefined
    const href = window.prompt("링크 URL", previousHref || "https://")
    if (href === null) return
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run()
  }

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={shouldShowBubbleMenu}
      className="tiptap-bubble-menu"
      options={{ strategy: "fixed", placement: "top" }}
    >
      <div className="tiptap-toolbar">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="굵게"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="기울임"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="취소선"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="인라인 코드"
        >
          <Code2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("link")} onClick={setLink} title="링크">
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </BubbleMenu>
  )
}

type TableToolbarState = {
  top: number
  left: number
  rowActionsEnabled: boolean
  columnActionsEnabled: boolean
}

function resolveTableToolbarState(editor: Editor): TableToolbarState | null {
  if (!isInTable(editor.state)) {
    return null
  }

  const rect = selectedRect(editor.state)
  const tablePos = rect.tableStart - 1
  const tableNode = editor.view.nodeDOM(tablePos)
  if (!(tableNode instanceof HTMLElement)) {
    return null
  }

  const wrappedTable = tableNode.closest(".tableWrapper")
  const anchor = wrappedTable instanceof HTMLElement ? wrappedTable : tableNode
  const bounds = anchor.getBoundingClientRect()
  const selection = editor.state.selection

  let rowActionsEnabled = true
  let columnActionsEnabled = true

  if (selection instanceof CellSelection) {
    const width = rect.right - rect.left
    const height = rect.bottom - rect.top

    if (width === 1 && height > 1) {
      rowActionsEnabled = false
    } else if (height === 1 && width > 1) {
      columnActionsEnabled = false
    } else if (width > 1 && height > 1) {
      rowActionsEnabled = false
      columnActionsEnabled = false
    }
  }

  const margin = 12
  const estimatedToolbarHeight = 52
  const maxLeft = Math.max(margin, window.innerWidth - margin - 320)

  return {
    top: Math.max(margin, bounds.top - estimatedToolbarHeight - 8),
    left: Math.min(Math.max(margin, bounds.left), maxLeft),
    rowActionsEnabled,
    columnActionsEnabled,
  }
}

function EditorTableToolbar({ editor }: { editor: Editor }) {
  const [state, setState] = useState<TableToolbarState | null>(null)

  useEffect(() => {
    const update = () => {
      setState(resolveTableToolbarState(editor))
    }

    update()
    editor.on("selectionUpdate", update)
    editor.on("transaction", update)
    window.addEventListener("resize", update)
    window.addEventListener("scroll", update, true)

    return () => {
      editor.off("selectionUpdate", update)
      editor.off("transaction", update)
      window.removeEventListener("resize", update)
      window.removeEventListener("scroll", update, true)
    }
  }, [editor])

  if (!state) {
    return null
  }

  return (
    <div
      className="tiptap-table-menu"
      style={{
        position: "fixed",
        top: `${state.top}px`,
        left: `${state.left}px`,
        zIndex: 1000,
      }}
    >
      <div className="tiptap-toolbar">
        <ToolbarButton
          className="tiptap-toolbar__button--label"
          disabled={!state.columnActionsEnabled}
          onClick={() => editor.chain().focus().addColumnBefore().run()}
          title="왼쪽 열 추가"
        >
          <Columns2 className="h-4 w-4" />
          <span>왼열</span>
        </ToolbarButton>
        <ToolbarButton
          className="tiptap-toolbar__button--label"
          disabled={!state.columnActionsEnabled}
          onClick={() => editor.chain().focus().addColumnAfter().run()}
          title="오른쪽 열 추가"
        >
          <Columns2 className="h-4 w-4" />
          <span>오른열</span>
        </ToolbarButton>
        <ToolbarButton
          className="tiptap-toolbar__button--label"
          disabled={!state.rowActionsEnabled}
          onClick={() => editor.chain().focus().addRowBefore().run()}
          title="위 행 추가"
        >
          <Rows2 className="h-4 w-4" />
          <span>위행</span>
        </ToolbarButton>
        <ToolbarButton
          className="tiptap-toolbar__button--label"
          disabled={!state.rowActionsEnabled}
          onClick={() => editor.chain().focus().addRowAfter().run()}
          title="아래 행 추가"
        >
          <Rows2 className="h-4 w-4" />
          <span>아래행</span>
        </ToolbarButton>
        <ToolbarButton
          className="tiptap-toolbar__button--label"
          disabled={!state.columnActionsEnabled}
          onClick={() => editor.chain().focus().deleteColumn().run()}
          title="현재 열 삭제"
        >
          <span>열삭제</span>
        </ToolbarButton>
        <ToolbarButton
          className="tiptap-toolbar__button--label"
          disabled={!state.rowActionsEnabled}
          onClick={() => editor.chain().focus().deleteRow().run()}
          title="현재 행 삭제"
        >
          <span>행삭제</span>
        </ToolbarButton>
        <ToolbarButton
          className="tiptap-toolbar__button--label"
          disabled={!state.rowActionsEnabled}
          onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          title="헤더 행 전환"
        >
          <span>머리행</span>
        </ToolbarButton>
        <ToolbarButton
          className="tiptap-toolbar__button--label"
          disabled={!state.columnActionsEnabled}
          onClick={() => editor.chain().focus().toggleHeaderColumn().run()}
          title="헤더 열 전환"
        >
          <span>머리열</span>
        </ToolbarButton>
        <ToolbarButton
          className="tiptap-toolbar__button--label"
          onClick={() => editor.chain().focus().mergeOrSplit().run()}
          title="셀 병합 또는 분할"
        >
          <span>병합/분할</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="표 삭제">
          <Trash2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  )
}

function EditorFloatingBlockMenu({
  editor,
  onImageUpload,
}: {
  editor: Editor
  onImageUpload?: (file: File) => Promise<string>
}) {
  const insertImage = async () => {
    if (!onImageUpload) return
    const file = await pickImageFile()
    if (!file) return
    const url = await onImageUpload(file)
    if (!url) return
    editor.chain().focus().setImage({ src: url, alt: file.name }).run()
  }

  return (
    <FloatingMenu
      editor={editor}
      shouldShow={shouldShowFloatingBlockMenu}
      className="tiptap-floating-menu"
      options={{ strategy: "fixed", placement: "left-start", offset: 12 }}
    >
      <div className="tiptap-toolbar tiptap-toolbar--floating">
        <span className="tiptap-toolbar__prefix">
          <Plus className="h-3.5 w-3.5" />
        </span>
        <ToolbarButton
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="제목 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="제목 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="글머리 목록"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("taskList")}
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          title="체크리스트"
        >
          <CheckSquare2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="인용문"
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("table")}
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          title="표"
        >
          <Table2 className="h-4 w-4" />
        </ToolbarButton>
        {onImageUpload ? (
          <ToolbarButton onClick={() => void insertImage()} title="이미지">
            <ImagePlus className="h-4 w-4" />
          </ToolbarButton>
        ) : null}
      </div>
    </FloatingMenu>
  )
}

export function MarkdownEditor({
  content,
  onChange,
  onImageUpload,
  className,
}: MarkdownEditorProps) {
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onImageUploadRef = useRef(onImageUpload)
  onImageUploadRef.current = onImageUpload

  const editor = useEditor({
    immediatelyRender: true,
    content: content || EMPTY_MARKDOWN,
    contentType: "markdown",
    extensions: [
      ...createBaseTiptapExtensions({ editable: true }),
      Placeholder.configure({
        placeholder: "내용을 입력하세요… '/'로 명령 사용",
      }),
      TiptapBlockUx,
      DragHandle.configure({
        render: () => {
          const element = document.createElement("button")
          element.type = "button"
          element.className = "tiptap-drag-handle"
          element.tabIndex = -1
          element.setAttribute("aria-label", "블록 이동")
          return element
        },
        computePositionConfig: {
          placement: "left-start",
        },
        nested: true,
      }),
      createMarkdownSlashCommandExtension({
        onImageUpload: async (file) => onImageUploadRef.current?.(file) || "",
      }),
    ],
    editorProps: {
      attributes: {
        class: "ProseMirror markdown-content",
      },
      handlePaste: (_view, event) => {
        if (!onImageUploadRef.current) return false
        const files = Array.from(event.clipboardData?.files ?? [])
        if (files.length === 0) return false

        event.preventDefault()
        void insertImages(editor, files, onImageUploadRef.current)
        return true
      },
      handleDrop: (view, event) => {
        if (!onImageUploadRef.current || !event.dataTransfer) return false
        const files = Array.from(event.dataTransfer.files)
        if (files.length === 0) return false

        const position = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        })?.pos

        event.preventDefault()
        void insertImages(editor, files, onImageUploadRef.current, position)
        return true
      },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current?.(editor.getMarkdown())
    },
  })

  useEffect(() => {
    if (!editor) return

    const current = editor.getMarkdown()
    const next = content || EMPTY_MARKDOWN
    if (current === next) return

    editor.commands.setContent(next, {
      contentType: "markdown",
      emitUpdate: false,
    })
  }, [editor, content])

  if (!editor) {
    return null
  }

  return (
    <div className={cn("editor-content editor-content--editable", className)} data-editable="true">
      <EditorFloatingBlockMenu editor={editor} onImageUpload={onImageUpload} />
      <EditorBubbleToolbar editor={editor} />
      <EditorTableToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  )
}
