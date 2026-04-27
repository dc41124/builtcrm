// Static check: every `db.select / db.insert / db.update / db.delete /
// db.transaction / db.execute` call site must live in an allowlisted file
// (seed, admin scripts) OR be wrapped in withTenant / withTenantUser /
// dbAdmin.
//
// This is the Phase 5 close-out CI gate (RLS sprint plan §5). When CI
// lands, wire this into the workflow as `npm run check:rls`. For now it's
// run-on-demand and pre-commit-friendly (~1s on the full repo).
//
// RATCHET MODEL — brownfield codebase reality:
//   The check found 49 pre-existing bare-db sites at sprint close. Many
//   are false positives (writes to non-RLS tables: auditEvents, users,
//   subscriptionPlans), some are real debt. Rather than block this slice
//   on a 30+ file fix, the script ratchets:
//
//     - scripts/check-rls-callsites.baseline.txt lists every known site.
//     - The script fails ONLY if a NEW site appears (not in baseline).
//     - It also fails if a baseline site is removed and not regenerated
//       (so you can't accidentally let the baseline rot).
//
//   To regenerate the baseline after a real fix:
//     npx tsx scripts/check-rls-callsites.ts --update-baseline
//   Commit the changed baseline alongside the fix. Reviewers see the
//   baseline shrink, which is the signal that debt is being paid down.
//
// Heuristic, not perfect: we grep for `db.<dml>(` and `db.transaction(`
// inside src/, then exclude allowlisted paths. False positives on
// non-RLS tables are tolerated; the cost of fixing them by routing
// through withTenant/dbAdmin is near-zero anyway.
//
// USAGE:
//   npx tsx scripts/check-rls-callsites.ts
//   npx tsx scripts/check-rls-callsites.ts --update-baseline
//
// EXIT CODES:
//   0 — clean (current set matches baseline)
//   1 — drift (new bare call site found, OR baseline contains stale entries)
//   2 — invocation error (file walk failure, etc.)

import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

// Files / directories that are LEGITIMATELY allowed to use bare `db.*`.
// Everything else must use withTenant / withTenantUser / dbAdmin.
const ALLOWLIST: Array<RegExp> = [
  // The tenant chokepoint itself.
  /^src[\\/]db[\\/]with-tenant\.ts$/,
  // The bare client export — definition site, not a call site.
  /^src[\\/]db[\\/]client\.ts$/,
  // Admin pool definition + helpers.
  /^src[\\/]db[\\/]admin-pool\.ts$/,
  /^src[\\/]db[\\/]admin-client\.ts$/,
  // Seed + one-off SQL apply path. Cross-org by construction.
  /^src[\\/]db[\\/]seed\.ts$/,
  // Migration files (drizzle-kit generates).
  /^src[\\/]db[\\/]migrations[\\/]/,
  // Auth machinery — Better Auth's drizzle adapter operates on its own
  // tables (better_auth_user, better_auth_session, etc.) outside the
  // tenant/RLS model. The adapter writes via direct db handles.
  /^src[\\/]auth[\\/]/,
];

// DML / transaction call patterns we want to gate.
//
// `db.execute(sql\`...\`)` is also flagged because raw SQL bypasses the
// drizzle query builder and might silently route around RLS via
// SECURITY DEFINER calls. The few legitimate cases route through
// withTenant or dbAdmin and live in their own scope.
const FORBIDDEN_PATTERN =
  /(?<![a-zA-Z0-9_])db\.(select|insert|update|delete|transaction|execute)\s*\(/g;

const SRC_ROOT = "src";

function walk(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      // Skip the test fixtures directory — failure-mode tests need bare
      // db handles to assert pre-tenant fail-closed behavior.
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full, out);
      continue;
    }
    if (
      entry.endsWith(".ts") ||
      entry.endsWith(".tsx") ||
      entry.endsWith(".mts") ||
      entry.endsWith(".cts")
    ) {
      out.push(full);
    }
  }
}

function isAllowlisted(relPath: string): boolean {
  return ALLOWLIST.some((rx) => rx.test(relPath));
}

type Hit = { file: string; line: number; match: string };

// Stable string form for baseline comparison: just file:line:match,
// not the snippet text (which would churn on unrelated edits).
function hitKey(h: Hit): string {
  // Normalize Windows backslashes → forward slashes so the baseline is
  // platform-stable. Devs on Mac/Linux/Windows produce identical files.
  const normFile = h.file.replace(/\\/g, "/");
  return `${normFile}:${h.line}:${h.match}`;
}

function collectHits(): Hit[] {
  const files: string[] = [];
  walk(SRC_ROOT, files);
  const hits: Hit[] = [];

  for (const file of files) {
    const rel = relative(".", file);
    if (isAllowlisted(rel)) continue;

    const content = readFileSync(file, "utf-8");
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let m: RegExpExecArray | null;
      const localRx = new RegExp(FORBIDDEN_PATTERN.source, "g");
      while ((m = localRx.exec(line)) !== null) {
        // Skip occurrences in single-line comments (cheap heuristic).
        const beforeMatch = line.slice(0, m.index);
        if (/\/\/.*$/.test(beforeMatch)) continue;
        hits.push({
          file: rel,
          line: i + 1,
          match: m[1],
        });
      }
    }
  }
  return hits;
}

const BASELINE_PATH = "scripts/check-rls-callsites.baseline.txt";

function loadBaseline(): Set<string> {
  if (!existsSync(BASELINE_PATH)) return new Set();
  const content = readFileSync(BASELINE_PATH, "utf-8");
  return new Set(
    content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("#")),
  );
}

function writeBaseline(hits: Hit[]): void {
  const lines = [
    "# scripts/check-rls-callsites.baseline.txt",
    "# Generated by scripts/check-rls-callsites.ts --update-baseline.",
    "# Each line is `<file>:<line>:<dml>` for a bare db.* call site that",
    "# pre-dates the RLS sprint close. The check fails if a NEW entry",
    "# appears that's not in this list. Existing entries should shrink",
    "# over time as call sites are converted to withTenant / dbAdmin.",
    "#",
    "# DO NOT add entries by hand — re-run with --update-baseline after",
    "# a legitimate fix and commit the smaller diff.",
    "",
    ...hits.map(hitKey).sort(),
  ];
  writeFileSync(BASELINE_PATH, lines.join("\n") + "\n");
}

function main(): number {
  const updateBaseline = process.argv.includes("--update-baseline");
  const hits = collectHits();
  const hitKeys = new Set(hits.map(hitKey));

  if (updateBaseline) {
    writeBaseline(hits);
    console.log(
      `RLS call-site check: baseline updated (${hits.length} entries written to ${BASELINE_PATH}).`,
    );
    return 0;
  }

  const baseline = loadBaseline();
  const newHits = hits.filter((h) => !baseline.has(hitKey(h)));
  const stale = Array.from(baseline).filter((k) => !hitKeys.has(k));

  if (newHits.length === 0 && stale.length === 0) {
    console.log(
      `RLS call-site check: OK (${hits.length} known bare db.* sites tracked in baseline; 0 new).`,
    );
    return 0;
  }

  if (newHits.length > 0) {
    console.log(
      `RLS call-site check: FAIL — ${newHits.length} NEW bare db.* call site(s) appeared.\n`,
    );
    for (const h of newHits) {
      console.log(`  ${h.file}:${h.line}  db.${h.match}(`);
    }
    console.log(
      "\nFix: route through withTenant(orgId, tx => ...), withTenantUser(orgId, userId, tx => ...),",
    );
    console.log(
      "or dbAdmin (for cross-org system effects). If a call site is legitimately admin-context",
    );
    console.log(
      "(seed, one-off scripts), add its path to ALLOWLIST in scripts/check-rls-callsites.ts.",
    );
  }

  if (stale.length > 0) {
    console.log(
      `\nRLS call-site check: FAIL — ${stale.length} baseline entry/entries no longer match.`,
    );
    console.log(
      "If you fixed a tracked site, regenerate the baseline:\n  npx tsx scripts/check-rls-callsites.ts --update-baseline\n",
    );
    for (const k of stale) console.log(`  (stale)  ${k}`);
  }

  return 1;
}

try {
  process.exit(main());
} catch (err) {
  console.error("RLS call-site check: invocation error.", err);
  process.exit(2);
}
