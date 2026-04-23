# Fresh-env bootstrap

Walkthrough for standing up a new BuiltCRM database environment from scratch — prod deploy, new Neon branch, fresh dev, etc.

**Status:** Untested against a real fresh env. The current dev DB was provisioned incrementally (27 hand-authored migrations) before the Option A baseline collapse. First real use of this flow will be the ground-truth test — if any step is wrong or missing, update this doc.

---

## Prerequisites

- A Postgres database (Neon or other provider)
- An admin role with DDL + `CREATE ROLE` privileges (on Neon: `neondb_owner`)
- The BuiltCRM repo checked out locally
- Node + npm installed

## Step 1 — Create the runtime role

The runtime role (`builtcrm_app`) is DML-only. The app connects as this role so SQL injection or credential leak can't `DROP`/`ALTER`/`TRUNCATE` the schema. See [security_posture.md](security_posture.md) §5.

### Neon
1. Neon console → project → **Roles & Databases** → **Create role**
2. Name: `builtcrm_app`
3. Copy the connection string Neon displays

### Self-managed Postgres
```sql
CREATE ROLE builtcrm_app LOGIN PASSWORD '<strong random password>';
```

## Step 2 — Set env vars

In `.env.local` (or the deployment's secret store):

```
# Runtime connection (DML only) — what the app connects as.
DATABASE_URL=postgresql://builtcrm_app:PASSWORD@HOST/DBNAME?sslmode=require

# Admin connection (DDL) — used by migrations, seed, and admin scripts.
DATABASE_ADMIN_URL=postgresql://ADMIN_USER:PASSWORD@HOST/DBNAME?sslmode=require
```

Plus the other env vars from `.env.example` (BETTER_AUTH_SECRET, R2_*, UPSTASH_*, etc.).

## Step 3 — Apply the bootstrap SQL

This grants schema/connect perms to `builtcrm_app` and configures `ALTER DEFAULT PRIVILEGES` so the next step's table creations auto-grant DML to the runtime role.

```bash
npx tsx --env-file=.env.local scripts/apply-sql.ts scripts/new-env-bootstrap.sql
```

The script runs as `DATABASE_ADMIN_URL` (falls back to `DATABASE_URL` if admin isn't set — but at this step, admin is mandatory; the runtime role doesn't have GRANT privilege on itself).

**Note on database name.** `scripts/new-env-bootstrap.sql` has `GRANT CONNECT ON DATABASE neondb` hardcoded. If your DB isn't named `neondb`, edit the SQL first. Postgres doesn't support variable substitution in `GRANT`.

## Step 4 — Apply the baseline migration

```bash
npm run db:migrate
```

This creates all ~80 tables from [src/db/migrations/0000_baseline.sql](../../src/db/migrations/0000_baseline.sql). Because the default privileges from Step 3 are in place, each table is automatically grant-ready for `builtcrm_app` — no follow-up GRANT step needed.

## Step 5 — Verify

```bash
# Confirm the app role can connect and SELECT.
npx tsx --env-file=.env.local -e "import postgres from 'postgres'; (async () => { const sql = postgres(process.env.DATABASE_URL); console.log(await sql\`SELECT current_user, count(*)::int FROM information_schema.tables WHERE table_schema = 'public'\`); await sql.end(); })()"
```

Expect: `current_user = 'builtcrm_app'`, `count` ≈ 80.

## Step 6 — (dev/staging only) Seed

```bash
npm run db:seed
```

Seed uses `DATABASE_ADMIN_URL` because it does `TRUNCATE` and cross-table fixture setup that exceed DML.

**Never run this against prod** — `src/db/seed.ts` has a URL-based guard that rejects obvious prod markers, but the guard is a safety net, not a policy. Prod data is never seeded.

---

## Troubleshooting

### `permission denied for schema public` from the app
`builtcrm_app` doesn't have `USAGE` on `public`. Re-run Step 3. If that doesn't fix it, confirm Step 3 ran as the admin role (not as `builtcrm_app` itself).

### `permission denied for table X` from the app
The `ALTER DEFAULT PRIVILEGES` in Step 3 applies only to objects created *after* it runs, by the role that ran it. If the baseline tables were created before Step 3, they don't have the default grant.

**Fix:** re-run the explicit GRANTs over all existing tables:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO builtcrm_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO builtcrm_app;
```

### `drizzle-kit migrate` says "migrations applied successfully" but tables are missing
Check `drizzle.__drizzle_migrations`. If a row exists claiming the baseline was applied but tables aren't there, someone (or a previous script run) marked the baseline as applied without actually running it. Truncate the table and rerun migrate, OR apply the baseline SQL manually:
```bash
npx tsx --env-file=.env.local scripts/apply-sql.ts src/db/migrations/0000_baseline.sql
```

### Neon-specific: role already exists
Neon's console may have created the role under a different name than `builtcrm_app`. Either rename in the console or update the bootstrap SQL's role name.

---

## What this doesn't cover

- **Upstash Redis provisioning** — Better Auth's `secondaryStorage` expects `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Provision the Redis instance separately (Upstash console); same region as the Postgres DB for session-read latency.
- **R2 bucket + credentials** — file storage. Provision on Cloudflare R2, set `R2_*` env vars.
- **Trigger.dev** — background job runner. Set `TRIGGER_DEV_API_KEY`.
- **BETTER_AUTH_SECRET** — generate 32+ random bytes, set as env. Rotation impact documented in [security_posture.md](security_posture.md) §3.
