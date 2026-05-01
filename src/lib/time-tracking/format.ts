// Pure helpers. Imported by both server loaders and the client shells so the
// "what minutes does this row contribute" computation lives in one place and
// can be unit-tested cheaply.

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function minsToHM(m: number | null): string {
  if (m == null) return "—";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
}

export function minsToHMSlim(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}:${String(mm).padStart(2, "0")}`;
}

export function minsToDecimal(m: number | null): string {
  if (m == null) return "—";
  return (m / 60).toFixed(2);
}

// 24h → 12h format.
export function fmt12(date: Date | null | undefined): string {
  if (!date) return "—";
  const h = date.getHours();
  const m = date.getMinutes();
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

// ISO yyyy-mm-dd in the *server's* local TZ. Used for grouping entries by
// day. The current scope is a single timezone (the demo runs in one TZ); when
// multi-TZ becomes a concern, this helper is the single seam to revisit.
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
