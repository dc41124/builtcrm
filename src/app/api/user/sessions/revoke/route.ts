import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { requireServerSession } from "@/auth/session";
import { db } from "@/db/client";
import { authSession, authUser } from "@/db/schema";

// Revoke a specific session by its DB id. We look up the session token
// server-side so the client never has to handle the raw token (which is
// sensitive — it's the session bearer credential).
//
// Body: { sessionId } or { revokeOthers: true }

const BodySchema = z.union([
  z.object({ sessionId: z.string().min(1) }),
  z.object({ revokeOthers: z.literal(true) }),
]);

export async function POST(req: Request) {
  const { session, user } = await requireServerSession();

  // The Better Auth user id for the currently signed-in request.
  const authUserId = user.id;
  const currentSessionId = session.id;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Revoke all OTHER sessions (keep the current one).
  if ("revokeOthers" in parsed.data) {
    const others = await db
      .select({ token: authSession.token })
      .from(authSession)
      .where(
        and(
          eq(authSession.userId, authUserId),
        ),
      );
    const tokens = others
      .filter((r) => r.token)
      .map((r) => r.token)
      // Can't filter by id in WHERE easily here; filter in JS.
      .filter(Boolean);

    // Filter out the current session.
    const [currentTokenRow] = await db
      .select({ token: authSession.token })
      .from(authSession)
      .where(eq(authSession.id, currentSessionId))
      .limit(1);
    const currentToken = currentTokenRow?.token;

    const reqHeaders = await headers();
    for (const token of tokens) {
      if (token === currentToken) continue;
      try {
        await auth.api.revokeSession({
          headers: reqHeaders,
          body: { token },
        });
      } catch {
        // Continue best-effort; one bad token shouldn't block others.
      }
    }
    return NextResponse.json({ ok: true });
  }

  // Revoke one specific session by ID (must belong to this user).
  const { sessionId } = parsed.data;
  const [row] = await db
    .select({ id: authSession.id, userId: authSession.userId, token: authSession.token })
    .from(authSession)
    .where(eq(authSession.id, sessionId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (row.userId !== authUserId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await auth.api.revokeSession({
      headers: await headers(),
      body: { token: row.token },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "revoke_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

// Silence unused-import warning in environments that strip `authUser`.
void authUser;
