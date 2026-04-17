"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import type { RfiRow } from "@/domain/loaders/project-home";

type TabId = "needs_reply" | "assigned" | "closed";

const TABS: { id: TabId; label: string; match: (r: RfiRow) => boolean }[] = [
  {
    id: "needs_reply",
    label: "Needs your reply",
    match: (r) => r.rfiStatus === "open" || r.rfiStatus === "pending_response",
  },
  {
    id: "assigned",
    label: "All assigned",
    match: () => true,
  },
  { id: "closed", label: "Closed", match: (r) => r.rfiStatus === "closed" },
];

// Inline KPI icons
const InboxIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
  </svg>
);
const ClipboardIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2h6a2 2 0 012 2v1h2a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2V4a2 2 0 012-2z" />
    <path d="M9 2v3h6V2" />
  </svg>
);
const MessageIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
  </svg>
);
const CheckCircleIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <path d="M22 4L12 14.01l-3-3" />
  </svg>
);

export function SubRfiResponseWorkspace({
  rfis,
  nowMs: now,
}: {
  projectName: string;
  rfis: RfiRow[];
  nowMs: number;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("needs_reply");
  const [selectedId, setSelectedId] = useState<string | null>(rfis[0]?.id ?? null);

  const summary = useMemo(() => {
    const needsReply = rfis.filter(
      (r) => r.rfiStatus === "open" || r.rfiStatus === "pending_response",
    ).length;
    const overdue = rfis.filter(
      (r) => r.rfiStatus !== "closed" && r.dueAt && r.dueAt.getTime() < now,
    ).length;
    const assigned = rfis.length;
    const closed = rfis.filter((r) => r.rfiStatus === "closed").length;
    return { needsReply, overdue, assigned, closed };
  }, [rfis, now]);

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab)!;
    return rfis.filter(tab.match);
  }, [rfis, activeTab]);

  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const firstOverdue = useMemo(
    () =>
      rfis.find(
        (r) => r.rfiStatus !== "closed" && r.dueAt && r.dueAt.getTime() < now,
      ) ?? null,
    [rfis, now],
  );

  const avgResponseDays = useMemo(() => {
    const answered = rfis.filter(
      (r) => r.responses.length > 0 && r.responses[0].createdAt && r.createdAt,
    );
    if (answered.length === 0) return null;
    const total = answered.reduce(
      (sum, r) =>
        sum +
        (r.responses[0].createdAt.getTime() - r.createdAt.getTime()) / 86400000,
      0,
    );
    return (total / answered.length).toFixed(1);
  }, [rfis]);

  const firstReplyResolutionPct = useMemo(() => {
    const closedRfis = rfis.filter((r) => r.rfiStatus === "closed");
    if (closedRfis.length === 0) return null;
    const oneReplyClosed = closedRfis.filter((r) => r.responses.length === 1).length;
    return Math.round((oneReplyClosed / closedRfis.length) * 100);
  }, [rfis]);

  return (
    <div className="srfp">
      <header className="srfp-head">
        <div className="srfp-head-main">
          <h1 className="srfp-title">RFIs / Issues</h1>
          <p className="srfp-desc">
            Threads that need your response. Answer coordination questions and
            provide the information your contractor needs to keep work moving.
          </p>
        </div>
      </header>

      <div className="srfp-kpis">
        <KpiCard
          label="Needs your reply"
          value={summary.needsReply.toString()}
          meta={
            summary.needsReply === 0
              ? "Caught up"
              : "Response expected from you"
          }
          icon={InboxIcon}
          iconColor="red"
          alert={summary.needsReply > 0}
        />
        <KpiCard
          label="Formal RFIs"
          value={summary.assigned.toString()}
          meta="Stronger response required"
          icon={ClipboardIcon}
          iconColor="amber"
        />
        <KpiCard
          label="Issues"
          value={summary.needsReply.toString()}
          meta="Lighter coordination questions"
          icon={MessageIcon}
          iconColor="blue"
        />
        <KpiCard
          label="Closed"
          value={summary.closed.toString()}
          meta="Resolved — no action needed"
          icon={CheckCircleIcon}
          iconColor="green"
        />
      </div>

      <div className="srfp-grid">
        <div className="srfp-ws">
          <div className="srfp-ws-head">
            <div>
              <h3>Your response queue</h3>
              <div className="sub">
                Threads assigned to your trade. Formal RFIs need more complete answers.
              </div>
            </div>
          </div>
          <div className="srfp-ws-tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`srfp-wtab ${activeTab === t.id ? "on" : ""}`}
                onClick={() => {
                  setActiveTab(t.id);
                  setSelectedId(null);
                }}
              >
                {t.label} ({rfis.filter(t.match).length})
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState
                title="Nothing in this view"
                description="You're all caught up on this tab."
              />
            </div>
          ) : (
            <div className="srfp-split">
              <div className="srfp-queue">
                {filtered.map((r) => {
                  const overdue =
                    r.rfiStatus !== "closed" &&
                    r.dueAt &&
                    r.dueAt.getTime() < now;
                  const days = r.dueAt
                    ? Math.floor((now - r.dueAt.getTime()) / 86400000)
                    : null;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`srfp-tc ${selected?.id === r.id ? "on" : ""} ${overdue ? "hot" : ""}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div className="srfp-tc-top">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="srfp-tc-id">
                            RFI-{String(r.sequentialNumber).padStart(3, "0")}
                          </div>
                          <div className="srfp-tc-title">{r.subject}</div>
                          {r.body && (
                            <div className="srfp-tc-desc">{r.body}</div>
                          )}
                        </div>
                        <Pill color={statusPill(r.rfiStatus, Boolean(overdue))}>
                          {overdue ? "Overdue" : formatStatus(r.rfiStatus)}
                        </Pill>
                      </div>
                      <div className="srfp-tc-tags">
                        <span className={`srfp-mt${r.rfiType === "formal" ? " dg" : ""}`}>{r.rfiType === "formal" ? "Formal RFI" : "Issue"}</span>
                        {overdue && <span className="srfp-mt dg">Blocking work</span>}
                        <span className="srfp-mt">Markup needed</span>
                      </div>
                      <div className="srfp-tc-foot">
                        <span>
                          {r.dueAt
                            ? overdue
                              ? `Due ${formatDate(r.dueAt)} · ${days}d overdue`
                              : `Due ${formatDate(r.dueAt)}`
                            : "No due date"}
                        </span>
                        <span>
                          {r.responses.length > 0
                            ? `${r.responses.length} replies`
                            : "Response expected"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="srfp-detail">
                {selected ? (
                  <SubRfiDetail key={selected.id} rfi={selected} now={now} />
                ) : (
                  <EmptyState
                    title="Select an RFI"
                    description="Pick a thread from the queue to see details and respond."
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="srfp-rail">
          <div className="srfp-rc danger">
            <div className="srfp-rc-h">
              <h3>Response pressure</h3>
              <span className="sub">What needs your reply most.</span>
            </div>
            <div className="srfp-rc-b">
              {firstOverdue ? (
                <>
                  <div className="srfp-rc-n">
                    RFI-{String(firstOverdue.sequentialNumber).padStart(3, "0")}{" "}
                    is overdue
                  </div>
                  <p className="srfp-rc-p">
                    This formal RFI is blocking coordination work. The GC has
                    flagged the thread as at-risk.
                  </p>
                </>
              ) : (
                <p className="srfp-rc-p">
                  Nothing overdue. Keep responses moving as threads come in.
                </p>
              )}
            </div>
          </div>

          <div className="srfp-rc">
            <div className="srfp-rc-h">
              <h3>Response quality</h3>
              <span className="sub">What makes a usable reply.</span>
            </div>
            <div className="srfp-rc-b">
              <div className="srfp-fr">
                <div>
                  <h5>Formal RFI</h5>
                  <p>
                    Needs markup, field condition description, and recommended
                    path
                  </p>
                </div>
              </div>
              <div className="srfp-fr">
                <div>
                  <h5>Issue</h5>
                  <p>
                    Quick written answer is usually sufficient, markup optional
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="srfp-rc">
            <div className="srfp-rc-h">
              <h3>Your response stats</h3>
            </div>
            <div className="srfp-rc-b">
              <div className="srfp-fr">
                <div>
                  <h5>Avg response time</h5>
                  <p>Across your assigned threads</p>
                </div>
                <span className="srfp-stat">
                  {avgResponseDays ? `${avgResponseDays} days` : "—"}
                </span>
              </div>
              <div className="srfp-fr">
                <div>
                  <h5>First-reply resolution</h5>
                  <p>Threads closed after your first response</p>
                </div>
                <span className="srfp-stat">
                  {firstReplyResolutionPct != null
                    ? `${firstReplyResolutionPct}%`
                    : "—"}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      
    </div>
  );
}

function SubRfiDetail({ rfi, now }: { rfi: RfiRow; now: number }) {
  const overdue =
    rfi.rfiStatus !== "closed" && rfi.dueAt && rfi.dueAt.getTime() < now;
  const canRespond =
    rfi.rfiStatus === "open" || rfi.rfiStatus === "pending_response";

  return (
    <div className="srfd">
      <div className="srfd-head">
        <div className="srfd-head-main">
          <div className="srfd-id">
            RFI-{String(rfi.sequentialNumber).padStart(3, "0")}
          </div>
          <h2 className="srfd-title">{rfi.subject}</h2>
          {rfi.body && <p className="srfd-desc">{rfi.body}</p>}
        </div>
        <div className="srfd-pills">
          <Pill color={statusPill(rfi.rfiStatus, Boolean(overdue))}>
            {overdue ? "Overdue" : formatStatus(rfi.rfiStatus)}
          </Pill>
          <Pill color={rfi.rfiType === "formal" ? "purple" : "gray"}>{rfi.rfiType === "formal" ? "Formal RFI" : "Issue"}</Pill>
        </div>
      </div>

      <div className="srfd-grid">
        <div className="srfd-cell">
          <div className="srfd-k">What&rsquo;s needed</div>
          <div className="srfd-v">{rfi.rfiType === "formal" ? "Formal response" : "Quick response"}</div>
          <div className="srfd-m">
            Field report + markup + constraint explanation
          </div>
        </div>
        <div className="srfd-cell">
          <div className="srfd-k">Asked by</div>
          <div className="srfd-v">Project team</div>
          <div className="srfd-m">Coordination lead</div>
        </div>
        <div className="srfd-cell">
          <div className="srfd-k">What&rsquo;s affected</div>
          <div className="srfd-v">
            {overdue ? "Milestone at risk" : "Downstream coordination"}
          </div>
          <div className="srfd-m">
            {overdue ? "Blocking layout release" : "Keep work moving"}
          </div>
        </div>
        <div className="srfd-cell">
          <div className="srfd-k">Response due</div>
          <div className={`srfd-v ${overdue ? "danger" : ""}`}>
            {rfi.dueAt
              ? `${formatDate(rfi.dueAt)}${overdue ? " (overdue)" : ""}`
              : "—"}
          </div>
          <div className="srfd-m">{overdue ? "This is urgent" : "On schedule"}</div>
        </div>
      </div>

      <div className="srfd-section">
        <div className="srfd-section-head">
          <h4>What the contractor is asking</h4>
        </div>
        <div className="srfd-section-body">
          <p className="srfd-p">
            {rfi.body ??
              (rfi.rfiType === "formal"
                ? "The contractor needs your written response along with any supporting markups or field notes. Formal RFIs require a complete answer — a quick text-only reply is usually not sufficient."
                : "The contractor has flagged an issue for your attention. Review and respond with the relevant details.")}
          </p>
          <div className="srfd-tags">
            <span className="srfp-mt">Field condition report needed</span>
            <span className="srfp-mt">Drawing markup needed</span>
            <span className="srfp-mt">Trade constraint explanation</span>
          </div>
        </div>
      </div>

      <div className="srfd-section">
        <div className="srfd-section-head">
          <h4>Reference files from contractor</h4>
        </div>
        <div className="srfd-section-body">
          {rfi.drawingReference || rfi.specificationReference ? (
            <>
              {rfi.drawingReference && (
                <div className="srfd-fr">
                  <div>
                    <h5>{rfi.drawingReference}</h5>
                    <p>Drawing reference from contractor</p>
                  </div>
                  <span className="srfd-fc">DWG</span>
                </div>
              )}
              {rfi.specificationReference && (
                <div className="srfd-fr">
                  <div>
                    <h5>{rfi.specificationReference}</h5>
                    <p>Specification reference</p>
                  </div>
                  <span className="srfd-fc">SPEC</span>
                </div>
              )}
            </>
          ) : (
            <p className="srfd-p">
              No attached files yet. The contractor may attach drawings,
              photos, or specs as the thread progresses.
            </p>
          )}
        </div>
      </div>

      {rfi.responses.length > 0 && (
        <div className="srfd-section">
          <div className="srfd-section-head">
            <h4>Previous replies</h4>
          </div>
          <div className="srfd-section-body">
            <ul className="srfd-thread">
              {rfi.responses.map((resp) => (
                <li key={resp.id} className="srfd-reply">
                  <div className="srfd-reply-head">
                    <span className="srfd-reply-name">
                      {resp.respondedByName ?? "Unknown"}
                    </span>
                    {resp.isOfficialResponse && (
                      <Pill color="purple">Official</Pill>
                    )}
                    <span className="srfd-reply-time">
                      {formatDate(resp.createdAt)}
                    </span>
                  </div>
                  <p className="srfd-reply-body">{resp.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {canRespond && <RespondForm rfiId={rfi.id} />}

      
    </div>
  );
}

function RespondForm({ rfiId }: { rfiId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [isOfficialResponse, setIsOfficialResponse] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch(`/api/rfis/${rfiId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, isOfficialResponse }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    setBody("");
    setFile(null);
    router.refresh();
  }

  const hasBody = body.trim().length > 0;
  const hasFile = file != null;
  const markedOfficial = isOfficialResponse;

  return (
    <div className="resp">
      <div className="resp-top">
        <h4>Your response</h4>
        <Pill color="purple">Draft</Pill>
      </div>
      <form onSubmit={onSubmit} className="resp-form">
        <textarea
          className="resp-ta"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          required
          placeholder="Describe the resolution, any field measurements, and constraints."
        />
        <div className="resp-att">
          <label className="resp-file">
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ display: "none" }}
            />
            <span>{file ? file.name : "+ Attach file"}</span>
          </label>
          <label className="resp-official">
            <input
              type="checkbox"
              checked={isOfficialResponse}
              onChange={(e) => setIsOfficialResponse(e.target.checked)}
            />
            <span>Mark as official response</span>
          </label>
        </div>
        <div className="resp-foot">
          <div className="resp-comp">
            <span className={`resp-dot ${hasBody ? "done" : "pend"}`} />
            <span className="resp-lbl">Written response</span>
            <span className={`resp-dot ${hasFile ? "done" : "pend"}`} />
            <span className="resp-lbl">Markup attached</span>
            <span className={`resp-dot ${markedOfficial ? "done" : "pend"}`} />
            <span className="resp-lbl">Marked official</span>
          </div>
          <div className="resp-btns">
            <Button variant="secondary" type="button" disabled={pending}>
              Save draft
            </Button>
            <Button variant="primary" type="submit" loading={pending}>
              Submit response
            </Button>
          </div>
        </div>
        {error && <p className="resp-err">Error: {error}</p>}
      </form>
      
    </div>
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
  });
}
