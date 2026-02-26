import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Supabase v2.97 enforces newer generated schema metadata (e.g. Relationships).
// Keep the runtime client untyped until local generated DB types are refreshed.
export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey)
