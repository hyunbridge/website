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
    // Call the delete API route
    const response = await fetch("/api/s3/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    // Fetch the token from localStorage
    const token = localStorage.getItem("supabase.auth.token")

    if (!token) {
      throw new Error("No token found in localStorage")
    }

    const response = await fetch("/api/s3/presigned-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JSON.parse(token).currentSession.access_token}`,
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
