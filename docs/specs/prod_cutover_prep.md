# Prod cutover prep — env audit, Render config, email design

**Status:** design only. No code, no new deps installed yet.
**As of:** 2026-04-27.
**Purpose:** capture findings + decisions for the hosting + email
unblock that's currently waiting on (a) domain purchase, (b) Render
account, (c) Resend account. When those land, this doc is the
mechanical wire-up checklist.

Related docs:
- [`security_posture.md` §6](security_posture.md#hosting--secrets-storage-decision-blocks-every-prod-deploy-step) — what was blocked on this.
- [`bootstrap_new_env.md`](bootstrap_new_env.md) — fresh-DB provisioning (already validated).
- [`rollback_strategy.md`](rollback_strategy.md) — incident response.

---

## 1. Env-var manifest (canonical)

Cross-checked `src/lib/env.ts` (zod schema), `.env.example`, and every
`process.env.X` reference under `src/`. Three real contract bugs found
and listed in §1.4 below. The manifest in §1.1–§1.3 lists the **correct**
names — set these in Render.

### 1.1 Required for any environment (prod or dev)

| Var | Source | Notes |
|---|---|---|
| `DATABASE_URL` | `src/db/client.ts` | Postgres connection string. **Connect as `builtcrm_app`** (NOBYPASSRLS, DML only — see [`bootstrap_new_env.md`](bootstrap_new_env.md)). |
| `DATABASE_ADMIN_URL` | `src/db/admin-pool.ts`, `src/db/admin-client.ts`, `src/db/seed.ts`, `src/lib/env.ts` | Admin connection. Used by drizzle-kit (`db:generate`, `db:migrate`), seed, scripts/apply-sql.ts, and the BYPASSRLS pool that backs `dbAdmin`. Connect as `neondb_owner` (Neon) or equivalent DDL-capable role. **Required in prod** — the `dbAdmin` pool is load-bearing for system writes (Trigger.dev sweeps, anonymous webhook receivers, GDPR export, fan-out). Falls back to `DATABASE_URL` only if absent, which fails closed in a split-role prod. |
| `BETTER_AUTH_SECRET` | env.ts | ≥32 chars. Generate with `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | env.ts | Public base URL of the app, e.g. `https://app.example.com`. |
| `R2_ACCOUNT_ID` | env.ts → `src/lib/storage.ts` | Cloudflare R2 account id. |
| `R2_ACCESS_KEY_ID` | env.ts → storage.ts | R2 access key. |
| `R2_SECRET_ACCESS_KEY` | env.ts → storage.ts | R2 secret. |
| `R2_BUCKET_NAME` | env.ts → storage.ts | **Note:** zod schema validates `R2_BUCKET_NAME`; `.env.example` calls it `R2_BUCKET`. App is correct — `.env.example` is wrong. See §1.4. |
| `UPSTASH_REDIS_REST_URL` | `src/lib/redis.ts`, `src/auth/secondary-storage.ts` | Backs Better Auth secondary storage + Upstash rate-limiter. |
| `UPSTASH_REDIS_REST_TOKEN` | redis.ts, secondary-storage.ts | |
| `TAX_ID_ENCRYPTION_KEY` | `src/lib/integrations/crypto.ts` | 32 bytes base64 (`openssl rand -base64 32`). Encrypts `organizations.tax_id` at rest. **Held separately from `INTEGRATION_ENCRYPTION_KEY` so a leak of one does not compromise the other.** |
| `INTEGRATION_ENCRYPTION_KEY` | `src/lib/integrations/crypto.ts` | 32 bytes base64. Encrypts OAuth access/refresh tokens in `integration_connections`. **Not in `env.ts`** today — read at integration use time and would throw lazily. Should be added to env.ts so missing-key fails loud at boot. |
| `INTEGRATION_STATE_SECRET` | `src/lib/integrations/state.ts` | 32 bytes base64. HMAC-SHA256 key for the OAuth `state` CSRF parameter. Same lazy-read pattern as above. |
| `TRIGGER_SECRET_KEY` | Trigger.dev SDK reads it directly | Trigger.dev v3 standard env var name. **Note:** zod schema currently validates `TRIGGER_DEV_API_KEY` (wrong — see §1.4). |
| `NEXT_PUBLIC_APP_URL` | `src/lib/stripe.ts`, `src/lib/saml/client.ts`, `src/auth/client.ts`, invitations + invite-reviewer routes | Public app URL (for Stripe Checkout redirects, SAML SP metadata, invite links). **Not in `env.ts` and not in `.env.example`** today — SAML and Stripe throw if unset, invite routes fall back to `http://localhost:3000` (prod safety bug). See §1.4. |

### 1.2 Required for email (NEW — see §3 for design)

| Var | Notes |
|---|---|
| `RESEND_API_KEY` | New. From resend.com → API keys. |
| `EMAIL_FROM` | New. e.g. `BuiltCRM <noreply@app.example.com>` (display name optional). |
| `EMAIL_REPLY_TO` | Optional. Where users hit "reply" — typically `support@example.com`. |

### 1.3 Required if the corresponding feature is live in prod

| Var | Feature gate | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | Billing | `src/lib/stripe.ts` lazy-throws if unset. |
| `STRIPE_WEBHOOK_SECRET` | Billing | Same. |
| `SENTRY_DSN` | Error monitoring | Optional. App no-ops cleanly when unset. |
| `NEXT_PUBLIC_SENTRY_DSN` | Client-side errors | Optional. |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Source-map upload at build | Optional; needed only for symbolicated stack traces. Render's build step needs these if you want the upload. |
| `QUICKBOOKS_CLIENT_ID` / `QUICKBOOKS_CLIENT_SECRET` / `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN` | QuickBooks integration | Catalog-only today — leave unset until the integration ships. |
| `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` / `XERO_WEBHOOK_KEY` | Xero | Same. |
| `SAGE_CLIENT_ID` / `SAGE_CLIENT_SECRET` / `SAGE_WEBHOOK_SECRET` | Sage | Same. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Calendar | Same. |
| `ALLOW_PROD_SEED` | Seed script in prod | Set to `1` only if intentionally reseeding prod (it gates `src/db/seed.ts:159`). Leave **unset**. |

### 1.4 Contract bugs to fix before prod (3)

These are existing drift between `env.ts`, `.env.example`, and what
the app actually reads. Fix these in a separate small commit before
the prod cutover so the manifest matches what's set in Render.

1. **`R2_BUCKET` vs `R2_BUCKET_NAME`.** `.env.example:13` says `R2_BUCKET=`. `src/lib/env.ts:15` validates `R2_BUCKET_NAME`. Only the env var actually consumed is `R2_BUCKET_NAME` (via `env.R2_BUCKET_NAME` in `src/lib/storage.ts:23`). The `R2_BUCKET` constant in code is just a re-export. **Fix:** rename the line in `.env.example` to `R2_BUCKET_NAME`.
2. **`TRIGGER_SECRET_KEY` vs `TRIGGER_DEV_API_KEY`.** `.env.example:30`, `bootstrap_new_env.md`, `rollback_strategy.md`, and Trigger.dev's own SDK documentation all use `TRIGGER_SECRET_KEY`. `src/lib/env.ts:16` and `tests/setup.ts:86` validate `TRIGGER_DEV_API_KEY`. The SDK reads its env var itself; the zod schema is gating on a name that doesn't actually drive behavior. **Fix:** rename in `env.ts` to `TRIGGER_SECRET_KEY` and align `tests/setup.ts`. (`current_repo_state_2026-04-16.md` flagged this as drift back in April; never got cleaned up.)
3. **`NEXT_PUBLIC_APP_URL` missing from env.ts and .env.example.** Used in 5 places (stripe.ts, saml/client.ts, auth/client.ts, invitations/route.ts, submittals/invite-reviewer/route.ts). SAML and Stripe throw with helpful messages when it's unset; invite-token email links fall back to `http://localhost:3000` (real prod bug — emails would link to localhost). **Fix:** add `NEXT_PUBLIC_APP_URL: z.string().url()` to env.ts so missing-value fails at boot, and document it in `.env.example`.

### 1.5 Notes on validation strategy

- `env.ts` validates 14 vars at boot. Adding `INTEGRATION_ENCRYPTION_KEY`, `INTEGRATION_STATE_SECRET`, and `NEXT_PUBLIC_APP_URL` would add 3 more. **Recommendation:** add them. Lazy-throw at integration time means a misconfigured prod deploy looks healthy until the first OAuth callback or Stripe redirect. Boot-time validation catches it during the deploy.
- Stripe vars are intentionally NOT in env.ts (lazy-validated in `stripe.ts`) because the app should run without billing in dev / preview. Keep this pattern.
- Email vars (`RESEND_API_KEY`, `EMAIL_FROM`) — recommend adding to env.ts as **required** in prod, optional in dev (similar to Sentry's no-op fallback). See §3.4 for the env shape.

---

## 2. Render config (design — no code yet)

Current state: **no Dockerfile, no render.yaml, no .dockerignore.** The
repo runs `next dev` / `next build` / `next start` directly via npm
scripts. CLAUDE.md says "Docker on Render," and `next.config.mjs:57`
references `automaticVercelMonitors: false` ("we deploy on Render, not
Vercel") — so Render is the documented target. We just don't have the
container scaffolding yet.

### 2.1 What needs to exist

1. **`Dockerfile`** — multi-stage, Node 22 LTS base, standalone Next.js output, non-root runtime user.
2. **`.dockerignore`** — exclude `.next`, `node_modules`, `.env*`, `tsconfig.tsbuildinfo`, `.trigger`, `docs/`, tests, etc. Without this, build context is hundreds of MB.
3. **`next.config.mjs` change** — add `output: "standalone"` so the production image is ~150 MB instead of ~1.5 GB.
4. **`render.yaml`** — declarative service config so the wire-up is reproducible. Defines the web service, env-var manifest (with `sync: false` for secrets), build command, start command, healthcheck path, region, plan.
5. **`/api/health` endpoint** — Render's healthcheck pings this to decide if a deploy is healthy. Should: return 200 if the app can connect to Postgres + Upstash; return 503 otherwise. Lives at `src/app/api/health/route.ts`.
6. **`.nvmrc`** — pin Node version (currently no pin; Render and Docker should agree).

### 2.2 Dockerfile shape (sketch)

```dockerfile
# Stage 1 — install deps
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=optional

# Stage 2 — build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Sentry source-map upload happens here when SENTRY_AUTH_TOKEN is set
RUN npm run build

# Stage 3 — runtime
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

Notes:
- Standalone output means we copy `server.js` (Next's bundled server), not run `next start`. Smaller image, faster boot.
- `--omit=optional` skips optional deps that bloat node_modules (lightningcss native binaries, etc.).
- Non-root runtime user is a defense-in-depth basic.

### 2.3 render.yaml shape (sketch)

```yaml
services:
  - type: web
    name: builtcrm
    runtime: docker
    plan: starter           # upgrade as load demands
    region: oregon          # match Neon region
    healthCheckPath: /api/health
    autoDeploy: true        # main branch
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      # Required secrets — set via dashboard, not in this file
      - key: DATABASE_URL
        sync: false
      - key: DATABASE_ADMIN_URL
        sync: false
      - key: BETTER_AUTH_SECRET
        sync: false
      - key: BETTER_AUTH_URL
        sync: false
      - key: NEXT_PUBLIC_APP_URL
        sync: false
      - key: R2_ACCOUNT_ID
        sync: false
      - key: R2_ACCESS_KEY_ID
        sync: false
      - key: R2_SECRET_ACCESS_KEY
        sync: false
      - key: R2_BUCKET_NAME
        sync: false
      - key: UPSTASH_REDIS_REST_URL
        sync: false
      - key: UPSTASH_REDIS_REST_TOKEN
        sync: false
      - key: TAX_ID_ENCRYPTION_KEY
        sync: false
      - key: INTEGRATION_ENCRYPTION_KEY
        sync: false
      - key: INTEGRATION_STATE_SECRET
        sync: false
      - key: TRIGGER_SECRET_KEY
        sync: false
      - key: RESEND_API_KEY
        sync: false
      - key: EMAIL_FROM
        sync: false
      - key: STRIPE_SECRET_KEY
        sync: false
      - key: STRIPE_WEBHOOK_SECRET
        sync: false
      - key: SENTRY_DSN
        sync: false
      - key: NEXT_PUBLIC_SENTRY_DSN
        sync: false
```

Notes:
- `sync: false` means Render will NOT echo the value across environments — required for secrets.
- `region: oregon` should match wherever the Neon database lives — cross-region adds 50-100ms to every query.
- Plan starts at `starter`. Real prod likely wants `standard` or `pro` for the autoscaling + memory headroom, but `starter` is fine for portfolio demo traffic.

### 2.4 Healthcheck endpoint (`/api/health`) — design

```ts
// src/app/api/health/route.ts (sketch)
export async function GET() {
  // 1. Ping Postgres via the runtime pool.
  //    Use SELECT 1, no transaction needed.
  // 2. Ping Upstash via redis.ping().
  // 3. Return 200 with {status: "ok", checks: {db, redis}}.
  // 4. On any failure, return 503 with {status: "degraded", failed: [...]}.
}
```

Key design decisions:
- **No auth on this endpoint** — Render must be able to hit it anonymously.
- **Don't ping Stripe / Resend / R2** — too many external deps would make deploys flaky. Only ping things in our deployment failure domain (DB, Redis).
- **Don't ping `dbAdmin`** — that pool only exists if `DATABASE_ADMIN_URL` is set, and pinging two pools per healthcheck is overkill. Trust the runtime pool's reachability.
- **Cache nothing** — healthchecks should reflect live state.

### 2.5 Trigger.dev — separate concern

Trigger.dev jobs do NOT run inside the Render web service. They run on
Trigger.dev's own infra, deployed via `npm run trigger:deploy`. The
Render service only needs `TRIGGER_SECRET_KEY` so that any web-side
code that *queues* a job (e.g. account-deletion confirmation in
`src/lib/user-deletion/`) can talk to Trigger's API.

This means Render and Trigger.dev are deployed independently:
- Render: `git push origin main` → autoDeploys the web app.
- Trigger.dev: `npm run trigger:deploy` (CLI from local or CI) → deploys job code.

Worth a note in the cutover sequence (§4) so we don't forget to deploy
the jobs.

---

## 3. Email design — `src/lib/email/`

Three console-log stubs to replace, plus the Better Auth callback.
Resend (recommended) or Postmark (alternative).

### 3.1 The 4 send sites

| Function | Lives in | Trigger | Recipient | Notes |
|---|---|---|---|---|
| `sendResetPassword` | `src/auth/config.ts:47` (Better Auth callback) | `POST /api/auth/forgot-password` | the user | Token expires in 30m. |
| `sendDeletionConfirmationEmail` | `src/lib/user-deletion/email.ts` | `POST /api/user/deletion` | the user | Cancel link valid until anonymization. |
| `sendDeletionReminderEmail` | `src/lib/user-deletion/email.ts` | `deletion-reminder-sweep.ts` job (T-7d) | the user | Same cancel link, last chance. |
| `sendDataExportReadyEmail` | `src/lib/user-export/email.ts` | `data-export-cleanup.ts` adjacent flow | the user | Download link expires after 7 days. |

All 4 are **transactional system mail to a single recipient** —
no marketing, no batching, no bcc. This shapes the design: a single
low-level `sendEmail()` primitive plus 4 thin templated wrappers.

### 3.2 Module shape

```
src/lib/email/
  index.ts             ← re-exports the 4 send fns
  client.ts            ← Resend client singleton
  send.ts              ← low-level sendEmail({to, subject, react, text})
  templates/
    reset-password.tsx          ← React Email component
    deletion-confirmation.tsx
    deletion-reminder.tsx
    export-ready.tsx
  senders/
    reset-password.ts           ← thin wrapper: takes domain inputs, renders template, calls sendEmail
    deletion.ts                 ← exports sendDeletionConfirmationEmail + sendDeletionReminderEmail
    export.ts                   ← exports sendDataExportReadyEmail
```

Key design decisions:
- **Provider abstraction is thin.** `client.ts` exports a single `resend` client. If we ever swap to Postmark, that's a one-file change. Don't pre-build a generic `EmailProvider` interface — YAGNI.
- **React Email for templates.** The `@react-email/components` package gives us a tested set of email-safe components (table-based layouts, inline CSS, Outlook quirks handled). Resend already integrates with it natively. Renders to both HTML and plaintext.
- **Senders are domain-shaped.** `sendDeletionConfirmationEmail({ toEmail, cancelToken, scheduledForAnonymizationAt })` — the same shape the existing stubs already have. The replacement is mechanical: the call sites don't change, only the implementation.
- **No queueing layer.** These emails are sync — sent inline from the request handler or job. If Resend is down, the request fails (and the job retries via Trigger.dev's built-in retry). Don't build a custom outbox unless we hit an actual reliability problem.
- **Audit on every send.** `sendEmail()` writes a `system_audit_event` row with `event_kind = "email.sent"`, `subject_kind` = the send-fn name, `metadata` = `{ recipient_hash, message_id }`. Hash the recipient (SHA-256) in the audit row so PII isn't replicated to the audit table. This gives compliance ("did we send the GDPR email?") without leaking emails into the audit log.

### 3.3 Template tone — REQUIRES DESIGN INPUT

The visual + copy design of each email is a design decision, not an
engineering one. Per CLAUDE.md, this is "Require-design-input." Three
options for each, presented for decision:

**Reset password — tone options:**
1. **Bare-functional:** "Click here to reset your password. Link expires in 30 minutes." No branding, no marketing. Banking-app style.
2. **Branded-minimal:** Logo + "Reset your password" headline + clear button + expiry note + "didn't request this? ignore" footer. ~50 words.
3. **Branded-warm:** "Hi {firstName}, we got your request to reset…" with more conversational copy. Construction PM customers skew older + non-technical, so this might land better.

**Deletion confirmation — tone options:**
1. **Bare:** "Your account will anonymize on {date}. Cancel: {link}."
2. **Cautious:** Explicit "are you sure?" framing + 30-day window emphasis + "this is your only cancel link" warning. Reduces support load.
3. **Reassuring:** "We've received your deletion request" framing + bullet list of what gets anonymized vs. retained + cancel link.

**Recommendation:** option 2 (cautious) for deletion mails, option 2
(branded-minimal) for password reset, option 2 (clear & dated) for
export-ready. Decide before template code is written.

### 3.4 Env vars for email

Add to `src/lib/env.ts`:

```ts
RESEND_API_KEY: z.string().min(1).optional(),    // optional in dev
EMAIL_FROM: z.string().email().optional(),       // optional in dev
EMAIL_REPLY_TO: z.string().email().optional(),
```

Then in `src/lib/email/client.ts`, throw a helpful error at first
send if `RESEND_API_KEY` is unset (mirrors how `stripe.ts` lazy-throws
today). This way dev still works without email creds — the calls fall
back to the existing console-log behavior, gated behind a clear
"EMAIL_NOT_CONFIGURED" branch.

### 3.5 New dep — `resend` + `@react-email/components`

Both go into `dependencies`. Per CLAUDE.md, **adding new deps is a
universal stop-and-ask trigger**, so this gets confirmed before
install. Confirm: "Resend SDK + @react-email/components — install?"
when wire-up time comes.

### 3.6 DNS setup (your job, when domain lands)

For Resend to send mail from `noreply@yourdomain.com`, three DNS records
go on the domain:

1. **SPF** — TXT record allowing Resend's mail servers.
2. **DKIM** — TXT record(s) Resend gives you (signs outbound mail).
3. **DMARC** — TXT record telling receivers what to do if SPF/DKIM fail. Start with `p=none` (monitor only) for the first two weeks, then ratchet to `p=quarantine` once you've verified clean delivery.

Resend's dashboard generates all three; you copy/paste into Cloudflare
(or wherever DNS lives). Allow 24h for propagation.

---

## 4. Cutover sequence (when accounts are ready)

Order matters. Each step is independently revertible.

### 4.1 One-time setup

1. **Buy domain.** Cloudflare Registrar recommended.
2. **Create Render account.** Connect to GitHub, give Render read access to this repo only.
3. **Create Resend account.**
4. **Provision prod Postgres.** Likely a fresh Neon project (separate from dev). Run [`bootstrap_new_env.md`](bootstrap_new_env.md) end-to-end. Capture both the `neondb_owner` connection string and the `builtcrm_app` connection string.
5. **Provision prod Upstash Redis.** Free tier is fine for portfolio.
6. **Provision prod R2 bucket.** Separate bucket from dev.
7. **Generate prod secrets.** `openssl rand -base64 32` — three times — for `BETTER_AUTH_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, `INTEGRATION_STATE_SECRET`, `TAX_ID_ENCRYPTION_KEY`. **Different values from dev.**

### 4.2 Code changes (in order, each in its own commit)

1. **Fix the 3 env-var contract bugs** (§1.4). Smallest possible commit.
2. **Add `output: "standalone"` to `next.config.mjs`** + add `.dockerignore`. Verify `npm run build` still succeeds.
3. **Add `Dockerfile`.** Verify `docker build .` succeeds locally.
4. **Add `/api/health` endpoint.** Verify it returns 200 against the dev DB / Redis.
5. **Add `render.yaml`.** Use the §2.3 sketch as a starting point.
6. **Add `src/lib/email/`** — Resend client + React Email templates + the 4 senders. Replace the 4 console-log call sites. Confirm new deps before install (§3.5).
7. **Add `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` to env.ts.**

### 4.3 Deploy

1. **DNS:** point `app.example.com` (or whichever subdomain) at Render. Add Resend's SPF/DKIM/DMARC records to the domain.
1a. **R2 CORS:** add the new origin to the `builtcrm-uploads` bucket's CORS policy (Cloudflare dashboard → R2 → bucket → Settings → CORS). Without this, presigned PUT uploads from the browser get blocked at preflight. Same fix was needed for the Render `<name>.onrender.com` origin during portfolio-mode setup.
2. **Render:** create the web service from `render.yaml`. Set every secret in the dashboard (the §1.1–§1.3 manifest, with the prod values from 4.1.7).
3. **Trigger first deploy.** Watch the build log — first build is slow (~5 min on starter plan).
4. **Smoke test:** hit `https://app.example.com/api/health` — expect 200.
5. **Deploy Trigger.dev jobs:** locally, `npm run trigger:deploy --env=prod`. Verify all 14 jobs show up in the Trigger.dev dashboard.

### 4.4 Post-deploy verification

1. **RLS verification on prod DB** (deferred from Phase 4+). Run `scripts/recreate-builtcrm-app.sql` against prod, then verify `SELECT rolbypassrls FROM pg_roles WHERE rolname = 'builtcrm_app'` returns `false`.
2. **Tax-ID encryption backfill on prod.** Run `scripts/backfill-encrypt-tax-id.ts`. (No-op on a fresh prod DB, but the script should still run cleanly.)
3. **Email smoke tests:**
   - Trigger a password reset. Verify mail lands in inbox, link works.
   - Sign up a fake user, schedule deletion, verify confirmation mail. Cancel via link, verify cancellation works.
   - Request a GDPR export, verify download mail.
4. **Stripe webhook smoke** (if billing is enabled): trigger a test event from Stripe dashboard, verify it lands in `webhook_events` with `processed = true`.

### 4.5 Rollback plan

- **Bad deploy:** Render's "rollback to previous deploy" button. One-click.
- **Bad migration:** revert via Drizzle (`db:migrate` is the only path forward; Drizzle doesn't auto-rollback). Have a manual `DOWN` SQL ready for the most recent migration.
- **Lost secret:** secrets are in Render's dashboard; not recoverable via repo. Document the recovery process (re-generate, redeploy).
- See [`rollback_strategy.md`](rollback_strategy.md) for the full incident playbook.

---

## 4.6 Deferred follow-up — user-timezone display sweep

`users.timezone` is set in the settings page but no UI date renderer
respects it; dates currently render in browser-local or project
timezone. This is real drift, not a bug per se — the column exists
and the settings UI writes it, but no consumer reads it for display.

**Why deferred to prod cutover:** the fix is 3–6 hours and touches
every date render across the app (RFIs, daily logs, dashboard,
weekly reports, etc.). Each render needs a UX decision: user
timezone, project timezone, or either? That's a design question,
not a code question. Doing it as part of the prod-cutover sweep lets
the design decision live alongside the email-template tone choice
and the org-name branding decisions — all "polish before real users
see this" calls.

**Mechanical work when ready:**
1. Audit all date renders (grep `toLocaleString`, `Intl.DateTimeFormat`, `format(`, `formatDistanceToNow`, `format-file-size`, etc.).
2. Classify each as user-tz / project-tz / browser-local.
3. Add `formatUserDate(date, timezone)` to `@/lib/format/`.
4. Plumb `users.timezone` through `loadPortalShell` (already loaded for the `users` row — extend the existing query).
5. Update each render site to call the appropriate formatter.
6. Smoke-test across all four portals.

## 5. Open decisions (when you're ready)

- [ ] **Domain name** — needed before any wire-up. (Brainstorming list discussed separately.)
- [ ] **Resend vs. Postmark** — recommendation: Resend.
- [ ] **Render plan tier** — recommendation: start `starter`, upgrade as load demands.
- [ ] **Email tone for each of the 4 templates** — see §3.3.
- [ ] **Subdomain pattern** — `app.example.com` (only an app) vs. `www.example.com` (marketing) vs. apex `example.com`. Recommendation: `app.example.com`, with apex redirecting once a marketing site exists.
- [ ] **Sentry source-map upload at build** — yes/no. Yes is recommended; needs `SENTRY_AUTH_TOKEN` available at Render build time.
