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

      <style>{`
.stb{display:flex;flex-direction:column;gap:20px}
.stb-ph-hdr{display:flex;justify-content:space-between;align-items:flex-start;gap:20px}
.stb-pt{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;line-height:1.15;color:var(--t1);margin:0}
.stb-pst{font-family:var(--fb);font-size:13px;color:var(--t2);margin:8px 0 0;line-height:1.5;max-width:680px}
.stb-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.stb-ph-acts{display:flex;gap:8px;flex-wrap:wrap;flex-shrink:0;align-items:flex-start}
.stb-pl{height:24px;padding:0 10px;border-radius:999px;border:1px solid var(--s3);display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd)}
.stb-pl.steel{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.stb-pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d6a0}
.stb-pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5c0c0}
.stb-pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#a7d9be}
.stb-pl.blue{background:var(--in-s);color:var(--in-t);border-color:#b3d4ee}
.stb-btn{height:36px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-size:13px;font-weight:620;font-family:var(--fb);display:inline-flex;align-items:center;gap:6px;transition:all 120ms ease;white-space:nowrap;cursor:pointer;text-decoration:none}
.stb-btn:hover{background:var(--s2);border-color:var(--s4)}
.stb-btn.pri{background:var(--ac);color:#faf9f7;border-color:var(--ac)}
.stb-btn.pri:hover{background:var(--ac-h)}
.stb-btn svg{width:15px;height:15px;flex-shrink:0}

.stb-ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 6px}
.stb-ss-5{grid-template-columns:repeat(5,1fr)}
.stb-sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;transition:border-color 120ms ease}
.stb-sc:hover{border-color:var(--s4)}
.stb-sc-l{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--t3);font-weight:560;font-family:var(--fb)}
.stb-sc-v{font-family:var(--fd);font-size:20px;font-weight:820;letter-spacing:-.03em;margin-top:4px;color:var(--t1)}
.stb-sc-m{font-size:12px;color:var(--t2);margin-top:3px}
.stb-sc.accent-c{background:linear-gradient(180deg,var(--s1) 0%,#edf3f8 100%);border-color:var(--ac-m)}
.stb-sc.accent-c .stb-sc-v{color:var(--ac-t)}
.stb-sc.warn-c{background:linear-gradient(180deg,var(--s1) 0%,#fef8ee 100%);border-color:#f0d5a3}
.stb-sc.warn-c .stb-sc-v{color:var(--wr-t)}
.stb-sc.danger-c{background:linear-gradient(180deg,var(--s1) 0%,#fef1f1 100%);border-color:#f0b8b8}
.stb-sc.danger-c .stb-sc-v{color:var(--dg-t)}
.stb-sc.success-c{background:linear-gradient(180deg,var(--s1) 0%,#f1faf4 100%);border-color:#a7d9be}
.stb-sc.success-c .stb-sc-v{color:var(--ok-t)}

.stb-bg{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start}

.stb-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);min-width:0}
.stb-cd-h{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:18px 20px 0}
.stb-cd-h h3{font-family:var(--fd);font-size:15px;font-weight:720;letter-spacing:-.01em;margin:0}
.stb-cd-sub{font-family:var(--fb);font-size:12px;color:var(--t2);margin-top:4px}
.stb-cd-badge{height:26px;padding:0 10px;border-radius:999px;background:var(--ac-s);color:var(--ac-t);font-size:11px;font-weight:700;font-family:var(--fd);display:inline-flex;align-items:center;white-space:nowrap;flex-shrink:0}

.stb-wt-bar{display:flex;gap:4px;flex-wrap:wrap;margin:14px 20px 0;background:var(--s2);border-radius:var(--r-l);padding:4px}
.stb-wt{height:34px;padding:0 12px;border-radius:var(--r-m);font-size:12px;font-weight:620;color:var(--t2);display:inline-flex;align-items:center;gap:6px;transition:all 120ms ease;white-space:nowrap;flex-shrink:0;cursor:pointer;background:none;border:none;font-family:var(--fb)}
.stb-wt:hover{color:var(--t1);background:var(--s1)}
.stb-wt.on{background:var(--s1);color:var(--t1);font-weight:650;box-shadow:var(--shsm)}
.stb-tb-b{min-width:16px;height:16px;padding:0 5px;border-radius:999px;background:var(--ac-s);color:var(--ac-t);font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:var(--fd)}
.stb-tb-b.warn{background:var(--wr-s);color:var(--wr-t)}
.stb-tb-b.danger{background:var(--dg-s);color:var(--dg-t)}
.stb-ws-note{padding:0 20px;margin-top:6px;font-size:12px;color:var(--t3)}
.stb-cd-body{padding:16px 20px 20px}

.stb-ml{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;align-items:start}
.stb-stk{display:flex;flex-direction:column;gap:14px;min-width:0}
.stb-sfb{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px}
.stb-sfb h4{font-family:var(--fd);font-size:13px;font-weight:700;margin:0 0 10px;color:var(--t1)}
.stb-dom{background:linear-gradient(180deg,var(--s1) 0%,#edf3f8 100%);border-color:var(--ac-m)}
.stb-dom h4{font-size:14px;margin-bottom:12px;color:var(--ac-t)}
.stb-alrt{background:linear-gradient(180deg,var(--s1) 0%,#fdf6ea 100%);border-color:#f0d5a3}
.stb-alrt h4{color:var(--wr-t)}

.stb-lst{display:flex;flex-direction:column;gap:8px}
.stb-lr{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start;transition:border-color 120ms ease;text-decoration:none;color:inherit}
.stb-lr:hover{border-color:var(--s4)}
.stb-lr.hot{border-color:#f0b8b8;background:#fef8f8}
.stb-lr-main{min-width:0}
.stb-lr-main h5{font-family:var(--fd);font-size:13px;font-weight:650;margin:0 0 3px;color:var(--t1);letter-spacing:-.01em}
.stb-lr-main p{font-family:var(--fb);font-size:12px;color:var(--t2);line-height:1.45;margin:0}
.stb-lr-side{display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0}
.stb-tm{font-size:11px;color:var(--t3);font-family:var(--fd);font-weight:600}

.stb-empty{background:var(--s1);border:1px dashed var(--s3);border-radius:var(--r-m);padding:14px;font-family:var(--fb);font-size:12px;color:var(--t3);text-align:center}

.stb-rl{display:flex;flex-direction:column;gap:12px;min-width:0}
.stb-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.stb-rc-h{padding:14px 16px 0}
.stb-rc-h h3{font-family:var(--fd);font-size:14px;font-weight:700;margin:0}
.stb-rc-sub{font-family:var(--fb);font-size:11px;color:var(--t2);margin-top:3px}
.stb-rc-body{padding:12px 16px 16px}

.stb-ms-item{display:flex;align-items:center;gap:12px;padding:8px 0}
.stb-ms-item+.stb-ms-item{border-top:1px solid var(--s3)}
.stb-ms-date{width:44px;text-align:center;flex-shrink:0}
.stb-ms-day{font-family:var(--fd);font-size:16px;font-weight:750;color:var(--t1);letter-spacing:-.02em}
.stb-ms-month{font-family:var(--fd);font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;font-weight:600}
.stb-ms-info{flex:1;min-width:0}
.stb-ms-info h5{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t1);margin:0 0 2px;letter-spacing:-.01em}
.stb-ms-info p{font-family:var(--fb);font-size:11px;color:var(--t2);margin:0;text-transform:capitalize}
.stb-ms-cd{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);white-space:nowrap;flex-shrink:0}
.stb-ms-cd.soon{color:var(--wr-t)}

.stb-mod-links{display:flex;flex-direction:column;gap:6px}
.stb-mod-link{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:550;color:var(--t1);transition:all 120ms ease;cursor:pointer;text-decoration:none}
.stb-mod-link:hover{border-color:var(--ac-m);background:var(--ac-s)}
.stb-ml-r{display:flex;align-items:center;gap:6px}
.stb-ml-c{font-family:var(--fd);font-size:12px;font-weight:700;color:var(--ac-t)}
.stb-ml-a{color:var(--t3);font-size:14px}

.stb-gc-ct{display:flex;align-items:center;gap:10px;padding:10px 0}
.stb-gc-ct+.stb-gc-ct{border-top:1px solid var(--s3)}
.stb-gc-av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:10px;font-weight:700;color:#fff;flex-shrink:0}
.stb-gc-nm{font-family:var(--fd);font-size:13px;font-weight:640;color:var(--t1);letter-spacing:-.01em}
.stb-gc-rl{font-family:var(--fd);font-size:11px;color:var(--t3);font-weight:520}

@media(max-width:1280px){.stb-ss{grid-template-columns:repeat(2,1fr)}.stb-ss-5{grid-template-columns:repeat(3,1fr)}.stb-bg{grid-template-columns:1fr}.stb-ml{grid-template-columns:1fr}}
@media(max-width:767px){.stb-pt{font-size:22px}.stb-ss,.stb-ss-5{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
