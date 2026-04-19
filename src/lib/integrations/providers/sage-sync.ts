import { runStubSync, type StubSyncResult } from "../stub-sync";

// Sage Business Cloud Accounting sync — STUBBED. Production sync requires
// a Sage developer app published through Sage's partner program. Mirrors
// the QB/Xero stubs: delegates to `runStubSync` with a Sage Accounting API
// `wouldSend` payload. No HTTP call.
//
// Sage's REST API uses resource URLs rooted at `https://api.accounting.
// sage.com/v3.1/`. Multi-region (UK/IE/US/CA/DE/FR/ES) is handled by the
// subdomain on `sageone.com` at authorize time; the API host is unified.
// Sage uses "contact" (not "customer") and stores customer/supplier role
// on `contact_type_ids`.

const PROVIDER_KEY = "sage_business_cloud" as const;
const REVIEW_GATE = "Sage partner program approval";

export type SageEntityType =
  | "invoice"
  | "payment"
  | "contact"
  | "reconciliation";

export type SyncToSageInput = {
  orgId: string;
  actorUserId: string;
  entityType: SageEntityType;
  entityId?: string;
};

export async function syncToSage(
  input: SyncToSageInput,
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
  entityType: Exclude<SageEntityType, "reconciliation">;
  entityId: string | null;
  path: string;
  method: "POST" | "PUT";
  body: Record<string, unknown>;
};

type WouldSendPayload = {
  api: "sage-accounting-v3.1";
  operation: "reconcile" | "push";
  entities: WouldSendEntity[];
  note: string;
};

function buildWouldSendPayload(input: SyncToSageInput): WouldSendPayload {
  if (input.entityType === "reconciliation") {
    return {
      api: "sage-accounting-v3.1",
      operation: "reconcile",
      entities: [
        exampleFor("invoice", null),
        exampleFor("payment", null),
        exampleFor("contact", null),
      ],
      note: "Reconciliation pulls updated records since last successful sync, keyed on updated_at. Stubbed — no HTTP call was made.",
    };
  }
  return {
    api: "sage-accounting-v3.1",
    operation: "push",
    entities: [exampleFor(input.entityType, input.entityId ?? null)],
    note: "Push creates or updates the entity in the connected Sage business. Stubbed — no HTTP call was made.",
  };
}

function exampleFor(
  entityType: Exclude<SageEntityType, "reconciliation">,
  entityId: string | null,
): WouldSendEntity {
  const method: "POST" | "PUT" = entityId ? "PUT" : "POST";
  switch (entityType) {
    case "invoice":
      return {
        entityType,
        entityId,
        path: entityId
          ? `/v3.1/sales_invoices/${entityId}`
          : "/v3.1/sales_invoices",
        method,
        body: {
          sales_invoice: {
            contact_id: "{sageContactId}",
            date: "{builtcrm:invoiceDate}",
            due_date: "{builtcrm:dueDate}",
            reference: "{builtcrm:invoiceNumber}",
            invoice_lines: [
              {
                description: "{builtcrm:lineItemDescription}",
                ledger_account_id: "{sageLedgerAccountId}",
                quantity: 1,
                unit_price: 0,
                tax_rate_id: "{sageTaxRateId}",
              },
            ],
          },
        },
      };
    case "payment":
      return {
        entityType,
        entityId,
        path: entityId
          ? `/v3.1/contact_payments/${entityId}`
          : "/v3.1/contact_payments",
        method,
        body: {
          contact_payment: {
            transaction_type_id: "CUSTOMER_RECEIPT",
            contact_id: "{sageContactId}",
            bank_account_id: "{sageBankAccountId}",
            date: "{builtcrm:paymentDate}",
            total_amount: 0,
            allocated_artefacts: [
              {
                artefact_id: "{sageInvoiceId}",
                amount: 0,
              },
            ],
          },
        },
      };
    case "contact":
      return {
        entityType,
        entityId,
        path: entityId ? `/v3.1/contacts/${entityId}` : "/v3.1/contacts",
        method,
        body: {
          contact: {
            name: "{builtcrm:orgContactName}",
            contact_type_ids: ["CUSTOMER"],
            main_address: {
              address_type_id: "DELIVERY",
              address_line_1: "{builtcrm:address}",
            },
            email: "{builtcrm:email}",
          },
        },
      };
  }
}
