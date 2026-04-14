import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/auth/config";
import {
  buildCsvExport,
  isCsvExportEntity,
} from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(req.url);
  const entity = url.searchParams.get("entity") ?? "projects";
  if (!isCsvExportEntity(entity)) {
    return NextResponse.json({ error: "unknown_entity" }, { status: 400 });
  }

  try {
    const file = await buildCsvExport({
      session: session.session as unknown as { appUserId?: string | null },
      entity,
    });
    return new NextResponse(file.content, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
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
