import { getProjects } from "@/lib/project-service"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const projects = await getProjects(true)
    return NextResponse.json(projects)
  } catch (error) {
    console.error("API route error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 },
    )
  }
}
