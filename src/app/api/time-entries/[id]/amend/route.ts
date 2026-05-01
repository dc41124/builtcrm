import { NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { amendEntry } from "@/domain/actions/time-entries";

import { mapError } from "../../route";

const Body = z.object({
  clockInAt: z.string().datetime().optional(),
  clockOutAt: z.string().datetime().nullable().optional(),
  projectId: z.string().uuid().optional(),
  taskLabel: z.string().max(160).nullable().optional(),
  taskCode: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  reason: z.string().min(1).max(500),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session } = await requireServerSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    await amendEntry({
      session,
      id,
      clockInAt: parsed.data.clockInAt
        ? new Date(parsed.data.clockInAt)
        : undefined,
      clockOutAt:
        parsed.data.clockOutAt !== undefined
          ? parsed.data.clockOutAt === null
            ? null
            : new Date(parsed.data.clockOutAt)
          : undefined,
      projectId: parsed.data.projectId,
      taskLabel: parsed.data.taskLabel,
      taskCode: parsed.data.taskCode,
      notes: parsed.data.notes,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err);
  }
}
