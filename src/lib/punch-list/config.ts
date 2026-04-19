// Punch-list state machine + system comment phrasing.
//
// The state machine is enforced at the action layer (not by triggers
// or DB check constraints). Every transition auto-posts a row to
// punch_item_comments with isSystem=true and the locked phrasing
// below — these strings are part of the audit trail and match the
// Step 19 handoff doc verbatim.

export type PunchStatus =
  | "open"
  | "in_progress"
  | "ready_to_verify"
  | "verified"
  | "rejected"
  | "void";

export type ActorRole = "contractor" | "subcontractor";

// Allowed (fromStatus, actorRole) → nextStatus transitions. Any attempt
// outside this table is rejected by the transition action with a 403
// or 409 depending on cause. Mirrors the state diagram in the handoff:
//   open → in_progress → ready_to_verify → verified (terminal)
//                               └──→ rejected → in_progress
//   any non-terminal → void
//
// Note: `verified → *` is an empty array on purpose — verified is
// terminal. Reopening requires a new item.
export const ALLOWED_TRANSITIONS: Record<PunchStatus, {
  contractor: PunchStatus[];
  subcontractor: PunchStatus[];
}> = {
  open: {
    contractor: ["in_progress", "void"],
    subcontractor: ["in_progress"],
  },
  in_progress: {
    contractor: ["ready_to_verify", "void"],
    subcontractor: ["ready_to_verify"],
  },
  ready_to_verify: {
    contractor: ["verified", "rejected", "void"],
    subcontractor: [],
  },
  rejected: {
    contractor: ["in_progress", "void"],
    subcontractor: ["in_progress"],
  },
  verified: {
    contractor: [],
    subcontractor: [],
  },
  void: {
    contractor: [],
    subcontractor: [],
  },
};

export function isTransitionAllowed(
  from: PunchStatus,
  to: PunchStatus,
  actorRole: ActorRole,
): boolean {
  return ALLOWED_TRANSITIONS[from][actorRole].includes(to);
}

// System comment phrasing — locked by the Step 19 handoff doc. Do NOT
// edit the wording; the strings are referenced by users in audit
// review flows and must stay stable.
export function systemCommentBody(input: {
  actorName: string;
  toStatus: PunchStatus;
  rejectionReason?: string | null;
  voidReason?: string | null;
}): string {
  const { actorName, toStatus } = input;
  switch (toStatus) {
    case "in_progress":
      return `${actorName} marked item as In Progress`;
    case "ready_to_verify":
      return `${actorName} marked item as Ready to Verify`;
    case "verified":
      return `${actorName} verified item. Closed.`;
    case "rejected":
      return `${actorName} rejected — "${input.rejectionReason ?? ""}"`;
    case "void":
      return `${actorName} voided — "${input.voidReason ?? ""}"`;
    default:
      return `${actorName} moved item to ${toStatus}`;
  }
}

// "Overdue" = non-terminal status AND dueDate in the past. Used by the
// contractor list view to surface items that need attention. Open /
// in_progress / rejected count; ready_to_verify does NOT (GC's turn).
export function isOverdue(input: {
  status: PunchStatus;
  dueDate: string | null;
  now?: Date;
}): boolean {
  if (!input.dueDate) return false;
  if (!["open", "in_progress", "rejected"].includes(input.status)) return false;
  const now = input.now ?? new Date();
  return new Date(input.dueDate + "T23:59:59Z").getTime() < now.getTime();
}

// Age in days since createdAt. Used by the contractor list "Xd old"
// foot label.
export function ageInDays(createdAt: Date | string, now: Date = new Date()): number {
  const ts = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return Math.max(0, Math.floor((now.getTime() - ts.getTime()) / 86400000));
}

// Residential friendly labels (lifted verbatim from the
// builtcrm_walkthrough_items_residential.jsx FRIENDLY constant).
// Raw enum names (in_progress / ready_to_verify etc.) must NEVER
// appear in the residential UI — always pass through this mapping.
export const RESIDENTIAL_FRIENDLY: Record<
  PunchStatus,
  { label: string; pill: "gray" | "orange" | "accent" | "green" | "red"; blurb: string }
> = {
  open: {
    label: "Just added",
    pill: "gray",
    blurb: "On the list — your builder will schedule it in.",
  },
  in_progress: {
    label: "Being fixed",
    pill: "orange",
    blurb: "Your builder is working on it now.",
  },
  ready_to_verify: {
    label: "Ready to check",
    pill: "accent",
    blurb: "Done — take a look during your walkthrough.",
  },
  verified: {
    label: "Done",
    pill: "green",
    blurb: "You've confirmed this one. All finished.",
  },
  rejected: {
    label: "Still needs work",
    pill: "red",
    blurb: "Your builder is addressing it again.",
  },
  // Void is NEVER surfaced in the residential view. Still need a map
  // entry for type completeness; UI filters void items out upstream.
  void: { label: "Removed", pill: "gray", blurb: "" },
};
