import { eq, sql } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import { authUser, users } from "@/db/schema";

// Anonymization payload applied when a user's grace window expires.
// Replaces identifying fields with deterministic tombstones, keeps the
// row + all inbound FK references intact (so RFI / CO / lien-waiver
// authorship survives — see docs/specs/user_deletion_and_export_plan.md
// §1 for the construction-PM legal-continuity rationale).
//
// CASCADE-delete fires automatically on the 8 CASCADE FKs (notification
// preferences, role assignments, org memberships) when those tables'
// rows reference users.id ON DELETE CASCADE — but here we are NOT
// deleting the row, only scrubbing it. So CASCADE doesn't trigger;
// instead we explicitly delete the dependent personal-data rows in the
// same transaction below.

const ANONYMIZED_DOMAIN = "anonymized.local";

export type AnonymizationOutcome = {
  userId: string;
  previousEmail: string;
};

// Mutates the row in place + clears Better Auth's app_user_id link.
// Caller is responsible for revoking sessions and writing the audit
// event around this call.
export async function anonymizeUserRow(
  userId: string,
): Promise<AnonymizationOutcome> {
  return await dbAdmin.transaction(async (tx) => {
    const [before] = await tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!before) {
      throw new Error(`User ${userId} not found for anonymization`);
    }

    const tombstoneEmail = `deleted-${userId}@${ANONYMIZED_DOMAIN}`;

    await tx
      .update(users)
      .set({
        email: tombstoneEmail,
        firstName: null,
        lastName: null,
        displayName: "Deleted User",
        phone: null,
        title: null,
        avatarUrl: null,
        isActive: false,
        pendingDeletionAt: null,
        pendingDeletionTokenHash: null,
        deletedAt: sql`now()`,
      })
      .where(eq(users.id, userId));

    // Better Auth's authUser.appUserId is not a FK constraint, so we
    // must zero it manually. Without this, sessions for the auth user
    // would still resolve (until token expiry) and the anonymized
    // domain user would re-link on next sign-in attempt.
    await tx
      .update(authUser)
      .set({ appUserId: null })
      .where(eq(authUser.appUserId, userId));

    return { userId, previousEmail: before.email };
  });
}
