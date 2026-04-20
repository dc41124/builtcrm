// Central money formatting. All portal UIs and loaders render currency
// through this file. Source values are always integer cents.
//
// Behavior matrix vs. the per-file copies that previously existed:
//   formatMoneyCents(n)                       → "$12,345"              (whole dollars)
//   formatMoneyCents(n, { withCents: true })  → "$12,345.67"
//   formatMoneyCents(n, { signed: true })     → "+$12,345" / "−$12,345"
//   formatMoneyCentsCompact(n)                → "$12.5k" / "$1.2M"
//   formatMoneyCentsNullable(n)               → "—" when n is null/undefined
//
// USD is the default. Payment records that ship a stripe currency string
// pass it through `currency`: "USD" renders "$", "CAD" renders "CA$", and
// any other 3-letter code renders as "XYZ " prefix.

export type MoneyFormatOptions = {
  /** Include a leading + on non-negative values. Negatives always show sign. */
  signed?: boolean;
  /** Show two decimals instead of rounding to whole dollars. */
  withCents?: boolean;
  /** ISO 4217 code; defaults to USD. Only USD/CAD have bespoke symbols. */
  currency?: string;
};

function currencyPrefix(currency: string): string {
  if (currency === "USD") return "$";
  if (currency === "CAD") return "CA$";
  return `${currency} `;
}

export function formatMoneyCents(
  cents: number,
  opts: MoneyFormatOptions = {},
): string {
  const { signed = false, withCents = false, currency = "USD" } = opts;
  const abs = Math.abs(cents) / 100;
  const body = abs.toLocaleString("en-US", {
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  });
  const prefix = currencyPrefix(currency);
  if (cents < 0) return `−${prefix}${body}`;
  if (signed) return `+${prefix}${body}`;
  return `${prefix}${body}`;
}

export function formatMoneyCentsCompact(
  cents: number,
  opts: { currency?: string } = {},
): string {
  const { currency = "USD" } = opts;
  const prefix = currencyPrefix(currency);
  const dollars = cents / 100;
  const absDollars = Math.abs(dollars);
  const sign = dollars < 0 ? "−" : "";
  if (absDollars >= 1_000_000) {
    const m = absDollars / 1_000_000;
    return `${sign}${prefix}${m.toFixed(m < 10 ? 2 : 1)}M`;
  }
  if (absDollars >= 1_000) {
    return `${sign}${prefix}${Math.round(absDollars / 1_000)}k`;
  }
  return `${sign}${prefix}${Math.round(absDollars)}`;
}

export function formatMoneyCentsNullable(
  cents: number | null | undefined,
  opts: MoneyFormatOptions & { fallback?: string } = {},
): string {
  if (cents === null || cents === undefined) return opts.fallback ?? "—";
  return formatMoneyCents(cents, opts);
}
