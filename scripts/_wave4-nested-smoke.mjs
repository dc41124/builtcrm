// Smoke test: each wave-4 nested child must (1) return non-zero rows for
// the contractor org GUC, and (2) return zero rows for an unrelated GUC.
// Uses two pools:
//   - admin (DATABASE_ADMIN_URL, BYPASSRLS) for seed-data discovery
//   - app  (DATABASE_URL, NOBYPASSRLS)     for the actual RLS check
import postgres from "postgres";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const appUrl = process.env.DATABASE_URL;
if (!adminUrl || !appUrl) {
  throw new Error("DATABASE_ADMIN_URL and DATABASE_URL must both be set");
}

const admin = postgres(adminUrl, { max: 1 });
const app = postgres(appUrl, { max: 1 });

// Pick the contractor org with the most rfi_responses.
const [pick] = await admin`
  SELECT p.contractor_organization_id AS id, count(*)::int AS n
  FROM projects p
  JOIN rfis r ON r.project_id = p.id
  JOIN rfi_responses rr ON rr.rfi_id = r.id
  GROUP BY p.contractor_organization_id
  ORDER BY count(*) DESC
  LIMIT 1
`;
const orgId = pick?.id ?? null;
const [orgRow] = orgId
  ? await admin`SELECT id, name FROM organizations WHERE id = ${orgId}`
  : await admin`SELECT id, name FROM organizations WHERE id IN (SELECT contractor_organization_id FROM projects) ORDER BY id LIMIT 1`;
console.log(
  "contractor org:",
  orgRow.id,
  "(" + orgRow.name + ")",
  pick ? `has ${pick.n} rfi_responses` : "(no rfi_responses; will skip child checks if parent=0)",
);

const UNRELATED = "00000000-0000-0000-0000-000000000000";

const PAIRS = [
  ["rfi_responses", "rfis"],
  ["submittal_documents", "submittals"],
  ["submittal_transmittals", "submittals"],
  ["daily_log_amendments", "daily_logs"],
  ["daily_log_crew_entries", "daily_logs"],
  ["daily_log_delays", "daily_logs"],
  ["daily_log_issues", "daily_logs"],
  ["daily_log_photos", "daily_logs"],
];

async function countWithGuc(table, gucValue) {
  return app.begin(async (tx) => {
    await tx`SELECT set_config('app.current_org_id', ${gucValue}, true)`;
    const rows = await tx.unsafe(`SELECT count(*)::int AS c FROM ${table}`);
    return rows[0].c;
  });
}

let allOk = true;
for (const [child, parent] of PAIRS) {
  const totalChildRows = (await admin.unsafe(`SELECT count(*)::int AS c FROM ${child}`))[0].c;
  const parentOwned = await countWithGuc(parent, orgRow.id);
  const childOwned = await countWithGuc(child, orgRow.id);
  const childUnrelated = await countWithGuc(child, UNRELATED);
  // Three cases:
  //  - Empty seed (totalChildRows=0): can't exercise denial; report SKIP.
  //  - Parent has data and child has data: contractor>0 AND unrelated=0.
  //  - Parent empty: child should also be empty for both views.
  let label;
  let ok;
  if (totalChildRows === 0) {
    label = "SKIP";
    ok = true; // not a policy failure; vacuous
  } else if (parentOwned === 0) {
    label = childOwned === 0 && childUnrelated === 0 ? "OK  " : "FAIL";
    ok = label === "OK  ";
  } else {
    label = childOwned > 0 && childUnrelated === 0 ? "OK  " : "FAIL";
    ok = label === "OK  ";
  }
  if (!ok) allOk = false;
  console.log(
    `${label} ${child.padEnd(28)} parent(${parent})=${parentOwned}  child=${childOwned}  unrelated=${childUnrelated}  (totalSeed=${totalChildRows})`,
  );
}

await admin.end();
await app.end();
process.exit(allOk ? 0 : 1);
