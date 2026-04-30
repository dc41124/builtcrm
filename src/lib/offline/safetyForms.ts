/**
 * Step 52 producer — `safety_form_create`.
 *
 * Drain flow per row:
 *   POST /api/safety-forms with the persisted body + clientUuid (the
 *   outbox row's clientId) + clientSubmittedAt for the hybrid clock.
 *     200 { id, idempotent? }     → success
 *     409 { error: "log_exists" } → conflict (no longer applicable for
 *                                    safety forms — they don't dedupe by
 *                                    project+date — but we still classify)
 *     401/403                     → permanent (auth changed)
 *     other 4xx                   → permanent (validation drift)
 *     5xx / network               → transient (retry with backoff)
 *
 * Photos: Step 52 v1 stores photo IDs as client-minted strings inline in
 * data_json. The producer doesn't walk an R2 chain because v1 photos are
 * placeholders (the field-renderer's photo button just emits IMG_####
 * tokens for now). When real camera capture lands in a follow-up, the
 * producer will gain a 4-step R2 chain mirroring dailyLogs.ts.
 */

import {
  type OutboxRow,
  type SafetyFormCreatePayload,
} from "./db";
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

const safetyFormProducer: Producer<SafetyFormCreatePayload> = {
  kind: "safety_form_create",

  describe(payload) {
    const title = (payload.body as Record<string, unknown>)?.title;
    return {
      title: typeof title === "string" ? title : "Safety form",
      subtitle: "Pending submit",
    };
  },

  async drain(row: OutboxRow & { payload: SafetyFormCreatePayload }) {
    const { payload } = row;

    const res = await postJson("/api/safety-forms", {
      ...payload.body,
      projectId: payload.projectId,
      templateId: payload.templateId,
      clientUuid: row.clientId,
      clientSubmittedAt: payload.clientSubmittedAt,
    }).catch(
      (err): ApiError => ({ status: 0, body: { error: String(err) } }),
    );

    if (res.status === 0) {
      return { type: "transient", reason: "network_create" };
    }

    if (res.status === 200 || res.status === 201) {
      const id = (res.body as { id?: string } | null)?.id;
      if (!id) return { type: "permanent", reason: "create_malformed" };
      return { type: "ok", serverId: id };
    }

    return classifyApiError(res);
  },
};

export function registerSafetyFormProducer(): void {
  registerProducer(safetyFormProducer);
}
