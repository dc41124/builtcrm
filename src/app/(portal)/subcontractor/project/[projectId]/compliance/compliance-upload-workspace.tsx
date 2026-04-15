"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import type { SubcontractorProjectView } from "@/domain/loaders/project-home";

type ComplianceRow = SubcontractorProjectView["complianceRecords"][number];

type TabId = "missing" | "expiring" | "submitted" | "active";

const THRESHOLD_DAYS = 14;

function daysUntil(d: Date, now: number): number {
  return Math.ceil((d.getTime() - now) / 86400000);
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function tabOf(r: ComplianceRow, now: number): TabId {
  if (r.complianceStatus === "pending" && !r.documentId) return "missing";
  if (r.complianceStatus === "rejected" || r.complianceStatus === "expired") return "missing";
  if (r.complianceStatus === "pending") return "submitted";
  if (r.complianceStatus === "active" || r.complianceStatus === "waived") {
    if (r.expiresAt) {
      const d = daysUntil(r.expiresAt, now);
      if (d <= THRESHOLD_DAYS) return "expiring";
    }
    return "active";
  }
  return "active";
}

function statusPill(r: ComplianceRow, now: number): { color: PillColor; label: string } {
  if (r.complianceStatus === "rejected") return { color: "red", label: "Rejected" };
  if (r.complianceStatus === "expired") return { color: "red", label: "Expired" };
  if (r.complianceStatus === "pending" && !r.documentId) {
    return { color: "red", label: "Missing" };
  }
  if (r.complianceStatus === "pending") return { color: "purple", label: "Submitted" };
  if (r.complianceStatus === "waived") return { color: "gray", label: "Waived" };
  if (r.expiresAt && daysUntil(r.expiresAt, now) <= THRESHOLD_DAYS) {
    return { color: "amber", label: "Expiring" };
  }
  return { color: "green", label: "Active" };
}

export function SubcontractorComplianceWorkspace({
  projectId,
  projectName,
  records,
}: {
  projectId: string;
  projectName: string;
  records: ComplianceRow[];
}) {
  const now = Date.now();

  const tagged = useMemo(
    () => records.map((r) => ({ ...r, _tab: tabOf(r, now) })),
    [records, now],
  );

  const counts = useMemo(() => {
    const c = { missing: 0, expiring: 0, submitted: 0, active: 0 };
    for (const r of tagged) c[r._tab] += 1;
    return c;
  }, [tagged]);

  const initial: TabId =
    counts.missing > 0
      ? "missing"
      : counts.expiring > 0
      ? "expiring"
      : counts.submitted > 0
      ? "submitted"
      : "active";

  const [activeTab, setActiveTab] = useState<TabId>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => tagged.filter((r) => r._tab === activeTab),
    [tagged, activeTab],
  );

  const selected =
    filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const hasHold = counts.missing > 0;

  return (
    <div className="scmp">
      <header className="scmp-head">
        <div className="scmp-head-main">
          <div className="scmp-crumbs">{projectName} · Compliance</div>
          <h1 className="scmp-title">Compliance</h1>
          <p className="scmp-desc">
            Track what&apos;s required, upload records, and submit for GC review. Missing
            or expired records affect your project access and hold payments.
          </p>
        </div>
      </header>

      <div className="scmp-kpis">
        <KpiCard
          label="Missing"
          value={counts.missing.toString()}
          meta={counts.missing === 0 ? "All submitted" : "No valid record on file"}
          iconColor="red"
          alert={counts.missing > 0}
        />
        <KpiCard
          label="Expiring"
          value={counts.expiring.toString()}
          meta={counts.expiring === 0 ? "None expiring" : "Current record lapses soon"}
          iconColor="amber"
          alert={counts.expiring > 0}
        />
        <KpiCard
          label="Submitted"
          value={counts.submitted.toString()}
          meta={counts.submitted === 0 ? "Nothing pending" : "Waiting on GC review"}
          iconColor="purple"
        />
        <KpiCard
          label="Active"
          value={counts.active.toString()}
          meta="Accepted and valid"
          iconColor="green"
        />
      </div>

      <div className="scmp-grid">
        <Card
          tabs={[
            { id: "missing", label: `Missing (${counts.missing})` },
            { id: "expiring", label: `Expiring (${counts.expiring})` },
            { id: "submitted", label: `Submitted (${counts.submitted})` },
            { id: "active", label: `Active (${counts.active})` },
          ]}
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
            <div className="scmp-split">
              <div className="scmp-queue">
                {filtered.map((r) => {
                  const pill = statusPill(r, now);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`scmp-row ${selected?.id === r.id ? "scmp-row-sel" : ""}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div className="scmp-row-top">
                        <div className="scmp-row-title">{r.complianceType}</div>
                        <Pill color={pill.color}>{pill.label}</Pill>
                      </div>
                      <div className="scmp-row-foot">
                        <span>
                          {r.expiresAt
                            ? `Expires ${formatDate(r.expiresAt)}`
                            : "No expiry set"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="scmp-detail">
                {selected ? (
                  <SubComplianceDetail
                    key={selected.id}
                    record={selected}
                    projectId={projectId}
                    now={now}
                  />
                ) : (
                  <EmptyState
                    title="Select a requirement"
                    description="Pick one from the list to upload or track status."
                  />
                )}
              </div>
            </div>
          )}
        </Card>

        <aside className="scmp-rail">
          {counts.missing > 0 && (
            <div className="scmp-rc danger">
              <div className="scmp-rc-h">
                <h3>Restriction risk</h3>
                <span className="scmp-rc-sub">What could affect your access</span>
              </div>
              <div className="scmp-rc-b">
                <p>
                  {counts.missing} requirement{counts.missing === 1 ? "" : "s"} missing.
                  If not resolved, the GC may restrict your project participation.
                </p>
              </div>
            </div>
          )}

          {hasHold && (
            <div className="scmp-rc alert">
              <div className="scmp-rc-h">
                <h3>Payment hold</h3>
                <span className="scmp-rc-sub">Your draws may be affected</span>
              </div>
              <div className="scmp-rc-b">
                <p>
                  Draw processing is paused until compliance resolves. Submit missing
                  records to clear the hold.
                </p>
              </div>
            </div>
          )}

          <div className="scmp-rc info">
            <div className="scmp-rc-h">
              <h3>How compliance works</h3>
            </div>
            <div className="scmp-rc-b">
              <p>
                Each record you submit goes to the GC for review. Accepted records
                clear access and payment holds. Missing or rejected records restrict
                participation and hold invoices.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .scmp{display:flex;flex-direction:column;gap:20px}
        .scmp-head-main{display:flex;flex-direction:column;gap:6px;min-width:0}
        .scmp-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .scmp-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .scmp-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .scmp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.scmp-kpis{grid-template-columns:repeat(2,1fr)}}
        .scmp-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.scmp-grid{grid-template-columns:1fr}}
        .scmp-split{display:grid;grid-template-columns:320px minmax(0,1fr)}
        @media(max-width:900px){.scmp-split{grid-template-columns:1fr}}
        .scmp-queue{border-right:1px solid var(--s3);max-height:640px;overflow-y:auto;display:flex;flex-direction:column}
        .scmp-row{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s3);padding:14px 18px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:4px}
        .scmp-row:hover{background:var(--sh)}
        .scmp-row-sel{background:var(--ac-s)}
        .scmp-row-sel:hover{background:var(--ac-s)}
        .scmp-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .scmp-row-title{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .scmp-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .scmp-detail{padding:22px 24px;min-width:0}
        .scmp-rail{display:flex;flex-direction:column;gap:14px}
        .scmp-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .scmp-rc.danger{border-color:var(--dg-s)}
        .scmp-rc.alert{border-color:var(--wr-s)}
        .scmp-rc.info{border-color:var(--in-s)}
        .scmp-rc-h{padding:14px 16px 4px;display:flex;flex-direction:column;gap:2px}
        .scmp-rc-h h3{font-family:var(--fd);font-size:13.5px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .scmp-rc-sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .scmp-rc-b{padding:8px 16px 16px}
        .scmp-rc-b p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
      `}</style>
    </div>
  );
}

function SubComplianceDetail({
  record,
  projectId,
  now,
}: {
  record: ComplianceRow;
  projectId: string;
  now: number;
}) {
  const pill = statusPill(record, now);
  const expiresInDays =
    record.expiresAt != null ? daysUntil(record.expiresAt, now) : null;
  const needsUpload =
    (record.complianceStatus === "pending" && !record.documentId) ||
    record.complianceStatus === "rejected" ||
    record.complianceStatus === "expired";
  const submitted = record.complianceStatus === "pending" && record.documentId;
  const showRisk = needsUpload || record.complianceStatus === "rejected";

  return (
    <div className="scmd">
      <div className="scmd-head">
        <div className="scmd-head-main">
          <div className="scmd-org">Required by {record.complianceType}</div>
          <h2 className="scmd-title">{record.complianceType}</h2>
          <p className="scmd-desc">
            {needsUpload
              ? "A valid record is required. Upload a document and submit for GC review."
              : submitted
              ? "Record submitted. Waiting on GC review."
              : "Accepted and valid. No action needed."}
          </p>
        </div>
        <div className="scmd-pills">
          <Pill color={pill.color}>{pill.label}</Pill>
        </div>
      </div>

      <div className="scmd-grid">
        <Field label="Requirement" value={record.complianceType} />
        <Field
          label="Status"
          value={record.complianceStatus.replace(/\b\w/g, (c) => c.toUpperCase())}
        />
        <Field
          label="Expires"
          value={record.expiresAt ? formatDate(record.expiresAt) : "—"}
          meta={
            expiresInDays != null
              ? expiresInDays < 0
                ? `${Math.abs(expiresInDays)}d overdue`
                : `${expiresInDays}d remaining`
              : undefined
          }
        />
        <Field
          label="Document"
          value={record.documentId ? "On file" : "None"}
        />
      </div>

      {needsUpload && (
        <UploadZone projectId={projectId} recordId={record.id} />
      )}

      {submitted && (
        <div className="scmd-section">
          <div className="scmd-section-head">
            <h3>Submitted record</h3>
            <Pill color="purple">Waiting on GC</Pill>
          </div>
          <p className="scmd-note">
            Document {record.documentId?.slice(0, 8)} submitted. Restriction risk
            remains until the GC reviews and accepts the record.
          </p>
        </div>
      )}

      {showRisk && (
        <div className="scmd-restrict">
          <div className="scmd-restrict-top">
            <h4>Why this matters</h4>
            <Pill color="red">Access at risk</Pill>
          </div>
          <p>
            If this record stays missing or rejected, the GC may restrict your project
            participation. Restricted access means limited ability to work and held
            payments.
          </p>
        </div>
      )}

      <style>{`
        .scmd{display:flex;flex-direction:column;gap:18px}
        .scmd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
        .scmd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
        .scmd-org{font-family:var(--fm);font-size:12px;font-weight:600;color:var(--t3);letter-spacing:.02em}
        .scmd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.015em;color:var(--t1);margin:0}
        .scmd-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0;max-width:540px}
        .scmd-pills{display:flex;gap:6px;flex-shrink:0}
        .scmd-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px;background:var(--sh);border-radius:var(--r-m)}
        .scmd-section{display:flex;flex-direction:column;gap:10px;border:1px solid var(--s3);border-radius:var(--r-l);padding:16px}
        .scmd-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .scmd-section-head h3{font-family:var(--fd);font-size:13.5px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .scmd-note{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .scmd-restrict{border:1px solid var(--dg-s);background:var(--dg-s);border-radius:var(--r-l);padding:14px 16px;display:flex;flex-direction:column;gap:6px}
        .scmd-restrict-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .scmd-restrict h4{font-family:var(--fd);font-size:13.5px;font-weight:720;color:var(--dg-t);margin:0;letter-spacing:-.01em}
        .scmd-restrict p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--dg-t);line-height:1.55;margin:0}
      `}</style>
    </div>
  );
}

function UploadZone({
  projectId,
  recordId,
}: {
  projectId: string;
  recordId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    setStatus("Requesting upload…");
    try {
      const presignRes = await fetch("/api/upload/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          documentType: "compliance",
        }),
      });
      if (!presignRes.ok) throw new Error("presign_failed");
      const presign = await presignRes.json();

      setStatus("Uploading file…");
      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: presign.headers,
        body: file,
      });
      if (!putRes.ok) throw new Error("put_failed");

      setStatus("Finalizing…");
      const finalizeRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          storageKey: presign.storageKey,
          title: file.name,
          documentType: "compliance",
          visibilityScope: "subcontractor_scoped",
          audienceScope: "contractor",
          sourceObject: {
            type: "compliance_record",
            id: recordId,
            linkRole: "submission",
          },
        }),
      });
      if (!finalizeRes.ok) throw new Error("finalize_failed");
      const { documentId } = await finalizeRes.json();

      setStatus("Submitting to GC…");
      const submitRes = await fetch(`/api/compliance/${recordId}/submit`, {
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
      setStatus(null);
    }
  }

  return (
    <div className="uz">
      <div className="uz-inner">
        <h5>Upload compliance record</h5>
        <p>Drag and drop, or browse. PDF, JPG, or PNG.</p>
        <label className="uz-btn">
          <input
            type="file"
            onChange={onChange}
            disabled={pending}
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: "none" }}
          />
          <span>{pending ? status ?? "Uploading…" : "Choose file"}</span>
        </label>
        {error && <p className="uz-err">Error: {error}</p>}
      </div>
      <style>{`
        .uz{border:2px dashed var(--s3);border-radius:var(--r-l);padding:24px 20px;background:var(--sh);text-align:center}
        .uz-inner{display:flex;flex-direction:column;align-items:center;gap:6px}
        .uz h5{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .uz p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0}
        .uz-btn{margin-top:8px;display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--r-m);background:var(--ac);color:white;font-family:var(--fd);font-size:12.5px;font-weight:650;cursor:pointer}
        .uz-btn:hover{background:var(--ac-h)}
        .uz-err{font-family:var(--fb);font-size:12px;color:var(--dg-t);margin-top:6px}
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
    <div className="scmd-field">
      <div className="scmd-k">{label}</div>
      <div className="scmd-v">{value}</div>
      {meta && <div className="scmd-m">{meta}</div>}
      <style>{`
        .scmd-field{display:flex;flex-direction:column;gap:3px;min-width:0}
        .scmd-k{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
        .scmd-v{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .scmd-m{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2)}
      `}</style>
    </div>
  );
}
