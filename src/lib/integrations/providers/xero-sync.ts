import { runStubSync, type StubSyncResult } from "../stub-sync";

// Xero sync — STUBBED. Production sync requires a Xero app review (see
// developer.xero.com/app-marketplace/app-review). Mirrors the QuickBooks
// stub shape: delegates to `runStubSync` with a Xero Accounting API 2.0
// `wouldSend` payload showing what we would POST to Xero. No HTTP call.
//
// Xero's entity naming differs from QB's: "Contact" instead of "Customer"
// (a Contact can be customer, supplier, or both); "Invoice" takes a
// Type=ACCREC for AR; "Payment" links to an invoice via InvoiceID.

const PROVIDER_KEY = "xero" as const;
const REVIEW_GATE = "Xero app review";

export type XeroEntityType =
  | "invoice"
  | "payment"
  | "contact"
  | "reconciliation";

export type SyncToXeroInput = {
  orgId: string;
  actorUserId: string;
  entityType: XeroEntityType;
  entityId?: string;
};

export async function syncToXero(
  input: SyncToXeroInput,
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
  entityType: Exclude<XeroEntityType, "reconciliation">;
  entityId: string | null;
  path: string;
  method: "POST" | "PUT";
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

type WouldSendPayload = {
  api: "xero-accounting-2.0";
  operation: "reconcile" | "push";
  entities: WouldSendEntity[];
  note: string;
};

function buildWouldSendPayload(input: SyncToXeroInput): WouldSendPayload {
  if (input.entityType === "reconciliation") {
    return {
      api: "xero-accounting-2.0",
      operation: "reconcile",
      entities: [
        exampleFor("invoice", null),
        exampleFor("payment", null),
        exampleFor("contact", null),
      ],
      note: "Reconciliation pulls updated records since last successful sync, keyed on UpdatedDateUTC. Stubbed — no HTTP call was made.",
    };
  }
  return {
    api: "xero-accounting-2.0",
    operation: "push",
    entities: [exampleFor(input.entityType, input.entityId ?? null)],
    note: "Push creates or updates the entity in the connected Xero tenant. Stubbed — no HTTP call was made.",
  };
}

function exampleFor(
  entityType: Exclude<XeroEntityType, "reconciliation">,
  entityId: string | null,
): WouldSendEntity {
  const method: "POST" | "PUT" = entityId ? "POST" : "PUT";
  const headers: Record<string, string> = {
    "Xero-tenant-id": "{tenantId}",
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  switch (entityType) {
    case "invoice":
      return {
        entityType,
        entityId,
        path: "/api.xro/2.0/Invoices",
        method,
        headers,
        body: {
          Invoices: [
            {
              InvoiceID: entityId ?? undefined,
              Type: "ACCREC",
              Contact: { ContactID: "{xeroContactId}" },
              LineItems: [
                {
                  Description: "{builtcrm:lineItemDescription}",
                  Quantity: 1,
                  UnitAmount: 0,
                  AccountCode: "{xeroAccountCode}",
                },
              ],
              Reference: "{builtcrm:invoiceNumber}",
              Status: "AUTHORISED",
            },
          ],
        },
      };
    case "payment":
      return {
        entityType,
        entityId,
        path: "/api.xro/2.0/Payments",
        method,
        headers,
        body: {
          Payments: [
            {
              PaymentID: entityId ?? undefined,
              Invoice: { InvoiceID: "{xeroInvoiceId}" },
              Account: { Code: "{xeroBankAccountCode}" },
              Amount: 0,
              Date: "{builtcrm:paymentDate}",
            },
          ],
        },
      };
    case "contact":
      return {
        entityType,
        entityId,
        path: "/api.xro/2.0/Contacts",
        method,
        headers,
        body: {
          Contacts: [
            {
              ContactID: entityId ?? undefined,
              Name: "{builtcrm:orgContactName}",
              EmailAddress: "{builtcrm:email}",
              IsCustomer: true,
            },
          ],
        },
      };
  }
}
