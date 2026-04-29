# Fresh-env bootstrap

Walkthrough for standing up a new BuiltCRM database environment from scratch — prod deploy, new Neon branch, fresh dev, etc.

**Status:** Validated 2026-04-25 against a Neon branch. The validation pass uncovered a critical defect (Neon's "Create role" UI grants superuser-equivalent privileges that cannot be downgraded via SQL); the bootstrap script and Step 1 of this doc were rewritten to create the role via SQL with explicit least-privilege attributes. See [security_posture.md §9](security_posture.md#9-changelog) for the changelog entry.

**Important caveat for Neon:** when creating a fresh test branch from `main`, the branch INHERITS all parent state (tables + migration journal). Truly empty validation requires a new Neon project or a Neon "empty branch" (different from a forked branch). For privilege-isolation testing the inherited branch is sufficient and arguably better — it forces you to confront the "tables exist before ALTER DEFAULT PRIVILEGES runs" troubleshooting case.

---

## Prerequisites

- A Postgres database (Neon or other provider)
- An admin role with DDL + `CREATEROLE` privileges (on Neon: `neondb_owner`)
- The BuiltCRM repo checked out locally
- Node + npm installed

## Step 1 — Set env vars (admin URL only, for now)

In a fresh env file (e.g. `.env.local`, or `.env.bootstrap-test` for a throwaway validation run — make sure the filename is in `.gitignore`):

```
# Admin connection (DDL + CREATEROLE) — used by the bootstrap script,
# migrations, and seed.
DATABASE_ADMIN_URL=postgresql://ADMIN_USER:PASSWORD@HOST/DBNAME?sslmode=require

# Runtime connection (DML only) — fill this in AFTER Step 2 prints the
# generated password. Leaving it blank or pointing at the admin URL for
# now is fine; the bootstrap script doesn't read it.
DATABASE_URL=
```

Plus the other env vars from `.env.example` (BETTER_AUTH_SECRET, R2_*, UPSTASH_*, etc.) — needed for Step 5+ but not for Steps 2–4.

## Step 2 — Apply the bootstrap SQL

```bash
npx tsx --env-file=.env.local scripts/apply-sql.ts scripts/new-env-bootstrap.sql
```

This script (run as `DATABASE_ADMIN_URL`):
1. Enables `pgcrypto`
2. **Creates `builtcrm_app` with a generated random password and explicit `NOCREATEROLE NOCREATEDB NOREPLICATION NOBYPASSRLS` attributes.** The password is printed via `RAISE NOTICE` — capture it from the terminal output and put it into `DATABASE_URL` immediately. It will not be shown again.
3. Grants `CONNECT` + `USAGE` (no-op on Neon — already auto-granted; warnings are expected)
4. Configures `ALTER DEFAULT PRIVILEGES` so subsequent table creations auto-grant DML to `builtcrm_app`

**Critical: do NOT use the Neon "Create role" UI to create `builtcrm_app`.** Roles created via the UI inherit `neon_superuser` membership plus `CREATEROLE`/`CREATEDB`/`REPLICATION`/`BYPASSRLS`, and **neither `neondb_owner` nor any SQL-accessible role can downgrade these privileges after the fact** — the ADMIN OPTION on `neon_superuser` and on UI-created roles is held by Neon's platform admin only. The only way to get a genuinely DML-only runtime role is the SQL-based CREATE this script does.

If you have already created `builtcrm_app` via the Neon UI: drop it via the Neon console (the platform admin can drop what it created), then re-run this script. The script's `IF NOT EXISTS` guard makes the re-run safe.

**Note on database name.** `scripts/new-env-bootstrap.sql` has `GRANT CONNECT ON DATABASE neondb` hardcoded. If your DB isn't named `neondb`, edit the SQL first. Postgres doesn't support variable substitution in `GRANT`.

## Step 3 — Set DATABASE_URL

Build the runtime connection string from the generated password. On Neon, the host/database/sslmode parts are the same as the admin URL — only the username (`builtcrm_app` instead of `neondb_owner`) and password change.

```
DATABASE_URL=postgresql://builtcrm_app:GENERATED_PASSWORD_FROM_STEP_2@HOST/DBNAME?sslmode=require
```

## Step 4 — Apply the baseline migration

```bash
npm run db:migrate
```

This creates all ~80 tables from [src/db/migrations/0000_baseline.sql](../../src/db/migrations/0000_baseline.sql). Because the default privileges from Step 2 are in place, each table is automatically grant-ready for `builtcrm_app` — no follow-up GRANT step needed.

> Note: `db:migrate` reads its env from `--env-file=.env.local` (hardcoded in `package.json`). If you're bootstrapping into a different env file (e.g. `.env.bootstrap-test`), invoke drizzle-kit directly:
> ```bash
> node --env-file=.env.bootstrap-test node_modules/drizzle-kit/bin.cjs migrate
> ```

## Step 5 — Verify

Confirm the role split is real: admin can DDL, runtime can SELECT but cannot DROP.

```bash
npx tsx --env-file=.env.local -e "
import postgres from 'postgres';
async function check(label, urlEnv) {
  const url = process.env[urlEnv];
  if (!url) { console.log(label, urlEnv, 'not set'); return; }
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const who = await sql\`SELECT current_user\`;
    console.log(label, 'as', who[0].current_user);
    const r = await sql\`SELECT count(*)::int FROM users\`;
    console.log(label, 'SELECT users:', r[0].count, 'rows');
    try {
      await sql.unsafe('CREATE TABLE __test_should_fail (id int)');
      console.log(label, 'CREATE TABLE: ALLOWED');
      await sql.unsafe('DROP TABLE __test_should_fail');
    } catch (e) {
      console.log(label, 'CREATE TABLE: DENIED (expected for runtime role) —', e.message);
    }
  } finally { await sql.end(); }
}
(async () => {
  await check('[ADMIN]', 'DATABASE_ADMIN_URL');
  await check('[APP  ]', 'DATABASE_URL');
})();
"
```

**Expected output:**
- `[ADMIN]` connects as `neondb_owner` (or your admin role), SELECT works, CREATE TABLE is ALLOWED
- `[APP  ]` connects as `builtcrm_app`, SELECT works, CREATE TABLE is **DENIED**

If `[APP  ]` shows CREATE TABLE: ALLOWED, the role was created via the Neon UI and has superuser privileges. Drop the role via the Neon console and re-run Step 2.

## Step 6 — (dev/staging only) Seed

```bash
npm run db:seed
```

Seed uses `DATABASE_ADMIN_URL` because it does `TRUNCATE` and cross-table fixture setup that exceed DML.

**Never run this against prod** — `src/db/seed.ts` has a URL-based guard that rejects obvious prod markers, but the guard is a safety net, not a policy. Prod data is never seeded.

---

## Troubleshooting

### `permission denied for schema public` from the app
`builtcrm_app` doesn't have `USAGE` on `public`. Re-run Step 2. If that doesn't fix it, confirm Step 2 ran as the admin role (not as `builtcrm_app` itself).

### `permission denied for table X` from the app
The `ALTER DEFAULT PRIVILEGES` in Step 2 applies only to objects created *after* it runs, by the role that ran it. If the baseline tables were created before Step 2 ran (e.g. you're bootstrapping into a Neon branch that inherited tables from `main`), they don't have the default grant.

**Fix:** re-run the explicit GRANTs over all existing tables:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO builtcrm_app;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO builtcrm_app;
```

### Verification (Step 5) shows `[APP  ] CREATE TABLE: ALLOWED`
The runtime role has superuser privileges, almost certainly because it was created via the Neon "Create role" UI. SQL cannot downgrade it. Drop the role via the Neon console, then re-run Step 2 — the script will recreate it with the right attributes via SQL.

### `drizzle-kit migrate` says "migrations applied successfully" but tables are missing
Check `drizzle.__drizzle_migrations`. If a row exists claiming the baseline was applied but tables aren't there, someone (or a previous script run) marked the baseline as applied without actually running it. Truncate the table and rerun migrate, OR apply the baseline SQL manually:
```bash
npx tsx --env-file=.env.local scripts/apply-sql.ts src/db/migrations/0000_baseline.sql
```

### Neon-specific: cannot drop `builtcrm_app` from `neondb_owner`
Neon's platform admin holds the ADMIN OPTION on UI-created roles. Drop the role via the Neon console (Roles & Databases → click the role → Delete), not via SQL.

### Neon branch inherits parent state
If you're testing this flow on a Neon branch forked from `main`, the branch will already have all tables and the migration journal — `db:migrate` will be a no-op. For a true empty-DB test, create a new Neon project or use a Neon "empty branch" (a separate branch type with no parent data).

---

## What this doesn't cover

- **Upstash Redis provisioning** — Better Auth's `secondaryStorage` expects `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`. Provision the Redis instance separately (Upstash console); same region as the Postgres DB for session-read latency.
- **R2 bucket + credentials** — file storage. Provision on Cloudflare R2, set `R2_*` env vars.
- **Trigger.dev** — background job runner. Set `TRIGGER_SECRET_KEY`.
- **BETTER_AUTH_SECRET** — generate 32+ random bytes, set as env. Rotation impact documented in [security_posture.md](security_posture.md) §3.
