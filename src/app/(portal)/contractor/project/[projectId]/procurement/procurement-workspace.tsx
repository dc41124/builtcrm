"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  PoDetailView,
  PoListRow,
  ProcurementProjectView,
} from "@/domain/loaders/procurement";
import {
  STATE_STRIP_ORDER,
  canBeRevised,
  canTransition,
  statusLabel,
  statusPillClass,
  type PurchaseOrderStatus,
} from "@/domain/procurement/state-machine";
import {
  formatCentsUsd,
  formatCentsCompact,
} from "@/domain/procurement/totals";

import { CreatePoModal, type CreatePoInitialLine } from "./create-po-modal";

// ─────────────────────────────────────────────────────────────────────────────
// Small inline SVG icons — matches JSX prototype's `I.*` set
// ─────────────────────────────────────────────────────────────────────────────
const I = {
  plus: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  download: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  truck: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  invoice: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
    </svg>
  ),
  check: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  file: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M13 2v7h7" />
    </svg>
  ),
  edit: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z" />
    </svg>
  ),
};

// ─────────────────────────────────────────────────────────────────────────────
// Types + helpers
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilterKey = "all" | "open" | "receiving" | "invoicing" | "closed" | "drafts";

const STATUS_FILTERS: Array<{ key: StatusFilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "receiving", label: "Receiving" },
  { key: "invoicing", label: "To invoice / close" },
  { key: "closed", label: "Closed" },
  { key: "drafts", label: "Drafts" },
];

function matchesStatusFilter(status: PurchaseOrderStatus, key: StatusFilterKey): boolean {
  switch (key) {
    case "all":
      return true;
    case "open":
      return ["issued", "revised", "partially_received"].includes(status);
    case "receiving":
      return ["partially_received", "fully_received"].includes(status);
    case "invoicing":
      return ["fully_received", "invoiced"].includes(status);
    case "closed":
      return status === "closed";
    case "drafts":
      return status === "draft";
  }
}

function formatDate(d: Date | null | string, withYear = true): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear && { year: "numeric" }),
  });
}

function formatDateTime(d: Date | null | string): string {
  if (!d) return "—";
  const date = new Date(d);
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

function mapPillClass(status: PurchaseOrderStatus): string {
  const raw = statusPillClass(status);
  // Match the JSX prototype's .pl.{color} classes; stays local to this
  // file so it doesn't leak into app-wide styles.
  return raw;
}

// Status-label text mapped to the JSX prototype's wording.
function poStatusLabel(s: PurchaseOrderStatus): string {
  return statusLabel(s);
}

// Action buttons available in the detail footer based on current status.
function detailActions(status: PurchaseOrderStatus): Array<"invoice" | "close"> {
  const actions: Array<"invoice" | "close"> = [];
  if (canTransition(status, "invoiced")) actions.push("invoice");
  if (canTransition(status, "closed")) actions.push("close");
  return actions;
}

type ReceivingDraft = Record<string, string>;

// ─────────────────────────────────────────────────────────────────────────────
// Main workspace
// ─────────────────────────────────────────────────────────────────────────────

export function ProcurementWorkspace({ view }: { view: ProcurementProjectView }) {
  const router = useRouter();
  const [activePoId, setActivePoId] = useState<string | null>(
    view.activePo?.id ?? null,
  );
  const [activeTab, setActiveTab] = useState<StatusFilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState<string>("");
  const [costCodeFilter, setCostCodeFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<"newest" | "oldest" | "amount">("newest");
  const [showCreate, setShowCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receivingDraft, setReceivingDraft] = useState<ReceivingDraft>({});

  const projectId = view.projectId;
  const activePo = view.activePo;

  const tabCounts = useMemo(() => {
    const counts: Record<StatusFilterKey, number> = {
      all: view.purchaseOrders.length,
      open: 0,
      receiving: 0,
      invoicing: 0,
      closed: 0,
      drafts: 0,
    };
    for (const row of view.purchaseOrders) {
      for (const f of STATUS_FILTERS) {
        if (f.key !== "all" && matchesStatusFilter(row.status, f.key)) {
          counts[f.key]++;
        }
      }
    }
    return counts;
  }, [view.purchaseOrders]);

  const filteredRows = useMemo(() => {
    let rows = view.purchaseOrders.filter((r) =>
      matchesStatusFilter(r.status, activeTab),
    );
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.poNumber.toLowerCase().includes(q) ||
          r.vendorName.toLowerCase().includes(q) ||
          (r.costCodeLabel ?? "").toLowerCase().includes(q),
      );
    }
    if (vendorFilter) {
      rows = rows.filter((r) => r.vendorId === vendorFilter);
    }
    if (costCodeFilter) {
      rows = rows.filter((r) => r.costCodeId === costCodeFilter);
    }
    switch (sortKey) {
      case "oldest":
        rows = [...rows].sort(
          (a, b) =>
            (a.orderedAt?.getTime() ?? 0) - (b.orderedAt?.getTime() ?? 0),
        );
        break;
      case "amount":
        rows = [...rows].sort((a, b) => b.totalCents - a.totalCents);
        break;
      default:
        // newest = default (already ordered by createdAt desc in loader)
        break;
    }
    return rows;
  }, [view.purchaseOrders, activeTab, searchQuery, vendorFilter, costCodeFilter, sortKey]);

  async function handleSelectPo(id: string) {
    setActivePoId(id);
    router.push(`/contractor/project/${projectId}/procurement?po=${id}`, {
      scroll: false,
    });
  }

  async function postAction(
    url: string,
    body?: Record<string, unknown>,
  ): Promise<boolean> {
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErrorMsg(j.message ?? j.error ?? `Request failed (${res.status})`);
        return false;
      }
      router.refresh();
      return true;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Network error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleInvoice() {
    if (!activePo) return;
    await postAction(`/api/procurement/purchase-orders/${activePo.id}/invoice`);
  }
  async function handleClose() {
    if (!activePo) return;
    await postAction(`/api/procurement/purchase-orders/${activePo.id}/close`);
  }
  async function handleIssueDraft() {
    if (!activePo) return;
    await postAction(
      `/api/procurement/purchase-orders/${activePo.id}/issue`,
      {},
    );
  }

  async function handleSaveReceive() {
    if (!activePo) return;
    const received = activePo.lines
      .map((l) => {
        const draftVal = receivingDraft[l.id];
        if (draftVal === undefined) return null;
        const num = parseFloat(draftVal);
        if (!Number.isFinite(num)) return null;
        return { lineId: l.id, receivedQuantity: num };
      })
      .filter((x): x is { lineId: string; receivedQuantity: number } => !!x);
    if (received.length === 0) return;
    const ok = await postAction(
      `/api/procurement/purchase-orders/${activePo.id}/receive`,
      { received },
    );
    if (ok) setReceivingDraft({});
  }

  async function handleDownloadPdf() {
    if (!activePo) return;
    const latestDoc = activePo.documents.find((d) => !d.isSuperseded);
    if (!latestDoc) {
      setErrorMsg("No issued PDF yet — issue the PO first.");
      return;
    }
    const res = await fetch(`/api/files/${latestDoc.id}`);
    if (!res.ok) {
      setErrorMsg("Could not fetch download link.");
      return;
    }
    const j = await res.json();
    if (j.downloadUrl) {
      window.open(j.downloadUrl, "_blank");
    }
  }

  const hasZeroCostCodes = view.costCodes.length === 0;

  async function handleSeedCsi() {
    await postAction("/api/procurement/cost-codes/seed-csi");
  }

  return (
    <div className="proc-ws">
      <style>{PROCUREMENT_CSS}</style>

      {/* ── Header ───────────────────────────────── */}
      <div className="pg-h">
        <div>
          <h2>Procurement / POs</h2>
          <p>
            Issue, track, receive, and close purchase orders for materials
            and equipment. Each PO has line items, a state machine, linked
            documents, and an audit trail.
          </p>
        </div>
        <div className="pg-h-acts">
          <Link
            href="/contractor/vendors"
            className="btn sm"
          >
            Vendors
          </Link>
          <Link
            href="/contractor/cost-codes"
            className="btn sm"
          >
            Cost codes
          </Link>
          <button
            type="button"
            className="btn sm pri"
            onClick={() => {
              setShowCreate(true);
              setErrorMsg(null);
            }}
            disabled={view.vendors.length === 0 || hasZeroCostCodes}
            title={
              view.vendors.length === 0
                ? "Add a vendor first"
                : hasZeroCostCodes
                  ? "Configure at least one cost code first"
                  : undefined
            }
          >
            {I.plus} New PO
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="err-banner" role="alert">
          {errorMsg}
        </div>
      )}

      {/* ── CSI starter first-run banner ─────────── */}
      {hasZeroCostCodes && (
        <div className="csi-banner">
          <div>
            <div className="csi-title">Configure cost codes to start issuing POs</div>
            <div className="csi-sub">
              Cost codes organize spend by CSI MasterFormat division (05
              Metals, 23 HVAC, etc.) or your internal scheme. Populate the
              25-code CSI division starter set, or add custom codes.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <Link href="/contractor/cost-codes" className="btn sm">
              Add custom code
            </Link>
            <button
              type="button"
              className="btn sm pri"
              onClick={handleSeedCsi}
              disabled={busy}
            >
              Populate CSI starter set
            </button>
          </div>
        </div>
      )}

      {/* ── KPI strip ─────────────────────────────── */}
      <div className="ss">
        <div className="sc">
          <div className="sc-label">Open POs</div>
          <div className="sc-value">{view.kpis.openPoCount}</div>
          <div className="sc-meta">Issued or receiving</div>
        </div>
        <div className="sc alert">
          <div className="sc-label">Committed (open)</div>
          <div className="sc-value">
            {formatCentsCompact(view.kpis.committedCents)}
          </div>
          <div className="sc-meta">Across open POs</div>
        </div>
        <div className="sc strong">
          <div className="sc-label">Awaiting invoice</div>
          <div className="sc-value">{view.kpis.awaitingInvoiceCount}</div>
          <div className="sc-meta">Fully received, not closed</div>
        </div>
        <div className="sc">
          <div className="sc-label">Spent YTD</div>
          <div className="sc-value">
            {formatCentsCompact(view.kpis.spentYtdCents)}
          </div>
          <div className="sc-meta">
            {view.kpis.closedYtdCount} POs closed this year
          </div>
        </div>
      </div>

      <div className="pg-grid">
        {/* ── List workspace ───────────────────── */}
        <div className="ws">
          <div className="ws-head">
            <div>
              <h3>All purchase orders</h3>
              <div className="sub">Tap a row to open in the detail pane.</div>
            </div>
          </div>

          <div className="ws-tabs">
            {STATUS_FILTERS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`wtab${activeTab === t.key ? " on" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
                <span className="c">{tabCounts[t.key]}</span>
              </button>
            ))}
          </div>

          <div className="q-tb">
            <input
              className="q-in"
              placeholder="Filter by PO, vendor, cost code…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <select
              className="q-sel"
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
            >
              <option value="">All vendors</option>
              {view.vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <select
              className="q-sel"
              value={costCodeFilter}
              onChange={(e) => setCostCodeFilter(e.target.value)}
            >
              <option value="">All cost codes</option>
              {view.costCodes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.description}
                </option>
              ))}
            </select>
            <select
              className="q-sel"
              value={sortKey}
              onChange={(e) =>
                setSortKey(e.target.value as typeof sortKey)
              }
            >
              <option value="newest">Sort: Newest first</option>
              <option value="oldest">Sort: Oldest first</option>
              <option value="amount">Sort: Highest amount</option>
            </select>
          </div>

          <div className="ws-body">
            {filteredRows.length === 0 ? (
              <div className="empty">
                No purchase orders match these filters.
              </div>
            ) : (
              <table className="po-tbl">
                <thead>
                  <tr>
                    <th>PO #</th>
                    <th>Vendor / cost code</th>
                    <th>Lines</th>
                    <th>Status</th>
                    <th>Ordered / ETA</th>
                    <th className="r">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <PoRowView
                      key={row.id}
                      row={row}
                      active={row.id === activePoId}
                      onSelect={() => handleSelectPo(row.id)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Detail drawer ────────────────────── */}
        {activePo ? (
          <PoDetailPanel
            po={activePo}
            busy={busy}
            receivingDraft={receivingDraft}
            setReceivingDraft={setReceivingDraft}
            onIssue={handleIssueDraft}
            onSaveReceive={handleSaveReceive}
            onInvoice={handleInvoice}
            onClose={handleClose}
            onDownloadPdf={handleDownloadPdf}
          />
        ) : (
          <div className="detail empty-detail">
            <p>Select a PO to see details, line items, and activity.</p>
          </div>
        )}
      </div>

      {showCreate && (
        <CreatePoModal
          projectId={projectId}
          defaultTaxRatePercent={view.defaultTaxRatePercent}
          vendors={view.vendors}
          costCodes={view.costCodes}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row + detail subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function PoRowView({
  row,
  active,
  onSelect,
}: {
  row: PoListRow;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <tr className={active ? "on" : ""} onClick={onSelect}>
      <td>
        <div className="po-num">{row.poNumber}</div>
        {row.revisionNumber > 1 && (
          <div className="po-sub">rev {row.revisionNumber}</div>
        )}
      </td>
      <td>
        <div className="po-vendor">{row.vendorName}</div>
        <div className="po-sub">{row.costCodeLabel ?? "—"}</div>
      </td>
      <td>
        <span className="mono">{row.linesReceivedLabel}</span>
      </td>
      <td>
        <span className={`pl ${mapPillClass(row.status)}`}>
          {poStatusLabel(row.status)}
        </span>
      </td>
      <td>
        <div style={{ fontSize: 12 }}>
          {row.orderedAt ? formatDate(row.orderedAt) : "—"}
        </div>
        <div className="po-sub">
          {row.expectedDeliveryAt
            ? `ETA ${formatDate(row.expectedDeliveryAt, false)}`
            : ""}
        </div>
      </td>
      <td className="r">{formatCentsUsd(row.totalCents)}</td>
    </tr>
  );
}

function PoDetailPanel({
  po,
  busy,
  receivingDraft,
  setReceivingDraft,
  onIssue,
  onSaveReceive,
  onInvoice,
  onClose,
  onDownloadPdf,
}: {
  po: PoDetailView;
  busy: boolean;
  receivingDraft: ReceivingDraft;
  setReceivingDraft: (d: ReceivingDraft) => void;
  onIssue: () => void;
  onSaveReceive: () => void;
  onInvoice: () => void;
  onClose: () => void;
  onDownloadPdf: () => void;
}) {
  const actions = detailActions(po.status);
  const isDraft = po.status === "draft";
  const canReceive =
    po.status === "issued" ||
    po.status === "revised" ||
    po.status === "partially_received";
  const hasReceiveChanges = Object.keys(receivingDraft).length > 0;
  const revisable = canBeRevised(po.status);

  return (
    <div className="detail">
      <div className="det-h">
        <div>
          <div className="det-h-t">
            {po.poNumber}
            {po.revisionNumber > 1 ? ` · rev ${po.revisionNumber}` : ""}
          </div>
          <div className="det-h-v">{po.vendorName}</div>
          <div className="det-h-m">
            {po.projectName}
            {po.costCodeLabel ? ` · ${po.costCodeLabel}` : ""}
          </div>
        </div>
        <span className={`pl ${mapPillClass(po.status)}`}>
          {poStatusLabel(po.status)}
        </span>
      </div>

      {/* State-machine strip */}
      <div className="sm-strip">
        {STATE_STRIP_ORDER.map((s, i) => {
          const currIdx = STATE_STRIP_ORDER.indexOf(po.status);
          let cls = "";
          if (po.status === "cancelled" || po.status === "revised") {
            // Revised reads as "issued" in the strip, with a "revised" tag next to
            // the issued state. Cancelled doesn't appear in the strip at all.
            if (s === "issued" && po.status === "revised") cls = " cur";
          } else if (currIdx === i) cls = " cur";
          else if (currIdx > i) cls = " done";
          return (
            <span key={s}>
              <span className={`sm-s${cls}`}>
                {currIdx > i ? I.check : null}
                {statusLabel(s)}
              </span>
              {i < STATE_STRIP_ORDER.length - 1 && (
                <span className="sm-arrow">›</span>
              )}
            </span>
          );
        })}
      </div>

      <div className="det-body">
        <div className="dg">
          <div className="dg-i">
            <div className="k">Ordered</div>
            <div className="v">
              {po.orderedAt ? formatDateTime(po.orderedAt) : "—"}
            </div>
            <div className="m">
              {po.orderedByDisplayName ? `by ${po.orderedByDisplayName}` : ""}
            </div>
          </div>
          <div className="dg-i">
            <div className="k">Expected delivery</div>
            <div className="v">
              {po.expectedDeliveryAt ? formatDate(po.expectedDeliveryAt) : "—"}
            </div>
          </div>
          <div className="dg-i">
            <div className="k">Vendor contact</div>
            <div className="v">{po.vendorContactName ?? "—"}</div>
            <div className="m">{po.vendorContactEmail ?? ""}</div>
          </div>
          <div className="dg-i">
            <div className="k">Payment terms</div>
            <div className="v">{po.paymentTerms ?? "—"}</div>
            <div className="m">
              Tax {parseFloat(po.taxRatePercent).toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="ds">
          <div className="ds-h">
            <h4>Line items &amp; receiving</h4>
            {canReceive && hasReceiveChanges && (
              <button
                type="button"
                className="btn sm pri"
                disabled={busy}
                onClick={onSaveReceive}
              >
                {I.truck} Save receiving
              </button>
            )}
          </div>
          {po.lines.map((l) => {
            const qty = parseFloat(l.quantity);
            const recvStored = parseFloat(l.receivedQuantity);
            const draftVal = receivingDraft[l.id];
            const recv = draftVal !== undefined ? parseFloat(draftVal) : recvStored;
            const isReceived = Number.isFinite(recv) && recv >= qty && qty > 0;
            return (
              <div key={l.id} className={`li${isReceived ? " received" : ""}`}>
                <div className="li-top">
                  <div style={{ flex: 1 }}>
                    <div className="li-desc">{l.description}</div>
                    <div className="li-meta">
                      {parseFloat(l.quantity)} {l.unit} ×{" "}
                      {formatCentsUsd(l.unitCostCents)} / {l.unit}
                    </div>
                  </div>
                  <span
                    className={`pl ${isReceived ? "green" : "neutral"}`}
                  >
                    {isReceived ? "Received" : "Pending"}
                  </span>
                </div>
                <div className="li-foot">
                  <div className="li-recv">
                    Received:{" "}
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      max={l.quantity}
                      defaultValue={l.receivedQuantity}
                      disabled={!canReceive}
                      onChange={(e) =>
                        setReceivingDraft({
                          ...receivingDraft,
                          [l.id]: e.target.value,
                        })
                      }
                    />
                    {" / "}
                    {parseFloat(l.quantity)}
                  </div>
                  <div className="li-total">
                    {formatCentsUsd(l.lineTotalCents)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {po.notes && (
          <div className="ds">
            <div className="ds-h">
              <h4>Notes</h4>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.55 }}>{po.notes}</div>
          </div>
        )}

        <div className="ds">
          <div className="ds-h">
            <h4>Linked documents</h4>
          </div>
          {po.documents.length === 0 ? (
            <div style={{ fontSize: 12, color: "#888" }}>
              {isDraft
                ? "The PO PDF is generated on issue."
                : "No documents yet."}
            </div>
          ) : (
            po.documents.map((d) => (
              <div key={d.id} className="fr">
                <div className="fr-l">
                  <div className="fr-ic">{I.file}</div>
                  <div>
                    <h5>{d.title}</h5>
                    <p>
                      {d.fileSizeBytes
                        ? `${Math.round(d.fileSizeBytes / 1024)} KB`
                        : ""}
                      {d.isSuperseded ? " · superseded" : ""}
                    </p>
                  </div>
                </div>
                <span className="fc">{d.category}</span>
              </div>
            ))
          )}
        </div>

        <div className="ds">
          <div className="ds-h">
            <h4>Activity</h4>
          </div>
          {po.activity.length === 0 ? (
            <div style={{ fontSize: 12, color: "#888" }}>No activity yet.</div>
          ) : (
            <div className="al">
              {po.activity.map((a) => (
                <div key={a.id} className="ai">
                  <div className="a-dot action" />
                  <div className="a-text">
                    <strong>{a.actorDisplayName ?? "System"}</strong> —{" "}
                    {a.action.replace(/_/g, " ")}
                  </div>
                  <div className="a-time">
                    {formatDateTime(a.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="tot">
        <div className="tot-row">
          <span className="k">Subtotal</span>
          <span className="v">{formatCentsUsd(po.subtotalCents)}</span>
        </div>
        <div className="tot-row">
          <span className="k">
            Tax ({parseFloat(po.taxRatePercent).toFixed(2)}%)
          </span>
          <span className="v">{formatCentsUsd(po.taxAmountCents)}</span>
        </div>
        <div className="tot-row grand">
          <span>Total</span>
          <span className="v">{formatCentsUsd(po.totalCents)}</span>
        </div>
        <div
          style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}
        >
          {isDraft && (
            <button
              type="button"
              className="btn sm pri"
              onClick={onIssue}
              disabled={busy}
              style={{ flex: 1 }}
            >
              {I.check} Issue PO
            </button>
          )}
          {!isDraft && (
            <button
              type="button"
              className="btn sm"
              style={{ flex: 1 }}
              onClick={onDownloadPdf}
              disabled={busy}
            >
              {I.download} PDF
            </button>
          )}
          {actions.includes("invoice") && (
            <button
              type="button"
              className="btn sm"
              style={{ flex: 1 }}
              onClick={onInvoice}
              disabled={busy}
            >
              {I.invoice} Log invoice
            </button>
          )}
          {actions.includes("close") && (
            <button
              type="button"
              className="btn sm pri"
              style={{ flex: 1 }}
              onClick={onClose}
              disabled={busy}
            >
              {I.check} Close PO
            </button>
          )}
          {revisable && (
            <button
              type="button"
              className="btn sm"
              style={{ flex: 1 }}
              disabled
              title="Revise flow UI lands in a follow-up. The /revise API route is wired."
            >
              {I.edit} Revise
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline CSS — copied from builtcrm_procurement_workflow.jsx spec, scoped
// under `.proc-ws` so it cannot leak into other parts of the portal.
// ─────────────────────────────────────────────────────────────────────────────

const PROCUREMENT_CSS = `
.proc-ws{
  --s0:#eef0f3;--s1:#fff;--s2:#f3f4f6;--s3:#e2e5e9;--s4:#d1d5db;
  --sh:#f5f6f8;--sa:#e5e7eb;--si:#f8f9fa;
  --t1:#1a1714;--t2:#6b655b;--t3:#9c958a;
  --ac:#5b4fc7;--ac-h:#4f44b3;--ac-s:#eeedfb;--ac-t:#4a3fb0;--ac-m:#c7c2ea;
  --ok:#2d8a5e;--ok-s:#edf7f1;--ok-t:#1e6b46;
  --wr:#c17a1a;--wr-s:#fdf4e6;--wr-t:#96600f;
  --dg:#c93b3b;--dg-s:#fdeaea;--dg-t:#a52e2e;
  --in:#3178b9;--in-s:#e8f1fa;--in-t:#276299;
  --fd:'DM Sans',system-ui,sans-serif;
  --fb:'Instrument Sans',system-ui,sans-serif;
  --fm:'JetBrains Mono',monospace;
  --r-s:6px;--r-m:10px;--r-l:14px;--r-xl:18px;
  --shsm:0 1px 3px rgba(26,23,20,.05);--shmd:0 4px 16px rgba(26,23,20,.06);
  --shlg:0 8px 32px rgba(26,23,20,.1);
  --e:cubic-bezier(.16,1,.3,1);--df:120ms;--dn:200ms;
  font-family:var(--fb);color:var(--t1);font-size:14px;
}

.proc-ws .pg-h{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:16px;flex-wrap:wrap}
.proc-ws .pg-h h2{font-family:var(--fd);font-size:24px;font-weight:750;letter-spacing:-.03em}
.proc-ws .pg-h p{margin-top:4px;font-size:13px;color:var(--t2);max-width:620px;line-height:1.5}
.proc-ws .pg-h-acts{display:flex;gap:8px;flex-shrink:0;padding-top:4px}

.proc-ws .ss{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
@media (max-width:960px){.proc-ws .ss{grid-template-columns:repeat(2,1fr)}}
.proc-ws .sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm)}
.proc-ws .sc.alert{border-color:#f5d5a0}
.proc-ws .sc.strong{border-color:var(--ac-m)}
.proc-ws .sc-label{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
.proc-ws .sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px}
.proc-ws .sc-meta{font-size:12px;color:var(--t3);margin-top:2px}

.proc-ws .btn{height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--s3);background:var(--s1);color:var(--t1);cursor:pointer;white-space:nowrap;font-family:var(--fb);text-decoration:none;transition:all var(--df) var(--e)}
.proc-ws .btn:hover{border-color:var(--s4);background:var(--sh)}
.proc-ws .btn.pri{background:var(--ac);border-color:var(--ac);color:white}
.proc-ws .btn.pri:hover{background:var(--ac-h)}
.proc-ws .btn.sm{height:32px;padding:0 12px;font-size:12px}
.proc-ws .btn:disabled{opacity:.4;cursor:not-allowed}

.proc-ws .pl{height:22px;padding:0 9px;border-radius:999px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;border:1px solid var(--s3);background:var(--s1);color:var(--t3);white-space:nowrap;flex-shrink:0;font-family:var(--fd);letter-spacing:.02em}
.proc-ws .pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.proc-ws .pl.green{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.proc-ws .pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:#f5d5a0}
.proc-ws .pl.red{background:var(--dg-s);color:var(--dg-t);border-color:#f5baba}
.proc-ws .pl.blue{background:var(--in-s);color:var(--in-t);border-color:#b3d1ec}
.proc-ws .pl.neutral{background:var(--s2);color:var(--t2);border-color:var(--s3)}

.proc-ws .mono{font-family:var(--fm);font-size:12px;color:var(--t1);letter-spacing:.01em}

.proc-ws .err-banner{background:var(--dg-s);color:var(--dg-t);border:1px solid #f5baba;border-radius:var(--r-m);padding:10px 14px;margin-bottom:12px;font-size:13px}

.proc-ws .csi-banner{background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-l);padding:16px 18px;display:flex;justify-content:space-between;gap:16px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
.proc-ws .csi-title{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--ac-t)}
.proc-ws .csi-sub{font-size:12px;color:var(--t2);margin-top:4px;max-width:620px;line-height:1.5}

.proc-ws .pg-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
@media (max-width:1060px){.proc-ws .pg-grid{grid-template-columns:1fr}}

.proc-ws .ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
.proc-ws .ws-head{padding:16px 20px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:1px solid var(--s3)}
.proc-ws .ws-head h3{font-family:var(--fd);font-size:14px;font-weight:700}
.proc-ws .ws-head .sub{font-size:12px;color:var(--t3);margin-top:2px}

.proc-ws .ws-tabs{display:flex;gap:6px;padding:12px 20px;border-bottom:1px solid var(--s3);flex-wrap:wrap;align-items:center}
.proc-ws .wtab{height:30px;padding:0 12px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-size:12px;font-weight:650;display:inline-flex;align-items:center;gap:5px;cursor:pointer}
.proc-ws .wtab:hover{border-color:var(--s4);color:var(--t1)}
.proc-ws .wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.proc-ws .wtab .c{font-family:var(--fd);font-size:10px;font-weight:700;color:var(--t3);padding:1px 6px;background:var(--s2);border-radius:999px}
.proc-ws .wtab.on .c{background:var(--s1);color:var(--ac-t)}

.proc-ws .q-tb{display:flex;gap:8px;padding:10px 20px;background:var(--si);border-bottom:1px solid var(--s3);align-items:center;flex-wrap:wrap}
.proc-ws .q-sel,.proc-ws .q-in{height:32px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);padding:0 10px;font-size:12px;font-family:var(--fb);outline:none}
.proc-ws .q-in{flex:1;min-width:200px}

.proc-ws .ws-body{max-height:560px;overflow:auto}
.proc-ws .empty{padding:40px 20px;text-align:center;color:var(--t3);font-size:13px}

.proc-ws .po-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
.proc-ws .po-tbl thead th{position:sticky;top:0;background:var(--sh);font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);padding:10px 14px;text-align:left;border-bottom:1px solid var(--s3);white-space:nowrap}
.proc-ws .po-tbl thead th.r{text-align:right}
.proc-ws .po-tbl tbody td{padding:12px 14px;border-bottom:1px solid var(--s3);color:var(--t1);vertical-align:middle}
.proc-ws .po-tbl tbody td.r{text-align:right;font-family:var(--fm)}
.proc-ws .po-tbl tbody tr{cursor:pointer}
.proc-ws .po-tbl tbody tr:hover{background:var(--sh)}
.proc-ws .po-tbl tbody tr.on{background:var(--ac-s)}
.proc-ws .po-tbl tbody tr.on td{color:var(--ac-t)}
.proc-ws .po-num{font-family:var(--fm);font-weight:600;letter-spacing:.02em}
.proc-ws .po-vendor{font-family:var(--fd);font-weight:650}
.proc-ws .po-sub{font-size:11px;color:var(--t3);margin-top:2px}

.proc-ws .detail{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;display:flex;flex-direction:column}
.proc-ws .empty-detail{padding:40px 20px;text-align:center;color:var(--t3);font-size:13px}
.proc-ws .det-h{padding:16px 18px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
.proc-ws .det-h-t{font-family:var(--fm);font-size:13px;font-weight:700;letter-spacing:.01em}
.proc-ws .det-h-v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:2px}
.proc-ws .det-h-m{font-size:11px;color:var(--t3);margin-top:3px}
.proc-ws .det-body{padding:0;overflow-y:auto;max-height:760px}

.proc-ws .dg{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--s3)}
.proc-ws .dg-i{background:var(--s1);padding:10px 14px}
.proc-ws .dg-i .k{font-family:var(--fd);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)}
.proc-ws .dg-i .v{font-family:var(--fd);font-size:13px;font-weight:650;margin-top:3px}
.proc-ws .dg-i .m{font-size:11px;color:var(--t3);margin-top:2px}

.proc-ws .ds{padding:16px 18px;border-bottom:1px solid var(--s3)}
.proc-ws .ds:last-child{border-bottom:none}
.proc-ws .ds-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px}
.proc-ws .ds-h h4{font-family:var(--fd);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t2)}

.proc-ws .li{padding:10px 12px;border:1px solid var(--s3);border-radius:var(--r-m);margin-bottom:8px;background:var(--si)}
.proc-ws .li.received{background:var(--ok-s);border-color:#b0dfc4}
.proc-ws .li-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:6px}
.proc-ws .li-desc{font-family:var(--fd);font-size:12px;font-weight:650}
.proc-ws .li-meta{font-size:11px;color:var(--t2);line-height:1.4}
.proc-ws .li-foot{display:flex;justify-content:space-between;align-items:center;margin-top:6px;gap:10px}
.proc-ws .li-recv{display:flex;gap:6px;align-items:center;font-size:11px;color:var(--t2)}
.proc-ws .li-recv input{width:60px;height:24px;border:1px solid var(--s3);border-radius:var(--r-s);padding:0 6px;font-size:11px;font-family:var(--fm);color:var(--t1);background:var(--s1);text-align:center}
.proc-ws .li-total{font-family:var(--fm);font-size:12px;font-weight:650}

.proc-ws .tot{padding:12px 18px;background:var(--s2);border-top:1px solid var(--s3)}
.proc-ws .tot-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px}
.proc-ws .tot-row.grand{font-family:var(--fd);font-size:14px;font-weight:750;padding-top:8px;border-top:1px solid var(--s3);margin-top:6px}
.proc-ws .tot-row .k{color:var(--t3)}
.proc-ws .tot-row .v{font-family:var(--fm)}

.proc-ws .fr{display:flex;justify-content:space-between;align-items:center;padding:8px 0;gap:8px;border-bottom:1px dashed var(--s3)}
.proc-ws .fr:last-child{border-bottom:none}
.proc-ws .fr-l{display:flex;align-items:flex-start;gap:10px;min-width:0;flex:1}
.proc-ws .fr-ic{width:28px;height:28px;border-radius:var(--r-s);background:var(--s2);color:var(--t3);display:grid;place-items:center;flex-shrink:0}
.proc-ws .fr h5{font-family:var(--fd);font-size:12px;font-weight:650;margin-bottom:2px}
.proc-ws .fr p{font-size:11px;color:var(--t3)}
.proc-ws .fc{font-family:var(--fd);font-size:10px;font-weight:700;padding:3px 7px;border-radius:var(--r-s);background:var(--s2);color:var(--t3);white-space:nowrap}

.proc-ws .al{display:flex;flex-direction:column;gap:10px}
.proc-ws .ai{display:flex;gap:10px;font-size:12px;color:var(--t1);align-items:flex-start}
.proc-ws .a-dot{width:8px;height:8px;border-radius:50%;margin-top:5px;flex-shrink:0}
.proc-ws .a-dot.action{background:var(--ac)}
.proc-ws .a-text{flex:1;line-height:1.5}
.proc-ws .a-text strong{font-family:var(--fd);font-weight:700}
.proc-ws .a-time{color:var(--t3);font-size:11px;white-space:nowrap;font-family:var(--fd)}

.proc-ws .sm-strip{display:flex;align-items:center;gap:4px;padding:12px 18px;background:var(--si);border-bottom:1px solid var(--s3);overflow-x:auto;scrollbar-width:none}
.proc-ws .sm-strip::-webkit-scrollbar{display:none}
.proc-ws .sm-s{padding:5px 10px;border-radius:999px;font-size:11px;font-weight:650;color:var(--t3);background:var(--s1);border:1px solid var(--s3);white-space:nowrap;font-family:var(--fd);display:inline-flex;align-items:center;gap:4px}
.proc-ws .sm-s.done{background:var(--ok-s);color:var(--ok-t);border-color:#b0dfc4}
.proc-ws .sm-s.cur{background:var(--ac-s);color:var(--ac-t);border-color:var(--ac-m)}
.proc-ws .sm-arrow{color:var(--t3);flex-shrink:0;margin:0 2px}
`;

// Re-export for cross-file use (create modal references the same cents formatter).
export { formatCentsUsd };
export type { CreatePoInitialLine };
