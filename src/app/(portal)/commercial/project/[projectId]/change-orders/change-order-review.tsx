"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
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

export function CommercialChangeOrderReview({
  projectName,
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
          <div className="cor-crumbs">{projectName} · Change Orders</div>
          <h1 className="cor-title">Change Orders for Review</h1>
          <p className="cor-desc">
            Your contractor has submitted scope changes that need your approval.
            Review the cost and schedule impact, then approve or reject each one.
          </p>
        </div>
      </header>

      <div className="cor-kpis">
        <KpiCard
          label="Needs your review"
          value={pendingRows.length.toString()}
          meta="Decisions waiting on you"
          iconColor="red"
          alert={pendingRows.length > 0}
        />
        <KpiCard
          label="Pending total"
          value={formatSignedCents(totals.pendingChangesCents)}
          meta="If all approved"
          iconColor="amber"
        />
        <KpiCard
          label="Approved to date"
          value={formatSignedCents(totals.approvedChangesCents)}
          meta={`${rows.filter((r) => r.changeOrderStatus === "approved").length} change orders`}
          iconColor="green"
        />
        <KpiCard
          label="Current contract"
          value={formatCents(totals.currentContractCents)}
          meta="Original + approved"
          iconColor="blue"
        />
      </div>

      <div className="cor-grid">
        <Card
          tabs={TABS.map((t) => ({
            id: t.id,
            label: `${t.label} (${rows.filter(t.match).length})`,
          }))}
          activeTabId={activeTab}
          onTabChange={(id) => {
            setActiveTab(id as TabId);
            setSelectedId(null);
          }}
          title="Review queue"
          subtitle="Change orders submitted by your contractor for your formal approval."
          padded={false}
        >
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
                    className={`cor-row ${selected?.id === r.id ? "cor-row-sel" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="cor-row-top">
                      <div className="cor-row-id">
                        CO-{String(r.changeOrderNumber).padStart(3, "0")}
                      </div>
                      <Pill color={statusPill(r.changeOrderStatus)}>
                        {formatStatus(r.changeOrderStatus)}
                      </Pill>
                    </div>
                    <div className="cor-row-title">{r.title}</div>
                    <div
                      className={`cor-row-amt ${r.amountCents >= 0 ? "pos" : "neg"}`}
                    >
                      {formatSignedCents(r.amountCents)}
                    </div>
                    <div className="cor-row-foot">
                      <span>
                        {r.submittedAt
                          ? `Submitted ${formatDate(r.submittedAt)}`
                          : "—"}
                      </span>
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
        </Card>

        <div className="cor-rail">
          <Card title="Contract impact" subtitle="How pending COs affect your total.">
            <div className="cor-totals">
              <TotalRow label="Original contract" value={formatCents(totals.originalContractCents)} />
              <TotalRow label="Already approved" value={formatSignedCents(totals.approvedChangesCents)} />
              <TotalRow label="Pending" value={formatSignedCents(totals.pendingChangesCents)} tone="muted" />
              <TotalRow
                label="If all approved"
                value={formatCents(
                  totals.currentContractCents + totals.pendingChangesCents,
                )}
                strong
              />
            </div>
          </Card>
          <Card title="Questions?" subtitle="Contact your project team.">
            <p className="cor-hint">
              If you need more information before deciding, use &quot;Request
              clarification&quot; and your contractor will respond.
            </p>
          </Card>
        </div>
      </div>

      <style>{`
        .cor{display:flex;flex-direction:column;gap:20px}
        .cor-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .cor-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .cor-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .cor-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .cor-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .cor-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.cor-kpis{grid-template-columns:repeat(2,1fr)}}
        .cor-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.cor-grid{grid-template-columns:1fr}}
        .cor-split{display:grid;grid-template-columns:340px minmax(0,1fr)}
        @media(max-width:900px){.cor-split{grid-template-columns:1fr}}
        .cor-queue{border-right:1px solid var(--s3);max-height:640px;overflow-y:auto;display:flex;flex-direction:column}
        .cor-row{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s3);padding:14px 18px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:4px}
        .cor-row:hover{background:var(--sh)}
        .cor-row-sel{background:var(--ac-s)}
        .cor-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .cor-row-id{font-family:var(--fm);font-size:11px;font-weight:600;color:var(--t3);letter-spacing:.02em}
        .cor-row-title{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .cor-row-amt{font-family:var(--fd);font-size:14px;font-weight:750;margin-top:2px}
        .cor-row-amt.pos{color:var(--wr-t)}
        .cor-row-amt.neg{color:var(--ok-t)}
        .cor-row-foot{display:flex;align-items:center;gap:8px;margin-top:2px;font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .cor-detail{padding:22px 24px;min-width:0}
        .cor-rail{display:flex;flex-direction:column;gap:14px}
        .cor-hint{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
      `}</style>
    </div>
  );
}

function TotalRow({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "amber" | "muted";
  strong?: boolean;
}) {
  return (
    <>
      <div className={`cor-tr ${strong ? "cor-tr-strong" : ""}`}>
        <span className="cor-tr-l">{label}</span>
        <span className={`cor-tr-v cor-tr-${tone ?? ""}`}>{value}</span>
      </div>
      <style>{`
        .cor-tr{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--s2);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2)}
        .cor-tr:last-child{border-bottom:none}
        .cor-tr-strong{border-top:2px solid var(--s3);padding-top:10px;margin-top:4px;font-weight:700;color:var(--t1)}
        .cor-tr-v{font-family:var(--fd);font-weight:720;color:var(--t1)}
        .cor-tr-amber{color:var(--wr-t)}
        .cor-tr-muted{color:var(--t3)}
      `}</style>
    </>
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
          {co.description && <p className="ccd-desc">{co.description}</p>}
        </div>
        <div className="ccd-pills">
          <Pill color={isPending ? "red" : statusPill(co.changeOrderStatus)}>
            {isPending ? "Needs your approval" : formatStatus(co.changeOrderStatus)}
          </Pill>
        </div>
      </div>

      <div className="ccd-impact">
        <h3>Impact of this change</h3>
        <div className="ccd-imp-row">
          <div>
            <h5>Cost impact</h5>
            <p>Addition to your current contract value</p>
          </div>
          <span
            className="ccd-val"
            style={{
              color:
                co.amountCents >= 0 ? "var(--wr-t)" : "var(--ok-t)",
              fontSize: 18,
            }}
          >
            {formatSignedCents(co.amountCents)}
          </span>
        </div>
        {co.originatingRfiNumber != null && (
          <div className="ccd-imp-row">
            <div>
              <h5>What triggered this</h5>
              <p>Originated from an earlier field question</p>
            </div>
            <span className="ccd-val" style={{ color: "var(--ac-t)" }}>
              RFI-{String(co.originatingRfiNumber).padStart(3, "0")}
            </span>
          </div>
        )}
      </div>

      {co.reason && (
        <div className="ccd-section">
          <h3>Contractor&apos;s explanation</h3>
          <p>{co.reason}</p>
        </div>
      )}

      {co.rejectionReason && (
        <div className="ccd-section">
          <h3>Rejection note</h3>
          <p>{co.rejectionReason}</p>
        </div>
      )}

      {isPending && (
        <div className="ccd-decision">
          <h3>Your decision</h3>
          <p>
            Approving this change order will{" "}
            {co.amountCents >= 0 ? "add" : "reduce"} {formatSignedCents(co.amountCents)}{" "}
            to your contract.
          </p>
          {!showReject ? (
            <div className="ccd-acts">
              <Button variant="primary" onClick={approve} loading={pending}>
                Approve
              </Button>
              <Button variant="secondary" onClick={() => setShowReject(true)}>
                Reject
              </Button>
            </div>
          ) : (
            <div className="ccd-reject">
              <textarea
                className="ccd-inp ccd-ta"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection (required)"
              />
              <div className="ccd-acts">
                <Button variant="secondary" onClick={() => setShowReject(false)}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={reject} loading={pending}>
                  Confirm reject
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {co.changeOrderStatus === "approved" && co.approvedAt && (
        <div className="ccd-meta">
          Approved {formatDate(co.approvedAt)}
          {co.approvedByName ? ` by ${co.approvedByName}` : ""}
        </div>
      )}
      {error && <p className="ccd-err">Error: {error}</p>}

      <style>{`
        .ccd{display:flex;flex-direction:column;gap:16px}
        .ccd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
        .ccd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
        .ccd-id{font-family:var(--fm);font-size:12px;font-weight:600;color:var(--t3);letter-spacing:.02em}
        .ccd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.015em;color:var(--t1);margin:0}
        .ccd-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .ccd-pills{flex-shrink:0}
        .ccd-impact{border:1px solid var(--ac-m);border-radius:var(--r-l);padding:16px;background:linear-gradient(180deg,color-mix(in srgb,var(--ac-s) 30%,var(--s1)),var(--s1))}
        .ccd-impact h3{font-family:var(--fd);font-size:14px;font-weight:720;margin:0 0 10px}
        .ccd-imp-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}
        .ccd-imp-row:last-child{border-bottom:none}
        .ccd-imp-row h5{font-family:var(--fd);font-size:13px;font-weight:680;margin:0;color:var(--t1)}
        .ccd-imp-row p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:2px 0 0}
        .ccd-val{font-family:var(--fd);font-size:14px;font-weight:750;white-space:nowrap}
        .ccd-section h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0 0 6px}
        .ccd-section p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .ccd-decision{border:2px solid var(--ac-m);border-radius:var(--r-l);padding:18px;background:linear-gradient(180deg,color-mix(in srgb,var(--ac-s) 30%,var(--s1)),var(--s1))}
        .ccd-decision h3{font-family:var(--fd);font-size:15px;font-weight:750;margin:0}
        .ccd-decision p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.5;margin:4px 0 14px}
        .ccd-acts{display:flex;gap:8px;flex-wrap:wrap}
        .ccd-reject{display:flex;flex-direction:column;gap:10px}
        .ccd-inp{width:100%;padding:10px 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;color:var(--t1)}
        .ccd-inp:focus{outline:none;border-color:var(--ac)}
        .ccd-ta{resize:vertical;line-height:1.5}
        .ccd-meta{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2)}
        .ccd-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      `}</style>
    </div>
  );
}
