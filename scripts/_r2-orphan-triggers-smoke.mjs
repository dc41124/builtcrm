import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
const rows = await sql`
  select tgname, tgrelid::regclass::text as table_name
  from pg_trigger
  where tgname like '%r2_orphan%'
  order by tgname
`;
console.log("triggers found:", rows.length);
for (const r of rows) console.log(`  ${r.table_name}: ${r.tgname}`);
const fns = await sql`
  select proname from pg_proc where proname = 'enqueue_r2_orphan_generic'
`;
console.log("trigger function exists:", fns.length === 1);
await sql.end();
