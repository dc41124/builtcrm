// Smoke test for Slice A bucket 4b — billing cluster (6 tables).
// Project-scoped 2-clause hybrid:
//   billing_packages, schedule_of_values, draw_requests, retainage_releases
// Nested-via-parent:
//   sov_line_items (parent: schedule_of_values)
//   draw_line_items (parent: draw_requests)
import postgres from "postgres";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const appUrl = process.env.DATABASE_URL;
if (!adminUrl || !appUrl) {
  throw new Error("DATABASE_ADMIN_URL and DATABASE_URL must both be set");
}
const admin = postgres(adminUrl, { max: 1 });
const app = postgres(appUrl, { max: 1 });

const UNRELATED = "00000000-0000-0000-0000-000000000000";

async function totalRows(table) {
  const r = await admin.unsafe(`SELECT count(*)::int AS c FROM ${table}`);
  return r[0].c;
}

async function countWithGuc(table, orgId) {
  return app.begin(async (tx) => {
    await tx`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    const rows = await tx.unsafe(`SELECT count(*)::int AS c FROM ${table}`);
    return rows[0].c;
  });
}

async function pickContractorOrgViaProject(table) {
  const r = await admin.unsafe(
    `SELECT p.contractor_organization_id AS id, count(*)::int AS n
     FROM ${table} t
     JOIN projects p ON p.id = t.project_id
     GROUP BY p.contractor_organization_id
     ORDER BY count(*) DESC LIMIT 1`,
  );
  return r[0]?.id ?? null;
}

async function pickContractorOrgViaSov() {
  const r = await admin.unsafe(
    `SELECT p.contractor_organization_id AS id, count(*)::int AS n
     FROM sov_line_items sli
     JOIN schedule_of_values sov ON sov.id = sli.sov_id
     JOIN projects p ON p.id = sov.project_id
     GROUP BY p.contractor_organization_id
     ORDER BY count(*) DESC LIMIT 1`,
  );
  return r[0]?.id ?? null;
}

async function pickContractorOrgViaDraw() {
  const r = await admin.unsafe(
    `SELECT p.contractor_organization_id AS id, count(*)::int AS n
     FROM draw_line_items dli
     JOIN draw_requests dr ON dr.id = dli.draw_request_id
     JOIN projects p ON p.id = dr.project_id
     GROUP BY p.contractor_organization_id
     ORDER BY count(*) DESC LIMIT 1`,
  );
  return r[0]?.id ?? null;
}

const tests = [
  { table: "billing_packages", shape: "project_hybrid", pick: () => pickContractorOrgViaProject("billing_packages") },
  { table: "schedule_of_values", shape: "project_hybrid", pick: () => pickContractorOrgViaProject("schedule_of_values") },
  { table: "draw_requests", shape: "project_hybrid", pick: () => pickContractorOrgViaProject("draw_requests") },
  { table: "retainage_releases", shape: "project_hybrid", pick: () => pickContractorOrgViaProject("retainage_releases") },
  { table: "sov_line_items", shape: "nested_sov", pick: pickContractorOrgViaSov },
  { table: "draw_line_items", shape: "nested_draw", pick: pickContractorOrgViaDraw },
];

let allOk = true;
for (const test of tests) {
  const total = await totalRows(test.table);
  const ownerOrgId = await test.pick();
  const owned = ownerOrgId ? await countWithGuc(test.table, ownerOrgId) : 0;
  const unrelated = await countWithGuc(test.table, UNRELATED);

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
    `${label} ${test.table.padEnd(22)} (${test.shape.padEnd(15)}) owner=${owned}  unrelated=${unrelated}  (total=${total})`,
  );
}

await admin.end();
await app.end();
process.exit(allOk ? 0 : 1);
