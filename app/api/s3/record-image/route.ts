import { type NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabase } from "@/lib/supabase";

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

    const { postId, url } = await request.json();

    if (!postId || !url) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Insert record into post_images table
    const { data, error } = await supabase
      .from("post_images")
      .insert([{ post_id: postId, url }])
      .select();

    if (error) {
      console.error("Error recording post image:", error);
      return NextResponse.json(
        { error: `Failed to record image: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, image: data[0] });
  } catch (error) {
    console.error("Error in record image API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
