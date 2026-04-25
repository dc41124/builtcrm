import { db, type DB } from "@/db/client";
import { auditEvents } from "@/db/schema";

import type { EffectiveContext, OrgContext } from "./context";
import { getSystemUserId } from "./system-user";

// A drizzle transaction exposes the same query surface as the base db
// client, so accept either. Callers pass `tx` when writing inside a
// `db.transaction` block, and omit it for standalone writes.
type DbOrTx = DB | Parameters<Parameters<DB["transaction"]>[0]>[0];

export type WriteAuditEventInput = {
  action: string;
  resourceType: string;
  resourceId: string;
  details?: {
    previousState?: Record<string, unknown> | null;
    nextState?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  };
};

// Audit events are the compliance/security log: who did what, when, to
// which object. Always write one for any state-changing action. The
// actor, project, and organization are pulled from the effective
// context so callers cannot accidentally log the wrong user.
export async function writeAuditEvent(
  ctx: EffectiveContext,
  input: WriteAuditEventInput,
  tx: DbOrTx = db,
): Promise<void> {
  await tx.insert(auditEvents).values({
    actorUserId: ctx.user.id,
    projectId: ctx.project.id,
    organizationId: ctx.organization.id,
    objectType: input.resourceType,
    objectId: input.resourceId,
    actionName: input.action,
    previousState: input.details?.previousState ?? null,
    nextState: input.details?.nextState ?? null,
    metadataJson: input.details?.metadata ?? null,
  });
}

export type WriteOrgAuditEventInput = WriteAuditEventInput & {
  // Optional projectId — most org-scoped writes (template CRUD, enforcement
  // settings, sub-side prequal lifecycle) leave this null. Set explicitly
  // for events that DO have a project context (project exemptions).
  projectId?: string | null;
};

// Org-scoped audit write. Used by prequalification and other surfaces
// where the actor's authorization is org-level (no project). Mirrors
// `writeAuditEvent` but takes `OrgContext` and writes `project_id` only
// when the caller passes one. `audit_events.project_id` is nullable, so
// rows without a project sit cleanly.
export async function writeOrgAuditEvent(
  ctx: OrgContext,
  input: WriteOrgAuditEventInput,
  tx: DbOrTx = db,
): Promise<void> {
  await tx.insert(auditEvents).values({
    actorUserId: ctx.user.id,
    projectId: input.projectId ?? null,
    organizationId: ctx.organization.id,
    objectType: input.resourceType,
    objectId: input.resourceId,
    actionName: input.action,
    previousState: input.details?.previousState ?? null,
    nextState: input.details?.nextState ?? null,
    metadataJson: input.details?.metadata ?? null,
  });
}

export type WriteSystemAuditEventInput = {
  resourceType: string;
  resourceId: string;
  action: string;
  projectId?: string | null;
  organizationId?: string | null;
  details?: {
    previousState?: Record<string, unknown> | null;
    nextState?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  };
};

// System-level audit write for non-interactive events (unhandled
// exceptions, webhook processing, scheduled jobs). Uses SYSTEM_USER_ID
// as the actor — explicitly bypasses the ctx-based spoofing guard because
// there IS no user context at the call site. Keep usage narrow.
export async function writeSystemAuditEvent(
  input: WriteSystemAuditEventInput,
  tx: DbOrTx = db,
): Promise<void> {
  const actorUserId = await getSystemUserId();
  await tx.insert(auditEvents).values({
    actorUserId,
    projectId: input.projectId ?? null,
    organizationId: input.organizationId ?? null,
    objectType: input.resourceType,
    objectId: input.resourceId,
    actionName: input.action,
    previousState: input.details?.previousState ?? null,
    nextState: input.details?.nextState ?? null,
    metadataJson: input.details?.metadata ?? null,
  });
}
