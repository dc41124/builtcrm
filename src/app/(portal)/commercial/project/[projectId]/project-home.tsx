"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type {
  ClientActivityEvent,
  ClientProjectView,
  ConversationRow,
  SubProjectGcContact,
} from "@/domain/loaders/project-home";

type Props = {
  projectId: string;
  projectName: string;
  contractorName: string;
  currentPhase: string;
  milestones: ClientProjectView["milestones"];
  approvals: ClientProjectView["approvals"];
  openRequests: ClientProjectView["openRequests"];
  drawRequests: ClientProjectView["drawRequests"];
  decisions: ClientProjectView["decisions"];
  activityTrail: ClientActivityEvent[];
  gcContacts: SubProjectGcContact[];
  conversations: ConversationRow[];
};

const PHASE_LABELS: Record<string, { label: string; short: string }> = {
  preconstruction: { label: "Preconstruction", short: "Precon" },
  phase_1: { label: "Phase 1", short: "Foundations" },
  phase_2: { label: "Phase 2", short: "Structural" },
  phase_3: { label: "Phase 3", short: "Interior rough-in" },
  closeout: { label: "Closeout", short: "Finishes" },
};

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtLongDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PAID = new Set(["paid"]);
const PENDING = new Set(["submitted", "under_review", "returned", "revised"]);

const GC_PALETTE = ["#5b4fc7", "#3d6b8e", "var(--ac)", "var(--wr)", "var(--ok)", "var(--in)"];

export function CommercialProjectHome({
  projectId,
  projectName,
  contractorName,
  currentPhase,
  milestones,
  approvals,
  openRequests,
  drawRequests,
  decisions,
  activityTrail,
  gcContacts,
  conversations,
}: Props) {
  const base = `/commercial/project/${projectId}`;
  const [now] = useState(() => Date.now());

  const latestDraw = useMemo(
    () => drawRequests.reduce<(typeof drawRequests)[number] | null>((a, d) => (a && a.drawNumber > d.drawNumber ? a : d), null),
    [drawRequests],
  );

  const contractSum = latestDraw?.contractSumToDateCents ?? 0;
  const originalSum = latestDraw?.originalContractSumCents ?? 0;
  const netCOs = latestDraw?.netChangeOrdersCents ?? 0;
  const paidToDate = drawRequests.filter((d) => d.paidAt).reduce((s, d) => s + d.currentPaymentDueCents, 0);
  const pendingPayment = drawRequests.filter((d) => PENDING.has(d.drawRequestStatus)).reduce((s, d) => s + d.currentPaymentDueCents, 0);
  const pctPaid = contractSum > 0 ? Math.round((paidToDate / contractSum) * 100) : 0;
  const retainageHeld = Math.max(0, (latestDraw?.totalRetainageCents ?? 0) - (latestDraw?.retainageReleasedCents ?? 0));
  const remaining = Math.max(0, contractSum - paidToDate - pendingPayment - retainageHeld);

  const pendingApprovals = approvals.filter((a) => a.approvalStatus === "pending_review");
  const pendingCOs = decisions.filter((c) => c.changeOrderStatus === "pending_client_approval");
  const totalCOImpact = approvals.filter((a) => a.category === "change_order" || a.category === "scope_change").reduce((s, a) => s + Math.abs(a.impactCostCents), 0);

  const upcomingMilestones = useMemo(
    () => milestones.filter((m) => m.milestoneStatus !== "completed" && m.milestoneStatus !== "cancelled").sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()).slice(0, 3),
    [milestones],
  );
  const nextMilestone = upcomingMilestones[0];
  const latestPaidDraw = drawRequests.filter((d) => d.paidAt).sort((a, b) => b.drawNumber - a.drawNumber)[0] ?? null;

  const unreadThreads = conversations.filter((c) => c.unreadCount > 0).length;
  const phaseInfo = PHASE_LABELS[currentPhase] ?? { label: currentPhase, short: "" };

  const pendingDrawCount = drawRequests.filter((d) => PENDING.has(d.drawRequestStatus)).length;
  const pctBilled = contractSum > 0 ? ((paidToDate + pendingPayment) / contractSum * 100).toFixed(1) : "0";

  return (
    <div className="cph">

      {/* ═══ HERO ═══ */}
      <section className="cph-hero">
        <div className="cph-hero-main">
          <h1 className="cph-h1">{projectName}</h1>
          <div className="cph-topline">
            <span className="cph-pl blue">Active project</span>
            {pendingApprovals.length > 0 ? (
              <span className="cph-pl amber">{pendingApprovals.length} {pendingApprovals.length === 1 ? "item" : "items"} awaiting review</span>
            ) : null}
            <span className="cph-pl green">On schedule</span>
          </div>
          <p className="cph-hero-desc">Your project dashboard — track construction progress, review approvals, and stay connected with the build team.</p>
          <div className="cph-hero-meta">
            <div className="cph-meta-chip"><strong>Contractor:</strong> {contractorName}</div>
            {gcContacts[0] ? <div className="cph-meta-chip"><strong>PM:</strong> {gcContacts[0].name}</div> : null}
            {nextMilestone ? <div className="cph-meta-chip"><strong>Next milestone:</strong> {fmtDate(nextMilestone.scheduledDate)}</div> : null}
            <div className="cph-meta-chip"><strong>Contract:</strong> {fmtCents(contractSum || originalSum)}</div>
          </div>
          <div className="cph-hero-acts">
            <Link className="cph-btn pri" href={`${base}/messages`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Message Team
            </Link>
            <Link className="cph-btn" href={`${base}/documents`}>View Documents</Link>
            <Link className="cph-btn" href={`${base}/schedule`}>View Schedule</Link>
          </div>

          <div className="cph-fin">
            <h3 className="cph-fin-title">Financial summary</h3>
            <div className="cph-fin-grid">
              <div className="cph-fin-row"><span>Original contract</span><span className="cph-fin-v">{fmtCents(originalSum)}</span></div>
              <div className="cph-fin-row"><span>Approved changes</span><span className="cph-fin-v warn">{netCOs > 0 ? "+" : ""}{fmtCents(netCOs)}</span></div>
              <div className="cph-fin-row tot"><span>Current contract value</span><span className="cph-fin-v big">{fmtCents(contractSum || originalSum)}</span></div>
              <div className="cph-fin-row"><span>Billed to date</span><span className="cph-fin-v">{fmtCents(paidToDate + pendingPayment)}</span></div>
              <div className="cph-fin-row"><span>Paid to date</span><span className="cph-fin-v ok">{fmtCents(paidToDate)}</span></div>
              <div className="cph-fin-row"><span>Retainage held</span><span className="cph-fin-v">{fmtCents(retainageHeld)}</span></div>
              <div className="cph-fin-row"><span>Remaining</span><span className="cph-fin-v">{fmtCents(remaining)}</span></div>
            </div>
          </div>
        </div>
        <div className="cph-hero-side">
            <h4>Project snapshot</h4>
            <div className="cph-snap alert">
              <div className="cph-sk">Awaiting your review</div>
              <div className="cph-sv">{pendingApprovals.length} {pendingApprovals.length === 1 ? "item" : "items"}</div>
              <div className="cph-sm">{pendingApprovals.slice(0, 2).map((a) => a.title).join(" + ") || "Nothing pending"}</div>
            </div>
            <div className="cph-snap">
              <div className="cph-sk">Next milestone</div>
              <div className="cph-sv">{nextMilestone ? fmtDate(nextMilestone.scheduledDate) : "—"}</div>
              <div className="cph-sm">{nextMilestone?.title ?? "Nothing scheduled"}</div>
            </div>
            <div className="cph-snap">
              <div className="cph-sk">Latest payment</div>
              <div className="cph-sv">{latestPaidDraw ? fmtCents(latestPaidDraw.currentPaymentDueCents) : "—"}</div>
              <div className="cph-sm">{latestPaidDraw ? `Draw #${latestPaidDraw.drawNumber} · Paid ${fmtDate(latestPaidDraw.paidAt!)}` : "No payments yet"}</div>
            </div>
            <div className="cph-snap">
              <div className="cph-sk">Unread messages</div>
              <div className="cph-sv">{unreadThreads} {unreadThreads === 1 ? "thread" : "threads"}</div>
              <div className="cph-sm">{unreadThreads > 0 ? "New messages from your team" : "You're caught up"}</div>
            </div>
          </div>
      </section>

      {/* ═══ CONTACTS STRIP ═══ */}
      <section className="cph-contacts">
        <div className="cph-contacts-label">Your project team</div>
        <div className="cph-contacts-list">
          {gcContacts.length === 0 ? (
            <div className="cph-contacts-empty">Team contacts will appear here once added.</div>
          ) : (
            gcContacts.map((c, i) => (
              <div key={c.id} className="cph-cc">
                <div className="cph-cc-av" style={{ background: GC_PALETTE[i % GC_PALETTE.length] }}>{c.initials}</div>
                <span className="cph-cc-name">{c.name}</span>
                <span className="cph-cc-role">{c.roleLabel}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ═══ KPI STRIP ═══ */}
      <section className="cph-kpis">
        <div className="cph-kpi">
          <div className="cph-kpi-l">Current phase</div>
          <div className="cph-kpi-v">{phaseInfo.label}</div>
          <div className="cph-kpi-m">{phaseInfo.short}</div>
          <div className="cph-prog"><div className="cph-prog-fill" style={{ width: "65%" }} /></div>
        </div>
        <div className="cph-kpi accent">
          <div className="cph-kpi-l">Pending approvals</div>
          <div className="cph-kpi-v">{pendingApprovals.length}</div>
          <div className="cph-kpi-m">
            {pendingCOs.length > 0 ? `${pendingCOs.length} CO` : ""}
            {pendingCOs.length > 0 && pendingDrawCount > 0 ? " · " : ""}
            {pendingDrawCount > 0 ? `${pendingDrawCount} draw request` : ""}
            {pendingApprovals.length === 0 ? "You're all caught up" : ""}
          </div>
        </div>
        <div className="cph-kpi warn">
          <div className="cph-kpi-l">Open change orders</div>
          <div className="cph-kpi-v">{pendingCOs.length + decisions.filter((d) => d.changeOrderStatus === "approved").length}</div>
          <div className="cph-kpi-m">{totalCOImpact > 0 ? `${fmtCents(totalCOImpact)} total impact` : "No financial impact"}</div>
        </div>
        <div className="cph-kpi">
          <div className="cph-kpi-l">Billing progress</div>
          <div className="cph-kpi-v">{fmtCents(paidToDate + pendingPayment)}</div>
          <div className="cph-kpi-m">of {fmtCents(contractSum || originalSum)} · {pctBilled}% billed</div>
          <div className="cph-prog"><div className="cph-prog-fill" style={{ width: `${pctBilled}%` }} /></div>
        </div>
      </section>

      {/* ═══ MAIN GRID ═══ */}
      <section className="cph-grid">
        <div className="cph-main">
          {/* Awaiting your review */}
          <div className="cph-card">
            <div className="cph-c-head">
              <div>
                <div className="cph-c-title">Awaiting your review</div>
                <div className="cph-c-sub">Items that need your decision</div>
              </div>
              {pendingApprovals.length > 0 ? <span className="cph-pl amber">{pendingApprovals.length} pending</span> : null}
            </div>
            <div className="cph-c-body">
              {pendingApprovals.length === 0 ? (
                <div className="cph-empty">No items awaiting your review right now.</div>
              ) : (
                pendingApprovals.map((a) => (
                  <div key={a.id} className="cph-act-row">
                    <div className="cph-act-info">
                      <div className="cph-act-label">
                        {a.category === "change_order" ? `CO-${String(a.approvalNumber).padStart(3, "0")}` : `#${a.approvalNumber}`} — {a.title}
                      </div>
                      <div className="cph-act-detail">
                        {a.impactCostCents !== 0 ? `${a.impactCostCents > 0 ? "+" : ""}${fmtCents(a.impactCostCents)}` : "No cost impact"}
                        {a.submittedAt ? ` · Submitted ${fmtDate(a.submittedAt)}` : ""}
                        {a.impactScheduleDays !== 0 ? ` · ${a.impactScheduleDays > 0 ? "+" : ""}${a.impactScheduleDays}d schedule` : ""}
                      </div>
                    </div>
                    <Link href={`${base}/approvals`} className="cph-btn pri" style={{ height: 30, fontSize: 12 }}>Review</Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent activity */}
          <div className="cph-card">
            <div className="cph-c-head">
              <div>
                <div className="cph-c-title">Recent activity</div>
                <div className="cph-c-sub">Latest updates from your project</div>
              </div>
              <Link href={`${base}/progress`} className="cph-btn ghost" style={{ fontSize: 12 }}>View all →</Link>
            </div>
            <div className="cph-c-body">
              {activityTrail.length === 0 ? (
                <div className="cph-empty">Updates from your contractor will appear here.</div>
              ) : (
                activityTrail.slice(0, 5).map((a) => {
                  const diffMs = Math.max(0, now - a.createdAt.getTime());
                  const hrs = Math.round(diffMs / 3600000);
                  const timeLabel = hrs < 1 ? "Just now" : hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
                  return (
                    <div key={a.id} className="cph-ai">
                      <div className="cph-ai-icon blue">
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="2"/></svg>
                      </div>
                      <div className="cph-ai-text">
                        <div className="cph-ai-title"><strong>{a.actorName ?? contractorName}</strong> — {a.title}</div>
                        <div className="cph-ai-desc">{a.body?.slice(0, 140) ?? ""}</div>
                      </div>
                      <div className="cph-ai-time">{timeLabel}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <div className="cph-rail">
          {/* Quick access */}
          <div className="cph-card">
            <div className="cph-c-head"><div className="cph-c-title">Quick access</div></div>
            <div className="cph-c-body">
              <div className="cph-ql">
                <Link href={`${base}/progress`} className="cph-ql-link">
                  <div className="cph-ql-icon" style={{ background: "var(--ac-s)", color: "var(--ac-t)" }}>
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div className="cph-ql-text"><h5>Progress &amp; Updates</h5><p>Weekly reports and phase tracking</p></div>
                </Link>
                <Link href={`${base}/photos`} className="cph-ql-link">
                  <div className="cph-ql-icon" style={{ background: "var(--ok-s)", color: "var(--ok-t)" }}>
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="m21 15-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div className="cph-ql-text"><h5>Photos</h5><p>Progress documentation</p></div>
                </Link>
                <Link href={`${base}/documents`} className="cph-ql-link">
                  <div className="cph-ql-icon" style={{ background: "var(--wr-s)", color: "var(--wr-t)" }}>
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                  <div className="cph-ql-text"><h5>Project Files</h5><p>Shared documents</p></div>
                </Link>
                <Link href={`${base}/schedule`} className="cph-ql-link">
                  <div className="cph-ql-icon" style={{ background: "#eeedfb", color: "#4a3fb0" }}>
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                  <div className="cph-ql-text"><h5>Schedule</h5><p>Milestones and timeline</p></div>
                </Link>
              </div>
            </div>
          </div>

          {/* Upcoming milestones */}
          <div className="cph-card">
            <div className="cph-c-head"><div><div className="cph-c-title">Upcoming milestones</div><div className="cph-c-sub">Next 30 days</div></div></div>
            <div className="cph-c-body">
              {upcomingMilestones.length === 0 ? (
                <div className="cph-empty">No upcoming milestones.</div>
              ) : (
                <div className="cph-ms-list">
                  {upcomingMilestones.map((m) => {
                    const d = new Date(m.scheduledDate);
                    const day = d.getUTCDate();
                    const month = MONTH_SHORT[d.getUTCMonth()];
                    const days = Math.max(0, Math.round((d.getTime() - now) / 86400000));
                    const soon = days <= 7;
                    return (
                      <div key={m.id} className="cph-ms-row">
                        <div className="cph-ms-date">
                          <div className="cph-ms-day">{day}</div>
                          <div className="cph-ms-month">{month}</div>
                        </div>
                        <div className="cph-ms-info">
                          <div className="cph-ms-title">{m.title}</div>
                          <div className="cph-ms-sub">In {days} days</div>
                        </div>
                        <span className={`cph-pl ${soon ? "amber" : "gray"}`}>{soon ? "Upcoming" : "Scheduled"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      
    </div>
  );
}
