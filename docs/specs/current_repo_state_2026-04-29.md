# BuiltCRM — Current Repo State

**Repo path:** `c:\Users\David Cardona\Desktop\builtcrm\`
**As of:** April 29, 2026
**Compiled from:** direct filesystem + `git log` + live Render deploy.
Supersedes [`current_repo_state_2026-04-27.md`](current_repo_state_2026-04-27.md).

---

## Headline change since 2026-04-27

**The app is live on Render at `https://builtos.onrender.com`** —
free-tier portfolio deploy, sharing dev's `DATABASE_URL` /
`DATABASE_ADMIN_URL` / Upstash / R2. Smoke tests passed end-to-end:
sign-in, project view (drawings + daily logs with RLS active), and
R2 avatar upload all working. Email is still console-log stubs;
Trigger.dev jobs not yet deployed; Stripe / Sentry / OAuth providers
unset. See [`prod_cutover_prep.md`](prod_cutover_prep.md) for the
full migration checklist that fires when the user mentions buying
a domain + upgrading Resend.

---

## Change summary since 2026-04-27

Six commits, all on 2026-04-29, all in service of the Render deploy.

| Commit | What |
|---|---|
| `1797b76` | Docker for live deployment — `Dockerfile`, `.dockerignore`, `render.yaml`, `next.config.mjs` `output: "standalone"`, `src/app/api/health/route.ts`, env-var contract fixes (TRIGGER_DEV_API_KEY → TRIGGER_SECRET_KEY, NEXT_PUBLIC_APP_URL added to `env.ts` + `.env.example`, R2_BUCKET → R2_BUCKET_NAME in `.env.example`), updated `tests/setup.ts` + `.env.test.example` + `bootstrap_new_env.md`. Also added [`prod_cutover_prep.md`](prod_cutover_prep.md). |
| `bf25967` | Resync `package-lock.json` with package.json (OpenTelemetry deps were missing entries). |
| `858607b` | Regenerate lock with `--legacy-peer-deps` (full nuke + reinstall — better-auth@1.6.9 peer-wants drizzle-orm@^0.45.2 but project pins 0.41.0; `--legacy-peer-deps` masks the drift). Bumped Stripe API version `2026-03-25.dahlia` → `2026-04-22.dahlia` to match the newer SDK that the regen pulled. |
| `9068ca0` | Dockerfile: drop `--omit=optional` (lightningcss native binaries are optional deps; Tailwind v4's postcss plugin needs them at build time). |
| `228f776` | Dockerfile: inject build-only dummy ENV vars in builder stage (Render does NOT pass dashboard env vars to Docker builds; `next build` was throwing on missing `DATABASE_URL`). Real values still bound at runtime by Render. |
| `f3cb6e7` | `src/auth/client.ts`: prefer `window.location.origin` over baked-in `NEXT_PUBLIC_APP_URL` (the build-time dummy was getting compiled into the client bundle, breaking sign-in fetches). |

### Drift fixed this session

- ✅ **Three env-var contract bugs** flagged in `prod_cutover_prep.md` §1.4 — all fixed in `1797b76`.
- ✅ **CLAUDE.md count drift** flagged since April 16 — fixed this session by rewriting the schema + design-mockup sections to be enumeration-free (no counts to go stale).
- ✅ **Migration tracking healthy** — already resolved in 04-24 snapshot, still healthy.

### Drift introduced this session

- ⚠️ **`--legacy-peer-deps` masks better-auth/drizzle-orm peer drift.** `better-auth@1.6.9` requires `drizzle-orm@^0.45.2` as a peer dep; the project pins `drizzle-orm@^0.41.0`. We bypassed it to unblock the deploy. Ticking time bomb — a future better-auth update or stricter npm could reject the install. Real fix: upgrade drizzle-orm to 0.45.2, but that's a non-trivial migration (column-type API changed, sql template tweaks). Tracked as a future-session item; for now `--legacy-peer-deps` is the explicit toggle in the Dockerfile.

### R2 CORS

Cloudflare R2 bucket `builtcrm-uploads` CORS policy was extended
this session to include `https://builtos.onrender.com` (PUT/GET/HEAD
allowed). Without it, presigned uploads from the browser were
blocked at preflight. The CORS rule also still lists
`http://localhost:3000` for dev. When a real domain lands, add the
new origin to this policy too — flagged in `prod_cutover_prep.md`
§4.3.1a.

### Live DB

Unchanged — same dev DB. ~99 public tables, 85 RLS-enabled.

---

## A. Snapshot

- **Branch:** `main` (clean, up-to-date with `origin/main`)
- **Last 6 commits:** see Change summary above.
- **Working tree:** clean.
- **Live host:** `https://builtos.onrender.com` — Render free tier, Docker runtime, Oregon region, healthcheck path `/api/health`. Spins down after 15 min idle (cold start ~30-60s on next request).
- **Phase claim:** Phase 4+ module sprint complete (Steps 44–49.5) + RLS sprint complete on dev. **NEW:** portfolio-mode prod deploy live.

---

## B. Tech stack

`package.json` unchanged — no new deps installed this session despite
the lock-file regen. The only behavioral change: `stripe` SDK
resolved to a newer minor version that required bumping the API
version pin in `src/lib/stripe.ts` (now `"2026-04-22.dahlia"`).

---

## C. Deploy infrastructure (NEW)

Files added or changed for the Render deploy:

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage Node 22 alpine build, non-root runtime user, ~150 MB image. Builder stage injects dummy env vars to satisfy `next build`'s zod validation. Runtime stage reads real env from Render. Uses `npm ci --legacy-peer-deps` (no `--omit=optional` — lightningcss needs its platform binary). |
| `.dockerignore` | Excludes `.git`, `.next`, `node_modules`, `tests`, `docs`, env files. |
| `render.yaml` | Blueprint config — free plan, Oregon, healthcheck path, full env-var manifest with `sync: false` placeholders. |
| `src/app/api/health/route.ts` | Pings DB + Redis; 200 if both reachable, 503 otherwise. No auth (Render must hit anonymously). Don't ping Stripe / R2 / Resend here — they aren't in the deploy failure domain. |
| `next.config.mjs` | Added `output: "standalone"` so the Docker image ships the bundled Next server (~150 MB) instead of the full node_modules tree (~1.5 GB). |

### Render dashboard env vars (set, runtime only)

```
NODE_OPTIONS=--max-old-space-size=4096   # required: Next compile spikes near 2 GB heap default
DATABASE_URL                              # shared with dev
DATABASE_ADMIN_URL                        # shared with dev
BETTER_AUTH_SECRET                        # shared with dev
BETTER_AUTH_URL=https://builtos.onrender.com
NEXT_PUBLIC_APP_URL=https://builtos.onrender.com
R2_*                                      # shared with dev
UPSTASH_REDIS_REST_*                      # shared with dev
TAX_ID_ENCRYPTION_KEY                     # shared with dev
TRIGGER_SECRET_KEY                        # shared with dev (Trigger.dev jobs not deployed; key only allows queueing)
```

Unset (intentional):
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — billing not exercised
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` — error monitoring not active
- `INTEGRATION_ENCRYPTION_KEY`, `INTEGRATION_STATE_SECRET` — OAuth integrations not exercised
- All per-provider OAuth creds (QuickBooks / Xero / Sage / Google)

---

## D. Database schema

Unchanged. ~99 tables, 85 RLS-enabled, 27 schema source files.
RLS gate (`scripts/rls-audit.js`) reports **0 unsafe / 785 tx-safe /
234 admin / 6 parameterized**. 110 tests passing.

---

## E. App routes

Unchanged from 04-27 snapshot. One new route: `src/app/api/health/route.ts`.

---

## F. Domain layer

Unchanged. New: `src/auth/client.ts` was patched to prefer
`window.location.origin` for the Better Auth base URL in the
browser, rather than reading the baked-in `NEXT_PUBLIC_APP_URL`.
This pattern matters for any other client-side consumer of
`NEXT_PUBLIC_*` env vars; the four server-side consumers
(`src/lib/stripe.ts`, `src/lib/saml/client.ts`, `src/app/api/invitations/route.ts`,
`src/app/api/submittals/[id]/invite-reviewer/route.ts`) read
`process.env.NEXT_PUBLIC_APP_URL` at request time and are unaffected
as long as the runtime env var is correct (verified in Render).

---

## G. Jobs, storage, integrations

Unchanged shape. Note: 14 Trigger.dev jobs exist but are NOT deployed
to Trigger.dev's prod env. Web app on Render only needs
`TRIGGER_SECRET_KEY` to queue jobs; the jobs themselves run on
Trigger's infra and require `npm run trigger:deploy` from CLI when
ready. Deferred per memory.

---

## H–I. Reports + Docs inventory

Unchanged from 04-27 snapshot. New docs this session:
- [`prod_cutover_prep.md`](prod_cutover_prep.md) — env audit, Render config sketch, email design, cutover sequence + rollback plan. Canonical reference for the migration off portfolio mode.
- [`current_repo_state_2026-04-29.md`](current_repo_state_2026-04-29.md) — this file.

CLAUDE.md updated this session: schema section + design-mockup
references rewritten to be enumeration-free (no counts to go stale).

---

## J. Known drift between plans and reality

1. **`--legacy-peer-deps` masks better-auth ↔ drizzle-orm peer-dep drift** (NEW). better-auth@1.6.9 wants drizzle-orm@^0.45.2; project pins 0.41.0. Future better-auth update or stricter npm could break the install. Real fix: upgrade drizzle-orm 0.41 → 0.45 (non-trivial, dedicated session).
2. ~~HANDOFF.md still says "Phase 3 Complete"~~ — RESOLVED 2026-04-29: file now carries an ARCHIVED banner pointing readers at the current state docs.
3. ~~JSX prototypes misfiled under `docs/specs/`~~ — RESOLVED 2026-04-29: CLAUDE.md (updated this session) now documents the convention that newer Phase 4+ module prototypes live under `docs/specs/builtcrm_*_module.jsx` while older prototypes stay in `docs/prototypes/`. Both locations are accepted; not actually a misfile.
4. **Contractor cross-project redirect shims:** `approvals`, `payment-tracking`, `retainage`, `budget`. Same status as 04-27.
5. **`.env.example` ↔ `src/lib/env.ts`:** the three contract bugs from `prod_cutover_prep.md` §1.4 are fixed. `INTEGRATION_ENCRYPTION_KEY` and `INTEGRATION_STATE_SECRET` are still lazy-read (not in env.ts) — would only catch missing-config when the integration code runs. Acceptable.
6. **Two RLS clusters deferred** (`projects`, messaging). Documented in `security_posture.md §6`. Don't restart without re-reading the recursion + participant-shape pitfalls.
7. ~~CI baseline carries 28 tracked bare `db.*` sites~~ — RESOLVED 2026-04-30: paid down 28 → 2. Remaining 2 entries are intentional (messaging cluster deferred, healthcheck `select 1` true false positive). Drawings-comments raw-SQL RLS bug also caught + fixed during the pay-down. See `security_posture.md §6` for details.
8. **Email provider not wired** — three console-log stubs. Blocked on transactional-email-provider decision (memory: `project_hosting_and_email_deferred.md`). Trigger condition: user mentions buying domain + upgrading Resend.
9. **Trigger.dev jobs not deployed to prod env.** Deferred per memory; `TRIGGER_SECRET_KEY` is set in Render so the web app can queue jobs, but the jobs themselves don't run anywhere yet. No data loss risk on free-tier portfolio mode (cron sweeps don't fire = data accumulates, but DB is shared with dev which has the same gap).
10. **Sharing dev DB / Upstash / R2 with prod URL** — intentional for portfolio mode. Anyone hitting `builtos.onrender.com` reads/writes dev data. Trigger condition for migrating off: same as #8.

---

## K. Environment & config

**Config files (all in repo root):** all unchanged from 04-27 except
those listed in §C. New: `Dockerfile`, `.dockerignore`,
`render.yaml`. Modified: `next.config.mjs`, `package-lock.json`.

---

## Critical files to read when starting a new session

Same as 04-27 snapshot, with these additions:

- [`docs/specs/prod_cutover_prep.md`](prod_cutover_prep.md) — canonical migration checklist for moving off portfolio mode (domain + Resend + separate prod resources + Trigger.dev jobs).
- `Dockerfile`, `render.yaml` — deploy config. Read before changing how the app boots in prod.
- `src/app/api/health/route.ts` — Render's healthcheck endpoint.
- `src/auth/client.ts` — browser-side Better Auth client (note: prefers `window.location.origin` over baked-in env var).
