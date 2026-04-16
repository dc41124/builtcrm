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

      <style dangerouslySetInnerHTML={{ __html: `
        .scmp{display:flex;flex-direction:column;gap:20px}
        .scmp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .scmp-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .scmp-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;color:var(--t1);line-height:1.15;margin:0}
        .scmp-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .scmp-head-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
        .scmp-head-actions{display:flex;gap:8px;flex-shrink:0;padding-top:4px}

        .scmp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        @media(max-width:1000px){.scmp-kpis{grid-template-columns:repeat(2,1fr)}}
        .scmp-sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm);cursor:pointer;transition:all var(--dn) var(--e)}
        .scmp-sc:hover{box-shadow:var(--shmd);transform:translateY(-1px)}
        .scmp-sc.alert{border-color:color-mix(in srgb,var(--wr) 30%,var(--s3))}
        .scmp-sc.danger{border-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
        .scmp-sc.strong{border-color:color-mix(in srgb,var(--ac) 30%,var(--s3))}
        .scmp-sc.success{border-color:color-mix(in srgb,var(--ok) 30%,var(--s3))}
        .scmp-sc-l{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .scmp-sc-v{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px;color:var(--t1)}
        .scmp-sc-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}

        .scmp-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
        @media(max-width:1280px){.scmp-grid{grid-template-columns:1fr}}

        .scmp-ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;min-width:0}
        .scmp-ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
        .scmp-ws-head h3{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
        .scmp-ws-head .sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:4px;max-width:560px}

        .scmp-list{padding:12px 20px 0;display:flex;flex-direction:column;gap:6px;max-height:380px;overflow-y:auto}
        .scmp-list::-webkit-scrollbar{width:4px}
        .scmp-list::-webkit-scrollbar-track{background:transparent}
        .scmp-list::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
        .scmp-rq{display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);cursor:pointer;transition:all var(--dn) var(--e);text-align:left;width:100%}
        .scmp-rq:hover{border-color:color-mix(in srgb,var(--ac) 35%,var(--s3));background:color-mix(in srgb,var(--ac-s) 20%,var(--s1))}
        .scmp-rq.on{border-color:color-mix(in srgb,var(--ac) 40%,var(--s3));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
        .scmp-rq-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
        .scmp-rq-info{flex:1;min-width:0}
        .scmp-rq-info h5{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0;letter-spacing:-.005em}
        .scmp-rq-info p{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin:1px 0 0}

        .scmp-detail-wrap{padding:16px 20px 20px}

        .scmp-rail{display:flex;flex-direction:column;gap:12px;min-width:0}
        .scmp-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .scmp-rc.alert{border-color:color-mix(in srgb,var(--wr) 30%,var(--s3))}
        .scmp-rc.danger{border-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
        .scmp-rc.info{border-color:color-mix(in srgb,var(--in) 30%,var(--s3))}
        .scmp-rc-h{padding:14px 16px 0}
        .scmp-rc-h h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .scmp-rc-h .sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:3px;display:block}
        .scmp-rc-b{padding:10px 16px 16px}
        .scmp-rc-p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

        .scmp-mblk{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:12px}
        .scmp-mblk h4{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0 0 4px}
        .scmp-mblk p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:0;line-height:1.5}

        .scmp-phb{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid color-mix(in srgb,var(--wr) 30%,var(--s3));border-radius:var(--r-m);background:var(--wr-s)}
        .scmp-phb-ico{width:20px;height:20px;border-radius:50%;background:var(--wr-t);color:#fff;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:800;flex-shrink:0}
        .scmp-phb-text{font-family:var(--fb);font-size:12px;color:var(--wr-t);font-weight:620}
        .scmp-phb-text span{display:block;font-weight:520;margin-top:1px;font-size:11px;color:var(--t2)}
      ` }} />
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

      <style dangerouslySetInnerHTML={{ __html: `
        .scmd{display:flex;flex-direction:column;gap:14px;min-width:0}
        .scmd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
        .scmd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}
        .scmd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em;color:var(--t1);margin:0}
        .scmd-org{font-family:var(--fm);font-size:12px;font-weight:520;color:var(--t3);letter-spacing:.02em}
        .scmd-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.5;margin:6px 0 0;max-width:540px}
        .scmd-pills{display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0;padding-top:2px}

        .scmd-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .scmd-cell{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
        .scmd-k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .scmd-v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px;color:var(--t1)}
        .scmd-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}

        .scmd-section{border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
        .scmd-section.restrict{border-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
        .scmd-section-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
        .scmd-section.restrict .scmd-section-head{background:linear-gradient(180deg,#fef5f5,var(--dg-s));border-bottom-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
        .scmd-section.restrict .scmd-section-head h4{color:var(--dg-t)}
        .scmd-section-head h4{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0}
        .scmd-section-acts{display:flex;gap:6px;align-items:center}
        .scmd-section-body{padding:14px 16px}

        .scmd-note{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);margin:12px 0 0;line-height:1.5}

        .scmd-fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}
        .scmd-fr:last-child{border-bottom:none}
        .scmd-fr h5{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t1);margin:0}
        .scmd-fr p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:2px 0 0}
        .scmd-fc{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);padding:3px 8px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap}

        .scmd-rp{border:1px solid color-mix(in srgb,var(--dg) 30%,var(--s3));border-radius:var(--r-l);padding:14px 16px;background:linear-gradient(180deg,#fef5f5,var(--dg-s))}
        .scmd-rp h5{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--dg-t);margin:0}
        .scmd-rp p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--dg-t);margin:4px 0 0;line-height:1.5}
        .scmd-rp-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
        .scmd-mtag{height:22px;padding:0 9px;border-radius:999px;border:1px solid color-mix(in srgb,var(--dg) 30%,var(--s3));background:var(--s1);color:var(--dg-t);font-family:var(--fd);font-size:10px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}
      ` }} />
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
      <style dangerouslySetInnerHTML={{ __html: `
        .scmd-uz{border:2px dashed var(--s3);border-radius:var(--r-l);padding:24px 20px;text-align:center;background:var(--s2);transition:all var(--dn) var(--e)}
        .scmd-uz:hover{border-color:var(--ac);background:var(--ac-s)}
        .scmd-uz h5{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0 0 4px;letter-spacing:-.01em}
        .scmd-uz p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:0}
        .scmd-uz-acts{display:flex;gap:8px;margin-top:12px;justify-content:center;flex-wrap:wrap}
        .scmd-uz-btn{height:32px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12px;font-weight:640;cursor:pointer;display:inline-flex;align-items:center;transition:all var(--df) var(--e)}
        .scmd-uz-btn:hover:not(:disabled):not(.disabled){border-color:var(--s4);background:var(--sh)}
        .scmd-uz-btn:disabled,.scmd-uz-btn.disabled{opacity:.6;cursor:not-allowed}
        .scmd-uz-btn.pri{background:var(--ac);border-color:var(--ac);color:#fff}
        .scmd-uz-btn.pri:hover:not(.disabled){background:var(--ac-h);border-color:var(--ac-h)}
        .scmd-uz-err{font-family:var(--fb);font-size:12px;color:var(--dg-t);margin:8px 0 0}
      ` }} />
    </div>
  );
}
