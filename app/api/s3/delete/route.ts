import { type NextRequest, NextResponse } from "next/server"
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3"
import { getAuthenticatedSupabase } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = getAuthenticatedSupabase(token);
    
    // Verify session using token
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("Authentication error:", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    // Check if the error is an authentication error from getUser()
    if (error instanceof Error && error.message.includes("Unauthorized")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to delete objects from S3" }, { status: 500 })
  }
}
