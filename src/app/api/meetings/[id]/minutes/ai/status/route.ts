import { NextResponse } from "next/server";
import { runs } from "@trigger.dev/sdk/v3";
import { eq } from "drizzle-orm";

import { requireServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { meetings } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// GET /api/meetings/:id/minutes/ai/status?runId=...
//
// Returns the Trigger.dev run status for the meeting-minutes-ai task.
// The UI polls this every 3s while a run is in flight; the client
// refetches the meeting detail when status flips to COMPLETED.

const TERMINAL_STATUSES = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELED",
  "TIMED_OUT",
  "CRASHED",
  "INTERRUPTED",
  "SYSTEM_FAILURE",
  "EXPIRED",
]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const url = new URL(req.url);
  const runId = url.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "missing_run_id" }, { status: 400 });
  }

  try {
    const [head] = await dbAdmin
      .select({ id: meetings.id, projectId: meetings.projectId })
      .from(meetings)
      .where(eq(meetings.id, id))
      .limit(1);
    if (!head) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const ctx = await getEffectiveContext(session, head.projectId);
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "Only contractors can view transcription status",
        "forbidden",
      );
    }

    const run = await runs.retrieve(runId);

    return NextResponse.json({
      runId: run.id,
      status: run.status,
      isTerminal: TERMINAL_STATUSES.has(run.status),
      error: run.error?.message ?? null,
    });
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
