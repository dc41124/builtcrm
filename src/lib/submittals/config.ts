// Submittals state machine + display helpers.
//
// State machine enforced at the action layer (not by triggers or DB check
// constraints). Mirrors the Step 19 punch list pattern.
//
//   draft        → submitted                 (sub sends)
//   submitted    → under_review              (GC forwards to reviewer)
//   under_review → returned_approved         (GC logs reviewer response)
//                | returned_as_noted
//                | revise_resubmit
//                | rejected
//   returned_*   → closed                    (GC forwards to sub, terminal)
//   revise_resubmit → closed                 (on spawn; action layer
//                                             creates a new draft with
//                                             revision_of_id set)

export type SubmittalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "returned_approved"
  | "returned_as_noted"
  | "revise_resubmit"
  | "rejected"
  | "closed";

export type SubmittalType =
  | "product_data"
  | "shop_drawing"
  | "sample"
  | "mock_up"
  | "calculations"
  | "schedule_of_values";

export type SubmittalDocumentRole =
  | "package"
  | "reviewer_comments"
  | "stamp_page";

export type SubmittalTransmittalDirection =
  | "outgoing_to_reviewer"
  | "incoming_from_reviewer"
  | "forwarded_to_sub";

export type ActorRole = "contractor" | "subcontractor";

// Allowed (fromStatus, actorRole) → nextStatus transitions. Any attempt
// outside this table is rejected by the transition action with a 409.
// `returned_*` and `rejected` are non-terminal; `closed` is terminal.
//
// `revise_resubmit` is tricky — the user picks it from under_review, and
// the action layer (a) marks this row `closed`, (b) spawns a new `draft`
// row with revision_of_id set. So the visible transition here is
// `under_review → revise_resubmit`, and the auto-close + spawn happens
// inside the same transaction.
export const ALLOWED_TRANSITIONS: Record<
  SubmittalStatus,
  { contractor: SubmittalStatus[]; subcontractor: SubmittalStatus[] }
> = {
  draft: {
    contractor: ["submitted"],
    subcontractor: ["submitted"],
  },
  submitted: {
    contractor: ["under_review", "closed"],
    subcontractor: [],
  },
  under_review: {
    contractor: [
      "returned_approved",
      "returned_as_noted",
      "revise_resubmit",
      "rejected",
    ],
    subcontractor: [],
  },
  returned_approved: {
    contractor: ["closed"],
    subcontractor: [],
  },
  returned_as_noted: {
    contractor: ["closed"],
    subcontractor: [],
  },
  revise_resubmit: {
    contractor: ["closed"],
    subcontractor: [],
  },
  rejected: {
    contractor: ["closed"],
    subcontractor: [],
  },
  closed: {
    contractor: [],
    subcontractor: [],
  },
};

export function isTransitionAllowed(
  from: SubmittalStatus,
  to: SubmittalStatus,
  actorRole: ActorRole,
): boolean {
  return ALLOWED_TRANSITIONS[from][actorRole].includes(to);
}

// The four reviewer-response statuses a GC can choose when logging an
// incoming transmittal. Useful for UI dropdowns and defense-in-depth
// validation.
export const REVIEWER_RESPONSE_STATUSES: SubmittalStatus[] = [
  "returned_approved",
  "returned_as_noted",
  "revise_resubmit",
  "rejected",
];

export function isReviewerResponseStatus(
  status: SubmittalStatus,
): status is
  | "returned_approved"
  | "returned_as_noted"
  | "revise_resubmit"
  | "rejected" {
  return REVIEWER_RESPONSE_STATUSES.includes(status);
}

// Format spec section for display. Accepts both "033000" and "03 30 00"
// input; normalises compact form to spaced for readability. Leaves
// anything that doesn't look like a CSI code untouched.
export function formatSpecSection(input: string): string {
  const compact = input.replace(/\s+/g, "");
  if (/^\d{6}$/.test(compact)) {
    return `${compact.slice(0, 2)} ${compact.slice(2, 4)} ${compact.slice(4, 6)}`;
  }
  return input;
}

// User-facing labels for status pills. Grouping helps UI filter tabs —
// "returned" bucket contains all three returned_* variants.
export const STATUS_LABEL: Record<SubmittalStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  returned_approved: "Approved",
  returned_as_noted: "Approved as noted",
  revise_resubmit: "Revise & resubmit",
  rejected: "Rejected",
  closed: "Closed",
};

export const SUBMITTAL_TYPE_LABEL: Record<SubmittalType, string> = {
  product_data: "Product data",
  shop_drawing: "Shop drawing",
  sample: "Sample",
  mock_up: "Mock-up",
  calculations: "Calculations",
  schedule_of_values: "Schedule of values",
};

export const DIRECTION_LABEL: Record<SubmittalTransmittalDirection, string> = {
  outgoing_to_reviewer: "Sent to reviewer",
  incoming_from_reviewer: "Reviewer response",
  forwarded_to_sub: "Forwarded to sub",
};

export const DOC_ROLE_LABEL: Record<SubmittalDocumentRole, string> = {
  package: "Package",
  reviewer_comments: "Reviewer comments",
  stamp_page: "Stamp page",
};

// Age in days since createdAt. Same helper signature as punch list.
export function ageInDays(
  createdAt: Date | string,
  now: Date = new Date(),
): number {
  const ts = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return Math.max(0, Math.floor((now.getTime() - ts.getTime()) / 86400000));
}

// "Overdue" = non-terminal AND dueDate in the past. Used for the
// contractor list summary pill.
export function isOverdue(input: {
  status: SubmittalStatus;
  dueDate: string | null;
  now?: Date;
}): boolean {
  if (!input.dueDate) return false;
  if (input.status === "closed") return false;
  const now = input.now ?? new Date();
  return new Date(input.dueDate + "T23:59:59Z").getTime() < now.getTime();
}

// Format number as S-001.
export function formatNumber(n: number): string {
  return `S-${String(n).padStart(3, "0")}`;
}
