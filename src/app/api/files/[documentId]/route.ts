import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getServerSession } from "@/auth/session";

import { dbAdmin } from "@/db/admin-pool";
import { documents } from "@/db/schema";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { presignDownloadUrl } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const sessionData = await getServerSession();
  if (!sessionData) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const { session } = sessionData;
  // Entry-point dbAdmin: tenant unknown until we resolve project from
  // the document row. getEffectiveContext below verifies project access.
  const [doc] = await dbAdmin
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const ctx = await getEffectiveContext(
      session,
      doc.projectId,
    );
    assertCan(ctx.permissions, "document", "read");

    const downloadUrl = await presignDownloadUrl({
      key: doc.storageKey,
      expiresInSeconds: 60,
    });

    return NextResponse.json({
      documentId: doc.id,
      title: doc.title,
      documentType: doc.documentType,
      downloadUrl,
      expiresInSeconds: 60,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const status =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    throw err;
  }
}
