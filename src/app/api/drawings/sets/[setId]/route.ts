// PATCH /api/drawings/sets/[setId]
//
// Contractor-only. Currently exposes as_built and note toggles. The
// as_built flag feeds Closeout (Step 48) — the closeout package builder
// reads `as_built = true` sets from the same project to bundle final
// record drawings. We don't cascade the flag across a version chain; a
// contractor flips it explicitly on whichever version is the as-built
// record of truth.

import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { drawingSets } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  asBuilt: z.boolean().optional(),
  note: z.string().max(2000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const body = parsed.data;
  if (body.asBuilt === undefined && body.note === undefined) {
    return NextResponse.json({ error: "empty_patch" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const [set] = await db
    .select()
    .from(drawingSets)
    .where(eq(drawingSets.id, setId))
    .limit(1);
  if (!set) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      set.projectId,
    );
    assertCan(ctx.permissions, "drawing", "write");

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.asBuilt !== undefined) patch.asBuilt = body.asBuilt;
    if (body.note !== undefined) patch.note = body.note;

    await db.update(drawingSets).set(patch).where(eq(drawingSets.id, setId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.code }, { status: 403 });
    }
    throw err;
  }
}
