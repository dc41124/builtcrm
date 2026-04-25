# Rollback & Blue-Green Strategy

**Last reviewed:** 2026-04-25
**Scope:** What to do when a deploy breaks production — code rollback, database rollback, the relationship between the two, and the operational checklist for the first production cutover.

This is a runbook. Skim it once before deploying; reach for it when something goes wrong.

---

## 1. Deployment model

| Layer | Provider | Rollback primitive |
|---|---|---|
| Web service (Next.js) | Render | Render dashboard "Rollback" button — one click to previous deploy |
| Background jobs | Trigger.dev | `npx trigger.dev@3 deploy` redeploys; rollback = redeploy a prior tag |
| Database | Neon (Postgres) | Point-in-Time Recovery (PITR) within retention window |
| Sessions | Upstash Redis | Stateless from a deploy perspective; sessions expire naturally (7d) |
| Object storage | Cloudflare R2 | Buckets are deploy-independent; no code-version coupling |

Render does **zero-downtime deploys natively**. A new build runs alongside the old; once health checks pass, traffic switches atomically. This is functionally equivalent to blue-green for the web service. True blue-green for the database (two parallel Postgres instances behind a flag) is impractical with one Neon project — see §3 for the pragmatic substitute.

---

## 2. Code rollback (the deploy is broken)

**When:** the new build is panic-looping, a regression is severe, or you immediately notice a bug after deploy.

**How:**
1. Render dashboard → service → **Deploys** tab → click the previous green deploy → **Rollback to this deploy**.
2. Confirm. Render rebuilds-and-switches in the background.
3. Verify in the UI that the old version is live (check the build hash / version footer).

**What this does NOT cover:** if the bad deploy ran a destructive migration, code rollback alone is not enough — see §3.

---

## 3. Database rollback (the migration was the problem)

Migrations are forward-only by design. drizzle-kit does not generate `down()` migrations. Two recovery paths:

### 3a. Expand-contract (preferred, by far)

The discipline that prevents most rollback emergencies. Every schema change ships in two passes:

- **Pass 1 (expand):** add the new shape additively. Code is updated to read **both** old and new shape; writes go to both. Old code can still run unmodified — schema is a strict superset.
- **Pass 2 (contract):** once pass 1 has soaked and proven correct, drop the old shape. Only do this after the team agrees the new shape is permanent.

If pass 1 breaks, Render rollback (§2) is sufficient — the schema is forward-compatible with the old code.

**Examples already in the repo:**
- Step 49.5 (`milestone_kind` enum) added a column with backfill + CHECK constraint. Code was updated to use the new column without removing `start_date` — the old derivation (`isMarker = !startDate`) would still have worked against the new schema. That's expand-contract done right.

**The migration safety checklist** (run through this before every `npm run db:generate`):

- [ ] Additive only? (no `DROP COLUMN`, `DROP TABLE`, `ALTER TYPE` narrowing, `RENAME` of in-use columns)
- [ ] Backfill written **before** `NOT NULL` is set?
- [ ] CHECK constraint added **after** backfill, not before? (existing rows must pass at the moment the constraint takes effect)
- [ ] Migration tested locally on a copy of seed data? (`npm run db:seed` then `npm run db:migrate`)
- [ ] Old code can still run against the new schema? (the rollback escape hatch — if no, this is an expand-contract pass that needs a second deploy)
- [ ] FK names within Postgres' 63-char limit? (long auto-names get silently truncated; see CLAUDE.md FK constraint naming convention)

### 3b. Neon Point-in-Time Recovery (emergency only)

When the migration corrupted data — wrong `UPDATE` in a backfill, dropped a column that still mattered, etc. — and expand-contract can't unwind it.

**Procedure:**
1. **Stop writes immediately** — pause the Render service, kill any Trigger.dev jobs that are mid-flight. Every write after the bad migration is a write you'll lose on restore.
2. Neon console → project → **Branches** → on `main`, click **Restore** → choose a timestamp **just before** the bad migration was applied.
3. Neon creates a restore branch. Update Render's `DATABASE_URL` env var to point at the restored branch's connection string.
4. Roll the application back via Render (§2) so old code matches the old schema.
5. Promote the restored branch to `main` once the team agrees the data is good. (Or treat it as the new `main` — Neon supports both flows.)
6. Write a postmortem. Update §3a's checklist if a new failure mode emerged.

**Retention windows:**
- Neon free: 24h PITR.
- Neon paid (`Launch` and up): typically 7 days.
- **Confirm your project's window in the Neon dashboard before depending on it.** A 24h window means you have one business day to notice and act.

### 3c. What you cannot recover

- **R2 object deletes:** R2 has no native versioning unless you've enabled it (and the user has not, as of this writing). Once a key is deleted in R2, it's gone. Mitigation: use soft-delete fields in Postgres for documents (`is_deleted` flag) rather than hard-deleting the R2 object on user action.
- **Sessions in Upstash:** sessions are non-recoverable, but they're also disposable — users sign in again. Not an outage path.
- **Trigger.dev run history:** retained on the Trigger.dev side; not coupled to your DB.

---

## 4. Blue-green availability — what we have and don't

| Layer | Blue-green-ish? | Notes |
|---|---|---|
| Web service | ✅ Yes (Render zero-downtime) | New build runs alongside old; health-check gated traffic switch |
| Database schema | ⚠️ Via discipline | Expand-contract migrations + Render rollback gives the same property in two deploys |
| Database data | ❌ No | Single Postgres instance. PITR is the recovery primitive, not a parallel-instance switch |
| Sessions / cache | ✅ Stateless | Upstash is shared across blue and green; no migration concern |

True blue-green at the database layer (run two Postgres instances, traffic-shape between them, fail back instantly) requires either logical replication setup or a parallel staging environment that mirrors prod. **Out of scope for current size.** The expand-contract discipline + PITR is the pragmatic substitute.

---

## 5. Production cutover checklist

One-time operational items the user must complete on first prod deploy. None are app-code changes — they live in third-party dashboards.

### Cloudflare R2
- [ ] Bucket CORS configured: only if app does direct browser-to-R2 uploads using presigned URLs (current architecture: yes). Set:
  - `AllowedOrigins`: production domain (e.g. `https://app.builtcrm.com`)
  - `AllowedMethods`: `GET`, `PUT`, `POST`
  - `AllowedHeaders`: `*` (or narrow to `Content-Type`, `x-amz-*`)
  - `MaxAgeSeconds`: `3600`
- [ ] Bucket lifecycle rule for failed uploads (optional, recommended): expire incomplete multipart uploads after 7 days

### Neon
- [ ] PITR window confirmed at ≥ 24h (paid tier preferred for 7d)
- [ ] `builtcrm_app` and `builtcrm_admin` roles created per [bootstrap_new_env.md](bootstrap_new_env.md)
- [ ] `DATABASE_URL` (app) and `DATABASE_ADMIN_URL` (migrations) set in Render env vars
- [ ] First migration run via `DATABASE_ADMIN_URL`; app-runtime connection uses `DATABASE_URL`

### Upstash
- [ ] Redis instance provisioned (free tier acceptable for low-volume launch)
- [ ] `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` set in Render env vars
- [ ] Confirm session-storage pinned to Upstash (`storeSessionInDatabase: false` — see security_posture.md §4)

### Render
- [ ] Web service created, build command `npm run build`, start `npm run start`
- [ ] Health check path configured (Render defaults to `/`; if that requires auth, add a dedicated `/api/health` route)
- [ ] All env vars from `.env.example` set
- [ ] Auto-deploy from `main` enabled (or manual; user's choice)

### Sentry
- [ ] Production project created; `SENTRY_DSN` set in Render env vars
- [ ] (Optional) `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` set for source-map upload at build time
- [ ] Session replay deliberately disabled — tax IDs / financial data must not stream to Sentry (see security_posture.md §8)

### Trigger.dev
- [ ] Project created; `TRIGGER_SECRET_KEY` set in Render env vars
- [ ] First deploy run: `npm run trigger:deploy`

### Better Auth
- [ ] `BETTER_AUTH_SECRET` set in Render env vars (decide storage per security_posture.md §3 — Render env vars vs. Doppler)
- [ ] `BETTER_AUTH_URL` set to production domain
- [ ] First admin account created via signup flow; promote to org admin manually via `roleAssignments` row

### DNS / TLS
- [ ] Custom domain attached to Render service
- [ ] TLS auto-provisioned by Render (Let's Encrypt) — confirm `Strict-Transport-Security` header from the app is being honored

---

## 6. Incident playbook (skim version)

1. **Acknowledge:** post in incident channel; one person owns the response.
2. **Triage:** is the deploy bad, or is the data bad?
   - Site won't load / 500s everywhere → deploy is bad → §2 (Render rollback)
   - Data shows wrong values / missing rows → migration is bad → §3 (PITR)
   - One feature broken / others fine → likely a regression → §2 first; if rollback doesn't fix, code-fix forward
3. **Communicate:** post a status update at the start, every 15 minutes, and on resolution.
4. **Postmortem:** within 48h, write up: what happened, why, what was the impact, what changes prevent it next time. Add to `docs/specs/` if a process change comes out of it.

---

## 7. Changelog

- **2026-04-25** — Initial version. Documents Render zero-downtime deploys as web-service blue-green substitute, Neon PITR as DB rollback primitive, expand-contract migration discipline as the daily-driver pattern, full production cutover checklist for first deploy.
