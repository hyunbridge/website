import { type NextRequest, NextResponse } from "next/server"
import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3"
import { getServiceRoleSupabase } from "@/lib/supabase-server"

function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION || process.env.NEXT_PUBLIC_S3_REGION,
    endpoint: process.env.S3_ENDPOINT || process.env.NEXT_PUBLIC_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.ASSET_GC_SECRET
    const provided = request.headers.get("x-gc-secret")
    if (!secret || provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const batchSize = Math.min(Math.max(Number(body?.batchSize) || 25, 1), 100)
    const now = new Date().toISOString()

    const supabase = getServiceRoleSupabase()
    const s3 = getS3Client()

    const { data: jobs, error: fetchError } = await supabase
      .from("asset_deletion_queue")
      .select("id, asset_id, object_key, status, attempt_count")
      .in("status", ["pending", "failed"])
      .lte("next_attempt_at", now)
      .order("next_attempt_at", { ascending: true })
      .limit(batchSize)

    if (fetchError) {
      console.error("Failed to fetch asset deletion jobs:", fetchError)
      return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 })
    }

    let processed = 0
    let deleted = 0
    let skippedReferenced = 0
    let failed = 0

    for (const job of jobs || []) {
      processed += 1
      const { data: claim, error: claimError } = await supabase
        .from("asset_deletion_queue")
        .update({
          status: "processing",
          locked_at: now,
          updated_at: now,
        })
        .eq("id", job.id)
        .in("status", ["pending", "failed"])
        .select("id, asset_id, object_key, attempt_count")
        .single()

      if (claimError || !claim) {
        continue
      }

      const { count: refCount, error: refCountError } = await supabase
        .from("content_version_assets")
        .select("asset_id", { count: "exact", head: true })
        .eq("asset_id", claim.asset_id)

      if (refCountError) {
        failed += 1
        await supabase
          .from("asset_deletion_queue")
          .update({
            status: "failed",
            attempt_count: (claim.attempt_count || 0) + 1,
            last_error: refCountError.message,
            next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
            locked_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", claim.id)
        continue
      }

      if ((refCount || 0) > 0) {
        skippedReferenced += 1
        await supabase.from("asset_deletion_queue").delete().eq("id", claim.id)
        continue
      }

      try {
        const command = new DeleteObjectsCommand({
          Bucket: process.env.NEXT_PUBLIC_S3_BUCKET || process.env.S3_BUCKET,
          Delete: {
            Objects: [{ Key: claim.object_key }],
          },
        })
        await s3.send(command)

        const { error: assetDeleteError } = await supabase.from("assets").delete().eq("id", claim.asset_id)
        if (assetDeleteError) {
          throw assetDeleteError
        }

        // If the asset row is already gone or was deleted, ensure queue row is removed.
        await supabase.from("asset_deletion_queue").delete().eq("id", claim.id)
        deleted += 1
      } catch (error) {
        failed += 1
        const message = error instanceof Error ? error.message : String(error)
        const attemptCount = (claim.attempt_count || 0) + 1
        const delayMs = Math.min(60_000 * 2 ** Math.min(attemptCount, 5), 3_600_000)

        await supabase
          .from("asset_deletion_queue")
          .update({
            status: "failed",
            attempt_count: attemptCount,
            last_error: message,
            next_attempt_at: new Date(Date.now() + delayMs).toISOString(),
            locked_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", claim.id)
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      deleted,
      skippedReferenced,
      failed,
      batchSize,
    })
  } catch (error) {
    console.error("Asset GC failed:", error)
    return NextResponse.json({ error: "Asset GC failed" }, { status: 500 })
  }
}
