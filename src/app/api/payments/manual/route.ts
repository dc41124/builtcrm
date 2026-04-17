import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  auditEvents,
  paymentTransactions,
  projects,
} from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  relatedEntityType: z.enum([
    "draw_request",
    "change_order",
    "selection_decision",
    "retainage_release",
  ]),
  relatedEntityId: z.string().uuid(),
  paymentMethodType: z.enum(["check", "wire", "other"]),
  grossAmountCents: z.number().int().positive(),
  externalReference: z.string().max(255).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});

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
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        "Only org admins can record manual payments",
        "forbidden",
      );
    }

    // Verify the project belongs to this contractor org.
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
      return NextResponse.json(
        { error: "project_not_found", message: "Project not in your org" },
        { status: 404 },
      );
    }

    const now = new Date();

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(paymentTransactions)
        .values({
          organizationId: ctx.organization.id,
          projectId: parsed.data.projectId,
          relatedEntityType: parsed.data.relatedEntityType,
          relatedEntityId: parsed.data.relatedEntityId,
          paymentMethodType: parsed.data.paymentMethodType,
          transactionStatus: "succeeded",
          grossAmountCents: parsed.data.grossAmountCents,
          processingFeeCents: 0,
          platformFeeCents: 0,
          netAmountCents: parsed.data.grossAmountCents,
          currency: "CAD",
          initiatedByUserId: ctx.user.id,
          externalReference: parsed.data.externalReference ?? null,
          note: parsed.data.note ?? null,
          initiatedAt: now,
          succeededAt: now,
        })
        .returning();

      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        organizationId: ctx.organization.id,
        objectType: "payment_transaction",
        objectId: row.id,
        actionName: "manual_recorded",
        nextState: {
          projectId: parsed.data.projectId,
          grossAmountCents: parsed.data.grossAmountCents,
          method: parsed.data.paymentMethodType,
        },
      });

      return row;
    });

    return NextResponse.json({ id: result.id, ok: true });
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
