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
  decisions: ClientProjectView["decisions"];
  selections: ClientProjectView["selections"];
  drawRequests: ClientProjectView["drawRequests"];
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
  });
}

const MS_PILL: Record<string, { color: PillColor; label: string }> = {
  completed: { color: "green", label: "Done" },
  in_progress: { color: "blue", label: "Happening now" },
  at_risk: { color: "amber", label: "Keep an eye on" },
  delayed: { color: "red", label: "Running late" },
  scheduled: { color: "gray", label: "Coming up" },
  not_started: { color: "gray", label: "Coming up" },
};

export function ResidentialProjectHome({
  projectName,
  milestones,
  approvals,
  decisions,
  selections,
  drawRequests,
}: Props) {
  const totalMs = milestones.length;
  const completedMs = milestones.filter(
    (m) => m.milestoneStatus === "completed",
  ).length;
  const progressPct = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;

  const latestDraw = drawRequests.reduce<ClientProjectView["drawRequests"][number] | null>(
    (acc, d) => (acc && acc.drawNumber > d.drawNumber ? acc : d),
    null,
  );
  const contractSum = latestDraw?.contractSumToDateCents ?? 0;
  const originalSum = latestDraw?.originalContractSumCents ?? 0;
  const paidToDate =
    drawRequests
      .filter((d) => d.paidAt)
      .reduce((s, d) => s + d.currentPaymentDueCents, 0) || 0;
  const budgetBase = contractSum || originalSum;
  const paidPct = budgetBase > 0 ? Math.round((paidToDate / budgetBase) * 100) : 0;

  const needsDecisions = [
    ...approvals.filter((a) => a.approvalStatus === "pending_review"),
    ...decisions.filter((d) => d.changeOrderStatus === "pending_client_approval"),
  ];

  const allSelections = selections.flatMap((c) => c.items);
  const totalSelections = allSelections.length;
  const decidedSelections = allSelections.filter((i) =>
    ["confirmed", "locked", "provisional"].includes(i.selectionItemStatus),
  ).length;
  const openSelections = allSelections.filter(
    (i) =>
      i.selectionItemStatus === "not_started" ||
      i.selectionItemStatus === "exploring" ||
      i.selectionItemStatus === "revision_open",
  );
  const urgentSelection = openSelections
    .filter((i) => i.decisionDeadline)
    .sort(
      (a, b) =>
        new Date(a.decisionDeadline!).getTime() -
        new Date(b.decisionDeadline!).getTime(),
    )[0];

  const upcoming = [...milestones]
    .filter((m) => m.milestoneStatus !== "completed")
    .sort(
      (a, b) =>
        new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime(),
    )
    .slice(0, 4);

  const currentPhase = milestones.find(
    (m) => m.milestoneStatus === "in_progress",
  );

  return (
    <div className="rph">
      <header className="rph-head">
        <div className="rph-crumbs">{projectName}</div>
        <h1 className="rph-title">Welcome home</h1>
        <p className="rph-desc">
          Here&apos;s how your project is going. We&apos;ll let you know whenever
          something needs your attention — no need to chase anyone down.
        </p>
      </header>

      <Card>
        <div className="rph-hero">
          <div className="rph-hero-top">
            <div>
              <div className="rph-hero-label">Your build so far</div>
              <div className="rph-hero-value">{progressPct}% complete</div>
              <div className="rph-hero-meta">
                {currentPhase
                  ? `Currently: ${currentPhase.title}`
                  : completedMs === totalMs && totalMs > 0
                    ? "Every milestone is complete"
                    : "Getting started"}
              </div>
            </div>
            <div className="rph-hero-count">
              <span className="rph-hero-count-v">
                {completedMs}
                <span className="rph-hero-count-t">/{totalMs}</span>
              </span>
              <div className="rph-hero-count-l">Milestones done</div>
            </div>
          </div>
          <div className="rph-bar">
            <div className="rph-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </Card>

      <div className="rph-kpis">
        <KpiCard
          label="Needs your OK"
          value={needsDecisions.length.toString()}
          meta={
            needsDecisions.length === 0
              ? "Nothing to decide right now"
              : "Review when you're ready"
          }
          iconColor={needsDecisions.length > 0 ? "red" : "green"}
          alert={needsDecisions.length > 0}
        />
        <KpiCard
          label="Your selections"
          value={`${decidedSelections}/${totalSelections}`}
          meta={
            openSelections.length === 0
              ? "All picks are in"
              : `${openSelections.length} still to choose`
          }
          iconColor="blue"
        />
        <KpiCard
          label="Paid so far"
          value={fmtCents(paidToDate)}
          meta={`${paidPct}% of your budget`}
          iconColor="green"
        />
      </div>

      <div className="rph-grid">
        <div className="rph-main">
          {needsDecisions.length > 0 && (
            <Card
              title="Decisions waiting for you"
              subtitle="Take your time — these won't disappear."
              alert
            >
              <ul className="rph-dec">
                {needsDecisions.slice(0, 4).map((item) => {
                  const isApproval = "approvalNumber" in item;
                  return (
                    <li key={item.id} className="rph-dec-item">
                      <div className="rph-dec-body">
                        <div className="rph-dec-title">{item.title}</div>
                        <div className="rph-dec-meta">
                          {isApproval
                            ? "Something to review"
                            : "Scope change"}
                        </div>
                      </div>
                      <Link
                        className="rph-dec-link"
                        href={isApproval ? "decisions" : "scope-changes"}
                      >
                        Take a look →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          <Card
            title="What's happening next"
            subtitle="The next few things on the schedule"
          >
            {upcoming.length === 0 ? (
              <EmptyState
                title="Nothing on the horizon"
                description="We'll let you know when the next step is scheduled."
              />
            ) : (
              <ol className="rph-timeline">
                {upcoming.map((m) => {
                  const status = MS_PILL[m.milestoneStatus] ?? MS_PILL.scheduled;
                  return (
                    <li key={m.id} className={`rph-ms rph-ms-${m.milestoneStatus}`}>
                      <span className="rph-ms-dot" aria-hidden />
                      <div className="rph-ms-body">
                        <div className="rph-ms-title">{m.title}</div>
                        <div className="rph-ms-meta">
                          Around {fmtDate(m.scheduledDate)}
                        </div>
                      </div>
                      <Pill color={status.color}>{status.label}</Pill>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <aside className="rph-rail">
          <Card title="Your selections">
            {totalSelections === 0 ? (
              <p className="rph-p">
                Your builder will share selection choices with you here when
                it&apos;s time to pick finishes and fixtures.
              </p>
            ) : (
              <div className="rph-sel">
                <div className="rph-sel-count">
                  <span className="rph-sel-v">{decidedSelections}</span>
                  <span className="rph-sel-t">of {totalSelections} chosen</span>
                </div>
                <div className="rph-bar sm">
                  <div
                    className="rph-bar-fill"
                    style={{
                      width: `${
                        totalSelections > 0
                          ? (decidedSelections / totalSelections) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                {urgentSelection && (
                  <div className="rph-sel-urgent">
                    <div className="rph-sel-urgent-l">Next up</div>
                    <div className="rph-sel-urgent-t">{urgentSelection.title}</div>
                    {urgentSelection.decisionDeadline && (
                      <div className="rph-sel-urgent-m">
                        Needed by {fmtDate(urgentSelection.decisionDeadline)}
                      </div>
                    )}
                  </div>
                )}
                <Link href="selections" className="rph-sel-link">
                  See all selections →
                </Link>
              </div>
            )}
          </Card>

          <Card title="Budget overview">
            <div className="rph-bg">
              <div className="rph-bg-row">
                <span>Your budget</span>
                <span className="rph-bg-v">{fmtCents(budgetBase)}</span>
              </div>
              <div className="rph-bg-row">
                <span>Paid so far</span>
                <span className="rph-bg-v ok">{fmtCents(paidToDate)}</span>
              </div>
              <div className="rph-bar">
                <div
                  className="rph-bar-fill"
                  style={{ width: `${Math.min(paidPct, 100)}%` }}
                />
              </div>
              <p className="rph-bg-note">
                You&apos;re about {paidPct}% of the way through your budget.
                Every payment gets recorded here.
              </p>
            </div>
          </Card>

          <Card title="Jump to">
            <ul className="rph-links">
              <li>
                <Link href="decisions">Decisions →</Link>
              </li>
              <li>
                <Link href="scope-changes">Scope Changes →</Link>
              </li>
              <li>
                <Link href="selections">Your Selections →</Link>
              </li>
              <li>
                <Link href="schedule">Schedule →</Link>
              </li>
              <li>
                <Link href="messages">Messages →</Link>
              </li>
            </ul>
          </Card>
        </aside>
      </div>

      <style>{`
        .rph{display:flex;flex-direction:column;gap:20px}
        .rph-head{display:flex;flex-direction:column;gap:6px}
        .rph-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .rph-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .rph-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.55;max-width:720px;margin:0}

        .rph-hero{display:flex;flex-direction:column;gap:14px}
        .rph-hero-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .rph-hero-label{font-family:var(--fb);font-size:12px;font-weight:560;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .rph-hero-value{font-family:var(--fd);font-size:34px;font-weight:820;letter-spacing:-.035em;color:var(--t1);line-height:1.1;margin-top:4px}
        .rph-hero-meta{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin-top:4px}
        .rph-hero-count{text-align:right;flex-shrink:0}
        .rph-hero-count-v{font-family:var(--fd);font-size:28px;font-weight:820;color:var(--t1);letter-spacing:-.03em;line-height:1}
        .rph-hero-count-t{font-size:18px;font-weight:680;color:var(--t3)}
        .rph-hero-count-l{font-family:var(--fb);font-size:11.5px;font-weight:560;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-top:4px}

        .rph-bar{height:10px;background:var(--s2);border-radius:999px;overflow:hidden}
        .rph-bar.sm{height:8px}
        .rph-bar-fill{height:100%;background:var(--ac);border-radius:999px;transition:width var(--ds) var(--e)}

        .rph-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        @media(max-width:900px){.rph-kpis{grid-template-columns:1fr}}
        .rph-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.rph-grid{grid-template-columns:1fr}}
        .rph-main{display:flex;flex-direction:column;gap:16px;min-width:0}
        .rph-rail{display:flex;flex-direction:column;gap:14px}
        .rph-p{font-family:var(--fb);font-size:13px;color:var(--t2);margin:0;line-height:1.55}

        .rph-dec{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
        .rph-dec-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--wr-s);border:1px solid var(--wr-s);border-radius:var(--r-m)}
        .rph-dec-body{min-width:0;flex:1}
        .rph-dec-title{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);letter-spacing:-.005em}
        .rph-dec-meta{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}
        .rph-dec-link{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--ac-t);text-decoration:none;white-space:nowrap;flex-shrink:0}
        .rph-dec-link:hover{color:var(--ac)}

        .rph-timeline{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
        .rph-ms{display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid var(--s2)}
        .rph-ms:last-child{border-bottom:none}
        .rph-ms-dot{width:10px;height:10px;border-radius:50%;background:var(--s4);flex-shrink:0}
        .rph-ms-in_progress .rph-ms-dot{background:var(--ac);box-shadow:0 0 0 3px var(--ac-s)}
        .rph-ms-at_risk .rph-ms-dot,.rph-ms-delayed .rph-ms-dot{background:var(--wr)}
        .rph-ms-body{flex:1;min-width:0}
        .rph-ms-title{font-family:var(--fd);font-size:13.5px;font-weight:680;color:var(--t1);letter-spacing:-.005em}
        .rph-ms-meta{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);margin-top:2px}

        .rph-sel{display:flex;flex-direction:column;gap:10px}
        .rph-sel-count{display:flex;align-items:baseline;gap:8px}
        .rph-sel-v{font-family:var(--fd);font-size:28px;font-weight:820;color:var(--t1);letter-spacing:-.03em;line-height:1}
        .rph-sel-t{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3)}
        .rph-sel-urgent{padding:10px 12px;background:var(--s2);border-radius:var(--r-m);margin-top:4px}
        .rph-sel-urgent-l{font-family:var(--fb);font-size:10.5px;font-weight:680;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
        .rph-sel-urgent-t{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin-top:3px}
        .rph-sel-urgent-m{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2);margin-top:2px}
        .rph-sel-link{display:block;font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--ac-t);text-decoration:none;margin-top:4px}
        .rph-sel-link:hover{color:var(--ac)}

        .rph-bg{display:flex;flex-direction:column;gap:10px}
        .rph-bg-row{display:flex;justify-content:space-between;align-items:center;font-family:var(--fb);font-size:12.5px;font-weight:560;color:var(--t2)}
        .rph-bg-v{font-family:var(--fd);font-weight:740;color:var(--t1);font-size:14px}
        .rph-bg-v.ok{color:var(--ok-t)}
        .rph-bg-note{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

        .rph-links{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
        .rph-links li a{display:block;padding:10px 4px;font-family:var(--fd);font-size:13px;font-weight:620;color:var(--ac-t);text-decoration:none;border-bottom:1px solid var(--s2)}
        .rph-links li:last-child a{border-bottom:none}
        .rph-links li a:hover{color:var(--ac)}
      `}</style>
    </div>
  );
}
