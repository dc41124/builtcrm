import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth/config";
import {
  getPrequalDocumentDownloadUrl,
  removePrequalDocument,
} from "@/domain/prequal";
import { AuthorizationError } from "@/domain/permissions";

// GET /api/prequal/documents/[id] — returns a 5-minute presigned R2 URL.
// DELETE /api/prequal/documents/[id] — removes the document (sub side only,
//   while submission is still editable).

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    const result = await getPrequalDocumentDownloadUrl({
      session: session.session as unknown as { appUserId?: string | null },
      documentId: id,
    });
    return NextResponse.json(result);
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  try {
    await removePrequalDocument({
      session: session.session as unknown as { appUserId?: string | null },
      documentId: id,
    });
    return NextResponse.json({ ok: true });
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
