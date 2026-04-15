"use client";

import Link from "next/link";

import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import type { ClientProjectView } from "@/domain/loaders/project-home";

type Props = {
  projectName: string;
  milestones: ClientProjectView["milestones"];
  approvals: ClientProjectView["approvals"];
  openRequests: ClientProjectView["openRequests"];
  drawRequests: ClientProjectView["drawRequests"];
  decisions: ClientProjectView["decisions"];
};

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const MILESTONE_PILL: Record<string, { color: PillColor; label: string }> = {
  completed: { color: "green", label: "Complete" },
  in_progress: { color: "blue", label: "In progress" },
  at_risk: { color: "amber", label: "At risk" },
  delayed: { color: "red", label: "Delayed" },
  scheduled: { color: "gray", label: "Scheduled" },
  not_started: { color: "gray", label: "Upcoming" },
};

export function CommercialProjectHome({
  projectName,
  milestones,
  approvals,
  openRequests,
  drawRequests,
  decisions,
}: Props) {
  const latestDraw = drawRequests.reduce<ClientProjectView["drawRequests"][number] | null>(
    (acc, d) => (acc && acc.drawNumber > d.drawNumber ? acc : d),
    null,
  );

  const contractSum = latestDraw?.contractSumToDateCents ?? 0;
  const originalSum = latestDraw?.originalContractSumCents ?? 0;
  const netCOs = latestDraw?.netChangeOrdersCents ?? 0;
  const paidToDate =
    drawRequests
      .filter((d) => d.paidAt)
      .reduce((s, d) => s + d.currentPaymentDueCents, 0) || 0;
  const pendingPayment = drawRequests
    .filter((d) => d.submittedAt && !d.paidAt)
    .reduce((s, d) => s + d.currentPaymentDueCents, 0);
  const pctPaid =
    contractSum > 0 ? Math.round((paidToDate / contractSum) * 100) : 0;

  const pendingApprovals = approvals.filter(
    (a) => a.approvalStatus === "pending_review",
  );
  const openRfis = openRequests.filter(
    (r) => r.rfiStatus === "open" || r.rfiStatus === "answered",
  );
  const pendingCOs = decisions.filter(
    (c) => c.changeOrderStatus === "pending_client_approval",
  );

  const upcomingMilestones = [...milestones]
    .filter(
      (m) => m.milestoneStatus !== "completed" && m.milestoneStatus !== "canceled",
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime(),
    )
    .slice(0, 5);

  const completedCount = milestones.filter(
    (m) => m.milestoneStatus === "completed",
  ).length;

  return (
    <div className="cph">
      <header className="cph-head">
        <div className="cph-crumbs">{projectName}</div>
        <h1 className="cph-title">Project Overview</h1>
        <p className="cph-desc">
          Your project at a glance — budget, schedule, and anything that needs
          your decision. Everything here is shared directly from your contractor.
        </p>
      </header>

      <div className="cph-kpis">
        <KpiCard
          label="Current contract"
          value={fmtCents(contractSum || originalSum)}
          meta={
            netCOs !== 0
              ? `${netCOs > 0 ? "+" : ""}${fmtCents(netCOs)} in approved change orders`
              : "No approved changes"
          }
          iconColor="blue"
        />
        <KpiCard
          label="Paid to date"
          value={fmtCents(paidToDate)}
          meta={`${pctPaid}% of contract · ${drawRequests.filter((d) => d.paidAt).length} draws`}
          iconColor="green"
        />
        <KpiCard
          label="Pending approvals"
          value={pendingApprovals.length.toString()}
          meta={
            pendingApprovals.length === 0
              ? "You're all caught up"
              : "Awaiting your decision"
          }
          iconColor={pendingApprovals.length > 0 ? "red" : "green"}
          alert={pendingApprovals.length > 0}
        />
        <KpiCard
          label="Open change orders"
          value={pendingCOs.length.toString()}
          meta={`${openRfis.length} RFIs active`}
          iconColor="amber"
        />
      </div>

      <div className="cph-grid">
        <div className="cph-main">
          <Card
            title="Milestone timeline"
            subtitle={`${completedCount} of ${milestones.length} complete`}
          >
            {milestones.length === 0 ? (
              <EmptyState
                title="No milestones yet"
                description="Your contractor hasn't published any milestones for this project."
              />
            ) : (
              <ol className="cph-timeline">
                {milestones.map((m) => {
                  const status =
                    MILESTONE_PILL[m.milestoneStatus] ?? MILESTONE_PILL.scheduled;
                  return (
                    <li key={m.id} className={`cph-ms cph-ms-${m.milestoneStatus}`}>
                      <span className="cph-ms-dot" aria-hidden />
                      <div className="cph-ms-body">
                        <div className="cph-ms-title">{m.title}</div>
                        <div className="cph-ms-meta">
                          Target {fmtDate(m.scheduledDate)}
                        </div>
                      </div>
                      <Pill color={status.color}>{status.label}</Pill>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          <Card
            title="Recent activity"
            subtitle="Latest approvals and draw requests"
          >
            {approvals.length === 0 && drawRequests.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Updates from your contractor will appear here."
              />
            ) : (
              <ul className="cph-activity">
                {pendingApprovals.slice(0, 3).map((a) => (
                  <li key={a.id} className="cph-act">
                    <div className="cph-act-tag">Approval</div>
                    <div className="cph-act-body">
                      <div className="cph-act-title">{a.title}</div>
                      <div className="cph-act-meta">
                        {a.impactCostCents !== 0
                          ? `${a.impactCostCents > 0 ? "+" : ""}${fmtCents(a.impactCostCents)} impact`
                          : "No cost impact"}
                        {a.impactScheduleDays !== 0 &&
                          ` · ${a.impactScheduleDays > 0 ? "+" : ""}${a.impactScheduleDays}d schedule`}
                      </div>
                    </div>
                    <Pill color="purple">Needs review</Pill>
                  </li>
                ))}
                {drawRequests.slice(0, 3).map((d) => (
                  <li key={d.id} className="cph-act">
                    <div className="cph-act-tag">Draw #{d.drawNumber}</div>
                    <div className="cph-act-body">
                      <div className="cph-act-title">
                        {fmtCents(d.currentPaymentDueCents)} payment request
                      </div>
                      <div className="cph-act-meta">
                        {d.paidAt
                          ? `Paid ${fmtDate(d.paidAt)}`
                          : d.submittedAt
                            ? `Submitted ${fmtDate(d.submittedAt)}`
                            : "In preparation"}
                      </div>
                    </div>
                    <Pill
                      color={
                        d.paidAt ? "green" : d.submittedAt ? "amber" : "gray"
                      }
                    >
                      {d.paidAt ? "Paid" : d.submittedAt ? "Pending" : "Draft"}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="cph-rail">
          <Card title="Up next" subtitle="Milestones on the near horizon">
            {upcomingMilestones.length === 0 ? (
              <EmptyState
                title="Nothing scheduled"
                description="No upcoming milestones."
              />
            ) : (
              <ul className="cph-up">
                {upcomingMilestones.map((m) => (
                  <li key={m.id}>
                    <div className="cph-up-title">{m.title}</div>
                    <div className="cph-up-date">{fmtDate(m.scheduledDate)}</div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Budget snapshot">
            <div className="cph-bs">
              <div className="cph-bs-row">
                <span>Original contract</span>
                <span className="cph-bs-v">{fmtCents(originalSum)}</span>
              </div>
              <div className="cph-bs-row">
                <span>Change orders</span>
                <span className="cph-bs-v">
                  {netCOs !== 0
                    ? `${netCOs > 0 ? "+" : ""}${fmtCents(netCOs)}`
                    : "—"}
                </span>
              </div>
              <div className="cph-bs-row cph-bs-tot">
                <span>Current contract</span>
                <span className="cph-bs-v">{fmtCents(contractSum || originalSum)}</span>
              </div>
              <div className="cph-bar">
                <div
                  className="cph-bar-fill"
                  style={{ width: `${Math.min(pctPaid, 100)}%` }}
                />
              </div>
              <div className="cph-bs-row cph-bs-sub">
                <span>Paid</span>
                <span className="cph-bs-v">
                  {fmtCents(paidToDate)} ({pctPaid}%)
                </span>
              </div>
              {pendingPayment > 0 && (
                <div className="cph-bs-row cph-bs-sub">
                  <span>Pending</span>
                  <span className="cph-bs-v warn">
                    {fmtCents(pendingPayment)}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card title="Quick links">
            <ul className="cph-links">
              <li>
                <Link href="approvals">Approval Center →</Link>
              </li>
              <li>
                <Link href="change-orders">Change Orders →</Link>
              </li>
              <li>
                <Link href="billing">Billing & Draws →</Link>
              </li>
              <li>
                <Link href="documents">Project Files →</Link>
              </li>
              <li>
                <Link href="messages">Messages →</Link>
              </li>
            </ul>
          </Card>
        </aside>
      </div>

      <style>{`
        .cph{display:flex;flex-direction:column;gap:20px}
        .cph-head{display:flex;flex-direction:column;gap:6px}
        .cph-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .cph-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .cph-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .cph-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.cph-kpis{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:767px){
          .cph-title{font-size:20px}
          .cph-desc{font-size:13px}
          .cph-kpis{gap:10px}
          .cph-act{flex-wrap:wrap;row-gap:4px}
        }
        @media(max-width:420px){.cph-kpis{grid-template-columns:1fr}}
        .cph-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.cph-grid{grid-template-columns:1fr}}
        .cph-main{display:flex;flex-direction:column;gap:16px;min-width:0}
        .cph-rail{display:flex;flex-direction:column;gap:14px}

        .cph-timeline{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
        .cph-ms{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--s2);position:relative}
        .cph-ms:last-child{border-bottom:none}
        .cph-ms-dot{width:10px;height:10px;border-radius:50%;background:var(--s4);flex-shrink:0}
        .cph-ms-completed .cph-ms-dot{background:var(--ok)}
        .cph-ms-in_progress .cph-ms-dot{background:var(--ac);box-shadow:0 0 0 3px var(--ac-s)}
        .cph-ms-at_risk .cph-ms-dot,.cph-ms-delayed .cph-ms-dot{background:var(--wr)}
        .cph-ms-body{flex:1;min-width:0}
        .cph-ms-title{font-family:var(--fd);font-size:13.5px;font-weight:680;color:var(--t1);letter-spacing:-.005em}
        .cph-ms-meta{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);margin-top:2px}

        .cph-activity{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
        .cph-act{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--s2)}
        .cph-act:last-child{border-bottom:none}
        .cph-act-tag{font-family:var(--fd);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3);padding:3px 8px;background:var(--s2);border-radius:var(--r-s);white-space:nowrap}
        .cph-act-body{flex:1;min-width:0}
        .cph-act-title{font-family:var(--fd);font-size:13.5px;font-weight:680;color:var(--t1)}
        .cph-act-meta{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);margin-top:2px}

        .cph-up{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
        .cph-up li{padding:8px 0;border-bottom:1px solid var(--s2)}
        .cph-up li:last-child{border-bottom:none}
        .cph-up-title{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1)}
        .cph-up-date{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:2px}

        .cph-bs{display:flex;flex-direction:column;gap:8px}
        .cph-bs-row{display:flex;justify-content:space-between;align-items:center;font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2)}
        .cph-bs-v{font-family:var(--fd);font-weight:720;color:var(--t1);font-size:13px}
        .cph-bs-v.warn{color:var(--wr-t)}
        .cph-bs-tot{padding-top:8px;border-top:1px solid var(--s2)}
        .cph-bs-sub{font-size:12px}
        .cph-bar{height:8px;background:var(--s2);border-radius:999px;overflow:hidden;margin:6px 0 2px}
        .cph-bar-fill{height:100%;background:var(--ok);border-radius:999px}

        .cph-links{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
        .cph-links li a{display:block;padding:10px 4px;font-family:var(--fd);font-size:13px;font-weight:620;color:var(--ac-t);text-decoration:none;border-bottom:1px solid var(--s2)}
        .cph-links li:last-child a{border-bottom:none}
        .cph-links li a:hover{color:var(--ac)}
      `}</style>
    </div>
  );
}
