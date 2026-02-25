import { supabase } from "@/lib/supabase-client"

type PresignedPayload = { url: string; fileUrl: string }

async function recordUploadedImageAsset(params: {
  postId: string
  fileUrl: string
  objectKey: string
  contentType?: string
  sizeBytes?: number
}) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError || !session?.access_token) {
    throw new Error("Unauthorized: no valid session for asset recording")
  }

  const response = await fetch("/api/s3/record-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      postId: params.postId,
      url: params.fileUrl,
      objectKey: params.objectKey,
      contentType: params.contentType || null,
      sizeBytes: params.sizeBytes ?? null,
    }),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.error || "Failed to record uploaded asset")
  }
}

export async function uploadToS3(
  arg1: File | PresignedPayload,
  arg2: string | File,
  arg3?: string,
): Promise<string> {
  try {
    let payload: PresignedPayload
    let file: File
    let contentType: string
    let blogObjectKey: string | null = null
    let blogPostId: string | null = null

    if (arg1 instanceof File && typeof arg2 === "string") {
      // Blog editor signature: (file, postId)
      file = arg1
      const resourceId = arg2
      const imageId = crypto.randomUUID()
      const fileExtension = file.name.split(".").pop() || ""
      const fileName = `assets/${resourceId}/${imageId}${fileExtension ? `.${fileExtension}` : ""}`
      blogObjectKey = fileName
      blogPostId = resourceId
      contentType = file.type
      payload = await getPresignedUrl(fileName, contentType)
    } else {
      // Generic signature used by profile page: (presignedPayload, file, contentType?)
      payload = arg1 as PresignedPayload
      file = arg2 as File
      contentType = arg3 || file.type
    }

    const uploadResponse = await fetch(payload.url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: file,
    })

    if (!uploadResponse.ok) {
      throw new Error(`S3 upload failed: ${uploadResponse.statusText}`)
    }

    if (blogPostId && blogObjectKey) {
      await recordUploadedImageAsset({
        postId: blogPostId,
        fileUrl: payload.fileUrl,
        objectKey: blogObjectKey,
        contentType,
        sizeBytes: file.size,
      })
    }

    return payload.fileUrl
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
