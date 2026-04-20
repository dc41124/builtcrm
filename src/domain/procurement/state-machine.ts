import { poStatusEnum } from "@/db/schema";

export type PurchaseOrderStatus =
  (typeof poStatusEnum.enumValues)[number];

// State machine diagram:
//
//   draft → issued → partially_received → fully_received → invoiced → closed
//                  ↘ revised (post-issue edit) ↗ (back into receiving flow)
//
//   any non-terminal → cancelled
//
// `revised` is the post-issue "line edits applied, re-issued" state. A
// PO can be revised multiple times (revisionNumber bumps each time);
// the status stays on `revised` through subsequent revisions, and
// receiving flows work from both `issued` and `revised`.
//
// Terminal states: `closed`, `cancelled`. No transitions out of these.

const TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ["issued", "cancelled"],
  issued: ["revised", "partially_received", "fully_received", "cancelled"],
  revised: ["partially_received", "fully_received", "cancelled"],
  partially_received: ["fully_received", "cancelled"],
  fully_received: ["invoiced", "cancelled"],
  invoiced: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

export function canTransition(
  from: PurchaseOrderStatus,
  to: PurchaseOrderStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

// Lines become immutable (for description, quantity, unit, unitCost) once
// the PO is in any post-draft state. Only `receivedQuantity` remains
// mutable through the receiving flow. Real line edits post-issue require
// the "Revise PO" action.
export function areLinesImmutable(status: PurchaseOrderStatus): boolean {
  return status !== "draft";
}

// The only states where a PO can be revised (post-issue edit). Excludes
// terminal + cancelled states; allowed once the vendor has a copy.
export function canBeRevised(status: PurchaseOrderStatus): boolean {
  return (
    status === "issued" ||
    status === "revised" ||
    status === "partially_received"
  );
}

// Human-readable label used in UI chips and PDF headers. Keep text in
// sync with the JSX prototype's `statusLabel` values.
export function statusLabel(status: PurchaseOrderStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "issued":
      return "Issued";
    case "revised":
      return "Revised";
    case "partially_received":
      return "Partially received";
    case "fully_received":
      return "Fully received";
    case "invoiced":
      return "Invoiced";
    case "closed":
      return "Closed";
    case "cancelled":
      return "Cancelled";
  }
}

// Pill color class matching the JSX prototype's `.pl.{color}` styles.
export function statusPillClass(status: PurchaseOrderStatus): string {
  switch (status) {
    case "draft":
      return "neutral";
    case "issued":
      return "blue";
    case "revised":
      return "blue";
    case "partially_received":
      return "orange";
    case "fully_received":
      return "green";
    case "invoiced":
      return "accent";
    case "closed":
      return "neutral";
    case "cancelled":
      return "red";
  }
}

// Ordered progression used by the state-machine strip in the detail
// drawer. `cancelled` isn't shown in the strip (branch state).
export const STATE_STRIP_ORDER: PurchaseOrderStatus[] = [
  "draft",
  "issued",
  "partially_received",
  "fully_received",
  "invoiced",
  "closed",
];
