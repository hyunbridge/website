/**
 * Content versioning utilities for markdown source.
 */

export function textSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (!a || !b) return 0

  const wordsA = a.toLowerCase().split(/\s+/).filter(Boolean)
  const wordsB = b.toLowerCase().split(/\s+/).filter(Boolean)

  if (wordsA.length === 0 && wordsB.length === 0) return 1
  if (wordsA.length === 0 || wordsB.length === 0) return 0

  const setA = new Set(wordsA)
  const setB = new Set(wordsB)

  let intersection = 0
  for (const word of setA) {
    if (setB.has(word)) intersection++
  }

  const union = setA.size + setB.size - intersection
  return union === 0 ? 1 : intersection / union
}

/**
 * Extract plain text from content string for similarity comparison.
 * Content is now stored as plain markdown, so we just strip markdown
 * syntax characters to get raw text for comparison.
 */
export function contentToText(content: string): string {
  if (!content) return ""
  return content
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/~~(.+?)~~/g, "$1") // strikethrough
    .replace(/`(.+?)`/g, "$1") // inline code
    .replace(/^\s*[-*+]\s+/gm, "") // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, "") // ordered list markers
    .replace(/^\s*>\s+/gm, "") // blockquotes
    .replace(/!\[.*?\]\(.*?\)/g, "") // images
    .replace(/\[(.+?)\]\(.*?\)/g, "$1") // links (keep text)
    .replace(/---+/g, "") // horizontal rules
    .replace(/```[\s\S]*?```/g, "") // code blocks
    .trim()
}

export const blocksToText = contentToText

export const SIMILARITY_THRESHOLD = 0.85
