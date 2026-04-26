// Phase 4 wave 5: measure RLS subquery cost on `documents`.
//
// Same shape as scripts/rls-perf-milestones.ts, daily-logs, rfis.
// documents is the cross-cutting hot table — it's joined from many
// places (drawings, daily logs, transmittals, weekly reports, lien
// waivers, compliance, submittals, change orders). Plan shape should
// match the other project-scoped 2-clause hybrid tables.
//
// Run with:
//   npx tsx --env-file=.env.local scripts/rls-perf-documents.ts

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
        WHERE id IN (SELECT project_id FROM documents LIMIT 1)
        LIMIT 1`;
    if (!proj) {
      console.error("No documents in db — seed first");
      process.exit(1);
    }

    console.log(`Project: ${proj.id}`);
    console.log(`Contractor org: ${proj.contractor_org_id}`);

    const explainQuery = `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT id, title, document_type, audience_scope
      FROM documents
      WHERE project_id = '${proj.id}'
        AND document_status = 'active'
      ORDER BY created_at DESC
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
