/**
 * Local photo capture for offline daily logs.
 *
 * Camera input → File blob → IndexedDB photos store, with a 160×160 thumbnail
 * minted client-side so the in-app preview doesn't need the server. On drain,
 * the producer (dailyLogs.ts) reads the blob, requests an R2 presigned URL,
 * uploads, then POSTs /api/daily-log-photos to create the join row.
 *
 * Soft cap: 50 photos / 200 MB total. Above that, capture refuses with a
 * "storage almost full" surface. Hard cap is the browser quota — handled by
 * try/catch on the put().
 */

import { getDb, type PhotoRow } from "./db";

const SOFT_PHOTO_LIMIT = 50;
const SOFT_BYTES_LIMIT = 200 * 1024 * 1024;

export type CaptureResult =
  | { ok: true; photoClientId: string }
  | { ok: false; reason: "soft_quota" | "hard_quota" | "thumbnail_failed" };

/** Generate a 160×160 cover-fit thumbnail as a data URL. */
async function makeThumbnail(blob: Blob): Promise<string> {
  const bitmap = await createImageBitmap(blob).catch(() => null);
  if (!bitmap) throw new Error("decode_failed");

  const target = 160;
  const ratio = Math.max(target / bitmap.width, target / bitmap.height);
  const drawW = bitmap.width * ratio;
  const drawH = bitmap.height * ratio;

  // OffscreenCanvas where supported, fallback to a regular canvas.
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(target, target)
      : Object.assign(document.createElement("canvas"), {
          width: target,
          height: target,
        });

  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("no_2d_context");

  ctx.drawImage(
    bitmap,
    (target - drawW) / 2,
    (target - drawH) / 2,
    drawW,
    drawH,
  );

  if (canvas instanceof OffscreenCanvas) {
    const out = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.7 });
    return await blobToDataUrl(out);
  }
  return canvas.toDataURL("image/jpeg", 0.7);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Persist a captured photo to IndexedDB. */
export async function capturePhoto(input: {
  photoClientId: string;
  dailyLogClientId: string;
  blob: Blob;
  caption?: string | null;
  sortOrder?: number;
  isHero?: boolean;
}): Promise<CaptureResult> {
  const db = await getDb();
  const all = await db.getAll("photos");
  const totalBytes = all.reduce((acc, p) => acc + p.blob.size, 0);

  if (all.length >= SOFT_PHOTO_LIMIT || totalBytes + input.blob.size > SOFT_BYTES_LIMIT) {
    return { ok: false, reason: "soft_quota" };
  }

  let thumbDataUrl: string;
  try {
    thumbDataUrl = await makeThumbnail(input.blob);
  } catch {
    return { ok: false, reason: "thumbnail_failed" };
  }

  const row: PhotoRow = {
    photoClientId: input.photoClientId,
    dailyLogClientId: input.dailyLogClientId,
    blob: input.blob,
    mimeType: input.blob.type || "image/jpeg",
    caption: input.caption ?? null,
    sortOrder: input.sortOrder ?? 0,
    isHero: input.isHero ?? false,
    thumbDataUrl,
    capturedAt: Date.now(),
  };

  try {
    await db.put("photos", row);
    return { ok: true, photoClientId: row.photoClientId };
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      return { ok: false, reason: "hard_quota" };
    }
    throw err;
  }
}

/** Read all photos linked to a queued daily log. */
export async function listPhotosForLog(dailyLogClientId: string): Promise<PhotoRow[]> {
  const db = await getDb();
  return await db.getAllFromIndex(
    "photos",
    "by-daily-log-client-id",
    dailyLogClientId,
  );
}

/** Drop a photo (after successful upload, or on parent log discard). */
export async function dropPhoto(photoClientId: string): Promise<void> {
  const db = await getDb();
  await db.delete("photos", photoClientId);
}

/** Drop every photo linked to a daily log (cascade on discard). */
export async function dropPhotosForLog(dailyLogClientId: string): Promise<void> {
  const db = await getDb();
  const photos = await db.getAllFromIndex(
    "photos",
    "by-daily-log-client-id",
    dailyLogClientId,
  );
  for (const p of photos) {
    await db.delete("photos", p.photoClientId);
  }
}

/** Soft-quota status for the storage indicator. */
export async function getStorageStatus(): Promise<{
  photoCount: number;
  bytesUsed: number;
  photoLimit: number;
  bytesLimit: number;
}> {
  const db = await getDb();
  const all = await db.getAll("photos");
  return {
    photoCount: all.length,
    bytesUsed: all.reduce((acc, p) => acc + p.blob.size, 0),
    photoLimit: SOFT_PHOTO_LIMIT,
    bytesLimit: SOFT_BYTES_LIMIT,
  };
}
