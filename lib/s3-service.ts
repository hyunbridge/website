import { supabase } from "@/lib/supabase"

export async function uploadToS3(file: File, postId?: string): Promise<string> {
  try {
    const fileName = postId ? `blog/${postId}/${Date.now()}-${file.name}` : `uploads/${Date.now()}-${file.name}`
    const contentType = file.type

    // Get presigned URL
    const { url, fileUrl } = await getPresignedUrl(fileName, contentType)

    // Upload to S3
    await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: file,
    })

    return fileUrl
  } catch (error) {
    console.error("Error uploading to S3:", error)
    throw error
  }
}

export async function deleteFromS3(keys: string[]): Promise<void> {
  try {
    // Fetch session & token from Supabase SDK for authentication
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    if (sessionError || !session?.access_token) {
      throw new Error("Unauthorized: no valid session for delete operation")
    }
    const token = session.access_token

    // Call the delete API route with Authorization header
    const response = await fetch("/api/s3/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ keys }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to delete objects from S3")
    }
  } catch (error) {
    console.error("Error deleting from S3:", error)
    throw error
  }
}

export async function getPresignedUrl(key: string, contentType: string): Promise<{ url: string; fileUrl: string }> {
  try {
    // Fetch session & token from Supabase SDK
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    if (sessionError || !session?.access_token) {
      throw new Error("Unauthorized: no valid session")
    }
    const token = session.access_token

    const response = await fetch("/api/s3/presigned-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ key, contentType }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || "Failed to get presigned URL")
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error getting presigned URL:", error)
    throw error
  }
}
