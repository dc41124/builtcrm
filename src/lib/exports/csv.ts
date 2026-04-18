// Small CSV helpers shared across export routes. Kept tiny — no
// third-party dep. RFC 4180 quoting: a cell is quoted iff it contains a
// comma, double-quote, CR, or LF; embedded quotes are doubled.

export function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvLine(values: readonly unknown[]): string {
  return values.map(csvCell).join(",");
}

export function formatCsvDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function formatCsvTimestamp(d: Date | null | undefined): string {
  return d ? d.toISOString() : "";
}

export function formatCsvDollars(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

// Filesystem-safe slug for filenames. Collapses runs of non-alphanum into a
// single hyphen, strips leading/trailing hyphens, bounds length.
export function slugForFilename(s: string, max = 48): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "export"
  );
}
