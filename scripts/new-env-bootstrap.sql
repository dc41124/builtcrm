-- Fresh-env bootstrap. Run as the admin role (DATABASE_ADMIN_URL, e.g.
-- neondb_owner) BEFORE `npm run db:migrate` applies the baseline.
--
-- Prerequisite: the runtime role `builtcrm_app` must exist. On Neon,
-- create it via the Neon console (Roles & Databases → Create role).
-- On self-managed Postgres: `CREATE ROLE builtcrm_app LOGIN PASSWORD '...'`.
--
-- This file is idempotent — safe to re-run. See docs/specs/bootstrap_new_env.md
-- for the full walkthrough.

-- pgcrypto is used by scripts/migrations for SHA-256 hashing of identifiers
-- and defence-in-depth. Safe to enable unconditionally.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Connection + schema usage for the runtime role.
-- `neondb` is Neon's default database name; adjust if your env uses a
-- different name.
GRANT CONNECT ON DATABASE neondb TO builtcrm_app;
GRANT USAGE ON SCHEMA public TO builtcrm_app;

-- Default privileges: after this runs, any table or sequence created
-- by the admin role in `public` automatically grants DML to builtcrm_app.
-- This is what makes the subsequent `db:migrate` self-sufficient — the
-- baseline creates ~80 tables and each one gets the right grants
-- without a follow-up GRANT step.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO builtcrm_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO builtcrm_app;
