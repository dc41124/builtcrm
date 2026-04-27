import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { inspectionTemplates } from "@/db/schema";
import { AuthorizationError } from "@/domain/permissions";

// PATCH /api/inspection-templates/:id — edit a template (custom only).
// DELETE /api/inspection-templates/:id — archive a template (soft-delete).

const LineItemSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/),
  orderIndex: z.number().int().nonnegative(),
  label: z.string().min(1).max(400),
  ref: z.string().max(200).nullable().optional(),
  photoRequired: z.boolean().optional(),
});

const PatchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  tradeCategory: z.string().min(1).max(40).optional(),
  phase: z.enum(["rough", "final"]).optional(),
  description: z.string().max(4000).nullable().optional(),
  lineItems: z.array(LineItemSchema).min(1).max(100).optional(),
});

async function assertContractorInOrg(appUserId: string, orgId: string) {
  // Pre-tenant role check — role_assignments is RLS'd, so use dbAdmin.
  const [ra] = await dbAdmin.execute(
    sql`select 1
        from role_assignments
        where user_id = ${appUserId}
          and organization_id = ${orgId}
          and portal_type = 'contractor'
        limit 1`,
  );
  if (!ra) {
    throw new AuthorizationError(
      "Only contractors in the owning org may modify this template",
      "forbidden",
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const appUserId = (session)
    .appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    // Entry-point dbAdmin: tenant unknown until orgId resolved from row.
    const [tpl] = await dbAdmin
      .select({
        id: inspectionTemplates.id,
        orgId: inspectionTemplates.orgId,
        isCustom: inspectionTemplates.isCustom,
      })
      .from(inspectionTemplates)
      .where(eq(inspectionTemplates.id, id))
      .limit(1);
    if (!tpl) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await assertContractorInOrg(appUserId, tpl.orgId);
    if (!tpl.isCustom) {
      throw new AuthorizationError(
        "Seeded library templates are read-only. Duplicate and edit the copy.",
        "forbidden",
      );
    }

    const update: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) update.name = parsed.data.name;
    if (parsed.data.tradeCategory !== undefined)
      update.tradeCategory = parsed.data.tradeCategory;
    if (parsed.data.phase !== undefined) update.phase = parsed.data.phase;
    if (parsed.data.description !== undefined)
      update.description = parsed.data.description;
    if (parsed.data.lineItems !== undefined)
      update.lineItemsJson = parsed.data.lineItems;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true, unchanged: true });
    }

    const row = await withTenant(tpl.orgId, async (tx) => {
      const [updated] = await tx
        .update(inspectionTemplates)
        .set(update)
        .where(eq(inspectionTemplates.id, id))
        .returning();
      return updated;
    });

    return NextResponse.json({ id: row.id });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const appUserId = (session)
    .appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    // Entry-point dbAdmin: tenant unknown until orgId resolved from row.
    const [tpl] = await dbAdmin
      .select({
        id: inspectionTemplates.id,
        orgId: inspectionTemplates.orgId,
        isArchived: inspectionTemplates.isArchived,
      })
      .from(inspectionTemplates)
      .where(eq(inspectionTemplates.id, id))
      .limit(1);
    if (!tpl) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    await assertContractorInOrg(appUserId, tpl.orgId);

    await withTenant(tpl.orgId, async (tx) => {
      await tx
        .update(inspectionTemplates)
        .set({ isArchived: !tpl.isArchived })
        .where(eq(inspectionTemplates.id, id));
    });

    return NextResponse.json({ ok: true, archived: !tpl.isArchived });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}
