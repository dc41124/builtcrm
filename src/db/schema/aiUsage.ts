import {
  index,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { retention, timestamps } from "./_shared";
import { organizations, users } from "./identity";

// -----------------------------------------------------------------------------
// ai_usage — counter table for AI provider operations.
//
// Step 56 (Meeting Minutes AI) is the first writer; future AI features
// append rows with the same shape. One row per provider call (i.e.
// one Whisper transcription = one row, one Claude extraction = one
// row), so a single "Generate minutes from audio" run produces two
// rows tagged with the same `meetingId` for cross-row attribution.
//
// `tokensUsed` is approximate: Whisper bills by audio seconds (we
// store seconds in `audioSeconds` and leave tokens null for that
// provider); Claude reports input + output tokens, summed into
// `tokensUsed`. `costEstimateCents` is computed at write time using
// current pricing constants — historical rows are NOT re-priced if
// rates change (audit trail, not a live ledger).
//
// Org-scoped RLS: rows are visible to members of the owning org. No
// project_id; some AI ops aren't tied to a project (e.g. future
// org-wide assistants), so cost dashboards aggregate at the org tier.
// -----------------------------------------------------------------------------

export const aiUsageProviderEnum = pgEnum("ai_usage_provider", [
  "openai",
  "anthropic",
]);

export const aiUsageOperationEnum = pgEnum("ai_usage_operation", [
  "whisper_transcribe",
  "claude_extract",
]);

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    triggeredByUserId: uuid("triggered_by_user_id").references(
      () => users.id,
      { onDelete: "set null" },
    ),
    provider: aiUsageProviderEnum("provider").notNull(),
    operation: aiUsageOperationEnum("operation").notNull(),
    // Free-form context — `meetingId` for Step 56, future ops use their
    // own subject IDs. Avoids a forest of nullable FK columns as new AI
    // operations land. Stored as varchar to accept either UUIDs or
    // future opaque IDs.
    subjectId: varchar("subject_id", { length: 64 }),
    // Whisper: seconds of audio transcribed. Null for Claude.
    audioSeconds: integer("audio_seconds"),
    // Claude: input + output tokens summed. Null for Whisper.
    tokensUsed: integer("tokens_used"),
    // Computed at write time using the pricing constants in
    // src/lib/ai/pricing.ts. Historical rows are not re-priced.
    costEstimateCents: integer("cost_estimate_cents").notNull().default(0),
    // For failed calls — null on success.
    errorMessage: text("error_message"),
    ...timestamps,
    ...retention("operational"),
  },
  (table) => ({
    orgCreatedIdx: index("ai_usage_org_created_idx").on(
      table.orgId,
      table.createdAt,
    ),
    orgOperationIdx: index("ai_usage_org_operation_idx").on(
      table.orgId,
      table.operation,
    ),
    subjectIdx: index("ai_usage_subject_idx").on(table.subjectId),
    tenantIsolation: pgPolicy("ai_usage_tenant_isolation", {
      for: "all",
      using: sql`${table.orgId} = current_setting('app.current_org_id', true)::uuid`,
      withCheck: sql`${table.orgId} = current_setting('app.current_org_id', true)::uuid`,
    }),
  }),
).enableRLS();
