import { NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { approveEntry, rejectEntry } from "@/domain/actions/time-entries";

import { mapError } from "../../route";

// POST /api/time-entries/[id]/approve  → approves a submitted entry.
// POST body { reject: true, reason } also routes here for terseness; the
// rejection path requires a reason.

const Body = z
  .object({
    reject: z.boolean().optional(),
    reason: z.string().max(500).nullable().optional(),
  })
  .default({});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session } = await requireServerSession();
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    if (parsed.data.reject) {
      await rejectEntry({
        session,
        id,
        reason: parsed.data.reason ?? null,
      });
    } else {
      await approveEntry({
        session,
        id,
        reason: parsed.data.reason ?? null,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err);
  }
}
