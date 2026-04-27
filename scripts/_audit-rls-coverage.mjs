// Enumerate every pgTable declaration and determine whether the same
// block has .enableRLS(). Outputs the un-RLS'd table list.
//
// USAGE:
//   node scripts/_audit-rls-coverage.mjs
//
// Originally a one-shot for the RLS sprint Slice A planning. Kept as a
// sanity check — when adding new schemas, run this to verify either
// RLS is enabled or the table is documented in security_posture.md §6
// "Tables intentionally NOT RLS'd". As of 2026-04-26 the expected
// count is 85 / 99 RLS'd; the 14 un-RLS'd tables are all documented in
// security_posture.md §6 (11 deliberately un-RLS'd, 3 deferred).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = "src/db/schema";

function walk(dir, out) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { walk(p, out); continue; }
    if (e.endsWith(".ts") && e !== "index.ts" && e !== "_shared.ts") out.push(p);
  }
}

const files = [];
walk(SRC, files);

const tables = []; // { file, name, rls }

for (const f of files) {
  const content = readFileSync(f, "utf-8");
  // Find `export const <name> = pgTable(` declarations, walk forward
  // until the matching ) of pgTable, then check whether `.enableRLS()`
  // appears immediately after.
  const declRx = /export const (\w+) = pgTable\(/g;
  let m;
  while ((m = declRx.exec(content)) !== null) {
    const name = m[1];
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      i++;
    }
    const after = content.slice(i, i + 60).replace(/\s/g, "");
    const rls = after.startsWith(".enableRLS()");
    tables.push({ file: f, name, rls });
  }
}

const total = tables.length;
const rlsd = tables.filter((t) => t.rls).length;
const notRlsd = tables.filter((t) => !t.rls);

console.log(`Total pgTable declarations: ${total}`);
console.log(`RLS-enabled: ${rlsd}`);
console.log(`NOT RLS-enabled: ${notRlsd.length}\n`);
console.log("Un-RLS'd tables:");
for (const t of notRlsd) console.log(`  ${t.file}: ${t.name}`);
