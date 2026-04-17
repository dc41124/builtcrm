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
  nowMs: now,
}: {
  projectId: string;
  projectName: string;
  rows: ChangeOrderRow[];
  totals: ChangeOrderTotals;
  nowMs: number;
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
                  <ContractorChangeOrderDetail key={selected.id} co={selected} now={now} />
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
                        (now - r.submittedAt.getTime()) / 86400000,
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

      
    </div>
  );
}

function ContractorChangeOrderDetail({ co, now }: { co: ChangeOrderRow; now: number }) {
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
    ? Math.floor((now - co.submittedAt.getTime()) / 86400000)
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
          <div
            className={`cod-v ${co.scheduleImpactDays > 0 ? "warn" : co.scheduleImpactDays < 0 ? "ok" : ""}`}
          >
            {co.scheduleImpactDays === 0
              ? "No change"
              : co.scheduleImpactDays > 0
                ? `+${co.scheduleImpactDays} days`
                : `${co.scheduleImpactDays} days`}
          </div>
          <div className="cod-m">
            {co.scheduleImpactDays > 0
              ? "Risk if not approved soon"
              : co.scheduleImpactDays < 0
                ? "Schedule benefit"
                : "No timeline effect"}
          </div>
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
          {co.supportingDocuments.length === 0 ? (
            <p className="cod-p">
              Attach cost breakdowns, revised drawings, or other supporting
              files for the client reviewer.
            </p>
          ) : (
            co.supportingDocuments.map((d) => (
              <div key={d.id} className="cod-fr">
                <div>
                  <h5>{d.title}</h5>
                  <p>{formatStatus(d.linkRole)}</p>
                </div>
                <span className="cod-fc">
                  {extensionFor(d.documentType)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="cod-section">
        <div className="cod-section-head">
          <h4>Approval timeline</h4>
        </div>
        <div className="cod-section-body">
          <div className="cod-activity">
            {co.activityTrail.length > 0 ? (
              co.activityTrail.map((ev) => (
                <div key={ev.id} className="cod-ai">
                  <div className={`cod-dot ${activityDotClass(ev.activityType)}`} />
                  <div className="cod-at">
                    {ev.actorName ? (
                      <>
                        <strong>{ev.actorName}</strong> {ev.title.toLowerCase()}
                      </>
                    ) : (
                      ev.title
                    )}
                    {ev.body ? ` — ${ev.body}` : ""}
                  </div>
                  <div className="cod-atm">{formatDate(ev.createdAt)}</div>
                </div>
              ))
            ) : (
              <>
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
                      <strong>{co.approvedByName ?? "Client"}</strong> approved
                      this change order
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
              </>
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
      
    </div>
  );
}

function extensionFor(documentType: string): string {
  const lower = documentType.toLowerCase();
  if (lower.includes("drawing") || lower.includes("cad")) return "DWG";
  if (lower.includes("photo") || lower.includes("image")) return "JPG";
  if (lower.includes("spec")) return "SPEC";
  return "PDF";
}

function activityDotClass(type: string): string {
  if (type === "approval_completed") return "ok";
  if (type === "approval_requested") return "action";
  if (type === "comment_added") return "action";
  if (type === "file_uploaded") return "action";
  return "sys";
}
