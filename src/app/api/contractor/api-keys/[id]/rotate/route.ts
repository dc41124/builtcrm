import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { requireServerSession } from "@/auth/session";
import { withTenant } from "@/db/with-tenant";
import { apiKeys } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { generateApiKey } from "@/lib/api-keys/hash";

// POST /api/contractor/api-keys/[id]/rotate — atomic revoke + create.
// Spec: "Rotation = revoke + create new." Same name + scopes carry
// forward; only the secret changes. Both writes happen in one
// transaction so a partial failure leaves the org with the original
// key intact.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();

  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        ctx.role === "contractor_pm"
          ? "Only contractor admins can rotate API keys."
          : "API keys are a contractor-only feature.",
        "forbidden",
      );
    }

    const result = await withTenant(ctx.organization.id, async (tx) => {
      const [original] = await tx
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
        })
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.id, id),
            eq(apiKeys.orgId, ctx.organization.id),
            isNull(apiKeys.revokedAt),
          ),
        )
        .limit(1);
      if (!original) return null;

      // Revoke the old.
      await tx
        .update(apiKeys)
        .set({
          revokedAt: new Date(),
          revokedByUserId: ctx.user.id,
          revokeReason: "Rotated",
        })
        .where(eq(apiKeys.id, id));
      await writeOrgAuditEvent(
        ctx,
        {
          action: "api_key.revoked",
          resourceType: "api_key",
          resourceId: id,
          details: {
            metadata: {
              name: original.name,
              keyPrefix: original.keyPrefix,
              reason: "Rotated",
            },
          },
        },
        tx,
      );

      // Mint the new.
      const generated = generateApiKey();
      const [created] = await tx
        .insert(apiKeys)
        .values({
          orgId: ctx.organization.id,
          name: original.name,
          keyPrefix: generated.keyPrefix,
          keyHash: generated.keyHash,
          scopes: original.scopes,
          createdByUserId: ctx.user.id,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
          createdAt: apiKeys.createdAt,
        });
      await writeOrgAuditEvent(
        ctx,
        {
          action: "api_key.created",
          resourceType: "api_key",
          resourceId: created.id,
          details: {
            metadata: {
              name: created.name,
              keyPrefix: created.keyPrefix,
              scopes: original.scopes,
              rotatedFromKeyId: id,
            },
          },
        },
        tx,
      );
      return { created, fullKey: generated.fullKey };
    });

    if (!result) {
      return NextResponse.json(
        { error: "not_found_or_already_revoked" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { key: result.created, fullKey: result.fullKey },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      const code =
        err.code === "unauthenticated"
          ? 401
          : err.code === "not_found"
            ? 404
            : 403;
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: code },
      );
    }
    throw err;
  }
}
