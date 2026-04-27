import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { inspectionTemplates } from "@/db/schema";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/inspection-templates — contractor creates a new custom template
// against their own org. Seeded templates are immutable for now (the JSX
// shows Archive but not Delete for org-owned templates); custom ones
// can be edited + archived via PATCH/DELETE on [id].

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

const BodySchema = z.object({
  name: z.string().min(1).max(160),
  tradeCategory: z.string().min(1).max(40),
  phase: z.enum(["rough", "final"]),
  description: z.string().max(4000).nullable().optional(),
  lineItems: z.array(LineItemSchema).min(1).max(100),
});

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const appUserId = (session)
    .appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    // Pre-tenant role lookup — role_assignments is RLS'd so use dbAdmin
    // to discover which contractor org this user belongs to.
    const [ra] = await dbAdmin.execute(
      sql`select organization_id as "organizationId"
          from role_assignments
          where user_id = ${appUserId}
            and portal_type = 'contractor'
          limit 1`,
    );
    if (!ra) {
      throw new AuthorizationError(
        "Only contractors manage inspection templates",
        "forbidden",
      );
    }
    const orgId = (ra as { organizationId: string }).organizationId;

    const row = await withTenant(orgId, async (tx) => {
      // Reject duplicate name within the same org.
      const [existing] = await tx
        .select({ id: inspectionTemplates.id })
        .from(inspectionTemplates)
        .where(
          and(
            eq(inspectionTemplates.orgId, orgId),
            eq(inspectionTemplates.name, input.name),
          ),
        )
        .limit(1);
      if (existing) {
        throw new DuplicateNameError();
      }

      const [created] = await tx
        .insert(inspectionTemplates)
        .values({
          orgId,
          name: input.name,
          tradeCategory: input.tradeCategory,
          phase: input.phase,
          description: input.description ?? null,
          lineItemsJson: input.lineItems,
          isCustom: true,
          createdByUserId: appUserId,
        })
        .returning();
      return created;
    });

    return NextResponse.json({ id: row.id });
  } catch (err) {
    if (err instanceof DuplicateNameError) {
      return NextResponse.json({ error: "name_already_used" }, { status: 409 });
    }
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

class DuplicateNameError extends Error {}
