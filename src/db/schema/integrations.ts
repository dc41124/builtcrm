import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { organizations, users } from "./identity";
import { projects } from "./projects";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const integrationProviderEnum = pgEnum("integration_provider", [
  "quickbooks_online",
  "xero",
  "sage_business_cloud",
  "stripe",
  "google_calendar",
  "outlook_365",
  "postmark",
  "sendgrid",
]);

export const integrationConnectionStatusEnum = pgEnum("integration_connection_status", [
  "connecting",
  "connected",
  "needs_reauth",
  "error",
  "disconnected",
]);

export const syncDirectionEnum = pgEnum("sync_direction", [
  "push",
  "pull",
  "reconciliation",
]);

export const syncEventStatusEnum = pgEnum("sync_event_status", [
  "pending",
  "in_progress",
  "succeeded",
  "failed",
  "skipped",
  "partial",
  "mapping_error",
]);

export const paymentMethodTypeEnum = pgEnum("payment_method_type", [
  "ach_debit",
  "card",
  "wire",
  "check",
  "other",
]);

export const paymentTransactionStatusEnum = pgEnum("payment_transaction_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "canceled",
  "refunded",
  "partially_refunded",
  "disputed",
]);

export const webhookDirectionEnum = pgEnum("webhook_direction", [
  "inbound",
  "outbound",
]);

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "received",
  "processed",
  "processing_failed",
  "queued",
  "delivered",
  "delivery_failed",
  "retrying",
  "exhausted",
]);

// -----------------------------------------------------------------------------
// Integration connections
// -----------------------------------------------------------------------------

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    connectionStatus: integrationConnectionStatusEnum("connection_status")
      .default("connecting")
      .notNull(),
    connectedByUserId: uuid("connected_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    externalAccountId: varchar("external_account_id", { length: 255 }),
    externalAccountName: varchar("external_account_name", { length: 255 }),
    mappingConfig: jsonb("mapping_config").$type<Record<string, unknown>>(),
    syncPreferences: jsonb("sync_preferences").$type<Record<string, unknown>>(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncStatus: syncEventStatusEnum("last_sync_status"),
    lastErrorMessage: text("last_error_message"),
    consecutiveErrors: integer("consecutive_errors").default(0).notNull(),
    grantedScopes: jsonb("granted_scopes").$type<string[]>(),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    orgIdx: index("integration_connections_org_idx").on(table.organizationId),
    providerIdx: index("integration_connections_provider_idx").on(table.provider),
    statusIdx: index("integration_connections_status_idx").on(table.connectionStatus),
  }),
);

// -----------------------------------------------------------------------------
// Sync events
// -----------------------------------------------------------------------------

export const syncEvents = pgTable(
  "sync_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    integrationConnectionId: uuid("integration_connection_id")
      .notNull()
      .references(() => integrationConnections.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    syncDirection: syncDirectionEnum("sync_direction").notNull(),
    syncEventStatus: syncEventStatusEnum("sync_event_status").default("pending").notNull(),
    entityType: varchar("entity_type", { length: 120 }),
    entityId: uuid("entity_id"),
    externalEntityType: varchar("external_entity_type", { length: 120 }),
    externalEntityId: varchar("external_entity_id", { length: 255 }),
    idempotencyKey: varchar("idempotency_key", { length: 500 }),
    summary: text("summary"),
    resultData: jsonb("result_data").$type<Record<string, unknown>>(),
    errorCode: varchar("error_code", { length: 120 }),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0).notNull(),
    maxRetries: integer("max_retries").default(5).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    jobId: varchar("job_id", { length: 255 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    connectionIdx: index("sync_events_connection_idx").on(table.integrationConnectionId),
    orgIdx: index("sync_events_org_idx").on(table.organizationId),
    statusIdx: index("sync_events_status_idx").on(table.syncEventStatus),
    entityIdx: index("sync_events_entity_idx").on(table.entityType, table.entityId),
    idempotencyIdx: index("sync_events_idempotency_idx").on(table.idempotencyKey),
    createdIdx: index("sync_events_created_idx").on(table.createdAt),
  }),
);

// -----------------------------------------------------------------------------
// Payment transactions
// -----------------------------------------------------------------------------

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    relatedEntityType: varchar("related_entity_type", { length: 120 }).notNull(),
    relatedEntityId: uuid("related_entity_id").notNull(),
    paymentMethodType: paymentMethodTypeEnum("payment_method_type").notNull(),
    transactionStatus: paymentTransactionStatusEnum("transaction_status")
      .default("pending")
      .notNull(),
    grossAmountCents: integer("gross_amount_cents").notNull(),
    processingFeeCents: integer("processing_fee_cents").default(0).notNull(),
    platformFeeCents: integer("platform_fee_cents").default(0).notNull(),
    netAmountCents: integer("net_amount_cents").notNull(),
    currency: varchar("currency", { length: 3 }).default("CAD").notNull(),
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
    stripeTransferId: varchar("stripe_transfer_id", { length: 255 }),
    paymentMethodDetails: jsonb("payment_method_details").$type<Record<string, unknown>>(),
    initiatedByUserId: uuid("initiated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    externalReference: varchar("external_reference", { length: 255 }),
    initiatedAt: timestamp("initiated_at", { withTimezone: true }),
    succeededAt: timestamp("succeeded_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    refundedAmountCents: integer("refunded_amount_cents").default(0).notNull(),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundReason: text("refund_reason"),
    receiptUrl: text("receipt_url"),
    note: text("note"),
    ...timestamps,
  },
  (table) => ({
    orgIdx: index("payment_transactions_org_idx").on(table.organizationId),
    projectIdx: index("payment_transactions_project_idx").on(table.projectId),
    relatedEntityIdx: index("payment_transactions_related_entity_idx").on(
      table.relatedEntityType,
      table.relatedEntityId,
    ),
    statusIdx: index("payment_transactions_status_idx").on(table.transactionStatus),
    stripePaymentIntentIdx: index("payment_transactions_stripe_pi_idx").on(
      table.stripePaymentIntentId,
    ),
    createdIdx: index("payment_transactions_created_idx").on(table.createdAt),
    netAmountCheck: check(
      "payment_transactions_net_amount_check",
      sql`net_amount_cents = gross_amount_cents - processing_fee_cents - platform_fee_cents`,
    ),
  }),
);

// -----------------------------------------------------------------------------
// Webhook events
// -----------------------------------------------------------------------------

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    webhookDirection: webhookDirectionEnum("webhook_direction").notNull(),
    deliveryStatus: webhookDeliveryStatusEnum("delivery_status").default("received").notNull(),
    eventType: varchar("event_type", { length: 255 }).notNull(),
    eventId: varchar("event_id", { length: 255 }).notNull(),
    sourceProvider: varchar("source_provider", { length: 120 }).notNull(),
    endpointUrl: text("endpoint_url"),
    payloadHash: varchar("payload_hash", { length: 64 }),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    httpStatusCode: integer("http_status_code"),
    responseBody: text("response_body"),
    processingDurationMs: integer("processing_duration_ms"),
    signatureVerified: boolean("signature_verified"),
    retryCount: integer("retry_count").default(0).notNull(),
    maxRetries: integer("max_retries").default(6).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    subscriptionId: varchar("subscription_id", { length: 255 }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => ({
    orgIdx: index("webhook_events_org_idx").on(table.organizationId),
    directionIdx: index("webhook_events_direction_idx").on(table.webhookDirection),
    statusIdx: index("webhook_events_status_idx").on(table.deliveryStatus),
    eventTypeIdx: index("webhook_events_event_type_idx").on(table.eventType),
    eventIdIdx: index("webhook_events_event_id_idx").on(table.eventId),
    sourceIdx: index("webhook_events_source_idx").on(table.sourceProvider),
    createdIdx: index("webhook_events_created_idx").on(table.createdAt),
  }),
);
