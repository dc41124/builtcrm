// Smoke test for the 3 background-job tables. Pattern A on all three:
// owning org sees rows, unrelated org sees 0.
import postgres from "postgres";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const appUrl = process.env.DATABASE_URL;
if (!adminUrl || !appUrl) {
  throw new Error("DATABASE_ADMIN_URL and DATABASE_URL must both be set");
}
const admin = postgres(adminUrl, { max: 1 });
const app = postgres(appUrl, { max: 1 });

const TABLES = ["payment_transactions", "sync_events", "webhook_events"];
const UNRELATED = "00000000-0000-0000-0000-000000000000";

async function totalRows(table) {
  const r = await admin.unsafe(`SELECT count(*)::int AS c FROM ${table}`);
  return r[0].c;
}

async function pickOrg(table) {
  // Find the org with the most rows in this table
  const r = await admin.unsafe(
    `SELECT organization_id AS id, count(*)::int AS n FROM ${table} GROUP BY organization_id ORDER BY count(*) DESC LIMIT 1`,
  );
  return r[0]?.id ?? null;
}

async function countWithGuc(table, gucValue) {
  return app.begin(async (tx) => {
    await tx`SELECT set_config('app.current_org_id', ${gucValue}, true)`;
    const rows = await tx.unsafe(`SELECT count(*)::int AS c FROM ${table}`);
    return rows[0].c;
  });
}

let allOk = true;
for (const table of TABLES) {
  const total = await totalRows(table);
  const ownerOrgId = await pickOrg(table);
  const owned = ownerOrgId ? await countWithGuc(table, ownerOrgId) : 0;
  const unrelated = await countWithGuc(table, UNRELATED);

  let label, ok;
  if (total === 0) {
    label = "SKIP";
    ok = true;
  } else {
    ok = owned > 0 && unrelated === 0;
    label = ok ? "OK  " : "FAIL";
  }
  if (!ok) allOk = false;
  console.log(
    `${label} ${table.padEnd(24)} owner=${owned}  unrelated=${unrelated}  (totalSeed=${total})`,
  );
}

await admin.end();
await app.end();
process.exit(allOk ? 0 : 1);
