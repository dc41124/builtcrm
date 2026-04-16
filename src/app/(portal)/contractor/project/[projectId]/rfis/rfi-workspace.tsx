"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import type { RfiRow } from "@/domain/loaders/project-home";

type TabId = "open" | "formal" | "issues" | "closed";

const TABS: { id: TabId; label: string; match: (r: RfiRow) => boolean }[] = [
  { id: "open", label: "All open", match: (r) => r.rfiStatus !== "closed" },
  {
    id: "formal",
    label: "Formal RFIs",
    match: (r) => r.rfiStatus !== "closed" && r.rfiType === "formal",
  },
  {
    id: "issues",
    label: "Issues",
    match: (r) => r.rfiStatus !== "closed" && r.rfiType === "issue",
  },
  { id: "closed", label: "Closed", match: (r) => r.rfiStatus === "closed" },
];

// Inline KPI icons
const FileIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M9 13h6M9 17h3" />
  </svg>
);
const HourglassIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22M17 2v4.172a2 2 0 01-.586 1.414L12 12 7.586 7.586A2 2 0 017 6.172V2" />
  </svg>
);
const ClipboardIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2h6a2 2 0 012 2v1h2a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2V4a2 2 0 012-2z" />
    <path d="M9 2v3h6V2" />
  </svg>
);
const AlertTriangleIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
  </svg>
);

export function ContractorRfiWorkspace({
  projectId,
  rfis,
}: {
  projectId: string;
  projectName: string;
  rfis: RfiRow[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("open");
  const [selectedId, setSelectedId] = useState<string | null>(rfis[0]?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const summary = useMemo(() => {
    const open = rfis.filter((r) => r.rfiStatus !== "closed").length;
    const awaiting = rfis.filter(
      (r) => r.rfiStatus === "pending_response" || r.rfiStatus === "open",
    ).length;
    const overdue = rfis.filter(
      (r) => r.rfiStatus !== "closed" && r.dueAt && r.dueAt.getTime() < now,
    ).length;
    const answered = rfis.filter((r) => r.rfiStatus === "answered").length;
    const formal = rfis.filter((r) => r.rfiType === "formal" && r.rfiStatus !== "closed").length;
    return { open, awaiting, overdue, answered, formal };
  }, [rfis, now]);

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab)!;
    return rfis.filter(tab.match);
  }, [rfis, activeTab]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  // Right rail derivations
  const overdueList = useMemo(
    () =>
      rfis.filter(
        (r) => r.rfiStatus !== "closed" && r.dueAt && r.dueAt.getTime() < now,
      ),
    [rfis, now],
  );
  const firstBlocker = overdueList[0] ?? null;

  const weekMs = 7 * 86400000;
  const dueThisWeek = useMemo(
    () =>
      rfis.filter(
        (r) =>
          r.rfiStatus !== "closed" &&
          r.dueAt &&
          r.dueAt.getTime() >= now &&
          r.dueAt.getTime() < now + weekMs,
      ).length,
    [rfis, now, weekMs],
  );

  const tradeBreakdown = useMemo(() => {
    const m = new Map<string, { total: number; blocked: number }>();
    for (const r of rfis) {
      if (r.rfiStatus === "closed") continue;
      const name = r.assignedToOrganizationName ?? "Unassigned";
      const entry = m.get(name) ?? { total: 0, blocked: 0 };
      entry.total += 1;
      if (r.dueAt && r.dueAt.getTime() < now) entry.blocked += 1;
      m.set(name, entry);
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [rfis, now]);

  return (
    <div className="rfp">
      <header className="rfp-head">
        <div className="rfp-head-main">
          <h1 className="rfp-title">RFIs / Issues</h1>
          <p className="rfp-desc">
            Track coordination questions, formal RFIs, and field issues across trades.
            Triage lightweight issues and escalate when a response is blocking work.
          </p>
        </div>
        <div className="rfp-head-actions">
          <Button variant="secondary">Export log</Button>
          <Button variant="primary" onClick={() => setCreateOpen((v) => !v)}>
            {createOpen ? "Cancel" : "+ New RFI / Issue"}
          </Button>
        </div>
      </header>

      <div className="rfp-kpis">
        <KpiCard
          label="Open threads"
          value={summary.open.toString()}
          meta={summary.open === 0 ? "Nothing open" : "Across all trades"}
          icon={FileIcon}
          iconColor="blue"
        />
        <KpiCard
          label="Awaiting response"
          value={summary.awaiting.toString()}
          meta={summary.awaiting === 0 ? "All clear" : "Pending sub replies"}
          icon={HourglassIcon}
          iconColor="purple"
          alert={summary.awaiting > 0}
        />
        <KpiCard
          label="Formal RFIs"
          value={summary.formal.toString()}
          meta="Tracked as formal requests"
          icon={ClipboardIcon}
          iconColor="amber"
        />
        <KpiCard
          label="Blocking work"
          value={summary.overdue.toString()}
          meta={
            summary.overdue === 0
              ? "Nothing blocked"
              : "Affecting milestone delivery"
          }
          icon={AlertTriangleIcon}
          iconColor="red"
          alert={summary.overdue > 0}
        />
      </div>

      <div className="rfp-grid">
        <div className="rfp-ws">
          <div className="rfp-ws-head">
            <div>
              <h3>Thread workspace</h3>
              <div className="sub">Queue-first triage with detail pane.</div>
            </div>
          </div>
          <div className="rfp-ws-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`rfp-wtab ${activeTab === t.id ? "on" : ""}`}
                onClick={() => {
                  setActiveTab(t.id);
                  setSelectedId(null);
                }}
              >
                {t.label} ({rfis.filter(t.match).length})
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState
                title="No threads in this view"
                description="Nothing matches the current filter."
              />
            </div>
          ) : (
            <div className="rfp-split">
              <div className="rfp-queue-col">
                <div className="rfp-q-tb">
                  <select className="rfp-q-sel" defaultValue="impact">
                    <option value="impact">Sort: Highest impact</option>
                    <option value="oldest">Sort: Oldest waiting</option>
                    <option value="newest">Sort: Newest</option>
                  </select>
                  <button className="rfp-q-filter" type="button">
                    Filters
                  </button>
                </div>
                <div className="rfp-queue">
                  {filtered.map((r) => {
                    const overdue =
                      r.rfiStatus !== "closed" &&
                      r.dueAt &&
                      r.dueAt.getTime() < now;
                    const days = r.dueAt
                      ? Math.floor((now - r.dueAt.getTime()) / 86400000)
                      : null;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        className={`rfp-tc ${selected?.id === r.id ? "on" : ""} ${overdue ? "hot" : ""}`}
                        onClick={() => setSelectedId(r.id)}
                      >
                        <div className="rfp-tc-top">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="rfp-tc-id">
                              RFI-{String(r.sequentialNumber).padStart(3, "0")}
                            </div>
                            <div className="rfp-tc-title">{r.subject}</div>
                            {r.body && (
                              <div className="rfp-tc-desc">{r.body}</div>
                            )}
                          </div>
                          <Pill color={statusPill(r.rfiStatus, Boolean(overdue))}>
                            {overdue ? "Overdue" : formatStatus(r.rfiStatus)}
                          </Pill>
                        </div>
                        <div className="rfp-tc-tags">
                          <span className={`rfp-mt${r.rfiType === "formal" ? " ac" : ""}`}>{r.rfiType === "formal" ? "Formal RFI" : "Issue"}</span>
                          {r.assignedToOrganizationName && (
                            <span className="rfp-mt">
                              {r.assignedToOrganizationName}
                            </span>
                          )}
                          {overdue && <span className="rfp-mt dg">Blocking work</span>}
                        </div>
                        <div className="rfp-tc-foot">
                          <span>
                            {r.dueAt
                              ? overdue
                                ? `${days}d overdue`
                                : `Due ${formatDate(r.dueAt)}`
                              : "No due date"}
                          </span>
                          <span>{r.responses.length} replies</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="rfp-detail">
                {selected ? (
                  <RfiDetail key={selected.id} rfi={selected} now={now} />
                ) : (
                  <EmptyState
                    title="Select an RFI"
                    description="Pick a thread from the queue to see details."
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="rfp-rail">
          <div className="rfp-rc danger">
            <div className="rfp-rc-h">
              <h3>Blocking work</h3>
              <span className="sub">Highest-priority thread.</span>
            </div>
            <div className="rfp-rc-b">
              {firstBlocker ? (
                <>
                  <div className="rfp-rc-n">
                    RFI-{String(firstBlocker.sequentialNumber).padStart(3, "0")}{" "}
                    {firstBlocker.subject}
                  </div>
                  <p className="rfp-rc-p">
                    {firstBlocker.assignedToOrganizationName
                      ? `${firstBlocker.assignedToOrganizationName} hasn't responded yet. `
                      : ""}
                    {firstBlocker.dueAt
                      ? `${Math.floor((now - firstBlocker.dueAt.getTime()) / 86400000)} days overdue.`
                      : ""}
                  </p>
                  <Button variant="primary" className="rfp-rc-cta">
                    Send escalation reminder
                  </Button>
                </>
              ) : (
                <p className="rfp-rc-p">Nothing blocked right now.</p>
              )}
            </div>
          </div>

          <div className="rfp-rc">
            <div className="rfp-rc-h">
              <h3>Response summary</h3>
            </div>
            <div className="rfp-rc-b">
              <div className="rfp-fr">
                <div>
                  <h5>Overdue</h5>
                  <p>
                    {overdueList.length} thread
                    {overdueList.length === 1 ? "" : "s"} past due date
                  </p>
                </div>
                <Pill color="red">{overdueList.length}</Pill>
              </div>
              <div className="rfp-fr">
                <div>
                  <h5>Due this week</h5>
                  <p>
                    {dueThisWeek} thread{dueThisWeek === 1 ? "" : "s"} need responses
                  </p>
                </div>
                <Pill color="amber">{dueThisWeek}</Pill>
              </div>
              <div className="rfp-fr">
                <div>
                  <h5>Answered — needs review</h5>
                  <p>
                    {summary.answered} response
                    {summary.answered === 1 ? "" : "s"} ready for contractor review
                  </p>
                </div>
                <Pill color="purple">{summary.answered}</Pill>
              </div>
            </div>
          </div>

          <div className="rfp-rc">
            <div className="rfp-rc-h">
              <h3>Trade breakdown</h3>
            </div>
            <div className="rfp-rc-b">
              {tradeBreakdown.length === 0 ? (
                <p className="rfp-rc-p">No open threads.</p>
              ) : (
                tradeBreakdown.map((t) => (
                  <div key={t.name} className="rfp-fr">
                    <div>
                      <h5>{t.name}</h5>
                      <p>
                        {t.total} open
                        {t.blocked > 0 ? ` (${t.blocked} blocked)` : ""}
                      </p>
                    </div>
                    <Pill color={t.blocked > 0 ? "red" : "amber"}>{t.total}</Pill>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>

      {createOpen && (
        <CreatePanel projectId={projectId} onClose={() => setCreateOpen(false)} />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .rfp{display:flex;flex-direction:column;gap:20px}
        .rfp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .rfp-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .rfp-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .rfp-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .rfp-head-actions{display:flex;gap:8px;flex-shrink:0;padding-top:4px}
        .rfp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.rfp-kpis{grid-template-columns:repeat(2,1fr)}}

        .rfp-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.rfp-grid{grid-template-columns:1fr}}

        .rfp-ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;min-width:0}
        .rfp-ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
        .rfp-ws-head h3{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
        .rfp-ws-head .sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:4px;max-width:560px}

        .rfp-ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
        .rfp-wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-family:var(--fb);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df) var(--e)}
        .rfp-wtab:hover{border-color:var(--s4);color:var(--t1)}
        .rfp-wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:color-mix(in srgb,var(--ac) 30%,var(--s3))}

        .rfp-split{display:grid;grid-template-columns:360px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}
        @media(max-width:900px){.rfp-split{grid-template-columns:1fr}}

        .rfp-queue-col{display:flex;flex-direction:column;gap:10px;min-width:0}
        .rfp-q-tb{display:flex;gap:8px;align-items:center;justify-content:space-between}
        .rfp-q-sel{height:30px;padding:0 10px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:12px;color:var(--t2);outline:none;cursor:pointer}
        .rfp-q-filter{height:30px;padding:0 12px;border-radius:var(--r-m);border:1px solid transparent;background:transparent;font-family:var(--fb);font-size:12px;font-weight:620;color:var(--t2);cursor:pointer}
        .rfp-q-filter:hover{background:var(--s2);color:var(--t1)}

        .rfp-queue{display:flex;flex-direction:column;gap:6px;max-height:600px;overflow-y:auto;min-width:0}
        .rfp-queue::-webkit-scrollbar{width:4px}
        .rfp-queue::-webkit-scrollbar-track{background:transparent}
        .rfp-queue::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
        .rfp-tc{text-align:left;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e);display:flex;flex-direction:column;gap:6px}
        .rfp-tc:hover{border-color:var(--s4);box-shadow:var(--shsm)}
        .rfp-tc.on{border-color:color-mix(in srgb,var(--ac) 40%,var(--s3));background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
        .rfp-tc.hot{border-color:color-mix(in srgb,var(--dg) 35%,var(--s3))}
        .rfp-tc.hot.on{border-color:var(--dg-t);box-shadow:0 0 0 3px color-mix(in srgb,var(--dg) 15%,transparent)}
        .rfp-tc-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
        .rfp-tc-id{font-family:var(--fm);font-size:11px;font-weight:520;color:var(--t3);letter-spacing:.02em}
        .rfp-tc-title{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin-top:2px;letter-spacing:-.005em}
        .rfp-tc-desc{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .rfp-tc-tags{display:flex;gap:4px;flex-wrap:wrap}
        .rfp-mt{height:20px;padding:0 7px;border-radius:999px;border:1px solid var(--s3);background:var(--s2);color:var(--t3);font-family:var(--fd);font-size:10px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}
        .rfp-mt.ac{background:var(--ac-s);border-color:var(--ac-m);color:var(--ac-t)}
        .rfp-mt.dg{background:var(--dg-s);border-color:color-mix(in srgb,var(--dg) 35%,var(--s3));color:var(--dg-t)}
        .rfp-tc-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);margin-top:2px}

        .rfp-detail{min-width:0}

        .rfp-rail{display:flex;flex-direction:column;gap:12px;min-width:0}
        .rfp-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .rfp-rc.danger{border-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
        .rfp-rc-h{padding:14px 16px 0}
        .rfp-rc-h h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .rfp-rc-h .sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:3px;display:block}
        .rfp-rc-b{padding:10px 16px 16px}
        .rfp-rc-n{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1)}
        .rfp-rc-p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:4px 0 0;line-height:1.5}
        .rfp-rc-cta{margin-top:10px;width:100%;justify-content:center}

        .rfp-fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}
        .rfp-fr:last-child{border-bottom:none}
        .rfp-fr h5{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--t1);margin:0}
        .rfp-fr p{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2);margin:2px 0 0}
      ` }} />
    </div>
  );
}

function RfiDetail({ rfi, now }: { rfi: RfiRow; now: number }) {
  const overdue =
    rfi.rfiStatus !== "closed" && rfi.dueAt && rfi.dueAt.getTime() < now;
  const daysOverdue =
    overdue && rfi.dueAt
      ? Math.floor((now - rfi.dueAt.getTime()) / 86400000)
      : null;

  return (
    <div className="rfd">
      <div className="rfd-head">
        <div className="rfd-head-main">
          <div className="rfd-id">
            RFI-{String(rfi.sequentialNumber).padStart(3, "0")}
          </div>
          <h2 className="rfd-title">{rfi.subject}</h2>
          {rfi.body && <p className="rfd-desc">{rfi.body}</p>}
        </div>
        <div className="rfd-pills">
          <Pill color={statusPill(rfi.rfiStatus, Boolean(overdue))}>
            {overdue ? "Blocked" : formatStatus(rfi.rfiStatus)}
          </Pill>
          <Pill color={rfi.rfiType === "formal" ? "purple" : "gray"}>{rfi.rfiType === "formal" ? "Formal RFI" : "Issue"}</Pill>
        </div>
      </div>

      <div className="rfd-grid">
        <div className="rfd-cell">
          <div className="rfd-k">Status</div>
          <div className="rfd-v">
            {overdue ? "Pending response" : formatStatus(rfi.rfiStatus)}
          </div>
          <div className="rfd-m">
            {rfi.assignedToOrganizationName
              ? `Waiting on ${rfi.assignedToOrganizationName}`
              : "Waiting on sub"}
          </div>
        </div>
        <div className="rfd-cell">
          <div className="rfd-k">Assigned to</div>
          <div className="rfd-v">
            {rfi.assignedToOrganizationName ?? "Unassigned"}
          </div>
          <div className="rfd-m">Subcontractor trade</div>
        </div>
        <div className="rfd-cell">
          <div className="rfd-k">Due date</div>
          <div className={`rfd-v ${overdue ? "danger" : ""}`}>
            {rfi.dueAt ? formatDate(rfi.dueAt) : "—"}
            {overdue ? " (overdue)" : ""}
          </div>
          <div className="rfd-m">
            {daysOverdue != null
              ? `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} past deadline`
              : rfi.dueAt
                ? "On schedule"
                : "No due date set"}
          </div>
        </div>
        <div className="rfd-cell">
          <div className="rfd-k">Blocking</div>
          <div className="rfd-v">
            {overdue ? "Milestone at risk" : "Nothing blocked"}
          </div>
          <div className="rfd-m">
            {overdue
              ? "Layout release cannot proceed"
              : "No downstream work affected"}
          </div>
        </div>
      </div>

      <div className="rfd-section">
        <div className="rfd-section-head">
          <h4>Escalation context</h4>
          <div className="rfd-section-acts">
            <button type="button" className="rfd-btn">
              Send reminder
            </button>
            <button type="button" className="rfd-btn">
              Add clarification
            </button>
          </div>
        </div>
        <div className="rfd-section-body">
          <p className="rfd-p">
            {rfi.body ??
              "No additional context yet. Escalation notes and trade constraints will appear here."}
          </p>
          <div className="rfd-tags">
            {overdue && <span className="rfp-mt dg">Milestone blocked</span>}
            <span className="rfp-mt">Drawing markup needed</span>
            <span className="rfp-mt">Trade constraint explanation needed</span>
          </div>
        </div>
      </div>

      <div className="rfd-section">
        <div className="rfd-section-head">
          <h4>Linked references</h4>
          <div className="rfd-section-acts">
            <button type="button" className="rfd-btn">
              Link drawing
            </button>
          </div>
        </div>
        <div className="rfd-section-body">
          {rfi.drawingReference && (
            <div className="rfd-fr">
              <div>
                <h5>{rfi.drawingReference}</h5>
                <p>Drawing reference</p>
              </div>
              <span className="rfd-fc">DWG</span>
            </div>
          )}
          {rfi.specificationReference && (
            <div className="rfd-fr">
              <div>
                <h5>{rfi.specificationReference}</h5>
                <p>Specification reference</p>
              </div>
              <span className="rfd-fc">SPEC</span>
            </div>
          )}
          {rfi.referenceFiles.map((f) => (
            <div key={f.id} className="rfd-fr">
              <div>
                <h5>{f.title}</h5>
                <p>{f.documentType} · {f.linkRole}</p>
              </div>
              <span className="rfd-fc">FILE</span>
            </div>
          ))}
          {!rfi.drawingReference && !rfi.specificationReference && rfi.referenceFiles.length === 0 && (
            <p className="rfd-p">
              No drawings or specs linked yet. Attach supporting files to help
              the reviewer.
            </p>
          )}
        </div>
      </div>

      {rfi.activityTrail.length > 0 && (
        <div className="rfd-section">
          <div className="rfd-section-head">
            <h4>Recent activity</h4>
          </div>
          <div className="rfd-section-body">
            <div className="rfd-activity">
              {rfi.activityTrail.map((a) => (
                <div key={a.id} className="rfd-ai">
                  <div className="rfd-ai-dot" />
                  <div className="rfd-ai-text">
                    {a.actorName && <strong>{a.actorName}</strong>}
                    {a.actorName ? " " : ""}{a.title}
                  </div>
                  <div className="rfd-ai-time">{formatDate(a.createdAt)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rfd-section">
        <div className="rfd-section-head">
          <h4>Thread activity</h4>
        </div>
        <div className="rfd-section-body">
          {rfi.responses.length === 0 ? (
            <p className="rfd-p">
              No replies yet. The assigned subcontractor will appear here once
              they respond.
            </p>
          ) : (
            <ul className="rfd-thread">
              {rfi.responses.map((resp) => (
                <li key={resp.id} className="rfd-reply">
                  <div className="rfd-reply-head">
                    <span className="rfd-reply-name">
                      {resp.respondedByName ?? "Unknown"}
                    </span>
                    {resp.isOfficialResponse && (
                      <Pill color="purple">Official</Pill>
                    )}
                    <span className="rfd-reply-time">
                      {formatDate(resp.createdAt)}
                    </span>
                  </div>
                  <p className="rfd-reply-body">{resp.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .rfd{display:flex;flex-direction:column;gap:14px;min-height:500px}
        .rfd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
        .rfd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}
        .rfd-id{font-family:var(--fm);font-size:12px;font-weight:520;color:var(--t3);letter-spacing:.02em}
        .rfd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em;color:var(--t1);margin:0}
        .rfd-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.5;margin:4px 0 0;max-width:480px}
        .rfd-pills{display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0;padding-top:2px}
        .rfd-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .rfd-cell{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
        .rfd-k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .rfd-v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px;color:var(--t1)}
        .rfd-v.danger{color:var(--dg-t)}
        .rfd-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}

        .rfd-section{border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
        .rfd-section-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
        .rfd-section-head h4{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0}
        .rfd-section-acts{display:flex;gap:6px}
        .rfd-btn{height:32px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12px;font-weight:640;cursor:pointer;transition:all var(--df) var(--e);white-space:nowrap}
        .rfd-btn:hover{border-color:var(--s4);background:var(--sh)}
        .rfd-section-body{padding:14px 16px}
        .rfd-p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}
        .rfd-activity{display:flex;flex-direction:column;gap:0}
        .rfd-ai{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--s2)}
        .rfd-ai:last-child{border-bottom:none}
        .rfd-ai-dot{width:8px;height:8px;border-radius:50%;background:var(--ac);flex-shrink:0;margin-top:5px}
        .rfd-ai-text{flex:1;font-family:var(--fb);font-size:12.5px;color:var(--t2);line-height:1.45;font-weight:520}
        .rfd-ai-text strong{font-weight:650;color:var(--t1)}
        .rfd-ai-time{font-family:var(--fb);font-size:11px;color:var(--t3);white-space:nowrap;flex-shrink:0;font-weight:520}
        .rfd-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}

        .rfd-fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}
        .rfd-fr:last-child{border-bottom:none}
        .rfd-fr h5{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t1);margin:0}
        .rfd-fr p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:2px 0 0}
        .rfd-fc{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);padding:3px 8px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap}

        .rfd-thread{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
        .rfd-reply{border:1px solid var(--s3);border-radius:var(--r-m);padding:12px 14px}
        .rfd-reply-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
        .rfd-reply-name{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--t1)}
        .rfd-reply-time{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-left:auto}
        .rfd-reply-body{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);line-height:1.55;margin:0}
      ` }} />
    </div>
  );
}

function CreatePanel({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rfiType, setRfiType] = useState<"formal" | "issue">("issue");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [assignedToOrganizationId, setAssignedToOrganizationId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [drawingReference, setDrawingReference] = useState("");
  const [specificationReference, setSpecificationReference] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/rfis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        rfiType,
        subject,
        body: body || undefined,
        assignedToOrganizationId: assignedToOrganizationId || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        drawingReference: drawingReference || undefined,
        specificationReference: specificationReference || undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="rfp-cp">
      <div className="rfp-cp-head">
        <div>
          <h3>Create new RFI / Issue</h3>
          <div className="sub">
            Start as a lightweight issue. Escalate to formal RFI if needed later.
          </div>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <form onSubmit={onSubmit} className="rfp-cp-form">
        <div className="rfp-cp-row">
          <label>
            <span>Type</span>
            <select
              value={rfiType}
              onChange={(e) => setRfiType(e.target.value as "formal" | "issue")}
            >
              <option value="issue">Issue (lightweight)</option>
              <option value="formal">Formal RFI</option>
            </select>
          </label>
          <label>
            <span>Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="Brief description of the issue"
            />
          </label>
          <label>
            <span>Assign to (organization ID)</span>
            <input
              value={assignedToOrganizationId}
              onChange={(e) => setAssignedToOrganizationId(e.target.value)}
              placeholder="Subcontractor org UUID"
            />
          </label>
        </div>
        <label className="rfp-cp-full">
          <span>Description</span>
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe the coordination question, field condition, or clarification needed…"
          />
        </label>
        <div className="rfp-cp-row">
          <label>
            <span>Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
          <label>
            <span>Drawing / spec reference</span>
            <input
              value={drawingReference}
              onChange={(e) => setDrawingReference(e.target.value)}
              placeholder="e.g. S-201, A-304"
            />
          </label>
        </div>
        <label className="rfp-cp-full">
          <span>Specification reference</span>
          <input
            value={specificationReference}
            onChange={(e) => setSpecificationReference(e.target.value)}
            placeholder="09 91 23"
          />
        </label>
        {error && <p className="rfp-cp-err">Error: {error}</p>}
        <div className="rfp-cp-foot">
          <Button variant="secondary" type="button">
            Attach files
          </Button>
          <Button variant="primary" type="submit" loading={pending}>
            {rfiType === "formal" ? "Create formal RFI" : "Create issue"}
          </Button>
        </div>
      </form>
      <style dangerouslySetInnerHTML={{ __html: `
        .rfp-cp{background:var(--s1);border:2px solid color-mix(in srgb,var(--ac) 35%,var(--s3));border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .rfp-cp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:18px 20px;border-bottom:1px solid var(--s3)}
        .rfp-cp-head h3{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
        .rfp-cp-head .sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:4px}
        .rfp-cp-form{padding:20px;display:flex;flex-direction:column;gap:14px}
        .rfp-cp-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:768px){.rfp-cp-row{grid-template-columns:1fr}}
        .rfp-cp-form label{display:flex;flex-direction:column;gap:5px;font-family:var(--fb)}
        .rfp-cp-form label>span{font-family:var(--fd);font-size:11.5px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
        .rfp-cp-form input,.rfp-cp-form textarea,.rfp-cp-form select{width:100%;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px;font-family:var(--fb);font-size:13px;background:var(--s1);color:var(--t1);outline:none;transition:border-color var(--df) var(--e)}
        .rfp-cp-form input,.rfp-cp-form select{height:38px}
        .rfp-cp-form textarea{min-height:80px;padding:10px 12px;resize:vertical;line-height:1.5}
        .rfp-cp-form input:focus,.rfp-cp-form textarea:focus{border-color:var(--ac)}
        .rfp-cp-full{grid-column:1/-1}
        .rfp-cp-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
        .rfp-cp-foot{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}
      ` }} />
    </div>
  );
}

function statusPill(status: string, overdue: boolean): PillColor {
  if (overdue) return "red";
  if (status === "closed") return "green";
  if (status === "answered") return "purple";
  if (status === "pending_response" || status === "open") return "amber";
  return "gray";
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
