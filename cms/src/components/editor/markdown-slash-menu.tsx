"use client"

import { Extension, type Editor, type Range } from "@tiptap/core"
import Suggestion, {
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion"
import {
  CheckSquare2,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Pilcrow,
  Quote,
  Table2,
} from "lucide-react"
import { createRoot, type Root } from "react-dom/client"

import { cn } from "@shared/lib/utils"

type MarkdownSlashMenuOptions = {
  onImageUpload?: (file: File) => Promise<string>
}

type SlashActionArgs = {
  editor: Editor
  range: Range
}

type SlashMenuItem = {
  key: string
  label: string
  description: string
  icon: LucideIcon
  keywords: string[]
  run: (args: SlashActionArgs) => void | Promise<void>
}

function filterItems(items: SlashMenuItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return items

  return items.filter((item) => {
    const haystack = [item.label, item.description, ...item.keywords].join(" ").toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}

function MarkdownSlashMenu({
  items,
  activeIndex,
  onActiveIndexChange,
  onSelect,
}: {
  items: SlashMenuItem[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (index: number) => void
}) {
  if (items.length === 0) {
    return <div className="markdown-slash-menu__empty">일치하는 명령이 없습니다.</div>
  }

  return (
    <div className="markdown-slash-menu" onMouseDown={(event) => event.preventDefault()}>
      <ul className="markdown-slash-menu__list" role="listbox" aria-label="에디터 명령">
        {items.map((item, index) => {
          const Icon = item.icon
          const isActive = index === activeIndex

          return (
            <li key={item.key} role="option" aria-selected={isActive}>
              <button
                type="button"
                className={cn("markdown-slash-menu__item", isActive && "is-active")}
                onMouseEnter={() => onActiveIndexChange(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  onSelect(index)
                }}
              >
                <span className="markdown-slash-menu__icon">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="markdown-slash-menu__content">
                  <span className="markdown-slash-menu__label">{item.label}</span>
                  <span className="markdown-slash-menu__description">{item.description}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function updateMenuPosition(container: HTMLElement, clientRect?: (() => DOMRect | null) | null) {
  const anchorRect = clientRect?.()
  if (!anchorRect) return

  const margin = 12
  const menuRect = container.getBoundingClientRect()
  const availableBelow = window.innerHeight - anchorRect.bottom - margin
  const availableAbove = anchorRect.top - margin
  const shouldOpenAbove =
    availableBelow < Math.min(menuRect.height, 280) && availableAbove > availableBelow
  const unclampedTop = shouldOpenAbove
    ? anchorRect.top - menuRect.height - 8
    : anchorRect.bottom + 8
  const top = Math.min(
    Math.max(margin, unclampedTop),
    Math.max(margin, window.innerHeight - menuRect.height - margin),
  )
  const left = Math.min(
    Math.max(margin, anchorRect.left),
    Math.max(margin, window.innerWidth - menuRect.width - margin),
  )

  container.style.top = `${top}px`
  container.style.left = `${left}px`
}

function createImagePicker() {
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

function createSlashMenuItems({ onImageUpload }: MarkdownSlashMenuOptions): SlashMenuItem[] {
  return [
    {
      key: "text",
      label: "텍스트",
      description: "일반 문단으로 전환",
      icon: Pilcrow,
      keywords: ["text", "paragraph", "문단", "본문"],
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setParagraph().run()
      },
    },
    {
      key: "heading-1",
      label: "제목 1",
      description: "가장 큰 제목",
      icon: Heading1,
      keywords: ["h1", "heading", "title", "제목"],
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run()
      },
    },
    {
      key: "heading-2",
      label: "제목 2",
      description: "중간 제목",
      icon: Heading2,
      keywords: ["h2", "heading", "subtitle", "소제목"],
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run()
      },
    },
    {
      key: "heading-3",
      label: "제목 3",
      description: "작은 제목",
      icon: Heading3,
      keywords: ["h3", "heading", "subheading"],
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHeading({ level: 3 }).run()
      },
    },
    {
      key: "bullet-list",
      label: "글머리 목록",
      description: "불릿 리스트 시작",
      icon: List,
      keywords: ["bullet", "list", "unordered", "목록"],
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run()
      },
    },
    {
      key: "numbered-list",
      label: "번호 목록",
      description: "순서 있는 리스트 시작",
      icon: ListOrdered,
      keywords: ["numbered", "ordered", "list", "번호"],
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run()
      },
    },
    {
      key: "todo-list",
      label: "체크리스트",
      description: "할 일 목록 시작",
      icon: CheckSquare2,
      keywords: ["todo", "task", "check", "체크", "할일"],
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run()
      },
    },
    {
      key: "quote",
      label: "인용문",
      description: "블록 인용 추가",
      icon: Quote,
      keywords: ["quote", "blockquote", "인용"],
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run()
      },
    },
    {
      key: "code",
      label: "코드 블록",
      description: "코드를 여러 줄로 작성",
      icon: Code2,
      keywords: ["code", "snippet", "pre", "코드"],
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setCodeBlock().run()
      },
    },
    {
      key: "table",
      label: "테이블",
      description: "3열 3행 표 삽입",
      icon: Table2,
      keywords: ["table", "grid", "표"],
      run: ({ editor, range }) => {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertTable({
            rows: 3,
            cols: 3,
            withHeaderRow: true,
          })
          .run()
      },
    },
    {
      key: "divider",
      label: "구분선",
      description: "섹션 구분선 삽입",
      icon: Minus,
      keywords: ["divider", "rule", "separator", "구분선"],
      run: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run()
      },
    },
    {
      key: "image",
      label: "이미지",
      description: "업로드한 이미지를 삽입",
      icon: ImagePlus,
      keywords: ["image", "upload", "photo", "그림", "이미지"],
      run: async ({ editor, range }) => {
        if (!onImageUpload) return

        editor.chain().focus().deleteRange(range).run()
        const file = await createImagePicker()
        if (!file) return

        const url = await onImageUpload(file)
        if (!url) return

        editor.chain().focus().setImage({ src: url, alt: file.name }).run()
      },
    },
  ]
}

function isSlashSelectionAllowed(editor: Editor) {
  const { $from } = editor.state.selection
  const parentName = $from.parent.type.name
  if (!["paragraph", "heading"].includes(parentName)) return false

  const blocked = new Set([
    "bulletList",
    "orderedList",
    "taskList",
    "listItem",
    "taskItem",
    "blockquote",
    "codeBlock",
    "table",
    "tableRow",
    "tableCell",
    "tableHeader",
  ])

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    if (blocked.has($from.node(depth).type.name)) {
      return false
    }
  }

  return true
}

function createRenderer() {
  let root: Root | null = null
  let container: HTMLDivElement | null = null
  let suggestion: SuggestionProps<SlashMenuItem, SlashMenuItem> | null = null
  let activeIndex = 0

  const destroy = () => {
    root?.unmount()
    container?.remove()
    root = null
    container = null
    suggestion = null
    activeIndex = 0
  }

  const selectItem = (index: number) => {
    if (!suggestion || suggestion.items.length === 0) return
    const item = suggestion.items[index]
    if (!item) return
    suggestion.command(item)
  }

  const renderMenu = () => {
    if (!root || !container || !suggestion) return

    root.render(
      <MarkdownSlashMenu
        items={suggestion.items}
        activeIndex={activeIndex}
        onActiveIndexChange={(index) => {
          activeIndex = index
          renderMenu()
        }}
        onSelect={selectItem}
      />,
    )

    requestAnimationFrame(() => {
      if (container && suggestion) {
        updateMenuPosition(container, suggestion.clientRect)
      }
    })
  }

  return {
    onStart: (props: SuggestionProps<SlashMenuItem, SlashMenuItem>) => {
      suggestion = props
      activeIndex = 0
      container = document.createElement("div")
      container.className = "markdown-slash-menu-root"
      document.body.appendChild(container)
      root = createRoot(container)
      renderMenu()
    },
    onUpdate: (props: SuggestionProps<SlashMenuItem, SlashMenuItem>) => {
      suggestion = props
      activeIndex = Math.min(activeIndex, Math.max(0, props.items.length - 1))
      renderMenu()
    },
    onKeyDown: (props: SuggestionKeyDownProps) => {
      if (!suggestion || suggestion.items.length === 0) return false

      if (props.event.key === "ArrowDown") {
        props.event.preventDefault()
        activeIndex = (activeIndex + 1) % suggestion.items.length
        renderMenu()
        return true
      }

      if (props.event.key === "ArrowUp") {
        props.event.preventDefault()
        activeIndex = (activeIndex - 1 + suggestion.items.length) % suggestion.items.length
        renderMenu()
        return true
      }

      if (props.event.key === "Enter" || props.event.key === "Tab") {
        props.event.preventDefault()
        selectItem(activeIndex)
        return true
      }

      if (props.event.key === "Escape") {
        props.event.preventDefault()
        exitSuggestion(props.view)
        return true
      }

      return false
    },
    onExit: destroy,
  }
}

export function createMarkdownSlashCommandExtension(options: MarkdownSlashMenuOptions = {}) {
  const items = createSlashMenuItems(options)

  return Extension.create({
    name: "markdownSlashCommand",

    addProseMirrorPlugins() {
      return [
        Suggestion<SlashMenuItem, SlashMenuItem>({
          editor: this.editor,
          char: "/",
          startOfLine: true,
          allowedPrefixes: null,
          allow: ({ editor }) => isSlashSelectionAllowed(editor),
          items: ({ query }) => filterItems(items, query),
          command: ({ editor, range, props }) => {
            void props.run({ editor, range })
          },
          render: createRenderer,
        }),
      ]
    },
  })
}
