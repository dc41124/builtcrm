import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth/config";
import { getEffectiveContext } from "@/domain/context";
import { AuthorizationError, assertCan } from "@/domain/permissions";
import { buildStorageKey, presignUploadUrl } from "@/lib/storage";

const BodySchema = z.object({
  projectId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  documentType: z.string().min(1).max(120).default("general"),
});

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const ctx = await getEffectiveContext(
      session.session as unknown as { appUserId?: string | null },
      parsed.data.projectId,
    );
    assertCan(ctx.permissions, "document", "write");

    const storageKey = buildStorageKey({
      orgId: ctx.project.contractorOrganizationId,
      projectId: ctx.project.id,
      documentType: parsed.data.documentType,
      filename: parsed.data.filename,
    });

    const uploadUrl = await presignUploadUrl({
      key: storageKey,
      contentType: parsed.data.contentType,
    });

    return NextResponse.json({
      uploadUrl,
      storageKey,
      method: "PUT",
      headers: { "Content-Type": parsed.data.contentType },
      expiresInSeconds: 300,
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
