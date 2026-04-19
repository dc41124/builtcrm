import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { auditEvents, integrationConnections } from "@/db/schema";

import { completeSyncEvent, startSyncEvent, SyncLogError } from "../sync-log";

// QuickBooks Online sync — STUBBED. Production sync against Intuit's
// Accounting API requires app review, which requires a registered business
// entity and a published marketplace app. Until that happens, this function
// writes a `sync_events` row with status='skipped' and `resultData.stubbed`
// = true, plus an `integration.sync.stubbed` audit event, and returns the
// would-send payload. No HTTP call hits Intuit.
//
// When production connector work starts, the body of `buildWouldSendPayload`
// becomes the real push mapper and `completeSyncEvent` transitions to
// status='succeeded' on POST to the Accounting API. The event row + audit
// scaffolding does not change.

const PROVIDER_KEY = "quickbooks_online" as const;

export type QuickBooksEntityType =
  | "invoice"
  | "payment"
  | "customer"
  | "reconciliation";

export type SyncToQuickBooksInput = {
  orgId: string;
  actorUserId: string;
  entityType: QuickBooksEntityType;
  entityId?: string;
};

export type SyncToQuickBooksResult = {
  eventId: string;
  stubbed: true;
  wouldSend: WouldSendPayload;
};

export type WouldSendPayload = {
  api: "intuit-quickbooks-online-accounting-v3";
  operation: "reconcile" | "push";
  entities: Array<{
    entityType: Exclude<QuickBooksEntityType, "reconciliation">;
    entityId: string | null;
    path: string;
    method: "POST" | "PUT";
    body: Record<string, unknown>;
  }>;
  note: string;
};

export async function syncToQuickBooks(
  input: SyncToQuickBooksInput,
): Promise<SyncToQuickBooksResult> {
  const [conn] = await db
    .select({
      id: integrationConnections.id,
      status: integrationConnections.connectionStatus,
    })
    .from(integrationConnections)
    .where(
      and(
        eq(integrationConnections.organizationId, input.orgId),
        eq(integrationConnections.provider, PROVIDER_KEY),
      ),
    )
    .orderBy(desc(integrationConnections.createdAt))
    .limit(1);
  if (!conn) {
    throw new SyncLogError(
      "no_connection",
      `No ${PROVIDER_KEY} connection on record for organization ${input.orgId}`,
    );
  }

  const wouldSend = buildWouldSendPayload(input);
  const direction =
    input.entityType === "reconciliation" ? "reconciliation" : "push";

  const { id: eventId } = await startSyncEvent({
    orgId: input.orgId,
    providerKey: PROVIDER_KEY,
    direction,
    entityType:
      input.entityType === "reconciliation" ? undefined : input.entityType,
    entityId: input.entityId,
    summary: "Stubbed — production sync requires Intuit app review",
  });

  await completeSyncEvent({
    id: eventId,
    status: "skipped",
    summary: "Stubbed — production sync requires Intuit app review",
    resultData: {
      stubbed: true,
      reason:
        "Production sync against Intuit requires app review. See README § Third-party integrations.",
      wouldSend,
    },
  });

  await db.insert(auditEvents).values({
    actorUserId: input.actorUserId,
    organizationId: input.orgId,
    objectType: "integration_connection",
    objectId: conn.id,
    actionName: "integration.sync.stubbed",
    metadataJson: {
      provider: PROVIDER_KEY,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      syncEventId: eventId,
    },
  });

  return { eventId, stubbed: true, wouldSend };
}

// Produces a plausible Intuit Accounting API payload for the requested
// entity. For a reconciliation call (no specific entity), emits one example
// per supported entity type so a developer can see the full surface. The
// IDs and amounts are placeholders — the real mapper will resolve them from
// the source objects (invoices table, payments table, org contacts).
function buildWouldSendPayload(input: SyncToQuickBooksInput): WouldSendPayload {
  if (input.entityType === "reconciliation") {
    return {
      api: "intuit-quickbooks-online-accounting-v3",
      operation: "reconcile",
      entities: [
        exampleFor("invoice", null),
        exampleFor("payment", null),
        exampleFor("customer", null),
      ],
      note: "Reconciliation pulls updated records since last successful sync. Stubbed — no HTTP call was made.",
    };
  }
  return {
    api: "intuit-quickbooks-online-accounting-v3",
    operation: "push",
    entities: [exampleFor(input.entityType, input.entityId ?? null)],
    note: "Push creates or updates the entity in the connected QuickBooks company. Stubbed — no HTTP call was made.",
  };
}

function exampleFor(
  entityType: Exclude<QuickBooksEntityType, "reconciliation">,
  entityId: string | null,
): WouldSendPayload["entities"][number] {
  const method: "POST" | "PUT" = entityId ? "PUT" : "POST";
  switch (entityType) {
    case "invoice":
      return {
        entityType,
        entityId,
        path: "/v3/company/{realmId}/invoice",
        method,
        body: {
          Id: entityId ?? undefined,
          Line: [
            {
              Amount: 0,
              DetailType: "SalesItemLineDetail",
              SalesItemLineDetail: { ItemRef: { value: "{itemId}" } },
            },
          ],
          CustomerRef: { value: "{qbCustomerId}" },
          DocNumber: "{builtcrm:invoiceNumber}",
        },
      };
    case "payment":
      return {
        entityType,
        entityId,
        path: "/v3/company/{realmId}/payment",
        method,
        body: {
          Id: entityId ?? undefined,
          TotalAmt: 0,
          CustomerRef: { value: "{qbCustomerId}" },
          Line: [
            {
              Amount: 0,
              LinkedTxn: [{ TxnId: "{qbInvoiceId}", TxnType: "Invoice" }],
            },
          ],
        },
      };
    case "customer":
      return {
        entityType,
        entityId,
        path: "/v3/company/{realmId}/customer",
        method,
        body: {
          Id: entityId ?? undefined,
          DisplayName: "{builtcrm:orgContactName}",
          PrimaryEmailAddr: { Address: "{builtcrm:email}" },
        },
      };
  }
}
