import { NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { submitWeek } from "@/domain/actions/time-entries";
import { getWeekEnd, getWeekStart } from "@/lib/time-tracking/week";

import { mapError } from "../route";

const Body = z.object({
  weekOffset: z.number().int().min(-12).max(0).default(0),
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
    const now = new Date();
    const weekStart = getWeekStart(now, parsed.data.weekOffset);
    const weekEnd = getWeekEnd(now, parsed.data.weekOffset);
    const r = await submitWeek({ session, weekStart, weekEnd });
    return NextResponse.json({ submitted: r.submitted });
  } catch (err) {
    return mapError(err);
  }
}
