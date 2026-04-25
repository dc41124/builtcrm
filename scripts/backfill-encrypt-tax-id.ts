// One-off backfill for the 2026-04-25 tax_id encryption rollout.
// Reads every organizations.tax_id; if decryption succeeds it's already
// encrypted (skip); otherwise treat as plaintext and encrypt-in-place.
// Idempotent — safe to run multiple times.
//
// Run order during deploy (per docs/specs/tax_id_encryption_plan.md §3.5):
//   1. Schema migration (text widen) is in place
//   2. TAX_ID_ENCRYPTION_KEY is set in the target env
//   3. App code that encrypts on writes + decrypt-with-fallback on reads
//      has been deployed
//   4. Run this script
//   5. Confirm zero "encrypted from plaintext" reports on a re-run
//   6. (Follow-up commit) remove the decrypt-with-fallback branches in
//      organization-profile.ts and tax-id/reveal/route.ts
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-encrypt-tax-id.ts
//
// Requires: DATABASE_ADMIN_URL (or DATABASE_URL fallback) + TAX_ID_ENCRYPTION_KEY.

import { eq, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { organizations } from "@/db/schema";
import { decryptTaxId, encryptTaxId } from "@/lib/integrations/crypto";

const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_ADMIN_URL or DATABASE_URL is required");
  process.exit(1);
}
if (!process.env.TAX_ID_ENCRYPTION_KEY) {
  console.error("TAX_ID_ENCRYPTION_KEY is required");
  process.exit(1);
}

const sql = postgres(url, { max: 1, prepare: false });
const db = drizzle(sql);

async function main() {
  const rows = await db
    .select({ id: organizations.id, taxId: organizations.taxId })
    .from(organizations)
    .where(isNotNull(organizations.taxId));

  let alreadyEncrypted = 0;
  let encryptedFromPlaintext = 0;
  let errored = 0;

  for (const row of rows) {
    if (!row.taxId) continue;
    try {
      decryptTaxId(row.taxId);
      alreadyEncrypted++;
      continue;
    } catch {
      // Not decryptable with the current key → treat as legacy plaintext.
    }
    try {
      const encrypted = encryptTaxId(row.taxId);
      await db
        .update(organizations)
        .set({ taxId: encrypted })
        .where(eq(organizations.id, row.id));
      encryptedFromPlaintext++;
    } catch (err) {
      errored++;
      console.error(`[error] org ${row.id}: ${(err as Error).message}`);
    }
  }

  console.log("=== tax_id backfill complete ===");
  console.log(`  rows scanned:            ${rows.length}`);
  console.log(`  already encrypted:       ${alreadyEncrypted}`);
  console.log(`  encrypted from plaintext: ${encryptedFromPlaintext}`);
  console.log(`  errored:                 ${errored}`);

  if (errored > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => sql.end());
