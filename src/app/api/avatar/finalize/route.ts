import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { users } from "@/db/schema";
import { objectExists, getObjectSize, presignDownloadUrl } from "@/lib/storage";

const BodySchema = z.object({
  storageKey: z
    .string()
    .regex(/^avatars\/[a-f0-9-]{36}\/\d+_.+$/i, "Invalid storage key shape"),
});

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const appUserId = (session)
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

  // Enforce the storage key belongs to this user.
  const expectedPrefix = `avatars/${appUserId}/`;
  if (!parsed.data.storageKey.startsWith(expectedPrefix)) {
    return NextResponse.json(
      { error: "forbidden", message: "Storage key does not belong to this user" },
      { status: 403 },
    );
  }

  // Verify the object actually landed in R2.
  const exists = await objectExists(parsed.data.storageKey);
  if (!exists) {
    return NextResponse.json(
      { error: "not_uploaded", message: "Upload not completed" },
      { status: 404 },
    );
  }

  const size = await getObjectSize(parsed.data.storageKey);
  if (size != null && size > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      {
        error: "too_large",
        message: `Avatar exceeds ${MAX_AVATAR_BYTES / 1024 / 1024}MB limit`,
      },
      { status: 413 },
    );
  }

  // Store the storage key (not the presigned URL — those expire). The UI
  // requests a fresh download URL via `GET /api/avatar` when rendering.
  await db
    .update(users)
    .set({ avatarUrl: parsed.data.storageKey })
    .where(eq(users.id, appUserId));

  // Return a short-lived signed URL for the UI to display immediately.
  const previewUrl = await presignDownloadUrl({
    key: parsed.data.storageKey,
    expiresInSeconds: 60 * 60, // 1 hour
  });

  return NextResponse.json({ ok: true, storageKey: parsed.data.storageKey, previewUrl });
}

// DELETE removes the avatar reference from the user record (but doesn't
// delete from R2 — orphan cleanup is a later concern).
export async function DELETE() {
  const { session } = await requireServerSession();
  const appUserId = (session)
    .appUserId;
  if (!appUserId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  await db
    .update(users)
    .set({ avatarUrl: null })
    .where(eq(users.id, appUserId));

  return NextResponse.json({ ok: true });
}
