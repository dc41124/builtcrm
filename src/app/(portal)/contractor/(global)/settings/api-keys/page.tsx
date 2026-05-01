import { redirect } from "next/navigation";
import { desc, eq, inArray } from "drizzle-orm";

import { getServerSession } from "@/auth/session";
import { dbAdmin } from "@/db/admin-pool";
import { withTenant } from "@/db/with-tenant";
import { apiKeys, auditEvents, users } from "@/db/schema";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { AuthorizationError } from "@/domain/permissions";

import { ApiKeysUI, type ApiKeyRow, type AuditRow } from "./ui";

// Step 58 — API key management page (loader half).
//
// Two queries:
//   1. All keys for this org (active + revoked, with createdBy/revokedBy
//      display names resolved).
//   2. Most-recent api_key.* audit events (created / revoked / used)
//      for the "Recent activity" feed at the bottom of the page.
//
// Auth gate: getContractorOrgContext rejects subs/clients/non-contractors.
// Inside the page, ctx.role is passed through so the UI can hide the
// "Create" button for non-admins (PMs see read-only; admins create + revoke).

export const dynamic = "force-dynamic";

export default async function ContractorApiKeysPage() {
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");

  try {
    const ctx = await getContractorOrgContext(sessionData.session);

    const [keyRows, auditRows] = await Promise.all([
      withTenant(ctx.organization.id, (tx) =>
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
            revokeReason: apiKeys.revokeReason,
            rateLimitPerMinute: apiKeys.rateLimitPerMinute,
            rateLimitPerHour: apiKeys.rateLimitPerHour,
          })
          .from(apiKeys)
          .where(eq(apiKeys.orgId, ctx.organization.id))
          .orderBy(desc(apiKeys.createdAt)),
      ),
      // Audit events for api_key.* — limit to 10 most recent, used to
      // populate the "Recent activity" panel. Read via dbAdmin since
      // audit_events doesn't have a tenant-scoped RLS policy that lets
      // read filter on org_id without a per-row session-var dance.
      dbAdmin
        .select({
          id: auditEvents.id,
          createdAt: auditEvents.createdAt,
          actorUserId: auditEvents.actorUserId,
          actionName: auditEvents.actionName,
          objectId: auditEvents.objectId,
          metadataJson: auditEvents.metadataJson,
        })
        .from(auditEvents)
        .where(eq(auditEvents.organizationId, ctx.organization.id))
        .orderBy(desc(auditEvents.createdAt))
        .limit(50),
    ]);

    // Filter to api_key events only (the predicate ahead doesn't have
    // a clean SQL form across versions; do it here).
    const apiKeyEvents = auditRows
      .filter((r) => r.actionName.startsWith("api_key."))
      .slice(0, 10);

    // Resolve display names for every user referenced in either result.
    const allUserIds = Array.from(
      new Set(
        [
          ...keyRows.map((k) => k.createdByUserId),
          ...keyRows
            .map((k) => k.revokedByUserId)
            .filter((id): id is string => !!id),
          ...apiKeyEvents.map((e) => e.actorUserId),
        ].filter((id): id is string => !!id),
      ),
    );
    const userRows =
      allUserIds.length === 0
        ? []
        : await dbAdmin
            .select({
              id: users.id,
              displayName: users.displayName,
              firstName: users.firstName,
              lastName: users.lastName,
              email: users.email,
            })
            .from(users)
            .where(inArray(users.id, allUserIds));
    const userById = new Map<
      string,
      { name: string; initials: string }
    >();
    for (const u of userRows) {
      const composed = [u.firstName, u.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const name = u.displayName ?? composed ?? u.email;
      const initials = (u.firstName?.[0] ?? u.email[0] ?? "?").toUpperCase() +
        (u.lastName?.[0] ?? "").toUpperCase();
      userById.set(u.id, { name, initials: initials.slice(0, 2) });
    }
    const lookupUser = (id: string | null) =>
      id ? (userById.get(id) ?? { name: "Unknown", initials: "?" }) : null;

    const keys: ApiKeyRow[] = keyRows.map((k) => {
      const created = lookupUser(k.createdByUserId)!;
      const revoked = lookupUser(k.revokedByUserId);
      return {
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes as ("read" | "write" | "admin")[],
        createdByName: created.name,
        createdByInitials: created.initials,
        createdAtIso: k.createdAt.toISOString(),
        lastUsedAtIso: k.lastUsedAt?.toISOString() ?? null,
        revokedAtIso: k.revokedAt?.toISOString() ?? null,
        revokedByName: revoked?.name ?? null,
        revokeReason: k.revokeReason,
        rateLimitPerMinute: k.rateLimitPerMinute,
        rateLimitPerHour: k.rateLimitPerHour,
      };
    });

    const audit: AuditRow[] = apiKeyEvents.map((e) => {
      const actor = lookupUser(e.actorUserId);
      const meta = e.metadataJson as
        | { name?: string; keyPrefix?: string; scopes?: string[]; reason?: string | null; rotatedFromKeyId?: string }
        | null;
      const kindRaw = e.actionName.replace(/^api_key\./, "");
      const kind: AuditRow["kind"] =
        kindRaw === "created" || kindRaw === "revoked" || kindRaw === "used"
          ? kindRaw
          : "used";
      return {
        id: e.id,
        kind,
        createdAtIso: e.createdAt.toISOString(),
        actorName: actor?.name ?? "Unknown",
        actorInitials: actor?.initials ?? "?",
        keyName: meta?.name ?? null,
        keyPrefix: meta?.keyPrefix ?? null,
        scopes: meta?.scopes ?? null,
        reason: meta?.reason ?? null,
      };
    });

    return (
      <ApiKeysUI
        orgName={ctx.organization.name}
        viewerRole={ctx.role}
        keys={keys}
        audit={audit}
      />
    );
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div style={{ padding: 24 }}>
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }
}
