import { getProjectBySlug } from "@/lib/notion"
import { NextResponse } from "next/server"

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const project = await getProjectBySlug(params.slug)
    return NextResponse.json(project)
  } catch (error) {
    console.error("API route error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 },
    )
  }
}
