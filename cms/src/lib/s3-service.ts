import { request } from "./api-client"

type PresignedPayload = {
  url: string
  fileUrl: string
  key: string
}

type AssetUploadTarget = {
  resourceType: "post" | "project" | "avatar"
  resourceID: string
}

async function prepareUpload(file: File, target: AssetUploadTarget): Promise<PresignedPayload> {
  return request<PresignedPayload>("/assets/presign", {
    method: "POST",
    auth: true,
    body: {
      resourceType: target.resourceType,
      resourceId: target.resourceID,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    },
  })
}

async function completeUpload(target: AssetUploadTarget, objectKey: string) {
  await request("/assets/complete", {
    method: "POST",
    auth: true,
    body: {
      resourceType: target.resourceType,
      resourceId: target.resourceID,
      objectKey,
    },
  })
}

export async function uploadToS3(file: File, target: AssetUploadTarget): Promise<string> {
  const payload = await prepareUpload(file, target)
  const uploadResponse = await fetch(payload.url, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  })

  if (!uploadResponse.ok) {
    throw new Error(`S3 upload failed: ${uploadResponse.status}`)
  }

  await completeUpload(target, payload.key)

  return payload.fileUrl
}

export async function deleteFromS3(keys: string[]) {
  if (keys.length === 0) return

  await request("/assets/delete", {
    method: "POST",
    auth: true,
    body: { keys },
  })
}
