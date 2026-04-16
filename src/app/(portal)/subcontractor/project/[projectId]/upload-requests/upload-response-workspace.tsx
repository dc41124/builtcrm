"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { Pill, type PillColor } from "@/components/pill";
import type { SubcontractorProjectView } from "@/domain/loaders/project-home";

type UploadRequestRow = SubcontractorProjectView["allUploadRequests"][number];
type TabId = "all" | "open" | "submitted" | "completed";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Needs Response" },
  { id: "submitted", label: "Submitted" },
  { id: "completed", label: "Completed" },
];

function matchTab(r: UploadRequestRow, tab: TabId): boolean {
  if (tab === "all") return true;
  if (tab === "open")
    return r.requestStatus === "open" || r.requestStatus === "revision_requested";
  if (tab === "submitted") return r.requestStatus === "submitted";
  return r.requestStatus === "completed";
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

function statusPillColor(status: string, overdue: boolean): PillColor {
  if (overdue) return "red";
  if (status === "completed") return "green";
  if (status === "submitted") return "blue";
  if (status === "revision_requested") return "amber";
  return "purple";
}

function isOverdue(r: UploadRequestRow, now: number): boolean {
  return (
    (r.requestStatus === "open" || r.requestStatus === "revision_requested") &&
    r.dueAt != null &&
    r.dueAt.getTime() < now
  );
}

function overdueDays(r: UploadRequestRow, now: number): number {
  if (!r.dueAt) return 0;
  return Math.max(1, Math.floor((now - r.dueAt.getTime()) / 86400000));
}

function relativeTime(d: Date, now: number): string {
  const diff = Math.max(0, now - d.getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return formatDate(d);
}

function dotClassFor(activityType: string): string {
  if (activityType.includes("upload") || activityType.includes("submit"))
    return "steel";
  if (activityType.includes("accept") || activityType.includes("complete"))
    return "green";
  if (activityType.includes("revis") || activityType.includes("overdue"))
    return "orange";
  if (activityType.includes("cancel") || activityType.includes("reject"))
    return "red";
  return "purple";
}

export function SubUploadResponseWorkspace({
  projectId,
  requests,
}: {
  projectId: string;
  projectName: string;
  requests: UploadRequestRow[];
}) {
  const [now] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    requests[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");

  const counts = useMemo(() => {
    const c = { all: 0, open: 0, submitted: 0, completed: 0 };
    for (const r of requests) {
      c.all += 1;
      if (r.requestStatus === "open" || r.requestStatus === "revision_requested")
        c.open += 1;
      else if (r.requestStatus === "submitted") c.submitted += 1;
      else if (r.requestStatus === "completed") c.completed += 1;
    }
    return c;
  }, [requests]);

  const overdue = useMemo(
    () => requests.filter((r) => isOverdue(r, now)).length,
    [requests, now],
  );

  const filtered = useMemo(() => {
    const base = requests.filter((r) => matchTab(r, activeTab));
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q),
    );
  }, [requests, activeTab, search]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="usw">
      <header className="usw-head">
        <div className="usw-head-main">
          <h1 className="usw-title">Upload Requests — Response</h1>
          <p className="usw-desc">
            Review requests from the contractor, upload the requested files,
            and track responses and revisions.
          </p>
        </div>
      </header>

      <div className="usw-kpis">
        <div
          className="usw-sc strong"
          onClick={() => {
            setActiveTab("all");
            setSelectedId(null);
          }}
        >
          <div className="usw-sc-l">Assigned to You</div>
          <div className="usw-sc-v">{counts.all}</div>
          <div className="usw-sc-m">
            {counts.open} open · {counts.submitted} submitted
          </div>
        </div>
        <div
          className={`usw-sc ${counts.open > 0 ? "alert" : ""}`}
          onClick={() => {
            setActiveTab("open");
            setSelectedId(null);
          }}
        >
          <div className="usw-sc-l">Needs Response</div>
          <div className="usw-sc-v">{counts.open}</div>
          <div className="usw-sc-m">
            {counts.open === 0 ? "All clear" : "Upload required"}
          </div>
        </div>
        <div className={`usw-sc ${overdue > 0 ? "danger" : ""}`}>
          <div className="usw-sc-l">Overdue</div>
          <div className="usw-sc-v">{overdue}</div>
          <div className="usw-sc-m">
            {overdue === 0 ? "On track" : "Past due"}
          </div>
        </div>
        <div
          className="usw-sc success"
          onClick={() => {
            setActiveTab("completed");
            setSelectedId(null);
          }}
        >
          <div className="usw-sc-l">Completed</div>
          <div className="usw-sc-v">{counts.completed}</div>
          <div className="usw-sc-m">Accepted by contractor</div>
        </div>
      </div>

      <div className="usw-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`usw-tab ${activeTab === t.id ? "on" : ""}`}
            onClick={() => {
              setActiveTab(t.id);
              setSelectedId(null);
            }}
          >
            {t.label} <span className="usw-tab-ct">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="usw-empty">
          <EmptyState
            title="No requests in this view"
            description="Requests will appear here when they match this filter."
          />
        </div>
      ) : (
        <div className="usw-ws">
          <div className="usw-qp">
            <div className="usw-qp-head">
              <h3>Assigned Requests</h3>
              <span>
                {filtered.length} item{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="usw-qp-srch">
              <input
                type="text"
                placeholder="Search requests…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="usw-q-list">
              {filtered.map((r) => {
                const od = isOverdue(r, now);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`usw-qi ${selected?.id === r.id ? "on" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="usw-qi-top">
                      <div className="usw-qi-info">
                        <h4>{r.title}</h4>
                        {r.description && (
                          <p>
                            {r.description.length > 60
                              ? r.description.slice(0, 60) + "…"
                              : r.description}
                          </p>
                        )}
                      </div>
                      <Pill color={statusPillColor(r.requestStatus, od)}>
                        {od ? "Overdue" : formatStatus(r.requestStatus)}
                      </Pill>
                    </div>
                    <div className="usw-qi-meta">
                      <span className="usw-mpl">
                        {r.requestStatus === "submitted"
                          ? r.submittedDocumentId
                            ? "1 file"
                            : "Submitted"
                          : r.requestStatus === "completed"
                            ? "Done"
                            : "Awaiting"}
                      </span>
                      <span className="usw-mpl">
                        {r.dueAt ? `Due ${formatDate(r.dueAt)}` : "No due date"}
                      </span>
                      {r.expectedFileType && (
                        <span className="usw-mpl">{r.expectedFileType}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="usw-d2">
            {selected && (
              <SubDetail
                key={selected.id}
                projectId={projectId}
                request={selected}
                now={now}
              />
            )}
          </div>
        </div>
      )}

      
    </div>
  );
}

function SubDetail({
  projectId,
  request,
  now,
}: {
  projectId: string;
  request: UploadRequestRow;
  now: number;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseNote, setResponseNote] = useState("");

  const overdue = isOverdue(request, now);
  const odDays = overdue ? overdueDays(request, now) : 0;
  const canUpload =
    request.requestStatus === "open" ||
    request.requestStatus === "revision_requested";
  const isSubmitted = request.requestStatus === "submitted";

  async function uploadSingleFile(file: File): Promise<string> {
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
      }),
    });
    if (!finalizeRes.ok) throw new Error("finalize_failed");
    const { documentId } = (await finalizeRes.json()) as { documentId: string };
    return documentId;
  }

  async function handleFiles(files: File[]) {
    setPending(true);
    setError(null);
    try {
      const documentIds: string[] = [];
      for (const file of files) {
        const docId = await uploadSingleFile(file);
        documentIds.push(docId);
      }

      const submitRes = await fetch(`/api/upload-requests/${request.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds,
          responseNote: responseNote.trim() || undefined,
        }),
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
    const files = e.target.files;
    if (files && files.length > 0) void handleFiles(Array.from(files));
    e.target.value = "";
  }

  const headerPills: { label: string; color: PillColor }[] = [];
  if (overdue) headerPills.push({ label: `Overdue · ${odDays}d`, color: "red" });
  headerPills.push({
    label: overdue ? "Open" : formatStatus(request.requestStatus),
    color: statusPillColor(request.requestStatus, false),
  });
  if (request.expectedFileType)
    headerPills.push({ label: request.expectedFileType, color: "gray" });

  return (
    <>
      <div className="usd-main">
        <div className="usd-cd">
          <div className="usd-hdr">
            <div className="usd-hdr-main">
              <h2>{request.title}</h2>
              {request.description && (
                <p className="usd-desc">{request.description}</p>
              )}
              <div className="usd-hdr-pills">
                {headerPills.map((p) => (
                  <Pill key={p.label} color={p.color}>
                    {p.label}
                  </Pill>
                ))}
              </div>
            </div>
            <div className="usd-hdr-acts">
              {canUpload && (
                <button
                  type="button"
                  className="usd-btn pri"
                  disabled={pending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {pending ? "Uploading…" : "Upload Files"}
                </button>
              )}
              {isSubmitted && (
                <span className="usd-wait">Waiting on GC review</span>
              )}
            </div>
          </div>

          <div className="usd-meta">
            <div className="usd-dm">
              <div className="usd-dm-k">Requested By</div>
              <div className="usd-dm-v">Contractor PM</div>
              <div className="usd-dm-m">Project team</div>
            </div>
            <div className="usd-dm">
              <div className="usd-dm-k">Due Date</div>
              <div
                className="usd-dm-v"
                style={overdue ? { color: "var(--dg-t)" } : undefined}
              >
                {request.dueAt ? formatDate(request.dueAt) : "—"}
              </div>
              <div className="usd-dm-m">
                {overdue ? `${odDays}d overdue` : "On track"}
              </div>
            </div>
            <div className="usd-dm">
              <div className="usd-dm-k">File Type</div>
              <div className="usd-dm-v">{request.expectedFileType ?? "Any"}</div>
              <div className="usd-dm-m">Expected format</div>
            </div>
            <div className="usd-dm">
              <div className="usd-dm-k">Received</div>
              <div className="usd-dm-v">{formatDate(request.createdAt)}</div>
              <div className="usd-dm-m">Request issued</div>
            </div>
          </div>
        </div>

        {request.requestStatus === "revision_requested" && request.revisionNote && (
          <div className="usd-note">
            <div className="usd-note-lbl">Revision Requested</div>
            <p>{request.revisionNote}</p>
          </div>
        )}

        {canUpload ? (
          <div className="usd-cd">
            <div className="usd-rhdr">
              <h3>Upload Response</h3>
              <Pill color="purple">Required</Pill>
            </div>
            <div className="usd-rbody">
              <div
                className="usd-uz"
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    fileInputRef.current?.click();
                }}
              >
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <h5>Drop files here or click to upload</h5>
                <p>
                  Upload {request.expectedFileType ?? "files"} for this request.
                </p>
                <div className="usd-uz-acts">
                  <button
                    type="button"
                    className="usd-btn pri"
                    disabled={pending}
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    {pending ? "Uploading…" : "Upload Files"}
                  </button>
                  <button
                    type="button"
                    className="usd-btn"
                    disabled
                    onClick={(e) => e.stopPropagation()}
                  >
                    Use Project File
                  </button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={onInputChange}
                accept=".pdf,.jpg,.jpeg,.png,.dwg,.xlsx,.docx"
                style={{ display: "none" }}
              />
              <div className="usd-fgrp">
                <label>Response Note (optional)</label>
                <textarea
                  placeholder="Add context about your submission…"
                  value={responseNote}
                  onChange={(e) => setResponseNote(e.target.value)}
                />
              </div>
              {error && <p className="usd-err">Error: {error}</p>}
            </div>
          </div>
        ) : (
          <div className="usd-cd">
            <div className="usd-rhdr">
              <h3>Submitted Files</h3>
              <Pill color={isSubmitted ? "blue" : "green"}>
                {request.submittedFile ? "1 file" : "No file"}
              </Pill>
            </div>
            <div className="usd-rbody">
              {request.submittedFile ? (
                <>
                  <div className="usd-fr">
                    <div className="usd-fr-info">
                      <div className="usd-fr-name">
                        {request.submittedFile.title}
                      </div>
                      <div className="usd-fr-time">
                        Uploaded{" "}
                        {formatDate(request.submittedFile.uploadedAt)}
                      </div>
                    </div>
                    <span className="usd-fr-chip">
                      {request.submittedFile.documentType.toUpperCase()}
                    </span>
                  </div>
                  {request.responseNote && (
                    <div className="usd-rnote">
                      <div className="usd-rnote-lbl">Response Note</div>
                      <p>{request.responseNote}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="usd-rp">No file on record.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="usd-rail">
        <div className="usd-cd">
          <div className="usd-rhdr">
            <h3>Activity</h3>
          </div>
          <div className="usd-rbody">
            {request.activityTrail.length === 0 ? (
              <p className="usd-rp">
                Activity feed will populate as you upload, submit, and receive
                GC responses.
              </p>
            ) : (
              <div className="usd-al">
                {request.activityTrail.map((a) => (
                  <div key={a.id} className="usd-ai">
                    <div
                      className={`usd-adot ${dotClassFor(a.activityType)}`}
                    />
                    <div className="usd-atxt">
                      {a.actorName && <strong>{a.actorName} </strong>}
                      {a.title}
                    </div>
                    <div className="usd-atime">
                      {relativeTime(a.createdAt, now)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="usd-cd">
          <div className="usd-rhdr">
            <h3>What the GC Needs</h3>
          </div>
          <div className="usd-rbody">
            <p className="usd-rp">
              {request.description ??
                "No additional context provided by the GC."}
            </p>
            <div className="usd-ctx">
              {request.expectedFileType && (
                <div className="usd-ctx-row">
                  <span className="usd-mpl">{request.expectedFileType}</span>
                  <span>Accepted format</span>
                </div>
              )}
              {request.dueAt && (
                <div className="usd-ctx-row">
                  <span className="usd-mpl">{formatDate(request.dueAt)}</span>
                  <span>Due date</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      
    </>
  );
}
