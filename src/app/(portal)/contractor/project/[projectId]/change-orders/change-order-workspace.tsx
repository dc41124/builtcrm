"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Modal } from "@/components/modal";
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

export function ContractorChangeOrderWorkspace({
  projectId,
  projectName,
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

  const selected =
    filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="cop">
      <header className="cop-head">
        <div className="cop-head-main">
          <div className="cop-crumbs">{projectName} · Change Orders</div>
          <h1 className="cop-title">Change Orders</h1>
          <p className="cop-desc">
            Create, track, and manage scope changes. Submit to the client for
            formal approval when ready.
          </p>
        </div>
        <div className="cop-head-actions">
          <Button variant="secondary">Export</Button>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            New change order
          </Button>
        </div>
      </header>

      <div className="cop-kpis">
        <KpiCard label="Total COs" value={summary.total.toString()} meta="This project" iconColor="purple" />
        <KpiCard
          label="Pending approval"
          value={summary.pending.toString()}
          meta={summary.pending === 0 ? "All clear" : "Waiting on client"}
          iconColor="amber"
          alert={summary.pending > 0}
        />
        <KpiCard
          label="Net change"
          value={formatSignedCents(
            totals.approvedChangesCents + totals.pendingChangesCents,
          )}
          meta="Approved + pending"
          iconColor="blue"
        />
        <KpiCard
          label="Approved"
          value={summary.approved.toString()}
          meta="Incorporated into SOV"
          iconColor="green"
        />
      </div>

      <div className="cop-grid">
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
          title="Change order workspace"
          subtitle="Full lifecycle from draft through client approval."
          padded={false}
        >
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
                    className={`cop-row ${selected?.id === r.id ? "cop-row-sel" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="cop-row-top">
                      <div className="cop-row-id">
                        CO-{String(r.changeOrderNumber).padStart(3, "0")}
                      </div>
                      <Pill color={statusPill(r.changeOrderStatus)}>
                        {formatStatus(r.changeOrderStatus)}
                      </Pill>
                    </div>
                    <div className="cop-row-title">{r.title}</div>
                    <div
                      className={`cop-row-amt ${r.amountCents >= 0 ? "pos" : "neg"}`}
                    >
                      {formatSignedCents(r.amountCents)}
                    </div>
                    <div className="cop-row-foot">
                      <span>
                        {r.submittedAt
                          ? `Submitted ${formatDate(r.submittedAt)}`
                          : `Created ${formatDate(r.createdAt)}`}
                      </span>
                      {r.originatingRfiNumber != null && (
                        <span>
                          RFI-
                          {String(r.originatingRfiNumber).padStart(3, "0")}
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
        </Card>

        <div className="cop-rail">
          <Card title="Awaiting decisions" subtitle="Pending client approval" alert>
            {rows.filter((r) => r.changeOrderStatus === "pending_client_approval")
              .length === 0 ? (
              <EmptyState title="Nothing pending" description="All COs are decided." />
            ) : (
              <div className="cop-mini">
                {rows
                  .filter((r) => r.changeOrderStatus === "pending_client_approval")
                  .map((r) => (
                    <div key={r.id} className="cop-mini-row">
                      <div>
                        <div className="cop-mini-id">
                          CO-{String(r.changeOrderNumber).padStart(3, "0")}
                        </div>
                        <div className="cop-mini-t">{r.title}</div>
                      </div>
                      <div className="cop-mini-amt">
                        {formatSignedCents(r.amountCents)}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
          <Card title="Contract summary">
            <div className="cop-totals">
              <TotalRow label="Original contract" value={formatCents(totals.originalContractCents)} />
              <TotalRow label="Approved changes" value={formatSignedCents(totals.approvedChangesCents)} tone="amber" />
              <TotalRow label="Pending changes" value={formatSignedCents(totals.pendingChangesCents)} tone="muted" />
              <TotalRow
                label="Current contract value"
                value={formatCents(totals.currentContractCents)}
                strong
              />
            </div>
          </Card>
        </div>
      </div>

      <CreateChangeOrderModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
      />

      <style>{`
        .cop{display:flex;flex-direction:column;gap:20px}
        .cop-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .cop-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .cop-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .cop-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .cop-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .cop-head-actions{display:flex;gap:8px;flex-shrink:0}
        .cop-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.cop-kpis{grid-template-columns:repeat(2,1fr)}}
        .cop-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.cop-grid{grid-template-columns:1fr}}
        .cop-split{display:grid;grid-template-columns:340px minmax(0,1fr)}
        @media(max-width:900px){.cop-split{grid-template-columns:1fr}}
        .cop-queue{border-right:1px solid var(--s3);max-height:640px;overflow-y:auto;display:flex;flex-direction:column}
        .cop-row{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s3);padding:14px 18px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:4px}
        .cop-row:hover{background:var(--sh)}
        .cop-row-sel{background:var(--ac-s)}
        .cop-row-sel:hover{background:var(--ac-s)}
        .cop-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .cop-row-id{font-family:var(--fm);font-size:11px;font-weight:600;color:var(--t3);letter-spacing:.02em}
        .cop-row-title{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .cop-row-amt{font-family:var(--fd);font-size:14px;font-weight:750;margin-top:2px}
        .cop-row-amt.pos{color:var(--wr-t)}
        .cop-row-amt.neg{color:var(--ok-t)}
        .cop-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .cop-detail{padding:22px 24px;min-width:0}
        .cop-rail{display:flex;flex-direction:column;gap:14px}
        .cop-mini{display:flex;flex-direction:column;gap:10px}
        .cop-mini-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding-bottom:10px;border-bottom:1px solid var(--s2)}
        .cop-mini-row:last-child{border-bottom:none;padding-bottom:0}
        .cop-mini-id{font-family:var(--fm);font-size:11px;color:var(--t3)}
        .cop-mini-t{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1)}
        .cop-mini-amt{font-family:var(--fd);font-size:13px;font-weight:750;color:var(--wr-t);white-space:nowrap}
        .cop-totals{display:flex;flex-direction:column;gap:2px}
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
        </div>
      </div>

      <div className="cod-grid">
        <Field label="Status" value={formatStatus(co.changeOrderStatus)} />
        <Field
          label="Cost impact"
          value={formatSignedCents(co.amountCents)}
          tone={co.amountCents >= 0 ? "warn" : "good"}
          meta={co.amountCents >= 0 ? "Addition to contract" : "Deduct from contract"}
        />
        <Field
          label="Submitted"
          value={co.submittedAt ? formatDate(co.submittedAt) : "—"}
          meta={co.requestedByName ?? undefined}
        />
        <Field
          label="Originated from"
          value={
            co.originatingRfiNumber != null
              ? `RFI-${String(co.originatingRfiNumber).padStart(3, "0")}`
              : "—"
          }
          mono={co.originatingRfiNumber != null}
        />
      </div>

      {co.reason && (
        <div className="cod-section">
          <h3>Reason &amp; justification</h3>
          <p>{co.reason}</p>
        </div>
      )}

      {co.rejectionReason && (
        <div className="cod-section">
          <h3>Client rejection note</h3>
          <p>{co.rejectionReason}</p>
        </div>
      )}

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
        {co.changeOrderStatus === "approved" && co.approvedAt && (
          <div className="cod-meta">
            Approved {formatDate(co.approvedAt)}
            {co.approvedByName ? ` by ${co.approvedByName}` : ""}
          </div>
        )}
      </div>
      {error && <p className="cod-err">Error: {error}</p>}

      <style>{`
        .cod{display:flex;flex-direction:column;gap:18px}
        .cod-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
        .cod-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
        .cod-id{font-family:var(--fm);font-size:12px;font-weight:600;color:var(--t3);letter-spacing:.02em}
        .cod-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.015em;color:var(--t1);margin:0}
        .cod-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .cod-pills{display:flex;gap:6px;flex-shrink:0}
        .cod-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px;background:var(--sh);border-radius:var(--r-m)}
        .cod-section h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0 0 6px;letter-spacing:-.01em}
        .cod-section p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .cod-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .cod-meta{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2)}
        .cod-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      `}</style>
    </div>
  );
}

export function TotalRow({
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
      <div className={`cop-tr ${strong ? "cop-tr-strong" : ""}`}>
        <span className="cop-tr-l">{label}</span>
        <span className={`cop-tr-v cop-tr-${tone ?? ""}`}>{value}</span>
      </div>
      <style>{`
        .cop-tr{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--s2);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2)}
        .cop-tr:last-child{border-bottom:none}
        .cop-tr-strong{border-top:2px solid var(--s3);padding-top:10px;margin-top:4px;font-weight:700;color:var(--t1)}
        .cop-tr-v{font-family:var(--fd);font-weight:720;color:var(--t1)}
        .cop-tr-amber{color:var(--wr-t)}
        .cop-tr-muted{color:var(--t3)}
      `}</style>
    </>
  );
}

function Field({
  label,
  value,
  meta,
  mono,
  tone,
}: {
  label: string;
  value: string;
  meta?: string;
  mono?: boolean;
  tone?: "warn" | "good";
}) {
  return (
    <div className="cod-field">
      <div className="cod-k">{label}</div>
      <div
        className="cod-v"
        style={{
          ...(mono ? { fontFamily: "var(--fm)", fontSize: 13 } : {}),
          ...(tone === "warn" ? { color: "var(--wr-t)" } : {}),
          ...(tone === "good" ? { color: "var(--ok-t)" } : {}),
        }}
      >
        {value}
      </div>
      {meta && <div className="cod-m">{meta}</div>}
      <style>{`
        .cod-field{display:flex;flex-direction:column;gap:3px;min-width:0}
        .cod-k{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
        .cod-v{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);letter-spacing:-.005em}
        .cod-m{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2)}
      `}</style>
    </div>
  );
}

function CreateChangeOrderModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
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
    setTitle("");
    setDescription("");
    setReason("");
    setAmount("");
    setOriginatingRfiId("");
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New change order"
      subtitle="Draft a scope change. You can submit it for client approval afterwards."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="co-create-form"
            loading={pending}
          >
            Create draft
          </Button>
        </>
      }
    >
      <form id="co-create-form" onSubmit={onSubmit} className="cof">
        <Label text="Title">
          <input
            className="cof-inp"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Mechanical reroute — east corridor"
          />
        </Label>
        <Label text="Description">
          <textarea
            className="cof-inp cof-ta"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of what is changing."
          />
        </Label>
        <Label text="Reason / justification">
          <textarea
            className="cof-inp cof-ta"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why this change is needed."
          />
        </Label>
        <div className="cof-row">
          <Label text="Amount (USD, negative for deduct)">
            <input
              className="cof-inp"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="18400.00"
            />
          </Label>
          <Label text="Originating RFI ID (optional)">
            <input
              className="cof-inp"
              value={originatingRfiId}
              onChange={(e) => setOriginatingRfiId(e.target.value)}
              placeholder="RFI UUID"
            />
          </Label>
        </div>
        {error && <p className="cof-err">Error: {error}</p>}
      </form>
      <style>{`
        .cof{display:flex;flex-direction:column;gap:12px}
        .cof-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .cof-inp{width:100%;height:36px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1)}
        .cof-inp:focus{outline:none;border-color:var(--ac)}
        .cof-ta{height:auto;padding:10px 12px;resize:vertical;line-height:1.5}
        .cof-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      `}</style>
    </Modal>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="cof-lbl">
      <span>{text}</span>
      {children}
      <style>{`
        .cof-lbl{display:flex;flex-direction:column;gap:5px;font-family:var(--fb);font-size:11.5px;font-weight:620;color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
      `}</style>
    </label>
  );
}

