import { NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import {
  createPhotoPin,
  PinAccessError,
  PinValidationError,
} from "@/domain/actions/photo-pins";
import { AuthorizationError } from "@/domain/permissions";

const Body = z.object({
  sheetId: z.string().uuid(),
  documentId: z.string().uuid(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  note: z.string().max(500).nullable().optional(),
});

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
    const r = await createPhotoPin({ session, ...parsed.data });
    return NextResponse.json({ id: r.id });
  } catch (err) {
    return mapError(err);
  }
}

export function mapError(err: unknown) {
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
  if (err instanceof PinAccessError) {
    return NextResponse.json(
      { error: "pin_access", message: err.message },
      { status: 403 },
    );
  }
  if (err instanceof PinValidationError) {
    return NextResponse.json(
      { error: "validation", message: err.message },
      { status: 400 },
    );
  }
  throw err;
}
