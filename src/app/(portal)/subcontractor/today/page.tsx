import Link from "next/link";

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
          tabCounts={{
            rfis: k.openRfis,
            uploads: k.openUploadRequests,
            compliance: k.complianceIssues,
            messages: qa.unreadMessages,
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
.stb-btn{height:36px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-size:13px;font-weight:620;font-family:var(--fb);display:inline-flex;align-items:center;gap:6px;transition:all 120ms ease;white-space:nowrap;cursor:pointer}
.stb-btn:hover{background:var(--s2);border-color:var(--s4)}
.stb-btn.pri{background:var(--ac);color:#faf9f7;border-color:var(--ac)}
.stb-btn.pri:hover{background:var(--ac-h)}
.stb-btn svg{width:15px;height:15px;flex-shrink:0}

.stb-ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0 6px}
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
.stb-rc-alert{background:linear-gradient(180deg,#fffbf5 0%,#fef4e3 100%);border-color:#f0d5a3}

.stb-mod-links{display:flex;flex-direction:column;gap:6px}
.stb-mod-link{display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:550;color:var(--t1);transition:all 120ms ease;cursor:pointer;text-decoration:none}
.stb-mod-link:hover{border-color:var(--ac-m);background:var(--ac-s)}
.stb-ml-r{display:flex;align-items:center;gap:6px}
.stb-ml-c{font-family:var(--fd);font-size:12px;font-weight:700;color:var(--ac-t)}
.stb-ml-a{color:var(--t3);font-size:14px}

.stb-focus-name{font-family:var(--fd);font-size:14px;font-weight:700;margin-bottom:4px;color:var(--t1)}
.stb-focus-desc{font-family:var(--fb);font-size:12px;color:var(--t2);line-height:1.5;margin:0}

@media(max-width:1280px){.stb-ss{grid-template-columns:repeat(2,1fr)}.stb-bg{grid-template-columns:1fr}.stb-ml{grid-template-columns:1fr}}
@media(max-width:767px){.stb-pt{font-size:22px}.stb-ss{grid-template-columns:1fr}}
      `}</style>
    </div>
  );
}
