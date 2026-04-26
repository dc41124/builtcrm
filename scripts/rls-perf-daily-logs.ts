// Phase 4 wave 3: measure RLS subquery cost on `daily_logs`.
//
// Same shape as scripts/rls-perf-milestones.ts. daily_logs is the
// canonical hot-table case — high write volume, frequent reads, and
// the policy clauses are identical to milestones, so the relative
// cost should match.
//
// Run with:
//   npx tsx --env-file=.env.local scripts/rls-perf-daily-logs.ts

import postgres from "postgres";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const runtimeUrl = process.env.DATABASE_URL;
if (!adminUrl || !runtimeUrl) {
  console.error("Need both DATABASE_ADMIN_URL and DATABASE_URL");
  process.exit(1);
}

async function main() {
  const admin = postgres(adminUrl!, { max: 1, prepare: false });
  const runtime = postgres(runtimeUrl!, { max: 1, prepare: false });
  try {
    const [proj] = await admin<
      Array<{ id: string; contractor_org_id: string }>
    >`SELECT id, contractor_organization_id AS contractor_org_id
        FROM projects
        WHERE id IN (SELECT project_id FROM daily_logs LIMIT 1)
        LIMIT 1`;
    if (!proj) {
      console.error("No daily_logs in db — seed first");
      process.exit(1);
    }

    console.log(`Project: ${proj.id}`);
    console.log(`Contractor org: ${proj.contractor_org_id}`);

    const explainQuery = `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT id, log_date, status, notes
      FROM daily_logs
      WHERE project_id = '${proj.id}'
      ORDER BY log_date DESC
      LIMIT 30
    `;

    console.log("\n=== Admin (BYPASSRLS, no policy) ===");
    const adminPlan = await admin.unsafe(explainQuery);
    for (const row of adminPlan) console.log(row["QUERY PLAN"]);

    console.log("\n=== Runtime (RLS active, GUC = contractor org) ===");
    await runtime.begin(async (sql) => {
      await sql`SELECT set_config('app.current_org_id', ${proj.contractor_org_id}, true)`;
      const runtimePlan = await sql.unsafe(explainQuery);
      for (const row of runtimePlan) console.log(row["QUERY PLAN"]);
    });

    console.log("\n=== Runtime (RLS active, GUC = unrelated org) ===");
    await runtime.begin(async (sql) => {
      await sql`SELECT set_config('app.current_org_id', '00000000-0000-0000-0000-000000000000', true)`;
      const denied = await sql.unsafe(explainQuery);
      for (const row of denied) console.log(row["QUERY PLAN"]);
    });
  } finally {
    await admin.end();
    await runtime.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
