import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { getDocumentPins } from "@/domain/loaders/photo-pins";
import { AuthorizationError } from "@/domain/permissions";

// GET /api/documents/[id]/photo-pins
// Returns every drawing sheet this document is pinned on, with the
// fractional coords + the parent set id so the photo-detail "Pinned on"
// rail can deep-link back into the drawing viewer.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session } = await requireServerSession();
    const view = await getDocumentPins({ session, documentId: id });
    return NextResponse.json({ pins: view.pins });
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
