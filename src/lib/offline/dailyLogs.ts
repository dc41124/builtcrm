/**
 * Step 51 producer: `daily_log_create`.
 *
 * Drain flow per row:
 *   1. POST /api/daily-logs with { ...payload.body, clientUuid, clientSubmittedAt }
 *      - 200 { id, idempotent? } → success path
 *      - 409 { error: "log_exists", existingLogId } → conflict (status="conflict")
 *      - 401/403 → permanent (auth changed; user must re-resolve)
 *      - other 4xx → permanent (validation drift)
 *      - 5xx / network → transient (retry with backoff)
 *   2. For each photoClientId in payload, in order:
 *      a. POST /api/upload/request → uploadUrl + storageKey
 *      b. PUT blob to uploadUrl
 *      c. POST /api/upload/finalize → documentId
 *      d. POST /api/daily-log-photos with { dailyLogId, documentId, caption, sortOrder, isHero }
 *      Drop the photo from IndexedDB on success. Photo failures don't block
 *      the parent row from being marked drained — they go to a retry list
 *      handled separately. Step 51 v1: photo failures escalate to permanent
 *      after the same backoff schedule and stay attached to the row's
 *      lastError. Future Step 51.5 can split photos into their own outbox kind.
 *
 * The cast `OutboxRow & { payload: DailyLogCreatePayload }` is the registry
 * contract: queue.ts only invokes a producer's drain with a row whose `kind`
 * matches the producer's `kind`, so the payload type is guaranteed at the
 * call site.
 */

import {
  type DailyLogCreatePayload,
  type OutboxRow,
} from "./db";
import { dropPhoto, listPhotosForLog } from "./photos";
import {
  type DrainOutcome,
  type Producer,
  registerProducer,
} from "./queue";

type ApiError = {
  status: number;
  body: Record<string, unknown> | null;
};

async function postJson(
  path: string,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> | null }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  let data: Record<string, unknown> | null = null;
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    // empty / non-json body
  }
  return { status: res.status, body: data };
}

async function putBlob(url: string, blob: Blob): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob,
  });
  return { ok: res.ok, status: res.status };
}

function classifyApiError(err: ApiError): DrainOutcome {
  if (err.status >= 500) {
    return { type: "transient", reason: `server_${err.status}` };
  }
  if (err.status === 401 || err.status === 403) {
    return { type: "permanent", reason: "auth_changed" };
  }
  if (err.status === 409) {
    const reason = (err.body?.error as string) ?? "conflict";
    return { type: "conflict", reason, serverData: err.body ?? undefined };
  }
  return { type: "permanent", reason: `client_${err.status}` };
}

/** Upload one queued photo through the 4-step R2 flow. */
async function uploadPhoto(input: {
  projectId: string;
  dailyLogId: string;
  photoClientId: string;
  blob: Blob;
  mimeType: string;
  caption: string | null;
  sortOrder: number;
  isHero: boolean;
}): Promise<DrainOutcome> {
  // 1. presign
  const presign = await postJson("/api/upload/request", {
    projectId: input.projectId,
    filename: `daily-log-photo-${input.photoClientId}.jpg`,
    contentType: input.mimeType,
    documentType: "daily_log_photo",
  }).catch(
    (err): ApiError => ({ status: 0, body: { error: String(err) } }),
  );
  if (presign.status === 0) {
    return { type: "transient", reason: "network_presign" };
  }
  if (presign.status !== 200) {
    return classifyApiError(presign);
  }
  const presignBody = presign.body as { uploadUrl?: string; storageKey?: string } | null;
  if (!presignBody?.uploadUrl || !presignBody?.storageKey) {
    return { type: "permanent", reason: "presign_malformed" };
  }

  // 2. PUT to R2
  const put = await putBlob(presignBody.uploadUrl, input.blob).catch(
    () => ({ ok: false, status: 0 }),
  );
  if (!put.ok) {
    return put.status === 0
      ? { type: "transient", reason: "network_put" }
      : { type: "transient", reason: `r2_${put.status}` };
  }

  // 3. finalize
  const finalize = await postJson("/api/upload/finalize", {
    projectId: input.projectId,
    storageKey: presignBody.storageKey,
    title: `Daily log photo ${input.photoClientId}`,
    documentType: "daily_log_photo",
    visibilityScope: "internal_only",
    audienceScope: "internal",
  }).catch((err): ApiError => ({ status: 0, body: { error: String(err) } }));
  if (finalize.status === 0) return { type: "transient", reason: "network_finalize" };
  if (finalize.status !== 200) return classifyApiError(finalize);
  const documentId = (finalize.body as { documentId?: string } | null)?.documentId;
  if (!documentId) return { type: "permanent", reason: "finalize_malformed" };

  // 4. link to daily log
  const link = await postJson("/api/daily-log-photos", {
    dailyLogId: input.dailyLogId,
    documentId,
    caption: input.caption,
    sortOrder: input.sortOrder,
    isHero: input.isHero,
  }).catch((err): ApiError => ({ status: 0, body: { error: String(err) } }));
  if (link.status === 0) return { type: "transient", reason: "network_link" };
  if (link.status >= 200 && link.status < 300) {
    await dropPhoto(input.photoClientId);
    return { type: "ok", serverId: documentId };
  }
  return classifyApiError(link);
}

const dailyLogProducer: Producer<DailyLogCreatePayload> = {
  kind: "daily_log_create",

  describe(payload) {
    return {
      title: `Daily log — ${payload.logDate}`,
      subtitle: payload.intent === "submit" ? "Pending submit" : "Pending draft save",
    };
  },

  async drain(row: OutboxRow & { payload: DailyLogCreatePayload }) {
    const { payload } = row;

    const createRes = await postJson("/api/daily-logs", {
      ...payload.body,
      projectId: payload.projectId,
      logDate: payload.logDate,
      intent: payload.intent,
      clientUuid: row.clientId,
      clientSubmittedAt: payload.clientSubmittedAt,
    }).catch((err): ApiError => ({ status: 0, body: { error: String(err) } }));

    if (createRes.status === 0) {
      return { type: "transient", reason: "network_create" };
    }

    let serverLogId: string | null = null;
    if (createRes.status === 200 || createRes.status === 201) {
      serverLogId = (createRes.body as { id?: string } | null)?.id ?? null;
    } else {
      // Map error → outcome.
      const outcome = classifyApiError(createRes);
      // For 409s the server tells us the existing log id so the user can open it.
      if (outcome.type === "conflict") {
        return outcome;
      }
      return outcome;
    }

    if (!serverLogId) {
      return { type: "permanent", reason: "create_malformed" };
    }

    // Photos — best effort. Any single photo failure flips the whole row to
    // transient/permanent so the user is aware. Successful photo uploads are
    // dropped from IndexedDB inside uploadPhoto, so retries don't double-upload.
    const photos = await listPhotosForLog(row.clientId);
    for (const p of photos) {
      const outcome = await uploadPhoto({
        projectId: payload.projectId,
        dailyLogId: serverLogId,
        photoClientId: p.photoClientId,
        blob: p.blob,
        mimeType: p.mimeType,
        caption: p.caption,
        sortOrder: p.sortOrder,
        isHero: p.isHero,
      });
      if (outcome.type !== "ok") {
        // Surface the photo failure on the row. The daily log itself is
        // already on the server, but we keep the row in the outbox so the
        // user sees that not all photos synced. On retry, the create will
        // return 200 idempotent and we'll re-attempt remaining photos.
        return outcome;
      }
    }

    return { type: "ok", serverId: serverLogId };
  },
};

export function registerDailyLogProducer(): void {
  registerProducer(dailyLogProducer);
}
