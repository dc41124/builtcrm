import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  closeoutPackageSections,
  closeoutPackages,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  customLabel: z.string().max(120).nullable().optional(),
  orderIndex: z.number().int().min(0).max(99).optional(),
});

async function loadSection(sectionId: string) {
  const [row] = await db
    .select({
      id: closeoutPackageSections.id,
      packageId: closeoutPackageSections.packageId,
      customLabel: closeoutPackageSections.customLabel,
      sectionType: closeoutPackageSections.sectionType,
      projectId: closeoutPackages.projectId,
      status: closeoutPackages.status,
    })
    .from(closeoutPackageSections)
    .innerJoin(
      closeoutPackages,
      eq(closeoutPackages.id, closeoutPackageSections.packageId),
    )
    .where(eq(closeoutPackageSections.id, sectionId))
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const { sectionId } = await params;
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
    const sec = await loadSection(sectionId);
    if (!sec) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      sec.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError("forbidden", "forbidden");
    }
    if (sec.status !== "building" && sec.status !== "review") {
      return NextResponse.json({ error: "not_editable" }, { status: 409 });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.customLabel !== undefined) {
      updates.customLabel = parsed.data.customLabel;
    }
    if (parsed.data.orderIndex !== undefined) {
      updates.orderIndex = parsed.data.orderIndex;
    }
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(closeoutPackageSections)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(closeoutPackageSections.id, sectionId));
      await writeAuditEvent(
        ctx,
        {
          action: "section_updated",
          resourceType: "closeout_package",
          resourceId: sec.packageId,
          details: {
            metadata: { sectionId, updates },
          },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated" ? 401 : err.code === "not_found" ? 404 : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ sectionId: string }> },
) {
  const { sectionId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const sec = await loadSection(sectionId);
    if (!sec) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      sec.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError("forbidden", "forbidden");
    }
    if (sec.status !== "building" && sec.status !== "review") {
      return NextResponse.json({ error: "not_editable" }, { status: 409 });
    }

    await db.transaction(async (tx) => {
      await writeAuditEvent(
        ctx,
        {
          action: "section_removed",
          resourceType: "closeout_package",
          resourceId: sec.packageId,
          details: {
            previousState: { sectionType: sec.sectionType, customLabel: sec.customLabel },
          },
        },
        tx,
      );
      await tx
        .delete(closeoutPackageSections)
        .where(eq(closeoutPackageSections.id, sectionId));
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated" ? 401 : err.code === "not_found" ? 404 : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
