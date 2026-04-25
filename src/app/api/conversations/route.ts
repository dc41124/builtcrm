import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  conversationParticipants,
  conversations,
  projectUserMemberships,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { withErrorHandler } from "@/lib/api/error-handler";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().max(255).optional(),
  conversationType: z
    .enum([
      "project_general",
      "rfi_thread",
      "change_order_thread",
      "approval_thread",
      "direct",
    ])
    .default("project_general"),
  linkedObjectType: z.string().max(120).optional(),
  linkedObjectId: z.string().uuid().optional(),
  participantUserIds: z.array(z.string().uuid()).min(1).max(50),
});

export async function POST(req: Request) {
  return withErrorHandler(
    async () => {
  const { session } = await requireServerSession();
      const parsed = BodySchema.safeParse(await req.json().catch(() => null));
      if (!parsed.success) {
        return NextResponse.json(
          { error: "invalid_body", issues: parsed.error.issues },
          { status: 400 },
        );
      }

      if (
        (parsed.data.linkedObjectType && !parsed.data.linkedObjectId) ||
        (!parsed.data.linkedObjectType && parsed.data.linkedObjectId)
      ) {
        return NextResponse.json(
          {
            error: "invalid_body",
            message:
              "linkedObjectType and linkedObjectId must be provided together",
          },
          { status: 400 },
        );
      }

      const ctx = await getEffectiveContext(
        session,
        parsed.data.projectId,
      );
      if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
        throw new AuthorizationError(
          "Only contractors can create conversations",
          "forbidden",
        );
      }

      // Every participant must be a project member (contractor staff are
      // implicit project members via role_assignments, so we accept them if
      // they are not in project_user_memberships but match contractor org).
      const participantIds = Array.from(
        new Set(parsed.data.participantUserIds),
      );
      const memberRows = await db
        .select({ userId: projectUserMemberships.userId })
        .from(projectUserMemberships)
        .where(
          and(
            eq(projectUserMemberships.projectId, ctx.project.id),
            inArray(projectUserMemberships.userId, participantIds),
            eq(projectUserMemberships.membershipStatus, "active"),
            eq(projectUserMemberships.accessState, "active"),
          ),
        );
      const memberSet = new Set(memberRows.map((r) => r.userId));
      const missing = participantIds.filter((id) => !memberSet.has(id));
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: "invalid_participants",
            message: "Some participants are not active project members",
            missing,
          },
          { status: 400 },
        );
      }

      // Always include the creator as a participant.
      const allParticipantIds = Array.from(
        new Set([ctx.user.id, ...participantIds]),
      );

      const result = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(conversations)
          .values({
            projectId: ctx.project.id,
            title: parsed.data.title ?? null,
            conversationType: parsed.data.conversationType,
            linkedObjectType: parsed.data.linkedObjectType ?? null,
            linkedObjectId: parsed.data.linkedObjectId ?? null,
            visibilityScope: "participants_only",
          })
          .returning();

        await tx.insert(conversationParticipants).values(
          allParticipantIds.map((userId) => ({
            conversationId: row.id,
            userId,
          })),
        );

        await writeAuditEvent(
          ctx,
          {
            action: "created",
            resourceType: "conversation",
            resourceId: row.id,
            details: {
              nextState: {
                title: row.title,
                conversationType: row.conversationType,
                linkedObjectType: row.linkedObjectType,
                linkedObjectId: row.linkedObjectId,
                participantUserIds: allParticipantIds,
              },
            },
          },
          tx,
        );

        return row;
      });

      return NextResponse.json({ id: result.id });
    },
    { path: "/api/conversations", method: "POST" },
  );
}
