import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  integrationConnections,
  organizations,
  projects,
  roleAssignments,
  syncEvents,
  users,
} from "@/db/schema";
import { withTenant } from "@/db/with-tenant";

import { AuthorizationError } from "../permissions";
import type { SessionLike } from "../context";

// ---- Org-scoped contractor context (settings pages don't have a project) ----

export type ContractorOrgContext = {
  user: { id: string; email: string; displayName: string | null };
  organization: { id: string; name: string };
  role: "contractor_admin" | "contractor_pm";
};

export async function getContractorOrgContext(
  session: SessionLike | null | undefined,
): Promise<ContractorOrgContext> {
  if (!session?.appUserId) {
    throw new AuthorizationError("Not signed in", "unauthenticated");
  }
  const appUserId = session.appUserId;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, appUserId))
    .limit(1);
  if (!user || !user.isActive) {
    throw new AuthorizationError("User not found or inactive", "unauthenticated");
  }

  const [assignment] = await db
    .select({
      organizationId: roleAssignments.organizationId,
      roleKey: roleAssignments.roleKey,
      organizationName: organizations.name,
    })
    .from(roleAssignments)
    .innerJoin(
      organizations,
      eq(organizations.id, roleAssignments.organizationId),
    )
    .where(
      and(
        eq(roleAssignments.userId, appUserId),
        eq(roleAssignments.portalType, "contractor"),
      ),
    )
    .limit(1);
  if (!assignment) {
    throw new AuthorizationError(
      "No contractor organization for this user",
      "forbidden",
    );
  }

  const role: "contractor_admin" | "contractor_pm" = /admin|owner/i.test(
    assignment.roleKey,
  )
    ? "contractor_admin"
    : "contractor_pm";

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    },
    organization: {
      id: assignment.organizationId,
      name: assignment.organizationName,
    },
    role,
  };
}

// ---- Provider catalog ---------------------------------------------------
//
// Step 29 refactor (plan A): the authoritative provider registry lives at
// `src/lib/integrations/registry.ts` and is composed from per-provider
// files under `src/lib/integrations/providers/`. This module re-exports
// the shared types so existing imports like
// `{ IntegrationProviderKey, ProviderCatalogEntry } from "@/domain/loaders/integrations"`
// keep compiling unchanged.
//
// The loader itself iterates over `allProviders()` rather than maintaining
// its own array. `PROVIDER_CATALOG` is no longer exported — callers that
// need the full list go through `allProviders()` from the registry;
// callers that look up a single provider use `getProviderConfig(key)`.
// `ProviderCatalogEntry` stays as an alias for `ProviderConfig` so UI
// code that references the older name keeps working.

import { allProviders } from "@/lib/integrations/registry";

import type {
  IntegrationCategory,
  IntegrationFlow,
  IntegrationProviderKey,
  OAuth2Config,
  OAuth2TokenResponse,
  PayloadExtractor,
  PayloadIdentity,
  PlanTier,
  ProviderCatalogEntry,
  ProviderConfig,
  WebhookSignatureScheme,
  WebhooksConfig,
} from "@/lib/integrations/types";

export type {
  IntegrationCategory,
  IntegrationFlow,
  IntegrationProviderKey,
  OAuth2Config,
  OAuth2TokenResponse,
  PayloadExtractor,
  PayloadIdentity,
  PlanTier,
  ProviderCatalogEntry,
  ProviderConfig,
  WebhookSignatureScheme,
  WebhooksConfig,
};

// ---- Loader -------------------------------------------------------------

export type ProjectMapping = {
  projectId: string;
  externalCustomerId: string | null;
  externalCustomerName: string | null;
  externalJobId: string | null;
};

export type IntegrationConnectionRow = {
  id: string;
  provider: IntegrationProviderKey;
  status:
    | "connecting"
    | "connected"
    | "needs_reauth"
    | "error"
    | "disconnected";
  externalAccountId: string | null;
  externalAccountName: string | null;
  connectedAt: Date | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastErrorMessage: string | null;
  consecutiveErrors: number;
  // Expiry timestamp on the access token (for OAuth 2.0 providers) — the UI
  // derives a "Token expiring soon" warning when this is within 24 hours.
  // Null for providers without access-token expiry (postmark/sendgrid,
  // Stripe Connect) or while connecting.
  tokenExpiresAt: Date | null;
  syncPreferences: Record<string, unknown> | null;
  mappingConfig: Record<string, unknown> | null;
  projectMappings: ProjectMapping[];
  pushCount: number;
  pullCount: number;
  errorCount: number;
};

// Serializable subset of ProviderCatalogEntry for passing to Client Components.
// ProviderCatalogEntry's `oauth`/`webhooks` sub-objects contain server-only
// callbacks (e.g. `extractAccount`, `extractIdentity`) that React Server
// Components cannot serialize across the server/client boundary.
export type IntegrationCardCatalogFields = Pick<
  ProviderCatalogEntry,
  "provider" | "name" | "description" | "category" | "minTier" | "phase1" | "flow"
>;

export type IntegrationCardRow = IntegrationCardCatalogFields & {
  connection: IntegrationConnectionRow | null;
};

export type SyncEventRow = {
  id: string;
  provider: IntegrationProviderKey | null;
  connectionId: string;
  syncDirection: "push" | "pull" | "reconciliation";
  syncEventStatus: string;
  entityType: string | null;
  summary: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

export type OrgProject = {
  id: string;
  projectCode: string | null;
  name: string;
  clientSubtype: string | null;
  contractValueCents: number | null;
};

export type ContractorIntegrationsView = {
  context: ContractorOrgContext;
  cards: IntegrationCardRow[];
  recentSyncEvents: SyncEventRow[];
  exportableEntities: { key: string; label: string }[];
  projects: OrgProject[];
};

export async function getContractorIntegrationsView(input: {
  session: SessionLike | null | undefined;
}): Promise<ContractorIntegrationsView> {
  const context = await getContractorOrgContext(input.session);

  const connectionRows = await withTenant(context.organization.id, (tx) =>
    tx
      .select({
        id: integrationConnections.id,
        provider: integrationConnections.provider,
        status: integrationConnections.connectionStatus,
        externalAccountId: integrationConnections.externalAccountId,
        externalAccountName: integrationConnections.externalAccountName,
        connectedAt: integrationConnections.connectedAt,
        lastSyncAt: integrationConnections.lastSyncAt,
        lastSyncStatus: integrationConnections.lastSyncStatus,
        lastErrorMessage: integrationConnections.lastErrorMessage,
        consecutiveErrors: integrationConnections.consecutiveErrors,
        tokenExpiresAt: integrationConnections.tokenExpiresAt,
        syncPreferences: integrationConnections.syncPreferences,
        mappingConfig: integrationConnections.mappingConfig,
      })
      .from(integrationConnections)
      .where(eq(integrationConnections.organizationId, context.organization.id)),
  );

  // Aggregate sync-event counts per connection (pushes, pulls, errors).
  const countRows = await db
    .select({
      connectionId: syncEvents.integrationConnectionId,
      direction: syncEvents.syncDirection,
      status: syncEvents.syncEventStatus,
      total: sql<number>`count(*)::int`,
    })
    .from(syncEvents)
    .where(eq(syncEvents.organizationId, context.organization.id))
    .groupBy(
      syncEvents.integrationConnectionId,
      syncEvents.syncDirection,
      syncEvents.syncEventStatus,
    );

  const countsByConnection = new Map<
    string,
    { push: number; pull: number; errors: number }
  >();
  for (const r of countRows) {
    const bucket = countsByConnection.get(r.connectionId) ?? {
      push: 0,
      pull: 0,
      errors: 0,
    };
    if (r.direction === "push") bucket.push += r.total;
    if (r.direction === "pull") bucket.pull += r.total;
    if (r.status === "failed" || r.status === "mapping_error") {
      bucket.errors += r.total;
    }
    countsByConnection.set(r.connectionId, bucket);
  }

  const byProvider = new Map<IntegrationProviderKey, IntegrationConnectionRow>();
  for (const c of connectionRows) {
    // Show the most recently touched non-disconnected row, falling back to
    // disconnected if that's all we have.
    const existing = byProvider.get(c.provider as IntegrationProviderKey);
    if (
      !existing ||
      (existing.status === "disconnected" && c.status !== "disconnected")
    ) {
      const counts = countsByConnection.get(c.id) ?? {
        push: 0,
        pull: 0,
        errors: 0,
      };
      const projectMappings = extractProjectMappings(c.mappingConfig);
      byProvider.set(c.provider as IntegrationProviderKey, {
        id: c.id,
        provider: c.provider as IntegrationProviderKey,
        status: c.status,
        externalAccountId: c.externalAccountId,
        externalAccountName: c.externalAccountName,
        connectedAt: c.connectedAt,
        lastSyncAt: c.lastSyncAt,
        lastSyncStatus: c.lastSyncStatus,
        lastErrorMessage: c.lastErrorMessage,
        consecutiveErrors: c.consecutiveErrors,
        tokenExpiresAt: c.tokenExpiresAt,
        syncPreferences: c.syncPreferences,
        mappingConfig: c.mappingConfig,
        projectMappings,
        pushCount: counts.push,
        pullCount: counts.pull,
        errorCount: counts.errors,
      });
    }
  }

  const cards: IntegrationCardRow[] = allProviders().map((entry) => ({
    provider: entry.provider,
    name: entry.name,
    description: entry.description,
    category: entry.category,
    minTier: entry.minTier,
    phase1: entry.phase1,
    flow: entry.flow,
    connection: byProvider.get(entry.provider) ?? null,
  }));

  const eventRows = await db
    .select({
      id: syncEvents.id,
      provider: integrationConnections.provider,
      connectionId: syncEvents.integrationConnectionId,
      syncDirection: syncEvents.syncDirection,
      syncEventStatus: syncEvents.syncEventStatus,
      entityType: syncEvents.entityType,
      summary: syncEvents.summary,
      errorMessage: syncEvents.errorMessage,
      createdAt: syncEvents.createdAt,
    })
    .from(syncEvents)
    .innerJoin(
      integrationConnections,
      eq(integrationConnections.id, syncEvents.integrationConnectionId),
    )
    .where(eq(syncEvents.organizationId, context.organization.id))
    .orderBy(desc(syncEvents.createdAt))
    .limit(50);

  const projectRows = await db
    .select({
      id: projects.id,
      projectCode: projects.projectCode,
      name: projects.name,
      clientSubtype: projects.clientSubtype,
      contractValueCents: projects.contractValueCents,
    })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, context.organization.id))
    .orderBy(projects.name);

  return {
    context,
    cards,
    recentSyncEvents: eventRows.map((r) => ({
      id: r.id,
      provider: r.provider as IntegrationProviderKey | null,
      connectionId: r.connectionId,
      syncDirection: r.syncDirection,
      syncEventStatus: r.syncEventStatus,
      entityType: r.entityType,
      summary: r.summary,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt,
    })),
    exportableEntities: [
      { key: "projects", label: "Projects" },
      { key: "draw_requests", label: "Draw Requests" },
      { key: "rfis", label: "RFIs" },
      { key: "change_orders", label: "Change Orders" },
    ],
    projects: projectRows,
  };
}

function extractProjectMappings(
  mappingConfig: Record<string, unknown> | null,
): ProjectMapping[] {
  if (!mappingConfig) return [];
  const raw = mappingConfig["project_mappings"];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const projectId = typeof obj.project_id === "string" ? obj.project_id : null;
      if (!projectId) return null;
      return {
        projectId,
        externalCustomerId:
          typeof obj.external_customer_id === "string"
            ? obj.external_customer_id
            : null,
        externalCustomerName:
          typeof obj.external_customer_name === "string"
            ? obj.external_customer_name
            : null,
        externalJobId:
          typeof obj.external_job_id === "string"
            ? obj.external_job_id
            : null,
      };
    })
    .filter((m): m is ProjectMapping => m !== null);
}

// ---- CSV export helpers -------------------------------------------------

export type CsvExportEntity =
  | "projects"
  | "draw_requests"
  | "rfis"
  | "change_orders";

export function isCsvExportEntity(value: string): value is CsvExportEntity {
  return (
    value === "projects" ||
    value === "draw_requests" ||
    value === "rfis" ||
    value === "change_orders"
  );
}

export type CsvFile = { filename: string; content: string };

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(csvCell).join(",");
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  return body.length > 0 ? `${headerLine}\n${body}\n` : `${headerLine}\n`;
}

export async function buildCsvExport(input: {
  session: SessionLike | null | undefined;
  entity: CsvExportEntity;
}): Promise<CsvFile> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;

  if (input.entity === "projects") {
    const rows = await db
      .select({
        id: projects.id,
        code: projects.projectCode,
        name: projects.name,
        status: projects.projectStatus,
        contractValueCents: projects.contractValueCents,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .where(eq(projects.contractorOrganizationId, orgId));
    return {
      filename: "projects.csv",
      content: rowsToCsv(
        ["id", "code", "name", "status", "contract_value_cents", "created_at"],
        rows.map((r) => [
          r.id,
          r.code,
          r.name,
          r.status,
          r.contractValueCents,
          r.createdAt,
        ]),
      ),
    };
  }

  // For other entity types we scope by the org's projects.
  const orgProjects = await db
    .select({ id: projects.id, code: projects.projectCode })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));
  const projectIdSet = new Set(orgProjects.map((p) => p.id));
  const projectCodeById = new Map(orgProjects.map((p) => [p.id, p.code]));

  if (orgProjects.length === 0) {
    return {
      filename: `${input.entity}.csv`,
      content: rowsToCsv(["id"], []),
    };
  }

  if (input.entity === "draw_requests") {
    const { drawRequests } = await import("@/db/schema");
    const rows = await db
      .select({
        id: drawRequests.id,
        projectId: drawRequests.projectId,
        drawNumber: drawRequests.drawNumber,
        status: drawRequests.drawRequestStatus,
        currentPaymentDueCents: drawRequests.currentPaymentDueCents,
        periodFrom: drawRequests.periodFrom,
        periodTo: drawRequests.periodTo,
      })
      .from(drawRequests);
    const filtered = rows.filter((r) => projectIdSet.has(r.projectId));
    return {
      filename: "draw_requests.csv",
      content: rowsToCsv(
        [
          "id",
          "project_code",
          "draw_number",
          "status",
          "current_payment_due_cents",
          "period_from",
          "period_to",
        ],
        filtered.map((r) => [
          r.id,
          projectCodeById.get(r.projectId) ?? "",
          r.drawNumber,
          r.status,
          r.currentPaymentDueCents,
          r.periodFrom,
          r.periodTo,
        ]),
      ),
    };
  }

  if (input.entity === "rfis") {
    const { rfis } = await import("@/db/schema");
    const rows = await db
      .select({
        id: rfis.id,
        projectId: rfis.projectId,
        rfiNumber: rfis.sequentialNumber,
        subject: rfis.subject,
        status: rfis.rfiStatus,
        createdAt: rfis.createdAt,
      })
      .from(rfis);
    const filtered = rows.filter((r) => projectIdSet.has(r.projectId));
    return {
      filename: "rfis.csv",
      content: rowsToCsv(
        ["id", "project_code", "rfi_number", "subject", "status", "created_at"],
        filtered.map((r) => [
          r.id,
          projectCodeById.get(r.projectId) ?? "",
          r.rfiNumber,
          r.subject,
          r.status,
          r.createdAt,
        ]),
      ),
    };
  }

  // change_orders
  const { changeOrders } = await import("@/db/schema");
  const rows = await db
    .select({
      id: changeOrders.id,
      projectId: changeOrders.projectId,
      changeOrderNumber: changeOrders.changeOrderNumber,
      title: changeOrders.title,
      status: changeOrders.changeOrderStatus,
      amountCents: changeOrders.amountCents,
      createdAt: changeOrders.createdAt,
    })
    .from(changeOrders);
  const filtered = rows.filter((r) => projectIdSet.has(r.projectId));
  return {
    filename: "change_orders.csv",
    content: rowsToCsv(
      [
        "id",
        "project_code",
        "change_order_number",
        "title",
        "status",
        "amount_cents",
        "created_at",
      ],
      filtered.map((r) => [
        r.id,
        projectCodeById.get(r.projectId) ?? "",
        r.changeOrderNumber,
        r.title,
        r.status,
        r.amountCents,
        r.createdAt,
      ]),
    ),
  };
}
