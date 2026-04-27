/* eslint-disable */
/**
 * Audit script: every Drizzle op (.from/.insert/.update/.delete) against an
 * RLS-enabled table must run inside a withTenant transaction, dbAdmin pool,
 * or a parameterized helper that documents its own caller contract.
 *
 * Why this exists: org-scoped RLS policies cast
 * `current_setting('app.current_org_id', true)::uuid` directly. A bare-db
 * read of an RLS-enabled table fires that cast with the GUC unset (`''`) and
 * Postgres throws `invalid input syntax for type uuid: ""`. See
 * docs/specs/security_posture.md §6 (Risk catalog).
 *
 * Run modes:
 *   - CLI: `node scripts/rls-audit.js`  → prints summary + sites, exits 1 if unsafe.
 *   - Programmatic: `require('./scripts/rls-audit')()` → returns the report object.
 *
 * Auto-discovers RLS-enabled tables from src/db/schema/*.ts (any pgTable
 * whose definition ends in `).enableRLS()`). No table list to maintain.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const SCHEMA = path.join(SRC, 'db', 'schema');

// Files where bare-db on an RLS table is intentional (system context where
// no tenant GUC exists, or low-level helpers that own their tenant story).
const SKIP_FILES = new Set([
  'src/db/seed.ts',
  'src/db/with-tenant.ts',
  'src/db/admin-pool.ts',
  'src/db/client.ts',
]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.next' ||
        entry.name === 'migrations' ||
        entry.name === 'schema'
      )
        continue;
      yield* walk(p);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      yield p;
    }
  }
}

function discoverRlsTables() {
  const names = [];
  for (const file of fs.readdirSync(SCHEMA)) {
    if (!file.endsWith('.ts')) continue;
    const text = fs.readFileSync(path.join(SCHEMA, file), 'utf8');
    // Match `export const <name> = pgTable( ... ).enableRLS();`
    // Use a streaming approach: track the most recent `export const X = pgTable(`
    // and emit X if a later `).enableRLS()` is hit before the next pgTable.
    const lines = text.split('\n');
    let pendingName = null;
    for (const line of lines) {
      const m = line.match(/^\s*export\s+const\s+(\w+)\s*=\s*pgTable\(/);
      if (m) {
        pendingName = m[1];
        continue;
      }
      if (/\)\.enableRLS\(\)/.test(line) && pendingName) {
        names.push(pendingName);
        pendingName = null;
      }
    }
  }
  return Array.from(new Set(names));
}

function classifyReceiver(lines, opLineIdx) {
  // Walk backwards up to 30 lines to find the start of this Drizzle chain.
  // The chain start is an identifier (db / tx / dbAdmin / etc.) followed by
  // either `.` or end-of-line (chain continues on next line).
  // Allowed prefixes include ternaries (`?` / `:`), assignment, await, return,
  // bracket/paren openers, commas, and start-of-line.
  for (let j = opLineIdx; j >= Math.max(0, opLineIdx - 30); j--) {
    const l = lines[j];
    const m = l.match(
      /(?:\bawait\s+|\breturn\s+|=\s*|^\s*|,\s*|\(\s*|\[\s*|\?\s*|:\s*)((?:this\.)?(?:dbAdmin|db|tx|trx|t|dbc|dbOrTx))(?=\s*(?:$|[.\n]))/,
    );
    if (m) return { receiver: m[1], line: j };
  }
  return { receiver: '?UNKNOWN?', line: opLineIdx };
}

function audit() {
  const rlsTables = discoverRlsTables();
  if (rlsTables.length === 0) {
    throw new Error('audit: no RLS-enabled tables discovered (regex drift?)');
  }
  const tableAlt = rlsTables
    .map((t) => t.replace(/[\\.*+?^${}()|[\]]/g, (m) => '\\' + m))
    .join('|');
  // Match the four direct mutators *and* the join verbs. A `.leftJoin(X, ...)`
  // or `.innerJoin(X, ...)` against an RLS-enabled X reads X's rows, which
  // fires the policy — same uuid-cast failure as `.from(X)` when the GUC
  // isn't set. The original audit only matched .from/.insert/.update/.delete
  // and silently missed joined-side gaps; a runtime UUID-cast error in
  // loadConversationsForUser (messages join → documents) surfaced the gap.
  const opPattern = new RegExp(
    '\\.(from|insert|update|delete|leftJoin|innerJoin|rightJoin|fullJoin)\\((' +
      tableAlt +
      ')\\b',
  );

  const findings = [];
  for (const file of walk(SRC)) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (SKIP_FILES.has(rel)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(opPattern);
      if (!m) continue;
      const { receiver, line: receiverLine } = classifyReceiver(lines, i);
      findings.push({
        table: m[2],
        file: rel,
        line: i + 1,
        receiver,
        receiverLine: receiverLine + 1,
        snippet: lines[i].trim(),
      });
    }
  }

  // Classification:
  //   `db` (or `this.db`) → UNSAFE — will fail when GUC is unset.
  //   `tx` / `trx` / `t`  → SAFE — inside withTenant transaction.
  //   `dbAdmin`           → SAFE — BYPASSRLS pool, intentional system context.
  //   `dbc` / `dbOrTx`    → PARAMETERIZED — safety depends on caller. The
  //                          helpers that take these (counter, emit, notify)
  //                          have been spot-checked to confirm callers always
  //                          pass tx/dbAdmin. Flag as a separate bucket so
  //                          regressions surface, but don't fail CI on them.
  const unsafe = findings.filter((f) => f.receiver === 'db' || f.receiver === 'this.db');
  const txSafe = findings.filter((f) => /^(tx|trx|t)$/.test(f.receiver));
  const adminSafe = findings.filter((f) => f.receiver === 'dbAdmin');
  const parameterized = findings.filter((f) =>
    /^(dbc|dbOrTx)$/.test(f.receiver),
  );
  const unknown = findings.filter(
    (f) => !/^(db|this\.db|tx|trx|t|dbAdmin|dbc|dbOrTx)$/.test(f.receiver),
  );

  return { rlsTables, findings, unsafe, txSafe, adminSafe, parameterized, unknown };
}

function printReport(r) {
  console.log('\n=== SUMMARY ===');
  console.log('RLS-enabled tables:  ', r.rlsTables.length);
  console.log('Total RLS-table ops: ', r.findings.length);
  console.log('UNSAFE (bare db.):   ', r.unsafe.length);
  console.log('Tx-safe (tx/trx/t):  ', r.txSafe.length);
  console.log('Admin (dbAdmin.):    ', r.adminSafe.length);
  console.log('Parameterized (dbc): ', r.parameterized.length);
  console.log('Unknown receiver:    ', r.unknown.length);

  if (r.unsafe.length) {
    console.log('\n=== UNSAFE BARE-DB SITES ===');
    const byFile = {};
    for (const f of r.unsafe) (byFile[f.file] = byFile[f.file] || []).push(f);
    for (const file of Object.keys(byFile).sort()) {
      console.log('\n' + file);
      for (const f of byFile[file]) {
        console.log(
          '  L' +
            f.line +
            ' (recv L' +
            f.receiverLine +
            ') [' +
            f.table +
            '] :: ' +
            f.snippet,
        );
      }
    }
  }
  if (r.unknown.length) {
    console.log('\n=== UNKNOWN RECEIVER (inspect manually) ===');
    for (const f of r.unknown) {
      console.log(
        f.file +
          ':' +
          f.line +
          ' [' +
          f.table +
          '] recv="' +
          f.receiver +
          '" :: ' +
          f.snippet,
      );
    }
  }
}

if (require.main === module) {
  const r = audit();
  printReport(r);
  if (r.unsafe.length > 0) {
    console.error(
      '\nFAIL: ' + r.unsafe.length + ' bare-db call(s) hit RLS-enabled tables. ' +
        'Wrap each in withTenant(orgId, tx => ...) or route through dbAdmin if pre-tenant. ' +
        'See docs/specs/security_posture.md §6.',
    );
    process.exit(1);
  }
  console.log('\nOK: no bare-db calls against RLS-enabled tables.');
}

module.exports = audit;
