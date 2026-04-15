"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import type { SubcontractorProjectView } from "@/domain/loaders/project-home";

type UploadRequestRow = SubcontractorProjectView["allUploadRequests"][number];
type TabId = "all" | "open" | "submitted" | "completed";

const TABS: { id: TabId; label: string; match: (r: UploadRequestRow) => boolean }[] = [
  { id: "all", label: "All", match: () => true },
  {
    id: "open",
    label: "Needs Response",
    match: (r) => r.requestStatus === "open" || r.requestStatus === "revision_requested",
  },
  { id: "submitted", label: "Submitted", match: (r) => r.requestStatus === "submitted" },
  { id: "completed", label: "Completed", match: (r) => r.requestStatus === "completed" },
];

export function SubUploadResponseWorkspace({
  projectId,
  projectName,
  requests,
}: {
  projectId: string;
  projectName: string;
  requests: UploadRequestRow[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(requests[0]?.id ?? null);

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
    <div className="usw">
      <header className="usw-head">
        <div className="usw-head-main">
          <div className="usw-crumbs">{projectName} · Upload Requests</div>
          <h1 className="usw-title">Upload Requests — Response</h1>
          <p className="usw-desc">
            Review requests from the contractor, upload the requested files, and track
            responses and revisions.
          </p>
        </div>
      </header>

      <div className="usw-kpis">
        <KpiCard label="Assigned to You" value={summary.total.toString()} iconColor="blue" />
        <KpiCard
          label="Needs Response"
          value={summary.open.toString()}
          meta={summary.open === 0 ? "All clear" : "Upload required"}
          iconColor="amber"
          alert={summary.open > 0}
        />
        <KpiCard
          label="Overdue"
          value={summary.overdue.toString()}
          meta={summary.overdue === 0 ? "On track" : "Past due"}
          iconColor="red"
          alert={summary.overdue > 0}
        />
        <KpiCard
          label="Completed"
          value={summary.completed.toString()}
          meta="Accepted by contractor"
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
          <div className="usw-split">
            <div className="usw-queue">
              {filtered.map((r) => {
                const overdue =
                  (r.requestStatus === "open" || r.requestStatus === "revision_requested") &&
                  r.dueAt &&
                  r.dueAt.getTime() < now;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`usw-row ${selected?.id === r.id ? "usw-row-sel" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="usw-row-top">
                      <div className="usw-row-title">{r.title}</div>
                      <Pill color={statusPill(r.requestStatus, Boolean(overdue))}>
                        {overdue ? "Overdue" : formatStatus(r.requestStatus)}
                      </Pill>
                    </div>
                    {r.description && <div className="usw-row-desc">{r.description}</div>}
                    <div className="usw-row-foot">
                      <span>{r.dueAt ? `Due ${formatDate(r.dueAt)}` : "No due date"}</span>
                      <span>{r.expectedFileType ?? "Any file"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="usw-detail">
              {selected ? (
                <SubDetail key={selected.id} projectId={projectId} request={selected} />
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

      <style>{`
        .usw{display:flex;flex-direction:column;gap:20px}
        .usw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .usw-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .usw-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .usw-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .usw-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .usw-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.usw-kpis{grid-template-columns:repeat(2,1fr)}}
        .usw-split{display:grid;grid-template-columns:360px minmax(0,1fr)}
        @media(max-width:900px){.usw-split{grid-template-columns:1fr}}
        .usw-queue{border-right:1px solid var(--s3);max-height:640px;overflow-y:auto;display:flex;flex-direction:column}
        .usw-row{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s3);padding:14px 18px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:4px}
        .usw-row:hover{background:var(--sh)}
        .usw-row-sel{background:var(--ac-s)}
        .usw-row-sel:hover{background:var(--ac-s)}
        .usw-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .usw-row-title{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);letter-spacing:-.005em;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .usw-row-desc{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .usw-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .usw-detail{padding:22px 24px;min-width:0}
      `}</style>
    </div>
  );
}

function SubDetail({
  projectId,
  request,
}: {
  projectId: string;
  request: UploadRequestRow;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();
  const overdue =
    (request.requestStatus === "open" || request.requestStatus === "revision_requested") &&
    request.dueAt &&
    request.dueAt.getTime() < now;
  const canUpload =
    request.requestStatus === "open" || request.requestStatus === "revision_requested";

  async function handleFile(file: File) {
    setPending(true);
    setError(null);
    try {
      const presignRes = await fetch("/api/upload/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          documentType: "upload_request",
        }),
      });
      if (!presignRes.ok) throw new Error("presign_failed");
      const presign = await presignRes.json();

      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: presign.headers,
        body: file,
      });
      if (!putRes.ok) throw new Error("put_failed");

      const finalizeRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storageKey: presign.storageKey,
          title: file.name,
          documentType: "upload_request",
          visibilityScope: "subcontractor_scoped",
          audienceScope: "contractor",
          sourceObject: {
            type: "upload_request",
            id: request.id,
            linkRole: "submission",
          },
        }),
      });
      if (!finalizeRes.ok) throw new Error("finalize_failed");
      const { documentId } = await finalizeRes.json();

      const submitRes = await fetch(`/api/upload-requests/${request.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      });
      if (!submitRes.ok) throw new Error("submit_failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setPending(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  }

  return (
    <div className="usd">
      <div className="usd-head">
        <div className="usd-head-main">
          <h2 className="usd-title">{request.title}</h2>
          {request.description && <p className="usd-desc">{request.description}</p>}
        </div>
        <div className="usd-pills">
          <Pill color={statusPill(request.requestStatus, Boolean(overdue))}>
            {overdue ? "Overdue" : formatStatus(request.requestStatus)}
          </Pill>
        </div>
      </div>

      <div className="usd-grid">
        <Field label="File Type" value={request.expectedFileType ?? "Any"} />
        <Field
          label="Due Date"
          value={request.dueAt ? formatDate(request.dueAt) : "—"}
          meta={overdue ? "Past due date" : undefined}
        />
        <Field label="Requested" value={formatDate(request.createdAt)} />
        <Field label="Status" value={formatStatus(request.requestStatus)} />
      </div>

      {request.requestStatus === "revision_requested" && request.revisionNote && (
        <div className="usd-note">
          <div className="usd-note-lbl">Revision Requested</div>
          <p>{request.revisionNote}</p>
        </div>
      )}

      {canUpload ? (
        <div className="usd-section">
          <div className="usd-section-head">
            <h3>Upload Response</h3>
            <Pill color="purple">Required</Pill>
          </div>
          <div
            className="usd-zone"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <div className="usd-zone-title">Drop a file here or click to upload</div>
            <div className="usd-zone-meta">
              Expected: {request.expectedFileType ?? "Any file type"}
            </div>
            <Button variant="primary" disabled={pending}>
              {pending ? "Uploading..." : "Choose File"}
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={onInputChange}
            style={{ display: "none" }}
          />
          {error && <p className="usd-err">Error: {error}</p>}
        </div>
      ) : (
        <div className="usd-section">
          <div className="usd-section-head">
            <h3>
              {request.requestStatus === "submitted" ? "Submitted File" : "Submitted File"}
            </h3>
            {request.requestStatus === "submitted" && (
              <span className="usd-wait">Waiting on contractor review</span>
            )}
          </div>
          {request.submittedDocumentId ? (
            <div className="usd-file">
              <div className="usd-file-name">{request.submittedDocumentTitle ?? "File"}</div>
              <div className="usd-file-meta">
                {request.submittedAt ? `Submitted ${formatDate(request.submittedAt)}` : ""}
              </div>
            </div>
          ) : (
            <EmptyState title="No file on record" description="" />
          )}
        </div>
      )}

      <style>{`
        .usd{display:flex;flex-direction:column;gap:20px}
        .usd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
        .usd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
        .usd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.015em;color:var(--t1);margin:0}
        .usd-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .usd-pills{display:flex;gap:6px;flex-shrink:0}
        .usd-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px;background:var(--sh);border-radius:var(--r-m)}
        .usd-note{padding:12px 14px;background:var(--wr-s);border:1px solid var(--wr);border-radius:var(--r-m)}
        .usd-note-lbl{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--wr-t);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
        .usd-note p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);margin:0;line-height:1.5}
        .usd-section{display:flex;flex-direction:column;gap:12px}
        .usd-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .usd-section-head h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .usd-wait{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3)}
        .usd-zone{border:2px dashed var(--s4);border-radius:var(--r-l);padding:28px 20px;text-align:center;background:var(--s2);transition:all var(--dn) var(--e);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:8px}
        .usd-zone:hover{border-color:var(--ac);background:var(--ac-s)}
        .usd-zone-title{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1)}
        .usd-zone-meta{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-bottom:4px}
        .usd-file{border:1px solid var(--s3);border-radius:var(--r-m);padding:12px 14px;display:flex;flex-direction:column;gap:3px}
        .usd-file-name{font-family:var(--fm);font-size:12.5px;font-weight:540;color:var(--t1)}
        .usd-file-meta{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .usd-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      `}</style>
    </div>
  );
}

function Field({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <div className="usd-field">
      <div className="usd-k">{label}</div>
      <div className="usd-v">{value}</div>
      {meta && <div className="usd-m">{meta}</div>}
      <style>{`
        .usd-field{display:flex;flex-direction:column;gap:3px;min-width:0}
        .usd-k{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
        .usd-v{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .usd-m{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2)}
      `}</style>
    </div>
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
