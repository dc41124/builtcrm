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

// Server-side fetch — used by background jobs that need the bytes
// (e.g. Whisper transcription pulling the audio uploaded by the
// browser via a presigned PUT). Throws on missing key or transport
// failure. Caller is responsible for memory ceiling — don't use this
// for large arbitrary files.
export async function getObjectBytes(key: string): Promise<Buffer> {
  const res = await r2.send(
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }),
  );
  if (!res.Body) {
    throw new Error(`R2 object missing body: ${key}`);
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Best-effort delete — used to clean up transient assets (audio after
// transcription, R2 orphans). Swallows NoSuchKey so re-runs are
// idempotent; rethrows other errors so caller can decide.
export async function deleteObject(key: string): Promise<void> {
  try {
    await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  } catch (err) {
    const code = (err as { Code?: string; name?: string }).Code
      ?? (err as { name?: string }).name;
    if (code === "NoSuchKey" || code === "NotFound") return;
    throw err;
  }
}
