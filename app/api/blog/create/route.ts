import { NextResponse } from "next/server"
import { requireAuthenticatedSupabase } from "@/lib/api-auth"
import { createDraftPostWithClient } from "@/lib/blog-service"

export async function POST(request: Request) {
    try {
        const auth = await requireAuthenticatedSupabase(request)
        if (auth.errorResponse) return auth.errorResponse

        const post = await createDraftPostWithClient(auth.supabase as any, auth.user.id)
        return NextResponse.json(post)
    } catch (error) {
        console.error("Error in create post API:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
