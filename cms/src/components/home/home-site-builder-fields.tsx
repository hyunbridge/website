"use client"

import type { ReactNode } from "react"

import Link from "@/components/ui/app-link"
import { MarkdownEditor } from "@/components/editor/markdown-editor"
import { MarkdownPreview } from "@/components/editor/markdown-preview"
import { Button } from "@shared/components/ui/button"
import { Input } from "@shared/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { resolveHomeHref } from "@shared/lib/home-page-utils"

import type { HomeRichContent } from "@/lib/home-page-service"

export function formatHomeDisplayDate(dateString: string | null | undefined) {
  if (!dateString) return ""
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(dateString))
}

export function RichContentField({
  value,
  onChange,
  editable,
  className,
  dark = false,
  editorClassName,
}: {
  value: HomeRichContent
  onChange: (content: HomeRichContent) => void
  editable: boolean
  className?: string
  dark?: boolean
  editorClassName?: string
}) {
  return (
    <div className={className}>
      <div
        className={`home-builder-rich-content rounded-[1.4rem] ${editable ? "border border-dashed border-border/60 bg-background/40" : ""} ${dark ? "[&_.editor-content--editable_.ProseMirror]:text-white [&_.editor-content--editable_.ProseMirror]:opacity-90 [&_.editor-content--readonly_.ProseMirror]:text-white [&_.editor-content--readonly_.ProseMirror]:opacity-90" : ""} ${editorClassName || ""}`}
      >
        {editable ? (
          <MarkdownEditor
            content={(value as string) || ""}
            onChange={(markdown) => onChange(markdown as HomeRichContent)}
          />
        ) : (
          <MarkdownPreview content={(value as string) || ""} />
        )}
      </div>
    </div>
  )
}

export function EditableInput({
  value,
  onChange,
  editable,
  className,
}: {
  value: string
  onChange: (value: string) => void
  editable: boolean
  className?: string
}) {
  if (!editable) return <div className={className}>{value}</div>

  return (
    <Input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`h-auto border-dashed border-border/50 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 ${className || ""}`}
    />
  )
}

export function EditableTextarea({
  value,
  onChange,
  editable,
  className,
  rows = 3,
}: {
  value: string
  onChange: (value: string) => void
  editable: boolean
  className?: string
  rows?: number
}) {
  if (!editable) return <div className={className}>{value}</div>

  return (
    <Textarea
      rows={rows}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`min-h-0 resize-y border-dashed border-border/50 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0 ${className || ""}`}
    />
  )
}

export function EditableLinkButton({
  editable,
  label,
  href,
  variant,
  onChange,
}: {
  editable: boolean
  label: string
  href: string
  variant: "primary" | "secondary" | "light"
  onChange: (next: { label: string; href: string }) => void
}) {
  const hrefState = resolveHomeHref(href, "/")
  const safeHref = hrefState.href
  const isInteractive = hrefState.isValid && href.trim().length > 0
  const buttonClass =
    variant === "primary"
      ? "bg-foreground text-background"
      : variant === "light"
        ? "bg-white text-slate-900"
        : "border border-border/60 bg-background/76 text-foreground"

  return (
    <div className="space-y-2">
      {editable ? (
        <div className="grid gap-2 md:grid-cols-[minmax(0,10rem)_minmax(0,14rem)]">
          <Input
            value={label}
            onChange={(event) => onChange({ label: event.target.value, href })}
            className="rounded-full border-dashed border-border/60 bg-transparent"
          />
          <Input
            value={href}
            onChange={(event) => onChange({ label, href: event.target.value })}
            className="rounded-full border-dashed border-border/60 bg-transparent"
          />
        </div>
      ) : null}
      {editable && href.trim() ? (
        hrefState.isValid ? (
          hrefState.wasNormalized ? (
            <p className="text-xs text-muted-foreground">
              저장 및 미리보기 시 <span className="font-mono">{hrefState.href}</span> 로 사용됩니다.
            </p>
          ) : null
        ) : (
          <p className="text-xs text-destructive">
            유효한 링크 형식이 아닙니다. <span className="font-mono">projects</span>,{" "}
            <span className="font-mono">/projects</span>,{" "}
            <span className="font-mono">#contact</span>, <span className="font-mono">mailto:</span>{" "}
            형식을 사용하세요.
          </p>
        )
      ) : null}
      {!href.trim() && editable ? (
        <p className="text-xs text-muted-foreground">
          링크를 입력하면 버튼 미리보기가 활성화됩니다.
        </p>
      ) : null}
      {isInteractive ? (
        <Link
          href={safeHref}
          className={`inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium ${buttonClass}`}
        >
          {label}
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={`inline-flex cursor-not-allowed items-center gap-2 rounded-full px-5 py-3 text-sm font-medium opacity-50 ${buttonClass}`}
        >
          {label}
        </span>
      )}
    </div>
  )
}

export function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className="h-8 w-8 text-muted-foreground"
    >
      {children}
    </Button>
  )
}
