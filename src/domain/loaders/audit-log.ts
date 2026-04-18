import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { auditEvents, users } from "@/db/schema";
import { AUDIT_CATEGORIES, type AuditCategory } from "@/lib/audit-categories";

export type { AuditCategory };
export { AUDIT_CATEGORIES };

export type AuditEventView = {
  id: string;
  createdAt: Date;
  actor: { id: string; name: string };
  objectType: string;
  objectId: string;
  actionName: string;
  eventCategory: AuditCategory;
  detail: string;
  previousState: unknown;
  nextState: unknown;
};

function categorizeEvent(objectType: string, actionName: string): AuditCategory {
  const ot = objectType.toLowerCase();
  const an = actionName.toLowerCase();
  if (/session|sign|auth|password|two.?factor/.test(ot + " " + an)) return "Authentication";
  if (/membership|invitation|team|user/.test(ot)) return "Team";
  if (/role|permission|policy/.test(ot + " " + an)) return "Permissions";
  if (/invoice|subscription|billing|payment_method/.test(ot)) return "Billing";
  if (/project|milestone|change_order|rfi|selection/.test(ot)) return "Projects";
  if (/compliance|lien_waiver|license|document/.test(ot)) return "Compliance";
  if (/integration|webhook|sync/.test(ot)) return "Integrations";
  return "Other";
}

// A short human description. Prefers metadata.summary/display, then nextState
// shape hints, falling back to the raw action_name. Keeps the UI column
// reasonable without the UI needing to care about row shape.
function deriveDetail(row: {
  actionName: string;
  previousState: unknown;
  nextState: unknown;
  metadataJson: unknown;
}): string {
  const meta = row.metadataJson as Record<string, unknown> | null;
  if (meta && typeof meta.summary === "string") return meta.summary;
  if (meta && typeof meta.display === "string") return meta.display;

  const next = row.nextState as Record<string, unknown> | null;
  if (next) {
    if (typeof next.invitedEmail === "string") return String(next.invitedEmail);
    if (typeof next.projectName === "string") return String(next.projectName);
    if (typeof next.name === "string") return String(next.name);
    if (typeof next.title === "string") return String(next.title);
  }

  const prev = row.previousState as Record<string, unknown> | null;
  if (prev && next) {
    const diff: string[] = [];
    for (const key of Object.keys(next)) {
      if (prev[key] !== next[key]) {
        diff.push(`${key}: ${String(prev[key] ?? "—")} → ${String(next[key] ?? "—")}`);
      }
    }
    if (diff.length) return diff.slice(0, 2).join(", ");
  }

  return row.actionName;
}

export async function listOrganizationAuditEvents(
  organizationId: string,
  opts: { limit?: number; unbounded?: boolean } = {},
): Promise<AuditEventView[]> {
  // UI reads cap at 500 for perf. Exports pass `unbounded: true` to pull up
  // to the full history; size is bounded by the audit log's natural growth.
  const limit = opts.unbounded
    ? (opts.limit ?? 100000)
    : Math.min(opts.limit ?? 200, 500);

  const rows = await db
    .select({
      id: auditEvents.id,
      createdAt: auditEvents.createdAt,
      actorId: auditEvents.actorUserId,
      actorName: users.displayName,
      actorEmail: users.email,
      objectType: auditEvents.objectType,
      objectId: auditEvents.objectId,
      actionName: auditEvents.actionName,
      previousState: auditEvents.previousState,
      nextState: auditEvents.nextState,
      metadataJson: auditEvents.metadataJson,
    })
    .from(auditEvents)
    .innerJoin(users, eq(users.id, auditEvents.actorUserId))
    .where(
      and(
        eq(auditEvents.organizationId, organizationId),
      ),
    )
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    actor: {
      id: r.actorId,
      name: r.actorName ?? r.actorEmail,
    },
    objectType: r.objectType,
    objectId: r.objectId,
    actionName: r.actionName,
    eventCategory: categorizeEvent(r.objectType, r.actionName),
    detail: deriveDetail({
      actionName: r.actionName,
      previousState: r.previousState,
      nextState: r.nextState,
      metadataJson: r.metadataJson,
    }),
    previousState: r.previousState,
    nextState: r.nextState,
  }));
}
