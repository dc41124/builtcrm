import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireServerSession } from "@/auth/session";
import { withTenant } from "@/db/with-tenant";
import { apiKeys } from "@/db/schema";
import { writeOrgAuditEvent } from "@/domain/audit";
import { getOrgContext } from "@/domain/context";
import { AuthorizationError } from "@/domain/permissions";
import { generateApiKey } from "@/lib/api-keys/hash";

// Step 58 — API key CRUD (list + create).
//
// Contractor admin only. PMs can list (read-only) but cannot create —
// API keys grant programmatic write access scoped at the org tier,
// which is an admin concern. See route guards below.

const ScopesSchema = z
  .array(z.enum(["read", "write", "admin"]))
  .min(1)
  .max(3);

const CreateBodySchema = z.object({
  name: z.string().min(1).max(200),
  scopes: ScopesSchema,
});

// GET /api/contractor/api-keys — list all keys for the active org.
// Both contractor_admin and contractor_pm can read the list; only
// admins can mutate. Subs and clients are rejected.
export async function GET() {
  const { session } = await requireServerSession();
  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin" && ctx.role !== "contractor_pm") {
      throw new AuthorizationError(
        "API keys are a contractor-only feature.",
        "forbidden",
      );
    }
    const rows = await withTenant(ctx.organization.id, (tx) =>
      tx
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          scopes: apiKeys.scopes,
          createdByUserId: apiKeys.createdByUserId,
          createdAt: apiKeys.createdAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
          revokedByUserId: apiKeys.revokedByUserId,
        })
        .from(apiKeys)
        .where(eq(apiKeys.orgId, ctx.organization.id))
        .orderBy(apiKeys.createdAt),
    );
    return NextResponse.json({ keys: rows });
  } catch (err) {
    return handleError(err);
  }
}

// POST /api/contractor/api-keys — generate a new key. Returns the
// full key exactly once.
export async function POST(req: Request) {
  const { session } = await requireServerSession();
  const parsed = CreateBodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { name, scopes } = parsed.data;

  try {
    const ctx = await getOrgContext(session);
    if (ctx.role !== "contractor_admin") {
      throw new AuthorizationError(
        ctx.role === "contractor_pm"
          ? "Only contractor admins can create API keys."
          : "API keys are a contractor-only feature.",
        "forbidden",
      );
    }

    const generated = generateApiKey();

    const [inserted] = await withTenant(ctx.organization.id, async (tx) => {
      const [row] = await tx
        .insert(apiKeys)
        .values({
          orgId: ctx.organization.id,
          name: name.trim(),
          keyPrefix: generated.keyPrefix,
          keyHash: generated.keyHash,
          scopes,
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
          resourceId: row.id,
          details: {
            metadata: {
              name: row.name,
              keyPrefix: row.keyPrefix,
              scopes,
            },
          },
        },
        tx,
      );
      return [row];
    });

    return NextResponse.json(
      {
        key: inserted,
        // ONE-TIME ONLY: the full key is never persisted, so the
        // create-modal must surface it here. Subsequent fetches only
        // see the prefix.
        fullKey: generated.fullKey,
      },
      { status: 201 },
    );
  } catch (err) {
    return handleError(err);
  }
}

function handleError(err: unknown) {
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

