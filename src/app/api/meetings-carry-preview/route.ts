import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import {
  getCarryForwardPreview,
  type MeetingType,
} from "@/domain/loaders/meetings";
import { AuthorizationError } from "@/domain/permissions";

// GET /api/meetings-carry-preview?projectId=…&type=… — live feed for the
// Create Meeting modal so the contractor sees exactly how many items
// will be carried forward before committing. Wraps the same loader the
// server-side create path uses, so the hint can't drift from reality.

const QuerySchema = z.object({
  projectId: z.string().uuid(),
  type: z.enum([
    "oac",
    "preconstruction",
    "coordination",
    "progress",
    "safety",
    "closeout",
    "internal",
  ]),
});

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    projectId: url.searchParams.get("projectId") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_query", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const preview = await getCarryForwardPreview({
      session: session.session as unknown as { appUserId?: string | null },
      projectId: parsed.data.projectId,
      type: parsed.data.type as MeetingType,
    });
    return NextResponse.json(preview);
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
