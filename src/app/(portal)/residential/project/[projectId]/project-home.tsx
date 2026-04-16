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

      <style dangerouslySetInnerHTML={{ __html: rphCss }} />
    </div>
  );
}

const rphCss = `
.rph{display:flex;flex-direction:column;gap:20px}

.rph-hero{display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start}
.rph-hero-main{display:flex;flex-direction:column;gap:10px}
.rph-h1{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;line-height:1.15;color:var(--t1);margin:0}
.rph-topline{display:flex;gap:6px;flex-wrap:wrap}
.rph-hero-desc{font-family:var(--fb);font-size:13.5px;color:var(--t2);line-height:1.5;margin:0;max-width:580px}
.rph-hero-meta{display:flex;gap:12px;flex-wrap:wrap}
.rph-meta-chip{font-family:var(--fb);font-size:12px;color:var(--t2);background:var(--s2);padding:4px 10px;border-radius:var(--r-s);white-space:nowrap}
.rph-meta-chip strong{color:var(--t1);font-weight:620}
.rph-hero-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}

.rph-hero-side{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px;display:flex;flex-direction:column;gap:10px}
.rph-hero-side h4{font-family:var(--fd);font-size:13px;font-weight:720;color:var(--t1);margin:0 0 4px}
.rph-snap{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border-radius:var(--r-l);margin-bottom:8px;border:1px solid var(--s3);background:var(--s2)}
.rph-snap:last-child{margin-bottom:0}
.rph-snap.highlight{background:var(--ac-s);border-color:rgba(42,127,111,.15)}
.rph-snap.highlight .rph-sk{color:var(--ac-t)}
.rph-snap.highlight .rph-sv{color:var(--ac-t)}
.rph-snap.alert{background:var(--wr-s);border-color:rgba(193,122,26,.15)}
.rph-snap.alert .rph-sk{color:var(--wr-t)}
.rph-snap.alert .rph-sv{color:var(--wr-t)}
.rph-sk{font-family:var(--fb);font-size:11px;font-weight:620;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
.rph-sv{font-family:var(--fd);font-size:18px;font-weight:820;color:var(--t1);letter-spacing:-.02em;margin-top:2px}
.rph-sm{font-family:var(--fb);font-size:11.5px;color:var(--t3)}

.rph-top-cards{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.rph-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden}
.rph-c-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--s3);gap:12px}
.rph-c-title{font-family:var(--fd);font-size:15px;font-weight:680;letter-spacing:-.01em;color:var(--t1)}
.rph-c-sub{font-family:var(--fb);font-size:12.5px;color:var(--t3);margin-top:2px}
.rph-c-body{padding:16px 20px}

.rph-budget-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}
.rph-budget-lbl{font-family:var(--fb);font-size:13px;color:var(--t2)}
.rph-budget-big{font-family:var(--fd);font-size:18px;font-weight:820;color:var(--t1)}
.rph-budget-bar{height:8px;background:var(--s3);border-radius:4px;overflow:hidden;display:flex;margin-bottom:8px}
.rph-bb-paid{height:100%;background:var(--ac)}
.rph-bb-next{height:100%;background:var(--wr);opacity:.7}
.rph-budget-leg{display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap}
.rph-budget-leg-i{font-family:var(--fb);font-size:11px;color:var(--t3);display:flex;align-items:center;gap:4px}
.rph-budget-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.rph-budget-rows{border-top:1px solid var(--s3);padding-top:12px;display:grid;gap:8px}
.rph-budget-row{display:flex;justify-content:space-between;align-items:center;font-family:var(--fb);font-size:13px;color:var(--t2)}
.rph-budget-v{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1)}
.rph-budget-v.ok{color:var(--ok-t)}
.rph-budget-v.warn{color:var(--wr-t)}

.rph-ms-list{display:flex;flex-direction:column;gap:12px}
.rph-ms-row{display:flex;align-items:center;gap:12px}
.rph-ms-date{width:42px;text-align:center;flex-shrink:0}
.rph-ms-day{font-family:var(--fd);font-size:18px;font-weight:820;line-height:1;color:var(--t1)}
.rph-ms-month{font-family:var(--fd);font-size:11px;color:var(--t3);font-weight:600;text-transform:uppercase}
.rph-ms-info{flex:1;min-width:0}
.rph-ms-title{font-family:var(--fd);font-size:13px;font-weight:600;color:var(--t1)}
.rph-ms-sub{font-family:var(--fb);font-size:12px;color:var(--t2);margin-top:2px}

.rph-contacts{display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 18px}
.rph-contacts-label{font-family:var(--fd);font-size:12px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;flex-shrink:0}
.rph-contacts-list{display:flex;gap:10px;flex-wrap:wrap}
.rph-empty-inline{font-family:var(--fb);font-size:12px;color:var(--t3)}
.rph-cc{display:flex;align-items:center;gap:8px;padding:4px 0}
.rph-cc-av{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:10px;font-weight:700;color:#fff;flex-shrink:0}
.rph-cc-name{font-family:var(--fd);font-size:12.5px;font-weight:640;color:var(--t1)}
.rph-cc-role{font-family:var(--fb);font-size:11px;color:var(--t3)}

.rph-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.rph-kpi{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px}
.rph-kpi.accent{background:linear-gradient(180deg,var(--s1) 0%,var(--ac-s) 100%);border-color:var(--ac-m)}
.rph-kpi.accent .rph-kpi-v{color:var(--ac-t)}
.rph-kpi.warn{background:linear-gradient(180deg,var(--s1) 0%,var(--wr-s) 100%);border-color:#f0d5a3}
.rph-kpi.warn .rph-kpi-v{color:var(--wr-t)}
.rph-kpi-l{font-family:var(--fd);font-size:11px;font-weight:620;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.rph-kpi-v{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;line-height:1.1;color:var(--t1)}
.rph-kpi-m{font-family:var(--fb);font-size:12px;color:var(--t2);margin-top:4px}
.rph-prog{height:4px;background:var(--s3);border-radius:2px;overflow:hidden;margin-top:10px}
.rph-prog-fill{height:100%;background:var(--ac);border-radius:2px}

.rph-grid{display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start}
.rph-main{display:flex;flex-direction:column;gap:16px;min-width:0}
.rph-rail{display:flex;flex-direction:column;gap:16px}

.rph-act-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;border-bottom:1px solid var(--s3)}
.rph-act-row:last-child{border-bottom:none}
.rph-act-info{flex:1;min-width:0}
.rph-act-label{font-family:var(--fd);font-size:13px;font-weight:640;color:var(--t1)}
.rph-act-detail{font-family:var(--fb);font-size:12px;color:var(--t3);margin-top:3px}

.rph-ai{display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--s3);align-items:flex-start}
.rph-ai:last-child{border-bottom:none}
.rph-ai-icon{width:32px;height:32px;border-radius:var(--r-m);display:grid;place-items:center;flex-shrink:0}
.rph-ai-icon.teal{background:var(--ac-s);color:var(--ac-t)}
.rph-ai-icon.amber{background:var(--wr-s);color:var(--wr-t)}
.rph-ai-icon.green{background:var(--ok-s);color:var(--ok-t)}
.rph-ai-icon.blue{background:var(--in-s);color:var(--in-t)}
.rph-ai-text{flex:1;min-width:0}
.rph-ai-title{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t1);line-height:1.4}
.rph-ai-title strong{font-weight:700}
.rph-ai-desc{font-family:var(--fb);font-size:12px;color:var(--t3);margin-top:2px;line-height:1.45}
.rph-ai-time{font-family:var(--fd);font-size:11px;font-weight:600;color:var(--t3);white-space:nowrap;flex-shrink:0}

.rph-sel-grid{display:flex;flex-direction:column;gap:10px}
.rph-sel-row{display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--s3)}
.rph-sel-row:last-child{border-bottom:none}
.rph-sel-row.done{opacity:.65}
.rph-sel-swatch{width:36px;height:36px;border-radius:var(--r-m);display:grid;place-items:center;flex-shrink:0}
.rph-sel-swatch.amber{background:var(--wr-s);color:var(--wr-t)}
.rph-sel-swatch.green{background:var(--ok-s);color:var(--ok-t)}
.rph-sel-info{flex:1;min-width:0}
.rph-sel-info h5{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t1);margin:0}
.rph-sel-info p{font-family:var(--fb);font-size:11.5px;color:var(--t3);margin:2px 0 0}

.rph-ql{display:flex;flex-direction:column;gap:10px}
.rph-ql-link{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;padding:6px 0;border-bottom:1px solid var(--s3);transition:opacity 120ms}
.rph-ql-link:last-child{border-bottom:none}
.rph-ql-link:hover{opacity:.8}
.rph-ql-icon{width:36px;height:36px;border-radius:var(--r-m);display:grid;place-items:center;flex-shrink:0}
.rph-ql-text{min-width:0}
.rph-ql-text h5{font-family:var(--fd);font-size:13px;font-weight:660;color:var(--t1);margin:0}
.rph-ql-text p{font-family:var(--fb);font-size:11px;color:var(--t3);margin:2px 0 0}

.rph-pl{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font-family:var(--fd);font-size:10.5px;font-weight:700;white-space:nowrap}
.rph-pl.teal{background:var(--ac-s);color:var(--ac-t)}
.rph-pl.amber{background:var(--wr-s);color:var(--wr-t)}
.rph-pl.green{background:var(--ok-s);color:var(--ok-t)}
.rph-pl.gray{background:var(--s2);color:var(--t3)}

.rph-btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12.5px;font-weight:620;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all 120ms ease;white-space:nowrap;text-decoration:none}
.rph-btn:hover{background:var(--s2);border-color:var(--s4)}
.rph-btn.pri{background:var(--ac);color:#fff;border-color:var(--ac)}
.rph-btn.pri:hover{background:var(--ac-h)}
.rph-btn.ghost{border:none;background:none;color:var(--ac-t);padding:0 8px}
.rph-btn.ghost:hover{background:var(--ac-s)}

.rph-empty{font-family:var(--fb);font-size:13px;color:var(--t3);padding:8px 0}

@media(max-width:1280px){.rph-hero{grid-template-columns:1fr}.rph-top-cards{grid-template-columns:1fr}.rph-kpis{grid-template-columns:repeat(2,1fr)}.rph-grid{grid-template-columns:1fr}}
@media(max-width:720px){.rph-h1{font-size:22px}.rph-kpis{grid-template-columns:1fr}}
`;
