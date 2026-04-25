import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  conversationParticipants,
  conversations,
  messages,
} from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { emitNotifications } from "@/lib/notifications/emit";

const BodySchema = z.object({
  body: z.string().min(1).max(10000),
  attachedDocumentId: z.string().uuid().optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const [conversation] = await db
      .select({
        id: conversations.id,
        projectId: conversations.projectId,
      })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    if (!conversation) {
      throw new AuthorizationError("Conversation not found", "not_found");
    }

    const ctx = await getEffectiveContext(
      session,
      conversation.projectId,
    );

    const [participant] = await db
      .select({ id: conversationParticipants.id })
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, ctx.user.id),
        ),
      )
      .limit(1);
    if (!participant) {
      throw new AuthorizationError(
        "Not a participant of this conversation",
        "forbidden",
      );
    }

    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const [row] = await tx
        .insert(messages)
        .values({
          conversationId,
          senderUserId: ctx.user.id,
          body: parsed.data.body,
          attachedDocumentId: parsed.data.attachedDocumentId ?? null,
          createdAt: now,
        })
        .returning();

      const preview = parsed.data.body.slice(0, 255);
      await tx
        .update(conversations)
        .set({
          lastMessageAt: now,
          lastMessagePreview: preview,
          messageCount: sql`${conversations.messageCount} + 1`,
        })
        .where(eq(conversations.id, conversationId));

      // Sender implicitly reads their own message.
      await tx
        .update(conversationParticipants)
        .set({ lastReadAt: now })
        .where(eq(conversationParticipants.id, participant.id));

      await writeAuditEvent(
        ctx,
        {
          action: "sent",
          resourceType: "message",
          resourceId: row.id,
          details: {
            nextState: {
              conversationId,
              preview,
              attachedDocumentId: row.attachedDocumentId,
            },
          },
        },
        tx,
      );

      return row;
    });

    await emitNotifications({
      eventId: "message_new",
      actorUserId: ctx.user.id,
      projectId: conversation.projectId,
      conversationId,
      relatedObjectType: "message",
      relatedObjectId: result.id,
      vars: {
        actorName: ctx.user.displayName ?? ctx.user.email,
        preview: parsed.data.body,
      },
    });

    return NextResponse.json({ id: result.id, createdAt: result.createdAt });
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
