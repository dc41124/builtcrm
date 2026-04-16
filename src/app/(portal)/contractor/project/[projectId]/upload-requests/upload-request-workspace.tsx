"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Pill, type PillColor } from "@/components/pill";
import type { ContractorProjectView } from "@/domain/loaders/project-home";

type UploadRequestRow = ContractorProjectView["uploadRequests"][number];
type TabId = "all" | "open" | "submitted" | "completed";

type OrgOption = { id: string; name: string };

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
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

export function ContractorUploadRequestsWorkspace({
  projectId,
  requests,
  subcontractorOrgs,
}: {
  projectId: string;
  projectName: string;
  requests: UploadRequestRow[];
  subcontractorOrgs: OrgOption[];
}) {
  const [now] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    requests[0]?.id ?? null,
  );
  const [createOpen, setCreateOpen] = useState(false);
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
        r.description?.toLowerCase().includes(q) ||
        r.requestedFromOrganizationName?.toLowerCase().includes(q),
    );
  }, [requests, activeTab, search]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="urw">
      <header className="urw-head">
        <div className="urw-head-main">
          <h1 className="urw-title">Upload Requests</h1>
          <p className="urw-desc">
            Issue file requests to subcontractors, track submissions, and
            review or accept returned files.
          </p>
        </div>
        <div className="urw-head-actions">
          <Button
            variant="primary"
            onClick={() => setCreateOpen((v) => !v)}
          >
            {createOpen ? "Cancel" : "New Request"}
          </Button>
        </div>
      </header>

      {createOpen && (
        <CreateRequestPanel
          projectId={projectId}
          subcontractorOrgs={subcontractorOrgs}
          onClose={() => setCreateOpen(false)}
        />
      )}

      <div className="urw-kpis">
        <div
          className="urw-sc strong"
          onClick={() => {
            setActiveTab("all");
            setSelectedId(null);
          }}
        >
          <div className="urw-sc-l">Total Requests</div>
          <div className="urw-sc-v">{counts.all}</div>
          <div className="urw-sc-m">
            {counts.open} open · {counts.submitted} submitted
          </div>
        </div>
        <div
          className={`urw-sc ${counts.open > 0 ? "alert" : ""}`}
          onClick={() => {
            setActiveTab("open");
            setSelectedId(null);
          }}
        >
          <div className="urw-sc-l">Open</div>
          <div className="urw-sc-v">{counts.open}</div>
          <div className="urw-sc-m">
            {counts.open === 0 ? "All clear" : "Waiting on subcontractor"}
          </div>
        </div>
        <div className={`urw-sc ${overdue > 0 ? "danger" : ""}`}>
          <div className="urw-sc-l">Overdue</div>
          <div className="urw-sc-v">{overdue}</div>
          <div className="urw-sc-m">
            {overdue === 0 ? "All on track" : "Needs immediate attention"}
          </div>
        </div>
        <div
          className="urw-sc success"
          onClick={() => {
            setActiveTab("completed");
            setSelectedId(null);
          }}
        >
          <div className="urw-sc-l">Completed</div>
          <div className="urw-sc-v">{counts.completed}</div>
          <div className="urw-sc-m">Accepted and closed</div>
        </div>
      </div>

      <div className="urw-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`urw-tab ${activeTab === t.id ? "on" : ""}`}
            onClick={() => {
              setActiveTab(t.id);
              setSelectedId(null);
            }}
          >
            {t.label} <span className="urw-tab-ct">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="urw-empty">
          <EmptyState
            title="No requests in this view"
            description="Requests will appear here when they match this filter."
          />
        </div>
      ) : (
        <div className="urw-ws">
          <div className="urw-qp">
            <div className="urw-qp-head">
              <h3>Request Queue</h3>
              <span>
                {filtered.length} item{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="urw-qp-srch">
              <input
                type="text"
                placeholder="Search requests…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="urw-q-list">
              {filtered.map((r) => {
                const od = isOverdue(r, now);
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`urw-qi ${selected?.id === r.id ? "on" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="urw-qi-top">
                      <div className="urw-qi-info">
                        <h4>{r.title}</h4>
                        <p>
                          {r.requestedFromOrganizationName ?? "Unassigned"}
                        </p>
                      </div>
                      <Pill color={statusPillColor(r.requestStatus, od)}>
                        {od ? "Overdue" : formatStatus(r.requestStatus)}
                      </Pill>
                    </div>
                    <div className="urw-qi-meta">
                      <span className="urw-mpl">
                        {r.requestStatus === "submitted"
                          ? r.submittedDocumentId
                            ? "1 file"
                            : "Submitted"
                          : r.requestStatus === "completed"
                            ? "Done"
                            : "Awaiting"}
                      </span>
                      <span className="urw-mpl">
                        {r.dueAt ? `Due ${formatDate(r.dueAt)}` : "No due date"}
                      </span>
                      {r.expectedFileType && (
                        <span className="urw-mpl">{r.expectedFileType}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="urw-d2">
            {selected && (
              <ContractorDetail key={selected.id} request={selected} now={now} />
            )}
          </div>
        </div>
      )}

      
    </div>
  );
}

function ContractorDetail({
  request,
  now,
}: {
  request: UploadRequestRow;
  now: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<null | "complete" | "revise">(null);
  const [error, setError] = useState<string | null>(null);

  const overdue = isOverdue(request, now);
  const odDays = overdue ? overdueDays(request, now) : 0;
  const isOpen =
    request.requestStatus === "open" ||
    request.requestStatus === "revision_requested";
  const isSubmitted = request.requestStatus === "submitted";
  const isCompleted = request.requestStatus === "completed";

  async function complete() {
    setPending("complete");
    setError(null);
    const res = await fetch(`/api/upload-requests/${request.id}/complete`, {
      method: "POST",
    });
    setPending(null);
    if (!res.ok) {
      setError("Unable to accept");
      return;
    }
    router.refresh();
  }

  async function revise() {
    const note = window.prompt("Revision note:");
    if (!note) return;
    setPending("revise");
    setError(null);
    const res = await fetch(`/api/upload-requests/${request.id}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setPending(null);
    if (!res.ok) {
      setError("Unable to request revision");
      return;
    }
    router.refresh();
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
      <div className="urd-main">
        <div className="urd-cd">
          <div className="urd-hdr">
            <div className="urd-hdr-main">
              <h2>{request.title}</h2>
              {request.description && (
                <p className="urd-desc">{request.description}</p>
              )}
              <div className="urd-hdr-pills">
                {headerPills.map((p) => (
                  <Pill key={p.label} color={p.color}>
                    {p.label}
                  </Pill>
                ))}
              </div>
            </div>
            <div className="urd-hdr-acts">
              {isOpen && (
                <>
                  <button type="button" className="urd-btn warn-o">
                    Send Reminder
                  </button>
                  <button type="button" className="urd-btn ghost">
                    Reassign
                  </button>
                  <button type="button" className="urd-btn dng-o">
                    Cancel
                  </button>
                </>
              )}
              {isSubmitted && (
                <>
                  <button
                    type="button"
                    className="urd-btn success"
                    onClick={complete}
                    disabled={pending != null}
                  >
                    {pending === "complete" ? "Accepting…" : "Accept & Close"}
                  </button>
                  <button
                    type="button"
                    className="urd-btn warn-o"
                    onClick={revise}
                    disabled={pending != null}
                  >
                    {pending === "revise" ? "Requesting…" : "Request Revision"}
                  </button>
                </>
              )}
              {isCompleted && (
                <button type="button" className="urd-btn ghost">
                  Reopen
                </button>
              )}
            </div>
          </div>

          <div className="urd-meta">
            <div className="urd-dm">
              <div className="urd-dm-k">Assigned To</div>
              <div className="urd-dm-v mono">
                {request.requestedFromOrganizationName ?? "—"}
              </div>
              <div className="urd-dm-m">Subcontractor</div>
            </div>
            <div className="urd-dm">
              <div className="urd-dm-k">Due Date</div>
              <div
                className="urd-dm-v"
                style={overdue ? { color: "var(--dg-t)" } : undefined}
              >
                {request.dueAt ? formatDate(request.dueAt) : "—"}
              </div>
              <div className="urd-dm-m">
                {overdue ? `${odDays}d overdue` : "On track"}
              </div>
            </div>
            <div className="urd-dm">
              <div className="urd-dm-k">File Type</div>
              <div className="urd-dm-v">{request.expectedFileType ?? "Any"}</div>
              <div className="urd-dm-m">Expected format</div>
            </div>
            <div className="urd-dm">
              <div className="urd-dm-k">Created</div>
              <div className="urd-dm-v">{formatDate(request.createdAt)}</div>
              <div className="urd-dm-m">Request issued</div>
            </div>
          </div>
        </div>

        {request.revisionNote && (
          <div className="urd-note">
            <div className="urd-note-lbl">Last Revision Note</div>
            <p>{request.revisionNote}</p>
          </div>
        )}

        <div className="urd-cd">
          <div className="urd-rhdr">
            <h3>
              {isSubmitted
                ? "Submitted File — Review Required"
                : isCompleted
                  ? "Submitted File"
                  : "Submission Status"}
            </h3>
            {request.submittedFile ? (
              <Pill color={isSubmitted ? "blue" : "green"}>1 file</Pill>
            ) : (
              <Pill color="purple">Awaiting</Pill>
            )}
          </div>
          <div className="urd-rbody">
            {request.submittedFile ? (
              <>
                <div className="urd-fr">
                  <div className="urd-fr-info">
                    <div className="urd-fr-name">
                      {request.submittedFile.title}
                    </div>
                    <div className="urd-fr-time">
                      {request.submittedFile.uploaderName
                        ? `Uploaded by ${request.submittedFile.uploaderName} · `
                        : "Received "}
                      {formatDate(request.submittedFile.uploadedAt)}
                    </div>
                  </div>
                  <span className="urd-fr-chip">
                    {request.submittedFile.documentType.toUpperCase()}
                  </span>
                </div>
                {request.responseNote && (
                  <div className="urd-rnote">
                    <div className="urd-rnote-lbl">Response Note</div>
                    <p>{request.responseNote}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="urd-awaiting">
                <p>
                  No files submitted yet.{" "}
                  {request.requestedFromOrganizationName ?? "The assignee"} has
                  been notified.
                </p>
              </div>
            )}
            {error && <p className="urd-err">{error}</p>}
          </div>
        </div>
      </div>

      <div className="urd-rail">
        <div className="urd-cd">
          <div className="urd-rhdr">
            <h3>Activity</h3>
          </div>
          <div className="urd-rbody">
            {request.activityTrail.length === 0 ? (
              <p className="urd-rp">
                Activity feed will populate as the request moves through
                assignment, submission, and review.
              </p>
            ) : (
              <div className="urd-al">
                {request.activityTrail.map((a) => (
                  <div key={a.id} className="urd-ai">
                    <div
                      className={`urd-adot ${dotClassFor(a.activityType)}`}
                    />
                    <div className="urd-atxt">
                      {a.actorName && <strong>{a.actorName} </strong>}
                      {a.title}
                    </div>
                    <div className="urd-atime">
                      {relativeTime(a.createdAt, now)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="urd-cd">
          <div className="urd-rhdr">
            <h3>Request Details</h3>
          </div>
          <div className="urd-rbody">
            <p className="urd-rp">
              {isOpen ? (
                <>
                  This request was sent to{" "}
                  <strong>
                    {request.requestedFromOrganizationName ??
                      "the subcontractor"}
                  </strong>
                  . If no response is received by the due date, consider
                  sending a reminder or reassigning.
                </>
              ) : isSubmitted ? (
                <>
                  <strong>
                    {request.requestedFromOrganizationName ?? "The assignee"}
                  </strong>{" "}
                  submitted a file for review. Accept & close to finalize, or
                  request a revision with a note.
                </>
              ) : (
                <>
                  This request is closed.{" "}
                  <strong>
                    {request.requestedFromOrganizationName ?? "The assignee"}
                  </strong>{" "}
                  delivered the file and the GC accepted it.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      
    </>
  );
}

function CreateRequestPanel({
  projectId,
  subcontractorOrgs,
  onClose,
}: {
  projectId: string;
  subcontractorOrgs: OrgOption[];
  onClose: () => void;
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
    <form className="urc" onSubmit={onSubmit}>
      <div className="urc-head">
        <div>
          <h3>New Upload Request</h3>
          <p>Request files from a subcontractor organization.</p>
        </div>
      </div>
      <div className="urc-body">
        <label className="urc-lbl">
          <span>Title</span>
          <input
            className="urc-inp"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="MEP Closeout Pack"
          />
        </label>
        <label className="urc-lbl">
          <span>Description</span>
          <textarea
            className="urc-inp urc-ta"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what should be included in the upload."
          />
        </label>
        <div className="urc-row">
          <label className="urc-lbl">
            <span>Assigned subcontractor</span>
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
          </label>
          <label className="urc-lbl">
            <span>Due date</span>
            <input
              className="urc-inp"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>
        <label className="urc-lbl">
          <span>Expected file type</span>
          <input
            className="urc-inp"
            value={expectedFileType}
            onChange={(e) => setExpectedFileType(e.target.value)}
            required
            placeholder="PDF"
          />
        </label>
        {error && <p className="urc-err">Error: {error}</p>}
      </div>
      <div className="urc-foot">
        <Button variant="ghost" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={pending}>
          Create Request
        </Button>
      </div>
      
    </form>
  );
}
