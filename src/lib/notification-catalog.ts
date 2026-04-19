// Per-portal notification event taxonomy. Each portal sees a curated set of
// events scoped to the work that portal cares about. Event IDs are stable
// identifiers used as the primary key of `user_notification_preferences`
// alongside (user_id, portal_type).
//
// If you add/remove/rename events, existing preference rows keep their old
// IDs — stale rows become orphans and are ignored when rendering. Consider
// a seed migration if you rename en masse.

export type SettingsPortalType =
  | "contractor"
  | "subcontractor"
  | "commercial"
  | "residential";

export type NotificationEvent = {
  id: string;
  label: string;
  desc: string;
};

export type NotificationGroup = {
  group: string;
  events: NotificationEvent[];
};

export const NOTIFICATION_GROUPS: Record<
  SettingsPortalType,
  NotificationGroup[]
> = {
  contractor: [
    {
      group: "Workflows",
      events: [
        {
          id: "rfi_new",
          label: "New RFI submitted",
          desc: "A subcontractor submitted a question on one of your projects",
        },
        {
          id: "rfi_response",
          label: "RFI awaiting your response",
          desc: "A sub is waiting on you to answer their question",
        },
        {
          id: "co_submitted",
          label: "Change order submitted",
          desc: "A new change order needs your review",
        },
        {
          id: "co_approved",
          label: "Change order approved by client",
          desc: "Client signed off — scope is now locked in",
        },
        {
          id: "approval_needed",
          label: "Approval awaiting action",
          desc: "Cross-type approvals routed to you",
        },
        {
          id: "selection_confirmed",
          label: "Selection confirmed",
          desc: "Client finalized a residential selection",
        },
      ],
    },
    {
      group: "Billing",
      events: [
        {
          id: "draw_submitted",
          label: "Draw request submitted",
          desc: "Your team submitted a draw for review",
        },
        {
          id: "draw_approved",
          label: "Draw approved by client",
          desc: "A draw was approved — ready for payment",
        },
        {
          id: "draw_paid",
          label: "Draw payment received",
          desc: "Payment settled to your connected account",
        },
        {
          id: "waiver_needed",
          label: "Lien waiver required",
          desc: "A waiver is needed before draw release",
        },
      ],
    },
    {
      group: "Compliance",
      events: [
        {
          id: "compliance_expiring",
          label: "Sub document expiring",
          desc: "Insurance, W-9, or license approaching expiry",
        },
        {
          id: "compliance_blocked",
          label: "Sub payment held for compliance",
          desc: "Sub flagged as non-compliant — payment paused",
        },
      ],
    },
    {
      group: "Team & project",
      events: [
        {
          id: "team_invited",
          label: "Team member invitation accepted",
          desc: "Someone you invited joined your org",
        },
        {
          id: "message_new",
          label: "New message",
          desc: "Anyone messages you on a project thread",
        },
        {
          id: "upload_completed",
          label: "Upload request fulfilled",
          desc: "A sub delivered the files you requested",
        },
        {
          id: "milestone_hit",
          label: "Milestone completed",
          desc: "A tracked schedule milestone was marked done",
        },
        {
          id: "daily_log_crew_submitted",
          label: "Sub submitted crew entry",
          desc: "A sub filed their crew entry for today's log",
        },
        {
          id: "punch_item_ready_to_verify",
          label: "Punch item ready to verify",
          desc: "A sub marked a punch item ready for your check",
        },
        {
          id: "submittal_submitted",
          label: "Submittal submitted",
          desc: "A sub submitted a new submittal package for review",
        },
        {
          id: "submittal_reviewer_responded",
          label: "Reviewer returned a submittal",
          desc: "Your external reviewer submitted their decision — ready to forward to the sub",
        },
      ],
    },
  ],
  subcontractor: [
    {
      group: "Your work",
      events: [
        {
          id: "rfi_assigned",
          label: "RFI assigned to you",
          desc: "A GC routed a question to your org",
        },
        {
          id: "rfi_responded",
          label: "GC responded to your RFI",
          desc: "Your submitted question got an answer",
        },
        {
          id: "upload_request",
          label: "New upload request",
          desc: "A GC is asking you for files or documents",
        },
        {
          id: "schedule_change",
          label: "Your schedule changed",
          desc: "A task you own was rescheduled or reassigned",
        },
        {
          id: "daily_log_crew_reconciled",
          label: "Crew hours reconciled by the GC",
          desc: "The GC adjusted your submitted headcount or hours — review required",
        },
        {
          id: "punch_item_assigned",
          label: "Punch item assigned",
          desc: "A GC assigned a new punch item to your org",
        },
        {
          id: "punch_item_verified",
          label: "Punch item verified",
          desc: "A GC verified your work and closed the item",
        },
        {
          id: "punch_item_rejected",
          label: "Punch item rejected",
          desc: "A GC sent a punch item back — needs rework",
        },
        {
          id: "submittal_returned",
          label: "Submittal returned from reviewer",
          desc: "The GC forwarded a reviewer response on one of your submittals",
        },
      ],
    },
    {
      group: "Compliance",
      events: [
        {
          id: "compliance_expiring",
          label: "Your document is expiring",
          desc: "COI, W-9, or license nearing expiry",
        },
        {
          id: "compliance_reminder",
          label: "Compliance document requested",
          desc: "A GC is asking for a new compliance doc",
        },
      ],
    },
    {
      group: "Payments",
      events: [
        {
          id: "payment_received",
          label: "Payment received",
          desc: "A GC paid you for a draw or invoice",
        },
        {
          id: "waiver_needed",
          label: "Lien waiver required",
          desc: "You need to sign a waiver to release funds",
        },
      ],
    },
    {
      group: "Communication",
      events: [
        {
          id: "message_new",
          label: "New message",
          desc: "Anyone messages you on a project thread",
        },
      ],
    },
  ],
  commercial: [
    {
      group: "Approvals",
      events: [
        {
          id: "co_needs_approval",
          label: "Change order awaiting approval",
          desc: "A scope change is ready for your review",
        },
        {
          id: "approval_new",
          label: "New approval item",
          desc: "Something needs your sign-off",
        },
      ],
    },
    {
      group: "Billing",
      events: [
        {
          id: "draw_review",
          label: "Draw request awaiting review",
          desc: "A billing draw is ready for your approval",
        },
        {
          id: "payment_processed",
          label: "Payment processed",
          desc: "Your payment cleared successfully",
        },
      ],
    },
    {
      group: "Project",
      events: [
        {
          id: "milestone_hit",
          label: "Milestone completed",
          desc: "A scheduled project milestone was reached",
        },
        {
          id: "document_shared",
          label: "New document shared with you",
          desc: "Your contractor shared a file to review",
        },
        {
          id: "photo_update",
          label: "New project photos",
          desc: "Fresh site photos were uploaded",
        },
        {
          id: "weekly_update",
          label: "Weekly progress report",
          desc: "Your builder's Friday project update",
        },
        {
          id: "daily_log_posted",
          label: "Daily log posted",
          desc: "Your contractor posted the log for a day on site",
        },
      ],
    },
    {
      group: "Communication",
      events: [
        {
          id: "message_new",
          label: "New message",
          desc: "Your contractor sent you a message",
        },
      ],
    },
  ],
  residential: [
    {
      group: "Decisions",
      events: [
        {
          id: "decision_needed",
          label: "Decision needed",
          desc: "A question from your builder needs your input",
        },
        {
          id: "scope_change",
          label: "Scope change proposed",
          desc: "Your builder is proposing a change to the plan",
        },
        {
          id: "selection_reminder",
          label: "Selection deadline approaching",
          desc: "A choice needs to be made soon to avoid delays",
        },
      ],
    },
    {
      group: "Payments",
      events: [
        {
          id: "payment_milestone",
          label: "Payment milestone approaching",
          desc: "A scheduled payment is coming up",
        },
        {
          id: "payment_processed",
          label: "Payment confirmed",
          desc: "Your payment went through — receipt attached",
        },
      ],
    },
    {
      group: "Your home",
      events: [
        {
          id: "photo_update",
          label: "New progress photos",
          desc: "Fresh photos from your build site",
        },
        {
          id: "milestone_hit",
          label: "Milestone reached",
          desc: "A big step on your home is complete — foundation, framing, etc.",
        },
        {
          id: "weekly_update",
          label: "Weekly update",
          desc: "Your builder's friendly weekly recap",
        },
        {
          id: "document_shared",
          label: "New document shared with you",
          desc: "Permits, warranties, and other files to keep",
        },
        {
          id: "daily_log_posted",
          label: "New journal entry",
          desc: "Your builder posted a new day in the project journal",
        },
      ],
    },
    {
      group: "Communication",
      events: [
        {
          id: "message_new",
          label: "New message from your builder",
          desc: "Direct messages and replies",
        },
      ],
    },
  ],
};

// Default toggle states per event. Critical events default to email+inApp,
// routine events to inApp only. Matches the spec's `criticalEmailEvents` set.
const CRITICAL_EMAIL_EVENTS = new Set<string>([
  "co_submitted",
  "co_approved",
  "approval_needed",
  "draw_submitted",
  "draw_approved",
  "compliance_expiring",
  "compliance_blocked",
  "rfi_assigned",
  "upload_request",
  "compliance_reminder",
  "payment_received",
  "waiver_needed",
  "co_needs_approval",
  "approval_new",
  "draw_review",
  "decision_needed",
  "scope_change",
  "payment_milestone",
  "payment_processed",
  "daily_log_crew_reconciled",
  "punch_item_assigned",
  "punch_item_ready_to_verify",
  "punch_item_rejected",
  "submittal_submitted",
  "submittal_returned",
  "submittal_reviewer_responded",
]);

export type NotificationPrefState = Record<
  string,
  { email: boolean; inApp: boolean }
>;

export function defaultNotificationPrefs(
  portalType: SettingsPortalType,
): NotificationPrefState {
  const out: NotificationPrefState = {};
  for (const group of NOTIFICATION_GROUPS[portalType]) {
    for (const ev of group.events) {
      out[ev.id] = {
        email: CRITICAL_EMAIL_EVENTS.has(ev.id),
        inApp: true,
      };
    }
  }
  return out;
}

// Utility for the API layer: returns the set of valid event IDs for a portal.
// Reject any write whose eventId is not in this set so the DB never stores
// events the UI can't render.
export function validEventIdsFor(portalType: SettingsPortalType): Set<string> {
  const out = new Set<string>();
  for (const group of NOTIFICATION_GROUPS[portalType]) {
    for (const ev of group.events) out.add(ev.id);
  }
  return out;
}
