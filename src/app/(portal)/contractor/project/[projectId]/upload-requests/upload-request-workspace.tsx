"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Modal } from "@/components/modal";
import { Pill, type PillColor } from "@/components/pill";
import type { ContractorProjectView } from "@/domain/loaders/project-home";

type UploadRequestRow = ContractorProjectView["uploadRequests"][number];
type TabId = "all" | "open" | "submitted" | "completed";

const TABS: { id: TabId; label: string; match: (r: UploadRequestRow) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  {
    id: "open",
    label: "Open",
    match: (r) => r.requestStatus === "open" || r.requestStatus === "revision_requested",
  },
  { id: "submitted", label: "Submitted", match: (r) => r.requestStatus === "submitted" },
  { id: "completed", label: "Completed", match: (r) => r.requestStatus === "completed" },
];

type OrgOption = { id: string; name: string };

export function ContractorUploadRequestsWorkspace({
  projectId,
  projectName,
  requests,
  subcontractorOrgs,
}: {
  projectId: string;
  projectName: string;
  requests: UploadRequestRow[];
  subcontractorOrgs: OrgOption[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(requests[0]?.id ?? null);
  const [createOpen, setCreateOpen] = useState(false);

  const now = Date.now();
  const summary = useMemo(() => {
    const total = requests.length;
    const open = requests.filter(
      (r) => r.requestStatus === "open" || r.requestStatus === "revision_requested",
    ).length;
    const submitted = requests.filter((r) => r.requestStatus === "submitted").length;
    const completed = requests.filter((r) => r.requestStatus === "completed").length;
    const overdue = requests.filter(
      (r) =>
        (r.requestStatus === "open" || r.requestStatus === "revision_requested") &&
        r.dueAt &&
        r.dueAt.getTime() < now,
    ).length;
    return { total, open, submitted, completed, overdue };
  }, [requests, now]);

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab)!;
    return requests.filter(tab.match);
  }, [requests, activeTab]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="urw">
      <header className="urw-head">
        <div className="urw-head-main">
          <div className="urw-crumbs">{projectName} · Upload Requests</div>
          <h1 className="urw-title">Upload Requests</h1>
          <p className="urw-desc">
            Issue file requests to subcontractors, track submissions, and review or
            accept returned files.
          </p>
        </div>
        <div className="urw-head-actions">
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            New Request
          </Button>
        </div>
      </header>

      <div className="urw-kpis">
        <KpiCard label="Total Requests" value={summary.total.toString()} iconColor="purple" />
        <KpiCard
          label="Open"
          value={summary.open.toString()}
          meta={summary.open === 0 ? "All clear" : "Waiting on subcontractor"}
          iconColor="amber"
          alert={summary.open > 0}
        />
        <KpiCard
          label="Overdue"
          value={summary.overdue.toString()}
          meta={summary.overdue === 0 ? "All on track" : "Needs attention"}
          iconColor="red"
          alert={summary.overdue > 0}
        />
        <KpiCard
          label="Completed"
          value={summary.completed.toString()}
          meta="Accepted and closed"
          iconColor="green"
        />
      </div>

      <Card
        tabs={TABS.map((t) => ({
          id: t.id,
          label: `${t.label} (${requests.filter(t.match).length})`,
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
              title="No requests in this view"
              description="Requests will appear here when they match this filter."
            />
          </div>
        ) : (
          <div className="urw-split">
            <div className="urw-queue">
              {filtered.map((r) => {
                const overdue =
                  (r.requestStatus === "open" || r.requestStatus === "revision_requested") &&
                  r.dueAt &&
                  r.dueAt.getTime() < now;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`urw-row ${selected?.id === r.id ? "urw-row-sel" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="urw-row-top">
                      <div className="urw-row-title">{r.title}</div>
                      <Pill color={statusPill(r.requestStatus, Boolean(overdue))}>
                        {overdue ? "Overdue" : formatStatus(r.requestStatus)}
                      </Pill>
                    </div>
                    <div className="urw-row-org">
                      {r.requestedFromOrganizationName ?? "Unassigned"}
                    </div>
                    <div className="urw-row-foot">
                      <span>{r.dueAt ? `Due ${formatDate(r.dueAt)}` : "No due date"}</span>
                      <span>{r.expectedFileType ?? "Any file"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="urw-detail">
              {selected ? (
                <ContractorDetail key={selected.id} request={selected} />
              ) : (
                <EmptyState
                  title="Select a request"
                  description="Pick a request from the queue to see details."
                />
              )}
            </div>
          </div>
        )}
      </Card>

      <CreateRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        projectId={projectId}
        subcontractorOrgs={subcontractorOrgs}
      />

      <style>{`
        .urw{display:flex;flex-direction:column;gap:20px}
        .urw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .urw-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .urw-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .urw-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .urw-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .urw-head-actions{display:flex;gap:8px;flex-shrink:0}
        .urw-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.urw-kpis{grid-template-columns:repeat(2,1fr)}}
        .urw-split{display:grid;grid-template-columns:360px minmax(0,1fr)}
        @media(max-width:900px){.urw-split{grid-template-columns:1fr}}
        .urw-queue{border-right:1px solid var(--s3);max-height:640px;overflow-y:auto;display:flex;flex-direction:column}
        .urw-row{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s3);padding:14px 18px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:4px}
        .urw-row:hover{background:var(--sh)}
        .urw-row-sel{background:var(--ac-s)}
        .urw-row-sel:hover{background:var(--ac-s)}
        .urw-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .urw-row-title{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);letter-spacing:-.005em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .urw-row-org{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2)}
        .urw-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .urw-detail{padding:22px 24px;min-width:0}
      `}</style>
    </div>
  );
}

function ContractorDetail({ request }: { request: UploadRequestRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();
  const overdue =
    (request.requestStatus === "open" || request.requestStatus === "revision_requested") &&
    request.dueAt &&
    request.dueAt.getTime() < now;

  async function complete() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/upload-requests/${request.id}/complete`, {
      method: "POST",
    });
    setPending(false);
    if (!res.ok) {
      setError("Unable to accept");
      return;
    }
    router.refresh();
  }

  async function revise() {
    const note = window.prompt("Revision note:");
    if (!note) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/upload-requests/${request.id}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Unable to request revision");
      return;
    }
    router.refresh();
  }

  return (
    <div className="urd">
      <div className="urd-head">
        <div className="urd-head-main">
          <h2 className="urd-title">{request.title}</h2>
          {request.description && <p className="urd-desc">{request.description}</p>}
        </div>
        <div className="urd-pills">
          <Pill color={statusPill(request.requestStatus, Boolean(overdue))}>
            {overdue ? "Overdue" : formatStatus(request.requestStatus)}
          </Pill>
        </div>
      </div>

      <div className="urd-grid">
        <Field
          label="Assigned To"
          value={request.requestedFromOrganizationName ?? "—"}
          mono={Boolean(request.requestedFromOrganizationName)}
        />
        <Field
          label="Due Date"
          value={request.dueAt ? formatDate(request.dueAt) : "—"}
          meta={overdue ? "Past due date" : undefined}
        />
        <Field label="File Type" value={request.expectedFileType ?? "Any"} />
        <Field label="Created" value={formatDate(request.createdAt)} />
      </div>

      {request.revisionNote && (
        <div className="urd-note">
          <div className="urd-note-lbl">Last Revision Note</div>
          <p>{request.revisionNote}</p>
        </div>
      )}

      <div className="urd-section">
        <div className="urd-section-head">
          <h3>
            {request.requestStatus === "submitted"
              ? "Submitted File — Review Required"
              : request.requestStatus === "completed"
                ? "Submitted File"
                : "Submission Status"}
          </h3>
          <div className="urd-section-acts">
            {request.requestStatus === "submitted" && (
              <>
                <Button variant="primary" onClick={complete} loading={pending}>
                  Accept & Close
                </Button>
                <Button variant="secondary" onClick={revise} loading={pending}>
                  Request Revision
                </Button>
              </>
            )}
          </div>
        </div>
        {request.submittedDocumentId ? (
          <div className="urd-file">
            <div className="urd-file-name">{request.submittedDocumentTitle ?? "File"}</div>
            <div className="urd-file-meta">
              {request.submittedAt ? `Submitted ${formatDate(request.submittedAt)}` : ""}
            </div>
          </div>
        ) : (
          <EmptyState
            title="No files submitted yet"
            description={`${request.requestedFromOrganizationName ?? "Assignee"} has been notified.`}
          />
        )}
        {error && <p className="urd-err">{error}</p>}
      </div>

      <style>{`
        .urd{display:flex;flex-direction:column;gap:20px}
        .urd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
        .urd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
        .urd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.015em;color:var(--t1);margin:0}
        .urd-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .urd-pills{display:flex;gap:6px;flex-shrink:0}
        .urd-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px;background:var(--sh);border-radius:var(--r-m)}
        .urd-note{padding:12px 14px;background:var(--wr-s);border:1px solid var(--wr);border-radius:var(--r-m)}
        .urd-note-lbl{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--wr-t);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
        .urd-note p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);margin:0;line-height:1.5}
        .urd-section{display:flex;flex-direction:column;gap:12px}
        .urd-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .urd-section-head h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .urd-section-acts{display:flex;gap:8px}
        .urd-file{border:1px solid var(--s3);border-radius:var(--r-m);padding:12px 14px;display:flex;flex-direction:column;gap:3px}
        .urd-file-name{font-family:var(--fm);font-size:12.5px;font-weight:540;color:var(--t1)}
        .urd-file-meta{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .urd-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      `}</style>
    </div>
  );
}

function Field({
  label,
  value,
  meta,
  mono,
}: {
  label: string;
  value: string;
  meta?: string;
  mono?: boolean;
}) {
  return (
    <div className="urd-field">
      <div className="urd-k">{label}</div>
      <div
        className="urd-v"
        style={mono ? { fontFamily: "var(--fm)", fontSize: 13, fontWeight: 600 } : undefined}
      >
        {value}
      </div>
      {meta && <div className="urd-m">{meta}</div>}
      <style>{`
        .urd-field{display:flex;flex-direction:column;gap:3px;min-width:0}
        .urd-k{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
        .urd-v{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .urd-m{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2)}
      `}</style>
    </div>
  );
}

function CreateRequestModal({
  open,
  onClose,
  projectId,
  subcontractorOrgs,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  subcontractorOrgs: OrgOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetOrganizationId, setTargetOrganizationId] = useState(
    subcontractorOrgs[0]?.id ?? "",
  );
  const [expectedFileType, setExpectedFileType] = useState("PDF");
  const [dueDate, setDueDate] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/upload-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        targetOrganizationId,
        title,
        description: description || undefined,
        expectedFileType,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "request_failed");
      return;
    }
    setTitle("");
    setDescription("");
    setDueDate("");
    onClose();
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Upload Request"
      subtitle="Request files from a subcontractor organization."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="ur-create-form"
            loading={pending}
          >
            Create Request
          </Button>
        </>
      }
    >
      <form id="ur-create-form" onSubmit={onSubmit} className="urc">
        <Label text="Title">
          <input
            className="urc-inp"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="MEP Closeout Pack"
          />
        </Label>
        <Label text="Description">
          <textarea
            className="urc-inp urc-ta"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what should be included in the upload."
          />
        </Label>
        <div className="urc-row">
          <Label text="Assigned subcontractor">
            {subcontractorOrgs.length > 0 ? (
              <select
                className="urc-inp"
                value={targetOrganizationId}
                onChange={(e) => setTargetOrganizationId(e.target.value)}
                required
              >
                {subcontractorOrgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="urc-inp"
                value={targetOrganizationId}
                onChange={(e) => setTargetOrganizationId(e.target.value)}
                required
                placeholder="Subcontractor org UUID"
              />
            )}
          </Label>
          <Label text="Due date">
            <input
              className="urc-inp"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Label>
        </div>
        <Label text="Expected file type">
          <input
            className="urc-inp"
            value={expectedFileType}
            onChange={(e) => setExpectedFileType(e.target.value)}
            required
            placeholder="PDF"
          />
        </Label>
        {error && <p className="urc-err">Error: {error}</p>}
      </form>
      <style>{`
        .urc{display:flex;flex-direction:column;gap:12px}
        .urc-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .urc-inp{width:100%;height:36px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1)}
        .urc-inp:focus{outline:none;border-color:var(--ac)}
        .urc-ta{height:auto;padding:10px 12px;resize:vertical;line-height:1.5}
        .urc-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      `}</style>
    </Modal>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="urc-lbl">
      <span>{text}</span>
      {children}
      <style>{`
        .urc-lbl{display:flex;flex-direction:column;gap:5px;font-family:var(--fb);font-size:11.5px;font-weight:620;color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
      `}</style>
    </label>
  );
}

function statusPill(status: string, overdue: boolean): PillColor {
  if (overdue) return "red";
  if (status === "completed") return "green";
  if (status === "submitted") return "blue";
  if (status === "revision_requested") return "amber";
  return "purple";
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
