import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireServerSession } from "@/auth/session";
import { db } from "@/db/client";
import { auditEvents, organizations } from "@/db/schema";
import { resolveOrgEditContext } from "@/domain/loaders/resolve-org-context";
import { AuthorizationError } from "@/domain/permissions";
import { decryptTaxId } from "@/lib/integrations/crypto";
import { enforceLimit, taxIdRevealLimiter } from "@/lib/ratelimit";

// POST /api/org/tax-id/reveal
//
// Returns the plaintext organizations.tax_id for the caller's org.
// Audit-logged: every successful reveal writes a `tax_id.revealed`
// audit event (actor + timestamp; never the plaintext value itself).
// Per-IP rate-limited to defend against script-driven enumeration.
//
// Authorization: contractor_admin or subcontractor_owner. Same gate
// as the org-profile PATCH endpoint.
//
// See docs/specs/tax_id_encryption_plan.md.

export async function POST(req: Request) {
  const limit = await enforceLimit(taxIdRevealLimiter, req);
  if (!limit.ok) {
    const retryAfter = Math.max(
      1,
      Math.ceil((limit.reset - Date.now()) / 1000),
    );
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const { session } = await requireServerSession();

  try {
    const ctx = await resolveOrgEditContext(session);
    if (!ctx.isAdmin) {
      throw new AuthorizationError(
        "Only organization admins can reveal the tax ID",
        "forbidden",
      );
    }

    const [row] = await db
      .select({ taxId: organizations.taxId })
      .from(organizations)
      .where(eq(organizations.id, ctx.orgId))
      .limit(1);

    if (!row) {
      throw new AuthorizationError("Organization not found", "not_found");
    }

    if (!row.taxId) {
      // Nothing to reveal; don't write an audit event for an empty reveal.
      return NextResponse.json({ taxId: null });
    }

    // Decrypt-with-plaintext-fallback. A row that pre-dates the
    // encryption backfill (or any leftover plaintext) decrypts as
    // garbage / throws — return the stored value as-is. The fallback
    // is removed in the cleanup commit after the backfill confirms.
    let plaintext: string;
    try {
      plaintext = decryptTaxId(row.taxId);
    } catch {
      plaintext = row.taxId;
    }

    await db.insert(auditEvents).values({
      actorUserId: ctx.userId,
      organizationId: ctx.orgId,
      objectType: "organization",
      objectId: ctx.orgId,
      actionName: "tax_id.revealed",
      metadataJson: { revealedAt: new Date().toISOString() },
    });

    return NextResponse.json({ taxId: plaintext });
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
