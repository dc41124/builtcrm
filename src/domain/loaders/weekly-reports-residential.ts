import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import {
  approvals,
  selectionDecisions,
  selectionItems,
} from "@/db/schema";

import type { SessionLike } from "../context";
import { AuthorizationError } from "../permissions";

import {
  getClientWeeklyReportDetail,
  getClientWeeklyReports,
  type ClientWeeklyReportDetailView,
  type ClientWeeklyReportsView,
  type WeeklyReportDetail,
  type WeeklyReportSection,
} from "./weekly-reports";

// Residential reshaper. The contractor + commercial views render the
// `weekly_report_sections` directly. The residential portal projects the
// SAME sections + summaryText into warmer, friendlier cards (per the
// prototype's mapping table):
//
//   Hero narrative              ← summaryText
//   Progress this week          ← daily_logs + closed milestones
//   Anything for you to do?     ← pending approvals + pending selections
//                                  (derived; no schema field for narrative)
//   A peek at the week          ← photos
//   What got decided            ← approved change_orders + closed approvals
//                                  from the report's window
//   Coming up next week         ← upcoming milestones
//
// Same `weekly_reports` + `weekly_report_sections` tables, different
// renderer per portal — no schema duplication.

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

export type ResidentialProgressItem = {
  label: string;
  status: "done" | "in_progress" | "arrived" | "upcoming";
};

export type ResidentialDecisionItem = {
  title: string;
  detail: string;
};

export type ResidentialUpcomingItem = string;

export type ResidentialPendingAction = {
  title: string;
  detail: string;
  href: string;
};

export type ResidentialReshapedReport = {
  // Pass-through identity for routing / layout.
  reportId: string;
  weekStart: string;
  weekEnd: string;
  status: WeeklyReportDetail["status"];
  sentAt: Date | null;
  sentByName: string | null;

  // Reshaped cards.
  heroNarrative: string | null;
  progress: ResidentialProgressItem[];
  pendingActions: ResidentialPendingAction[];
  pendingActionsSummary: string; // "You have 2 pending decisions" or "No actions needed this week"
  photos: Array<{ photoId: string; documentId: string; caption: string | null }>;
  decisions: ResidentialDecisionItem[];
  upcoming: ResidentialUpcomingItem[];
};

export type ResidentialWeeklyReportsView = ClientWeeklyReportsView;

export type ResidentialWeeklyReportDetailView = ClientWeeklyReportDetailView & {
  reshaped: ResidentialReshapedReport;
};

type ProjectInput = {
  session: SessionLike | null | undefined;
  projectId: string;
};

type ReportInput = ProjectInput & { reportId: string };

// --------------------------------------------------------------------------
// Loaders
// --------------------------------------------------------------------------

export async function getResidentialWeeklyReports(
  input: ProjectInput,
): Promise<ResidentialWeeklyReportsView> {
  const view = await getClientWeeklyReports(input);
  if (view.context.role !== "residential_client") {
    throw new AuthorizationError(
      "Residential weekly-reports view requires a residential client role",
      "forbidden",
    );
  }
  return view;
}

export async function getResidentialWeeklyReportDetail(
  input: ReportInput,
): Promise<ResidentialWeeklyReportDetailView> {
  const view = await getClientWeeklyReportDetail(input);
  if (view.context.role !== "residential_client") {
    throw new AuthorizationError(
      "Residential weekly-reports view requires a residential client role",
      "forbidden",
    );
  }

  const pendingActions = await derivePendingActions({
    projectId: view.project.id,
  });

  const reshaped = reshapeForResidential({
    report: view.report,
    projectId: view.project.id,
    pendingActions,
  });

  return { ...view, reshaped };
}

// Convenience for callers that already have a contractor-side detail and
// need the residential projection (e.g. a future "preview as client"
// affordance for the contractor editor).
export function reshapeContractorDetailForResidential(
  detail: WeeklyReportDetail,
  projectId: string,
  pendingActions: ResidentialPendingAction[],
): ResidentialReshapedReport {
  return reshapeForResidential({ report: detail, projectId, pendingActions });
}

// --------------------------------------------------------------------------
// Reshaper — pure function; no DB access
// --------------------------------------------------------------------------

function reshapeForResidential(args: {
  report: WeeklyReportDetail;
  projectId: string;
  pendingActions: ResidentialPendingAction[];
}): ResidentialReshapedReport {
  const { report, pendingActions } = args;
  const sectionsByType = new Map<string, WeeklyReportSection>();
  for (const s of report.sections) sectionsByType.set(s.sectionType, s);

  const dailyLogs = sectionsByType.get("daily_logs");
  const photos = sectionsByType.get("photos");
  const milestones = sectionsByType.get("milestones");
  const changeOrders = sectionsByType.get("change_orders");

  return {
    reportId: report.id,
    weekStart: report.weekStart,
    weekEnd: report.weekEnd,
    status: report.status,
    sentAt: report.sentAt,
    sentByName: report.sentByName,

    heroNarrative: report.summaryText,

    progress: deriveProgress(dailyLogs, milestones),
    pendingActions,
    pendingActionsSummary: composePendingActionsSummary(pendingActions),
    photos: derivePhotos(photos),
    decisions: deriveDecisions(changeOrders),
    upcoming: deriveUpcoming(milestones),
  };
}

function deriveProgress(
  dailyLogs: WeeklyReportSection | undefined,
  milestones: WeeklyReportSection | undefined,
): ResidentialProgressItem[] {
  const items: ResidentialProgressItem[] = [];

  // Closed milestones → "done"
  const closed =
    (milestones?.content.closed as Array<{ title: string }> | undefined) ?? [];
  for (const m of closed) {
    items.push({ label: m.title, status: "done" });
  }

  // Daily-log milestone fields surface trade arrivals etc. The schema has
  // a `milestone` text field on dailyLogs that captures these "things that
  // happened today" callouts; we don't have it here directly because the
  // generator only includes summary in the section payload. As a near-term
  // proxy, also surface the FIRST upcoming milestone as "in_progress" if
  // there are no closed milestones (so the card isn't empty when the week
  // was steady-state work).
  if (items.length === 0) {
    const upcoming =
      (milestones?.content.upcoming as Array<{ title: string }> | undefined) ??
      [];
    for (const m of upcoming.slice(0, 3)) {
      items.push({ label: m.title, status: "in_progress" });
    }
  }

  // If still empty and we have daily logs, surface a "Steady progress on site"
  // placeholder so the card isn't blank.
  if (items.length === 0 && dailyLogs) {
    const entries = (dailyLogs.content.entries as unknown[] | undefined) ?? [];
    if (entries.length > 0) {
      items.push({
        label: `Crew on site ${entries.length} day${entries.length === 1 ? "" : "s"} this week`,
        status: "done",
      });
    }
  }

  return items;
}

function derivePhotos(
  photos: WeeklyReportSection | undefined,
): ResidentialReshapedReport["photos"] {
  const items =
    (photos?.content.items as Array<{
      photoId: string;
      documentId: string;
      caption: string | null;
    }> | undefined) ?? [];
  return items.slice(0, 8).map((p) => ({
    photoId: p.photoId,
    documentId: p.documentId,
    caption: p.caption,
  }));
}

function deriveDecisions(
  changeOrders: WeeklyReportSection | undefined,
): ResidentialDecisionItem[] {
  const items: ResidentialDecisionItem[] = [];
  const approved =
    (changeOrders?.content.approved as Array<{
      title: string;
      amountCents: number;
    }> | undefined) ?? [];
  for (const c of approved) {
    const amountText = c.amountCents
      ? formatCents(c.amountCents)
      : "no cost change";
    items.push({
      title: c.title,
      detail: `Approved this week — ${amountText}.`,
    });
  }
  return items;
}

function deriveUpcoming(
  milestones: WeeklyReportSection | undefined,
): ResidentialUpcomingItem[] {
  const upcoming =
    (milestones?.content.upcoming as Array<{
      title: string;
      dueDate?: string;
    }> | undefined) ?? [];
  return upcoming.slice(0, 5).map((m) => {
    if (!m.dueDate) return m.title;
    const d = new Date(m.dueDate).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    return `${m.title} — ${d}`;
  });
}

function composePendingActionsSummary(
  pending: ResidentialPendingAction[],
): string {
  if (pending.length === 0) {
    return "No actions needed from you this week. We'll send a reminder when something changes.";
  }
  if (pending.length === 1) {
    return `One thing for you: ${pending[0].title.toLowerCase()}.`;
  }
  return `You have ${pending.length} things to review. We've linked each one below.`;
}

function formatCents(cents: number): string {
  if (cents === 0) return "no cost change";
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${(abs / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })}`;
}

// --------------------------------------------------------------------------
// Pending-actions derivation. Two signals:
//   - approvals.approvalStatus = 'pending_review' (any approval awaiting
//     a client decision)
//   - selectionItems published with no confirmed decision yet (residential
//     decision queue)
// --------------------------------------------------------------------------

async function derivePendingActions(args: {
  projectId: string;
}): Promise<ResidentialPendingAction[]> {
  const [pendingApprovals, pendingSelections] = await Promise.all([
    db
      .select({
        id: approvals.id,
        title: approvals.title,
      })
      .from(approvals)
      .where(
        and(
          eq(approvals.projectId, args.projectId),
          eq(approvals.approvalStatus, "pending_review"),
        ),
      )
      .limit(5),
    db
      .select({
        id: selectionItems.id,
        title: selectionItems.title,
      })
      .from(selectionItems)
      .leftJoin(
        selectionDecisions,
        and(
          eq(selectionDecisions.selectionItemId, selectionItems.id),
          eq(selectionDecisions.isConfirmed, true),
        ),
      )
      .where(
        and(
          eq(selectionItems.projectId, args.projectId),
          eq(selectionItems.isPublished, true),
          isNull(selectionDecisions.id),
        ),
      )
      .limit(5),
  ]);

  const actions: ResidentialPendingAction[] = [];
  for (const a of pendingApprovals) {
    actions.push({
      title: a.title,
      detail: "Waiting for your decision.",
      href: `/residential/project/${args.projectId}/decisions`,
    });
  }
  for (const s of pendingSelections) {
    actions.push({
      title: s.title,
      detail: "Pick your option.",
      href: `/residential/project/${args.projectId}/selections`,
    });
  }
  return actions;
}

