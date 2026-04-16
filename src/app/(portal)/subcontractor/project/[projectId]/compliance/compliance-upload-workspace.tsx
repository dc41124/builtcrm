"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Pill, type PillColor } from "@/components/pill";
import type { SubcontractorProjectView } from "@/domain/loaders/project-home";

type ComplianceRow = SubcontractorProjectView["complianceRecords"][number];

type Bucket = "missing" | "expiring" | "submitted" | "active";

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

function formatType(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function bucketOf(r: ComplianceRow, now: number): Bucket {
  if (r.complianceStatus === "pending" && !r.documentId) return "missing";
  if (r.complianceStatus === "rejected" || r.complianceStatus === "expired")
    return "missing";
  if (r.complianceStatus === "pending") return "submitted";
  if (r.complianceStatus === "active" || r.complianceStatus === "waived") {
    if (r.expiresAt && daysUntil(r.expiresAt, now) <= THRESHOLD_DAYS)
      return "expiring";
    return "active";
  }
  return "active";
}

function statusPill(
  r: ComplianceRow,
  now: number,
): { color: PillColor; label: string } {
  if (r.complianceStatus === "rejected") return { color: "red", label: "Rejected" };
  if (r.complianceStatus === "expired") return { color: "red", label: "Expired" };
  if (r.complianceStatus === "pending" && !r.documentId)
    return { color: "red", label: "Missing" };
  if (r.complianceStatus === "pending")
    return { color: "purple", label: "Submitted" };
  if (r.complianceStatus === "waived") return { color: "gray", label: "Waived" };
  if (r.expiresAt && daysUntil(r.expiresAt, now) <= THRESHOLD_DAYS)
    return { color: "amber", label: "Expiring" };
  return { color: "green", label: "Active" };
}

function dotColor(bucket: Bucket): string {
  if (bucket === "missing") return "var(--dg)";
  if (bucket === "expiring") return "var(--wr)";
  if (bucket === "submitted") return "var(--ac)";
  return "var(--ok)";
}

function statusLine(r: ComplianceRow, bucket: Bucket, now: number): string {
  if (bucket === "missing") {
    if (r.complianceStatus === "rejected") return "Rejected · Resubmit required";
    if (r.complianceStatus === "expired") return "Expired · Renewal required";
    return "Missing · No record on file";
  }
  if (bucket === "submitted") return "Submitted · Waiting on GC review";
  if (bucket === "expiring" && r.expiresAt) {
    const d = daysUntil(r.expiresAt, now);
    return `Expiring in ${d} day${d === 1 ? "" : "s"}`;
  }
  if (r.expiresAt) return `Active · Until ${formatDate(r.expiresAt)}`;
  return "Active";
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
  const [now] = useState(() => Date.now());

  const tagged = useMemo(
    () => records.map((r) => ({ ...r, _bucket: bucketOf(r, now) })),
    [records, now],
  );

  const counts = useMemo(() => {
    const c = { missing: 0, expiring: 0, submitted: 0, active: 0 };
    for (const r of tagged) c[r._bucket] += 1;
    return c;
  }, [tagged]);

  const initialId = useMemo(() => {
    const pick = (b: Bucket) => tagged.find((r) => r._bucket === b)?.id ?? null;
    return pick("missing") ?? pick("expiring") ?? pick("submitted") ?? pick("active");
  }, [tagged]);

  const [selectedId, setSelectedId] = useState<string | null>(initialId);
  const selected = tagged.find((r) => r.id === selectedId) ?? tagged[0] ?? null;

  const jumpTo = (b: Bucket) => {
    const first = tagged.find((r) => r._bucket === b);
    if (first) setSelectedId(first.id);
  };

  const hasHold = counts.missing > 0;
  const missingExample = tagged.find((r) => r._bucket === "missing");

  const headerPills: { label: string; color: PillColor }[] = [
    { label: "Submission + tracking", color: "purple" },
  ];
  if (counts.missing > 0)
    headerPills.push({
      label: `${counts.missing} missing — restriction risk`,
      color: "red",
    });
  if (counts.expiring > 0)
    headerPills.push({
      label: `${counts.expiring} expiring soon`,
      color: "amber",
    });

  return (
    <div className="scmp">
      <header className="scmp-head">
        <div className="scmp-head-main">
          <h1 className="scmp-title">Compliance</h1>
          <p className="scmp-desc">
            Track what&apos;s required, upload records, and submit for GC review.
            Missing or expired records affect your project access and hold
            payments.
          </p>
          <div className="scmp-head-pills">
            {headerPills.map((p) => (
              <Pill key={p.label} color={p.color}>
                {p.label}
              </Pill>
            ))}
          </div>
        </div>
        <div className="scmp-head-actions">
          <Button variant="secondary">View accepted</Button>
          <Button variant="primary">Upload document</Button>
        </div>
      </header>

      <div className="scmp-kpis">
        <div
          className={`scmp-sc ${counts.missing > 0 ? "danger" : ""}`}
          onClick={() => jumpTo("missing")}
        >
          <div className="scmp-sc-l">Missing</div>
          <div className="scmp-sc-v">{counts.missing}</div>
          <div className="scmp-sc-m">
            {counts.missing === 0 ? "All submitted" : "No valid record on file"}
          </div>
        </div>
        <div
          className={`scmp-sc ${counts.expiring > 0 ? "alert" : ""}`}
          onClick={() => jumpTo("expiring")}
        >
          <div className="scmp-sc-l">Expiring</div>
          <div className="scmp-sc-v">{counts.expiring}</div>
          <div className="scmp-sc-m">
            {counts.expiring === 0 ? "None expiring" : "Current record lapses soon"}
          </div>
        </div>
        <div
          className={`scmp-sc ${counts.submitted > 0 ? "strong" : ""}`}
          onClick={() => jumpTo("submitted")}
        >
          <div className="scmp-sc-l">Submitted</div>
          <div className="scmp-sc-v">{counts.submitted}</div>
          <div className="scmp-sc-m">
            {counts.submitted === 0 ? "Nothing pending" : "Waiting on GC review"}
          </div>
        </div>
        <div
          className="scmp-sc success"
          onClick={() => jumpTo("active")}
        >
          <div className="scmp-sc-l">Active</div>
          <div className="scmp-sc-v">{counts.active}</div>
          <div className="scmp-sc-m">Accepted and valid</div>
        </div>
      </div>

      <div className="scmp-grid">
        <div className="scmp-ws">
          <div className="scmp-ws-head">
            <div>
              <h3>Compliance requirements</h3>
              <div className="sub">
                All requirements for this project. Missing or expiring items
                need your action.
              </div>
            </div>
          </div>

          {tagged.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState
                title="No requirements yet"
                description="The GC hasn't defined any compliance requirements for this project."
              />
            </div>
          ) : (
            <>
              <div className="scmp-list">
                {tagged.map((r) => {
                  const pill = statusPill(r, now);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`scmp-rq ${selected?.id === r.id ? "on" : ""}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <span
                        className="scmp-rq-dot"
                        style={{ background: dotColor(r._bucket) }}
                      />
                      <div className="scmp-rq-info">
                        <h5>{formatType(r.complianceType)}</h5>
                        <p>{statusLine(r, r._bucket, now)}</p>
                      </div>
                      <Pill color={pill.color}>{pill.label}</Pill>
                    </button>
                  );
                })}
              </div>

              <div className="scmp-detail-wrap">
                {selected && (
                  <SubComplianceDetail
                    key={selected.id}
                    record={selected}
                    projectId={projectId}
                    projectName={projectName}
                    now={now}
                  />
                )}
              </div>
            </>
          )}
        </div>

        <aside className="scmp-rail">
          {counts.missing > 0 && (
            <div className="scmp-rc danger">
              <div className="scmp-rc-h">
                <h3>Restriction risk</h3>
                <span className="sub">What could affect your access.</span>
              </div>
              <div className="scmp-rc-b">
                <div className="scmp-mblk">
                  <h4>
                    {missingExample
                      ? `${formatType(missingExample.complianceType)} — action needed`
                      : `${counts.missing} requirement${counts.missing === 1 ? "" : "s"} missing`}
                  </h4>
                  <p>
                    GC may restrict project participation until valid records
                    are submitted and accepted.
                  </p>
                </div>
              </div>
            </div>
          )}

          {hasHold && (
            <div className="scmp-rc alert">
              <div className="scmp-rc-h">
                <h3>Payment hold</h3>
                <span className="sub">Your draws may be affected.</span>
              </div>
              <div className="scmp-rc-b">
                <div className="scmp-phb">
                  <span className="scmp-phb-ico">!</span>
                  <div className="scmp-phb-text">
                    Payment hold active on your account
                    <span>Draw processing paused until compliance resolves.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="scmp-rc">
            <div className="scmp-rc-h">
              <h3>Recent activity</h3>
              <span className="sub">Your compliance events.</span>
            </div>
            <div className="scmp-rc-b">
              <p className="scmp-rc-p">
                Activity feed will populate as you submit records and receive
                GC decisions.
              </p>
            </div>
          </div>

          <div className="scmp-rc info">
            <div className="scmp-rc-h">
              <h3>How compliance works</h3>
            </div>
            <div className="scmp-rc-b">
              <p className="scmp-rc-p">
                Each record you submit goes to the GC for review. Accepted
                records clear access and payment holds. Missing or rejected
                records restrict participation and hold invoices.
              </p>
            </div>
          </div>
        </aside>
      </div>

      
    </div>
  );
}

function SubComplianceDetail({
  record,
  projectId,
  projectName,
  now,
}: {
  record: ComplianceRow;
  projectId: string;
  projectName: string;
  now: number;
}) {
  const pill = statusPill(record, now);
  const expiresInDays =
    record.expiresAt != null ? daysUntil(record.expiresAt, now) : null;
  const needsUpload =
    (record.complianceStatus === "pending" && !record.documentId) ||
    record.complianceStatus === "rejected" ||
    record.complianceStatus === "expired";
  const submitted = record.complianceStatus === "pending" && !!record.documentId;
  const showRisk = needsUpload;

  const headerPills: { label: string; color: PillColor }[] = [
    { label: pill.label, color: pill.color },
  ];
  if (needsUpload)
    headerPills.push({ label: "Restriction risk", color: "red" });
  if (needsUpload)
    headerPills.push({ label: "Payment held", color: "amber" });

  const statusValue = needsUpload
    ? record.complianceStatus === "rejected"
      ? "Rejected"
      : record.complianceStatus === "expired"
        ? "Expired"
        : "Missing"
    : submitted
      ? "Submitted · Waiting on GC"
      : "Accepted";

  const statusMeta = needsUpload
    ? "No valid record on file"
    : submitted
      ? "Sent to GC for review"
      : "Cleared by GC";

  return (
    <div className="scmd">
      <div className="scmd-head">
        <div className="scmd-head-main">
          <h3 className="scmd-title">{formatType(record.complianceType)}</h3>
          <div className="scmd-org">Required by {projectName}</div>
          <p className="scmd-desc">
            {needsUpload
              ? "A valid record is required. Upload a document and submit for GC review."
              : submitted
                ? "Record submitted. Waiting on GC review. Restriction risk remains until accepted."
                : "Accepted and valid. No action needed."}
          </p>
        </div>
        <div className="scmd-pills">
          {headerPills.map((p) => (
            <Pill key={p.label} color={p.color}>
              {p.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="scmd-grid">
        <div className="scmd-cell">
          <div className="scmd-k">Requirement</div>
          <div className="scmd-v">{formatType(record.complianceType)}</div>
          <div className="scmd-m">Project-level compliance record</div>
        </div>
        <div className="scmd-cell">
          <div className="scmd-k">Status</div>
          <div className="scmd-v">{statusValue}</div>
          <div className="scmd-m">{statusMeta}</div>
        </div>
        <div className="scmd-cell">
          <div className="scmd-k">Expires</div>
          <div className="scmd-v">
            {record.expiresAt ? formatDate(record.expiresAt) : "—"}
          </div>
          <div className="scmd-m">
            {expiresInDays != null
              ? expiresInDays < 0
                ? `${Math.abs(expiresInDays)}d overdue`
                : `${expiresInDays} day${expiresInDays === 1 ? "" : "s"} remaining`
              : "No expiry set"}
          </div>
        </div>
        <div className="scmd-cell">
          <div className="scmd-k">Document</div>
          <div className="scmd-v">{record.documentId ? "On file" : "None"}</div>
          <div className="scmd-m">
            {record.documentId
              ? `Ref ${record.documentId.slice(0, 8)}`
              : "Awaiting upload"}
          </div>
        </div>
      </div>

      {needsUpload && (
        <div className="scmd-section">
          <div className="scmd-section-head">
            <h4>Upload record</h4>
            <div className="scmd-section-acts">
              <Pill color="red">Required</Pill>
            </div>
          </div>
          <div className="scmd-section-body">
            <UploadZone
              projectId={projectId}
              recordId={record.id}
              complianceType={record.complianceType}
            />
            <p className="scmd-note">
              Once staged, review before submitting for GC review.
            </p>
          </div>
        </div>
      )}

      {submitted && (
        <div className="scmd-section">
          <div className="scmd-section-head">
            <h4>Submitted record</h4>
            <div className="scmd-section-acts">
              <Pill color="purple">Waiting on GC</Pill>
            </div>
          </div>
          <div className="scmd-section-body">
            <div className="scmd-fr">
              <div>
                <h5>Compliance document</h5>
                <p>Submitted · document {record.documentId?.slice(0, 8)}</p>
              </div>
              <span className="scmd-fc">PDF</span>
            </div>
            <p className="scmd-note">
              Sent to the GC for review. Restriction risk remains until the
              record is accepted.
            </p>
          </div>
        </div>
      )}

      {showRisk && (
        <div className="scmd-section restrict">
          <div className="scmd-section-head">
            <h4>Why this matters now</h4>
            <div className="scmd-section-acts">
              <Pill color="red">Access at risk</Pill>
            </div>
          </div>
          <div className="scmd-section-body">
            <div className="scmd-rp">
              <h5>
                Missing {formatType(record.complianceType).toLowerCase()} may
                trigger restricted access
              </h5>
              <p>
                If this record remains missing, the GC may restrict your
                project participation. Restricted access means limited ability
                to work and held payments.
              </p>
              <div className="scmd-rp-tags">
                <span className="scmd-mtag">
                  {expiresInDays != null && expiresInDays >= 0
                    ? `Restriction in ${expiresInDays} day${expiresInDays === 1 ? "" : "s"}`
                    : "Restriction risk"}
                </span>
                <span className="scmd-mtag">Payments held</span>
                <span className="scmd-mtag">Clear by submitting</span>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
}

function UploadZone({
  projectId,
  recordId,
  complianceType,
}: {
  projectId: string;
  recordId: string;
  complianceType: string;
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
    <div className="scmd-uz">
      <h5>Upload {formatType(complianceType).toLowerCase()}</h5>
      <p>Drag and drop, or click to browse. PDF, JPG, or PNG.</p>
      <div className="scmd-uz-acts">
        <label className={`scmd-uz-btn pri ${pending ? "disabled" : ""}`}>
          <input
            type="file"
            onChange={onChange}
            disabled={pending}
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: "none" }}
          />
          <span>{pending ? (status ?? "Uploading…") : "Upload file"}</span>
        </label>
        <button type="button" className="scmd-uz-btn" disabled>
          Use project file
        </button>
      </div>
      {error && <p className="scmd-uz-err">Error: {error}</p>}
      
    </div>
  );
}
