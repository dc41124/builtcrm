import { S3Client } from "@aws-sdk/client-s3";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "./env";

const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

export const r2 = new S3Client({
  region: "auto",
  endpoint,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export const R2_BUCKET = env.R2_BUCKET_NAME;

// Storage layout: {orgId}/{projectId}/{documentType}/{filename}. Callers
// are trusted to pass an already-sanitized filename — this helper only
// strips path separators so a malicious name can't escape its folder.
export function buildStorageKey(input: {
  orgId: string;
  projectId: string;
  documentType: string;
  filename: string;
}): string {
  const safeName = input.filename.replace(/[\\/]/g, "_").trim();
  const safeType = input.documentType.replace(/[\\/]/g, "_").trim();
  return `${input.orgId}/${input.projectId}/${safeType}/${Date.now()}_${safeName}`;
}

export async function presignUploadUrl(params: {
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: params.key,
    ContentType: params.contentType,
  });
  return getSignedUrl(r2, cmd, {
    expiresIn: params.expiresInSeconds ?? 60 * 5,
  });
}

export async function presignDownloadUrl(params: {
  key: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: params.key,
  });
  return getSignedUrl(r2, cmd, {
    expiresIn: params.expiresInSeconds ?? 60,
  });
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export async function getObjectSize(key: string): Promise<number | null> {
  try {
    const res = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return res.ContentLength ?? null;
  } catch {
    return null;
  }
}

// Best-effort R2 delete for orphan cleanup paths (e.g. a superseded
// upload that lost the DB race). Swallows errors — orphan objects
// are recoverable by storage-side lifecycle rules; failing loud here
// would just mask the underlying DB error the caller is trying to
// surface.
export async function deleteObject(key: string): Promise<void> {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch {
    // intentional no-op
  }
}

// Server-side put. Used by background jobs that generate content
// directly (e.g. GDPR exports) rather than handing a presigned URL
// to a browser. Throws on failure — callers want to know.
export async function putObject(params: {
  key: string;
  body: Buffer | string;
  contentType: string;
}): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );
}
