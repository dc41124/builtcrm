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

type TabId = "pending" | "approved" | "rejected";

const TABS: { id: TabId; label: string; match: (r: ChangeOrderRow) => boolean }[] = [
  {
    id: "pending",
    label: "Pending review",
    match: (r) => r.changeOrderStatus === "pending_client_approval",
  },
  { id: "approved", label: "Approved", match: (r) => r.changeOrderStatus === "approved" },
  { id: "rejected", label: "Rejected", match: (r) => r.changeOrderStatus === "rejected" },
];

// Inline KPI icons
const InboxIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
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
const DocIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

export function CommercialChangeOrderReview({
  rows,
  totals,
}: {
  projectName: string;
  rows: ChangeOrderRow[];
  totals: ChangeOrderTotals;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pendingRows = useMemo(
    () => rows.filter((r) => r.changeOrderStatus === "pending_client_approval"),
    [rows],
  );

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab)!;
    return rows.filter(tab.match);
  }, [rows, activeTab]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="cor">
      <header className="cor-head">
        <div className="cor-head-main">
          <h1 className="cor-title">Change Orders for Review</h1>
          <p className="cor-desc">
            Your contractor has submitted scope changes that need your approval.
            Review the cost and schedule impact, then approve, reject, or
            request clarification.
          </p>
        </div>
      </header>

      <div className="cor-kpis">
        <KpiCard
          label="Needs your review"
          value={pendingRows.length.toString()}
          meta="Decisions waiting on you"
          icon={InboxIcon}
          iconColor="red"
          alert={pendingRows.length > 0}
        />
        <KpiCard
          label="Pending total"
          value={formatSignedCents(totals.pendingChangesCents)}
          meta="If all approved"
          icon={DollarIcon}
          iconColor="amber"
          alert={pendingRows.length > 0}
        />
        <KpiCard
          label="Approved to date"
          value={formatSignedCents(totals.approvedChangesCents)}
          meta={`${rows.filter((r) => r.changeOrderStatus === "approved").length} change orders`}
          icon={CheckCircleIcon}
          iconColor="green"
        />
        <KpiCard
          label="Current contract"
          value={formatCents(totals.currentContractCents)}
          meta="Original + approved"
          icon={DocIcon}
          iconColor="blue"
        />
      </div>

      <div className="cor-grid">
        <div className="cor-ws">
          <div className="cor-ws-head">
            <div>
              <h3>Review queue</h3>
              <div className="sub">
                Change orders submitted by your contractor for your formal approval.
              </div>
            </div>
          </div>
          <div className="cor-ws-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`cor-wtab ${activeTab === t.id ? "on" : ""}`}
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
                title="Nothing in this view"
                description="No change orders match this filter."
              />
            </div>
          ) : (
            <div className="cor-split">
              <div className="cor-queue">
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className={`cor-cc ${selected?.id === r.id ? "on" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="cor-cc-top">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="cor-cc-id">
                          CO-{String(r.changeOrderNumber).padStart(3, "0")}
                        </div>
                        <div className="cor-cc-title">{r.title}</div>
                      </div>
                      <Pill
                        color={
                          r.changeOrderStatus === "pending_client_approval"
                            ? "red"
                            : statusPill(r.changeOrderStatus)
                        }
                      >
                        {r.changeOrderStatus === "pending_client_approval"
                          ? "Review"
                          : formatStatus(r.changeOrderStatus)}
                      </Pill>
                    </div>
                    <div
                      className={`cor-cc-amt ${r.amountCents >= 0 ? "add" : "deduct"}`}
                    >
                      {formatSignedCents(r.amountCents)}
                    </div>
                    <div className="cor-cc-foot">
                      {r.submittedAt && (
                        <span>Submitted {formatDate(r.submittedAt)}</span>
                      )}
                      <span>High impact</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="cor-detail">
                {selected ? (
                  <ClientChangeOrderDetail key={selected.id} co={selected} />
                ) : (
                  <EmptyState
                    title="Select a change order"
                    description="Pick one from the queue to review."
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="cor-rail">
          <div className="cor-rc">
            <div className="cor-rc-h">
              <h3>Contract impact</h3>
              <span className="sub">How pending COs affect your total.</span>
            </div>
            <div className="cor-rc-b">
              <div className="cor-ir">
                <span className="cor-ir-l">Original contract</span>
                <span className="cor-ir-v">
                  {formatCents(totals.originalContractCents)}
                </span>
              </div>
              <div className="cor-ir">
                <span className="cor-ir-l">Already approved</span>
                <span className="cor-ir-v">
                  {formatSignedCents(totals.approvedChangesCents)}
                </span>
              </div>
              <div className="cor-ir">
                <span className="cor-ir-l">Pending</span>
                <span className="cor-ir-v warn">
                  {formatSignedCents(totals.pendingChangesCents)}
                </span>
              </div>
              <div className="cor-ir strong">
                <span className="cor-ir-l">If all approved</span>
                <span className="cor-ir-v">
                  {formatCents(
                    totals.currentContractCents + totals.pendingChangesCents,
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="cor-rc">
            <div className="cor-rc-h">
              <h3>Questions?</h3>
              <span className="sub">Contact your project team.</span>
            </div>
            <div className="cor-rc-b">
              <p className="cor-rc-p">
                If you need more information before deciding, use &quot;Request
                clarification&quot; and your contractor will respond.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .cor{display:flex;flex-direction:column;gap:20px}
        .cor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .cor-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .cor-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .cor-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}

        .cor-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.cor-kpis{grid-template-columns:repeat(2,1fr)}}

        .cor-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.cor-grid{grid-template-columns:1fr}}

        .cor-ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;min-width:0}
        .cor-ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
        .cor-ws-head h3{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
        .cor-ws-head .sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:4px;max-width:560px}

        .cor-ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
        .cor-wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-family:var(--fb);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df) var(--e)}
        .cor-wtab:hover{border-color:var(--s4);color:var(--t1)}
        .cor-wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:color-mix(in srgb,var(--ac) 30%,var(--s3))}

        .cor-split{display:grid;grid-template-columns:340px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}
        @media(max-width:900px){.cor-split{grid-template-columns:1fr}}

        .cor-queue{display:flex;flex-direction:column;gap:6px;max-height:640px;overflow-y:auto;min-width:0}
        .cor-queue::-webkit-scrollbar{width:4px}
        .cor-queue::-webkit-scrollbar-track{background:transparent}
        .cor-queue::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}

        .cor-cc{text-align:left;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e);display:flex;flex-direction:column;gap:4px}
        .cor-cc:hover{border-color:var(--s4);box-shadow:var(--shsm)}
        .cor-cc.on{border-color:color-mix(in srgb,var(--ac) 40%,var(--s3));background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
        .cor-cc-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
        .cor-cc-id{font-family:var(--fm);font-size:11px;color:var(--t3);letter-spacing:.02em}
        .cor-cc-title{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin-top:2px;letter-spacing:-.005em}
        .cor-cc-amt{font-family:var(--fd);font-size:14px;font-weight:750;margin-top:4px}
        .cor-cc-amt.add{color:var(--wr-t)}
        .cor-cc-amt.deduct{color:var(--ok-t)}
        .cor-cc-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px;font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3)}

        .cor-detail{min-width:0}

        .cor-rail{display:flex;flex-direction:column;gap:12px;min-width:0}
        .cor-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .cor-rc-h{padding:14px 16px 0}
        .cor-rc-h h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .cor-rc-h .sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:3px;display:block}
        .cor-rc-b{padding:10px 16px 16px}
        .cor-rc-p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

        .cor-ir{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--s2);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2)}
        .cor-ir:last-child{border-bottom:none}
        .cor-ir.strong{border-top:2px solid var(--s3);padding-top:10px;margin-top:4px;font-weight:700;color:var(--t1);border-bottom:none}
        .cor-ir-l{font-family:var(--fb);font-size:13px;font-weight:560;color:var(--t2)}
        .cor-ir.strong .cor-ir-l{color:var(--t1);font-weight:700}
        .cor-ir-v{font-family:var(--fd);font-size:14px;font-weight:750;color:var(--t1)}
        .cor-ir-v.warn{color:var(--wr-t)}
      `}</style>
    </div>
  );
}

function ClientChangeOrderDetail({ co }: { co: ChangeOrderRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function approve() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/change-orders/${co.id}/approve`, {
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

  async function reject() {
    if (!rejectReason.trim()) {
      setError("reason_required");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`/api/change-orders/${co.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    setShowReject(false);
    setRejectReason("");
    router.refresh();
  }

  const isPending = co.changeOrderStatus === "pending_client_approval";

  return (
    <div className="ccd">
      <div className="ccd-head">
        <div className="ccd-head-main">
          <div className="ccd-id">
            CO-{String(co.changeOrderNumber).padStart(3, "0")}
          </div>
          <h2 className="ccd-title">{co.title}</h2>
        </div>
        <div className="ccd-pills">
          <Pill color={isPending ? "red" : statusPill(co.changeOrderStatus)}>
            {isPending ? "Needs your approval" : formatStatus(co.changeOrderStatus)}
          </Pill>
        </div>
      </div>

      <div className="ccd-ic">
        <h4>Impact of this change</h4>
        <div className="ccd-ir">
          <div>
            <h5>Cost impact</h5>
            <p>Addition to your current contract value</p>
          </div>
          <span
            className={`ccd-iv ${co.amountCents > 0 ? "warn" : co.amountCents < 0 ? "ok" : ""}`}
          >
            {formatSignedCents(co.amountCents)}
          </span>
        </div>
        <div className="ccd-ir">
          <div>
            <h5>Schedule risk</h5>
            <p>If not approved this week, work may slip</p>
          </div>
          <span className="ccd-iv muted">Not tracked</span>
        </div>
        <div className="ccd-ir">
          <div>
            <h5>What triggered this</h5>
            <p>
              {co.originatingRfiNumber != null
                ? "Field condition documented in linked RFI"
                : "Scope change requested during construction"}
            </p>
          </div>
          <span className="ccd-iv accent">
            {co.originatingRfiNumber != null
              ? `RFI-${String(co.originatingRfiNumber).padStart(3, "0")}`
              : "Direct"}
          </span>
        </div>
      </div>

      {co.description && (
        <div className="ccd-section">
          <div className="ccd-section-head">
            <h4>Contractor&rsquo;s explanation</h4>
          </div>
          <div className="ccd-section-body">
            <p className="ccd-p">{co.description}</p>
          </div>
        </div>
      )}

      {co.reason && (
        <div className="ccd-section">
          <div className="ccd-section-head">
            <h4>Reason &amp; justification</h4>
          </div>
          <div className="ccd-section-body">
            <p className="ccd-p">{co.reason}</p>
          </div>
        </div>
      )}

      <div className="ccd-section">
        <div className="ccd-section-head">
          <h4>Supporting documents</h4>
        </div>
        <div className="ccd-section-body">
          <p className="ccd-p">
            Cost breakdowns, revised drawings, and other supporting files from
            your contractor will appear here.
          </p>
        </div>
      </div>

      {isPending && !showReject && (
        <div className="ccd-dec">
          <h4>Your decision</h4>
          <p>
            Approving this change order will add{" "}
            {formatSignedCents(co.amountCents)} to your contract and allow the
            work to proceed.
          </p>
          <div className="ccd-dec-acts">
            <button
              type="button"
              className="ccd-btn ok"
              onClick={approve}
              disabled={pending}
            >
              Approve
            </button>
            <button
              type="button"
              className="ccd-btn dg"
              onClick={() => setShowReject(true)}
              disabled={pending}
            >
              Reject
            </button>
            <button type="button" className="ccd-btn" disabled={pending}>
              Request clarification
            </button>
          </div>
        </div>
      )}

      {isPending && showReject && (
        <div className="ccd-dec">
          <h4>Reason for rejection</h4>
          <p>Let your contractor know what changes or information you need.</p>
          <textarea
            className="ccd-ta"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="What concerns do you have?"
          />
          <div className="ccd-dec-acts">
            <button
              type="button"
              className="ccd-btn"
              onClick={() => setShowReject(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="ccd-btn dg"
              onClick={reject}
              disabled={pending}
            >
              Send rejection
            </button>
          </div>
        </div>
      )}

      {error && <p className="ccd-err">Error: {error}</p>}

      <style>{`
        .ccd{display:flex;flex-direction:column;gap:14px;min-height:400px}
        .ccd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
        .ccd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}
        .ccd-id{font-family:var(--fm);font-size:12px;font-weight:520;color:var(--t3);letter-spacing:.02em}
        .ccd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em;color:var(--t1);margin:0}
        .ccd-pills{display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0;padding-top:2px}

        .ccd-ic{background:linear-gradient(180deg,color-mix(in srgb,var(--ac-s) 30%,var(--s1)),var(--s1));border:1px solid color-mix(in srgb,var(--ac) 30%,var(--s3));border-radius:var(--r-l);padding:16px}
        .ccd-ic h4{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0 0 10px}
        .ccd-ir{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}
        .ccd-ir:last-child{border-bottom:none}
        .ccd-ir h5{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1);margin:0}
        .ccd-ir p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:2px 0 0;line-height:1.45}
        .ccd-iv{font-family:var(--fd);font-size:14px;font-weight:750;white-space:nowrap;flex-shrink:0;color:var(--t1)}
        .ccd-iv.warn{color:var(--wr-t);font-size:16px}
        .ccd-iv.ok{color:var(--ok-t)}
        .ccd-iv.accent{color:var(--ac-t)}
        .ccd-iv.muted{color:var(--t3)}

        .ccd-section{border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
        .ccd-section-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
        .ccd-section-head h4{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0}
        .ccd-section-body{padding:14px 16px}
        .ccd-p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

        .ccd-dec{border:2px solid color-mix(in srgb,var(--ac) 35%,var(--s3));border-radius:var(--r-l);padding:18px;background:linear-gradient(180deg,color-mix(in srgb,var(--ac-s) 30%,var(--s1)),var(--s1));display:flex;flex-direction:column;gap:10px}
        .ccd-dec h4{font-family:var(--fd);font-size:15px;font-weight:750;color:var(--t1);margin:0}
        .ccd-dec p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0;line-height:1.5}
        .ccd-dec-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
        .ccd-dec-acts .ccd-btn{flex:1;min-width:120px;justify-content:center}

        .ccd-btn{height:38px;padding:0 16px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:13px;font-weight:650;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all var(--df) var(--e);white-space:nowrap}
        .ccd-btn:hover{border-color:var(--s4);background:var(--sh)}
        .ccd-btn.ok{background:var(--ok);border-color:var(--ok);color:#fff}
        .ccd-btn.ok:hover{background:var(--ok-t);border-color:var(--ok-t)}
        .ccd-btn.dg{border-color:color-mix(in srgb,var(--dg) 35%,var(--s3));color:var(--dg-t)}
        .ccd-btn.dg:hover{background:var(--dg-s)}
        .ccd-btn:disabled{opacity:.6;cursor:not-allowed}

        .ccd-ta{width:100%;padding:10px 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);line-height:1.5;resize:vertical;outline:none}
        .ccd-ta:focus{border-color:var(--ac)}

        .ccd-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      `}</style>
    </div>
  );
}
