import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  displayName: z.string().trim().min(1).max(200).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const appUserId = (session.session as unknown as { appUserId?: string | null })
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

  try {
    const patch = parsed.data;
    const updates: Record<string, unknown> = {};
    if (patch.displayName != null) updates.displayName = patch.displayName;
    if (patch.phone !== undefined) updates.phone = patch.phone || null;
    if (patch.title !== undefined) updates.title = patch.title || null;
    if (patch.timezone != null) updates.timezone = patch.timezone;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, noop: true });
    }

    await db.update(users).set(updates).where(eq(users.id, appUserId));
    return NextResponse.json({ ok: true });
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
