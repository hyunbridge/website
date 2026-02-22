"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// BlockNote requires browser APIs — must be loaded client-side only
const BlockNoteInner = dynamic(() => import("./blocknote-inner"), {
    ssr: false,
    loading: () => (
        <div className="space-y-4 py-8">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
        </div>
    ),
})

export type BlockNoteEditorProps = {
    initialContent?: any // BlockNote Block[] JSON
    editable?: boolean
    projectId?: string
    onChange?: (blocks: any) => void
    onSaveStatusChange?: (status: "idle" | "saving" | "saved" | "error") => void
    onAutosaveCommitted?: () => void
}

export function BlockNoteEditor(props: BlockNoteEditorProps) {
    return <BlockNoteInner {...props} />
}
