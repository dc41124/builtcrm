// Smoke test for prequal cluster RLS:
//   - prequal_templates: contractor sees their own (Pattern A); other org sees 0.
//   - prequal_submissions: BOTH the submitting sub AND the contractor see the
//     row; an unrelated org sees 0.
//   - prequal_documents: visible to both parties via the parent submission;
//     unrelated org sees 0.
import postgres from "postgres";

const adminUrl = process.env.DATABASE_ADMIN_URL;
const appUrl = process.env.DATABASE_URL;
if (!adminUrl || !appUrl) {
  throw new Error("DATABASE_ADMIN_URL and DATABASE_URL must both be set");
}
const admin = postgres(adminUrl, { max: 1 });
const app = postgres(appUrl, { max: 1 });

// Find a (sub, contractor) pair with at least one submission.
const [pick] = await admin`
  SELECT submitted_by_org_id AS sub_org_id, contractor_org_id AS contractor_org_id
  FROM prequal_submissions
  GROUP BY submitted_by_org_id, contractor_org_id
  ORDER BY count(*) DESC
  LIMIT 1
`;
if (!pick) {
  console.log("No prequal_submissions in seed — picking a contractor with templates");
}

let contractorOrgId, subOrgId;
if (pick) {
  contractorOrgId = pick.contractor_org_id;
  subOrgId = pick.sub_org_id;
} else {
  const [t] = await admin`SELECT org_id FROM prequal_templates LIMIT 1`;
  contractorOrgId = t?.org_id ?? null;
  subOrgId = null;
}
const UNRELATED = "00000000-0000-0000-0000-000000000000";

const [contractorRow] = contractorOrgId
  ? await admin`SELECT name FROM organizations WHERE id = ${contractorOrgId}`
  : [{ name: "(none)" }];
const [subRow] = subOrgId
  ? await admin`SELECT name FROM organizations WHERE id = ${subOrgId}`
  : [{ name: "(none)" }];
console.log(`contractor: ${contractorOrgId} (${contractorRow.name})`);
console.log(`sub:        ${subOrgId ?? "(none)"} (${subRow.name})`);

async function countWithGuc(table, gucValue) {
  return app.begin(async (tx) => {
    await tx`SELECT set_config('app.current_org_id', ${gucValue}, true)`;
    const rows = await tx.unsafe(`SELECT count(*)::int AS c FROM ${table}`);
    return rows[0].c;
  });
}

async function totalRows(table) {
  const rows = await admin.unsafe(`SELECT count(*)::int AS c FROM ${table}`);
  return rows[0].c;
}

let allOk = true;

// ── prequal_templates: Pattern A
{
  const total = await totalRows("prequal_templates");
  const contractor = contractorOrgId ? await countWithGuc("prequal_templates", contractorOrgId) : 0;
  const sub = subOrgId ? await countWithGuc("prequal_templates", subOrgId) : 0;
  const unrelated = await countWithGuc("prequal_templates", UNRELATED);
  let ok, label;
  if (total === 0) { label = "SKIP"; ok = true; }
  else {
    // Contractor MUST see >0; sub MUST NOT see contractor's templates; unrelated 0.
    ok = contractor > 0 && sub === 0 && unrelated === 0;
    label = ok ? "OK  " : "FAIL";
  }
  if (!ok) allOk = false;
  console.log(`${label} prequal_templates           contractor=${contractor}  sub=${sub}  unrelated=${unrelated}  (totalSeed=${total})`);
}

// ── prequal_submissions: 2-clause own-side multi-org
{
  const total = await totalRows("prequal_submissions");
  const contractor = contractorOrgId ? await countWithGuc("prequal_submissions", contractorOrgId) : 0;
  const sub = subOrgId ? await countWithGuc("prequal_submissions", subOrgId) : 0;
  const unrelated = await countWithGuc("prequal_submissions", UNRELATED);
  let ok, label;
  if (total === 0) { label = "SKIP"; ok = true; }
  else {
    // BOTH parties see their own submissions; unrelated 0.
    ok = contractor > 0 && sub > 0 && unrelated === 0;
    label = ok ? "OK  " : "FAIL";
  }
  if (!ok) allOk = false;
  console.log(`${label} prequal_submissions         contractor=${contractor}  sub=${sub}  unrelated=${unrelated}  (totalSeed=${total})`);
}

// ── prequal_documents: nested-via-parent on prequal_submissions
{
  const total = await totalRows("prequal_documents");
  const contractor = contractorOrgId ? await countWithGuc("prequal_documents", contractorOrgId) : 0;
  const sub = subOrgId ? await countWithGuc("prequal_documents", subOrgId) : 0;
  const unrelated = await countWithGuc("prequal_documents", UNRELATED);
  let ok, label;
  if (total === 0) { label = "SKIP"; ok = true; }
  else {
    ok = (contractor > 0 || sub > 0) && unrelated === 0;
    label = ok ? "OK  " : "FAIL";
  }
  if (!ok) allOk = false;
  console.log(`${label} prequal_documents           contractor=${contractor}  sub=${sub}  unrelated=${unrelated}  (totalSeed=${total})`);
}

await admin.end();
await app.end();
process.exit(allOk ? 0 : 1);
