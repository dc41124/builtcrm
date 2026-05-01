import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { listProjectPhotosForPicker } from "@/domain/loaders/photo-pins";
import { AuthorizationError } from "@/domain/permissions";

// GET /api/photo-pins/picker?projectId=<uuid>
// Returns active documents on the project for the "Pin photo" picker. The
// client does the photo/non-photo filter on storage_key extension since
// `documents` doesn't carry a discrete mime column.
export async function GET(req: Request) {
  try {
    const { session } = await requireServerSession();
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId");
    if (!projectId || !/^[0-9a-f-]{36}$/.test(projectId)) {
      return NextResponse.json(
        { error: "invalid_project_id" },
        { status: 400 },
      );
    }
    const documents = await listProjectPhotosForPicker({
      session,
      projectId,
    });
    return NextResponse.json({ documents });
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
