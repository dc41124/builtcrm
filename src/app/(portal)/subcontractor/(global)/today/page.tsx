import Link from "next/link";

import { QuickRfiFab } from "@/components/rfi/quick-rfi-fab";
import { getSubcontractorTodayData } from "@/domain/loaders/subcontractor-today";
import { loadPortalShell } from "@/lib/portal-shell";

import { SubcontractorTodayWorkspace } from "./today-workspace";

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

export default async function SubcontractorTodayPage() {
  const shell = await loadPortalShell("subcontractor");
  const data = await getSubcontractorTodayData({
    subOrganizationId: shell.orgId,
    userId: shell.userId,
  });
  const k = data.kpis;

  const gcRequestCount = data.attention.filter(
    (a) => a.kind === "upload" || a.kind === "compliance",
  ).length;
  const requiredToday = data.attention.filter(
    (a) => a.pillLabel === "Due today" || a.pillLabel === "Expired" || a.pillLabel === "Due",
  ).length;

  const summary = [
    {
      label: "Assigned today",
      value: String(k.openRfis + k.openUploadRequests),
      meta: `Across ${k.activeProjects} ${k.activeProjects === 1 ? "project" : "projects"}`,
      type: "" as const,
    },
    {
      label: "GC requests",
      value: String(k.openUploadRequests),
      meta:
        k.uploadRequestsDueToday > 0
          ? `${k.uploadRequestsDueToday} due today`
          : k.openUploadRequests === 0
            ? "All clear"
            : "Open",
      type: "accent" as const,
    },
    {
      label: "Payments",
      value: "—",
      meta: "Paid through GC",
      type: "" as const,
    },
    {
      label: "Compliance",
      value: k.complianceIssues > 0 ? `${k.complianceIssues} due` : "Current",
      meta: k.complianceLabel ?? "Documents on file",
      type: (k.complianceIssues > 0 ? "danger" : "success") as "danger" | "success",
    },
  ];

  const focus = data.currentFocus;
  const complianceFirst = data.compliance[0];
  const qa = data.quickAccessCounts;
  const fmtUsd = (cents: number) =>
    cents === 0
      ? null
      : `$${Math.round(cents / 100).toLocaleString()} pending`;

  return (
    <div className="stb">
      <div className="stb-ph-hdr">
        <div>
          <h1 className="stb-pt">Today Board</h1>
          <div className="stb-pills">
            <span className="stb-pl steel">
              {shell.orgName} · Subcontractor scope
            </span>
            {gcRequestCount > 0 ? (
              <span className="stb-pl orange">
                {gcRequestCount} GC {gcRequestCount === 1 ? "request" : "requests"} open
              </span>
            ) : null}
            {requiredToday > 0 ? (
              <span className="stb-pl red">
                {requiredToday} required action{requiredToday === 1 ? "" : "s"} today
              </span>
            ) : null}
          </div>
          <p className="stb-pst">
            What to do, what to send, and what the GC needs from you — across all your
            assigned projects.
          </p>
        </div>
        <div className="stb-ph-acts">
          <Link className="stb-btn" href="/subcontractor/upload-requests">
            <UploadIcon /> Upload File
          </Link>
          <Link className="stb-btn" href="/subcontractor/messages">
            <MsgIcon /> Message GC
          </Link>
          <Link className="stb-btn pri" href="/subcontractor/upload-requests">
            Open My Tasks
          </Link>
        </div>
      </div>

      <div className="stb-ss">
        {summary.map((c) => (
          <div key={c.label} className={`stb-sc${c.type ? ` ${c.type}-c` : ""}`}>
            <div className="stb-sc-l">{c.label}</div>
            <div className="stb-sc-v">{c.value}</div>
            <div className="stb-sc-m">{c.meta}</div>
          </div>
        ))}
      </div>

      <section className="stb-bg">
        <SubcontractorTodayWorkspace
          attention={data.attention}
          projectList={data.projectList}
          compliance={data.compliance}
          recentDocuments={data.recentDocuments}
          recentConversations={data.recentConversations}
          tabCounts={{
            rfis: k.openRfis,
            uploads: k.openUploadRequests,
            compliance: k.complianceIssues,
            messages: qa.unreadMessages,
            documents: qa.documentCount,
          }}
        />

        <div className="stb-rl">
          <div className="stb-rc stb-rc-alert">
            <div className="stb-rc-h">
              <h3>Compliance state</h3>
              <div className="stb-rc-sub">Operational gate for project access</div>
            </div>
            <div className="stb-rc-body">
              {complianceFirst ? (
                <div className="stb-lst">
                  <div className={`stb-lr${complianceFirst.statusColor === "red" ? " hot" : ""}`}>
                    <div className="stb-lr-main">
                      <h5>{complianceFirst.label}</h5>
                      <p>{complianceFirst.detail}</p>
                    </div>
                    <div className="stb-lr-side">
                      <span
                        className={`stb-pl ${
                          complianceFirst.statusColor === "red"
                            ? "red"
                            : complianceFirst.statusColor === "amber"
                              ? "orange"
                              : complianceFirst.statusColor === "green"
                                ? "green"
                                : "steel"
                        }`}
                      >
                        {complianceFirst.statusLabel}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="stb-empty">No compliance records on file yet.</div>
              )}
            </div>
          </div>

          <div className="stb-rc">
            <div className="stb-rc-h">
              <h3>Quick access</h3>
              <div className="stb-rc-sub">Jump into modules</div>
            </div>
            <div className="stb-rc-body">
              <div className="stb-mod-links">
                <Link className="stb-mod-link" href="/subcontractor/messages">
                  <span>Messages</span>
                  <div className="stb-ml-r">
                    {qa.unreadMessages > 0 ? (
                      <span className="stb-ml-c">{qa.unreadMessages} unread</span>
                    ) : null}
                    <span className="stb-ml-a">→</span>
                  </div>
                </Link>
                <Link className="stb-mod-link" href="/subcontractor/upload-requests">
                  <span>Upload Responses</span>
                  <div className="stb-ml-r">
                    {k.openUploadRequests > 0 ? (
                      <span className="stb-ml-c">{k.openUploadRequests} open</span>
                    ) : null}
                    <span className="stb-ml-a">→</span>
                  </div>
                </Link>
                <Link className="stb-mod-link" href="/subcontractor/schedule">
                  <span>Schedule</span>
                  <span className="stb-ml-a">→</span>
                </Link>
                <Link className="stb-mod-link" href="/subcontractor/payments">
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
              <h3>Current project focus</h3>
              <div className="stb-rc-sub">Where most of today&apos;s work is</div>
            </div>
            <div className="stb-rc-body">
              {focus ? (
                <>
                  <div className="stb-focus-name">{focus.name}</div>
                  <p className="stb-focus-desc">{focus.description}</p>
                </>
              ) : (
                <div className="stb-empty">
                  You have no active project assignments yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>


      {focus ? <QuickRfiFab projectId={focus.projectId} /> : null}
    </div>
  );
}
