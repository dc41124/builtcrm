import { eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { invitations, submittals, users } from "@/db/schema";

// Validates a reviewer token and returns the submittal + reviewer user
// it authorises. Used by every /api/reviewer/[token]/* endpoint plus
// the /reviewer/[token] server page.
//
// The token IS the session for external reviewers — they don't carry a
// Better Auth cookie. On expiry OR consumption (invitationStatus !=
// 'pending') the token is dead and all reviewer routes 401.
//
// The reviewer's user row is auto-resolved by email match against the
// invitedEmail on the invitation — established at invite-creation time
// (see /api/submittals/[id]/invite-reviewer). That user id is what goes
// on transmittal + document-attachment rows so audit stays intact.

export type ReviewerAuthOk = {
  ok: true;
  invitationId: string;
  submittalId: string;
  projectId: string;
  reviewerUserId: string;
  reviewerEmail: string;
  invitedByUserId: string;
  expiresAt: Date;
};

export type ReviewerAuthFail = {
  ok: false;
  reason: "not_found" | "expired" | "consumed" | "revoked" | "invalid_scope";
  // Populated when we can identify the inviting GC so the expired
  // screen can show actionable contact info.
  invitedByUserId?: string;
  submittalId?: string;
};

export type ReviewerAuthResult = ReviewerAuthOk | ReviewerAuthFail;

export async function validateReviewerToken(
  token: string,
): Promise<ReviewerAuthResult> {
  const [invitation] = await db
    .select({
      id: invitations.id,
      token: invitations.token,
      invitedEmail: invitations.invitedEmail,
      invitedByUserId: invitations.invitedByUserId,
      projectId: invitations.projectId,
      invitationStatus: invitations.invitationStatus,
      expiresAt: invitations.expiresAt,
      scopeObjectType: invitations.scopeObjectType,
      scopeObjectId: invitations.scopeObjectId,
    })
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);

  if (!invitation) {
    return { ok: false, reason: "not_found" };
  }

  const sharedFail = {
    invitedByUserId: invitation.invitedByUserId,
    submittalId: invitation.scopeObjectId ?? undefined,
  } as const;

  if (
    invitation.scopeObjectType !== "submittal" ||
    !invitation.scopeObjectId
  ) {
    return { ok: false, reason: "invalid_scope", ...sharedFail };
  }

  if (invitation.invitationStatus === "accepted") {
    return { ok: false, reason: "consumed", ...sharedFail };
  }
  if (invitation.invitationStatus === "revoked") {
    return { ok: false, reason: "revoked", ...sharedFail };
  }
  if (
    invitation.invitationStatus === "expired" ||
    invitation.expiresAt.getTime() < Date.now()
  ) {
    // Lazily stamp expired status so the next visit short-circuits.
    if (invitation.invitationStatus !== "expired") {
      await db
        .update(invitations)
        .set({ invitationStatus: "expired" })
        .where(eq(invitations.id, invitation.id));
    }
    return { ok: false, reason: "expired", ...sharedFail };
  }

  // Resolve reviewer user by email. Invariant: the invite-creation
  // route upserts this row, so a pending invitation implies a matching
  // user exists. Defensive fallback returns not_found if somehow not.
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, invitation.invitedEmail.toLowerCase()))
    .limit(1);
  if (!user) {
    return { ok: false, reason: "not_found", ...sharedFail };
  }

  // Double-check the submittal still exists on the claimed project.
  const [submittal] = await db
    .select({ id: submittals.id, projectId: submittals.projectId })
    .from(submittals)
    .where(eq(submittals.id, invitation.scopeObjectId))
    .limit(1);
  if (!submittal) {
    return { ok: false, reason: "not_found", ...sharedFail };
  }

  return {
    ok: true,
    invitationId: invitation.id,
    submittalId: submittal.id,
    projectId: submittal.projectId,
    reviewerUserId: user.id,
    reviewerEmail: invitation.invitedEmail,
    invitedByUserId: invitation.invitedByUserId,
    expiresAt: invitation.expiresAt,
  };
}
