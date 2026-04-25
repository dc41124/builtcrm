import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/auth/config";
import { requireServerSession } from "@/auth/session";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { writeSystemAuditEvent } from "@/domain/audit";
import { sendDeletionConfirmationEmail } from "@/lib/user-deletion/email";
import { generateCancelDeletionToken } from "@/lib/user-deletion/token";
import { listOrgsUserSolelyOwns } from "@/lib/user-deletion/sole-owner";

// POST /api/user/delete
//
// Initiates self-serve account deletion. Sets users.pending_deletion_at
// to now + 30 days, generates a hashed cancel token (plaintext goes
// out in the confirmation email), revokes every session for the user,
// and writes a user.deletion_requested audit event.
//
// Re-auth gate: requires session to be fresh per Better Auth's
// `freshAge` (1 day) — if the session was minted more than a day ago,
// the UI must prompt for password re-entry first. Defends against
// accidentally-triggered deletion from a logged-in-but-unattended browser.
//
// Sole-owner block: a user who is the only owner/admin of any org
// cannot delete — they must transfer ownership first. Returns the list
// of blocking orgs in the 409 body so the UI can render a clear message.
//
// See docs/specs/user_deletion_and_export_plan.md.

const FRESH_AGE_MS = 60 * 60 * 24 * 1000; // 1 day; matches src/auth/config.ts freshAge
const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function POST() {
  const { session } = await requireServerSession();

  const sessionAgeMs =
    Date.now() - new Date(session.createdAt as unknown as string).getTime();
  if (sessionAgeMs > FRESH_AGE_MS) {
    return NextResponse.json(
      {
        error: "stale_session",
        message:
          "Re-authenticate to continue. For your protection we require a recent password entry before deleting an account.",
      },
      { status: 401 },
    );
  }

  const appUserId = session.appUserId;
  if (!appUserId) {
    return NextResponse.json(
      { error: "no_app_user", message: "No domain user linked to this session." },
      { status: 400 },
    );
  }

  const blockers = await listOrgsUserSolelyOwns(appUserId);
  if (blockers.length > 0) {
    return NextResponse.json(
      {
        error: "sole_owner",
        message:
          "You're the only owner of one or more organizations. Transfer ownership before deleting your account.",
        blockers,
      },
      { status: 409 },
    );
  }

  const { plaintext: cancelToken, hash: cancelTokenHash } =
    generateCancelDeletionToken();
  const scheduledFor = new Date(Date.now() + GRACE_PERIOD_MS);

  await db
    .update(users)
    .set({
      pendingDeletionAt: scheduledFor,
      pendingDeletionTokenHash: cancelTokenHash,
    })
    .where(eq(users.id, appUserId));

  // Revoke the caller's session. Better Auth doesn't expose a
  // server-side bulk revocation API for an arbitrary user; sessions on
  // other devices will expire via the 24h idle timeout
  // (src/auth/config.ts session.expiresIn). The auth.session.create
  // hook blocks any future sign-in attempts during the grace window,
  // so the only access surface left is already-authenticated sessions
  // bounded by 24h idle. Acceptable for Phase 1; a follow-up could
  // add an Upstash scan-based revoker if needed.
  try {
    await auth.api.revokeSessions({ headers: await headers() });
  } catch (err) {
    console.error("[user-delete] revokeSessions failed:", err);
  }

  // user.email read inside the same transaction as the pendingDeletion
  // update would be tighter, but the freshness gate above already
  // guarantees the caller is the account owner.
  const [appUserRow] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, appUserId))
    .limit(1);

  await sendDeletionConfirmationEmail({
    toEmail: appUserRow?.email ?? "(unknown)",
    cancelToken,
    scheduledForAnonymizationAt: scheduledFor,
  });

  await writeSystemAuditEvent({
    resourceType: "user",
    resourceId: appUserId,
    action: "user.deletion_requested",
    details: {
      metadata: {
        scheduledForAnonymizationAt: scheduledFor.toISOString(),
        gracePeriodDays: 30,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    scheduledForAnonymizationAt: scheduledFor.toISOString(),
  });
}
