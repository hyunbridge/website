import { supabase } from "@/lib/supabase"

export async function uploadToS3(file: File, postId: string): Promise<string> {
  let imageId: string | null = null

  try {
    // Step 1: Insert a record into post_images to get the imageID (PK)
    // Use the authenticated user's session for the insert operation implicitly via RLS
    const { data: imageData, error: insertError } = await supabase
      .from("post_images")
      .insert({ post_id: postId, url: "" })
      .select("id")
      .single()

    if (insertError || !imageData) {
      console.error("Error inserting into post_images:", insertError)
      throw new Error("Failed to create image record in database")
    }
    imageId = imageData.id

    // Extract file extension from original filename
    const fileExtension = file.name.split('.').pop() || '';

    // Step 2: Construct the S3 key using postId, imageId and the original file extension
    const fileName = `blog/${postId}/${imageId}${fileExtension ? `.${fileExtension}` : ''}`;
    const contentType = file.type

    // Step 3: Get presigned URL for the specific S3 key
    const { url, fileUrl } = await getPresignedUrl(fileName, contentType)

    // Step 4: Upload the file to S3
    const uploadResponse = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: file,
    })

    if (!uploadResponse.ok) {
      throw new Error(`S3 upload failed: ${uploadResponse.statusText}`)
    }

    // Step 5: Update the post_images record with the final S3 URL
    const { error: updateError } = await supabase
      .from("post_images")
      .update({ url: fileUrl })
      .eq("id", imageId)

    if (updateError) {
      console.error("Error updating post_images URL:", updateError)
      // Consider deleting the S3 object here if the DB update fails
      throw new Error("Failed to update image URL in database after S3 upload")
    }

    return fileUrl
  } catch (error) {
    console.error("Error uploading to S3:", error)
    // Optional: Add cleanup logic here, e.g., delete the post_images record if it was created
    if (imageId) {
      try {
        await supabase.from("post_images").delete().eq("id", imageId)
        console.log(`Cleaned up post_images record: ${imageId}`)
      } catch (cleanupError) {
        console.error("Error cleaning up post_images record:", cleanupError)
      }
    }
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
