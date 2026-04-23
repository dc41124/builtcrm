// Apply a raw SQL file to the database using DATABASE_URL. Used for
// hand-authored migrations (no drizzle-kit journal exists in this repo;
// see docs/specs/security_posture.md and the step notes for the planned
// Option A baseline collapse that will replace this workflow).
//
// Usage:
//   npx tsx --env-file=.env.local scripts/apply-sql.ts <path-to.sql>

import { readFileSync } from "node:fs";
import postgres from "postgres";

const path = process.argv[2];
if (!path) {
  console.error("Usage: tsx scripts/apply-sql.ts <path-to-sql>");
  process.exit(1);
}

// Prefer admin URL since hand-authored migrations usually need DDL.
// Falls back to DATABASE_URL for single-role environments.
const resolvedUrl =
  process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!resolvedUrl) {
  console.error("DATABASE_ADMIN_URL (or DATABASE_URL) is not set");
  process.exit(1);
}
const url: string = resolvedUrl;

async function main() {
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const content = readFileSync(path, "utf8");
    await sql.unsafe(content);
    console.log(`Applied: ${path}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
