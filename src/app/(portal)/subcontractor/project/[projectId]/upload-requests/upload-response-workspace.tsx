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

      <style dangerouslySetInnerHTML={{ __html: `
        .usw{display:flex;flex-direction:column;gap:20px}
        .usw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .usw-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .usw-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;color:var(--t1);line-height:1.15;margin:0}
        .usw-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}

        .usw-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        @media(max-width:1000px){.usw-kpis{grid-template-columns:repeat(2,1fr)}}
        .usw-sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm);cursor:pointer;transition:all var(--dn) var(--e)}
        .usw-sc:hover{box-shadow:var(--shmd);transform:translateY(-1px)}
        .usw-sc.strong{border-color:color-mix(in srgb,var(--ac) 30%,var(--s3))}
        .usw-sc.alert{border-color:color-mix(in srgb,var(--wr) 30%,var(--s3))}
        .usw-sc.danger{border-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
        .usw-sc.success{border-color:color-mix(in srgb,var(--ok) 30%,var(--s3))}
        .usw-sc-l{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .usw-sc-v{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px;color:var(--t1)}
        .usw-sc-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}

        .usw-tabs{display:flex;gap:4px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content}
        .usw-tab{height:34px;padding:0 16px;border-radius:var(--r-m);font-family:var(--fb);font-size:12px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:6px;border:none;background:transparent;cursor:pointer;transition:all var(--dn) var(--e)}
        .usw-tab:hover{color:var(--t1)}
        .usw-tab.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
        .usw-tab-ct{font-family:var(--fd);font-size:10px;font-weight:800;color:var(--t3);background:var(--s3);padding:1px 6px;border-radius:999px}
        .usw-tab.on .usw-tab-ct{background:var(--ac-s);color:var(--ac-t)}

        .usw-empty{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:40px 20px}

        .usw-ws{display:grid;grid-template-columns:380px minmax(0,1fr);gap:16px;align-items:start}
        @media(max-width:1200px){.usw-ws{grid-template-columns:1fr}}

        .usw-qp{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;min-width:0}
        .usw-qp-head{padding:14px 16px;border-bottom:1px solid var(--s3);display:flex;align-items:center;justify-content:space-between}
        .usw-qp-head h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .usw-qp-head span{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3)}
        .usw-qp-srch{padding:10px 14px;border-bottom:1px solid var(--s2)}
        .usw-qp-srch input{width:100%;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px;font-family:var(--fb);font-size:12px;color:var(--t1);outline:none;transition:all var(--df) var(--e)}
        .usw-qp-srch input:focus{border-color:var(--ac);background:var(--s1)}
        .usw-q-list{max-height:calc(100vh - 400px);min-height:240px;overflow-y:auto}
        .usw-q-list::-webkit-scrollbar{width:4px}
        .usw-q-list::-webkit-scrollbar-track{background:transparent}
        .usw-q-list::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
        .usw-qi{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s2);padding:12px 16px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:6px;width:100%}
        .usw-qi:last-child{border-bottom:none}
        .usw-qi:hover{background:var(--sh)}
        .usw-qi.on{background:var(--ac-s)}
        .usw-qi-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
        .usw-qi-info{min-width:0;flex:1}
        .usw-qi-info h4{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0;letter-spacing:-.005em}
        .usw-qi-info p{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin:2px 0 0;line-height:1.4}
        .usw-qi-meta{display:flex;gap:4px;flex-wrap:wrap}
        .usw-mpl{height:20px;padding:0 8px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t3);font-family:var(--fd);font-size:10px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}

        .usw-d2{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start;min-width:0}
        @media(max-width:1400px){.usw-d2{grid-template-columns:1fr}}
      ` }} />
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

      <style dangerouslySetInnerHTML={{ __html: `
        .usd-main{display:flex;flex-direction:column;gap:14px;min-width:0}
        .usd-rail{display:flex;flex-direction:column;gap:12px;min-width:0}

        .usd-cd{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}

        .usd-hdr{padding:20px 22px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
        .usd-hdr-main{min-width:0;flex:1}
        .usd-hdr-main h2{font-family:var(--fd);font-size:20px;font-weight:780;letter-spacing:-.02em;color:var(--t1);margin:0}
        .usd-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.55;max-width:560px;margin:6px 0 0}
        .usd-hdr-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
        .usd-hdr-acts{display:flex;gap:6px;flex-shrink:0;align-items:center}
        .usd-wait{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3)}

        .usd-meta{display:grid;grid-template-columns:repeat(2,1fr);border-top:1px solid var(--s2)}
        .usd-dm{padding:14px 22px;border-bottom:1px solid var(--s2);border-right:1px solid var(--s2)}
        .usd-dm:nth-child(even){border-right:none}
        .usd-dm:nth-last-child(1),.usd-dm:nth-last-child(2){border-bottom:none}
        .usd-dm-k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .usd-dm-v{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);margin-top:3px}
        .usd-dm-m{font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);margin-top:1px}

        .usd-note{padding:12px 14px;background:var(--wr-s);border:1px solid color-mix(in srgb,var(--wr) 30%,var(--s3));border-radius:var(--r-m)}
        .usd-note-lbl{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--wr-t);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
        .usd-note p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);margin:0;line-height:1.5}

        .usd-rhdr{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid var(--s2)}
        .usd-rhdr h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .usd-rbody{padding:16px 20px}

        .usd-uz{border:2px dashed var(--s4);border-radius:var(--r-l);padding:24px 20px;text-align:center;background:var(--s2);transition:all var(--dn) var(--e);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--t3)}
        .usd-uz:hover{border-color:var(--ac);background:var(--ac-s);color:var(--ac-t)}
        .usd-uz h5{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:8px 0 0;letter-spacing:-.01em}
        .usd-uz p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:0}
        .usd-uz-acts{display:flex;gap:8px;margin-top:10px;justify-content:center;flex-wrap:wrap}

        .usd-btn{height:32px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12px;font-weight:640;cursor:pointer;transition:all var(--df) var(--e);display:inline-flex;align-items:center}
        .usd-btn:hover:not(:disabled){border-color:var(--s4);background:var(--sh)}
        .usd-btn:disabled{opacity:.6;cursor:not-allowed}
        .usd-btn.pri{background:var(--ac);border-color:var(--ac);color:#fff}
        .usd-btn.pri:hover:not(:disabled){background:var(--ac-h);border-color:var(--ac-h)}

        .usd-fgrp{display:flex;flex-direction:column;gap:6px;margin-top:14px}
        .usd-fgrp label{font-family:var(--fb);font-size:11.5px;font-weight:620;color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
        .usd-fgrp textarea{min-height:70px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:10px 12px;font-family:var(--fb);font-size:13px;color:var(--t1);outline:none;resize:vertical;width:100%;transition:all var(--df) var(--e)}
        .usd-fgrp textarea:focus{border-color:var(--ac);background:var(--s1)}

        .usd-fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--s2)}
        .usd-fr:last-child{border-bottom:none}
        .usd-fr-info{min-width:0;flex:1}
        .usd-fr-name{font-family:var(--fm);font-size:12.5px;font-weight:540;color:var(--t1);word-break:break-all}
        .usd-fr-time{font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);margin-top:1px}
        .usd-fr-chip{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);padding:3px 8px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap}

        .usd-rp{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}
        .usd-rp strong{color:var(--t1);font-weight:650}

        .usd-ctx{display:flex;flex-direction:column;gap:6px;margin-top:10px}
        .usd-ctx-row{display:flex;align-items:center;gap:8px;font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2)}
        .usd-mpl{height:20px;padding:0 8px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t3);font-family:var(--fd);font-size:10px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}

        .usd-err{font-family:var(--fb);font-size:12px;color:var(--dg-t);margin:8px 0 0}

        .usd-rnote{margin-top:12px;padding:12px 14px;background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m)}
        .usd-rnote-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
        .usd-rnote p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

        .usd-al{display:flex;flex-direction:column}
        .usd-ai{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--s2)}
        .usd-ai:last-child{border-bottom:none}
        .usd-adot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;background:var(--s4)}
        .usd-adot.steel{background:#3d6b8e}
        .usd-adot.green{background:var(--ok)}
        .usd-adot.orange{background:var(--wr)}
        .usd-adot.red{background:var(--dg)}
        .usd-adot.purple{background:var(--ac)}
        .usd-atxt{flex:1;font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);line-height:1.45}
        .usd-atxt strong{color:var(--t1);font-weight:650}
        .usd-atime{font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);white-space:nowrap;flex-shrink:0;padding-top:1px}
      ` }} />
    </>
  );
}
