import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export async function POST(request: Request) {
    try {
        // Verify authentication
        const authHeader = request.headers.get("Authorization")
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }
        const token = authHeader.split(" ")[1]

        // Create authenticated Supabase client
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: { Authorization: `Bearer ${token}` },
            },
        })

        // Verify the user
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser(token)
        if (userError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        // Generate a unique slug
        const timestamp = Date.now().toString(36)
        const slug = `untitled-${timestamp}`

        // Create a blank post
        const { data, error } = await supabase
            .from("posts")
            .insert([
                {
                    title: "",
                    slug,
                    content: JSON.stringify([]),
                    summary: "",
                    author_id: user.id,
                    is_published: false,
                },
            ])
            .select("id, slug")
            .single()

        if (error) {
            console.error("Error creating post:", error)
            return NextResponse.json({ error: "Failed to create post" }, { status: 500 })
        }

        return NextResponse.json({ id: data.id, slug: data.slug })
    } catch (error) {
        console.error("Error in create post API:", error)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }
}
