import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { getSubcontractorProjectView } from "@/domain/loaders/project-home";
import { AuthorizationError } from "@/domain/permissions";

import {
  SubProjectHomeWorkspace,
  type WorkspaceActivityEvent,
  type WorkspaceListItem,
} from "./project-home-workspace";

const PHASE_LABELS: Record<string, string> = {
  preconstruction: "Precon",
  phase_1: "Phase 1",
  phase_2: "Phase 2",
  phase_3: "Phase 3",
  closeout: "Closeout",
};

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const UploadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
);
const MsgIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);

export default async function SubcontractorProjectHomePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  let view;
  try {
    view = await getSubcontractorProjectView({
      session: session.session as unknown as { appUserId?: string | null },
      projectId,
    });
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "not_found") notFound();
      if (err.code === "unauthenticated") redirect("/login");
      return <pre>Forbidden: {err.message}</pre>;
    }
    throw err;
  }

  const base = `/subcontractor/project/${view.project.id}`;

  const openRfis = view.assignedRfis.filter(
    (r) => r.rfiStatus === "open" || r.rfiStatus === "pending_response",
  );
  const pendingUploads = view.pendingUploadRequests;
  const complianceIssues = view.complianceRecords.filter(
    (c) => c.complianceStatus === "expired" || c.complianceStatus === "rejected",
  ).length;
  const nextMilestone = view.myMilestones.find(
    (m) => m.milestoneStatus === "scheduled" || m.milestoneStatus === "in_progress",
  );
  const scopeLabel = view.scope.workScope ?? "Assigned";
  const phaseLabel =
    view.scope.phaseScope && PHASE_LABELS[view.scope.phaseScope]
      ? PHASE_LABELS[view.scope.phaseScope]
      : (view.scope.phaseScope ?? "Current phase");

  const uploadItems: WorkspaceListItem[] = pendingUploads.map((u) => {
    const overdue = u.dueAt ? u.dueAt.getTime() < Date.now() : false;
    return {
      id: `upload-${u.id}`,
      title: u.title,
      description:
        u.requestStatus === "revision_requested"
          ? (u.revisionNote ?? "GC requested revision — re-upload required.")
          : (u.description ?? "GC requested upload."),
      pillLabel: overdue ? "Overdue" : u.requestStatus === "revision_requested" ? "Revision" : "Upload",
      pillType: overdue ? "red" : "blue",
      hot: overdue,
      href: `${base}/upload-requests`,
    };
  });

  const rfiItems: WorkspaceListItem[] = openRfis.map((r) => ({
    id: `rfi-${r.id}`,
    title: `RFI-${String(r.sequentialNumber).padStart(3, "0")} — ${r.subject}`,
    description: r.body?.slice(0, 140) ?? "Response needed from your team.",
    pillLabel: r.dueAt && r.dueAt.getTime() < Date.now() ? "Overdue" : "Need reply",
    pillType: r.dueAt && r.dueAt.getTime() < Date.now() ? "red" : "orange",
    hot: !!(r.dueAt && r.dueAt.getTime() < Date.now()),
    href: `${base}/rfis`,
  }));

  const activeTasks = [...uploadItems, ...rfiItems];
  const gcRequests = uploadItems;

  const activityEvents: WorkspaceActivityEvent[] = view.activityTrail
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      actorName: a.actorName,
      createdAt: a.createdAt.toISOString(),
    }));

  const complianceRows = view.complianceRecords.map((c) => {
    const now = Date.now();
    const expiring =
      c.expiresAt && c.expiresAt.getTime() - now < 7 * 86400000;
    const expired = c.complianceStatus === "expired";
    const rejected = c.complianceStatus === "rejected";
    const statusColor: "red" | "amber" | "green" | "gray" =
      expired || rejected
        ? "red"
        : expiring
          ? "amber"
          : c.complianceStatus === "active"
            ? "green"
            : "gray";
    const statusLabel = expired
      ? "Expired"
      : rejected
        ? "Rejected"
        : expiring
          ? "Expiring"
          : c.complianceStatus === "active"
            ? "Active"
            : c.complianceStatus === "waived"
              ? "Waived"
              : "Pending";
    const detail = c.expiresAt
      ? `${expired ? "Expired" : "Expires"} ${c.expiresAt.toISOString().slice(0, 10)}`
      : "No expiry on file";
    return {
      id: c.id,
      label: c.complianceType,
      detail,
      statusLabel,
      statusColor,
    };
  });

  const docRows = view.documents.slice(0, 20).map((d) => ({
    id: d.id,
    title: d.title,
    documentType: d.documentType,
    uploaderLabel: d.uploadedByName
      ? `Uploaded by ${d.uploadedByName}`
      : "Uploaded",
    href: `${base}/documents`,
  }));

  const conversationRows = view.conversations.slice(0, 20).map((c) => ({
    id: c.id,
    title:
      c.title ??
      (c.conversationType === "project_general"
        ? "Project general"
        : c.conversationType.replace(/_/g, " ")),
    preview: c.lastMessagePreview ?? "No messages yet.",
    unread: c.unreadCount > 0,
    href: `${base}/messages`,
  }));

  const milestoneRows = view.myMilestones.slice(0, 12).map((m) => ({
    id: m.id,
    title: m.title,
    status: m.milestoneStatus.replace(/_/g, " "),
    scheduledLabel: m.scheduledDate.toISOString().slice(0, 10),
  }));

  const qa = view.quickAccessCounts;
  const fmtUsd = (cents: number) =>
    cents === 0 ? null : `$${Math.round(cents / 100).toLocaleString()} pending`;

  const summary = [
    {
      label: "Your scope",
      value: scopeLabel,
      meta: phaseLabel,
      type: "" as const,
    },
    {
      label: "Open RFIs",
      value: String(openRfis.length),
      meta: openRfis.length === 0 ? "No open RFIs" : "Need your response",
      type: (openRfis.length > 0 ? "accent" : "") as "accent" | "",
    },
    {
      label: "GC requests",
      value: String(pendingUploads.length),
      meta: pendingUploads.length === 0 ? "All clear" : "From the GC",
      type: (pendingUploads.length > 0 ? "warn" : "") as "warn" | "",
    },
    {
      label: "Compliance",
      value: complianceIssues === 0 ? "Current" : String(complianceIssues),
      meta: complianceIssues === 0 ? "Documents on file" : "Needs attention",
      type: (complianceIssues === 0 ? "success" : "danger") as "success" | "danger",
    },
    {
      label: "Payment",
      value: "—",
      meta: "Tracked per project",
      type: "" as const,
    },
  ];

  return (
    <div className="stb">
      <div className="stb-ph-hdr">
        <div>
          <h1 className="stb-pt">{view.project.name}</h1>
          <div className="stb-pills">
            <span className="stb-pl steel">{scopeLabel} scope · Your work</span>
            {pendingUploads.length + openRfis.length > 0 ? (
              <span className="stb-pl orange">
                {pendingUploads.length + openRfis.length} open requests
              </span>
            ) : (
              <span className="stb-pl green">On track</span>
            )}
            {complianceIssues > 0 ? (
              <span className="stb-pl red">Compliance action needed</span>
            ) : null}
          </div>
          <p className="stb-pst">
            Your scope, tasks, open requests, and project context — scoped to what&apos;s
            relevant to your work.
          </p>
        </div>
        <div className="stb-ph-acts">
          <Link className="stb-btn" href={`${base}/upload-requests`}>
            <UploadIcon /> Upload File
          </Link>
          <Link className="stb-btn pri" href={`${base}/messages`}>
            <MsgIcon /> Message GC
          </Link>
        </div>
      </div>

      <div className="stb-ss stb-ss-5">
        {summary.map((c) => (
          <div key={c.label} className={`stb-sc${c.type ? ` ${c.type}-c` : ""}`}>
            <div className="stb-sc-l">{c.label}</div>
            <div className="stb-sc-v">{c.value}</div>
            <div className="stb-sc-m">{c.meta}</div>
          </div>
        ))}
      </div>

      <section className="stb-bg">
        <SubProjectHomeWorkspace
          projectName={view.project.name}
          scopeLabel={scopeLabel}
          activeTasks={activeTasks}
          gcRequests={gcRequests}
          activityEvents={activityEvents}
          rfiItems={rfiItems}
          uploadItems={uploadItems}
          complianceRows={complianceRows}
          documents={docRows}
          conversations={conversationRows}
          milestones={milestoneRows}
          tabCounts={{
            rfis: openRfis.length,
            uploads: pendingUploads.length,
            compliance: complianceIssues,
            docs: docRows.length,
            messages: qa.unreadMessages,
            schedule: milestoneRows.length,
          }}
        />

        <div className="stb-rl">
          <div className="stb-rc">
            <div className="stb-rc-h">
              <h3>Upcoming milestones</h3>
              <div className="stb-rc-sub">What this project is moving toward</div>
            </div>
            <div className="stb-rc-body">
              {view.myMilestones.length === 0 ? (
                <div className="stb-empty">No milestones scheduled yet.</div>
              ) : (
                view.myMilestones.slice(0, 3).map((m) => {
                  const d = m.scheduledDate;
                  const day = d.getUTCDate();
                  const month = MONTH_SHORT[d.getUTCMonth()];
                  const days = Math.max(
                    0,
                    Math.round((d.getTime() - Date.now()) / 86400000),
                  );
                  const soon = days <= 7;
                  const countdown =
                    days === 0
                      ? "Today"
                      : `${days} day${days === 1 ? "" : "s"}`;
                  const isNext = nextMilestone && m.id === nextMilestone.id;
                  return (
                    <div key={m.id} className="stb-ms-item">
                      <div className="stb-ms-date">
                        <div className="stb-ms-day">{day}</div>
                        <div className="stb-ms-month">{month}</div>
                      </div>
                      <div className="stb-ms-info">
                        <h5>{m.title}</h5>
                        <p>
                          {isNext ? "Next up · " : ""}
                          {m.milestoneStatus.replace(/_/g, " ")}
                        </p>
                      </div>
                      <div className={`stb-ms-cd${soon ? " soon" : ""}`}>
                        {countdown}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="stb-rc">
            <div className="stb-rc-h">
              <h3>Quick access</h3>
              <div className="stb-rc-sub">Project-scoped modules</div>
            </div>
            <div className="stb-rc-body">
              <div className="stb-mod-links">
                <Link className="stb-mod-link" href={`${base}/messages`}>
                  <span>Messages</span>
                  <div className="stb-ml-r">
                    {qa.unreadMessages > 0 ? (
                      <span className="stb-ml-c">{qa.unreadMessages} unread</span>
                    ) : null}
                    <span className="stb-ml-a">→</span>
                  </div>
                </Link>
                <Link className="stb-mod-link" href={`${base}/documents`}>
                  <span>Documents</span>
                  <div className="stb-ml-r">
                    {qa.documentCount > 0 ? (
                      <span className="stb-ml-c">
                        {qa.documentCount} {qa.documentCount === 1 ? "file" : "files"}
                      </span>
                    ) : null}
                    <span className="stb-ml-a">→</span>
                  </div>
                </Link>
                <Link className="stb-mod-link" href={`${base}/schedule`}>
                  <span>Schedule</span>
                  <span className="stb-ml-a">→</span>
                </Link>
                <Link className="stb-mod-link" href={`${base}/financials`}>
                  <span>Financials</span>
                  <div className="stb-ml-r">
                    {fmtUsd(qa.pendingFinancialsCents) ? (
                      <span className="stb-ml-c">
                        {fmtUsd(qa.pendingFinancialsCents)}
                      </span>
                    ) : null}
                    <span className="stb-ml-a">→</span>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          <div className="stb-rc">
            <div className="stb-rc-h">
              <h3>GC contacts</h3>
              <div className="stb-rc-sub">Your points of contact on this project</div>
            </div>
            <div className="stb-rc-body">
              {view.gcContacts.length === 0 ? (
                <div className="stb-empty">
                  No GC team members mapped to this project yet.
                </div>
              ) : (
                view.gcContacts.map((c, idx) => {
                  const palette = ["var(--ac)", "var(--ok)", "var(--wr)", "var(--in)"];
                  return (
                    <div key={c.id} className="stb-gc-ct">
                      <div
                        className="stb-gc-av"
                        style={{ background: palette[idx % palette.length] }}
                      >
                        {c.initials}
                      </div>
                      <div>
                        <div className="stb-gc-nm">{c.name}</div>
                        <div className="stb-gc-rl">{c.roleLabel}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </section>

      
    </div>
  );
}
