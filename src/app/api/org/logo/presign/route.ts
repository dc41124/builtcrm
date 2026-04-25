import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { z } from "zod";

import { presignUploadUrl } from "@/lib/storage";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { getSubcontractorOrgContext } from "@/domain/loaders/subcontractor-compliance";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z
    .string()
    .regex(
      /^image\/(png|jpeg|jpg|webp|svg\+xml)$/i,
      "Only PNG, JPEG, WEBP, or SVG images are allowed",
    ),
});

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

async function resolveAdminOrg(sessionShim: { appUserId?: string | null }) {
  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") throw new AuthorizationError("Forbidden", "forbidden");
    return ctx.organization.id;
  } catch (err) {
    if (!(err instanceof AuthorizationError)) throw err;
    const ctx = await getSubcontractorOrgContext(sessionShim);
    if (ctx.role !== "subcontractor_owner") throw new AuthorizationError("Forbidden", "forbidden");
    return ctx.organization.id;
  }
}

export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const sessionShim = session;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const orgId = await resolveAdminOrg(sessionShim);
    const safeName = parsed.data.filename.replace(/[\\/]/g, "_").trim();
    const storageKey = `org-logos/${orgId}/${Date.now()}_${safeName}`;

    const uploadUrl = await presignUploadUrl({
      key: storageKey,
      contentType: parsed.data.contentType,
      expiresInSeconds: 5 * 60,
    });

    return NextResponse.json({
      uploadUrl,
      storageKey,
      maxBytes: MAX_LOGO_BYTES,
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
