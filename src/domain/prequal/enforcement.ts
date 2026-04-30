import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import {
  organizations,
  prequalProjectExemptions,
  projects,
} from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext, type SessionLike } from "@/domain/context";
import { getOrgPlanContext } from "@/domain/loaders/billing";
import {
  type PrequalBadgeStatus,
  type PrequalEnforcementMode,
  getActivePrequalForPair,
} from "@/domain/loaders/prequal";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { requireFeature } from "@/domain/policies/plan";

// -----------------------------------------------------------------------------
// Enforcement-mode CRUD + project exemptions + the assignment-time check.
// -----------------------------------------------------------------------------

async function ensureContractorFeature(
  orgId: string,
  orgType: string,
): Promise<void> {
  if (orgType !== "contractor") {
    throw new AuthorizationError("Contractor-only action", "forbidden");
  }
  const planCtx = await getOrgPlanContext(orgId);
  requireFeature(planCtx, "prequalification");
}

// Org enforcement mode -----------------------------------------------------

export async function setPrequalEnforcementMode(input: {
  session: SessionLike | null | undefined;
  mode: PrequalEnforcementMode;
}): Promise<void> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_enforcement_settings", "write");
  await ensureContractorFeature(ctx.organization.id, ctx.organization.type);

  const [org] = await db
    .select({ mode: organizations.prequalEnforcementMode })
    .from(organizations)
    .where(eq(organizations.id, ctx.organization.id))
    .limit(1);
  const previous = org?.mode ?? "off";
  if (previous === input.mode) return;

  await dbAdmin.transaction(async (tx) => {
    await tx
      .update(organizations)
      .set({ prequalEnforcementMode: input.mode, updatedAt: new Date() })
      .where(eq(organizations.id, ctx.organization.id));

    await writeOrgAuditEvent(
      ctx,
      {
        action: "enforcement_mode_changed",
        resourceType: "organization",
        resourceId: ctx.organization.id,
        details: {
          previousState: { mode: previous },
          nextState: { mode: input.mode },
        },
      },
      tx,
    );
  });
}

async function getEnforcementMode(
  orgId: string,
): Promise<PrequalEnforcementMode> {
  const [org] = await db
    .select({ mode: organizations.prequalEnforcementMode })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return (org?.mode ?? "off") as PrequalEnforcementMode;
}

// Project exemptions ------------------------------------------------------

export async function grantProjectExemption(input: {
  session: SessionLike | null | undefined;
  projectId: string;
  subOrgId: string;
  reason: string;
  expiresAt?: Date | null;
}): Promise<{ id: string }> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_enforcement_settings", "write");
  await ensureContractorFeature(ctx.organization.id, ctx.organization.type);

  if (!input.reason.trim()) {
    throw new AuthorizationError(
      "Exemption requires a reason for the audit log",
      "forbidden",
    );
  }

  // Verify the project belongs to this contractor org.
  const [project] = await db
    .select({
      id: projects.id,
      contractorOrgId: projects.contractorOrganizationId,
    })
    .from(projects)
    .where(eq(projects.id, input.projectId))
    .limit(1);
  if (!project) {
    throw new AuthorizationError("Project not found", "not_found");
  }
  if (project.contractorOrgId !== ctx.organization.id) {
    throw new AuthorizationError("Project not yours", "forbidden");
  }

  // Confirm the sub org exists.
  const [sub] = await db
    .select({
      id: organizations.id,
      type: organizations.organizationType,
    })
    .from(organizations)
    .where(eq(organizations.id, input.subOrgId))
    .limit(1);
  if (!sub || sub.type !== "subcontractor") {
    throw new AuthorizationError(
      "Subcontractor org not found",
      "not_found",
    );
  }

  // Reject if there's already an active exemption (partial unique index
  // would catch this; surface a clean error first). Caller is contractor
  // (verified above against project ownership) — withTenant on their org.
  const [existing] = await withTenant(ctx.organization.id, (tx) =>
    tx
      .select({ id: prequalProjectExemptions.id })
      .from(prequalProjectExemptions)
      .where(
        and(
          eq(prequalProjectExemptions.projectId, input.projectId),
          eq(prequalProjectExemptions.subOrgId, input.subOrgId),
          isNull(prequalProjectExemptions.revokedAt),
        ),
      )
      .limit(1),
  );
  if (existing) {
    return { id: existing.id };
  }

  const result = await withTenant(ctx.organization.id, async (tx) => {
    const [row] = await tx
      .insert(prequalProjectExemptions)
      .values({
        projectId: input.projectId,
        subOrgId: input.subOrgId,
        contractorOrgId: ctx.organization.id,
        grantedByUserId: ctx.user.id,
        reason: input.reason,
        expiresAt: input.expiresAt ?? null,
      })
      .returning({ id: prequalProjectExemptions.id });

    await writeOrgAuditEvent(
      ctx,
      {
        action: "exemption_granted",
        resourceType: "prequal_project_exemption",
        resourceId: row.id,
        projectId: input.projectId,
        details: {
          metadata: {
            subOrgId: input.subOrgId,
            reason: input.reason,
            expiresAt: input.expiresAt
              ? input.expiresAt.toISOString()
              : null,
          },
        },
      },
      tx,
    );
    return row;
  });

  return { id: result.id };
}

export async function revokeProjectExemption(input: {
  session: SessionLike | null | undefined;
  exemptionId: string;
}): Promise<void> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_enforcement_settings", "write");
  await ensureContractorFeature(ctx.organization.id, ctx.organization.type);

  // Caller is contractor — multi-org policy clause A (project owned by
  // their org) lets them see exemptions on their own projects.
  const [row] = await withTenant(ctx.organization.id, (tx) =>
    tx
      .select()
      .from(prequalProjectExemptions)
      .where(eq(prequalProjectExemptions.id, input.exemptionId))
      .limit(1),
  );
  if (!row) {
    throw new AuthorizationError("Exemption not found", "not_found");
  }
  if (row.contractorOrgId !== ctx.organization.id) {
    throw new AuthorizationError("Exemption not yours", "forbidden");
  }
  if (row.revokedAt) return;

  await withTenant(ctx.organization.id, async (tx) => {
    await tx
      .update(prequalProjectExemptions)
      .set({
        revokedAt: new Date(),
        revokedByUserId: ctx.user.id,
      })
      .where(eq(prequalProjectExemptions.id, input.exemptionId));

    await writeOrgAuditEvent(
      ctx,
      {
        action: "exemption_revoked",
        resourceType: "prequal_project_exemption",
        resourceId: input.exemptionId,
        projectId: row.projectId,
      },
      tx,
    );
  });
}

async function hasActiveProjectExemption(
  projectId: string,
  subOrgId: string,
  contractorOrgId: string,
): Promise<boolean> {
  const [row] = await withTenant(contractorOrgId, (tx) =>
    tx
      .select({ id: prequalProjectExemptions.id })
      .from(prequalProjectExemptions)
      .where(
        and(
          eq(prequalProjectExemptions.projectId, projectId),
          eq(prequalProjectExemptions.subOrgId, subOrgId),
          isNull(prequalProjectExemptions.revokedAt),
        ),
      )
      .orderBy(desc(prequalProjectExemptions.grantedAt))
      .limit(1),
  );
  return !!row;
}

// Assignment-time check ---------------------------------------------------

function friendlyReason(activeStatus: PrequalBadgeStatus): string {
  switch (activeStatus) {
    case "approved":
      return "Approved.";
    case "pending":
      return "Sub has a prequalification pending review.";
    case "rejected":
      return "Sub's most recent prequalification was rejected.";
    case "expired":
      return "Sub's prequalification has expired and needs renewal.";
    case "none":
      return "Sub has not completed a prequalification yet.";
  }
}

export type CheckAssignmentResult =
  | { kind: "ok" }
  | {
      kind: "warn";
      reason: string;
      activeStatus: PrequalBadgeStatus;
      submissionId?: string;
    }
  | {
      kind: "block";
      reason: string;
      activeStatus: PrequalBadgeStatus;
      submissionId?: string;
    };

export async function checkPrequalForAssignment(
  contractorOrgId: string,
  subOrgId: string,
  projectId: string,
): Promise<CheckAssignmentResult> {
  const mode = await getEnforcementMode(contractorOrgId);
  if (mode === "off") return { kind: "ok" };

  const active = await getActivePrequalForPair(contractorOrgId, subOrgId);
  if (active.status === "approved") return { kind: "ok" };

  if (mode === "block") {
    const exempted = await hasActiveProjectExemption(
      projectId,
      subOrgId,
      contractorOrgId,
    );
    if (exempted) return { kind: "ok" };
  }

  if (mode === "warn") {
    return {
      kind: "warn",
      reason: friendlyReason(active.status),
      activeStatus: active.status,
      submissionId: active.submissionId,
    };
  }

  return {
    kind: "block",
    reason: friendlyReason(active.status),
    activeStatus: active.status,
    submissionId: active.submissionId,
  };
}

// Called by the invitation flow when a contractor user clicks "Proceed
// anyway" in warn mode. Writes the override audit event so the policy
// trail is intact.
export async function recordPrequalOverride(input: {
  session: SessionLike | null | undefined;
  subOrgId: string;
  projectId: string;
  reason?: string;
}): Promise<void> {
  const ctx = await getOrgContext(input.session);
  assertCan(ctx.permissions, "prequal_enforcement_settings", "write");

  await writeOrgAuditEvent(ctx, {
    action: "assignment_override",
    resourceType: "prequal_assignment_override",
    resourceId: `${input.projectId}:${input.subOrgId}`,
    projectId: input.projectId,
    details: {
      metadata: {
        subOrgId: input.subOrgId,
        reason: input.reason ?? null,
      },
    },
  });
}
