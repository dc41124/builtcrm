import { NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import {
  clockIn,
  manualEntry,
  OverlapError,
  ProjectAccessError,
  StateError,
} from "@/domain/actions/time-entries";
import { AuthorizationError } from "@/domain/permissions";

// POST /api/time-entries
//
// Two modes:
//   { mode: "clock-in", projectId, ... } — start a running entry now.
//   { mode: "manual", projectId, clockInAt, clockOutAt, reason, ... } —
//     backfill a closed shift. Created as draft.

const ClockInBody = z.object({
  mode: z.literal("clock-in"),
  projectId: z.string().uuid(),
  taskLabel: z.string().max(160).nullable().optional(),
  taskCode: z.string().max(40).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  locationLat: z.number().min(-90).max(90).nullable().optional(),
  locationLng: z.number().min(-180).max(180).nullable().optional(),
  clientUuid: z.string().uuid().nullable().optional(),
});

const ManualBody = z.object({
  mode: z.literal("manual"),
  projectId: z.string().uuid(),
  taskLabel: z.string().max(160).nullable().optional(),
  taskCode: z.string().max(40).nullable().optional(),
  clockInAt: z.string().datetime(),
  clockOutAt: z.string().datetime(),
  notes: z.string().max(2000).nullable().optional(),
  reason: z.string().min(1).max(500),
});

const Body = z.discriminatedUnion("mode", [ClockInBody, ManualBody]);

export async function POST(req: Request) {
  try {
    const { session } = await requireServerSession();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    if (parsed.data.mode === "clock-in") {
      const r = await clockIn({
        session,
        projectId: parsed.data.projectId,
        taskLabel: parsed.data.taskLabel,
        taskCode: parsed.data.taskCode,
        notes: parsed.data.notes,
        locationLat: parsed.data.locationLat,
        locationLng: parsed.data.locationLng,
        clientUuid: parsed.data.clientUuid,
      });
      return NextResponse.json({ id: r.id });
    }
    const r = await manualEntry({
      session,
      projectId: parsed.data.projectId,
      taskLabel: parsed.data.taskLabel,
      taskCode: parsed.data.taskCode,
      clockInAt: new Date(parsed.data.clockInAt),
      clockOutAt: new Date(parsed.data.clockOutAt),
      notes: parsed.data.notes,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ id: r.id });
  } catch (err) {
    return mapError(err);
  }
}

function mapError(err: unknown) {
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
  if (err instanceof ProjectAccessError) {
    return NextResponse.json(
      { error: "project_not_accessible", message: err.message },
      { status: 403 },
    );
  }
  if (err instanceof OverlapError) {
    return NextResponse.json(
      { error: "overlap", message: err.message },
      { status: 409 },
    );
  }
  if (err instanceof StateError) {
    return NextResponse.json(
      { error: "state_error", message: err.message },
      { status: 409 },
    );
  }
  throw err;
}

export { mapError };
