import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { auditEvents, invitations, projects } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
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
    const ctx = await getContractorOrgContext(
      session.session as unknown as { appUserId?: string | null },
    );

    if (
      parsed.data.portalType === "client" &&
      !parsed.data.clientSubtype
    ) {
      return NextResponse.json(
        { error: "invalid_body", message: "clientSubtype required for client invites" },
        { status: 400 },
      );
    }

    // If a project is specified, ensure it belongs to this contractor org.
    if (parsed.data.projectId) {
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          and(
            eq(projects.id, parsed.data.projectId),
            eq(projects.contractorOrganizationId, ctx.organization.id),
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
          invitedByUserId: ctx.user.id,
          organizationId: ctx.organization.id,
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
        actorUserId: ctx.user.id,
        projectId: parsed.data.projectId ?? null,
        organizationId: ctx.organization.id,
        objectType: "invitation",
        objectId: inserted[0].id,
        actionName: "created",
        nextState: {
          invitedEmail: inserted[0].invitedEmail,
          portalType: inserted[0].portalType,
          roleKey: inserted[0].roleKey,
          projectId: inserted[0].projectId,
        },
      });

      return inserted;
    });

    // Dev stub: log the invite URL. Replace with a Trigger.dev email job once
    // an outbound provider (Postmark/SendGrid) is connected.
    const inviteUrl = new URL(
      `/invite/${row.token}`,
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ).toString();
    console.log(`[invitations] Sent invite for ${row.invitedEmail}: ${inviteUrl}`);

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
