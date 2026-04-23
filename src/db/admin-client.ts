import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Admin-level DB client. Used by seed + any future admin tooling that
// needs DDL privileges (TRUNCATE, schema ops) that the runtime
// builtcrm_app role cannot perform.
//
// Falls back to DATABASE_URL for single-role environments (CI, any env
// that hasn't split into two URLs yet).
//
// See docs/specs/security_posture.md §5.

const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_ADMIN_URL (or DATABASE_URL) is not set");
}

const queryClient = postgres(url, { max: 10, prepare: false });

export const adminDb = drizzle(queryClient, { schema });
export type AdminDB = typeof adminDb;
