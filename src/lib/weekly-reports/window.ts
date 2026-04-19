// Week-window computation for the weekly-report generator.
//
// "The week" is the most recently completed Monday→Sunday window ending
// before the current moment, evaluated in the project's local timezone.
// The generator stores week_start and week_end as date columns (no tz),
// holding the local calendar dates; source-data queries filter on
// timestamp-with-tz fields, so we also return UTC instants for those
// comparisons.
//
// Trigger.dev fires hourly; the job inspects every active project and
// asks "is the current local time within the Monday 06:00–06:59 window
// in this project's tz?" If yes AND no draft exists for the week ending
// the prior Sunday, the generator runs. The check + generate split keeps
// timezone math in one place (this module).

const MS_PER_DAY = 86_400_000;

/** Result of a week-window computation, in two complementary forms. */
export type WeekWindow = {
  /** Local-calendar Monday 00:00 in project tz, expressed as YYYY-MM-DD. */
  weekStartLocalDate: string;
  /** Local-calendar Sunday 23:59 in project tz, expressed as YYYY-MM-DD. */
  weekEndLocalDate: string;
  /** UTC instant corresponding to local Monday 00:00:00. */
  weekStartUtc: Date;
  /** UTC instant corresponding to local Sunday 23:59:59.999. */
  weekEndUtc: Date;
};

/** Window the report should cover when generating "as of" the given moment. */
export function computeReportWindow(asOfMs: number, timezone: string): WeekWindow {
  // Get the local-calendar (year, month, day) at asOf in the given tz.
  const local = getLocalParts(asOfMs, timezone);
  // Compute weekday in the local tz: 0=Sun, 1=Mon, ..., 6=Sat
  const localWeekday = getLocalWeekday(asOfMs, timezone);

  // Days since the most recent Monday. If today is Monday, the most
  // RECENTLY-COMPLETED week ended yesterday (Sunday), so we go back 7 days.
  // For Tue–Sun the prior Monday (1–6 days ago) starts the completed week.
  const daysBackToWeekStart = localWeekday === 1 ? 7 : ((localWeekday + 6) % 7) + 0;

  // Anchor a date in local tz at "today 00:00", then walk back.
  // Using ms arithmetic with a noon-ish pivot avoids DST half-hour edge cases
  // for boundary computation; we re-anchor at local midnight via the parts.
  const todayLocalMidnightUtc = localPartsToUtc(local.year, local.month, local.day, 0, 0, 0, timezone);
  const weekStartUtcMs = todayLocalMidnightUtc.getTime() - daysBackToWeekStart * MS_PER_DAY;
  const weekStartUtc = new Date(weekStartUtcMs);

  // weekEnd = Sunday 23:59:59.999 local. That's 7 days minus 1ms after the
  // Monday 00:00 we just anchored.
  const weekEndUtc = new Date(weekStartUtcMs + 7 * MS_PER_DAY - 1);

  return {
    weekStartLocalDate: formatYmd(weekStartUtc, timezone),
    weekEndLocalDate: formatYmd(weekEndUtc, timezone),
    weekStartUtc,
    weekEndUtc,
  };
}

/**
 * True when the given moment, expressed in the project's local time, is
 * within the configured Monday-morning send window (default 06:00–06:59).
 * Used by the Trigger.dev job to decide whether to fire generation for a
 * given project on a given hourly tick.
 */
export function isMondaySendWindow(
  asOfMs: number,
  timezone: string,
  hour = 6,
): boolean {
  const weekday = getLocalWeekday(asOfMs, timezone);
  if (weekday !== 1) return false; // Mon = 1
  const localHour = getLocalHour(asOfMs, timezone);
  return localHour === hour;
}

// ---------------------------------------------------------------------------
// Internal helpers — Intl.DateTimeFormat is the canonical way to read
// timezone-aware calendar parts in Node.
// ---------------------------------------------------------------------------

type LocalParts = { year: number; month: number; day: number };

function getLocalParts(ms: number, timezone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

function getLocalWeekday(ms: number, timezone: string): number {
  // "short" weekday gives "Sun".."Sat"; map to 0..6
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const name = fmt.format(new Date(ms));
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[name] ?? 0;
}

function getLocalHour(ms: number, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  });
  const value = fmt.format(new Date(ms));
  // Some Intl outputs return "24" instead of "00" at midnight in older Node
  // versions; normalize.
  const n = Number(value.replace(/[^0-9]/g, ""));
  return n === 24 ? 0 : n;
}

/**
 * Convert local-calendar (Y, M, D, h, m, s) in `timezone` to a UTC Date.
 * Uses an iterative offset solve: tz offsets aren't a pure function of UTC
 * time during DST transitions, so we converge by re-evaluating the offset
 * at the candidate UTC instant.
 */
function localPartsToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timezone: string,
): Date {
  // Naive UTC interpretation of the local parts; offset will pull this back.
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  // Compute tz offset at this naive instant and adjust.
  const offset1 = getTzOffsetMinutes(naiveUtcMs, timezone);
  const candidate1 = naiveUtcMs - offset1 * 60_000;
  // Re-evaluate offset at candidate (DST safety) and refine once.
  const offset2 = getTzOffsetMinutes(candidate1, timezone);
  return new Date(naiveUtcMs - offset2 * 60_000);
}

function getTzOffsetMinutes(ms: number, timezone: string): number {
  // Format the same instant as a UTC string and as a local string, then
  // diff in minutes. Sign convention: positive offsets (e.g. JST = +540)
  // mean local is AHEAD of UTC.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date(ms));
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const localMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((localMs - ms) / 60_000);
}

function formatYmd(d: Date, timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    // en-CA renders YYYY-MM-DD by default, which is exactly what date columns expect.
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(d);
}
