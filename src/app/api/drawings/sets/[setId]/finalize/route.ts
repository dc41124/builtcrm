// POST /api/drawings/sets/[setId]/finalize
//
// Client calls this after the direct-to-R2 upload completes. The route
// verifies the PDF is actually in R2 (object HEAD), runs the extraction
// pipeline inline (pdfjs text extraction → drawing_sheets rows), and
// flips the set to 'ready'. For very large PDFs we'll front this with a
// Trigger.dev task later; until then inline is fine — a 40-sheet PDF
// parses in a few seconds well within a serverless function budget.

import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { drawingSets } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import { assertCan, AuthorizationError } from "@/domain/permissions";
import { objectExists, getObjectSize } from "@/lib/storage";
import { processDrawingSet } from "@/lib/drawings/process";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ setId: string }> },
) {
  const { setId } = await params;
  const { session } = await requireServerSession();
  const [set] = await db
    .select()
    .from(drawingSets)
    .where(eq(drawingSets.id, setId))
    .limit(1);
  if (!set) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const ctx = await getEffectiveContext(
      session,
      set.projectId,
    );
    assertCan(ctx.permissions, "drawing", "write");

    if (!set.sourceFileKey) {
      return NextResponse.json(
        { error: "invalid_state", message: "set has no source file" },
        { status: 400 },
      );
    }

    const exists = await objectExists(set.sourceFileKey);
    if (!exists) {
      return NextResponse.json(
        {
          error: "upload_incomplete",
          message: "source PDF not found in storage — did the client upload complete?",
        },
        { status: 409 },
      );
    }

    // Refresh fileSizeBytes from storage — the client-reported number in
    // create is a hint; the real size is what actually landed in R2.
    const realSize = await getObjectSize(set.sourceFileKey);
    if (realSize !== null && realSize !== set.fileSizeBytes) {
      await db
        .update(drawingSets)
        .set({ fileSizeBytes: realSize })
        .where(eq(drawingSets.id, set.id));
    }

    const result = await processDrawingSet(set.id);

    return NextResponse.json({
      setId: set.id,
      processingStatus: "ready",
      sheetCount: result.sheetCount,
      autoDetectedCount: result.autoDetectedCount,
    });
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
