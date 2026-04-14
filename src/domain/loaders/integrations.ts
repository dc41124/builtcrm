import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import {
  integrationConnections,
  organizations,
  projects,
  roleAssignments,
  syncEvents,
  users,
} from "@/db/schema";

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

export type IntegrationProviderKey =
  | "quickbooks_online"
  | "xero"
  | "sage_business_cloud"
  | "stripe"
  | "google_calendar"
  | "outlook_365"
  | "postmark"
  | "sendgrid";

export type IntegrationCategory =
  | "accounting"
  | "payments"
  | "calendar"
  | "email";

export type PlanTier = "starter" | "professional" | "enterprise";

export type ProviderCatalogEntry = {
  provider: IntegrationProviderKey;
  name: string;
  category: IntegrationCategory;
  description: string;
  minTier: PlanTier;
  phase1: boolean; // true when the integration is implemented in Phase 1
};

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    provider: "postmark",
    name: "Postmark Email",
    category: "email",
    description:
      "Outbound notifications and reply-by-email for conversations, RFIs, approvals, and draws.",
    minTier: "starter",
    phase1: true,
  },
  {
    provider: "sendgrid",
    name: "SendGrid Email",
    category: "email",
    description: "Alternative transactional email provider.",
    minTier: "starter",
    phase1: true,
  },
  {
    provider: "quickbooks_online",
    name: "QuickBooks Online",
    category: "accounting",
    description:
      "Push approved draws as invoices, pull payment status, reconcile retainage.",
    minTier: "professional",
    phase1: false,
  },
  {
    provider: "xero",
    name: "Xero",
    category: "accounting",
    description:
      "Bidirectional invoice and payment sync with Xero accounting.",
    minTier: "professional",
    phase1: false,
  },
  {
    provider: "sage_business_cloud",
    name: "Sage Business Cloud",
    category: "accounting",
    description: "Sage accounting connector with scheduled reconciliation.",
    minTier: "professional",
    phase1: false,
  },
  {
    provider: "stripe",
    name: "Stripe Connect",
    category: "payments",
    description:
      "ACH and card payments routed to your connected Stripe account.",
    minTier: "professional",
    phase1: false,
  },
  {
    provider: "google_calendar",
    name: "Google Calendar",
    category: "calendar",
    description:
      "Push milestones and inspections directly to a Google Calendar.",
    minTier: "enterprise",
    phase1: false,
  },
  {
    provider: "outlook_365",
    name: "Outlook / Microsoft 365",
    category: "calendar",
    description: "Push milestones to Outlook calendars via Microsoft Graph.",
    minTier: "enterprise",
    phase1: false,
  },
];

// ---- Loader -------------------------------------------------------------

export type IntegrationConnectionRow = {
  id: string;
  provider: IntegrationProviderKey;
  status:
    | "connecting"
    | "connected"
    | "needs_reauth"
    | "error"
    | "disconnected";
  externalAccountName: string | null;
  connectedAt: Date | null;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastErrorMessage: string | null;
  consecutiveErrors: number;
  syncPreferences: Record<string, unknown> | null;
};

export type IntegrationCardRow = ProviderCatalogEntry & {
  connection: IntegrationConnectionRow | null;
};

export type SyncEventRow = {
  id: string;
  provider: IntegrationProviderKey | null;
  syncDirection: "push" | "pull" | "reconciliation";
  syncEventStatus: string;
  entityType: string | null;
  summary: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

export type ContractorIntegrationsView = {
  context: ContractorOrgContext;
  cards: IntegrationCardRow[];
  recentSyncEvents: SyncEventRow[];
  exportableEntities: { key: string; label: string }[];
};

export async function getContractorIntegrationsView(input: {
  session: SessionLike | null | undefined;
}): Promise<ContractorIntegrationsView> {
  const context = await getContractorOrgContext(input.session);

  const connectionRows = await db
    .select({
      id: integrationConnections.id,
      provider: integrationConnections.provider,
      status: integrationConnections.connectionStatus,
      externalAccountName: integrationConnections.externalAccountName,
      connectedAt: integrationConnections.connectedAt,
      lastSyncAt: integrationConnections.lastSyncAt,
      lastSyncStatus: integrationConnections.lastSyncStatus,
      lastErrorMessage: integrationConnections.lastErrorMessage,
      consecutiveErrors: integrationConnections.consecutiveErrors,
      syncPreferences: integrationConnections.syncPreferences,
    })
    .from(integrationConnections)
    .where(eq(integrationConnections.organizationId, context.organization.id));

  const byProvider = new Map<IntegrationProviderKey, IntegrationConnectionRow>();
  for (const c of connectionRows) {
    // Show the most recently touched non-disconnected row, falling back to
    // disconnected if that's all we have.
    const existing = byProvider.get(c.provider as IntegrationProviderKey);
    if (
      !existing ||
      (existing.status === "disconnected" && c.status !== "disconnected")
    ) {
      byProvider.set(c.provider as IntegrationProviderKey, {
        id: c.id,
        provider: c.provider as IntegrationProviderKey,
        status: c.status,
        externalAccountName: c.externalAccountName,
        connectedAt: c.connectedAt,
        lastSyncAt: c.lastSyncAt,
        lastSyncStatus: c.lastSyncStatus,
        lastErrorMessage: c.lastErrorMessage,
        consecutiveErrors: c.consecutiveErrors,
        syncPreferences: c.syncPreferences,
      });
    }
  }

  const cards: IntegrationCardRow[] = PROVIDER_CATALOG.map((entry) => ({
    ...entry,
    connection: byProvider.get(entry.provider) ?? null,
  }));

  const eventRows = await db
    .select({
      id: syncEvents.id,
      provider: integrationConnections.provider,
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
    .limit(25);

  return {
    context,
    cards,
    recentSyncEvents: eventRows.map((r) => ({
      id: r.id,
      provider: r.provider as IntegrationProviderKey | null,
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
  };
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
