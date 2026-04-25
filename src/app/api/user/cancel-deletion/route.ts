import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";
import { hashCancelDeletionToken } from "@/lib/user-deletion/token";

// GET /api/user/cancel-deletion?token=<plaintext>
//
// Tokenized cancel link. The token is the credential (no session
// required — the user can't sign in while pending_deletion_at is set,
// so the email link is the only path back). Idempotent: re-clicking
// after a successful cancel finds no matching token and returns 404
// rather than mutating again.
//
// Hash + lookup pattern mirrors src/lib/invitations/token.ts.
// See docs/specs/user_deletion_and_export_plan.md.

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenParam = url.searchParams.get("token");
  if (!tokenParam) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  const tokenHash = hashCancelDeletionToken(tokenParam);
  const [match] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.pendingDeletionTokenHash, tokenHash))
    .limit(1);

  if (!match) {
    return NextResponse.json(
      { error: "invalid_or_expired_token" },
      { status: 404 },
    );
  }

  await db
    .update(users)
    .set({ pendingDeletionAt: null, pendingDeletionTokenHash: null })
    .where(eq(users.id, match.id));

  await writeSystemAuditEvent({
    resourceType: "user",
    resourceId: match.id,
    action: "user.deletion_canceled",
    details: { metadata: { canceledAt: new Date().toISOString() } },
  });

  // Land the user on /login with a banner. The /login page can read
  // the `?deletion_canceled=1` query param and render a one-line
  // "Deletion canceled — sign in to continue" message.
  return NextResponse.redirect(new URL("/login?deletion_canceled=1", req.url));
}
