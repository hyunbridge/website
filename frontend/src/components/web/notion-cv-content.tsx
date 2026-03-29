import { NotionRenderer } from "react-notion-x"
import "react-notion-x/src/styles.css"
import "prismjs/themes/prism.css"

type NotionCvContentProps = {
  cv: {
    recordMap?: unknown
  } | null
  printMode?: boolean
}

function getLastModifiedTimestamp(recordMap: unknown): string | null {
  if (!recordMap || typeof recordMap !== "object" || !("block" in recordMap)) return null

  const block = recordMap.block
  if (!block || typeof block !== "object") return null

  const pageId = Object.keys(block)[0]
  const lastEditedTime = (
    block as Record<
      string,
      { value?: { last_edited_time?: string | number | null } } | null | undefined
    >
  )[pageId]?.value?.last_edited_time

  return lastEditedTime?.toString() || null
}

function formatLastModified(timestamp: string | number | null): string {
  if (!timestamp) return "알 수 없음"
  const normalizedTimestamp = typeof timestamp === "string" ? Number(timestamp) : timestamp
  const date = new Date(normalizedTimestamp)

  if (Number.isNaN(date.getTime())) {
    return "알 수 없음"
  }

  return date.toLocaleDateString("ko-KR")
}

export function NotionCvContent({ cv, printMode = false }: NotionCvContentProps) {
  if (!cv?.recordMap) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card/80 p-6 text-sm text-muted-foreground">
        이력서 내용을 불러오지 못했습니다.
      </div>
    )
  }

  const lastEditedTimestamp = getLastModifiedTimestamp(cv.recordMap)
  const formattedDate = formatLastModified(lastEditedTimestamp)

  return (
    <div
      className="notion-container dark:text-white"
      data-cv-print-ready={printMode ? "true" : undefined}
    >
      <NotionRenderer
        recordMap={cv.recordMap as never}
        fullPage={false}
        darkMode={false}
        mapPageUrl={(pageId) => `/cv?id=${pageId}`}
      />
      <p className="mt-6 text-sm italic text-muted-foreground">마지막 업데이트: {formattedDate}</p>
    </div>
  )
}
