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

      <style dangerouslySetInnerHTML={{ __html: `
        .urw{display:flex;flex-direction:column;gap:20px}
        .urw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .urw-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .urw-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;color:var(--t1);line-height:1.15;margin:0}
        .urw-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .urw-head-actions{display:flex;gap:8px;flex-shrink:0;padding-top:4px}

        .urw-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        @media(max-width:1000px){.urw-kpis{grid-template-columns:repeat(2,1fr)}}
        .urw-sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm);cursor:pointer;transition:all var(--dn) var(--e)}
        .urw-sc:hover{box-shadow:var(--shmd);transform:translateY(-1px)}
        .urw-sc.strong{border-color:color-mix(in srgb,var(--ac) 30%,var(--s3))}
        .urw-sc.alert{border-color:color-mix(in srgb,var(--wr) 30%,var(--s3))}
        .urw-sc.danger{border-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
        .urw-sc.success{border-color:color-mix(in srgb,var(--ok) 30%,var(--s3))}
        .urw-sc-l{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .urw-sc-v{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px;color:var(--t1)}
        .urw-sc-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}

        .urw-tabs{display:flex;gap:4px;background:var(--s2);border-radius:var(--r-l);padding:4px;width:fit-content}
        .urw-tab{height:34px;padding:0 16px;border-radius:var(--r-m);font-family:var(--fb);font-size:12px;font-weight:650;color:var(--t2);display:inline-flex;align-items:center;gap:6px;border:none;background:transparent;cursor:pointer;transition:all var(--dn) var(--e)}
        .urw-tab:hover{color:var(--t1)}
        .urw-tab.on{background:var(--s1);color:var(--t1);box-shadow:var(--shsm)}
        .urw-tab-ct{font-family:var(--fd);font-size:10px;font-weight:800;color:var(--t3);background:var(--s3);padding:1px 6px;border-radius:999px}
        .urw-tab.on .urw-tab-ct{background:var(--ac-s);color:var(--ac-t)}

        .urw-empty{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:40px 20px}

        .urw-ws{display:grid;grid-template-columns:380px minmax(0,1fr);gap:16px;align-items:start}
        @media(max-width:1200px){.urw-ws{grid-template-columns:1fr}}

        .urw-qp{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;min-width:0}
        .urw-qp-head{padding:14px 16px;border-bottom:1px solid var(--s3);display:flex;align-items:center;justify-content:space-between}
        .urw-qp-head h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .urw-qp-head span{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3)}
        .urw-qp-srch{padding:10px 14px;border-bottom:1px solid var(--s2)}
        .urw-qp-srch input{width:100%;height:34px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:0 12px;font-family:var(--fb);font-size:12px;color:var(--t1);outline:none;transition:all var(--df) var(--e)}
        .urw-qp-srch input:focus{border-color:var(--ac);background:var(--s1)}
        .urw-q-list{max-height:calc(100vh - 400px);min-height:240px;overflow-y:auto}
        .urw-q-list::-webkit-scrollbar{width:4px}
        .urw-q-list::-webkit-scrollbar-track{background:transparent}
        .urw-q-list::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
        .urw-qi{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s2);padding:12px 16px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:6px;width:100%}
        .urw-qi:last-child{border-bottom:none}
        .urw-qi:hover{background:var(--sh)}
        .urw-qi.on{background:var(--ac-s)}
        .urw-qi-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
        .urw-qi-info{min-width:0;flex:1}
        .urw-qi-info h4{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0;letter-spacing:-.005em}
        .urw-qi-info p{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin:2px 0 0}
        .urw-qi-meta{display:flex;gap:4px;flex-wrap:wrap}
        .urw-mpl{height:20px;padding:0 8px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t3);font-family:var(--fd);font-size:10px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}

        .urw-d2{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:14px;align-items:start;min-width:0}
        @media(max-width:1400px){.urw-d2{grid-template-columns:1fr}}
      ` }} />
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

      <style dangerouslySetInnerHTML={{ __html: `
        .urd-main{display:flex;flex-direction:column;gap:14px;min-width:0}
        .urd-rail{display:flex;flex-direction:column;gap:12px;min-width:0}

        .urd-cd{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}

        .urd-hdr{padding:20px 22px;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}
        .urd-hdr-main{min-width:0;flex:1}
        .urd-hdr-main h2{font-family:var(--fd);font-size:20px;font-weight:780;letter-spacing:-.02em;color:var(--t1);margin:0}
        .urd-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.55;max-width:560px;margin:6px 0 0}
        .urd-hdr-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
        .urd-hdr-acts{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap}

        .urd-meta{display:grid;grid-template-columns:repeat(2,1fr);border-top:1px solid var(--s2)}
        .urd-dm{padding:14px 22px;border-bottom:1px solid var(--s2);border-right:1px solid var(--s2)}
        .urd-dm:nth-child(even){border-right:none}
        .urd-dm:nth-last-child(1),.urd-dm:nth-last-child(2){border-bottom:none}
        .urd-dm-k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .urd-dm-v{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);margin-top:3px}
        .urd-dm-v.mono{font-family:var(--fm);font-size:13px;font-weight:540}
        .urd-dm-m{font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);margin-top:1px}

        .urd-note{padding:12px 14px;background:var(--wr-s);border:1px solid color-mix(in srgb,var(--wr) 30%,var(--s3));border-radius:var(--r-m)}
        .urd-note-lbl{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--wr-t);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
        .urd-note p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);margin:0;line-height:1.5}

        .urd-rhdr{padding:16px 20px;display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid var(--s2)}
        .urd-rhdr h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .urd-rbody{padding:16px 20px}

        .urd-fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--s2)}
        .urd-fr:last-child{border-bottom:none}
        .urd-fr-info{min-width:0;flex:1}
        .urd-fr-name{font-family:var(--fm);font-size:12.5px;font-weight:540;color:var(--t1);word-break:break-all}
        .urd-fr-time{font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);margin-top:1px}
        .urd-fr-chip{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);padding:3px 8px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap}

        .urd-awaiting{text-align:center;padding:16px 0}
        .urd-awaiting p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0}

        .urd-rp{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}
        .urd-rp strong{color:var(--t1);font-weight:650}

        .urd-btn{height:32px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12px;font-weight:640;cursor:pointer;transition:all var(--df) var(--e);white-space:nowrap}
        .urd-btn:hover:not(:disabled){border-color:var(--s4);background:var(--sh)}
        .urd-btn:disabled{opacity:.6;cursor:not-allowed}
        .urd-btn.ghost{border-color:transparent;background:transparent;color:var(--t2)}
        .urd-btn.ghost:hover:not(:disabled){background:var(--s2);color:var(--t1)}
        .urd-btn.success{background:var(--ok);border-color:var(--ok);color:#fff}
        .urd-btn.success:hover:not(:disabled){background:var(--ok-t);border-color:var(--ok-t)}
        .urd-btn.warn-o{border-color:color-mix(in srgb,var(--wr) 30%,var(--s3));color:var(--wr-t);background:var(--s1)}
        .urd-btn.warn-o:hover:not(:disabled){background:var(--wr-s)}
        .urd-btn.dng-o{border-color:color-mix(in srgb,var(--dg) 30%,var(--s3));color:var(--dg-t);background:var(--s1)}
        .urd-btn.dng-o:hover:not(:disabled){background:var(--dg-s)}

        .urd-err{font-family:var(--fb);font-size:12px;color:var(--dg-t);margin:8px 0 0}

        .urd-rnote{margin-top:12px;padding:12px 14px;background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m)}
        .urd-rnote-lbl{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
        .urd-rnote p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

        .urd-al{display:flex;flex-direction:column}
        .urd-ai{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--s2)}
        .urd-ai:last-child{border-bottom:none}
        .urd-adot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px;background:var(--s4)}
        .urd-adot.steel{background:#3d6b8e}
        .urd-adot.green{background:var(--ok)}
        .urd-adot.orange{background:var(--wr)}
        .urd-adot.red{background:var(--dg)}
        .urd-adot.purple{background:var(--ac)}
        .urd-atxt{flex:1;font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);line-height:1.45}
        .urd-atxt strong{color:var(--t1);font-weight:650}
        .urd-atime{font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);white-space:nowrap;flex-shrink:0;padding-top:1px}
      ` }} />
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
      <style dangerouslySetInnerHTML={{ __html: `
        .urc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .urc-head{padding:16px 20px;border-bottom:1px solid var(--s2)}
        .urc-head h3{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
        .urc-head p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:2px 0 0}
        .urc-body{padding:16px 20px;display:flex;flex-direction:column;gap:12px}
        .urc-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        @media(max-width:700px){.urc-row{grid-template-columns:1fr}}
        .urc-lbl{display:flex;flex-direction:column;gap:5px;font-family:var(--fb);font-size:11.5px;font-weight:620;color:var(--t2);text-transform:uppercase;letter-spacing:.04em}
        .urc-inp{width:100%;height:36px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);outline:none;transition:all var(--df) var(--e)}
        .urc-inp:focus{border-color:var(--ac);background:var(--s1)}
        .urc-ta{height:auto;padding:10px 12px;resize:vertical;line-height:1.5}
        .urc-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
        .urc-foot{padding:12px 20px;border-top:1px solid var(--s2);background:var(--s2);display:flex;justify-content:flex-end;gap:8px}
      ` }} />
    </form>
  );
}
