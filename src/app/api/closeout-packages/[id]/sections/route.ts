import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq, max } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  closeoutPackageSections,
  closeoutPackages,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  sectionType: z.enum([
    "om_manuals",
    "warranties",
    "as_builts",
    "permits_final",
    "testing_certificates",
    "cad_files",
    "other",
  ]),
  customLabel: z.string().max(120).nullable().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    const [head] = await db
      .select({
        id: closeoutPackages.id,
        projectId: closeoutPackages.projectId,
        status: closeoutPackages.status,
      })
      .from(closeoutPackages)
      .where(eq(closeoutPackages.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      head.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit closeout packages",
        "forbidden",
      );
    }
    if (head.status !== "building" && head.status !== "review") {
      return NextResponse.json(
        { error: "not_editable" },
        { status: 409 },
      );
    }

    const row = await db.transaction(async (tx) => {
      const [highest] = await tx
        .select({ max: max(closeoutPackageSections.orderIndex) })
        .from(closeoutPackageSections)
        .where(eq(closeoutPackageSections.packageId, id));
      const nextOrder = (highest?.max ?? 0) + 1;

      const [inserted] = await tx
        .insert(closeoutPackageSections)
        .values({
          packageId: id,
          sectionType: input.sectionType,
          customLabel: input.customLabel ?? null,
          orderIndex: nextOrder,
        })
        .returning();

      await writeAuditEvent(
        ctx,
        {
          action: "section_added",
          resourceType: "closeout_package",
          resourceId: id,
          details: {
            nextState: {
              sectionType: input.sectionType,
              customLabel: input.customLabel ?? null,
            },
          },
        },
        tx,
      );

      return inserted;
    });

    return NextResponse.json({ id: row.id });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    // Unique-index violation when a fixed-type section already exists.
    if (err instanceof Error && /unique/i.test(err.message)) {
      return NextResponse.json(
        { error: "section_type_exists", message: "That section type is already present — add an 'Other' custom section instead." },
        { status: 409 },
      );
    }
    throw err;
  }
}
