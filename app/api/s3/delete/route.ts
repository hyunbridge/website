import { type NextRequest, NextResponse } from "next/server"
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3"
import { requireAuthenticatedSupabase } from "@/lib/api-auth"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedSupabase(request)
    if (auth.errorResponse) return auth.errorResponse

    // Proceed with deletion logic only if authenticated
    const { keys } = await request.json()

    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return NextResponse.json({ error: "Missing or invalid keys" }, { status: 400 })
    }

    const s3Client = new S3Client({
      region: process.env.S3_REGION || process.env.NEXT_PUBLIC_S3_REGION,
      endpoint: process.env.S3_ENDPOINT || process.env.NEXT_PUBLIC_S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || "",
      },
    })

    const command = new DeleteObjectsCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
      },
    })

    await s3Client.send(command)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting objects from S3:", error)
    return NextResponse.json({ error: "Failed to delete objects from S3" }, { status: 500 })
  }
}
