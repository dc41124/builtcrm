import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import {
  auditEvents,
  invitations,
  submittalDocuments,
  submittalTransmittals,
  submittals,
} from "@/db/schema";
import { emitNotifications } from "@/lib/notifications/emit";
import { formatNumber } from "@/lib/submittals/config";
import { validateReviewerToken } from "@/lib/submittals/reviewer-auth";

// POST /api/reviewer/[token]/decision
//
// Terminal endpoint for the reviewer flow. Atomically:
//  1. Logs an `incoming_from_reviewer` transmittal with
//     transmitted_by_user_id = the reviewer's user row → audit is
//     anchored to a real user record.
//  2. Transitions the submittal to the chosen returned_* / rejected
//     status.
//  3. Marks the invitation `accepted` + stamps acceptedAt +
//     acceptedByUserId = reviewer's user id. Token is now consumed;
//     subsequent requests against it return 401 (consumed).
//  4. Emits `submittal_reviewer_responded` so the GC knows their
//     reviewer has returned and it's time to forward to the sub.
//
// Hard-lock on submission: validateReviewerToken rejects consumed
// invitations, so there is no "edit my decision" path. Re-review
// requires the GC to issue a new invitation.

const BodySchema = z.object({
  decision: z.enum([
    "returned_approved",
    "returned_as_noted",
    "revise_resubmit",
    "rejected",
  ]),
  notes: z.string().max(4000).nullable().optional(),
  rejectionReason: z.string().min(1).max(4000).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const auth = await validateReviewerToken(token);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason },
      { status: auth.reason === "expired" ? 410 : 401 },
    );
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const input = parsed.data;

  if (input.decision === "rejected" && !input.rejectionReason) {
    return NextResponse.json(
      { error: "missing_reason", message: "rejectionReason is required" },
      { status: 400 },
    );
  }

  // Defence-in-depth: current state must be under_review (the invite
  // flow leaves the submittal there). If the GC manually transitioned
  // elsewhere in the meantime, lock the reviewer out cleanly.
  // Reviewer flow is pre-tenant (external token); the dbAdmin transaction
  // below is the canonical path for these routes. Read the head via
  // dbAdmin too so RLS on submittals doesn't deny it.
  const [current] = await dbAdmin
    .select({
      id: submittals.id,
      projectId: submittals.projectId,
      sequentialNumber: submittals.sequentialNumber,
      title: submittals.title,
      status: submittals.status,
    })
    .from(submittals)
    .where(eq(submittals.id, auth.submittalId))
    .limit(1);
  if (!current) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (current.status !== "under_review") {
    return NextResponse.json(
      {
        error: "invalid_state",
        message: `This submittal is now '${current.status}' and no longer accepting reviewer responses.`,
      },
      { status: 409 },
    );
  }

  const now = new Date();

  // Reviewer flow is intrinsically pre-tenant: external reviewer, token
  // is the credential, the route's audit event explicitly sets
  // organizationId: null. The whole transaction goes through the admin
  // pool so the invitations UPDATE (RLS-enforced) succeeds; the other
  // tables touched here (submittals/submittalDocuments/submittalTransmittals/
  // auditEvents) don't yet have RLS but if they ever do, this whole
  // block stays correct because dbAdmin bypasses uniformly.
  await dbAdmin.transaction(async (tx) => {
    await tx.insert(submittalTransmittals).values({
      submittalId: auth.submittalId,
      direction: "incoming_from_reviewer",
      transmittedByUserId: auth.reviewerUserId,
      notes: input.notes ?? null,
    });

    const patch: Partial<typeof submittals.$inferInsert> = {
      status: input.decision,
      returnedAt: now,
      lastTransitionAt: now,
    };
    if (input.decision === "rejected") {
      patch.rejectionReason = input.rejectionReason ?? null;
    }
    await tx.update(submittals).set(patch).where(eq(submittals.id, auth.submittalId));

    // Step 22 pin: reviewer's decision locks the linked package,
    // stamp, and comments docs to the exact versions they reviewed.
    // Matches the same pin-on-terminal rule applied in the GC's
    // transition endpoint for parity across both decision paths.
    await tx
      .update(submittalDocuments)
      .set({ pinVersion: true })
      .where(eq(submittalDocuments.submittalId, auth.submittalId));

    await tx
      .update(invitations)
      .set({
        invitationStatus: "accepted",
        acceptedAt: now,
        acceptedByUserId: auth.reviewerUserId,
      })
      .where(eq(invitations.id, auth.invitationId));

    await tx.insert(auditEvents).values({
      actorUserId: auth.reviewerUserId,
      projectId: auth.projectId,
      organizationId: null,
      objectType: "submittal",
      objectId: auth.submittalId,
      actionName: `reviewer_decision_${input.decision}`,
      previousState: { status: current.status },
      nextState: { status: input.decision },
      metadataJson: {
        rejectionReason: input.rejectionReason ?? null,
        invitationId: auth.invitationId,
      },
    });
  });

  // Notify the GC that the reviewer has responded — the GC still needs
  // to forward the result to the sub (the reviewer portal doesn't
  // close the loop automatically; that decision stays with the GC).
  await emitNotifications({
    eventId: "submittal_reviewer_responded",
    actorUserId: auth.reviewerUserId,
    projectId: auth.projectId,
    relatedObjectType: "submittal",
    relatedObjectId: auth.submittalId,
    vars: {
      number: formatNumber(current.sequentialNumber),
      title: current.title,
      decision: input.decision,
    },
  });

  return NextResponse.json({ ok: true, newStatus: input.decision });
}
