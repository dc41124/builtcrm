import { addDays } from "@/lib/daily-logs/date-utils";

// Calendar helpers shared by the contractor / commercial / subcontractor
// daily-logs page loaders. All helpers operate on ISO yyyy-mm-dd strings
// in the project timezone (date-utils resolves that upstream).

export function startOfMonth(isoDate: string): string {
  return isoDate.slice(0, 7) + "-01";
}

export function endOfMonth(isoDate: string): string {
  // Day 0 of next month = last day of current month.
  const [y, m] = isoDate.split("-").map((s) => parseInt(s, 10));
  const d = new Date(Date.UTC(y, m, 0));
  return d.toISOString().slice(0, 10);
}

// Mon-Fri treated as work days. Weekend tracking isn't per-project yet;
// matches the calendar grid which shades Sat/Sun grey.
export function countWorkDays(fromIso: string, toIso: string): number {
  let count = 0;
  let cur = fromIso;
  while (cur <= toIso) {
    const d = new Date(cur + "T12:00:00Z");
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
    cur = addDays(cur, 1);
  }
  return count;
}

export function countMissingWorkDays<T extends { logDate: string }>(
  logs: T[],
  fromIso: string,
  toIso: string,
): number {
  const logged = new Set(logs.map((l) => l.logDate));
  let missing = 0;
  let cur = fromIso;
  while (cur <= toIso) {
    const d = new Date(cur + "T12:00:00Z");
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6 && !logged.has(cur)) missing++;
    cur = addDays(cur, 1);
  }
  // Don't count today as missing — the day isn't over yet.
  const todayDow = new Date(toIso + "T12:00:00Z").getUTCDay();
  if (todayDow !== 0 && todayDow !== 6 && !logged.has(toIso)) missing--;
  return Math.max(missing, 0);
}
