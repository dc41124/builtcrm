import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { presignUploadUrl } from "@/lib/storage";

const BodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z
    .string()
    .regex(/^image\/(png|jpeg|jpg|webp|gif)$/i, "Only PNG, JPEG, WEBP, or GIF images are allowed"),
});

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const appUserId = (session.session as unknown as { appUserId?: string | null })
    .appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const safeName = parsed.data.filename.replace(/[\\/]/g, "_").trim();
  const storageKey = `avatars/${appUserId}/${Date.now()}_${safeName}`;

  const uploadUrl = await presignUploadUrl({
    key: storageKey,
    contentType: parsed.data.contentType,
    expiresInSeconds: 5 * 60,
  });

  return NextResponse.json({
    uploadUrl,
    storageKey,
    maxBytes: MAX_AVATAR_BYTES,
  });
}
