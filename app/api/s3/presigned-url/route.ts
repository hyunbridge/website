import { type NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerSupabase, getAuthenticatedSupabase } from "@/lib/supabase";

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

    const { key, contentType } = await request.json();

    if (!key || !contentType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Set up S3 client
    const s3Client = new S3Client({
      region: process.env.S3_REGION || process.env.NEXT_PUBLIC_S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || process.env.NEXT_PUBLIC_S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "",
        secretAccessKey: process.env.S3_SECRET_KEY || "",
      },
    });

    // Create PutObject command (keep blog images publicly accessible)
    const command = new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET || "",
      Key: key,
      ContentType: contentType,
      ACL: "public-read", // Blog images should be publicly viewable
    });

    // Generate Presigned URL
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // If CDN URL is configured, return the file URL as well
    const fileUrl = process.env.NEXT_PUBLIC_S3_CDN_URL
      ? `${process.env.NEXT_PUBLIC_S3_CDN_URL}/${key}`
      : `${process.env.S3_ENDPOINT || process.env.NEXT_PUBLIC_S3_ENDPOINT}/${process.env.S3_BUCKET || process.env.NEXT_PUBLIC_S3_BUCKET}/${key}`;

    return NextResponse.json({
      url,
      fileUrl,
      key,
    });
  } catch (error) {
    console.error("Error in presigned URL generation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
