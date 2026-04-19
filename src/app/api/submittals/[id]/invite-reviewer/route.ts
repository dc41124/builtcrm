import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { auth } from "@/auth/config";
import { db } from "@/db/client";
import {
  documents,
  invitations,
  submittalTransmittals,
  submittals,
  users,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/submittals/[id]/invite-reviewer
//
// GC-only. Sends an invitation link to an external architect/engineer
// to review this submittal directly via the reviewer portal (Step 20.5).
// This endpoint replaces the "Record contact only" flow — both remain
// available; the UI primary-actions this path.
//
// Transaction scope:
//  1. Upsert a `users` row for the reviewer (email). No Better Auth
//     account is created — reviewers interact purely via their token
//     URL. The user row exists for audit/FK purposes
//     (transmitted_by_user_id, attached_by_user_id).
//  2. Generate a cryptographically-random token (base64url, 32 bytes).
//  3. Insert an `invitations` row scoped to this submittal
//     (scope_object_type='submittal', scope_object_id=submittalId,
//     portalType='external_reviewer', roleKey='submittal_reviewer').
//  4. Patch reviewer_name/reviewer_org/reviewer_email on the submittal
//     row so downstream displays (list, detail, reports) have a single
//     source of truth regardless of which flow recorded the reviewer.
//  5. Insert an `outgoing_to_reviewer` transmittal with the GC as
//     transmitted_by_user_id. Cover letter doc and notes optional.
//  6. Transition submittal to `under_review`.
//
// Response includes the invite URL (for UI display + eventual email
// send via a Trigger.dev job once an outbound provider is wired up).

const BodySchema = z.object({
  reviewerName: z.string().min(1).max(200),
  reviewerOrg: z.string().max(200).nullable().optional(),
  reviewerEmail: z.string().email().max(320),
  // Default 14 days; configurable per invitation so short-turnaround
  // submittals can use a tighter window.
  expiresInDays: z.number().int().min(1).max(180).default(14),
  coverNotes: z.string().max(4000).nullable().optional(),
  coverDocumentId: z.string().uuid().nullable().optional(),
});

const TOKEN_BYTES = 32;

function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
  const input = parsed.data;
  const reviewerEmail = input.reviewerEmail.toLowerCase();

  try {
    const [current] = await db
      .select({
        id: submittals.id,
        projectId: submittals.projectId,
        sequentialNumber: submittals.sequentialNumber,
        title: submittals.title,
        status: submittals.status,
      })
      .from(submittals)
      .where(eq(submittals.id, id))
      .limit(1);
    if (!current) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      current.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can invite reviewers",
        "forbidden",
      );
    }

    // State gate: must be submitted (ready to route). Same status window
    // as the "Record contact only" flow. draft → must submit first.
    if (current.status !== "submitted") {
      return NextResponse.json(
        {
          error: "invalid_state",
          message: `Submittal is ${current.status}; can only invite a reviewer when status is 'submitted'.`,
        },
        { status: 409 },
      );
    }

    // If a cover doc is provided, verify it lives on this project.
    if (input.coverDocumentId) {
      const [doc] = await db
        .select({ id: documents.id, projectId: documents.projectId })
        .from(documents)
        .where(eq(documents.id, input.coverDocumentId))
        .limit(1);
      if (!doc || doc.projectId !== current.projectId) {
        return NextResponse.json(
          { error: "invalid_document" },
          { status: 400 },
        );
      }
    }

    const token = generateToken();
    const expiresAt = new Date(
      Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
    );
    const displayName =
      input.reviewerName && input.reviewerOrg
        ? `${input.reviewerName} (${input.reviewerOrg})`
        : input.reviewerName;

    const result = await db.transaction(async (tx) => {
      // 1. Upsert reviewer user by email. Audit/FK handle; no login.
      const [existingUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(sql`lower(${users.email})`, reviewerEmail))
        .limit(1);
      let reviewerUserId: string;
      if (existingUser) {
        reviewerUserId = existingUser.id;
      } else {
        const [newUser] = await tx
          .insert(users)
          .values({
            email: reviewerEmail,
            displayName,
            isActive: true,
          })
          .returning({ id: users.id });
        reviewerUserId = newUser.id;
      }

      // 2. Invalidate any prior pending reviewer invitations on this
      // submittal — one active reviewer at a time.
      await tx
        .update(invitations)
        .set({ invitationStatus: "revoked" })
        .where(
          and(
            eq(invitations.scopeObjectType, "submittal"),
            eq(invitations.scopeObjectId, id),
            eq(invitations.invitationStatus, "pending"),
          ),
        );

      // 3. Insert the new invitation row.
      const [invitation] = await tx
        .insert(invitations)
        .values({
          invitedEmail: reviewerEmail,
          invitedName: input.reviewerName,
          invitedByUserId: ctx.user.id,
          organizationId: ctx.project.contractorOrganizationId,
          projectId: current.projectId,
          portalType: "external_reviewer",
          roleKey: "submittal_reviewer",
          token,
          expiresAt,
          personalMessage: input.coverNotes ?? null,
          scopeObjectType: "submittal",
          scopeObjectId: id,
        })
        .returning();

      // 4. Patch reviewer fields on the submittal. Single source of
      // truth across both flows.
      await tx
        .update(submittals)
        .set({
          reviewerName: input.reviewerName,
          reviewerOrg: input.reviewerOrg ?? null,
          reviewerEmail: reviewerEmail,
          routedToOrgId: null,
        })
        .where(eq(submittals.id, id));

      // 5. Log the outgoing transmittal (GC is the actor).
      await tx.insert(submittalTransmittals).values({
        submittalId: id,
        direction: "outgoing_to_reviewer",
        transmittedByUserId: ctx.user.id,
        documentId: input.coverDocumentId ?? null,
        notes: input.coverNotes ?? null,
      });

      // 6. Transition submittal → under_review.
      const now = new Date();
      await tx
        .update(submittals)
        .set({
          status: "under_review",
          lastTransitionAt: now,
        })
        .where(eq(submittals.id, id));

      await writeAuditEvent(
        ctx,
        {
          action: "invited_reviewer",
          resourceType: "submittal",
          resourceId: id,
          details: {
            nextState: {
              invitationId: invitation.id,
              reviewerEmail,
              reviewerUserId,
              expiresAt: invitation.expiresAt.toISOString(),
            },
          },
        },
        tx,
      );

      return { invitation, reviewerUserId };
    });

    const inviteUrl = new URL(
      `/reviewer/${result.invitation.token}`,
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    ).toString();

    // Dev stub: log the URL. Trigger.dev email job (Postmark/SendGrid)
    // can consume this in a later step — the invitation row is already
    // persisted and the response carries the URL for UI copy-to-
    // clipboard as an immediate escape hatch.
    console.log(`[reviewer-invite] ${inviteUrl} → ${reviewerEmail}`);

    return NextResponse.json({
      invitationId: result.invitation.id,
      inviteUrl,
      expiresAt: result.invitation.expiresAt,
    });
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
