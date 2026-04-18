// Date helpers for the daily-logs module. logDate is a DATE column keyed
// to the project's timezone, not server time or the submitter's browser.

// Returns today's date in the given IANA timezone as YYYY-MM-DD.
// Example: todayInProjectTimezone("America/Los_Angeles") at 2026-04-19
// 01:00 UTC returns "2026-04-18".
export function todayInProjectTimezone(timezone: string): string {
  return isoDateInTimezone(new Date(), timezone);
}

export function isoDateInTimezone(at: Date, timezone: string): string {
  // Intl.DateTimeFormat with 'en-CA' + ISO parts reliably yields YYYY-MM-DD
  // in the target zone. Fall back to UTC if the timezone is unknown.
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

// Simple YYYY-MM-DD validator for action-layer input checks.
export function isIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
}

// Add days to a YYYY-MM-DD string. Anchors at noon UTC to avoid DST
// edge cases where midnight rolls into the previous day.
export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
