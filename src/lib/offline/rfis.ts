/**
 * Step 55 producer — `rfi_quick_create`.
 *
 * Drain flow per row:
 *   POST /api/rfis with the persisted body + clientUuid (the outbox row's
 *   clientId).
 *     200 { id, idempotent? } → success
 *     401/403                 → permanent (auth changed)
 *     other 4xx               → permanent (validation drift)
 *     5xx / network           → transient (retry with backoff)
 *
 * Photo attachments: Step 55 v1 expects photos to be uploaded to R2 BEFORE
 * the row is enqueued (the FAB does the upload while the user records
 * voice/types text). The persisted payload carries the resulting
 * `attachmentDocumentIds`. If the device goes offline before the
 * upload finishes, the FAB rejects the submit and the user gets a "save
 * locally" toast; a future Step 55.5 producer slice will mirror the
 * daily-log photo R2 chain so attachments queue alongside the parent.
 */

import { type OutboxRow, type RfiQuickCreatePayload } from "./db";
import {
  type DrainOutcome,
  type Producer,
  registerProducer,
} from "./queue";

type ApiError = { status: number; body: Record<string, unknown> | null };

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

const rfiQuickCreateProducer: Producer<RfiQuickCreatePayload> = {
  kind: "rfi_quick_create",

  describe(payload) {
    const subject = (payload.body as Record<string, unknown>)?.subject;
    return {
      title: typeof subject === "string" ? subject : "Quick RFI",
      subtitle: "Pending submit",
    };
  },

  async drain(row: OutboxRow & { payload: RfiQuickCreatePayload }) {
    const { payload } = row;

    const res = await postJson("/api/rfis", {
      ...payload.body,
      projectId: payload.projectId,
      clientUuid: row.clientId,
    }).catch(
      (err): ApiError => ({ status: 0, body: { error: String(err) } }),
    );

    if (res.status === 0) {
      return { type: "transient", reason: "network_create" };
    }

    if (res.status === 200 || res.status === 201) {
      const id = (res.body as { id?: string } | null)?.id;
      if (!id) return { type: "permanent", reason: "create_malformed" };
      const idempotent = (res.body as { idempotent?: boolean } | null)
        ?.idempotent;
      return idempotent
        ? { type: "idempotent", serverId: id }
        : { type: "ok", serverId: id };
    }

    return classifyApiError(res);
  },
};

export function registerRfiQuickCreateProducer(): void {
  registerProducer(rfiQuickCreateProducer);
}
