// Pure totals math for purchase orders. Nothing is stored aggregated on the
// PO tables — subtotal / tax / total are always computed on read from raw
// line rows + `taxRatePercent`. See docs/specs/phase_4plus_build_guide.md
// Step 41 for the compute-on-read directive.
//
// Enforcement rule: lines become immutable at status === 'issued' and
// beyond (except receivedQuantity). Real line edits post-issue go through
// the "Revise PO" action. That rule is what keeps compute-on-read safe —
// no stored aggregate can drift because there's no stored aggregate.

export type LineTotalsInput = {
  quantity: string | number;
  unitCostCents: number;
};

export type LineTotals = {
  lineTotalCents: number;
};

// Compute one line total. quantity can be a numeric string (as it comes
// back from drizzle's `numeric()` mode) or a number.
export function computeLineTotalCents(input: LineTotalsInput): number {
  const qty =
    typeof input.quantity === "string"
      ? parseFloat(input.quantity)
      : input.quantity;
  if (!Number.isFinite(qty) || qty <= 0) return 0;
  return Math.round(qty * input.unitCostCents);
}

export type PoTotalsInput = {
  lines: Array<LineTotalsInput>;
  taxRatePercent: string | number;
};

export type PoTotals = {
  subtotalCents: number;
  taxAmountCents: number;
  totalCents: number;
  lineTotalsCents: number[];
};

// Compute subtotal, tax, and total for a PO. Tax rate comes from the PO
// row (numeric string like "13.00"). Rounded cent-side at each step so
// the displayed math is consistent across the PDF, detail drawer, and
// reports aggregation.
export function computePoTotals(input: PoTotalsInput): PoTotals {
  const lineTotalsCents = input.lines.map(computeLineTotalCents);
  const subtotalCents = lineTotalsCents.reduce((sum, c) => sum + c, 0);
  const rate =
    typeof input.taxRatePercent === "string"
      ? parseFloat(input.taxRatePercent)
      : input.taxRatePercent;
  const safeRate = Number.isFinite(rate) ? rate : 0;
  const taxAmountCents = Math.round((subtotalCents * safeRate) / 100);
  const totalCents = subtotalCents + taxAmountCents;
  return { subtotalCents, taxAmountCents, totalCents, lineTotalsCents };
}

// Receiving status derived from lines. Used by the receive-line action
// to auto-transition PO status.
export function deriveReceivingStatus(
  lines: Array<{
    quantity: string | number;
    receivedQuantity: string | number;
  }>,
): "none" | "partial" | "full" {
  if (lines.length === 0) return "none";
  let anyReceived = false;
  let allReceived = true;
  for (const l of lines) {
    const qty =
      typeof l.quantity === "string" ? parseFloat(l.quantity) : l.quantity;
    const recv =
      typeof l.receivedQuantity === "string"
        ? parseFloat(l.receivedQuantity)
        : l.receivedQuantity;
    if (recv > 0) anyReceived = true;
    if (recv < qty) allReceived = false;
  }
  if (allReceived) return "full";
  if (anyReceived) return "partial";
  return "none";
}

