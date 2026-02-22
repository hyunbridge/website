import { NextResponse } from "next/server"
import { getAuthenticatedSupabase } from "@/lib/supabase"

export async function requireAuthenticatedSupabase(request: Request) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      errorResponse: NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 }),
    }
  }

  const token = authHeader.slice("Bearer ".length)
  const supabase = getAuthenticatedSupabase(token)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  return { supabase, user, token }
}

