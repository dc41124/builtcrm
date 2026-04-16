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
            <p>
              {co.scheduleImpactDays > 0
                ? "If not approved soon, work may slip"
                : co.scheduleImpactDays < 0
                  ? "Approval brings schedule benefit"
                  : "No timeline effect"}
            </p>
          </div>
          <span
            className={`ccd-iv ${co.scheduleImpactDays > 0 ? "warn" : co.scheduleImpactDays < 0 ? "ok" : "muted"}`}
          >
            {co.scheduleImpactDays === 0
              ? "No change"
              : co.scheduleImpactDays > 0
                ? `+${co.scheduleImpactDays} days`
                : `${co.scheduleImpactDays} days`}
          </span>
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
          {co.supportingDocuments.length === 0 ? (
            <p className="ccd-p">
              Cost breakdowns, revised drawings, and other supporting files
              from your contractor will appear here.
            </p>
          ) : (
            co.supportingDocuments.map((d) => (
              <div key={d.id} className="ccd-fr">
                <div>
                  <h5>{d.title}</h5>
                  <p>{formatStatus(d.linkRole)}</p>
                </div>
                <span className="ccd-fc">
                  {commercialExtensionFor(d.documentType)}
                </span>
              </div>
            ))
          )}
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

      
    </div>
  );
}

function commercialExtensionFor(documentType: string): string {
  const lower = documentType.toLowerCase();
  if (lower.includes("drawing") || lower.includes("cad")) return "DWG";
  if (lower.includes("photo") || lower.includes("image")) return "JPG";
  if (lower.includes("spec")) return "SPEC";
  return "PDF";
}
