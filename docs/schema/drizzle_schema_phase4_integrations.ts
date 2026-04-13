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
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Phase 4 — Integration Infrastructure Schema
 *
 * Four new tables that power all external integrations:
 *
 * 33. integration_connections — OAuth connections per org per provider
 * 34. sync_events — Audit log of every sync operation
 * 35. payment_transactions — Stripe payment records linked to BuiltCRM entities
 * 36. webhook_events — Inbound + outbound webhook delivery log
 *
 * These tables are provider-agnostic. The same integration_connections table
 * handles QuickBooks, Xero, Sage, Stripe, Google Calendar, etc. Provider-
 * specific configuration lives in the jsonb config/mapping columns.
 *
 * All monetary values in cents. All tokens encrypted at rest (application-layer
 * encryption, not column-level DB encryption — the columns store the encrypted
 * ciphertext as text).
 */

// =============================================================================
// Shared columns
// =============================================================================

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
};

// =============================================================================
// New Enums
// =============================================================================

export const integrationProviderEnum = pgEnum("integration_provider", [
  "quickbooks_online",
  "xero",
  "sage_business_cloud",
  "stripe",
  "google_calendar",
  "outlook_365",
  "postmark",       // email service
  "sendgrid",       // email service (alternative)
]);

export const integrationConnectionStatusEnum = pgEnum("integration_connection_status", [
  "connecting",      // OAuth flow initiated but not completed
  "connected",       // Active and healthy
  "needs_reauth",    // Token refresh failed, user must re-authorize
  "error",           // Unrecoverable error (e.g., account deleted on provider side)
  "disconnected",    // User explicitly disconnected
]);

export const syncDirectionEnum = pgEnum("sync_direction", [
  "push",            // BuiltCRM → external system
  "pull",            // External system → BuiltCRM
  "reconciliation",  // Bidirectional comparison + resolution
]);

export const syncEventStatusEnum = pgEnum("sync_event_status", [
  "pending",
  "in_progress",
  "succeeded",
  "failed",
  "skipped",         // e.g., no changes detected during reconciliation
  "partial",         // some items succeeded, others failed (batch operations)
  "mapping_error",   // entity mapping mismatch — needs manual intervention
]);

export const paymentMethodTypeEnum = pgEnum("payment_method_type", [
  "ach_debit",       // Bank transfer (ACH)
  "card",            // Credit/debit card
  "wire",            // Wire transfer (manual, recorded for tracking)
  "check",           // Physical check (manual, recorded for tracking)
  "other",           // Catch-all for manual payment recording
]);

export const paymentTransactionStatusEnum = pgEnum("payment_transaction_status", [
  "pending",         // PaymentIntent created, awaiting customer action
  "processing",      // ACH initiated, awaiting settlement
  "succeeded",       // Payment confirmed
  "failed",          // Payment failed (insufficient funds, declined, etc.)
  "canceled",        // Payment canceled before completion
  "refunded",        // Full refund issued
  "partially_refunded",
  "disputed",        // Chargeback / dispute opened
]);

export const webhookDirectionEnum = pgEnum("webhook_direction", [
  "inbound",         // Received from external service (Stripe, QB, etc.)
  "outbound",        // Sent to customer endpoint (Enterprise webhook API)
]);

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "received",        // Inbound: received and queued for processing
  "processed",       // Inbound: successfully processed
  "processing_failed", // Inbound: processing failed
  "queued",          // Outbound: queued for delivery
  "delivered",       // Outbound: endpoint returned 2xx
  "delivery_failed", // Outbound: endpoint returned non-2xx or timed out
  "retrying",        // Outbound: scheduled for retry
  "exhausted",       // Outbound: all retry attempts failed
]);

// =============================================================================
// 33. INTEGRATION CONNECTIONS
//
// One row per organization per provider. A contractor org might have:
//   - 1 QuickBooks connection
//   - 1 Stripe connection
//   - 1 Google Calendar connection
//
// The same table handles all provider types. Provider-specific configuration
// (mapping, sync preferences) lives in the jsonb columns.
//
// OAuth tokens are encrypted at the application layer before storage.
// The columns store base64-encoded ciphertext, not plaintext tokens.
//
// Connection scoping:
//   - Connections belong to organizations, not individual users
//   - Only org admins can create/modify/disconnect integrations
//   - The connectedByUserId tracks who initiated the connection for audit
// =============================================================================

export const integrationConnections = pgTable(
  "integration_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id").notNull(),
      // .references(() => organizations.id, { onDelete: "cascade" }),

    provider: integrationProviderEnum("provider").notNull(),
    connectionStatus: integrationConnectionStatusEnum("connection_status")
      .default("connecting")
      .notNull(),

    /**
     * Who initiated this connection. For audit trail — the connection
     * itself is org-scoped, not user-scoped.
     */
    connectedByUserId: uuid("connected_by_user_id").notNull(),
      // .references(() => users.id, { onDelete: "restrict" }),

    /**
     * OAuth tokens — encrypted at application layer.
     * These columns store base64 ciphertext, never plaintext.
     * accessTokenEnc and refreshTokenEnc are nullable because some
     * providers (like Stripe Connect) use a permanent key instead of
     * rotating OAuth tokens.
     */
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),

    /**
     * Provider-specific account identifier.
     * Examples:
     *   QuickBooks: realmId (company ID)
     *   Stripe: connected account ID (acct_xxx)
     *   Xero: tenantId
     *   Google Calendar: calendar ID
     */
    externalAccountId: varchar("external_account_id", { length: 255 }),
    externalAccountName: varchar("external_account_name", { length: 255 }),

    /**
     * Provider-specific mapping configuration. Structure varies by provider.
     *
     * QuickBooks example:
     * {
     *   "project_mappings": [
     *     { "project_id": "uuid", "qb_customer_id": "123", "qb_job_id": "456" }
     *   ],
     *   "default_income_account_id": "789",
     *   "default_expense_account_id": "012",
     *   "cost_code_mappings": [
     *     { "cost_code": "03-3000", "qb_item_id": "345" }
     *   ],
     *   "tax_handling": "inclusive",
     *   "currency": "CAD"
     * }
     *
     * Stripe example:
     * {
     *   "payout_schedule": "daily",
     *   "default_payment_method_types": ["us_bank_account"],
     *   "platform_fee_percent": 0,
     *   "statement_descriptor": "BUILTCRM"
     * }
     */
    mappingConfig: jsonb("mapping_config").$type<Record<string, unknown>>(),

    /**
     * Sync preferences. Structure varies by provider.
     * {
     *   "sync_frequency": "realtime" | "daily" | "weekly",
     *   "sync_on_approval": true,
     *   "auto_create_customers": false,
     *   "include_retainage_entries": true
     * }
     */
    syncPreferences: jsonb("sync_preferences").$type<Record<string, unknown>>(),

    /**
     * Health tracking — used by the integration dashboard and health-check job.
     */
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncStatus: syncEventStatusEnum("last_sync_status"),
    lastErrorMessage: text("last_error_message"),
    consecutiveErrors: integer("consecutive_errors").default(0).notNull(),

    /**
     * Scopes granted during OAuth. Stored for reference and re-auth validation.
     * e.g., ["com.intuit.quickbooks.accounting"] for QB
     */
    grantedScopes: jsonb("granted_scopes").$type<string[]>(),

    connectedAt: timestamp("connected_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),

    ...timestamps,
  },
  (table) => ({
    /**
     * One active connection per org per provider.
     * Disconnected connections are kept for audit but can't conflict.
     * Enforce via partial unique index:
     * CREATE UNIQUE INDEX integration_connections_active_per_org_provider
     *   ON integration_connections (organization_id, provider)
     *   WHERE connection_status NOT IN ('disconnected');
     */
    orgIdx: index("integration_connections_org_idx").on(table.organizationId),
    providerIdx: index("integration_connections_provider_idx").on(table.provider),
    statusIdx: index("integration_connections_status_idx").on(table.connectionStatus),
  }),
);

// =============================================================================
// 34. SYNC EVENTS
//
// Audit log of every sync operation between BuiltCRM and an external system.
// One row per atomic sync action (e.g., "push draw request #5 as invoice to QB").
//
// Used for:
//   - Integration dashboard sync activity feed
//   - Debugging failed syncs
//   - Reconciliation reports
//   - Retry tracking
//
// Sync events reference the integration connection and optionally the
// specific BuiltCRM entity that was synced.
// =============================================================================

export const syncEvents = pgTable(
  "sync_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    integrationConnectionId: uuid("integration_connection_id").notNull(),
      // .references(() => integrationConnections.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull(),
      // .references(() => organizations.id, { onDelete: "cascade" }),

    syncDirection: syncDirectionEnum("sync_direction").notNull(),
    syncEventStatus: syncEventStatusEnum("sync_event_status").default("pending").notNull(),

    /**
     * What BuiltCRM entity was being synced.
     * entityType: "draw_request", "change_order", "project", etc.
     * entityId: the UUID of the BuiltCRM record
     */
    entityType: varchar("entity_type", { length: 120 }),
    entityId: uuid("entity_id"),

    /**
     * What external entity was created/updated.
     * externalEntityType: "invoice", "payment", "customer", etc.
     * externalEntityId: the ID in the external system
     */
    externalEntityType: varchar("external_entity_type", { length: 120 }),
    externalEntityId: varchar("external_entity_id", { length: 255 }),

    /**
     * Idempotency key for this operation.
     * Format: {provider}:{entity_type}:{builtcrm_id}:{action}:{version}
     * Used to prevent duplicate operations on retry.
     */
    idempotencyKey: varchar("idempotency_key", { length: 500 }),

    /**
     * Human-readable description of what happened.
     * e.g., "Pushed Draw Request #5 ($45,100) as Invoice INV-00892 to QuickBooks"
     */
    summary: text("summary"),

    /**
     * Detailed result data — varies by operation.
     * Success: { "external_id": "INV-00892", "external_url": "https://..." }
     * Failure: { "error_code": "RATE_LIMIT", "error_message": "...", "retry_after": 60 }
     * Mapping error: { "unmapped_entity": "project_xyz", "suggestion": "..." }
     */
    resultData: jsonb("result_data").$type<Record<string, unknown>>(),

    /**
     * Error details for failed syncs.
     */
    errorCode: varchar("error_code", { length: 120 }),
    errorMessage: text("error_message"),

    /**
     * Retry tracking.
     */
    retryCount: integer("retry_count").default(0).notNull(),
    maxRetries: integer("max_retries").default(5).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),

    /**
     * Trigger.dev job ID for tracking/cancellation.
     */
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

// =============================================================================
// 35. PAYMENT TRANSACTIONS
//
// Records every payment processed through Stripe (or manually recorded).
// Each transaction links to the BuiltCRM entity it pays for:
//   - Draw Request (commercial draw payments via ACH)
//   - Retainage Release (retainage release payments)
//   - Selection Decision (residential selection upgrade payments)
//
// This is NOT a replacement for Stripe's records — it's a local mirror
// that keeps the BuiltCRM UI responsive without hitting Stripe's API
// on every page load.
//
// Manual payments (check, wire) can also be recorded here for tracking
// purposes even when not processed through Stripe.
// =============================================================================

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id").notNull(),
      // .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").notNull(),
      // .references(() => projects.id, { onDelete: "cascade" }),

    /**
     * What this payment is for. Polymorphic reference.
     * relatedEntityType: "draw_request" | "retainage_release" | "selection_decision"
     * relatedEntityId: UUID of the BuiltCRM record
     */
    relatedEntityType: varchar("related_entity_type", { length: 120 }).notNull(),
    relatedEntityId: uuid("related_entity_id").notNull(),

    paymentMethodType: paymentMethodTypeEnum("payment_method_type").notNull(),
    transactionStatus: paymentTransactionStatusEnum("transaction_status")
      .default("pending")
      .notNull(),

    /**
     * Amounts — all in cents.
     * grossAmountCents: total amount charged
     * processingFeeCents: Stripe fee (or 0 for manual payments)
     * platformFeeCents: BuiltCRM's fee (if any — 0 at launch)
     * netAmountCents: amount received by contractor after fees
     */
    grossAmountCents: integer("gross_amount_cents").notNull(),
    processingFeeCents: integer("processing_fee_cents").default(0).notNull(),
    platformFeeCents: integer("platform_fee_cents").default(0).notNull(),
    netAmountCents: integer("net_amount_cents").notNull(),

    currency: varchar("currency", { length: 3 }).default("CAD").notNull(),

    /**
     * Stripe identifiers. Null for manually recorded payments.
     * These are used for reconciliation, refund processing, and
     * linking to the Stripe dashboard.
     */
    stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
    stripeChargeId: varchar("stripe_charge_id", { length: 255 }),
    stripeTransferId: varchar("stripe_transfer_id", { length: 255 }),

    /**
     * Payment method details (non-sensitive summary for display).
     * e.g., { "type": "ach_debit", "bank_name": "TD Bank", "last4": "6789" }
     * or { "type": "card", "brand": "visa", "last4": "4242" }
     */
    paymentMethodDetails: jsonb("payment_method_details").$type<Record<string, unknown>>(),

    /**
     * Who initiated the payment. For Stripe payments, this is the client
     * user who clicked "Pay Now". For manual recordings, the contractor
     * who entered the payment.
     */
    initiatedByUserId: uuid("initiated_by_user_id"),
      // .references(() => users.id, { onDelete: "set null" }),

    /**
     * External reference for manual payments.
     * e.g., check number, wire reference, EFT confirmation
     */
    externalReference: varchar("external_reference", { length: 255 }),

    /**
     * Timestamps for the payment lifecycle.
     */
    initiatedAt: timestamp("initiated_at", { withTimezone: true }),
    succeededAt: timestamp("succeeded_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),

    /**
     * Refund tracking.
     */
    refundedAmountCents: integer("refunded_amount_cents").default(0).notNull(),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundReason: text("refund_reason"),

    /**
     * Receipt URL from Stripe (if available).
     */
    receiptUrl: text("receipt_url"),

    /**
     * Optional note from the payer or recorder.
     */
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
    /**
     * Net must equal gross minus fees.
     */
    netAmountCheck: check(
      "payment_transactions_net_amount_check",
      sql`net_amount_cents = gross_amount_cents - processing_fee_cents - platform_fee_cents`,
    ),
  }),
);

// =============================================================================
// 36. WEBHOOK EVENTS
//
// Logs all webhook traffic — both inbound (from Stripe, QB, etc.) and
// outbound (Enterprise webhook API to customer endpoints).
//
// Inbound webhooks:
//   Received → signature verified → queued for processing → processed/failed
//
// Outbound webhooks:
//   Event emitted → payload built → delivered/retrying/exhausted
//
// This table serves as:
//   1. Audit trail for all webhook activity
//   2. Debugging tool for failed deliveries
//   3. Replay source for missed events
//   4. Dashboard data for Enterprise webhook management
// =============================================================================

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    organizationId: uuid("organization_id").notNull(),
      // .references(() => organizations.id, { onDelete: "cascade" }),

    webhookDirection: webhookDirectionEnum("webhook_direction").notNull(),
    deliveryStatus: webhookDeliveryStatusEnum("delivery_status")
      .default("received")
      .notNull(),

    /**
     * Event identification.
     * eventType: "draw_request.approved", "payment_intent.succeeded", etc.
     * eventId: unique event identifier (Stripe event ID for inbound,
     *          BuiltCRM-generated for outbound)
     */
    eventType: varchar("event_type", { length: 255 }).notNull(),
    eventId: varchar("event_id", { length: 255 }).notNull(),

    /**
     * For inbound: the provider that sent the webhook.
     * For outbound: "builtcrm" (we are the sender).
     */
    sourceProvider: varchar("source_provider", { length: 120 }).notNull(),

    /**
     * For outbound: the customer's endpoint URL.
     * For inbound: the BuiltCRM endpoint that received it.
     */
    endpointUrl: text("endpoint_url"),

    /**
     * Hash of the payload for deduplication.
     * SHA-256 of the raw payload body.
     */
    payloadHash: varchar("payload_hash", { length: 64 }),

    /**
     * The webhook payload. Stored as JSONB for queryability.
     * For inbound: the raw payload from the external service.
     * For outbound: the payload we sent to the customer endpoint.
     *
     * Note: Sensitive data (tokens, full card numbers) is stripped
     * before storage. Only non-sensitive event data is retained.
     */
    payload: jsonb("payload").$type<Record<string, unknown>>(),

    /**
     * Delivery/processing details.
     */
    httpStatusCode: integer("http_status_code"),
    responseBody: text("response_body"),   // first 1KB of response for debugging
    processingDurationMs: integer("processing_duration_ms"),

    /**
     * Signature verification (inbound).
     */
    signatureVerified: boolean("signature_verified"),

    /**
     * Retry tracking (outbound).
     */
    retryCount: integer("retry_count").default(0).notNull(),
    maxRetries: integer("max_retries").default(6).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),

    /**
     * Error details.
     */
    errorMessage: text("error_message"),

    /**
     * For outbound: reference to the webhook subscription/endpoint config.
     * Stored as string ID rather than FK to keep the table self-contained
     * even if endpoint config is managed separately.
     */
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

// =============================================================================
// Complete Phase 4 Migration Order
// =============================================================================

/**
 * Phase 4 tables (add after remaining gaps table 32):
 *
 * 33. integration_connections
 * 34. sync_events
 * 35. payment_transactions
 * 36. webhook_events
 *
 * New enums:
 *   - integration_provider
 *   - integration_connection_status
 *   - sync_direction
 *   - sync_event_status
 *   - payment_method_type
 *   - payment_transaction_status
 *   - webhook_direction
 *   - webhook_delivery_status
 *
 * Required application-layer services:
 *
 * - connectIntegration(orgId, provider, oauthCode)
 *     → exchange code for tokens, encrypt, store connection
 *
 * - disconnectIntegration(connectionId)
 *     → revoke tokens at provider, mark disconnected, cancel pending jobs
 *
 * - refreshTokens(connectionId)
 *     → refresh OAuth tokens, update encrypted storage, handle failures
 *
 * - pushDrawToAccounting(drawRequestId)
 *     → create/update invoice in connected accounting system
 *     → log sync event with idempotency key
 *
 * - pullPaymentStatus(connectionId)
 *     → check all open invoices for payment updates
 *     → update draw request statuses accordingly
 *
 * - createPaymentIntent(relatedEntityType, relatedEntityId, amountCents)
 *     → create Stripe PaymentIntent on behalf of connected account
 *     → create pending payment_transaction record
 *
 * - processStripeWebhook(event)
 *     → verify signature, log webhook event
 *     → update payment_transaction status
 *     → trigger downstream effects (draw status update, lien waiver request)
 *
 * - deliverOutboundWebhook(eventType, data, orgId)
 *     → build payload, sign with HMAC, deliver to all active endpoints
 *     → log webhook event, handle retries
 *
 * TOTAL SCHEMA: 36 tables + 2 modifications
 */
