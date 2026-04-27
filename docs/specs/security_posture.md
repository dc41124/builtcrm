# Security Posture

**Last reviewed:** 2026-04-25
**Scope:** Data-at-rest protections, authentication storage, authorization model, and known gaps as of the pre-baseline hardening pass.

This document exists so that future contributors — including future me — can understand *what security properties we're relying on, what we're deliberately not protecting against, and why the decisions were made the way they were*. If you're making a schema change, a new integration, or a change to `src/auth/`, read the relevant section here first.

---

## 1. Threat model

### What we defend against
- **Postgres data breach** — someone obtains a logical dump, a backup file, or `SELECT` access via compromised credentials or SQL injection. This is the primary threat we design for.
- **Raw storage theft** — physical disk / snapshot leak. Neon provides disk-level encryption as the base defense here.
- **Authorization bypass within the app** — mistaken policy logic, a missing `getEffectiveContext()` call, or cross-tenant data leakage. Defended via the app-layer policy gate (see §5).

### What we do **not** currently defend against
- **Compromise of `BETTER_AUTH_SECRET`** — this is a master key (see §3). Leaking it defeats 2FA-secret encryption, OAuth-token encryption, cookie signing, and JWE cookie-cache encryption. Mitigate via storage discipline and rotation, not key separation.
- **Compromise of the runtime DB role (`builtcrm_app`)** — least-privilege limits DDL impact (no `DROP`/`ALTER`), but the role still has full DML on tenant data. SQL-injection defense lives in Drizzle + typed query builders, not the DB role.
- **Authorized internal user with database access** — privilege separation reduces blast radius but does not eliminate it. RLS now enforces tenant isolation at the DB layer on dev (resolved 2026-04-26 — see §6); no column-level masking yet.
- **Upstash compromise** — session data lives in Upstash Redis (see §4). A breach of Upstash as a provider, or a leak of our Upstash credentials, reveals active session tokens. Scope is bounded (sessions expire in 7 days), but a real risk.
- **Logical backup exfiltration** — `pg_dump` files, backup exports, or similar artifacts leaked out-of-band. Neon's disk encryption does not help here; see sub-section below.
- **Social engineering / phishing of legitimate users** — app-layer authorization works as designed, but if a user hands over credentials or is tricked into an authenticated action, nothing in this stack stops it. Out of scope for this document; listed for completeness.
- **Supply-chain compromise** — a malicious update to Better Auth, `@upstash/redis`, Drizzle, Next.js, or any other dependency. Dependency review + lockfile discipline is the mitigation; this document does not treat supply-chain attacks as defended against at the application layer.

### Disk-level encryption — what it covers and doesn't
Neon encrypts data volumes at rest. This protects against:
- Someone obtaining physical disks from the hosting provider.
- A raw snapshot of storage leaking out-of-band.

It does **not** protect against:
- SQL injection or application-layer read access to data.
- Compromise of the DB user's credentials.
- Backup files that are exported and then leaked (backups are typically the encrypted-at-source artifact, not the raw disk).
- An authorized internal user with `SELECT` privileges.

"Encryption at rest" on Neon is one layer; it's not a substitute for the application-layer protections below.

---

## 2. Data-at-rest protections (table-by-table)

### Encrypted (application-layer, AES-256-GCM)
| Table | Column(s) | Mechanism | Key source |
|---|---|---|---|
| `integration_connections` | `access_token_enc`, `refresh_token_enc` | [src/lib/integrations/crypto.ts](../../src/lib/integrations/crypto.ts) AES-256-GCM | `INTEGRATION_ENCRYPTION_KEY` (dedicated key) |
| `organizations` | `tax_id` | [src/lib/integrations/crypto.ts](../../src/lib/integrations/crypto.ts) AES-256-GCM via `encryptTaxId` / `decryptTaxId`. Display masked (`***-**-NNNN`); plaintext only via `POST /api/org/tax-id/reveal` which writes a `tax_id.revealed` audit event. | `TAX_ID_ENCRYPTION_KEY` (dedicated key) |
| `two_factor` | `secret`, `backup_codes` | Better Auth plugin default (`symmetricEncrypt`) | `BETTER_AUTH_SECRET` |
| `auth_account` | `access_token`, `refresh_token`, `id_token` | Better Auth `account.encryptOAuthTokens: true` | `BETTER_AUTH_SECRET` |

### Hashed at rest
| Table | Column | Mechanism |
|---|---|---|
| `auth_account` | `password` | Better Auth default (one-way hash) |
| `auth_verification` | `value` | Better Auth `verification.storeIdentifier: "hashed"` |
| `invitations` | `token` | Application-layer SHA-256 (migration 0026) |

### Not in Postgres
| Data | Location |
|---|---|
| Session tokens (`auth_session.token`) | Upstash Redis via Better Auth `secondaryStorage` (see §4). `storeSessionInDatabase: false` is pinned explicitly. |

### Plaintext in Postgres (deliberate)
| Table | Column | Rationale |
|---|---|---|
| `sso_providers` | `certificate_pem` | IdP signing certificate is public material by design — SAML libraries consume it plaintext. |
| `webhook_events` | `payload` | Debuggability vs. retention trade-off — retention TTL planned instead of encryption (see §6). |

---

## 3. Master key: `BETTER_AUTH_SECRET`

`BETTER_AUTH_SECRET` is the single secret protecting multiple Better Auth subsystems. Decision: accept shared-key coupling; mitigate via storage discipline and rotation policy, not key separation.

### What it protects
- Session cookie signing
- 2FA TOTP secret encryption (`two_factor.secret`)
- 2FA backup code encryption (`two_factor.backup_codes`)
- OAuth token encryption when/if social login is enabled (`auth_account.*_token`)
- Verification identifier hashing input (`auth_verification.value`)
- JWE cookie-cache encryption if `session.cookieCache.strategy` is set to `"jwe"`

### Why shared-key and not separate keys
The alternative — a separate `TWO_FACTOR_ENCRYPTION_KEY` — would require wrapping Better Auth's write path with re-encryption logic, which is exactly the adapter-coupling complexity we explicitly avoided during the step-1 spike. Keeping one secret does not materially reduce blast radius: if `BETTER_AUTH_SECRET` leaks, session cookies are compromised regardless, and sessions are a larger attack surface than 2FA secrets. A second key stored next to the first in the same env gives no additional protection.

### Rotation impact (important — everyone forgets this)
On rotating `BETTER_AUTH_SECRET`:
1. **All active sessions invalidate** — existing cookies can't be verified against the new secret. Users are signed out.
2. **Existing 2FA secrets become unreadable** — the encrypted ciphertext decrypts with the old key. Affected users must re-enroll 2FA, or the operator must re-encrypt in bulk using the old-and-new-key pair before retiring the old key.
3. **Existing OAuth tokens (if social login is enabled) become unreadable** — same story as 2FA. Users must re-link the social account.
4. **Pending password-reset / email-verification tokens invalidate** — hashed identifiers use the secret as an input; new secret means new hashes. Affected users must re-request.

Rotation is therefore not a routine hygiene activity — it's an incident-response tool. Treat as: planned (announce + cutover window) or emergency (accept mass re-auth).

### Storage
- **Dev:** `.env.local` (not committed; documented in the env example)
- **Prod:** **Pending hosting decision.** No prod deploy target has been chosen yet (Render is one candidate; Vercel, Fly, self-hosted are also under consideration). Once the host is picked, the secret-storage decision tree below applies. Candidates:
  - *Host-native env vars* (Render env, Vercel env, etc.) — simplest, acceptable baseline. Encrypted at rest, access-controlled by host role.
  - *Doppler* — mid-range. Better audit trail and rotation story than host env vars, integrates with most hosts, low operational overhead.
  - *AWS Secrets Manager* — heavyweight. Appropriate only if AWS is already in the stack.

  **Decision criteria:** rotation support, audit trail, access control granularity.
  **Default starting posture** when the host is picked: host-native env vars, with an explicit commit to revisit when rotation cadence or audit-trail needs exceed the host's surface. Re-evaluation triggers: any of (a) first planned rotation event, (b) first compliance/audit engagement requiring secret-access logs, (c) more than ~3 engineers with prod env access.

  **All secrets blocked on this decision:** `BETTER_AUTH_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, `INTEGRATION_STATE_SECRET`, `TAX_ID_ENCRYPTION_KEY`, `DATABASE_URL`, `DATABASE_ADMIN_URL`, `R2_*`, `UPSTASH_*`, `TRIGGER_SECRET_KEY`, `SENTRY_DSN`, plus per-provider OAuth client secrets and webhook keys.

### Other dedicated keys

`INTEGRATION_ENCRYPTION_KEY` (32 bytes base64) protects `integration_connections.access_token_enc` / `refresh_token_enc`. `TAX_ID_ENCRYPTION_KEY` (32 bytes base64) protects `organizations.tax_id`. Held separately from `BETTER_AUTH_SECRET` and from each other so a leak of one key does not compromise the others. Same generation pattern: `openssl rand -base64 32`.

Rotation impact for either key: all rows protected by the rotated key become unreadable until re-encrypted with the old-and-new-key pair. Treat as a planned activity, not routine hygiene. The backfill script pattern in [scripts/backfill-encrypt-tax-id.ts](../../scripts/backfill-encrypt-tax-id.ts) is the template for re-encryption work.

---

## 4. Session storage: Upstash secondary storage

Sessions are stored in Upstash Redis via Better Auth's `secondaryStorage` option. Postgres does not hold session rows (`storeSessionInDatabase: false` is pinned explicitly).

### Why
A Postgres breach must not reveal session tokens. Hashing session tokens was considered and rejected: Better Auth exposes no read-side hook, and even a hashed bearer is a usable artifact for forced mass invalidation. Moving sessions out of Postgres is a categorical improvement — the DB simply does not know about sessions.

### Availability coupling
Session validation now depends on Upstash. Effective auth availability = Postgres × Upstash. If Upstash is down, users cannot sign in or revalidate existing sessions. This is a deliberate trade-off against the security win.

Mitigation path (if availability ever becomes a real concern): improve Upstash redundancy (paid tier, multi-region) rather than flip `storeSessionInDatabase: true`. Flipping it back would reintroduce session tokens to Postgres and defeat the threat model — that's not a valid availability lever.

### Default-pin
`storeSessionInDatabase: false` is set explicitly in [src/auth/config.ts](../../src/auth/config.ts). This pin is load-bearing: a library-default change or a well-meaning edit that removes the line would silently reintroduce session tokens to Postgres. If you change this line, read this section first.

---

## 5. Authorization

### App layer
Every loader and state-changing action must pass through `getEffectiveContext()` at [src/domain/context.ts](../../src/domain/context.ts). That single gate resolves (user, project) → (effective role, membership) and applies the resource × action × role policy matrix in [src/domain/permissions.ts](../../src/domain/permissions.ts). The frontend never owns authorization.

Project-level overrides (phase/work scope) live in `project_user_memberships` and narrow queries at row level.

### DB layer
Two roles:
- `builtcrm_app` — DML only (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). No DDL. This is the runtime role the Next.js app connects as. Configured via `DATABASE_URL`.
- `builtcrm_admin` — DDL + DML. Used for migrations, seeding, and future admin tooling (backfill jobs, manual data surgery). Configured via `DATABASE_ADMIN_URL`.

### What we don't have (yet)
- **~~Row-Level Security (RLS).~~** RESOLVED on dev (2026-04-26). 72 tables under RLS with policies enforcing on the non-bypass runtime role. See §6 for architecture, policy shapes, and prod-verify residual.
- **Read-only role** for analytics / reporting / debugging. Deferred until an actual consumer exists.

---

## 6. Known gaps (post-baseline backlog)

Each of these was explicitly deferred during the step-1 hardening pass. Entries list what, why deferred, and what the decision input is.

### Hosting + secrets-storage decision (blocks every prod deploy step)
**Status:** open. No prod hosting target chosen yet (Render / Vercel / Fly / self-hosted all open). Until that's decided, none of the encryption keys, DB URLs, OAuth client secrets, or webhook secrets can be set in a real prod env. See §3 "Storage" for the full blocked-secrets list. **Every "set X in prod env" follow-up across the rest of this doc is gated on this decision.**
**Unblocker:** pick the host (and the secrets-storage layer if not host-native), then walk the §3 storage section + the per-env-var entries below.

### Transactional email infrastructure (blocks user-facing email flows)
**Status:** open. Email is a console-log stub everywhere it's referenced: password reset ([src/auth/config.ts](../../src/auth/config.ts) `sendResetPassword`), account-deletion confirmation + 7-day reminder ([src/lib/user-deletion/email.ts](../../src/lib/user-deletion/email.ts)), GDPR export download link ([src/lib/user-export/email.ts](../../src/lib/user-export/email.ts)). The deletion + export flows are functional in dev (the URL is logged) but cannot ship to real users until emails actually leave the building.
**Unblocker:** acquire a domain, point its DNS at a transactional-email provider (Postmark and Resend are the active candidates; both have entries in [src/lib/integrations/registry.ts](../../src/lib/integrations/registry.ts)), wire SPF/DKIM/DMARC, then replace the three `console.log` stubs with real sends. Single unblock removes the prod-readiness gap on multiple shipped features.

### `organizations.tax_id` encryption
**Status:** RESOLVED (2026-04-25). AES-256-GCM via `TAX_ID_ENCRYPTION_KEY` and `encryptTaxId` / `decryptTaxId` in [src/lib/integrations/crypto.ts](../../src/lib/integrations/crypto.ts). Loader returns masked value (`***-**-NNNN`); plaintext only via `POST /api/org/tax-id/reveal` (rate-limited 5/min, contractor_admin / subcontractor_owner only) which writes a `tax_id.revealed` audit event. PATCH writes encrypt; mask-shape submissions are no-ops to avoid re-encrypting the display string.
**Backfill:** [scripts/backfill-encrypt-tax-id.ts](../../scripts/backfill-encrypt-tax-id.ts) — idempotent; encrypts any legacy plaintext rows. Sequencing for the prod cutover: set `TAX_ID_ENCRYPTION_KEY` → deploy the encryption-with-plaintext-fallback commit (`be12f48`) → run the backfill → deploy the fallback-removal commit. After fallback removal, any decrypt failure surfaces as a 500 (real data-integrity bug, not silently masked as plaintext).
**Forward-looking export/PDF policy:** when a future PDF (W-9, lien waiver) or "with-EIN" CSV needs `tax_id`, decrypt on render with a `tax_id.rendered_in_pdf` (or analogous) audit event per render. Mirrors the reveal-endpoint pattern; never log the value itself.
**Plan source:** [docs/specs/tax_id_encryption_plan.md](tax_id_encryption_plan.md).

### `webhook_events.payload` retention
**Status:** RESOLVED (2026-04-23). 90-day scheduled purge via [src/jobs/webhook-payload-purge.ts](../../src/jobs/webhook-payload-purge.ts). Only `processed` / `delivered` rows get purged; failure states (`exhausted`, `*_failed`, `retrying`) retain indefinitely for forensics. Each run writes a batch-level audit event (`webhook-payload-purge.run_complete` with `deletedCount`).
**Why deferred originally:** encryption would have hurt debuggability; retention TTL achieves the same leak-bound goal with less friction.
**Residual:** failure-state rows retain payloads indefinitely. Acceptable because their volume is low and they carry diagnostic value a human needs to trace.

### Unbounded-growth tables: `notifications`, `audit_events`, `activity_feed_items`
**Status:** RESOLVED (2026-04-25). Three new 90-day scheduled purges:
- [src/jobs/notification-purge.ts](../../src/jobs/notification-purge.ts) — deletes rows where `read_at IS NOT NULL AND read_at < cutoff`. Unread notifications retain indefinitely (presumed actionable).
- [src/jobs/audit-event-purge.ts](../../src/jobs/audit-event-purge.ts) — deletes all rows older than 90 days. `notifications.source_audit_event_id` is `ON DELETE SET NULL`, so back-links null out cleanly; the notification's denormalized title/body copy is preserved.
- [src/jobs/activity-feed-purge.ts](../../src/jobs/activity-feed-purge.ts) — deletes all rows older than 90 days. `audit_events` remains the system-of-record for the underlying state changes.

All three follow the `webhook-payload-purge.ts` pattern, write a `*-purge.run_complete` system audit event with `deletedCount`, and are scheduled at 04:00 / 04:15 / 04:30 UTC respectively to avoid pool overlap with the existing 03:30 / 03:45 jobs.

**Residual:** 90 days of deep audit-event history is the dial — incident look-back longer than that requires a different retention number. The `audit-event-purge.run_complete` rows themselves form a self-witnessing log of the purge job.

### `messages` retention
**Status:** open — purge intentionally not implemented.
**Why deferred:** messages are real user content with long-tail PM value (RFI threads, change-order discussions become part of the project record). The `conversations` table has no `closed`/`archived` state, only `last_message_at`, so there's no clean predicate for "this conversation is settled, its messages can age out." The 90d webhook precedent doesn't apply to user-generated content.
**Unblocker:** any of (a) a conversation lifecycle state is added (closed/archived), (b) DB size becomes a real constraint, (c) a compliance requirement around user-data minimization arrives.

### R2 orphan cleanup
**Status:** open — known leak.
**Why gap exists:** [src/lib/storage.ts](../../src/lib/storage.ts) `deleteObject()` is only called in the upload-supersede path ([src/app/api/documents/[id]/supersede/route.ts](../../src/app/api/documents/[id]/supersede/route.ts)). Every other deletion path leaks the R2 object: cascade-deletes from project removal, direct row deletes, organization logo replacement, expired exports. Four tables hold storage keys: `documents.storage_key`, `prequal_documents.storage_key`, `exports.storage_key`, `organizations.logo_storage_key`.
**Why deferred:** the right fix is a mark-and-sweep design (queue table + daily processor + cascade-trigger handling), not a naive listing sweep. Needs a dedicated session.
**Unblocker:** any of (a) R2 storage cost becomes visible, (b) a compliance audit asks about file lifecycle, (c) bandwidth to design the queue + trigger architecture.

### `auth_account.{access,refresh,id}_token` encryption config
**Status:** `encryptOAuthTokens: true` is set, but the columns are always NULL today because no social providers are configured.
**Why deferred:** nothing to decrypt until social login is added. Config-flag is future-proofing only.
**Unblocker:** N/A — inert until social login is enabled.

### Row-Level Security (RLS)
**Status:** RESOLVED on dev (2026-04-26). 72 tables under RLS, all enforcing on the dev runtime role. Phase 5 close-out shipped: failure-mode test suite (5 tests) runs as the non-bypass `builtcrm_test` role and asserts cross-tenant denials, missing-GUC fail-closed, INSERT WITH CHECK rejection, and SET LOCAL transaction-scoping. CI gate (`npm run check:rls`) ratchets bare `db.*` call sites with a baseline file. Total test count: 108/108.

**Architecture:** Policy backbone is `SET LOCAL app.current_org_id` (and `app.current_user_id` for user-scoped tables) inside `withTenant(orgId, async tx => ...)` / `withTenantUser(orgId, userId, async tx => ...)` helpers. Cross-org system effects (Trigger.dev cron sweeps, anonymous webhook receivers, notification fan-out) route through `dbAdmin` (BYPASSRLS).

**Policy shapes in use** (all documented in [rls_sprint_plan.md](rls_sprint_plan.md)):
- **Pattern A** (single-org strict): `org_id = GUC`. ~30 tables.
- **Project-scoped 2-clause hybrid**: `project_id IN (own-projects) OR project_id IN (active-POMs)`. Most workflow tables (RFIs, change orders, submittals, daily logs, etc.).
- **Multi-org 3-clause hybrid (POM-bearing)**: own + project + active-POM. `lien_waivers`, `compliance_records`, `project_user_memberships`.
- **Multi-org 2-clause hybrid (POM ITSELF — recursion fix)**: avoids the C-clause that would self-reference POM. Only `project_organization_memberships`.
- **Nested-via-parent**: `parent_id IN (SELECT id FROM parent)`. Child tables (RFI responses, submittal documents, daily log children, etc.). **Caveat:** unsafe when parent FK is nullable — use the parent's project-scoped policy on the child's own column instead. Precedent: `daily_log_crew_entries`.
- **Own-side multi-org (no project)**: `field_a = GUC OR field_b = GUC`. Only `prequal_submissions` (sub + contractor 2-org contract, no project_id at upload time).
- **User-scoped**: `recipient_user_id = nullif(current_setting('app.current_user_id', true), '')::uuid`. Only `notifications`. Requires `withTenantUser`. Cross-user system writes (emit fan-out, purge cron) MUST use `dbAdmin` because WITH CHECK denies cross-user writes. The `nullif(..., '')::uuid` pattern handles the missing-GUC case by collapsing '' → NULL (comparison falsy, fails closed without a uuid-cast error).

**Latent defects fixed during the sprint:**
- BYPASSRLS dev drift — `builtcrm_app` had been silently re-granted BYPASSRLS at some point. Recreated via `scripts/recreate-builtcrm-app.sql`. Until this fix, every "policy enforcement" claim in earlier waves was a paper guarantee.
- POM clause-C recursion — the multi-org 3-clause hybrid would have planner-rejected on `project_organization_memberships` itself with a `42P17` recursion error. Fix: dropped clause C from POM's own policy (the 2-clause hybrid above). Recursion is a planner-time error, not runtime — short-circuiting OR doesn't save you. Documented in [rls_sprint_plan.md §4.2](rls_sprint_plan.md).

**Phase 5 close-out artifacts:**
- [scripts/check-rls-callsites.ts](../../scripts/check-rls-callsites.ts) — grep-based gate, ratchets via `scripts/check-rls-callsites.baseline.txt`. `npm run check:rls`.
- [scripts/create-builtcrm-test-role.sql](../../scripts/create-builtcrm-test-role.sql) — provisions the non-bypass test role.
- [tests/rls-failure-modes.test.ts](../../tests/rls-failure-modes.test.ts) — 5 negative-case tests against `builtcrm_test`.
- Per-wave smoke scripts: `scripts/_wave4-nested-smoke.mjs`, `scripts/_prequal-smoke.mjs`, `scripts/_notifications-smoke.mjs`, `scripts/_background-job-tables-smoke.mjs`.

**Residual gap — prod verification:** the `builtcrm_app NOBYPASSRLS` audit on prod is deferred until prod exists (no host picked yet — see "Hosting + transactional email deferred" in MEMORY.md). When prod stands up, run the same recreate flow used on dev (`scripts/recreate-builtcrm-app.sql`) and verify `pg_roles.rolbypassrls = false` before any user traffic.

**Residual debt — bare-db call sites:** the CI gate's baseline carries 49 tracked `db.*` sites that pre-date the sprint close. Most are false positives (writes to non-RLS tables: `auditEvents`, `users`, `subscriptionPlans`); some are real debt that the failure-mode role would catch if exercised on those routes. Pay down opportunistically; the gate prevents NEW bare calls from accumulating.

**Tables intentionally NOT RLS'd (documented to prevent re-asking):**

The following tables are *deliberately* not under RLS. Each falls into one of two patterns: (1) no tenant model — RLS would be meaningless because the row has no org_id, OR (2) cross-cutting system writers — RLS would deny legitimate cross-org writes from `system_user` / anonymous webhook receivers / Trigger.dev sweeps. Both groups go through the application-layer policy gate (§5) for read authorization; bare `db` access is acceptable here.

| Table | Bucket | Reason |
|---|---|---|
| `authUser`, `authTwoFactor`, `authSession`, `authAccount`, `authVerification` | No tenant | Better Auth machinery — managed by Better Auth itself, no org_id column. Session storage is in Upstash anyway (§4); these tables are reference rows. |
| `users` | No tenant | Shared identity layer between auth and app. A user can belong to multiple orgs (`organization_users` is the membership row, which IS Pattern A RLS'd). The `users` row itself has no org_id. |
| `organizations` | No tenant | Root tenant entity — `org_id = GUC` reduces to `id = GUC`, which is meaningless. The org IS the tenant context, not a row scoped to one. |
| `billingPackages`, `subscriptionPlans` | No tenant | Global plan catalog. Read by every org; written only by admin migrations. |
| `auditEvents` | Cross-cutting writer | Written cross-org by `system_user` (background jobs), `writeSystemAuditEvent` (cron sweeps), and anonymous webhook receivers. RLS would require a 3-way clause (own-org OR system-actor OR anonymous-context) and would still deny legitimate WITH CHECK paths. Kept un-RLS'd; reads are export-endpoint-mediated. |
| `activityFeedItems` | Cross-cutting writer | Same pattern as `auditEvents` — system fan-out from notification emit, cron jobs, and anonymous transmittal access events. |
| `projects` | Recursion gotcha | Attempted Slice A bucket 4 with the standard 2-clause hybrid (`contractor_org = GUC OR id IN (SELECT project_id FROM POM ...)`) and hit `42P17 infinite recursion`: `projects` policy queries `POM`, `POM` policy queries `projects` → mutual recursion at planner-rewrite time. Two viable fixes (SECURITY DEFINER STABLE function on the POM subquery; or Pattern A only, dropping the POM clause) — both were judged disproportionate to the marginal isolation gain. Every project-scoped child table is already RLS'd with policies that filter via `contractor_organization_id` or POM, so a SQL-injection landing under `withTenant(orgId)` cannot enumerate other tenants' project children. Un-RLS'd `projects` only exposes project metadata (name, address, contract value, status) on rows the attacker already has a tenant context for — which the app-layer `getEffectiveContext` chokepoint blocks at the loader. Decision (2026-04-26): defer indefinitely; revisit if a future product surface needs sub/client orgs to read `projects` rows under their own GUC. |

**Why this matters:** A future contributor reviewing the audit script (`scripts/_audit-rls-coverage.mjs`) will see 9 + 2 = 11 tables un-RLS'd and may try to "fix" them. This subsection is the canonical answer to "why isn't `auditEvents` RLS'd" — don't add it, the system writers depend on cross-org INSERT.

### Read-only DB role
**Status:** not provisioned.
**Why deferred:** YAGNI. No current consumer (no analytics pipeline, no reporting connection).
**Unblocker:** first real consumer — provision then.

### Per-refresh OAuth audit events
**Status:** RESOLVED (verified 2026-04-25). `src/lib/integrations/oauth.ts` `refreshToken()` writes `oauth.refresh.succeeded` per successful refresh (lines 358–365, with provider metadata) and `oauth.refresh.failed` per failure via `flagNeedsReauth()` (lines 391–404, with provider + error message). The `integration-token-refresh` scheduled job's batch-level audit remains as the run-summary; the per-invocation rows give incident-triage surface ("which specific connection started failing on date X").
**Residual:** the implementation uses direct `tx.insert(auditEvents)` rather than the `writeSystemAuditEvent` helper; behavior is equivalent but the pattern is inconsistent. Consider unifying in a future cleanup.

### Fresh-env bootstrap flow
**Status:** RESOLVED (2026-04-25). Validated against a Neon branch. Validation uncovered a critical defect: Neon's "Create role" UI grants new roles `neon_superuser` membership plus `CREATEROLE`/`CREATEDB`/`REPLICATION`/`BYPASSRLS`, **and neither `neondb_owner` nor any SQL-accessible role can downgrade these privileges** (the ADMIN OPTION is held by Neon's platform admin only). Without this fix, the entire role-split premise of §5 was a paper guarantee — `builtcrm_app` could `DROP` tables, create roles, and bypass any future RLS.
**Fix:** `scripts/new-env-bootstrap.sql` now creates `builtcrm_app` itself via SQL with explicit `NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS` attributes and a generated random password printed to stdout. The doc walkthrough was rewritten to forbid using the Neon UI for role creation, and a Step 5 verification script was added that fails loud if the runtime role can `CREATE TABLE`.
**Residual:** the verification step is manual (operator must run it after bootstrap). A future hardening pass could fold it into a `scripts/verify-bootstrap.ts` that exits non-zero on privilege drift.

---

## 7. Default-pinning discipline

Better Auth (and other libraries) ship with defaults that encode assumptions. When those defaults are security-relevant, we pin them explicitly in config rather than relying on library defaults staying the same across versions. Rationale: a default change in a minor library upgrade would silently alter our posture; an explicit value survives upgrades and shows up in code review if ever edited.

Currently pinned in [src/auth/config.ts](../../src/auth/config.ts):
| Setting | Value | Why pinned |
|---|---|---|
| `session.storeSessionInDatabase` | `false` | §4 — the whole session-in-Redis property depends on this |
| `session.cookieCache.strategy` | `"compact"` | Prevents a future default-flip to `"jwe"` from silently changing cookie cryptography |
| `session.freshAge` | `60 * 60 * 24` (1d) | Sensitive operations use fresh-age; shouldn't drift with library default |
| `session.expiresIn` | `60 * 60 * 24` (24h) | Sliding-window idle timeout — combined with `updateAge` below, gives 24h-idle semantics. Tightened 2026-04-25 from 7d. |
| `session.updateAge` | `60 * 60 * 24` (1d) | How often `expiresAt` is bumped on use. Equal to `expiresIn` so any request within 24h fully renews the window; an idle session expires after 24h. |
| `verification.storeIdentifier` | `"hashed"` | §2 — step-1 hardening |
| `account.encryptOAuthTokens` | `true` | §2 — step-1 hardening |
| `emailAndPassword.resetPasswordTokenExpiresIn` | `60 * 30` (30m) | Password reset is a high-value attacker target; 30m is tight enough to limit token-replay windows without hurting normal users on fast email pipes |
| `emailVerification.expiresIn` | `60 * 60 * 24` (24h) | Pinned to library default; verification is lower-stakes than reset, but the explicit value survives library-default flips |

When adding a new Better Auth config, ask: *does this setting affect data-at-rest, session lifecycle, or tenant isolation?* If yes, pin it and add a row to this table.

---

## 8. Zero Trust 6-Pillars mapping

Microsoft's Zero Trust framework maps security controls across six pillars. This isn't a framework we "implement" — it's a self-check. Current posture by pillar:

| Pillar | Current posture | Gaps |
|---|---|---|
| **Identity** | Better Auth with email+password, 2FA (TOTP+backup codes, encrypted at rest via Better Auth plugin default), SSO scaffolded for Enterprise (SAML), per-org 2FA-required gate, per-org session-timeout cap (hard cap from session creation), 24h sliding-window idle timeout (Better Auth `updateAge` + `expiresIn`), [session tokens hashed/moved-to-Redis](#4-session-storage-upstash-secondary-storage), [invitation tokens SHA-256 at rest](#2-data-at-rest-protections-table-by-table), self-serve account deletion (anonymize-with-30-day-grace; sole-owner block; daily anonymization sweep + 7-day reminder; sign-in blocked during grace), GDPR Article 15 self-serve data export (JSON manifest to R2 with 7-day signed URL, daily cleanup) | No programmatic per-user session bulk-revoke (other-device sessions wait for 24h idle expiry after delete request); GDPR export bundle covers a v1 subset of tables (profile, preferences, audit/messages/notifications, memberships) — construction-PM authorship rows pending follow-up |
| **Data** | AES-256-GCM for OAuth integration tokens + `organizations.tax_id`, Better Auth master-key encryption for 2FA/OAuth-login tokens, SHA-256 hashes for verification identifiers + invitation tokens + cancel-deletion tokens, bounded 90-day retention on webhook payloads + notifications + audit events + activity feed, Neon disk encryption at rest, TLS in transit everywhere | No column-level masking beyond `tax_id`; R2 orphan cleanup not implemented (see §6) |
| **Apps** | Backend-mediated authorization via the single `getEffectiveContext()` chokepoint; policy matrix in `src/domain/permissions.ts`; input validation via Zod on all mutation routes; global API error boundary in `src/lib/api/error-handler.ts` (sanitized 500s, no stack-trace leak); rate limiting on auth + invitation endpoints via `@upstash/ratelimit` | Input validation not 100% uniform across read endpoints (~5% gap, code hygiene not risk); opportunistic error-handler retrofit of the remaining ~170 routes still to do |
| **Infrastructure** | Two-role DB privilege split (`builtcrm_app` DML-only runtime, `builtcrm_admin` DDL); RLS on 72 tables enforcing on dev runtime role with `withTenant`/`withTenantUser`/`dbAdmin` chokepoints + CI gate (`npm run check:rls`) + 5-test failure-mode suite running as non-bypass `builtcrm_test`; secrets in .env.local and Neon/Upstash consoles; Sentry error monitoring (opt-in via DSN); comprehensive audit logging via `audit_events` + `writeSystemAuditEvent` for background jobs; all managed services (Neon, Upstash, R2, Render) handle underlying platform security | RLS prod-verify deferred until prod exists (§6); no formal incident response plan documented; source-map upload to Sentry not wired (deferred until deploy time) |
| **Network** | TLS-only connections (Neon requires it, Upstash requires it, R2 via HTTPS); CSRF protection via Better Auth's state cookie + SameSite cookies; rate limiting defends auth endpoints at the network edge | No WAF in front of the origin; no explicit IP-allowlist support for admin functions |
| **Devices** | Out of scope — no employee device management, no MDM. N/A until the project has employees accessing prod. | Not applicable pre-employee. |

This mapping is maintained manually — update it when any of the above statements become false. The per-control detail lives elsewhere in this doc (§§1–7); this table is the index.

---

## 9. Changelog

- **2026-04-25** — `organizations.tax_id` encrypted at rest via AES-256-GCM with a dedicated `TAX_ID_ENCRYPTION_KEY`. Loader returns masked value; plaintext only via `POST /api/org/tax-id/reveal` (rate-limited 5/min, audit-logged). UI replaces the inline input with a `<TaxIdField>` component (Reveal/Hide button) across contractor / subcontractor / commercial-client portals (residential has no tax_id). Schema migration widens the column from `varchar(40)` to `text` to accommodate ciphertext. Backfill script `scripts/backfill-encrypt-tax-id.ts` is idempotent; the decrypt-with-plaintext-fallback in the loader and reveal endpoint stays in until backfill confirms in prod, then is removed in a follow-up commit. §6 entry marked RESOLVED.
- **2026-04-25** — Session hardening pass: typed `getServerSession()` / `requireServerSession()` helpers in [src/auth/session.ts](../../src/auth/session.ts) replace the 298+ files of `session.session as unknown as { appUserId? }` casts at the auth boundary. Idle-window tightened from 7d to 24h (`session.expiresIn` lowered, `updateAge` unchanged) — active users renew on each request, idle users sign out after 24h. Per-refresh OAuth audit events verified present (`oauth.refresh.succeeded`/`oauth.refresh.failed` in [src/lib/integrations/oauth.ts](../../src/lib/integrations/oauth.ts)) and §6 entry marked RESOLVED.
- **2026-04-25** — Fresh-env bootstrap validated and a critical defect fixed. The original flow used the Neon "Create role" UI for `builtcrm_app`; validation discovered Neon-UI-created roles inherit `neon_superuser` membership and several superuser-equivalent attributes that no SQL-accessible role can revoke, defeating the §5 role split. `scripts/new-env-bootstrap.sql` rewritten to create the role itself via SQL with explicit least-privilege attributes (random password printed to stdout); `docs/specs/bootstrap_new_env.md` rewritten to forbid the Neon UI path and added a Step 5 verification check. §6 "Fresh-env bootstrap flow" entry marked RESOLVED.
- **2026-04-25** — Retention coverage extended. Added 90-day scheduled purges for `notifications` ([src/jobs/notification-purge.ts](../../src/jobs/notification-purge.ts)), `audit_events` ([src/jobs/audit-event-purge.ts](../../src/jobs/audit-event-purge.ts)), and `activity_feed_items` ([src/jobs/activity-feed-purge.ts](../../src/jobs/activity-feed-purge.ts)) — all mirroring the `webhook-payload-purge.ts` pattern with system audit events on completion. Two new gaps explicitly recorded in §6: `messages` retention (deferred — no conversation lifecycle state) and R2 orphan cleanup (deferred — needs mark-and-sweep design). §8 Data row updated.
- **2026-04-23** — Initial version. Captures step-1 hardening decisions: Upstash secondary storage for sessions, `verification.storeIdentifier: "hashed"`, `account.encryptOAuthTokens: true`, `invitations.token` SHA-256 at rest, two-role DB privilege split (`builtcrm_app` + `builtcrm_admin`), `BETTER_AUTH_SECRET` master-key model.
- **2026-04-23** — Baseline collapse (Option A). 27 hand-authored migrations flattened into a single `0000_baseline.sql` + drizzle-kit-native `meta/_journal.json` + snapshot. 8 FKs whose long-form auto-names exceeded Postgres' 63-char limit were renamed to short-form (`{src}_{col}_fk`) and declared explicitly via `foreignKey({...name})` to prevent drift. Routine schema changes now flow through `npm run db:generate` + `npm run db:migrate`; `scripts/apply-sql.ts` remains for one-off SQL. Fresh-env setup flow (new prod DB or Neon branch requires role creation + pgcrypto + `ALTER DEFAULT PRIVILEGES` before baseline) is documented here as a known gap — see §6.
- **2026-04-23** — Observability and hardening sprint (six-step, commits `84807ae` through `f56929c`).
  - **Step 1**: Global API error handler (`src/lib/api/error-handler.ts`) with SYSTEM_USER_ID audit path (`writeSystemAuditEvent` sibling to `writeAuditEvent`). Retrofitted 3 high-traffic routes; rest migrate opportunistically.
  - **Step 2**: Rate limiting via `@upstash/ratelimit` (10/min auth, 30/min invites) on `/api/auth/*` + 4 invitation-family routes. IP-keyed sliding window.
  - **Step 3**: Sentry Next.js SDK across server/edge/client runtimes. DSN-optional (no-ops cleanly when unset). Session replay deliberately disabled — tax ID / financial data in the DOM.
  - **Step 4**: Batch-level audit events at run completion for 4 scheduled jobs that were making state changes without audit trail. Consolidated `@sentry/nextjs` v10 deprecation fixes while in neighborhood.
  - **Step 5**: 90-day retention purge for `webhook_events` payloads (`src/jobs/webhook-payload-purge.ts`). Failure-state rows retained indefinitely for forensics; success-state rows aged out per SOC 2 TSC retention expectations.
  - **Step 6** (this entry): `security_posture.md` §6 updated to reflect resolved gaps + new per-refresh-OAuth-audit backlog item; new §8 Zero Trust 6-Pillars mapping; `docs/specs/compliance_map.md` added as portfolio artifact.
