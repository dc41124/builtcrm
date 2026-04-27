// Smoke test for Slice A bucket 3 — 7 tables newly RLS'd in migration 0041.
// Mix of policy shapes:
//   Pattern A (org_id = GUC):                 inspection_templates
//   nested-via-parent:                        purchase_order_lines, milestone_dependencies, subscription_invoices
//   project-scoped 2-clause hybrid:           upload_requests, approvals
//   user-scoped (app.current_user_id):        user_notification_preferences
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

async function countWithOrgGuc(table, orgId) {
  return app.begin(async (tx) => {
    await tx`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    const rows = await tx.unsafe(`SELECT count(*)::int AS c FROM ${table}`);
    return rows[0].c;
  });
}

async function countWithUserGuc(table, userId, orgId) {
  return app.begin(async (tx) => {
    await tx`SELECT set_config('app.current_org_id', ${orgId ?? UNRELATED}, true)`;
    await tx`SELECT set_config('app.current_user_id', ${userId}, true)`;
    const rows = await tx.unsafe(`SELECT count(*)::int AS c FROM ${table}`);
    return rows[0].c;
  });
}

async function pickOrgByCol(table, col) {
  const r = await admin.unsafe(
    `SELECT ${col} AS id, count(*)::int AS n FROM ${table} GROUP BY ${col} ORDER BY count(*) DESC LIMIT 1`,
  );
  return r[0]?.id ?? null;
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

async function pickContractorOrgViaPo(table) {
  const r = await admin.unsafe(
    `SELECT po.organization_id AS id, count(*)::int AS n
     FROM ${table} l
     JOIN purchase_orders po ON po.id = l.purchase_order_id
     GROUP BY po.organization_id
     ORDER BY count(*) DESC LIMIT 1`,
  );
  return r[0]?.id ?? null;
}

async function pickContractorOrgViaParent(table, parentTable, fkCol) {
  const r = await admin.unsafe(
    `SELECT p.organization_id AS id, count(*)::int AS n
     FROM ${table} c
     JOIN ${parentTable} p ON p.id = c.${fkCol}
     GROUP BY p.organization_id
     ORDER BY count(*) DESC LIMIT 1`,
  );
  return r[0]?.id ?? null;
}

async function pickContractorOrgViaMilestones(table) {
  const r = await admin.unsafe(
    `SELECT pr.contractor_organization_id AS id, count(*)::int AS n
     FROM ${table} d
     JOIN milestones m ON m.id = d.predecessor_id
     JOIN projects pr ON pr.id = m.project_id
     GROUP BY pr.contractor_organization_id
     ORDER BY count(*) DESC LIMIT 1`,
  );
  return r[0]?.id ?? null;
}

async function pickUser(table) {
  const r = await admin.unsafe(
    `SELECT user_id AS id, count(*)::int AS n FROM ${table} GROUP BY user_id ORDER BY count(*) DESC LIMIT 1`,
  );
  return r[0]?.id ?? null;
}

const tests = [
  // Pattern A
  {
    table: "inspection_templates",
    shape: "pattern_a",
    pickOwner: () => pickOrgByCol("inspection_templates", "org_id"),
  },
  // nested-via-parent (PO)
  {
    table: "purchase_order_lines",
    shape: "nested_po",
    pickOwner: () => pickContractorOrgViaPo("purchase_order_lines"),
  },
  // nested-via-parent (milestones)
  {
    table: "milestone_dependencies",
    shape: "nested_milestones",
    pickOwner: () => pickContractorOrgViaMilestones("milestone_dependencies"),
  },
  // nested-via-parent (organization_subscriptions)
  {
    table: "subscription_invoices",
    shape: "nested_org_sub",
    pickOwner: () =>
      pickContractorOrgViaParent(
        "subscription_invoices",
        "organization_subscriptions",
        "organization_subscription_id",
      ),
  },
  // project-scoped 2-clause hybrid
  {
    table: "upload_requests",
    shape: "project_hybrid",
    pickOwner: () => pickContractorOrgViaProject("upload_requests"),
  },
  {
    table: "approvals",
    shape: "project_hybrid",
    pickOwner: () => pickContractorOrgViaProject("approvals"),
  },
];

let allOk = true;
for (const test of tests) {
  const total = await totalRows(test.table);
  const ownerOrgId = await test.pickOwner();
  const owned = ownerOrgId ? await countWithOrgGuc(test.table, ownerOrgId) : 0;
  const unrelated = await countWithOrgGuc(test.table, UNRELATED);

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
    `${label} ${test.table.padEnd(28)} (${test.shape.padEnd(18)}) owner=${owned}  unrelated=${unrelated}  (total=${total})`,
  );
}

// User-scoped
{
  const total = await totalRows("user_notification_preferences");
  const ownerUserId = await pickUser("user_notification_preferences");
  // Get the user's org for the GUC. Any active org assignment works.
  const orgRow = ownerUserId
    ? await admin.unsafe(
        `SELECT organization_id FROM organization_users WHERE user_id = $1 LIMIT 1`,
        [ownerUserId],
      )
    : [];
  const userOrgId = orgRow[0]?.organization_id ?? null;
  const owned = ownerUserId
    ? await countWithUserGuc(
        "user_notification_preferences",
        ownerUserId,
        userOrgId,
      )
    : 0;
  const unrelated = await countWithUserGuc(
    "user_notification_preferences",
    UNRELATED,
    UNRELATED,
  );
  // Missing-GUC fail-closed: don't set user_id at all
  const noGucCount = await countWithOrgGuc(
    "user_notification_preferences",
    userOrgId ?? UNRELATED,
  );

  let label, ok;
  if (total === 0) {
    label = "SKIP";
    ok = true;
  } else {
    ok = owned > 0 && unrelated === 0 && noGucCount === 0;
    label = ok ? "OK  " : "FAIL";
  }
  if (!ok) allOk = false;
  console.log(
    `${label} user_notification_preferences (user_scoped       ) owner=${owned}  unrelated=${unrelated}  noGUC=${noGucCount}  (total=${total})`,
  );
}

await admin.end();
await app.end();
process.exit(allOk ? 0 : 1);
