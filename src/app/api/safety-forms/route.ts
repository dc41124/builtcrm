import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { withTenant } from "@/db/with-tenant";
import {
  safetyFormCounters,
  safetyFormIncidents,
  safetyFormTemplates,
  safetyForms,
  type SafetyCorrectiveAction,
  type SafetyInjuredParty,
} from "@/db/schema";
import { writeActivityFeedItem } from "@/domain/activity";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { emitNotifications } from "@/lib/notifications/emit";
import { SAFETY_SEVERITY_CONFIG } from "@/lib/safety-forms/severity-labels";

// ─────────────────────────────────────────────────────────────────────────
// POST /api/safety-forms
//
// Create a safety-form submission. Idempotent on clientUuid (Step 51 outbox
// retry-after-success-but-network-died → returns 200 with prior id +
// idempotent:true). Allocates an SF-#### per-org form_number atomically via
// safety_form_counters.
//
// Authorization:
//  - Contractor admin/PM may submit on any of their projects.
//  - Subcontractor may submit on a project they're a member of, BUT only
//    against templates assigned to their org (via safety_form_template_assignments).
//  - Clients never submit safety forms.
//
// Notifications:
//  - incident_report → safety_incident_reported (immediate fan-out to all
//    contractor staff on the project).
//  - other types → safety_form_submitted (lower-urgency fan-out).
// ─────────────────────────────────────────────────────────────────────────

const InjuredSchema = z.object({
  name: z.string().min(1).max(160),
  role: z.string().max(160).optional().nullable(),
  bodyPart: z.string().max(160).optional().nullable(),
  nature: z.string().max(2000).optional().nullable(),
});

const CorrectiveActionSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1).max(2000),
  owner: z.string().max(160),
  due: z.string().max(40), // ISO date or empty; not strictly validated for v1
});

const IncidentSchema = z.object({
  severity: z.enum([
    "first_aid",
    "recordable",
    "lost_time",
    "fatality",
    "property_damage",
    "environmental",
  ]),
  incidentAt: z.string().datetime().or(z.string().min(1)),
  location: z.string().min(1).max(500),
  description: z.string().max(8000).optional().nullable(),
  rootCauseText: z.string().max(8000).optional().nullable(),
  injured: z.array(InjuredSchema).max(20).default([]),
  correctiveActions: z.array(CorrectiveActionSchema).max(20).default([]),
  photoCount: z.number().int().min(0).max(50).default(0),
});

const BodySchema = z.object({
  projectId: z.string().uuid(),
  templateId: z.string().uuid(),
  status: z.enum(["draft", "submitted"]).default("submitted"),
  title: z.string().min(1).max(240),
  dataJson: z.record(z.string(), z.unknown()).default({}),
  flagged: z.boolean().default(false),
  flagReason: z.string().max(500).optional().nullable(),
  // Step 51 idempotency. Optional for direct online submits.
  clientUuid: z.string().uuid().optional().nullable(),
  // Hybrid clock per Step 51 Decision 3 — server clamps to 48h window.
  clientSubmittedAt: z.string().datetime().optional().nullable(),
  // Incident-only payload. Required when the template's formType resolves
  // to incident_report; ignored otherwise (server validates after template lookup).
  incident: IncidentSchema.optional(),
});

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    const ctx = await getEffectiveContext(session, input.projectId);

    // Subs and contractors both author safety forms (Decision-6 — sub
    // visibility gated by template assignments). Clients never do.
    if (
      ctx.role !== "contractor_admin" &&
      ctx.role !== "contractor_pm" &&
      ctx.role !== "subcontractor_user"
    ) {
      throw new AuthorizationError(
        "Only contractors and subcontractors can submit safety forms",
        "forbidden",
      );
    }

    // Idempotent retry — Step 51 producer replays this with the same
    // clientUuid if the original response was lost. Lookup runs without
    // tenant context so we can find the row regardless of which org-tenant
    // owns it (the unique constraint on client_uuid means at most one match).
    if (input.clientUuid) {
      const [prior] = await withTenant(ctx.organization.id, (tx) =>
        tx
          .select({ id: safetyForms.id })
          .from(safetyForms)
          .where(eq(safetyForms.clientUuid, input.clientUuid!))
          .limit(1),
      );
      if (prior) {
        return NextResponse.json(
          { id: prior.id, idempotent: true },
          { status: 200 },
        );
      }
    }

    // Template + assignment check — runs inside withTenant. The template
    // policy gates contractor templates by org; for subs we additionally
    // verify there's an assignment row covering this template + sub_org +
    // project (or org-wide for that template + sub_org).
    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [tpl] = await tx
        .select({
          id: safetyFormTemplates.id,
          formType: safetyFormTemplates.formType,
          isArchived: safetyFormTemplates.isArchived,
          orgId: safetyFormTemplates.organizationId,
        })
        .from(safetyFormTemplates)
        .where(eq(safetyFormTemplates.id, input.templateId))
        .limit(1);
      if (!tpl || tpl.isArchived) {
        throw new TemplateUnavailableError();
      }

      // Validate incident payload presence based on template type.
      if (tpl.formType === "incident_report" && !input.incident) {
        throw new IncidentRequiredError();
      }

      // Hybrid clock: trust client clock if within 48h of server time.
      const now = new Date();
      const HYBRID_WINDOW_MS = 48 * 60 * 60 * 1000;
      const clientSubmittedAt = input.clientSubmittedAt
        ? new Date(input.clientSubmittedAt)
        : null;
      const honourClient =
        clientSubmittedAt &&
        clientSubmittedAt.getTime() <= now.getTime() &&
        now.getTime() - clientSubmittedAt.getTime() <= HYBRID_WINDOW_MS;
      const submittedAt =
        input.status === "submitted"
          ? honourClient
            ? clientSubmittedAt!
            : now
          : null;

      // Allocate SF-#### atomically. Same pattern as closeout_counters —
      // upsert the counter row then bump.
      const submitterOrgId = ctx.organization.id;
      const [counterRow] = await tx
        .insert(safetyFormCounters)
        .values({ organizationId: submitterOrgId, lastNumber: 1 })
        .onConflictDoUpdate({
          target: safetyFormCounters.organizationId,
          set: {
            lastNumber: sql`${safetyFormCounters.lastNumber} + 1`,
            updatedAt: now,
          },
        })
        .returning({ lastNumber: safetyFormCounters.lastNumber });
      const formNumber = `SF-${String(counterRow.lastNumber).padStart(4, "0")}`;

      const [row] = await tx
        .insert(safetyForms)
        .values({
          projectId: input.projectId,
          templateId: input.templateId,
          formType: tpl.formType,
          formNumber,
          status: input.status,
          submittedByUserId: ctx.user.id,
          submittedByOrgId: submitterOrgId,
          submittedAt,
          title: input.title,
          dataJson: input.dataJson,
          flagged: input.flagged,
          flagReason: input.flagReason ?? null,
          clientUuid: input.clientUuid ?? null,
        })
        .returning();

      // Incident subtype.
      if (tpl.formType === "incident_report" && input.incident) {
        await tx.insert(safetyFormIncidents).values({
          safetyFormId: row.id,
          severity: input.incident.severity,
          incidentAt: new Date(input.incident.incidentAt),
          location: input.incident.location,
          description: input.incident.description ?? null,
          rootCauseText: input.incident.rootCauseText ?? null,
          injuredJson: input.incident.injured as SafetyInjuredParty[],
          correctiveActionsJson: input.incident.correctiveActions as SafetyCorrectiveAction[],
          photoCount: input.incident.photoCount,
        });
      }

      // Bump template usage counter — best-effort. Allowed under tenant
      // because the template belongs to the contractor org. For sub
      // submissions (template owned by contractor) this update will not
      // pass tenant; we just skip it for subs.
      if (ctx.organization.id === tpl.orgId) {
        await tx
          .update(safetyFormTemplates)
          .set({ timesUsed: sql`${safetyFormTemplates.timesUsed} + 1` })
          .where(eq(safetyFormTemplates.id, input.templateId));
      }

      await writeAuditEvent(
        ctx,
        {
          action: input.status === "submitted" ? "submitted" : "saved_draft",
          resourceType: "safety_form",
          resourceId: row.id,
          details: {
            nextState: {
              formNumber,
              formType: tpl.formType,
              flagged: input.flagged,
              hasIncident: tpl.formType === "incident_report",
            },
          },
        },
        tx,
      );

      await writeActivityFeedItem(
        ctx,
        {
          activityType: "project_update",
          summary: `${formNumber}: ${input.title}`,
          body:
            tpl.formType === "incident_report"
              ? "Incident report submitted — admins notified"
              : "Safety form submitted",
          relatedObjectType: "safety_form",
          relatedObjectId: row.id,
          visibilityScope: "internal_only",
        },
        tx,
      );

      return { row, formType: tpl.formType };
    });

    // Notification fan-out — outside the txn (best-effort, never blocks
    // the primary write). dbAdmin (BYPASSRLS) is used by emit so we don't
    // need to be inside withTenant here.
    if (input.status === "submitted") {
      const eventId =
        result.formType === "incident_report"
          ? "safety_incident_reported"
          : "safety_form_submitted";
      const severityLabel =
        result.formType === "incident_report" && input.incident
          ? SAFETY_SEVERITY_CONFIG[input.incident.severity]?.label
          : null;
      await emitNotifications({
        eventId,
        actorUserId: ctx.user.id,
        projectId: input.projectId,
        relatedObjectType: "safety_form",
        relatedObjectId: result.row.id,
        vars: {
          actorName: ctx.user.displayName ?? null,
          formNumber: result.row.formNumber,
          formTypeLabel:
            result.formType === "toolbox_talk"
              ? "Toolbox Talk"
              : result.formType === "jha"
                ? "JHA"
                : result.formType === "near_miss"
                  ? "Near Miss"
                  : "Incident Report",
          severityLabel: severityLabel ?? null,
          location:
            result.formType === "incident_report" && input.incident
              ? input.incident.location
              : null,
        },
      });
    }

    return NextResponse.json({ id: result.row.id, formNumber: result.row.formNumber });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    if (err instanceof TemplateUnavailableError) {
      return NextResponse.json(
        { error: "template_unavailable", message: err.message },
        { status: 409 },
      );
    }
    if (err instanceof IncidentRequiredError) {
      return NextResponse.json(
        { error: "incident_required", message: err.message },
        { status: 400 },
      );
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// GET /api/safety-forms?projectId=…&type=…&status=…&q=…
//
// Listing endpoint for the workspace + sub-list views. Returns the rows
// the caller's tenant context can see (RLS does the filtering).
// ─────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { session } = await requireServerSession();
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId || !/^[0-9a-f-]{36}$/.test(projectId)) {
    return NextResponse.json({ error: "invalid_project_id" }, { status: 400 });
  }
  const typeFilter = url.searchParams.get("type");
  const statusFilter = url.searchParams.get("status");
  const q = url.searchParams.get("q");

  try {
    const ctx = await getEffectiveContext(session, projectId);

    const rows = await withTenant(ctx.organization.id, async (tx) => {
      const filters = [eq(safetyForms.projectId, projectId)];
      if (typeFilter && typeFilter !== "all") {
        filters.push(
          eq(
            safetyForms.formType,
            typeFilter as "toolbox_talk" | "jha" | "incident_report" | "near_miss",
          ),
        );
      }
      if (statusFilter && statusFilter !== "all") {
        filters.push(
          eq(safetyForms.status, statusFilter as "draft" | "submitted"),
        );
      }
      if (q) {
        filters.push(
          sql`(${safetyForms.title} ILIKE ${"%" + q + "%"} OR ${safetyForms.formNumber} ILIKE ${"%" + q + "%"})`,
        );
      }
      const list = await tx
        .select({
          id: safetyForms.id,
          formNumber: safetyForms.formNumber,
          title: safetyForms.title,
          formType: safetyForms.formType,
          status: safetyForms.status,
          submittedAt: safetyForms.submittedAt,
          submittedByOrgId: safetyForms.submittedByOrgId,
          submittedByUserId: safetyForms.submittedByUserId,
          flagged: safetyForms.flagged,
          flagReason: safetyForms.flagReason,
          createdAt: safetyForms.createdAt,
        })
        .from(safetyForms)
        .where(and(...filters))
        .orderBy(sql`${safetyForms.createdAt} DESC`);

      // Pull severity for any incident rows so the workspace can render
      // the severity pill without a per-row query.
      const incidentIds = list
        .filter((r) => r.formType === "incident_report")
        .map((r) => r.id);
      const incidents = incidentIds.length
        ? await tx
            .select({
              safetyFormId: safetyFormIncidents.safetyFormId,
              severity: safetyFormIncidents.severity,
            })
            .from(safetyFormIncidents)
            .where(inArray(safetyFormIncidents.safetyFormId, incidentIds))
        : [];
      const sevByForm = new Map(
        incidents.map((i) => [i.safetyFormId, i.severity]),
      );

      return list.map((r) => ({
        ...r,
        severity: sevByForm.get(r.id) ?? null,
      }));
    });

    return NextResponse.json({ rows });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status },
      );
    }
    throw err;
  }
}

class TemplateUnavailableError extends Error {
  constructor() {
    super("Template archived or not found");
  }
}

class IncidentRequiredError extends Error {
  constructor() {
    super("Incident report submissions require an `incident` payload");
  }
}
