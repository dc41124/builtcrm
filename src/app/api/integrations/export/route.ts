import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";

import {
  buildCsvExport,
  isCsvExportEntity,
} from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

export async function GET(req: Request) {
  const { session } = await requireServerSession();
  const url = new URL(req.url);
  const entity = url.searchParams.get("entity") ?? "projects";
  if (!isCsvExportEntity(entity)) {
    return NextResponse.json({ error: "unknown_entity" }, { status: 400 });
  }

  try {
    const file = await buildCsvExport({
      session: session,
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
