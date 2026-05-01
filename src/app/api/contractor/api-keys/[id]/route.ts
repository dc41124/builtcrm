import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { withTenant } from "@/db/with-tenant";
import { apiKeys } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";

// DELETE /api/contractor/api-keys/[id] — revoke a key. Sets
// revoked_at + revoked_by_user_id; the row stays for audit history.
// Subsequent requests with the key return 401 immediately because
// requireApiKey() filters on `revoked_at IS NULL`.

const RevokeBodySchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .optional();

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { session } = await requireServerSession();
  const body = await req
    .json()
    .catch(() => ({}));
  const parsedBody = RevokeBodySchema.safeParse(body);
  const reason = parsedBody.success ? parsedBody.data?.reason ?? null : null;

  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        ctx.role === "contractor_pm"
          ? "Only contractor admins can revoke API keys."
          : "API keys are a contractor-only feature.",
        "forbidden",
      );
    }

    const updated = await withTenant(ctx.organization.id, async (tx) => {
      // Match on (id, orgId, not-already-revoked) — RLS already
      // enforces the org filter, but the redundant predicate makes
      // the SQL self-documenting.
      const result = await tx
        .update(apiKeys)
        .set({
          revokedAt: new Date(),
          revokedByUserId: ctx.user.id,
          revokeReason: reason,
        })
        .where(
          and(
            eq(apiKeys.id, id),
            eq(apiKeys.orgId, ctx.organization.id),
            isNull(apiKeys.revokedAt),
          ),
        )
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
        });

      if (result.length === 0) return null;

      await writeOrgAuditEvent(
        ctx,
        {
          action: "api_key.revoked",
          resourceType: "api_key",
          resourceId: id,
          details: {
            metadata: {
              name: result[0].name,
              keyPrefix: result[0].keyPrefix,
              reason,
            },
          },
        },
        tx,
      );
      return result[0];
    });

    if (!updated) {
      return NextResponse.json(
        { error: "not_found_or_already_revoked" },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, revoked: updated });
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
