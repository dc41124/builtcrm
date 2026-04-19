import { runStubSync, type StubSyncResult } from "../stub-sync";

// QuickBooks Online sync — STUBBED. Production sync against Intuit's
// Accounting API requires app review, which requires a registered business
// entity and a published marketplace app. Until that happens, this function
// delegates to `runStubSync` (which writes a `sync_events` row with
// status='skipped' + resultData.stubbed, plus an `integration.sync.stubbed`
// audit event) with a QB-shaped `wouldSend` payload showing what we would
// push to the Accounting API v3.
//
// When production connector work starts, replace `buildWouldSendPayload`
// with the real push mapper, POST it to the Accounting API, and switch
// the delegate from `runStubSync` to a live implementation that flips
// status to 'succeeded'.

const PROVIDER_KEY = "quickbooks_online" as const;
const REVIEW_GATE = "Intuit app review";

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

export async function syncToQuickBooks(
  input: SyncToQuickBooksInput,
): Promise<StubSyncResult> {
  const direction =
    input.entityType === "reconciliation" ? "reconciliation" : "push";
  return runStubSync({
    providerKey: PROVIDER_KEY,
    orgId: input.orgId,
    actorUserId: input.actorUserId,
    direction,
    entityType:
      input.entityType === "reconciliation" ? undefined : input.entityType,
    entityId: input.entityId,
    wouldSend: buildWouldSendPayload(input),
    reviewGate: REVIEW_GATE,
  });
}

type WouldSendEntity = {
  entityType: Exclude<QuickBooksEntityType, "reconciliation">;
  entityId: string | null;
  path: string;
  method: "POST" | "PUT";
  body: Record<string, unknown>;
};

type WouldSendPayload = {
  api: "intuit-quickbooks-online-accounting-v3";
  operation: "reconcile" | "push";
  entities: WouldSendEntity[];
  note: string;
};

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
): WouldSendEntity {
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
