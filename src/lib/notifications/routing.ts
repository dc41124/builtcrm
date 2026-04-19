import type { SettingsPortalType } from "@/lib/notification-catalog";

// Per-(event, portal) copy + link renderer. Called at emit time so the
// notification row is stored with portal-specific language baked in —
// e.g. a residential client's CO row says "Scope Change #4 proposed"
// while the contractor's row says "Change Order #4 submitted". This
// keeps the reader dumb (render title/body/linkUrl as-is).
//
// Residential copy leans on the "Scope Changes" / "Decisions" vocab
// established in docs/specs (CLAUDE.md: residential language rules).

export type NotificationRenderInput = {
  eventId: string;
  portalType: SettingsPortalType;
  projectId: string | null;
  relatedObjectId: string | null;
  vars?: Record<string, string | number | null | undefined>;
};

export type NotificationRendered = {
  title: string;
  body: string | null;
  linkUrl: string | null;
};

function projectBase(
  portalType: SettingsPortalType,
  projectId: string | null,
): string | null {
  if (!projectId) return null;
  return `/${portalType}/project/${projectId}`;
}

function str(v: unknown, fallback = ""): string {
  return v == null || v === "" ? fallback : String(v);
}

export function renderNotification(
  input: NotificationRenderInput,
): NotificationRendered {
  const { eventId, portalType, projectId, relatedObjectId } = input;
  const v = input.vars ?? {};
  const base = projectBase(portalType, projectId);

  switch (eventId) {
    // ── Change orders / scope changes ────────────────────────────
    case "co_submitted":
      return {
        title: `Change order #${str(v.number, "?")} submitted`,
        body: str(v.title)
          ? `${v.title} — ${str(v.actorName, "A teammate")} sent it for review.`
          : `${str(v.actorName, "A teammate")} submitted a change order.`,
        linkUrl: base
          ? `${base}/change-orders${relatedObjectId ? `?id=${relatedObjectId}` : ""}`
          : null,
      };
    case "co_approved":
      return {
        title: `Change order #${str(v.number, "?")} approved`,
        body: str(v.title)
          ? `${v.title} was approved by the client.`
          : "A change order was approved by the client.",
        linkUrl: base ? `${base}/change-orders` : null,
      };
    case "co_needs_approval":
      return {
        title: `Change order #${str(v.number, "?")} awaiting your approval`,
        body: str(v.title)
          ? `${v.title} is ready for your review.`
          : "A change order is ready for your review.",
        linkUrl: base ? `${base}/change-orders` : null,
      };
    case "scope_change":
      // Residential-only vocabulary per CLAUDE.md.
      return {
        title: `Scope change proposed`,
        body: str(v.title)
          ? `${v.title} — your builder is proposing a change to the plan.`
          : "Your builder is proposing a change to the plan.",
        linkUrl: base ? `${base}/scope-changes` : null,
      };

    // ── Approvals ────────────────────────────────────────────────
    case "approval_needed":
    case "approval_new":
      return {
        title: "An approval is awaiting you",
        body: str(v.title)
          ? `${v.title} needs your sign-off.`
          : "Something needs your sign-off.",
        linkUrl: base
          ? portalType === "contractor"
            ? `${base}/approvals`
            : `${base}/billing`
          : null,
      };

    // ── Draws / billing ──────────────────────────────────────────
    case "draw_submitted":
      return {
        title: `Draw #${str(v.drawNumber, "?")} submitted`,
        body: str(v.actorName)
          ? `${v.actorName} submitted a draw for review.`
          : "A draw request was submitted for review.",
        linkUrl: base ? `${base}/billing` : null,
      };
    case "draw_approved":
      return {
        title: `Draw #${str(v.drawNumber, "?")} approved`,
        body: str(v.amount)
          ? `Approved for ${v.amount} — ready for payment.`
          : "Approved — ready for payment.",
        linkUrl: base ? `${base}/billing` : null,
      };
    case "draw_review":
      return {
        title: `Draw #${str(v.drawNumber, "?")} awaiting your review`,
        body: str(v.amount)
          ? `${v.amount} is ready for your approval.`
          : "A billing draw is ready for your approval.",
        linkUrl: base ? `${base}/billing` : null,
      };

    // ── Selections (residential) ─────────────────────────────────
    case "selection_confirmed":
      return {
        title: `Selection confirmed`,
        body: str(v.itemTitle) && str(v.optionName)
          ? `${v.itemTitle}: ${v.optionName}`
          : "A client selection was confirmed.",
        linkUrl: base
          ? portalType === "contractor"
            ? `${base}/selections`
            : `${base}/confirmed-choices`
          : null,
      };

    // ── RFIs ─────────────────────────────────────────────────────
    case "rfi_new":
      return {
        title: "New RFI submitted",
        body: str(v.title)
          ? `${v.title} — from ${str(v.actorName, "a subcontractor")}.`
          : `A new question was submitted by ${str(v.actorName, "a subcontractor")}.`,
        linkUrl: base ? `${base}/rfis` : null,
      };
    case "rfi_assigned":
      return {
        title: "RFI assigned to you",
        body: str(v.title) ? String(v.title) : "A GC routed a question to your org.",
        linkUrl: base ? `${base}/rfis` : null,
      };

    // ── Upload requests ──────────────────────────────────────────
    case "upload_request":
      return {
        title: "New upload request",
        body: str(v.title)
          ? `${v.title} — please upload the requested files.`
          : "A GC is asking you for files.",
        linkUrl: base ? `${base}/upload-requests` : null,
      };
    case "upload_completed":
      return {
        title: "Upload request fulfilled",
        body: str(v.title)
          ? `${v.title} — files delivered.`
          : "A sub delivered the files you requested.",
        linkUrl: base ? `${base}/upload-requests` : null,
      };

    // ── Daily logs ───────────────────────────────────────────────
    case "daily_log_posted":
      // Different framing for commercial vs residential. Commercial
      // clients see "daily log"; residential homeowners see "journal entry".
      return portalType === "residential"
        ? {
            title: "New journal entry",
            body: str(v.logDate)
              ? `Your builder posted the update for ${v.logDate}.`
              : "Your builder posted a new day in the project journal.",
            linkUrl: base ? `${base}/progress` : null,
          }
        : {
            title: str(v.logDate)
              ? `Daily log posted for ${v.logDate}`
              : "Daily log posted",
            body: str(v.projectName)
              ? `${v.projectName} — today's site update is ready.`
              : "Your contractor posted a new daily log.",
            linkUrl: base ? `${base}/daily-logs` : null,
          };
    case "daily_log_crew_submitted":
      return {
        title: "Crew entry submitted",
        body: str(v.actorName)
          ? str(v.logDate)
            ? `${v.actorName} filed their crew for ${v.logDate}.`
            : `${v.actorName} filed a crew entry.`
          : "A sub filed their crew entry.",
        linkUrl: base ? `${base}/daily-logs` : null,
      };
    case "daily_log_crew_reconciled":
      return {
        title: "Crew hours reconciled",
        body: str(v.logDate)
          ? `The GC adjusted your crew numbers for ${v.logDate}. Review required.`
          : "The GC adjusted your submitted crew numbers. Review required.",
        linkUrl: base ? `${base}/daily-logs` : null,
      };

    // ── Punch list ───────────────────────────────────────────────
    case "punch_item_assigned":
      return {
        title: `Punch item assigned${str(v.number) ? ` (${v.number})` : ""}`,
        body: str(v.title)
          ? `${v.title} — assigned by ${str(v.actorName, "the GC")}.`
          : `${str(v.actorName, "The GC")} assigned a new punch item to your crew.`,
        linkUrl: base ? `${base}/punch-list` : null,
      };
    case "punch_item_ready_to_verify":
      return {
        title: `Punch item ready to verify${str(v.number) ? ` (${v.number})` : ""}`,
        body: str(v.title)
          ? `${v.title} — marked ready by ${str(v.actorName, "the sub")}.`
          : "A punch item is ready for your check.",
        linkUrl: base ? `${base}/punch-list` : null,
      };
    case "punch_item_verified":
      return {
        title: `Punch item verified${str(v.number) ? ` (${v.number})` : ""}`,
        body: str(v.title)
          ? `${v.title} — closed out. Nice work.`
          : "A GC verified your work and closed the item.",
        linkUrl: base ? `${base}/punch-list` : null,
      };
    case "punch_item_rejected":
      return {
        title: `Punch item rejected${str(v.number) ? ` (${v.number})` : ""}`,
        body: str(v.reason)
          ? `${str(v.title, "An item")} — sent back: "${v.reason}"`
          : str(v.title)
            ? `${v.title} — sent back for rework.`
            : "A punch item was sent back for rework.",
        linkUrl: base ? `${base}/punch-list` : null,
      };

    // ── Messages ─────────────────────────────────────────────────
    case "message_new":
      return {
        title: "New message",
        body: str(v.preview)
          ? String(v.preview).slice(0, 180)
          : str(v.actorName)
            ? `${v.actorName} sent you a message.`
            : "You have a new message.",
        linkUrl: base ? `${base}/messages` : null,
      };

    default:
      // Unknown events get a generic shell so the row still renders
      // rather than throwing — helps during incremental rollouts.
      return {
        title: str(v.title, "Notification"),
        body: str(v.body) || null,
        linkUrl: base,
      };
  }
}
