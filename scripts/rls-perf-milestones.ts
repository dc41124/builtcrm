// Phase 4 pilot: measure RLS subquery cost on `milestones`.
//
// Strategy: open a connection as the runtime (NOBYPASSRLS) role, set the
// `app.current_org_id` GUC to the contractor org of an arbitrary
// project, and EXPLAIN ANALYZE the typical "schedule view" query.
// Compare planning + execution cost against the same query run as the
// admin (BYPASSRLS) role — the admin run shows the cost without the
// policy attached, so the delta tells us how much the 2-clause subquery
// adds.
//
// Run with:
//   npx tsx --env-file=.env.local scripts/rls-perf-milestones.ts

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
    // Pick a project + its contractor org from the seed/dev data.
    const [proj] = await admin<
      Array<{ id: string; contractor_org_id: string }>
    >`SELECT id, contractor_organization_id AS contractor_org_id
        FROM projects
        ORDER BY created_at DESC
        LIMIT 1`;
    if (!proj) {
      console.error("No projects in db — seed first");
      process.exit(1);
    }

    console.log(`Project: ${proj.id}`);
    console.log(`Contractor org: ${proj.contractor_org_id}`);

    const explainQuery = `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT id, title, milestone_status, scheduled_date
      FROM milestones
      WHERE project_id = '${proj.id}'
      ORDER BY phase, sort_order, scheduled_date
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
