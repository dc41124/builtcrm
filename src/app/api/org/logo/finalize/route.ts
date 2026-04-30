import { NextResponse } from "next/server";

import { requireServerSession } from "@/auth/session";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { dbAdmin } from "@/db/admin-pool";
import { auditEvents, organizations } from "@/db/schema";
import { getObjectSize, objectExists, presignDownloadUrl } from "@/lib/storage";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { getSubcontractorOrgContext } from "@/domain/loaders/subcontractor-compliance";
import { AuthorizationError } from "@/domain/permissions";

const BodySchema = z.object({
  storageKey: z
    .string()
    .regex(/^org-logos\/[a-f0-9-]{36}\/\d+_.+$/i, "Invalid storage key shape"),
});

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

async function resolveAdminOrg(sessionShim: { appUserId?: string | null }) {
  try {
    const ctx = await getContractorOrgContext(sessionShim);
    if (ctx.role !== "contractor_admin") throw new AuthorizationError("Forbidden", "forbidden");
    return { orgId: ctx.organization.id, userId: ctx.user.id };
  } catch (err) {
    if (!(err instanceof AuthorizationError)) throw err;
    const ctx = await getSubcontractorOrgContext(sessionShim);
    if (ctx.role !== "subcontractor_owner") throw new AuthorizationError("Forbidden", "forbidden");
    return { orgId: ctx.organization.id, userId: ctx.user.id };
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
    const { orgId, userId } = await resolveAdminOrg(sessionShim);

    // Enforce the storage key belongs to this org (presign already scoped it,
    // but we verify again so a leaked key from another org can't be attached).
    const expectedPrefix = `org-logos/${orgId}/`;
    if (!parsed.data.storageKey.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "forbidden", message: "Storage key does not belong to this organization" },
        { status: 403 },
      );
    }

    const exists = await objectExists(parsed.data.storageKey);
    if (!exists) {
      return NextResponse.json(
        { error: "not_uploaded", message: "Upload not completed" },
        { status: 404 },
      );
    }

    const size = await getObjectSize(parsed.data.storageKey);
    if (size != null && size > MAX_LOGO_BYTES) {
      return NextResponse.json(
        {
          error: "too_large",
          message: `Logo exceeds ${MAX_LOGO_BYTES / 1024 / 1024}MB limit`,
        },
        { status: 413 },
      );
    }

    await dbAdmin.transaction(async (tx) => {
      await tx
        .update(organizations)
        .set({ logoStorageKey: parsed.data.storageKey })
        .where(eq(organizations.id, orgId));
      await tx.insert(auditEvents).values({
        actorUserId: userId,
        organizationId: orgId,
        objectType: "organization",
        objectId: orgId,
        actionName: "logo_uploaded",
        nextState: { logoStorageKey: parsed.data.storageKey },
      });
    });

    const previewUrl = await presignDownloadUrl({
      key: parsed.data.storageKey,
      expiresInSeconds: 60 * 60,
    });

    return NextResponse.json({
      ok: true,
      storageKey: parsed.data.storageKey,
      previewUrl,
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

// Clear the logo reference (doesn't delete the R2 object — orphan cleanup is a
// later concern, same as the avatar finalize path).
export async function DELETE() {
  const { session } = await requireServerSession();
  const sessionShim = session;

  try {
    const { orgId, userId } = await resolveAdminOrg(sessionShim);
    await dbAdmin.transaction(async (tx) => {
      await tx
        .update(organizations)
        .set({ logoStorageKey: null })
        .where(eq(organizations.id, orgId));
      await tx.insert(auditEvents).values({
        actorUserId: userId,
        organizationId: orgId,
        objectType: "organization",
        objectId: orgId,
        actionName: "logo_removed",
      });
    });
    return NextResponse.json({ ok: true });
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
