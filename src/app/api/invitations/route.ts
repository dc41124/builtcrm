import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { auditEvents, invitations, organizations, projects } from "@/db/schema";
import { requireOrgAdminContext } from "@/domain/loaders/org-owner-context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  invitedEmail: z.string().email(),
  invitedName: z.string().max(200).optional(),
  portalType: z.enum(["contractor", "subcontractor", "client"]),
  clientSubtype: z.enum(["commercial", "residential"]).optional(),
  roleKey: z.string().min(1).max(120),
  projectId: z.string().uuid().optional(),
  personalMessage: z.string().max(2000).optional(),
});

const TOKEN_BYTES = 32;
const INVITE_TTL_DAYS = 14;

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await requireOrgAdminContext(
      session.session as unknown as { appUserId?: string | null },
    );

    // Client subtype consistency. Commercial/residential owners can only
    // invite into their own org (same subtype); enforce at the ctx layer.
    if (parsed.data.portalType === "client" && !parsed.data.clientSubtype) {
      return NextResponse.json(
        { error: "invalid_body", message: "clientSubtype required for client invites" },
        { status: 400 },
      );
    }
    if (
      (ctx.portal === "commercial" || ctx.portal === "residential") &&
      parsed.data.portalType !== "client"
    ) {
      throw new AuthorizationError(
        "Client owners can only invite client portal users",
        "forbidden",
      );
    }
    if (
      ctx.portal === "commercial" &&
      parsed.data.clientSubtype &&
      parsed.data.clientSubtype !== "commercial"
    ) {
      throw new AuthorizationError(
        "Commercial owners can only invite commercial client users",
        "forbidden",
      );
    }
    if (
      ctx.portal === "residential" &&
      parsed.data.clientSubtype &&
      parsed.data.clientSubtype !== "residential"
    ) {
      throw new AuthorizationError(
        "Residential owners can only invite residential client users",
        "forbidden",
      );
    }
    // Sub owners can only invite sub members (no cross-org invites for now).
    if (ctx.portal === "subcontractor" && parsed.data.portalType !== "subcontractor") {
      throw new AuthorizationError(
        "Subcontractor owners can only invite subcontractor users",
        "forbidden",
      );
    }

    // Domain lock: if the inviter's org has set allowedEmailDomains, reject
    // invites to any address outside that list. Applies only to same-portal
    // invites (member onboarding), not to cross-org invites (e.g. contractor
    // inviting a client or sub to collaborate on a project).
    const sameOrgInvite =
      (ctx.portal === "contractor" && parsed.data.portalType === "contractor") ||
      (ctx.portal === "subcontractor" && parsed.data.portalType === "subcontractor") ||
      ctx.portal === "commercial" ||
      ctx.portal === "residential";
    if (sameOrgInvite) {
      const [orgRow] = await db
        .select({ allowedEmailDomains: organizations.allowedEmailDomains })
        .from(organizations)
        .where(eq(organizations.id, ctx.orgId))
        .limit(1);
      const allowed = orgRow?.allowedEmailDomains ?? null;
      if (allowed && allowed.length > 0) {
        const domain = parsed.data.invitedEmail.split("@")[1]?.toLowerCase();
        const ok = domain && allowed.some((d) => d.toLowerCase() === domain);
        if (!ok) {
          return NextResponse.json(
            {
              error: "domain_blocked",
              message: `Email domain not in the allowed list (${allowed.join(", ")}).`,
            },
            { status: 403 },
          );
        }
      }
    }

    // If a project is specified (contractor cross-org invites only), ensure it
    // belongs to this contractor org. Client/sub owners don't set projectId.
    if (parsed.data.projectId) {
      if (ctx.portal !== "contractor") {
        throw new AuthorizationError(
          "Only contractors can scope an invitation to a project",
          "forbidden",
        );
      }
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, parsed.data.projectId),
            eq(projects.contractorOrganizationId, ctx.orgId),
          ),
        )
        .limit(1);
      if (!project) {
        throw new AuthorizationError(
          "Project not found or not owned by your organization",
          "not_found",
        );
      }
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const [row] = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(invitations)
        .values({
          invitedEmail: parsed.data.invitedEmail.toLowerCase(),
          invitedName: parsed.data.invitedName ?? null,
          invitedByUserId: ctx.userId,
          organizationId: ctx.orgId,
          projectId: parsed.data.projectId ?? null,
          portalType: parsed.data.portalType,
          clientSubtype: parsed.data.clientSubtype ?? null,
          roleKey: parsed.data.roleKey,
          token,
          expiresAt,
          personalMessage: parsed.data.personalMessage ?? null,
        })
        .returning();

      await tx.insert(auditEvents).values({
        actorUserId: ctx.userId,
        projectId: parsed.data.projectId ?? null,
        organizationId: ctx.orgId,
        objectType: "invitation",
        objectId: inserted[0].id,
        actionName: "created",
        nextState: {
          invitedEmail: inserted[0].invitedEmail,
          portalType: inserted[0].portalType,
          clientSubtype: inserted[0].clientSubtype,
          roleKey: inserted[0].roleKey,
          projectId: inserted[0].projectId,
        },
        metadataJson: { inviterPortal: ctx.portal },
      });

      return inserted;
    });

    // Dev stub: log the invite URL. Replace with a Trigger.dev email job once
    // an outbound provider (Postmark/SendGrid) is connected.
    const inviteUrl = new URL(
      `/invite/${row.token}`,
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ).toString();

    return NextResponse.json({
      id: row.id,
      token: row.token,
      inviteUrl,
      expiresAt: row.expiresAt,
    });
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
