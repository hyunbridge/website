import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

function getBucketName(): string {
  const bucket = process.env.S3_BUCKET || process.env.NEXT_PUBLIC_S3_BUCKET

  if (!bucket) {
    throw new Error("S3 bucket is not configured")
  }

  return bucket
}

function getS3Endpoint(): string {
  const endpoint = process.env.S3_ENDPOINT || process.env.NEXT_PUBLIC_S3_ENDPOINT

  if (!endpoint) {
    throw new Error("S3 endpoint is not configured")
  }

  return endpoint.replace(/\/$/, "")
}

function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || process.env.NEXT_PUBLIC_S3_REGION || "auto",
    endpoint: getS3Endpoint(),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY || "",
      secretAccessKey: process.env.S3_SECRET_KEY || "",
    },
  })
}

function isMissingObjectError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }

  const name = "name" in error ? error.name : null
  const metadata = "$metadata" in error ? error.$metadata : null
  const statusCode =
    metadata && typeof metadata === "object" && "httpStatusCode" in metadata
      ? metadata.httpStatusCode
      : null

  return name === "NotFound" || name === "NoSuchKey" || statusCode === 404
}

export function isObjectStorageConfigured(): boolean {
  return Boolean(
    (process.env.S3_BUCKET || process.env.NEXT_PUBLIC_S3_BUCKET) &&
      (process.env.S3_ENDPOINT || process.env.NEXT_PUBLIC_S3_ENDPOINT) &&
      process.env.S3_ACCESS_KEY &&
      process.env.S3_SECRET_KEY,
  )
}

export function getPublicObjectUrl(key: string): string {
  const cdnBase = process.env.S3_CDN_URL || process.env.NEXT_PUBLIC_S3_CDN_URL
  if (cdnBase) {
    return `${cdnBase.replace(/\/$/, "")}/${key}`
  }

  return `${getS3Endpoint()}/${getBucketName()}/${key}`
}

export async function objectExists(key: string): Promise<boolean> {
  const client = getS3Client()

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: getBucketName(),
        Key: key,
      }),
    )

    return true
  } catch (error) {
    if (isMissingObjectError(error)) {
      return false
    }

    throw error
  }
}

export async function uploadObject(params: {
  body: Buffer
  cacheControl?: string
  contentDisposition?: string
  contentType: string
  key: string
  metadata?: Record<string, string>
}): Promise<string> {
  const client = getS3Client()

  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
      CacheControl: params.cacheControl,
      ContentDisposition: params.contentDisposition,
      Metadata: params.metadata,
    }),
  )

  return getPublicObjectUrl(params.key)
}
