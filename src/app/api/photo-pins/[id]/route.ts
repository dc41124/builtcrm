import { NextResponse } from "next/server";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { deletePhotoPin, movePhotoPin } from "@/domain/actions/photo-pins";

import { mapError } from "../route";

const PatchBody = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  note: z.string().max(500).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session } = await requireServerSession();
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_body", issues: parsed.error.issues },
        { status: 400 },
      );
    }
    await movePhotoPin({ session, id, ...parsed.data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err);
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { session } = await requireServerSession();
    await deletePhotoPin({ session, id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err);
  }
}
