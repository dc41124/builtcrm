import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { conversationParticipants, conversations } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;
  const { session } = await requireServerSession();
  try {
    const [conversation] = await db
      .select({ id: conversations.id, projectId: conversations.projectId })
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

    const result = await db
      .update(conversationParticipants)
      .set({ lastReadAt: new Date() })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.userId, ctx.user.id),
        ),
      )
      .returning({ id: conversationParticipants.id });

    if (result.length === 0) {
      throw new AuthorizationError(
        "Not a participant of this conversation",
        "forbidden",
      );
    }

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
