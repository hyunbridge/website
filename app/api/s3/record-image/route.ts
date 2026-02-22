import { type NextRequest, NextResponse } from "next/server"
import { requireAuthenticatedSupabase } from "@/lib/api-auth"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedSupabase(request)
    if (auth.errorResponse) return auth.errorResponse

    const { postId, url, objectKey, contentType, sizeBytes, contentVersionId } = await request.json()

    const normalizedObjectKey = typeof objectKey === "string" ? objectKey.trim() : ""

    if (!postId || !url || !normalizedObjectKey) {
      return NextResponse.json(
        { error: "Missing required fields (postId, url, objectKey)" },
        { status: 400 },
      )
    }

    let resolvedVersionId: string | null = typeof contentVersionId === "string" ? contentVersionId : null

    const { data: item, error: itemError } = await auth.supabase
      .from("content_items")
      .select("id, owner_id, current_version_id")
      .eq("id", postId)
      .single()
    if (itemError || !item) {
      console.error("Error resolving post for asset:", itemError)
      return NextResponse.json({ error: "Post not found or inaccessible" }, { status: 404 })
    }

    if (item.owner_id && item.owner_id !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!resolvedVersionId) {
      resolvedVersionId = item.current_version_id || null
    }

    if (!resolvedVersionId) {
      return NextResponse.json({ error: "Post has no current version" }, { status: 400 })
    }

    const { data, error } = await auth.supabase
      .from("assets")
      .upsert(
        [
          {
            owner_id: auth.user.id,
            asset_type: "image",
            storage_provider: "s3",
            object_key: normalizedObjectKey,
            public_url: url,
            mime_type: typeof contentType === "string" ? contentType : null,
            size_bytes: typeof sizeBytes === "number" ? sizeBytes : null,
          },
        ],
        { onConflict: "object_key" },
      )
      .select("id, public_url, object_key, created_at")
      .single()

    if (error) {
      console.error("Error recording content asset:", error)
      return NextResponse.json({ error: `Failed to record image: ${error.message}` }, { status: 500 })
    }

    const { error: refError } = await auth.supabase
      .from("content_version_assets")
      .upsert(
        [{ content_version_id: resolvedVersionId, asset_id: data.id, usage_type: "embedded" }],
        { onConflict: "content_version_id,asset_id,usage_type" },
      )

    if (refError) {
      console.error("Error creating version asset ref:", refError)
      return NextResponse.json({ error: `Failed to link image to version: ${refError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      image: {
        id: data.id,
        post_id: postId,
        url: data.public_url,
        object_key: data.object_key,
        created_at: data.created_at,
        content_version_id: resolvedVersionId,
      },
    })
  } catch (error) {
    console.error("Error in record image API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    )
  }
}
