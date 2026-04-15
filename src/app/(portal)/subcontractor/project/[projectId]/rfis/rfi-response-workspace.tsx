"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import type { RfiRow } from "@/domain/loaders/project-home";

type TabId = "needs_reply" | "answered" | "closed";

const TABS: { id: TabId; label: string; match: (r: RfiRow) => boolean }[] = [
  {
    id: "needs_reply",
    label: "Needs your reply",
    match: (r) => r.rfiStatus === "open" || r.rfiStatus === "pending_response",
  },
  { id: "answered", label: "Answered", match: (r) => r.rfiStatus === "answered" },
  { id: "closed", label: "Closed", match: (r) => r.rfiStatus === "closed" },
];

export function SubRfiResponseWorkspace({
  projectName,
  rfis,
}: {
  projectName: string;
  rfis: RfiRow[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("needs_reply");
  const [selectedId, setSelectedId] = useState<string | null>(rfis[0]?.id ?? null);

  const now = Date.now();
  const summary = useMemo(() => {
    const needsReply = rfis.filter(
      (r) => r.rfiStatus === "open" || r.rfiStatus === "pending_response",
    ).length;
    const overdue = rfis.filter(
      (r) =>
        r.rfiStatus !== "closed" && r.dueAt && r.dueAt.getTime() < now,
    ).length;
    const answered = rfis.filter((r) => r.rfiStatus === "answered").length;
    const closed = rfis.filter((r) => r.rfiStatus === "closed").length;
    return { needsReply, overdue, answered, closed };
  }, [rfis, now]);

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab)!;
    return rfis.filter(tab.match);
  }, [rfis, activeTab]);

  const selected =
    filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  return (
    <div className="srfp">
      <header className="srfp-head">
        <div className="srfp-head-main">
          <div className="srfp-crumbs">{projectName} · RFIs / Issues</div>
          <h1 className="srfp-title">RFIs / Issues</h1>
          <p className="srfp-desc">
            Questions and issues routed to your organization. Provide formal responses with
            markups, field reports, and attachments so the GC can close the thread out.
          </p>
        </div>
      </header>

      <div className="srfp-kpis">
        <KpiCard
          label="Needs your reply"
          value={summary.needsReply.toString()}
          meta={summary.needsReply === 0 ? "Caught up" : "Formal response pending"}
          iconColor="amber"
          alert={summary.needsReply > 0}
        />
        <KpiCard
          label="Overdue"
          value={summary.overdue.toString()}
          meta={summary.overdue === 0 ? "On schedule" : "Past due date"}
          iconColor="red"
          alert={summary.overdue > 0}
        />
        <KpiCard label="Answered" value={summary.answered.toString()} iconColor="purple" />
        <KpiCard label="Closed" value={summary.closed.toString()} iconColor="green" />
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
              title="Nothing in this view"
              description="You're all caught up on this tab."
            />
          </div>
        ) : (
          <div className="srfp-split">
            <div className="srfp-queue">
              {filtered.map((r) => {
                const overdue =
                  r.rfiStatus !== "closed" && r.dueAt && r.dueAt.getTime() < now;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`srfp-row ${selected?.id === r.id ? "srfp-row-sel" : ""}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <div className="srfp-row-top">
                      <div className="srfp-row-id">
                        RFI-{String(r.sequentialNumber).padStart(3, "0")}
                      </div>
                      <Pill color={statusPill(r.rfiStatus, Boolean(overdue))}>
                        {overdue ? "Overdue" : formatStatus(r.rfiStatus)}
                      </Pill>
                    </div>
                    <div className="srfp-row-title">{r.subject}</div>
                    <div className="srfp-row-foot">
                      <span>{r.dueAt ? `Due ${formatDate(r.dueAt)}` : "No due date"}</span>
                      <span>{r.responses.length} replies</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="srfp-detail">
              {selected ? (
                <SubRfiDetail key={selected.id} rfi={selected} />
              ) : (
                <EmptyState
                  title="Select an RFI"
                  description="Pick a thread from the queue to see details and respond."
                />
              )}
            </div>
          </div>
        )}
      </Card>

      <style>{`
        .srfp{display:flex;flex-direction:column;gap:20px}
        .srfp-head-main{display:flex;flex-direction:column;gap:6px;min-width:0}
        .srfp-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .srfp-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .srfp-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .srfp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.srfp-kpis{grid-template-columns:repeat(2,1fr)}}
        .srfp-split{display:grid;grid-template-columns:360px minmax(0,1fr)}
        @media(max-width:900px){.srfp-split{grid-template-columns:1fr}}
        .srfp-queue{border-right:1px solid var(--s3);max-height:640px;overflow-y:auto;display:flex;flex-direction:column}
        .srfp-row{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s3);padding:14px 18px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:4px}
        .srfp-row:hover{background:var(--sh)}
        .srfp-row-sel{background:var(--ac-s)}
        .srfp-row-sel:hover{background:var(--ac-s)}
        .srfp-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .srfp-row-id{font-family:var(--fm);font-size:11px;font-weight:600;color:var(--t3);letter-spacing:.02em}
        .srfp-row-title{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .srfp-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .srfp-detail{padding:22px 24px;min-width:0}
      `}</style>
    </div>
  );
}

function SubRfiDetail({ rfi }: { rfi: RfiRow }) {
  const now = Date.now();
  const overdue = rfi.rfiStatus !== "closed" && rfi.dueAt && rfi.dueAt.getTime() < now;
  const canRespond = rfi.rfiStatus === "open" || rfi.rfiStatus === "pending_response";

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
        </div>
      </div>

      <div className="srfd-grid">
        <Field label="What's needed" value="Formal response" />
        <Field
          label="Response due"
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

      {rfi.responses.length > 0 && (
        <div className="srfd-section">
          <div className="srfd-section-head">
            <h3>Previous replies</h3>
          </div>
          <ul className="srfd-thread">
            {rfi.responses.map((resp) => (
              <li key={resp.id} className="srfd-reply">
                <div className="srfd-reply-head">
                  <span className="srfd-reply-name">
                    {resp.respondedByName ?? "Unknown"}
                  </span>
                  {resp.isOfficialResponse && <Pill color="purple">Official</Pill>}
                  <span className="srfd-reply-time">{formatDate(resp.createdAt)}</span>
                </div>
                <p className="srfd-reply-body">{resp.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canRespond && <RespondForm rfiId={rfi.id} />}

      <style>{`
        .srfd{display:flex;flex-direction:column;gap:20px}
        .srfd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
        .srfd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
        .srfd-id{font-family:var(--fm);font-size:12px;font-weight:600;color:var(--t3);letter-spacing:.02em}
        .srfd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.015em;color:var(--t1);margin:0}
        .srfd-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .srfd-pills{display:flex;gap:6px;flex-shrink:0}
        .srfd-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px;background:var(--sh);border-radius:var(--r-m)}
        .srfd-section{display:flex;flex-direction:column;gap:10px}
        .srfd-section-head h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .srfd-thread{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
        .srfd-reply{border:1px solid var(--s3);border-radius:var(--r-m);padding:12px 14px}
        .srfd-reply-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}
        .srfd-reply-name{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--t1)}
        .srfd-reply-time{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-left:auto}
        .srfd-reply-body{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);line-height:1.55;margin:0}
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
      className="srfd-field"
      style={span === 2 ? { gridColumn: "1 / -1" } : undefined}
    >
      <div className="srfd-k">{label}</div>
      <div
        className="srfd-v"
        style={
          mono ? { fontFamily: "var(--fm)", fontSize: 13, fontWeight: 600 } : undefined
        }
      >
        {value}
      </div>
      {meta && <div className="srfd-m">{meta}</div>}
      <style>{`
        .srfd-field{display:flex;flex-direction:column;gap:3px;min-width:0}
        .srfd-k{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
        .srfd-v{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .srfd-m{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2)}
      `}</style>
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

  return (
    <div className="resp">
      <div className="resp-top">
        <h3>Your response</h3>
        <Pill color="amber">Draft</Pill>
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
          <Button variant="secondary" type="button" disabled={pending}>
            Save draft
          </Button>
          <Button variant="primary" type="submit" loading={pending}>
            Submit response
          </Button>
        </div>
        {error && <p className="resp-err">Error: {error}</p>}
      </form>
      <style>{`
        .resp{border:1px solid var(--s3);border-radius:var(--r-l);padding:16px 18px;background:var(--s1);display:flex;flex-direction:column;gap:12px}
        .resp-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .resp-top h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .resp-form{display:flex;flex-direction:column;gap:12px}
        .resp-ta{width:100%;padding:12px 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t1);line-height:1.55;resize:vertical}
        .resp-ta:focus{outline:none;border-color:var(--ac)}
        .resp-att{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
        .resp-file{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--r-m);background:var(--sh);border:1px dashed var(--s4);font-family:var(--fd);font-size:12px;font-weight:620;color:var(--t2);cursor:pointer}
        .resp-file:hover{background:var(--s2);color:var(--t1)}
        .resp-official{display:inline-flex;align-items:center;gap:6px;font-family:var(--fb);font-size:12.5px;font-weight:560;color:var(--t2);cursor:pointer}
        .resp-foot{display:flex;justify-content:flex-end;gap:8px}
        .resp-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      `}</style>
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
    year: "numeric",
  });
}
