import { NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { clockOut } from "@/domain/actions/time-entries";

import { mapError } from "../route";

const Body = z.object({
  notes: z.string().max(2000).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    const { session } = await requireServerSession();
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    const r = await clockOut({ session, notes: parsed.data.notes ?? null });
    if (!r) {
      return NextResponse.json(
        { error: "no_running_entry", message: "Nothing to clock out." },
        { status: 409 },
      );
    }
    return NextResponse.json({ id: r.id });
  } catch (err) {
    return mapError(err);
  }
}
