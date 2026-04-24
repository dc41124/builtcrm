# Security Posture

**Last reviewed:** 2026-04-23
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
- **Authorized internal user with database access** — privilege separation reduces blast radius but does not eliminate it. No RLS, no column-level masking (deferred — see §6).
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
| `organizations` | `tax_id` | Policy decision deferred (see §6). Currently protected only by disk-level encryption + org-admin access policy. |
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
- **Prod:** TBD — decision required before Render prod deploy. Candidates under consideration:
  - *Render environment variables* — simplest, acceptable baseline. Encrypted at rest, access-controlled by Render role.
  - *Doppler* — mid-range. Better audit trail and rotation story than Render env vars, integrates with Render, low operational overhead.
  - *AWS Secrets Manager* — heavyweight. Appropriate only if we're already in AWS elsewhere.

  **Decision criteria:** rotation support, audit trail, access control granularity.
  **Default starting posture** if no stronger case emerges: Render env vars, with an explicit commit to revisit when rotation cadence or audit-trail needs exceed Render's surface. Re-evaluation trigger: any of (a) first planned rotation event, (b) first compliance/audit engagement requiring secret-access logs, (c) more than ~3 engineers with Render prod access.

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
- **Row-Level Security (RLS).** All tenant isolation is application-logic. No DB-layer backstop if an authz bug lets a request query another org's rows. Deferred to a post-baseline sprint — see §6.
- **Read-only role** for analytics / reporting / debugging. Deferred until an actual consumer exists.

---

## 6. Known gaps (post-baseline backlog)

Each of these was explicitly deferred during the step-1 hardening pass. Entries list what, why deferred, and what the decision input is.

### `organizations.tax_id` encryption
**Status:** plaintext.
**Why deferred:** encrypting requires product decisions — display masking (`***-**-1234`?), who can view unmasked (org admins only? audit every read?), search/filter behavior, CSV export treatment. Not a migration; a design conversation.
**Unblocker:** product decision on display and access policy.

### `webhook_events.payload` retention
**Status:** RESOLVED (2026-04-23). 90-day scheduled purge via [src/jobs/webhook-payload-purge.ts](../../src/jobs/webhook-payload-purge.ts). Only `processed` / `delivered` rows get purged; failure states (`exhausted`, `*_failed`, `retrying`) retain indefinitely for forensics. Each run writes a batch-level audit event (`webhook-payload-purge.run_complete` with `deletedCount`).
**Why deferred originally:** encryption would have hurt debuggability; retention TTL achieves the same leak-bound goal with less friction.
**Residual:** failure-state rows retain payloads indefinitely. Acceptable because their volume is low and they carry diagnostic value a human needs to trace.

### `auth_account.{access,refresh,id}_token` encryption config
**Status:** `encryptOAuthTokens: true` is set, but the columns are always NULL today because no social providers are configured.
**Why deferred:** nothing to decrypt until social login is added. Config-flag is future-proofing only.
**Unblocker:** N/A — inert until social login is enabled.

### Row-Level Security (RLS)
**Status:** not implemented.
**Why deferred:** RLS requires `SET LOCAL` of tenant context on every connection via middleware. A bug in that plumbing (connection pool reuse, missed reset, request cross-contamination) can cause worse leaks than the current app-layer-only approach. Needs a dedicated sprint with policy coverage, pooling integration, and failure-mode testing.
**Unblocker:** scheduled as a post-Phase-4+ hardening sprint.

### Read-only DB role
**Status:** not provisioned.
**Why deferred:** YAGNI. No current consumer (no analytics pipeline, no reporting connection).
**Unblocker:** first real consumer — provision then.

### Per-refresh OAuth audit events
**Status:** open.
**Why gap exists:** `src/lib/integrations/oauth.ts` `refreshToken()` doesn't currently write a per-invocation audit event. The `integration-token-refresh` scheduled job writes a batch-level audit with `checked / refreshed / failed` counts (sufficient for compliance), but individual refresh success/failure rows would be useful for incident triage ("which specific connection started failing on date X").
**Unblocker:** dedicated small pass on `oauth.ts` to emit `oauth.refresh.success` / `oauth.refresh.failure` per connection. Out of scope for the Step 4 hardening — that step was explicitly batch-level.

### Fresh-env bootstrap flow
**Status:** documented but untested. [docs/specs/bootstrap_new_env.md](bootstrap_new_env.md) walks through the full sequence: role creation in Neon, env vars, `scripts/new-env-bootstrap.sql` for extension + default privileges, `npm run db:migrate` to apply the baseline. Script is idempotent.
**Why still listed here:** the flow hasn't been exercised against a real fresh environment — current dev DB was built incrementally before the baseline collapse. First provisioning of a new env (prod, new Neon branch, clean dev) is the ground-truth test; if anything's wrong, update the doc.
**Unblocker:** resolved once first fresh env is successfully stood up and the walkthrough is confirmed accurate.

---

## 7. Default-pinning discipline

Better Auth (and other libraries) ship with defaults that encode assumptions. When those defaults are security-relevant, we pin them explicitly in config rather than relying on library defaults staying the same across versions. Rationale: a default change in a minor library upgrade would silently alter our posture; an explicit value survives upgrades and shows up in code review if ever edited.

Currently pinned in [src/auth/config.ts](../../src/auth/config.ts):
| Setting | Value | Why pinned |
|---|---|---|
| `session.storeSessionInDatabase` | `false` | §4 — the whole session-in-Redis property depends on this |
| `session.cookieCache.strategy` | `"compact"` | Prevents a future default-flip to `"jwe"` from silently changing cookie cryptography |
| `session.freshAge` | `60 * 60 * 24` (1d) | Sensitive operations use fresh-age; shouldn't drift with library default |
| `verification.storeIdentifier` | `"hashed"` | §2 — step-1 hardening |
| `account.encryptOAuthTokens` | `true` | §2 — step-1 hardening |

When adding a new Better Auth config, ask: *does this setting affect data-at-rest, session lifecycle, or tenant isolation?* If yes, pin it and add a row to this table.

---

## 8. Zero Trust 6-Pillars mapping

Microsoft's Zero Trust framework maps security controls across six pillars. This isn't a framework we "implement" — it's a self-check. Current posture by pillar:

| Pillar | Current posture | Gaps |
|---|---|---|
| **Identity** | Better Auth with email+password, 2FA (TOTP+backup codes, encrypted at rest via Better Auth plugin default), SSO scaffolded for Enterprise (SAML), per-org 2FA-required gate, per-org session-timeout cap, [session tokens hashed/moved-to-Redis](#4-session-storage-upstash-secondary-storage), [invitation tokens SHA-256 at rest](#2-data-at-rest-protections-table-by-table) | Idle-based session timeout (wall-clock only today); user-initiated account deletion not yet surfaced |
| **Data** | AES-256-GCM for OAuth integration tokens, Better Auth master-key encryption for 2FA/OAuth-login tokens, SHA-256 hashes for verification identifiers + invitation tokens, bounded 90-day retention on webhook payloads, Neon disk encryption at rest, TLS in transit everywhere | `tax_id` still plaintext (policy-pending); no column-level masking; no user-deletion / anonymization primitive |
| **Apps** | Backend-mediated authorization via the single `getEffectiveContext()` chokepoint; policy matrix in `src/domain/permissions.ts`; input validation via Zod on all mutation routes; global API error boundary in `src/lib/api/error-handler.ts` (sanitized 500s, no stack-trace leak); rate limiting on auth + invitation endpoints via `@upstash/ratelimit` | Input validation not 100% uniform across read endpoints (~5% gap, code hygiene not risk); opportunistic error-handler retrofit of the remaining ~170 routes still to do |
| **Infrastructure** | Two-role DB privilege split (`builtcrm_app` DML-only runtime, `builtcrm_admin` DDL); secrets in .env.local and Neon/Upstash consoles; Sentry error monitoring (opt-in via DSN); comprehensive audit logging via `audit_events` + `writeSystemAuditEvent` for background jobs; all managed services (Neon, Upstash, R2, Render) handle underlying platform security | No RLS (deferred — see §6); no formal incident response plan documented; source-map upload to Sentry not wired (deferred until deploy time) |
| **Network** | TLS-only connections (Neon requires it, Upstash requires it, R2 via HTTPS); CSRF protection via Better Auth's state cookie + SameSite cookies; rate limiting defends auth endpoints at the network edge | No WAF in front of the origin; no explicit IP-allowlist support for admin functions |
| **Devices** | Out of scope — no employee device management, no MDM. N/A until the project has employees accessing prod. | Not applicable pre-employee. |

This mapping is maintained manually — update it when any of the above statements become false. The per-control detail lives elsewhere in this doc (§§1–7); this table is the index.

---

## 9. Changelog

- **2026-04-23** — Initial version. Captures step-1 hardening decisions: Upstash secondary storage for sessions, `verification.storeIdentifier: "hashed"`, `account.encryptOAuthTokens: true`, `invitations.token` SHA-256 at rest, two-role DB privilege split (`builtcrm_app` + `builtcrm_admin`), `BETTER_AUTH_SECRET` master-key model.
- **2026-04-23** — Baseline collapse (Option A). 27 hand-authored migrations flattened into a single `0000_baseline.sql` + drizzle-kit-native `meta/_journal.json` + snapshot. 8 FKs whose long-form auto-names exceeded Postgres' 63-char limit were renamed to short-form (`{src}_{col}_fk`) and declared explicitly via `foreignKey({...name})` to prevent drift. Routine schema changes now flow through `npm run db:generate` + `npm run db:migrate`; `scripts/apply-sql.ts` remains for one-off SQL. Fresh-env setup flow (new prod DB or Neon branch requires role creation + pgcrypto + `ALTER DEFAULT PRIVILEGES` before baseline) is documented here as a known gap — see §6.
- **2026-04-23** — Observability and hardening sprint (six-step, commits `84807ae` through `f56929c`).
  - **Step 1**: Global API error handler (`src/lib/api/error-handler.ts`) with SYSTEM_USER_ID audit path (`writeSystemAuditEvent` sibling to `writeAuditEvent`). Retrofitted 3 high-traffic routes; rest migrate opportunistically.
  - **Step 2**: Rate limiting via `@upstash/ratelimit` (10/min auth, 30/min invites) on `/api/auth/*` + 4 invitation-family routes. IP-keyed sliding window.
  - **Step 3**: Sentry Next.js SDK across server/edge/client runtimes. DSN-optional (no-ops cleanly when unset). Session replay deliberately disabled — tax ID / financial data in the DOM.
  - **Step 4**: Batch-level audit events at run completion for 4 scheduled jobs that were making state changes without audit trail. Consolidated `@sentry/nextjs` v10 deprecation fixes while in neighborhood.
  - **Step 5**: 90-day retention purge for `webhook_events` payloads (`src/jobs/webhook-payload-purge.ts`). Failure-state rows retained indefinitely for forensics; success-state rows aged out per SOC 2 TSC retention expectations.
  - **Step 6** (this entry): `security_posture.md` §6 updated to reflect resolved gaps + new per-refresh-OAuth-audit backlog item; new §8 Zero Trust 6-Pillars mapping; `docs/specs/compliance_map.md` added as portfolio artifact.
