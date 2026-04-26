import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { meetingAgendaItems, meetings } from "@/db/schema";
import { writeAuditEvent } from "@/domain/audit";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/meetings/:id/agenda — bulk replace the agenda for a
// meeting. Accepts the full list; server diffs against existing rows
// by id to INSERT new items, UPDATE existing, and DELETE any missing.
// `orderIndex` is dense-packed 1..N by position in the input array,
// not by the field on the input — the UI is free to use any order
// indices it wants client-side.
//
// carriedFromMeetingId is preserved on rows that have it (the client
// does not pass it back). Contractor-only, not allowed on
// completed/cancelled meetings.

const ItemSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  estimatedMinutes: z.number().int().min(0).max(600).default(5),
});

const BodySchema = z.object({
  items: z.array(ItemSchema).max(100),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { items } = parsed.data;

  try {
    const [head] = await dbAdmin
      .select({
        id: meetings.id,
        projectId: meetings.projectId,
        status: meetings.status,
      })
      .from(meetings)
      .where(eq(meetings.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(
      session,
      head.projectId,
    );
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can edit agenda",
        "forbidden",
      );
    }
    if (head.status === "completed" || head.status === "cancelled") {
      return NextResponse.json(
        { error: "invalid_state", message: "Meeting is terminal" },
        { status: 409 },
      );
    }

    await withTenant(ctx.organization.id, async (tx) => {
      const existingRows = await tx
        .select({ id: meetingAgendaItems.id })
        .from(meetingAgendaItems)
        .where(eq(meetingAgendaItems.meetingId, id));
      const existingIds = new Set(existingRows.map((r) => r.id));
      const keepIds = items
        .map((i) => i.id)
        .filter((v): v is string => !!v && existingIds.has(v));

      // Delete rows that are in existing but not in keepIds.
      if (existingRows.length > 0) {
        if (keepIds.length > 0) {
          await tx
            .delete(meetingAgendaItems)
            .where(
              and(
                eq(meetingAgendaItems.meetingId, id),
                notInArray(meetingAgendaItems.id, keepIds),
              ),
            );
        } else {
          await tx
            .delete(meetingAgendaItems)
            .where(eq(meetingAgendaItems.meetingId, id));
        }
      }

      // Upsert pass — one statement per row is fine at agenda scale
      // (<= 100 items per meeting).
      for (let idx = 0; idx < items.length; idx += 1) {
        const it = items[idx];
        const orderIndex = idx + 1;
        if (it.id && existingIds.has(it.id)) {
          await tx
            .update(meetingAgendaItems)
            .set({
              orderIndex,
              title: it.title,
              description: it.description ?? null,
              assignedUserId: it.assignedUserId ?? null,
              estimatedMinutes: it.estimatedMinutes,
            })
            .where(eq(meetingAgendaItems.id, it.id));
        } else {
          await tx.insert(meetingAgendaItems).values({
            meetingId: id,
            orderIndex,
            title: it.title,
            description: it.description ?? null,
            assignedUserId: it.assignedUserId ?? null,
            estimatedMinutes: it.estimatedMinutes,
          });
        }
      }

      await writeAuditEvent(
        ctx,
        {
          action: "agenda_updated",
          resourceType: "meeting",
          resourceId: id,
          details: {
            metadata: {
              itemCount: items.length,
              deleted: existingRows.length - keepIds.length,
            },
          },
        },
        tx,
      );
    });

    return NextResponse.json({ ok: true, itemCount: items.length });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
