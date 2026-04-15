"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill } from "@/components/pill";
import type {
  ChangeOrderRow,
  ChangeOrderTotals,
} from "@/domain/loaders/change-orders";
import {
  formatCents,
  formatDate,
  formatSignedCents,
  formatStatus,
  statusPill,
} from "@/domain/loaders/change-order-format";

type TabId = "all" | "pending" | "draft" | "approved";

const TABS: { id: TabId; label: string; match: (r: ChangeOrderRow) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  {
    id: "pending",
    label: "Pending approval",
    match: (r) =>
      r.changeOrderStatus === "pending_client_approval" ||
      r.changeOrderStatus === "pending_review",
  },
  { id: "draft", label: "Draft", match: (r) => r.changeOrderStatus === "draft" },
  {
    id: "approved",
    label: "Approved",
    match: (r) => r.changeOrderStatus === "approved",
  },
];

// Inline KPI icons
const StackIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z" />
    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);
const HourglassIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22M17 2v4.172a2 2 0 01-.586 1.414L12 12 7.586 7.586A2 2 0 017 6.172V2" />
  </svg>
);
const DollarIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
  </svg>
);
const CheckCircleIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <path d="M22 4L12 14.01l-3-3" />
  </svg>
);

export function ContractorChangeOrderWorkspace({
  projectId,
  rows,
  totals,
}: {
  projectId: string;
  projectName: string;
  rows: ChangeOrderRow[];
  totals: ChangeOrderTotals;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);

  const summary = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter(
      (r) =>
        r.changeOrderStatus === "pending_client_approval" ||
        r.changeOrderStatus === "pending_review",
    ).length;
    const approved = rows.filter((r) => r.changeOrderStatus === "approved").length;
    return { total, pending, approved };
  }, [rows]);

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab)!;
    return rows.filter(tab.match);
  }, [rows, activeTab]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const pendingRows = rows.filter(
    (r) => r.changeOrderStatus === "pending_client_approval",
  );

  return (
    <div className="cop">
      <header className="cop-head">
        <div className="cop-head-main">
          <h1 className="cop-title">Change Orders</h1>
          <p className="cop-desc">
            Create, track, and manage scope changes. Submit to the client for
            formal approval when ready.
          </p>
        </div>
        <div className="cop-head-actions">
          <Button variant="secondary">Export</Button>
          <Button variant="primary" onClick={() => setCreateOpen((v) => !v)}>
            {createOpen ? "Cancel" : "+ New change order"}
          </Button>
        </div>
      </header>

      <div className="cop-kpis">
        <KpiCard
          label="Total COs"
          value={summary.total.toString()}
          meta="This project"
          icon={StackIcon}
          iconColor="purple"
        />
        <KpiCard
          label="Pending approval"
          value={summary.pending.toString()}
          meta={summary.pending === 0 ? "All clear" : "Waiting on client"}
          icon={HourglassIcon}
          iconColor="amber"
          alert={summary.pending > 0}
        />
        <KpiCard
          label="Net change"
          value={formatSignedCents(
            totals.approvedChangesCents + totals.pendingChangesCents,
          )}
          meta="Approved + pending"
          icon={DollarIcon}
          iconColor="blue"
        />
        <KpiCard
          label="Approved"
          value={summary.approved.toString()}
          meta="Incorporated into SOV"
          icon={CheckCircleIcon}
          iconColor="green"
        />
      </div>

      <div className="cop-grid">
        <div className="cop-ws">
          <div className="cop-ws-head">
            <div>
              <h3>Change order workspace</h3>
              <div className="sub">
                Full lifecycle from draft through client approval.
              </div>
            </div>
          </div>
          <div className="cop-ws-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`cop-wtab ${activeTab === t.id ? "on" : ""}`}
                onClick={() => {
                  setActiveTab(t.id);
                  setSelectedId(null);
                }}
              >
                {t.label} ({rows.filter(t.match).length})
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState
                title="No change orders in this view"
                description="Nothing matches the current filter."
              />
            </div>
          ) : (
            <div className="cop-split">
              <div className="cop-queue">
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`cop-cc ${selected?.id === r.id ? "on" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="cop-cc-top">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cop-cc-id">
                          CO-{String(r.changeOrderNumber).padStart(3, "0")}
                        </div>
                        <div className="cop-cc-title">{r.title}</div>
                      </div>
                      <Pill color={statusPill(r.changeOrderStatus)}>
                        {formatStatus(r.changeOrderStatus)}
                      </Pill>
                    </div>
                    <div
                      className={`cop-cc-amt ${r.amountCents >= 0 ? "add" : "deduct"}`}
                    >
                      {formatSignedCents(r.amountCents)}
                    </div>
                    <div className="cop-cc-foot">
                      <span>
                        {r.submittedAt
                          ? `Submitted ${formatDate(r.submittedAt)}`
                          : `Created ${formatDate(r.createdAt)}`}
                      </span>
                      {r.originatingRfiNumber != null ? (
                        <span>
                          RFI-{String(r.originatingRfiNumber).padStart(3, "0")}
                        </span>
                      ) : (
                        <span>
                          {r.changeOrderStatus === "draft"
                            ? "Not yet submitted"
                            : r.changeOrderStatus === "pending_client_approval"
                              ? "Client review"
                              : ""}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="cop-detail">
                {selected ? (
                  <ContractorChangeOrderDetail key={selected.id} co={selected} />
                ) : (
                  <EmptyState
                    title="Select a change order"
                    description="Pick one from the queue to see details."
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="cop-rail">
          <div className="cop-rc alert">
            <div className="cop-rc-h">
              <h3>Awaiting decisions</h3>
              <span className="sub">COs pending client approval.</span>
            </div>
            <div className="cop-rc-b">
              {pendingRows.length === 0 ? (
                <p className="cop-rc-p">Nothing pending right now.</p>
              ) : (
                pendingRows.map((r) => {
                  const days = r.submittedAt
                    ? Math.floor(
                        (Date.now() - r.submittedAt.getTime()) / 86400000,
                      )
                    : 0;
                  return (
                    <div key={r.id} className="cop-fr">
                      <div>
                        <h5>CO-{String(r.changeOrderNumber).padStart(3, "0")}</h5>
                        <p>
                          {formatSignedCents(r.amountCents)} · {r.title}
                        </p>
                      </div>
                      <Pill color="amber">
                        {days === 0
                          ? "Today"
                          : `${days} day${days === 1 ? "" : "s"}`}
                      </Pill>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="cop-rc">
            <div className="cop-rc-h">
              <h3>Contract summary</h3>
            </div>
            <div className="cop-rc-b">
              <div className="cop-ir">
                <span className="cop-ir-l">Original contract</span>
                <span className="cop-ir-v">
                  {formatCents(totals.originalContractCents)}
                </span>
              </div>
              <div className="cop-ir">
                <span className="cop-ir-l">Approved changes</span>
                <span className="cop-ir-v warn">
                  {formatSignedCents(totals.approvedChangesCents)}
                </span>
              </div>
              <div className="cop-ir">
                <span className="cop-ir-l">Pending changes</span>
                <span className="cop-ir-v muted">
                  {formatSignedCents(totals.pendingChangesCents)}
                </span>
              </div>
              <div className="cop-ir strong">
                <span className="cop-ir-l">Current contract value</span>
                <span className="cop-ir-v">
                  {formatCents(totals.currentContractCents)}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {createOpen && (
        <CreatePanel projectId={projectId} onClose={() => setCreateOpen(false)} />
      )}

      <style>{`
        .cop{display:flex;flex-direction:column;gap:20px}
        .cop-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .cop-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .cop-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .cop-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .cop-head-actions{display:flex;gap:8px;flex-shrink:0;padding-top:4px}
        .cop-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.cop-kpis{grid-template-columns:repeat(2,1fr)}}

        .cop-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.cop-grid{grid-template-columns:1fr}}

        .cop-ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;min-width:0}
        .cop-ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
        .cop-ws-head h3{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
        .cop-ws-head .sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:4px;max-width:560px}

        .cop-ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
        .cop-wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-family:var(--fb);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df) var(--e)}
        .cop-wtab:hover{border-color:var(--s4);color:var(--t1)}
        .cop-wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:color-mix(in srgb,var(--ac) 30%,var(--s3))}

        .cop-split{display:grid;grid-template-columns:340px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}
        @media(max-width:900px){.cop-split{grid-template-columns:1fr}}

        .cop-queue{display:flex;flex-direction:column;gap:6px;max-height:620px;overflow-y:auto;min-width:0}
        .cop-queue::-webkit-scrollbar{width:4px}
        .cop-queue::-webkit-scrollbar-track{background:transparent}
        .cop-queue::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}

        .cop-cc{text-align:left;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e);display:flex;flex-direction:column;gap:4px}
        .cop-cc:hover{border-color:var(--s4);box-shadow:var(--shsm)}
        .cop-cc.on{border-color:color-mix(in srgb,var(--ac) 40%,var(--s3));background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
        .cop-cc-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
        .cop-cc-id{font-family:var(--fm);font-size:11px;color:var(--t3);letter-spacing:.02em}
        .cop-cc-title{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin-top:2px;letter-spacing:-.005em}
        .cop-cc-amt{font-family:var(--fd);font-size:14px;font-weight:750;margin-top:4px}
        .cop-cc-amt.add{color:var(--wr-t)}
        .cop-cc-amt.deduct{color:var(--ok-t)}
        .cop-cc-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px;font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3)}

        .cop-detail{min-width:0}

        .cop-rail{display:flex;flex-direction:column;gap:12px;min-width:0}
        .cop-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .cop-rc.alert{border-color:color-mix(in srgb,var(--wr) 30%,var(--s3))}
        .cop-rc-h{padding:14px 16px 0}
        .cop-rc-h h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .cop-rc-h .sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:3px;display:block}
        .cop-rc-b{padding:10px 16px 16px}
        .cop-rc-p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

        .cop-fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}
        .cop-fr:last-child{border-bottom:none}
        .cop-fr h5{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--t1);margin:0}
        .cop-fr p{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2);margin:2px 0 0}

        .cop-ir{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--s2);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2)}
        .cop-ir:last-child{border-bottom:none}
        .cop-ir.strong{border-top:2px solid var(--s3);padding-top:10px;margin-top:4px;font-weight:700;color:var(--t1);border-bottom:none}
        .cop-ir-l{font-family:var(--fb);font-size:13px;font-weight:560;color:var(--t2)}
        .cop-ir.strong .cop-ir-l{color:var(--t1);font-weight:700}
        .cop-ir-v{font-family:var(--fd);font-size:14px;font-weight:750;color:var(--t1)}
        .cop-ir-v.warn{color:var(--wr-t)}
        .cop-ir-v.muted{color:var(--t3)}
      `}</style>
    </div>
  );
}

function ContractorChangeOrderDetail({ co }: { co: ChangeOrderRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/change-orders/${co.id}/submit`, {
      method: "POST",
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    router.refresh();
  }

  async function voidCo() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/change-orders/${co.id}/void`, {
      method: "POST",
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    router.refresh();
  }

  const daysWaiting = co.submittedAt
    ? Math.floor((Date.now() - co.submittedAt.getTime()) / 86400000)
    : null;

  return (
    <div className="cod">
      <div className="cod-head">
        <div className="cod-head-main">
          <div className="cod-id">
            CO-{String(co.changeOrderNumber).padStart(3, "0")}
          </div>
          <h2 className="cod-title">{co.title}</h2>
          {co.description && <p className="cod-desc">{co.description}</p>}
        </div>
        <div className="cod-pills">
          <Pill color={statusPill(co.changeOrderStatus)}>
            {formatStatus(co.changeOrderStatus)}
          </Pill>
          {co.changeOrderStatus !== "draft" && (
            <Pill color="purple">Client visible</Pill>
          )}
        </div>
      </div>

      <div className="cod-grid">
        <div className="cod-cell">
          <div className="cod-k">Status</div>
          <div className="cod-v">{formatStatus(co.changeOrderStatus)}</div>
          <div className="cod-m">
            {co.submittedAt
              ? `Submitted ${formatDate(co.submittedAt)}`
              : co.changeOrderStatus === "draft"
                ? "Not yet submitted"
                : "—"}
          </div>
        </div>
        <div className="cod-cell">
          <div className="cod-k">Cost impact</div>
          <div
            className={`cod-v ${co.amountCents > 0 ? "warn" : co.amountCents < 0 ? "ok" : ""}`}
          >
            {formatSignedCents(co.amountCents)}
          </div>
          <div className="cod-m">
            {co.amountCents >= 0 ? "Addition to contract" : "Deduct from contract"}
          </div>
        </div>
        <div className="cod-cell">
          <div className="cod-k">Schedule impact</div>
          <div className="cod-v">—</div>
          <div className="cod-m">Not tracked yet</div>
        </div>
        <div className="cod-cell">
          <div className="cod-k">Originated from</div>
          <div className="cod-v accent">
            {co.originatingRfiNumber != null
              ? `RFI-${String(co.originatingRfiNumber).padStart(3, "0")}`
              : "—"}
          </div>
          <div className="cod-m">
            {co.originatingRfiNumber != null
              ? "Linked RFI"
              : "Created directly"}
          </div>
        </div>
      </div>

      <div className="cod-section">
        <div className="cod-section-head">
          <h4>Reason &amp; justification</h4>
        </div>
        <div className="cod-section-body">
          {co.reason ? (
            <p className="cod-p">{co.reason}</p>
          ) : (
            <p className="cod-p">
              No justification added yet. Explain why this change is needed
              when you&rsquo;re ready to submit.
            </p>
          )}
        </div>
      </div>

      <div className="cod-section">
        <div className="cod-section-head">
          <h4>Supporting documents</h4>
          <div className="cod-section-acts">
            <button type="button" className="cod-btn">
              Attach file
            </button>
          </div>
        </div>
        <div className="cod-section-body">
          <p className="cod-p">
            Attach cost breakdowns, revised drawings, or other supporting files
            for the client reviewer.
          </p>
        </div>
      </div>

      <div className="cod-section">
        <div className="cod-section-head">
          <h4>Approval timeline</h4>
        </div>
        <div className="cod-section-body">
          <div className="cod-activity">
            <div className="cod-ai">
              <div className="cod-dot action" />
              <div className="cod-at">
                <strong>{co.requestedByName ?? "Contractor"}</strong> created
                CO-{String(co.changeOrderNumber).padStart(3, "0")}
                {co.originatingRfiNumber != null
                  ? ` from RFI-${String(co.originatingRfiNumber).padStart(3, "0")}`
                  : ""}
              </div>
              <div className="cod-atm">{formatDate(co.createdAt)}</div>
            </div>
            {co.submittedAt && (
              <>
                <div className="cod-ai">
                  <div className="cod-dot action" />
                  <div className="cod-at">
                    <strong>{co.requestedByName ?? "Contractor"}</strong>{" "}
                    submitted for client review
                  </div>
                  <div className="cod-atm">{formatDate(co.submittedAt)}</div>
                </div>
                <div className="cod-ai">
                  <div className="cod-dot sys" />
                  <div className="cod-at">Client notified via email</div>
                  <div className="cod-atm">{formatDate(co.submittedAt)}</div>
                </div>
                {co.changeOrderStatus === "pending_client_approval" &&
                  daysWaiting != null && (
                    <div className="cod-ai">
                      <div className="cod-dot sys" />
                      <div className="cod-at">
                        Pending — no response yet ({daysWaiting}{" "}
                        {daysWaiting === 1 ? "day" : "days"})
                      </div>
                      <div className="cod-atm">Today</div>
                    </div>
                  )}
              </>
            )}
            {co.approvedAt && (
              <div className="cod-ai">
                <div className="cod-dot ok" />
                <div className="cod-at">
                  <strong>{co.approvedByName ?? "Client"}</strong> approved this
                  change order
                </div>
                <div className="cod-atm">{formatDate(co.approvedAt)}</div>
              </div>
            )}
            {co.rejectionReason && (
              <div className="cod-ai">
                <div className="cod-dot sys" />
                <div className="cod-at">
                  <strong>Client feedback:</strong> {co.rejectionReason}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="cod-actions">
        {co.changeOrderStatus === "draft" && (
          <Button variant="primary" onClick={submit} loading={pending}>
            Submit for client approval
          </Button>
        )}
        {(co.changeOrderStatus === "draft" ||
          co.changeOrderStatus === "pending_client_approval") && (
          <Button variant="secondary" onClick={voidCo} loading={pending}>
            Void
          </Button>
        )}
        {error && <p className="cod-err">Error: {error}</p>}
      </div>

      <style>{`
        .cod{display:flex;flex-direction:column;gap:14px;min-height:400px}
        .cod-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
        .cod-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}
        .cod-id{font-family:var(--fm);font-size:12px;font-weight:520;color:var(--t3);letter-spacing:.02em}
        .cod-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em;color:var(--t1);margin:0}
        .cod-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.5;margin:4px 0 0;max-width:480px}
        .cod-pills{display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0;padding-top:2px}

        .cod-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .cod-cell{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
        .cod-k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .cod-v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px;color:var(--t1)}
        .cod-v.warn{color:var(--wr-t)}
        .cod-v.ok{color:var(--ok-t)}
        .cod-v.accent{color:var(--ac-t)}
        .cod-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}

        .cod-section{border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
        .cod-section-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
        .cod-section-head h4{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0}
        .cod-section-acts{display:flex;gap:6px}
        .cod-section-body{padding:14px 16px}
        .cod-p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}
        .cod-btn{height:32px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12px;font-weight:640;cursor:pointer;transition:all var(--df) var(--e);white-space:nowrap}
        .cod-btn:hover{border-color:var(--s4);background:var(--sh)}

        .cod-activity{display:flex;flex-direction:column}
        .cod-ai{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--s2);align-items:flex-start}
        .cod-ai:last-child{border-bottom:none}
        .cod-dot{width:8px;height:8px;border-radius:50%;background:var(--s4);margin-top:6px;flex-shrink:0}
        .cod-dot.action{background:var(--ac)}
        .cod-dot.ok{background:var(--ok)}
        .cod-dot.sys{background:var(--t3)}
        .cod-at{flex:1;font-family:var(--fb);font-size:13px;color:var(--t2)}
        .cod-at strong{color:var(--t1);font-weight:650}
        .cod-atm{font-family:var(--fb);font-size:11px;color:var(--t3);flex-shrink:0;padding-top:2px}

        .cod-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .cod-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      `}</style>
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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [originatingRfiId, setOriginatingRfiId] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const parsed = Number(amount);
    if (!Number.isFinite(parsed)) {
      setError("invalid_amount");
      setPending(false);
      return;
    }
    const amountCents = Math.round(parsed * 100);
    const res = await fetch("/api/change-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        description: description || undefined,
        reason: reason || undefined,
        amountCents,
        originatingRfiId: originatingRfiId || undefined,
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
    <div className="cop-cp">
      <div className="cop-cp-head">
        <div>
          <h3>Create new change order</h3>
          <div className="sub">
            Draft a scope change. You can submit it for client approval
            afterwards.
          </div>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <form onSubmit={onSubmit} className="cop-cp-form">
        <label className="cop-cp-full">
          <span>Title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Mechanical reroute — east corridor"
          />
        </label>
        <label className="cop-cp-full">
          <span>Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of what is changing."
          />
        </label>
        <label className="cop-cp-full">
          <span>Reason / justification</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this change is needed."
          />
        </label>
        <div className="cop-cp-row">
          <label>
            <span>Amount (USD, negative for deduct)</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="18400.00"
            />
          </label>
          <label>
            <span>Originating RFI ID (optional)</span>
            <input
              value={originatingRfiId}
              onChange={(e) => setOriginatingRfiId(e.target.value)}
              placeholder="RFI UUID"
            />
          </label>
        </div>
        {error && <p className="cop-cp-err">Error: {error}</p>}
        <div className="cop-cp-foot">
          <Button variant="secondary" type="button">
            Attach files
          </Button>
          <Button variant="primary" type="submit" loading={pending}>
            Create draft
          </Button>
        </div>
      </form>
      <style>{`
        .cop-cp{background:var(--s1);border:2px solid color-mix(in srgb,var(--ac) 35%,var(--s3));border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .cop-cp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:18px 20px;border-bottom:1px solid var(--s3)}
        .cop-cp-head h3{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
        .cop-cp-head .sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:4px}
        .cop-cp-form{padding:20px;display:flex;flex-direction:column;gap:14px}
        .cop-cp-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:768px){.cop-cp-row{grid-template-columns:1fr}}
        .cop-cp-form label{display:flex;flex-direction:column;gap:5px;font-family:var(--fb)}
        .cop-cp-form label>span{font-family:var(--fd);font-size:11.5px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
        .cop-cp-form input,.cop-cp-form textarea{width:100%;border:1px solid var(--s3);border-radius:var(--r-m);padding:0 12px;font-family:var(--fb);font-size:13px;background:var(--s1);color:var(--t1);outline:none;transition:border-color var(--df) var(--e)}
        .cop-cp-form input{height:38px}
        .cop-cp-form textarea{min-height:80px;padding:10px 12px;resize:vertical;line-height:1.5}
        .cop-cp-form input:focus,.cop-cp-form textarea:focus{border-color:var(--ac)}
        .cop-cp-full{grid-column:1/-1}
        .cop-cp-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
        .cop-cp-foot{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}
      `}</style>
    </div>
  );
}
