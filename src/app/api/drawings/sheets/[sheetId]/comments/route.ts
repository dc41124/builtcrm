// POST /api/drawings/sheets/[sheetId]/comments
//
// Creates a new root comment with an atomically-assigned pin_number. The
// write strategy is INSERT with the next pin_number computed from a
// MAX()+1 subquery, relying on the unique(sheet_id, pin_number) constraint
// as a tiebreaker. On unique-violation (two concurrent posts on the same
// sheet) we retry up to a small bound — Postgres will happily serialize
// us into distinct pins on the retry.

import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";
import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { assertCan, AuthorizationError } from "@/domain/permissions";
import { resolveSheetAccess } from "@/lib/drawings/access";

const BodySchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  text: z.string().min(1).max(4000),
});

const MAX_RETRIES = 5;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ sheetId: string }> },
) {
  const { sheetId } = await params;
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { session } = await requireServerSession();
  try {
    const access = await resolveSheetAccess({
      session: session,
      sheetId,
    });
    assertCan(access.ctx.permissions, "drawing_markup", "write");

    // Retry loop on unique(sheet_id, pin_number) conflict. Each attempt
    // recomputes MAX(pin_number)+1 via a subquery — two concurrent posts
    // will collide on the same computed value, but the loser retries and
    // gets the next slot. Bounds the loop tightly so misbehaving clients
    // can't spin forever.
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const rows = await db.execute(sql`
          INSERT INTO drawing_comments
            (sheet_id, user_id, pin_number, x, y, text)
          VALUES (
            ${sheetId}::uuid,
            ${access.ctx.user.id}::uuid,
            COALESCE(
              (SELECT MAX(pin_number) + 1
                 FROM drawing_comments
                WHERE sheet_id = ${sheetId}::uuid
                  AND parent_comment_id IS NULL),
              1
            ),
            ${parsed.data.x},
            ${parsed.data.y},
            ${parsed.data.text}
          )
          RETURNING id, pin_number
        `);
        const inserted = (rows as unknown as { rows?: Array<{ id: string; pin_number: number }> }).rows
          ?? (rows as unknown as Array<{ id: string; pin_number: number }>);
        const row = Array.isArray(inserted) ? inserted[0] : inserted;
        return NextResponse.json({
          id: row?.id,
          pinNumber: row?.pin_number,
        });
      } catch (err) {
        lastErr = err;
        const message = err instanceof Error ? err.message : String(err);
        // Postgres unique-violation code is 23505. The pg driver's error
        // object surfaces the constraint name at err.constraint_name or
        // err.code depending on version. We sniff the message defensively.
        if (
          /drawing_comments_sheet_pin_unique/.test(message) ||
          /duplicate key/i.test(message) ||
          /23505/.test(message)
        ) {
          continue; // retry — another insert took our slot
        }
        throw err; // unknown error, bail
      }
    }
    throw lastErr ?? new Error("pin-number insert retries exhausted");
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
