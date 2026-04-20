import { eq, inArray } from "drizzle-orm";

import { db } from "@/db/client";
import { dailyLogCrewEntries, projects } from "@/db/schema";

import { getContractorOrgContext } from "./integrations";
import type { SessionLike } from "../context";

// Labor & Productivity loader (Step 24.5 wiring).
//
// Hours-only. The schema carries hours per sub/trade/day on
// daily_log_crew_entries but no rate source — a production-grade cost view
// needs an `organization_labor_rates` table (see
// docs/specs/production_grade_upgrades/). We compute hours + crew days +
// composition by trade from what's here and clearly label it "hours."
//
// Reconciliation rule: when the GC reconciles an entry, `reconciledHours`
// and `reconciledHeadcount` override the submitted values. Queries here
// use COALESCE semantics in memory so the figures match what the crew
// portal actually shows.
//
// Trade normalization: `trade` is a free-form varchar. We preserve the
// label as entered, keep the top-5 trades by total hours, and roll the
// rest into "Other". Canonical enumeration awaits the same taxonomy
// work that Compliance needs.

// ---------------------------------------------------------------
// Return shape
// ---------------------------------------------------------------

export type LaborProjectRow = {
  projectId: string;
  projectName: string;
  hoursTotal: number;
  crewDays: number;          // sum of headcount-day rows (entries) with hours > 0
  uniqueCrewDays: number;    // number of distinct (org, date) entries
  // Per-trade hours within this project. Keys match the canonical
  // `tradesOrder` on the view (top-5 + "Other").
  hoursByTrade: Record<string, number>;
};

export type LaborReportView = {
  rows: LaborProjectRow[];
  tradesOrder: string[];     // canonical display order for stacked bars
  totals: {
    hoursTotal: number;
    crewDays: number;
    avgCrewSize: number;     // headcount-hours-weighted average
  };
  // 8-week rolling trend: hours per week, oldest-first.
  trendHours: number[];
  generatedAtIso: string;
};

type LoaderInput = { session: SessionLike | null | undefined };

const DAY_MS = 86_400_000;
const TREND_WEEKS = 8;
const MAX_TRADE_COLUMNS = 5;
const OTHER_TRADE = "Other";

export async function getLaborReport(
  input: LoaderInput,
): Promise<LaborReportView> {
  const context = await getContractorOrgContext(input.session);
  const orgId = context.organization.id;
  const now = new Date();

  const projectRows = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.contractorOrganizationId, orgId));
  const projectIds = projectRows.map((p) => p.id);
  if (projectIds.length === 0) return emptyView(now);

  const crewRows = await db
    .select({
      projectId: dailyLogCrewEntries.projectId,
      orgId: dailyLogCrewEntries.orgId,
      trade: dailyLogCrewEntries.trade,
      logDate: dailyLogCrewEntries.logDate,
      headcount: dailyLogCrewEntries.headcount,
      hours: dailyLogCrewEntries.hours,
      reconciledHeadcount: dailyLogCrewEntries.reconciledHeadcount,
      reconciledHours: dailyLogCrewEntries.reconciledHours,
    })
    .from(dailyLogCrewEntries)
    .where(inArray(dailyLogCrewEntries.projectId, projectIds));

  // --- Bucket 1: per-project rollup (hours + trade composition) ---
  const perProject = new Map<
    string,
    {
      hoursTotal: number;
      crewDays: number;
      uniqueCrewDays: Set<string>;
      byTrade: Map<string, number>;
    }
  >();
  let grandHours = 0;
  let grandCrewDays = 0;
  let weightedCrewSizeNumerator = 0;

  const tradeTotals = new Map<string, number>();

  for (const row of crewRows) {
    const hours = Number.parseFloat(row.reconciledHours ?? row.hours);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const headcount = row.reconciledHeadcount ?? row.headcount;
    const trade = row.trade ?? "Unspecified";

    grandHours += hours;
    grandCrewDays += headcount;
    weightedCrewSizeNumerator += headcount * hours;

    const project = perProject.get(row.projectId) ?? {
      hoursTotal: 0,
      crewDays: 0,
      uniqueCrewDays: new Set<string>(),
      byTrade: new Map<string, number>(),
    };
    project.hoursTotal += hours;
    project.crewDays += headcount;
    project.uniqueCrewDays.add(`${row.orgId}::${row.logDate}`);
    project.byTrade.set(
      trade,
      (project.byTrade.get(trade) ?? 0) + hours,
    );
    perProject.set(row.projectId, project);

    tradeTotals.set(trade, (tradeTotals.get(trade) ?? 0) + hours);
  }

  // Canonical trade order: top-N by total hours, then "Other" for the rest.
  const sortedTrades = Array.from(tradeTotals.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const topTrades = sortedTrades.slice(0, MAX_TRADE_COLUMNS).map(([t]) => t);
  const hasOther = sortedTrades.length > MAX_TRADE_COLUMNS;
  const tradesOrder = hasOther ? [...topTrades, OTHER_TRADE] : topTrades;

  const rows: LaborProjectRow[] = projectRows
    .map((p) => {
      const proj = perProject.get(p.id);
      if (!proj) return null;
      const hoursByTrade: Record<string, number> = {};
      for (const t of tradesOrder) hoursByTrade[t] = 0;
      for (const [trade, hours] of proj.byTrade.entries()) {
        if (topTrades.includes(trade)) {
          hoursByTrade[trade] = (hoursByTrade[trade] ?? 0) + hours;
        } else if (hasOther) {
          hoursByTrade[OTHER_TRADE] =
            (hoursByTrade[OTHER_TRADE] ?? 0) + hours;
        }
      }
      return {
        projectId: p.id,
        projectName: p.name,
        hoursTotal: Math.round(proj.hoursTotal * 100) / 100,
        crewDays: proj.crewDays,
        uniqueCrewDays: proj.uniqueCrewDays.size,
        hoursByTrade,
      };
    })
    .filter((r): r is LaborProjectRow => r !== null && r.hoursTotal > 0)
    .sort((a, b) => b.hoursTotal - a.hoursTotal);

  const avgCrewSize = grandHours > 0 ? weightedCrewSizeNumerator / grandHours : 0;

  // --- Bucket 2: 8-week trend ---
  // Bucket each entry into the week that contains its logDate. Week 0 is
  // (now - 7*TREND_WEEKS) → (now - 7*(TREND_WEEKS-1)); Week TREND_WEEKS-1
  // ends today.
  const trendHours: number[] = Array(TREND_WEEKS).fill(0);
  const trendStartMs = now.getTime() - TREND_WEEKS * 7 * DAY_MS;
  for (const row of crewRows) {
    const hours = Number.parseFloat(row.reconciledHours ?? row.hours);
    if (!Number.isFinite(hours) || hours <= 0) continue;
    const rowMs = new Date(row.logDate).getTime();
    if (rowMs < trendStartMs || rowMs > now.getTime()) continue;
    const weekIdx = Math.min(
      TREND_WEEKS - 1,
      Math.floor((rowMs - trendStartMs) / (7 * DAY_MS)),
    );
    trendHours[weekIdx] += hours;
  }

  return {
    rows,
    tradesOrder,
    totals: {
      hoursTotal: Math.round(grandHours * 100) / 100,
      crewDays: grandCrewDays,
      avgCrewSize: Math.round(avgCrewSize * 100) / 100,
    },
    trendHours: trendHours.map((h) => Math.round(h * 100) / 100),
    generatedAtIso: now.toISOString(),
  };
}

function emptyView(now: Date): LaborReportView {
  return {
    rows: [],
    tradesOrder: [],
    totals: { hoursTotal: 0, crewDays: 0, avgCrewSize: 0 },
    trendHours: Array(TREND_WEEKS).fill(0),
    generatedAtIso: now.toISOString(),
  };
}
