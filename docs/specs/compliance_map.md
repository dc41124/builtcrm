# SOC 2 compliance map

**Scope:** a criterion-by-criterion map of how BuiltCRM's current codebase addresses the SOC 2 Trust Services Criteria (TSC). Scoped to the Common Criteria (CC1–CC9) under the Security TSC plus notes on Confidentiality and Privacy where relevant.

**Status:** this is a *readiness* map, not a formal audit artifact. BuiltCRM has not been through a SOC 2 Type 1 or Type 2 audit. This doc demonstrates the state the code is in should one be pursued — it's the portfolio companion to [security_posture.md](security_posture.md).

**Companion docs:**
- [security_posture.md](security_posture.md) — threat model, data-at-rest mechanisms, master-key rotation, known gaps
- [bootstrap_new_env.md](bootstrap_new_env.md) — fresh-env provisioning walkthrough
- [CLAUDE.md](../../CLAUDE.md) — schema change workflow and architecture rules

---

## CC1 — Control Environment

SOC 2 CC1 covers board-level governance, codes of conduct, org structure, and personnel competence. **Largely out of scope for code.** Relevant when BuiltCRM is organized as a company with employees; covered then via HR/policy artifacts, not source.

Residual code-level items:
- No hard-coded credentials in repo (verified via [.env.local](../../.env.local) gitignore + [.env.example](../../.env.example) placeholders)
- Git history preserves authorship of every change (Co-Authored-By on Claude Code commits identifies AI-assisted changes)

---

## CC2 — Communication & Information

### CC2.1 — Internal information flow
| Control | Where |
|---|---|
| Structured audit trail for every state-changing action | [`audit_events`](../../src/db/schema/audit.ts) table + [`writeAuditEvent`](../../src/domain/audit.ts) helper (ctx-based) + `writeSystemAuditEvent` (for non-interactive events: webhooks, scheduled jobs) |
| Request/response error traces | [Sentry Next.js SDK](../../sentry.server.config.ts), DSN-optional. Captures unhandled exceptions with user/org context. |
| Background job run evidence | Every scheduled task in [src/jobs/](../../src/jobs/) writes a batch-level audit event with run statistics (processed/failed counts, cutoffs, etc.) |

### CC2.3 — External communication
| Control | Where |
|---|---|
| User-facing error messages are sanitized | [src/lib/api/error-handler.ts](../../src/lib/api/error-handler.ts) returns `{ error: "internal_error" }` for unhandled exceptions — no stack trace leak |
| Rate-limit responses use standard headers | `Retry-After` header on 429 responses |

---

## CC3 — Risk Assessment

| Control | Where |
|---|---|
| Documented threat model | [security_posture.md §1](security_posture.md#1-threat-model) — what we defend against, what we don't |
| Per-system data classification | [security_posture.md §2](security_posture.md#2-data-at-rest-protections-table-by-table) — field-level audit of encrypted/hashed/plaintext columns |
| Known-gaps backlog with unblockers | [security_posture.md §6](security_posture.md#6-known-gaps-post-baseline-backlog) |

---

## CC4 — Monitoring

| Control | Where |
|---|---|
| Exception monitoring | Sentry (opt-in via `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`); captures server, edge, and client runtime errors with user/org context tags |
| Audit-event coverage on state changes | ~95% of user-facing mutations via `writeAuditEvent`; all scheduled jobs via `writeSystemAuditEvent` (Step 4 of the hardening sprint) |
| Integration failure tracking | [`integration_connections.last_error_message`](../../src/db/schema/integrations.ts) + `consecutive_errors` counter; audited via `oauth.refresh.failed` in the audit trail; flips to `needs_reauth` state when exhausted |
| Background job run tracking | Per-job `<job-id>.run_complete` audit rows with `deletedCount`, `refreshed`, `failed`, etc. |

---

## CC5 — Control Activities

### CC5.1 — Selection and development of control activities
| Control | Where |
|---|---|
| Centralized authorization policy | [src/domain/permissions.ts](../../src/domain/permissions.ts) — resource × action × role policy matrix |
| Single authorization chokepoint | `getEffectiveContext()` in [src/domain/context.ts](../../src/domain/context.ts) — every loader and action routes through it |
| Typed database access | Drizzle ORM; all queries type-checked at compile time |
| Input validation | Zod schemas on POST routes (see e.g. [src/app/api/invitations/route.ts](../../src/app/api/invitations/route.ts)) |

### CC5.2 — Technology controls
| Control | Where |
|---|---|
| Database privilege separation | Two-role split: runtime `builtcrm_app` (DML-only) via `DATABASE_URL`, admin via `DATABASE_ADMIN_URL`. Runtime role cannot `DROP`/`ALTER`/`TRUNCATE` even on credential leak. See [security_posture.md §5](security_posture.md#5-authorization). |
| Encryption at rest for secrets | AES-256-GCM for OAuth integration tokens (`INTEGRATION_ENCRYPTION_KEY`) and `organizations.tax_id` (`TAX_ID_ENCRYPTION_KEY`); Better Auth symmetric encryption for 2FA TOTP secrets + backup codes + OAuth-login tokens (future) |
| Bounded retention on payloads | 90-day purges scheduled daily: `webhook_events` success-state rows ([webhook-payload-purge.ts](../../src/jobs/webhook-payload-purge.ts)), read `notifications` ([notification-purge.ts](../../src/jobs/notification-purge.ts)), `audit_events` ([audit-event-purge.ts](../../src/jobs/audit-event-purge.ts)), `activity_feed_items` ([activity-feed-purge.ts](../../src/jobs/activity-feed-purge.ts)) |

---

## CC6 — Logical & Physical Access Controls

### CC6.1 — Logical access provisioning
| Control | Where |
|---|---|
| Authentication | Better Auth with email+password. `minPasswordLength: 8`; hashed via Better Auth's default password-hash (one-way; not reversibly encrypted). |
| Multi-factor authentication | 2FA via TOTP + backup codes. Per-org `requireTwoFactorOrg` flag enforced at session-create time (throws `TWO_FACTOR_REQUIRED` if user lacks enrollment on an org requiring it). |
| SSO (SAML) | Scaffolded in [src/auth/sso-plugin.ts](../../src/auth/sso-plugin.ts); Enterprise-plan gated |
| Invitation-only access | Self-serve signup disabled; entry via tokenized invite URL (SHA-256-hashed at rest per [security_posture.md §2](security_posture.md#2-data-at-rest-protections-table-by-table)) |

### CC6.2 — Access modification
| Control | Where |
|---|---|
| Role-based access with project-level overrides | `role_assignments` table + `project_user_memberships` narrowing (phase/work scope fields) |
| Org domain-lock for invitations | `organizations.allowed_email_domains` rejects out-of-domain invites |
| Portal isolation | Cross-portal access restricted in the policy matrix; client owners can only invite client users, sub owners only sub users |

### CC6.6 — Restriction of access
| Control | Where |
|---|---|
| Rate limiting | [src/lib/ratelimit.ts](../../src/lib/ratelimit.ts) via `@upstash/ratelimit`. 10 req/min on `/api/auth/*` POST; 30 req/min on invitation-family endpoints |
| Session timeout | Per-org `session_timeout_minutes` cap applied at session creation in [src/auth/config.ts](../../src/auth/config.ts); Better Auth enforces expiry on every `getSession()` |
| Session storage isolation | Sessions live in Upstash Redis, not Postgres. `storeSessionInDatabase: false` is pinned. A Postgres leak cannot reveal active session tokens. See [security_posture.md §4](security_posture.md#4-session-storage-upstash-secondary-storage). |
| Reviewer token expiry | External reviewer invites have configurable `expiresInDays` (default 14, max 180) |

---

## CC7 — System Operations

### CC7.2 — Failure detection
| Control | Where |
|---|---|
| Global API error handler | [src/lib/api/error-handler.ts](../../src/lib/api/error-handler.ts) `withErrorHandler()` wraps routes; catches unhandled exceptions, reports to Sentry, writes audit row |
| Retry with exponential backoff on webhook processing | [src/jobs/integration-webhook-processor.ts](../../src/jobs/integration-webhook-processor.ts) — base 10s × 2^attempt with ±20% jitter; max 6 attempts before `exhausted` |
| Stripe reconciliation | [src/jobs/stripe-payment-reconciliation.ts](../../src/jobs/stripe-payment-reconciliation.ts) — detects drift between local `payment_transactions` and Stripe, audits discrepancies |
| Rate-limit 429 responses with `Retry-After` | [src/lib/ratelimit.ts](../../src/lib/ratelimit.ts) |

### CC7.3 — Incident response
**Status: partial.** No formal IR runbook yet. Signals available: Sentry dashboard (when DSN set), `audit_events` table query, Trigger.dev run history. Runbook to be authored when go-live nears.

---

## CC8 — Change Management

| Control | Where |
|---|---|
| Source-controlled schema changes | drizzle-kit-native workflow: `npm run db:generate` → `npm run db:migrate` (see [CLAUDE.md § Schema change workflow](../../CLAUDE.md)) |
| Baseline snapshot + journal | [src/db/migrations/0000_baseline.sql](../../src/db/migrations/0000_baseline.sql) + `meta/_journal.json`; drift prevention via explicit `foreignKey()` naming where long-form names would exceed Postgres' 63-char limit |
| One-off SQL via tracked script | [scripts/apply-sql.ts](../../scripts/apply-sql.ts) (uses `DATABASE_ADMIN_URL` for DDL privilege) |
| Fresh-env bootstrap documented | [bootstrap_new_env.md](bootstrap_new_env.md) |
| Stop-and-ask triggers for risky changes | CLAUDE.md captures universal triggers (schema changes, auth edits, new dependencies, etc.) |

---

## CC9 — Risk Mitigation

| Control | Where |
|---|---|
| Business continuity via managed services | Neon (Postgres) + Upstash (Redis) + R2 (storage) — all provider-managed redundancy |
| Key rotation awareness | Master-key rotation impact documented in [security_posture.md §3](security_posture.md#3-master-key-better_auth_secret) — sessions invalidate, 2FA re-enroll needed, OAuth re-link needed |
| Dependency discipline | Lockfile committed (`package-lock.json`); additions are stop-and-ask triggers per CLAUDE.md |

---

## Confidentiality TSC (optional)

| Criterion | Where |
|---|---|
| C1.1 — information protected per policy | [security_posture.md §2](security_posture.md#2-data-at-rest-protections-table-by-table) tables every sensitive field + its mechanism |
| C1.2 — information disposed per policy | 90-day purges on `webhook_events`, `notifications` (read), `audit_events`, `activity_feed_items`; sync-event cleanup; drizzle-kit-managed baseline prevents orphan migration SQL |

---

## Privacy TSC (optional — required if selling to CA/EU)

| Criterion | Where | Gap |
|---|---|---|
| P1 — notice of privacy practices | Placeholder in auth/signup pages | No formal privacy policy page |
| P2 — choice and consent | Invitation-only access; no self-serve signup means every user is affirmatively invited | No explicit consent-capture flow |
| P3.1 — collection | Zod-validated at every input boundary | — |
| P4 — use, retention, and disposal | 90-day webhook retention; tax IDs plaintext (policy-pending) | **No user-initiated account deletion** (blocking for EU/CA users) |
| P5 — access to personal info | Users can see their own profile data via the portal | No export-my-data flow (GDPR Article 15) |
| P6.1 — disclosure to third parties | Only Stripe, Upstash, R2, Neon, Trigger.dev — all listed in .env.example; no other data sharing | No formal DPA list maintained |

**Primary blocker for CA/EU launch (RESOLVED 2026-04-25):** user deletion + GDPR Article 15 export both shipped. Approach per [user_deletion_and_export_plan.md](user_deletion_and_export_plan.md): anonymize-with-30-day-grace for deletion (preserves construction-contract authorship via the 39 RESTRICT FKs); JSON manifest to R2 with 7-day signed URL for export. Email infra is still a console-log stub — wire to Postmark/SendGrid before actually serving EU/CA customers so the cancel-link + download-link emails reach inboxes.

---

## What this map deliberately does NOT cover

- **Formal SOC 2 Type 1 or Type 2 audit.** A certified audit requires: an engagement with a CPA firm, 6–12 months of operating history for Type 2, auditor-selected sample tests. This map exists so that when that engagement starts, the code-side work is already done.
- **ISO 27001 ISMS.** Bigger investment (policies, risk register, ISMS committee). Not currently scoped.
- **HIPAA.** Construction isn't PHI; N/A unless healthcare-construction becomes a target market.
- **PCI DSS beyond SAQ A.** Stripe handles card data; BuiltCRM never touches PAN — no additional PCI scope.
- **Third-party attestations and DPA templates.** Vendor management artifacts outside the codebase.

---

## Changelog

- **2026-04-25** — Retention coverage row in CC5.2 + C1.2 expanded to enumerate the four 90-day purge jobs (was just `webhook_events`). Two new known gaps cross-referenced from `security_posture.md §6`: `messages` retention deferred and R2 orphan cleanup deferred.
- **2026-04-23** — Initial map, written at the close of the observability + hardening sprint. Reflects the state of the codebase as of commits `84807ae` through `f56929c`. Expect this doc to drift if the code changes and this file doesn't — keep it paired with reality by updating during reviews that touch security-adjacent code.
