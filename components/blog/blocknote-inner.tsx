"use client"

import { useCallback, useEffect, useRef } from "react"
import { type Block } from "@blocknote/core"
import { useCreateBlockNote } from "@blocknote/react"
import { useTheme } from "next-themes"
import { AppBlockNoteView } from "@/components/blocknote/app-blocknote-view"
import { savePostDraftContent } from "@/lib/blog-service"
import { uploadToS3 } from "@/lib/s3-service"

type Props = {
    initialContent?: Block[]
    editable?: boolean
    postId?: string
    onChange?: (blocks: Block[]) => void
    onSaveStatusChange?: (status: "idle" | "saving" | "saved" | "error") => void
    onAutosaveCommitted?: () => void
}

type ParsedBlockNode = {
    type?: string
    text?: string
    content?: ParsedBlockNode[]
    children?: ParsedBlockNode[]
}

// ─── Similarity Engine ──────────────────────────────────────────────
// Jaccard similarity on word-level bigrams for detecting meaningful changes
function textSimilarity(a: string, b: string): number {
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

function blocksToText(content: string): string {
    try {
        const blocks = JSON.parse(content)
        if (!Array.isArray(blocks)) return content
        return blocks.map((block: ParsedBlockNode) => {
            let text = ""
            if (block.content) {
                for (const item of block.content) {
                    if (item.type === "text") text += item.text || ""
                }
            }
            if (block.children?.length) {
                text += " " + block.children.map((c: ParsedBlockNode) => {
                    if (c.content) return c.content.map((i: ParsedBlockNode) => i.text || "").join("")
                    return ""
                }).join(" ")
            }
            return text
        }).filter(Boolean).join(" ")
    } catch {
        return content || ""
    }
}

// Threshold: below this similarity → new version, above → update existing
const SIMILARITY_THRESHOLD = 0.85

// ─── Component ──────────────────────────────────────────────────────
export default function BlockNoteInnerEditor({
    initialContent,
    editable = false,
    postId,
    onChange,
    onSaveStatusChange,
    onAutosaveCommitted,
}: Props) {
    const { resolvedTheme } = useTheme()
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isMountedRef = useRef(true)

    useEffect(() => {
        return () => {
            isMountedRef.current = false
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        }
    }, [])

    // Custom image upload handler
    const uploadFile = useCallback(
        async (file: File) => {
            if (!postId) return ""
            try {
                return await uploadToS3(file, postId)
            } catch (error) {
                console.error("Image upload failed:", error)
                return ""
            }
        },
        [postId],
    )

    const editor = useCreateBlockNote({
        initialContent: initialContent && initialContent.length > 0 ? initialContent : undefined,
        uploadFile: editable ? uploadFile : undefined,
    })

    // Auto-save: only saves draft (posts.content). Versioning is handled separately.
    const handleChange = useCallback(() => {
        if (!editable) return

        const blocks = editor.document
        onChange?.(blocks)

        if (postId) {
            onSaveStatusChange?.("saving")

            if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

            saveTimerRef.current = setTimeout(async () => {
                try {
                    const contentJson = JSON.stringify(blocks)

                    await savePostDraftContent(postId, contentJson)
                    if (isMountedRef.current) onSaveStatusChange?.("saved")
                    onAutosaveCommitted?.()
                } catch (err) {
                    console.error("Auto-save failed:", err)
                    if (isMountedRef.current) onSaveStatusChange?.("error")
                }
            }, 1000)
        }
    }, [editable, postId, editor, onChange, onSaveStatusChange, onAutosaveCommitted])

    return (
        <div className="blocknote-wrapper">
            <AppBlockNoteView
                editor={editor}
                editable={editable}
                onChange={handleChange}
                colorScheme={resolvedTheme === "dark" ? "dark" : "light"}
                sideMenu={editable}
            />
        </div>
    )
}

// ─── Exported utilities for version management ──────────────────────
export { textSimilarity, blocksToText, SIMILARITY_THRESHOLD }
