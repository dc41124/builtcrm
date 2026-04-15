"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Modal } from "@/components/modal";
import { Pill, type PillColor } from "@/components/pill";
import type { RfiRow } from "@/domain/loaders/project-home";

type TabId = "open" | "pending" | "answered" | "closed";

const TABS: { id: TabId; label: string; match: (r: RfiRow) => boolean }[] = [
  { id: "open", label: "All open", match: (r) => r.rfiStatus !== "closed" },
  {
    id: "pending",
    label: "Awaiting response",
    match: (r) => r.rfiStatus === "pending_response" || r.rfiStatus === "open",
  },
  { id: "answered", label: "Answered", match: (r) => r.rfiStatus === "answered" },
  { id: "closed", label: "Closed", match: (r) => r.rfiStatus === "closed" },
];

export function ContractorRfiWorkspace({
  projectId,
  projectName,
  rfis,
}: {
  projectId: string;
  projectName: string;
  rfis: RfiRow[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("open");
  const [selectedId, setSelectedId] = useState<string | null>(rfis[0]?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);

  const now = Date.now();
  const summary = useMemo(() => {
    const total = rfis.length;
    const open = rfis.filter((r) => r.rfiStatus !== "closed").length;
    const awaiting = rfis.filter(
      (r) => r.rfiStatus === "pending_response" || r.rfiStatus === "open",
    ).length;
    const overdue = rfis.filter(
      (r) =>
        r.rfiStatus !== "closed" &&
        r.dueAt &&
        r.dueAt.getTime() < now,
    ).length;
    return { total, open, awaiting, overdue };
  }, [rfis, now]);

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab)!;
    return rfis.filter(tab.match);
  }, [rfis, activeTab]);

  const selected =
    filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="rfp">
      <header className="rfp-head">
        <div className="rfp-head-main">
          <div className="rfp-crumbs">{projectName} · RFIs / Issues</div>
          <h1 className="rfp-title">RFIs / Issues</h1>
          <p className="rfp-desc">
            Track every question, clarification, and field issue on this project. Escalate
            blockers, keep formal responses auditable, and close out resolved threads.
          </p>
        </div>
        <div className="rfp-head-actions">
          <Button variant="secondary">Export log</Button>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            New RFI
          </Button>
        </div>
      </header>

      <div className="rfp-kpis">
        <KpiCard label="Total RFIs" value={summary.total.toString()} iconColor="purple" />
        <KpiCard
          label="Open threads"
          value={summary.open.toString()}
          meta={summary.open === 0 ? "Nothing open" : "Active in workflow"}
          iconColor="blue"
        />
        <KpiCard
          label="Awaiting response"
          value={summary.awaiting.toString()}
          meta={summary.awaiting === 0 ? "All clear" : "Need a reply"}
          iconColor="amber"
          alert={summary.awaiting > 0}
        />
        <KpiCard
          label="Overdue"
          value={summary.overdue.toString()}
          meta={summary.overdue === 0 ? "On schedule" : "Past due date"}
          iconColor="red"
          alert={summary.overdue > 0}
        />
      </div>

      <Card
        tabs={TABS.map((t) => ({
          id: t.id,
          label: `${t.label} (${rfis.filter(t.match).length})`,
        }))}
        activeTabId={activeTab}
        onTabChange={(id) => {
          setActiveTab(id as TabId);
          setSelectedId(null);
        }}
        padded={false}
      >
        {filtered.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyState
              title="No RFIs in this view"
              description="Nothing matches the current filter."
            />
          </div>
        ) : (
          <div className="rfp-split">
            <div className="rfp-queue">
              {filtered.map((r) => {
                const overdue =
                  r.rfiStatus !== "closed" && r.dueAt && r.dueAt.getTime() < now;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`rfp-row ${selected?.id === r.id ? "rfp-row-sel" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="rfp-row-top">
                      <div className="rfp-row-id">
                        RFI-{String(r.sequentialNumber).padStart(3, "0")}
                      </div>
                      <Pill color={statusPill(r.rfiStatus, Boolean(overdue))}>
                        {overdue ? "Overdue" : formatStatus(r.rfiStatus)}
                      </Pill>
                    </div>
                    <div className="rfp-row-title">{r.subject}</div>
                    {r.body && <div className="rfp-row-desc">{r.body}</div>}
                    <div className="rfp-row-foot">
                      <span>{r.dueAt ? `Due ${formatDate(r.dueAt)}` : "No due date"}</span>
                      <span>{r.responses.length} replies</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="rfp-detail">
              {selected ? (
                <RfiDetail key={selected.id} rfi={selected} />
              ) : (
                <EmptyState
                  title="Select an RFI"
                  description="Pick a thread from the queue to see details."
                />
              )}
            </div>
          </div>
        )}
      </Card>

      <CreateRfiModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
      />

      <style>{`
        .rfp{display:flex;flex-direction:column;gap:20px}
        .rfp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .rfp-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .rfp-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .rfp-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .rfp-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .rfp-head-actions{display:flex;gap:8px;flex-shrink:0}
        .rfp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.rfp-kpis{grid-template-columns:repeat(2,1fr)}}
        .rfp-split{display:grid;grid-template-columns:360px minmax(0,1fr)}
        @media(max-width:900px){.rfp-split{grid-template-columns:1fr}}
        .rfp-queue{border-right:1px solid var(--s3);max-height:640px;overflow-y:auto;display:flex;flex-direction:column}
        .rfp-row{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s3);padding:14px 18px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:4px}
        .rfp-row:hover{background:var(--sh)}
        .rfp-row-sel{background:var(--ac-s)}
        .rfp-row-sel:hover{background:var(--ac-s)}
        .rfp-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .rfp-row-id{font-family:var(--fm);font-size:11px;font-weight:600;color:var(--t3);letter-spacing:.02em}
        .rfp-row-title{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .rfp-row-desc{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .rfp-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .rfp-detail{padding:22px 24px;min-width:0}
      `}</style>
    </div>
  );
}

function RfiDetail({ rfi }: { rfi: RfiRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const now = Date.now();
  const overdue = rfi.rfiStatus !== "closed" && rfi.dueAt && rfi.dueAt.getTime() < now;

  async function close() {
    setPending(true);
    await fetch(`/api/rfis/${rfi.id}/close`, { method: "POST" });
    setPending(false);
    router.refresh();
  }

  async function reopen() {
    setPending(true);
    await fetch(`/api/rfis/${rfi.id}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setPending(false);
    router.refresh();
  }

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
            {overdue ? "Overdue" : formatStatus(rfi.rfiStatus)}
          </Pill>
        </div>
      </div>

      <div className="rfd-grid">
        <Field label="Status" value={formatStatus(rfi.rfiStatus)} />
        <Field
          label="Due"
          value={rfi.dueAt ? formatDate(rfi.dueAt) : "—"}
          meta={overdue ? "Past due date" : undefined}
        />
        <Field
          label="Drawing"
          value={rfi.drawingReference ?? "—"}
          mono={Boolean(rfi.drawingReference)}
        />
        <Field
          label="Specification"
          value={rfi.specificationReference ?? "—"}
          mono={Boolean(rfi.specificationReference)}
        />
        {rfi.locationDescription && (
          <Field label="Location" value={rfi.locationDescription} span={2} />
        )}
      </div>

      <div className="rfd-section">
        <div className="rfd-section-head">
          <h3>Response thread</h3>
          <div className="rfd-section-acts">
            <Button variant="secondary">Send reminder</Button>
            {(rfi.rfiStatus === "open" || rfi.rfiStatus === "answered") && (
              <Button variant="primary" onClick={close} loading={pending}>
                Close RFI
              </Button>
            )}
            {(rfi.rfiStatus === "answered" || rfi.rfiStatus === "closed") && (
              <Button variant="secondary" onClick={reopen} loading={pending}>
                Reopen / escalate
              </Button>
            )}
          </div>
        </div>
        {rfi.responses.length === 0 ? (
          <EmptyState
            title="No replies yet"
            description="Once the assigned subcontractor responds, the thread will appear here."
          />
        ) : (
          <ul className="rfd-thread">
            {rfi.responses.map((resp) => (
              <li key={resp.id} className="rfd-reply">
                <div className="rfd-reply-head">
                  <span className="rfd-reply-name">
                    {resp.respondedByName ?? "Unknown"}
                  </span>
                  {resp.isOfficialResponse && <Pill color="purple">Official</Pill>}
                  <span className="rfd-reply-time">{formatDate(resp.createdAt)}</span>
                </div>
                <p className="rfd-reply-body">{resp.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <style>{`
        .rfd{display:flex;flex-direction:column;gap:20px}
        .rfd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
        .rfd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
        .rfd-id{font-family:var(--fm);font-size:12px;font-weight:600;color:var(--t3);letter-spacing:.02em}
        .rfd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.015em;color:var(--t1);margin:0}
        .rfd-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .rfd-pills{display:flex;gap:6px;flex-shrink:0}
        .rfd-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px;background:var(--sh);border-radius:var(--r-m)}
        .rfd-section{display:flex;flex-direction:column;gap:12px}
        .rfd-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .rfd-section-head h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .rfd-section-acts{display:flex;gap:8px}
        .rfd-thread{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
        .rfd-reply{border:1px solid var(--s3);border-radius:var(--r-m);padding:12px 14px}
        .rfd-reply-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
        .rfd-reply-name{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--t1)}
        .rfd-reply-time{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-left:auto}
        .rfd-reply-body{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);line-height:1.55;margin:0}
      `}</style>
    </div>
  );
}

function Field({
  label,
  value,
  meta,
  mono,
  span,
}: {
  label: string;
  value: string;
  meta?: string;
  mono?: boolean;
  span?: number;
}) {
  return (
    <div
      className="rfd-field"
      style={span === 2 ? { gridColumn: "1 / -1" } : undefined}
    >
      <div className="rfd-k">{label}</div>
      <div
        className="rfd-v"
        style={
          mono ? { fontFamily: "var(--fm)", fontSize: 13, fontWeight: 600 } : undefined
        }
      >
        {value}
      </div>
      {meta && <div className="rfd-m">{meta}</div>}
      <style>{`
        .rfd-field{display:flex;flex-direction:column;gap:3px;min-width:0}
        .rfd-k{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
        .rfd-v{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .rfd-m{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2)}
      `}</style>
    </div>
  );
}

function CreateRfiModal({
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
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [assignedToOrganizationId, setAssignedToOrganizationId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [drawingReference, setDrawingReference] = useState("");
  const [specificationReference, setSpecificationReference] = useState("");
  const [locationDescription, setLocationDescription] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/rfis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        subject,
        body: body || undefined,
        assignedToOrganizationId: assignedToOrganizationId || undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        drawingReference: drawingReference || undefined,
        specificationReference: specificationReference || undefined,
        locationDescription: locationDescription || undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    setSubject("");
    setBody("");
    setAssignedToOrganizationId("");
    setDueDate("");
    setDrawingReference("");
    setSpecificationReference("");
    setLocationDescription("");
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New RFI / Issue"
      subtitle="Open a new thread. Assign it to the responsible organization."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="rfi-create-form"
            loading={pending}
          >
            Create RFI
          </Button>
        </>
      }
    >
      <form id="rfi-create-form" onSubmit={onSubmit} className="rfc">
        <div className="rfc-row rfc-row-2">
          <Label text="Subject">
            <input
              className="rfc-inp"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              placeholder="Beam offset conflict at grid C-4"
            />
          </Label>
        </div>
        <div className="rfc-row rfc-row-2">
          <Label text="Description">
            <textarea
              className="rfc-inp rfc-ta"
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Describe the question, the affected work, and any constraints."
            />
          </Label>
        </div>
        <div className="rfc-row">
          <Label text="Assigned organization ID">
            <input
              className="rfc-inp"
              value={assignedToOrganizationId}
              onChange={(e) => setAssignedToOrganizationId(e.target.value)}
              required
              placeholder="Subcontractor org UUID"
            />
          </Label>
          <Label text="Due date">
            <input
              className="rfc-inp"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Label>
        </div>
        <div className="rfc-row">
          <Label text="Drawing reference">
            <input
              className="rfc-inp"
              value={drawingReference}
              onChange={(e) => setDrawingReference(e.target.value)}
              placeholder="A-301"
            />
          </Label>
          <Label text="Spec reference">
            <input
              className="rfc-inp"
              value={specificationReference}
              onChange={(e) => setSpecificationReference(e.target.value)}
              placeholder="09 91 23"
            />
          </Label>
        </div>
        <div className="rfc-row rfc-row-2">
          <Label text="Location">
            <input
              className="rfc-inp"
              value={locationDescription}
              onChange={(e) => setLocationDescription(e.target.value)}
              placeholder="Level 2, grid C-4 through D-5"
            />
          </Label>
        </div>
        {error && <p className="rfc-err">Error: {error}</p>}
      </form>
      <style>{`
        .rfc{display:flex;flex-direction:column;gap:12px}
        .rfc-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .rfc-row-2{grid-template-columns:1fr}
        .rfc-inp{width:100%;height:36px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1)}
        .rfc-inp:focus{outline:none;border-color:var(--ac)}
        .rfc-ta{height:auto;padding:10px 12px;resize:vertical;line-height:1.5}
        .rfc-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      `}</style>
    </Modal>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="rfc-lbl">
      <span>{text}</span>
      {children}
      <style>{`
        .rfc-lbl{display:flex;flex-direction:column;gap:5px;font-family:var(--fb);font-size:11.5px;font-weight:620;color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
      `}</style>
    </label>
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
    year: "numeric",
  });
}
