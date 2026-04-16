"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type {
  ClientActivityEvent,
  ClientProjectView,
  ConversationRow,
  SelectionCategoryRow,
  SubProjectGcContact,
} from "@/domain/loaders/project-home";

type Props = {
  projectId: string;
  projectName: string;
  contractorName: string;
  currentPhase: string;
  milestones: ClientProjectView["milestones"];
  approvals: ClientProjectView["approvals"];
  decisions: ClientProjectView["decisions"];
  selections: SelectionCategoryRow[];
  drawRequests: ClientProjectView["drawRequests"];
  activityTrail: ClientActivityEvent[];
  gcContacts: SubProjectGcContact[];
  conversations: ConversationRow[];
};

const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PHASE_LABELS: Record<string, { label: string; num: string }> = {
  preconstruction: { label: "Demo", num: "1 of 6" },
  phase_1: { label: "Framing", num: "2 of 6" },
  phase_2: { label: "Rough-in", num: "3 of 6" },
  phase_3: { label: "Interior finishes", num: "4 of 6" },
  closeout: { label: "Final details", num: "5 of 6" },
};
const PAID = new Set(["paid"]);
const PENDING = new Set(["submitted", "under_review"]);
const GC_PALETTE = ["#5b4fc7", "#3d6b8e", "var(--ac)", "var(--wr)", "var(--ok)", "var(--in)"];

function fmtCents(c: number): string {
  return (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtShort(c: number): string {
  const abs = Math.abs(c);
  if (abs >= 100_000_00) return `$${Math.round(abs / 100_000)}K`;
  return fmtCents(c);
}
function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ResidentialProjectHome({
  projectId,
  projectName,
  contractorName,
  currentPhase,
  milestones,
  approvals,
  decisions,
  selections,
  drawRequests,
  activityTrail,
  gcContacts,
  conversations,
}: Props) {
  const base = `/residential/project/${projectId}`;
  const [now] = useState(() => Date.now());

  // Rollups
  const latest = drawRequests.reduce<(typeof drawRequests)[number] | null>((a, d) => (a && a.drawNumber > d.drawNumber ? a : d), null);
  const contractCents = latest?.contractSumToDateCents ?? 0;
  const originalCents = latest?.originalContractSumCents ?? 0;
  const netCO = (latest?.netChangeOrdersCents ?? 0);
  const paidCents = drawRequests.filter((d) => d.paidAt).reduce((s, d) => s + d.currentPaymentDueCents, 0);
  const pendingDraw = drawRequests.find((d) => PENDING.has(d.drawRequestStatus)) ?? null;
  const nextPayCents = pendingDraw?.currentPaymentDueCents ?? 0;
  const remainCents = Math.max(0, (contractCents || originalCents) - paidCents - nextPayCents);
  const pctPaid = contractCents > 0 ? Math.round((paidCents / contractCents) * 100) : 0;
  const pctNext = contractCents > 0 ? Math.round((nextPayCents / contractCents) * 100) : 0;

  const pendingApprovals = approvals.filter((a) => a.approvalStatus === "pending_review");
  const pendingScopeChanges = decisions.filter((d) => d.changeOrderStatus === "pending_client_approval");
  const scopeImpact = approvals.filter((a) => (a.category === "change_order" || a.category === "scope_change") && a.approvalStatus === "pending_review").reduce((s, a) => s + Math.abs(a.impactCostCents), 0);

  // Selections
  const allItems = selections.flatMap((c) => c.items);
  const pendingSelections = allItems.filter((i) => i.selectionItemStatus === "exploring" || i.selectionItemStatus === "provisional" || i.selectionItemStatus === "not_started" || i.selectionItemStatus === "revision_open");
  const confirmedSelections = allItems.filter((i) => i.selectionItemStatus === "confirmed" || i.selectionItemStatus === "locked");

  // Milestones
  const upcomingMs = useMemo(
    () => milestones.filter((m) => m.milestoneStatus !== "completed" && m.milestoneStatus !== "cancelled").sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()).slice(0, 3),
    [milestones],
  );
  const nextMs = upcomingMs[0];
  const unreadThreads = conversations.filter((c) => c.unreadCount > 0).length;
  const phaseInfo = PHASE_LABELS[currentPhase] ?? { label: currentPhase, num: "" };

  // Action items for "Things that need you"
  const actionItems = useMemo(() => {
    const items: Array<{ id: string; label: string; detail: string; href: string; primary: boolean }> = [];
    for (const s of pendingSelections.slice(0, 3)) {
      items.push({
        id: `sel-${s.id}`,
        label: `Choose ${s.title.toLowerCase()}`,
        detail: s.options.length > 0 ? `${s.options.length} options available` : "Options pending",
        href: `${base}/selections`,
        primary: true,
      });
    }
    for (const sc of pendingScopeChanges.slice(0, 2)) {
      items.push({
        id: `sc-${sc.id}`,
        label: `Review: ${sc.title}`,
        detail: `Scope change · awaiting your decision`,
        href: `${base}/scope-changes`,
        primary: false,
      });
    }
    return items;
  }, [pendingSelections, pendingScopeChanges, base]);

  const pmContact = gcContacts[0];

  return (
    <div className="rph">
      {/* ═══ HERO ═══ */}
      <section className="rph-hero">
        <div className="rph-hero-main">
          <h1 className="rph-h1">{projectName}</h1>
          <div className="rph-topline">
            <span className="rph-pl teal">Your home build</span>
            {pendingSelections.length > 0 ? <span className="rph-pl amber">{pendingSelections.length} selections to choose</span> : null}
            <span className="rph-pl green">On schedule</span>
          </div>
          <p className="rph-hero-desc">Welcome to your project dashboard — see how things are coming along, make selections for your finishes, and stay in touch with your build team.</p>
          <div className="rph-hero-meta">
            <div className="rph-meta-chip"><strong>Builder:</strong> {contractorName}</div>
            {pmContact ? <div className="rph-meta-chip"><strong>Your PM:</strong> {pmContact.name}</div> : null}
            {nextMs ? <div className="rph-meta-chip"><strong>Next milestone:</strong> {fmtDate(nextMs.scheduledDate)}</div> : null}
          </div>
          <div className="rph-hero-acts">
            <Link className="rph-btn pri" href={`${base}/messages`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
              Message {pmContact?.name.split(" ")[0] ?? "Team"}
            </Link>
            <Link className="rph-btn" href={`${base}/progress`}>View Photos</Link>
            <Link className="rph-btn" href={`${base}/selections`}>Browse Selections</Link>
          </div>
        </div>
        <div className="rph-hero-side">
          <h4>At a glance</h4>
          <div className="rph-snap highlight">
            <div className="rph-sk">Selections waiting</div>
            <div className="rph-sv">{pendingSelections.length} choices</div>
            <div className="rph-sm">{pendingSelections.slice(0, 3).map((s) => s.title).join(" · ") || "All caught up"}</div>
          </div>
          {pendingScopeChanges.length > 0 ? (
            <div className="rph-snap alert">
              <div className="rph-sk">Scope change to review</div>
              <div className="rph-sv">{pendingScopeChanges.length} {pendingScopeChanges.length === 1 ? "item" : "items"}</div>
              <div className="rph-sm">{pendingScopeChanges[0]?.title ?? ""}{scopeImpact > 0 ? ` — +${fmtCents(scopeImpact)}` : ""}</div>
            </div>
          ) : null}
          <div className="rph-snap">
            <div className="rph-sk">Next milestone</div>
            <div className="rph-sv">{nextMs ? fmtDate(nextMs.scheduledDate) : "—"}</div>
            <div className="rph-sm">{nextMs?.title ?? "Nothing scheduled"}</div>
          </div>
          <div className="rph-snap">
            <div className="rph-sk">Latest update</div>
            <div className="rph-sv">{activityTrail[0] ? fmtDate(activityTrail[0].createdAt) : "—"}</div>
            <div className="rph-sm">{activityTrail[0]?.title ?? "No recent updates"}</div>
          </div>
        </div>
      </section>

      {/* ═══ TOP CARDS: Budget + Milestones ═══ */}
      <section className="rph-top-cards">
        <div className="rph-card">
          <div className="rph-c-head"><div className="rph-c-title">Budget overview</div></div>
          <div className="rph-c-body">
            <div className="rph-budget-top">
              <span className="rph-budget-lbl">Total budget</span>
              <span className="rph-budget-big">{fmtCents(contractCents || originalCents)}</span>
            </div>
            <div className="rph-budget-bar">
              {pctPaid > 0 ? <div className="rph-bb-paid" style={{ width: `${pctPaid}%` }} /> : null}
              {pctNext > 0 ? <div className="rph-bb-next" style={{ width: `${pctNext}%` }} /> : null}
            </div>
            <div className="rph-budget-leg">
              <span className="rph-budget-leg-i"><span className="rph-budget-dot" style={{ background: "var(--ac)" }} />Paid {fmtCents(paidCents)}</span>
              {nextPayCents > 0 ? <span className="rph-budget-leg-i"><span className="rph-budget-dot" style={{ background: "var(--wr)", opacity: 0.7 }} />Next draw {fmtCents(nextPayCents)}</span> : null}
            </div>
            <div className="rph-budget-rows">
              <div className="rph-budget-row"><span>Paid to date</span><span className="rph-budget-v ok">{fmtCents(paidCents)}</span></div>
              <div className="rph-budget-row"><span>Approved changes</span><span className="rph-budget-v warn">{netCO > 0 ? "+" : ""}{fmtCents(netCO)}</span></div>
              <div className="rph-budget-row"><span>Remaining</span><span className="rph-budget-v">{fmtCents(remainCents)}</span></div>
            </div>
          </div>
        </div>

        <div className="rph-card">
          <div className="rph-c-head"><div><div className="rph-c-title">Coming up</div><div className="rph-c-sub">Next milestones for your home</div></div></div>
          <div className="rph-c-body">
            {upcomingMs.length === 0 ? (
              <div className="rph-empty">No upcoming milestones.</div>
            ) : (
              <div className="rph-ms-list">
                {upcomingMs.map((m) => {
                  const d = new Date(m.scheduledDate);
                  const day = d.getUTCDate();
                  const month = MONTH_SHORT[d.getUTCMonth()];
                  const days = Math.max(0, Math.round((d.getTime() - now) / 86400000));
                  const soon = days <= 7;
                  return (
                    <div key={m.id} className="rph-ms-row">
                      <div className="rph-ms-date"><div className="rph-ms-day">{day}</div><div className="rph-ms-month">{month}</div></div>
                      <div className="rph-ms-info"><div className="rph-ms-title">{m.title}</div><div className="rph-ms-sub">In {days} days</div></div>
                      <span className={`rph-pl ${soon ? "amber" : "gray"}`}>{soon ? "Upcoming" : "Scheduled"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ CONTACTS STRIP ═══ */}
      <section className="rph-contacts">
        <div className="rph-contacts-label">Your build team</div>
        <div className="rph-contacts-list">
          {gcContacts.length === 0 ? (
            <div className="rph-empty-inline">Team contacts appear here once added.</div>
          ) : (
            gcContacts.map((c, i) => (
              <div key={c.id} className="rph-cc">
                <div className="rph-cc-av" style={{ background: GC_PALETTE[i % GC_PALETTE.length] }}>{c.initials}</div>
                <span className="rph-cc-name">{c.name}</span>
                <span className="rph-cc-role">{c.roleLabel}</span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ═══ KPI STRIP ═══ */}
      <section className="rph-kpis">
        <div className="rph-kpi">
          <div className="rph-kpi-l">Current phase</div>
          <div className="rph-kpi-v">{phaseInfo.label}</div>
          <div className="rph-kpi-m">Phase {phaseInfo.num}</div>
          <div className="rph-prog"><div className="rph-prog-fill" style={{ width: "60%" }} /></div>
        </div>
        <div className="rph-kpi accent">
          <div className="rph-kpi-l">Selections to make</div>
          <div className="rph-kpi-v">{pendingSelections.length}</div>
          <div className="rph-kpi-m">{pendingSelections.length > 0 ? "Choices waiting for you" : "All caught up"}</div>
        </div>
        <div className="rph-kpi warn">
          <div className="rph-kpi-l">Open scope changes</div>
          <div className="rph-kpi-v">{pendingScopeChanges.length}</div>
          <div className="rph-kpi-m">{scopeImpact > 0 ? `${fmtCents(scopeImpact)} impact` : "No impact"}</div>
        </div>
        <div className="rph-kpi">
          <div className="rph-kpi-l">Budget spent</div>
          <div className="rph-kpi-v">{fmtShort(paidCents)}</div>
          <div className="rph-kpi-m">of {fmtShort(contractCents || originalCents)} total · {pctPaid}% paid</div>
          <div className="rph-prog"><div className="rph-prog-fill" style={{ width: `${pctPaid}%` }} /></div>
        </div>
      </section>

      {/* ═══ MAIN GRID ═══ */}
      <section className="rph-grid">
        <div className="rph-main">
          {/* Things that need you */}
          <div className="rph-card">
            <div className="rph-c-head">
              <div><div className="rph-c-title">Things that need you</div><div className="rph-c-sub">Selections and decisions waiting for your input</div></div>
              {actionItems.length > 0 ? <span className="rph-pl amber">{actionItems.length} items</span> : null}
            </div>
            <div className="rph-c-body">
              {actionItems.length === 0 ? (
                <div className="rph-empty">Nothing needs your attention right now.</div>
              ) : (
                actionItems.map((a) => (
                  <div key={a.id} className="rph-act-row">
                    <div className="rph-act-info">
                      <div className="rph-act-label">{a.label}</div>
                      <div className="rph-act-detail">{a.detail}</div>
                    </div>
                    <Link href={a.href} className={`rph-btn ${a.primary ? "pri" : ""}`} style={{ height: 30, fontSize: 12 }}>
                      {a.primary ? "Choose" : "Review"}
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* What's been happening */}
          <div className="rph-card">
            <div className="rph-c-head">
              <div><div className="rph-c-title">What&apos;s been happening</div><div className="rph-c-sub">Recent updates from your build team</div></div>
              <Link href={`${base}/progress`} className="rph-btn ghost" style={{ fontSize: 12 }}>View all →</Link>
            </div>
            <div className="rph-c-body">
              {activityTrail.length === 0 ? (
                <div className="rph-empty">Updates from {contractorName} will appear here.</div>
              ) : (
                activityTrail.slice(0, 5).map((a) => {
                  const hrs = Math.round(Math.max(0, now - a.createdAt.getTime()) / 3600000);
                  const timeLabel = hrs < 1 ? "Today" : hrs < 24 ? `${hrs}h ago` : hrs < 168 ? `${Math.round(hrs / 24)}d ago` : `${Math.round(hrs / 168)}w ago`;
                  const iconClass = a.activityType.includes("milestone") || a.relatedObjectType === "milestone" ? "green" : a.activityType.includes("message") || a.relatedObjectType === "conversation" ? "blue" : a.activityType.includes("approval") || a.relatedObjectType === "change_order" ? "amber" : "teal";
                  return (
                    <div key={a.id} className="rph-ai">
                      <div className={`rph-ai-icon ${iconClass}`}>
                        <svg viewBox="0 0 24 24" fill="none" width="14" height="14"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/><path d="M14 2v6h6" stroke="currentColor" strokeWidth="2"/></svg>
                      </div>
                      <div className="rph-ai-text">
                        <div className="rph-ai-title"><strong>{a.actorName ?? contractorName}</strong> — {a.title}</div>
                        <div className="rph-ai-desc">{a.body?.slice(0, 140) ?? ""}</div>
                      </div>
                      <div className="rph-ai-time">{timeLabel}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT RAIL */}
        <div className="rph-rail">
          {/* Selections */}
          <div className="rph-card">
            <div className="rph-c-head">
              <div><div className="rph-c-title">Your selections</div><div className="rph-c-sub">Finishes and fixtures for your home</div></div>
              <Link href={`${base}/selections`} className="rph-btn ghost" style={{ fontSize: 12 }}>See all →</Link>
            </div>
            <div className="rph-c-body">
              {allItems.length === 0 ? (
                <div className="rph-empty">No selection items published yet.</div>
              ) : (
                <div className="rph-sel-grid">
                  {pendingSelections.slice(0, 3).map((s) => (
                    <div key={s.id} className="rph-sel-row">
                      <div className="rph-sel-swatch amber">
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="2"/></svg>
                      </div>
                      <div className="rph-sel-info"><h5>{s.title}</h5><p>{s.options.length} options available</p></div>
                      <span className="rph-pl amber" style={{ fontSize: 10 }}>Choose</span>
                    </div>
                  ))}
                  {confirmedSelections.slice(0, 2).map((s) => (
                    <div key={s.id} className="rph-sel-row done">
                      <div className="rph-sel-swatch green">
                        <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M22 4 12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                      <div className="rph-sel-info"><h5>{s.title}</h5><p>Confirmed{s.currentDecision ? ` · ${s.options.find((o) => o.id === s.currentDecision!.selectedOptionId)?.name ?? ""}` : ""}</p></div>
                      <span className="rph-pl green" style={{ fontSize: 10 }}>Done</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick access */}
          <div className="rph-card">
            <div className="rph-c-head"><div className="rph-c-title">Quick access</div></div>
            <div className="rph-c-body">
              <div className="rph-ql">
                <Link href={`${base}/progress`} className="rph-ql-link">
                  <div className="rph-ql-icon" style={{ background: "var(--ac-s)", color: "var(--ac-t)" }}>
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="m21 15-5-5L5 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                  <div className="rph-ql-text"><h5>Progress &amp; Photos</h5><p>Latest updates and photos</p></div>
                </Link>
                <Link href={`${base}/documents`} className="rph-ql-link">
                  <div className="rph-ql-icon" style={{ background: "var(--wr-s)", color: "var(--wr-t)" }}>
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" strokeWidth="2"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                  <div className="rph-ql-text"><h5>Documents</h5><p>Files shared with you</p></div>
                </Link>
                <Link href={`${base}/schedule`} className="rph-ql-link">
                  <div className="rph-ql-icon" style={{ background: "#eeedfb", color: "#4a3fb0" }}>
                    <svg viewBox="0 0 24 24" fill="none" width="15" height="15"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                  <div className="rph-ql-text"><h5>Schedule</h5><p>Milestones and timeline</p></div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      
    </div>
  );
}
