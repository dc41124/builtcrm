import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { selectionItems, selectionOptions } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  selectionItemId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  optionTier: z.enum(["included", "upgrade", "premium_upgrade"]).default("included"),
  priceCents: z.number().int().min(0).default(0),
  leadTimeDays: z.number().int().min(0).optional(),
  additionalScheduleDays: z.number().int().min(0).optional(),
  swatchColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  supplierName: z.string().max(255).optional(),
  productSku: z.string().max(120).optional(),
  isAvailable: z.boolean().optional(),
  unavailableReason: z.string().optional(),
  sortOrder: z.number().int().min(0).optional(),
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
    const [item] = await db
      .select({ id: selectionItems.id, projectId: selectionItems.projectId })
      .from(selectionItems)
      .where(eq(selectionItems.id, parsed.data.selectionItemId))
      .limit(1);
    if (!item) {
      return NextResponse.json({ error: "item_not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      item.projectId,
    );
    assertCan(ctx.permissions, "selection", "write");
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can create selection options",
        "forbidden",
      );
    }

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(selectionOptions)
        .values({
          selectionItemId: item.id,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          optionTier: parsed.data.optionTier,
          priceCents: parsed.data.priceCents,
          leadTimeDays: parsed.data.leadTimeDays ?? null,
          additionalScheduleDays: parsed.data.additionalScheduleDays ?? null,
          swatchColor: parsed.data.swatchColor ?? null,
          supplierName: parsed.data.supplierName ?? null,
          productSku: parsed.data.productSku ?? null,
          isAvailable: parsed.data.isAvailable ?? true,
          unavailableReason: parsed.data.unavailableReason ?? null,
          sortOrder: parsed.data.sortOrder ?? 0,
        })
        .returning();
      await writeAuditEvent(
        ctx,
        {
          action: "created",
          resourceType: "selection_option",
          resourceId: row.id,
          details: {
            nextState: {
              name: row.name,
              optionTier: row.optionTier,
              priceCents: row.priceCents,
            },
          },
        },
        tx,
      );
      return row;
    });

    return NextResponse.json({
      id: result.id,
      name: result.name,
      optionTier: result.optionTier,
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
