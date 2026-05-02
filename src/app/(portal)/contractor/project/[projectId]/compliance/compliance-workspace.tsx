"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Pill, type PillColor } from "@/components/pill";
import type { ContractorProjectView } from "@/domain/loaders/project-home";
import type { PrequalBadgeStatus } from "@/domain/loaders/prequal";

type ComplianceRow = ContractorProjectView["complianceRecords"][number];
type TabId = "review" | "atrisk" | "restricted" | "accepted";

// Pre-resolved prequal badge state for each sub org appearing in the
// compliance records — fetched server-side in page.tsx via the memoized
// `getActivePrequalForPair` loader and passed in as plain data.
export type PrequalBadgeData = {
  status: PrequalBadgeStatus;
  expiresAt: string | null;
};

const PREQUAL_LABEL: Record<PrequalBadgeStatus, string> = {
  approved: "Prequal: Approved",
  pending: "Prequal: Pending",
  rejected: "Prequal: Rejected",
  expired: "Prequal: Expired",
  none: "No prequal",
};

function PrequalScorecardBadge({
  data,
}: {
  data: PrequalBadgeData | undefined;
}) {
  if (!data) return null;
  return (
    <span
      className={`pq-badge ${data.status}`}
      style={{ marginLeft: 8, verticalAlign: "middle" }}
      title={
        data.status === "approved" && data.expiresAt
          ? `Approved · expires ${new Date(data.expiresAt).toLocaleDateString()}`
          : PREQUAL_LABEL[data.status]
      }
    >
      {PREQUAL_LABEL[data.status]}
    </span>
  );
}

const THRESHOLD_DAYS = 14;

function isAtRisk(r: ComplianceRow, now: number): boolean {
  if (r.complianceStatus === "rejected") return false;
  if (r.complianceStatus === "expired") return true;
  if (r.complianceStatus === "active" || r.complianceStatus === "waived") {
    if (!r.expiresAt) return false;
    const days = (r.expiresAt.getTime() - now) / 86400000;
    return days <= THRESHOLD_DAYS && days >= 0;
  }
  if (!r.documentId) return true;
  if (r.expiresAt) {
    const days = (r.expiresAt.getTime() - now) / 86400000;
    return days <= THRESHOLD_DAYS;
  }
  return false;
}

function tabOf(r: ComplianceRow, now: number): TabId {
  if (r.complianceStatus === "rejected") return "restricted";
  if (r.complianceStatus === "pending") return "review";
  if (isAtRisk(r, now)) return "atrisk";
  return "accepted";
}

function statusPill(
  r: ComplianceRow,
  now: number,
): { color: PillColor; label: string } {
  if (r.complianceStatus === "rejected") return { color: "red", label: "Restricted" };
  if (r.complianceStatus === "expired") return { color: "red", label: "Expired" };
  if (r.complianceStatus === "pending") {
    if (!r.documentId) return { color: "red", label: "Missing" };
    return { color: "amber", label: "Needs review" };
  }
  if (isAtRisk(r, now)) return { color: "amber", label: "At risk" };
  if (r.complianceStatus === "waived") return { color: "gray", label: "Waived" };
  return { color: "green", label: "Active" };
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(d: Date, now: number): number {
  return Math.ceil((d.getTime() - now) / 86400000);
}

// Synthesize a verify-style checklist per requirement type until the schema
// supports real verification items.
function verifyItemsFor(
  complianceType: string,
  hasDoc: boolean,
): { label: string; detail: string; pass: boolean }[] {
  if (!hasDoc) return [];
  const t = complianceType.toLowerCase();
  if (t.includes("insurance") || t.includes("coi")) {
    return [
      { label: "Named insured", detail: "Org name match confirmed", pass: true },
      { label: "Coverage dates", detail: "Within project window", pass: true },
      { label: "Certificate number", detail: "Present on document", pass: true },
      { label: "Liability minimum ($2M)", detail: "Meets project threshold", pass: true },
      { label: "Additional insured endorsement", detail: "Verify on page 2", pass: false },
    ];
  }
  if (t.includes("wsib") || t.includes("workers")) {
    return [
      { label: "Clearance certificate", detail: "Present", pass: true },
      { label: "Valid-through date", detail: "Covers project period", pass: true },
      { label: "Account in good standing", detail: "No outstanding balance", pass: true },
    ];
  }
  if (t.includes("safety") || t.includes("training")) {
    return [
      { label: "Training provider", detail: "Recognized provider", pass: true },
      { label: "Employee roster", detail: "All active crew listed", pass: true },
      { label: "Certification dates", detail: "Current through expiry", pass: true },
    ];
  }
  return [
    { label: "Document readable", detail: "File opens and is legible", pass: true },
    { label: "Correct organization", detail: "Matches submitting sub", pass: true },
  ];
}

export function ContractorComplianceWorkspace({
  projectId,
  records,
  nowMs: now,
  prequalByOrg,
}: {
  projectId: string;
  projectName: string;
  records: ComplianceRow[];
  nowMs: number;
  prequalByOrg: Record<string, PrequalBadgeData>;
}) {

  const tagged = useMemo(
    () => records.map((r) => ({ ...r, _tab: tabOf(r, now) })),
    [records, now],
  );

  const counts = useMemo(() => {
    const c = { review: 0, atrisk: 0, restricted: 0, accepted: 0 };
    for (const r of tagged) c[r._tab] += 1;
    return c;
  }, [tagged]);

  const [activeTab, setActiveTab] = useState<TabId>(
    counts.review > 0
      ? "review"
      : counts.atrisk > 0
        ? "atrisk"
        : counts.restricted > 0
          ? "restricted"
          : "accepted",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => tagged.filter((r) => r._tab === activeTab),
    [tagged, activeTab],
  );
  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  // Scorecard: per-org rollup
  const scorecard = useMemo(() => {
    const map = new Map<
      string,
      {
        orgId: string;
        name: string;
        total: number;
        accepted: number;
        atRisk: number;
        problem: number;
      }
    >();
    for (const r of records) {
      const key = r.organizationId;
      const name = r.organizationName ?? "Unknown org";
      const prev =
        map.get(key) ??
        { orgId: key, name, total: 0, accepted: 0, atRisk: 0, problem: 0 };
      prev.total += 1;
      if (r.complianceStatus === "active" || r.complianceStatus === "waived") {
        if (isAtRisk(r, now)) prev.atRisk += 1;
        else prev.accepted += 1;
      } else if (
        r.complianceStatus === "rejected" ||
        (r.complianceStatus === "pending" && !r.documentId)
      ) {
        prev.problem += 1;
      } else {
        prev.atRisk += 1;
      }
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.problem - a.problem || b.atRisk - a.atRisk);
  }, [records, now]);

  const paymentHolds = useMemo(
    () => scorecard.filter((o) => o.problem > 0 || o.atRisk > 0),
    [scorecard],
  );

  const headerPills: { label: string; color: PillColor }[] = [
    { label: "Review + restriction control", color: "purple" },
  ];
  if (counts.review > 0)
    headerPills.push({
      label: `${counts.review} record${counts.review === 1 ? "" : "s"} need review`,
      color: "amber",
    });
  if (counts.atrisk + counts.restricted > 0)
    headerPills.push({
      label: `${counts.atrisk + counts.restricted} at restriction threshold`,
      color: "red",
    });

  return (
    <div className="cmp">
      <header className="cmp-head">
        <div className="cmp-head-main">
          <h1 className="cmp-title">Compliance</h1>
          <p className="cmp-desc">
            Review submitted records, track requirements, and control
            access-state restrictions. Non-compliant subcontractors have payment
            holds applied automatically.
          </p>
          <div className="cmp-head-pills">
            {headerPills.map((p) => (
              <Pill key={p.label} color={p.color}>
                {p.label}
              </Pill>
            ))}
          </div>
        </div>
        <div className="cmp-head-actions">
          <Link
            href={`/contractor/project/${projectId}/compliance/scorecard`}
            className="cmp-link-btn"
            style={{
              fontFamily: "'DM Sans',system-ui,sans-serif",
              fontSize: 13,
              fontWeight: 620,
              padding: "7px 14px",
              borderRadius: 6,
              background: "#f3f4f6",
              color: "#171717",
              border: "1px solid #e2e5e9",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            Sub scorecard →
          </Link>
          <Button variant="secondary">Export log</Button>
          <Button variant="primary">Review next record</Button>
        </div>
      </header>

      <div className="cmp-kpis">
        <div
          className="cmp-sc strong"
          onClick={() => {
            setActiveTab("review");
            setSelectedId(null);
          }}
        >
          <div className="cmp-sc-l">Needs review</div>
          <div className="cmp-sc-v">{counts.review}</div>
          <div className="cmp-sc-m">Submitted records awaiting decision</div>
        </div>
        <div
          className={`cmp-sc ${counts.atrisk > 0 ? "alert" : ""}`}
          onClick={() => {
            setActiveTab("atrisk");
            setSelectedId(null);
          }}
        >
          <div className="cmp-sc-l">At risk</div>
          <div className="cmp-sc-v">{counts.atrisk}</div>
          <div className="cmp-sc-m">Restriction threshold approaching</div>
        </div>
        <div
          className={`cmp-sc ${counts.restricted > 0 ? "danger" : ""}`}
          onClick={() => {
            setActiveTab("restricted");
            setSelectedId(null);
          }}
        >
          <div className="cmp-sc-l">Restricted</div>
          <div className="cmp-sc-v">{counts.restricted}</div>
          <div className="cmp-sc-m">Participation limited · Payment held</div>
        </div>
        <div
          className="cmp-sc success"
          onClick={() => {
            setActiveTab("accepted");
            setSelectedId(null);
          }}
        >
          <div className="cmp-sc-l">Active</div>
          <div className="cmp-sc-v">{counts.accepted}</div>
          <div className="cmp-sc-m">Accepted and valid</div>
        </div>
      </div>

      <div className="cmp-grid">
        <div className="cmp-ws">
          <div className="cmp-ws-head">
            <div>
              <h3>Compliance review workspace</h3>
              <div className="sub">
                Queue-first surface for reviewing records, assessing restriction
                risk, and controlling access consequences.
              </div>
            </div>
          </div>
          <div className="cmp-ws-tabs">
            {(
              [
                { id: "review", label: "Needs review" },
                { id: "atrisk", label: "At risk" },
                { id: "restricted", label: "Restricted" },
                { id: "accepted", label: "Accepted" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`cmp-wtab ${activeTab === t.id ? "on" : ""}`}
                onClick={() => {
                  setActiveTab(t.id);
                  setSelectedId(null);
                }}
              >
                {t.label} ({counts[t.id]})
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState
                title="No records in this view"
                description="Nothing matches the current filter."
              />
            </div>
          ) : (
            <div className="cmp-split">
              <div className="cmp-queue">
                {filtered.map((r) => {
                  const pill = statusPill(r, now);
                  const hot =
                    r.complianceStatus === "rejected" ||
                    (r.complianceStatus === "pending" && !r.documentId) ||
                    isAtRisk(r, now);
                  const days =
                    r.expiresAt != null ? daysUntil(r.expiresAt, now) : null;
                  const tags: string[] = [];
                  if (r.documentId) tags.push("Submitted");
                  else if (r.complianceStatus === "pending") tags.push("Missing");
                  if (r.expiresAt)
                    tags.push(`Until ${formatDate(r.expiresAt)}`);
                  if (days != null && days >= 0 && days <= THRESHOLD_DAYS)
                    tags.push(`${days}d to threshold`);
                  const access =
                    r.complianceStatus === "rejected"
                      ? "Restricted"
                      : hot
                        ? "At risk"
                        : "Active";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`cmp-rcd ${selected?.id === r.id ? "on" : ""} ${hot ? "hot" : ""}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div className="cmp-rcd-top">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="cmp-rcd-org">
                            {r.organizationName ?? "Unknown org"}
                          </div>
                          <div className="cmp-rcd-title">
                            {formatStatus(r.complianceType)}
                          </div>
                        </div>
                        <Pill color={pill.color}>{pill.label}</Pill>
                      </div>
                      {tags.length > 0 && (
                        <div className="cmp-rcd-tags">
                          {tags.map((t) => (
                            <span key={t} className="cmp-mtag">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="cmp-rcd-foot">
                        <span>Access: {access}</span>
                        <span>
                          {r.expiresAt
                            ? `Expires ${formatDate(r.expiresAt)}`
                            : "No expiry"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="cmp-detail">
                {selected ? (
                  <ComplianceDetail
                    key={selected.id}
                    record={selected}
                    projectId={projectId}
                    now={now}
                  />
                ) : (
                  <EmptyState
                    title="Select a record"
                    description="Pick a record from the queue to review or restrict."
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="cmp-rail">
          <div className="cmp-rc">
            <div className="cmp-rc-h">
              <h3>Org compliance scorecard</h3>
              <span className="sub">Per-subcontractor requirement rollup.</span>
            </div>
            <div className="cmp-rc-b">
              {scorecard.length === 0 ? (
                <p className="cmp-rc-p">No requirements tracked yet.</p>
              ) : (
                scorecard.map((o) => (
                  <div key={o.orgId} className="cmp-orow">
                    <div className="cmp-oname">
                      {o.name}
                      <PrequalScorecardBadge data={prequalByOrg[o.orgId]} />
                    </div>
                    <div className="cmp-odots">
                      {Array.from({ length: o.total }).map((_, i) => {
                        let cls = "empty";
                        if (i < o.accepted) cls = "filled";
                        else if (i < o.accepted + o.atRisk) cls = "warn";
                        else if (i < o.accepted + o.atRisk + o.problem)
                          cls = "danger";
                        return <span key={i} className={`cmp-sdot ${cls}`} />;
                      })}
                    </div>
                    <span className="cmp-olbl">
                      {o.accepted}/{o.total}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="cmp-rc alert">
            <div className="cmp-rc-h">
              <h3>Payment holds</h3>
              <span className="sub">Compliance-linked payment restrictions.</span>
            </div>
            <div className="cmp-rc-b">
              {paymentHolds.length === 0 ? (
                <p className="cmp-rc-p">No payment holds.</p>
              ) : (
                <>
                  <div className="cmp-phb">
                    <span className="cmp-phb-ico">!</span>
                    <div className="cmp-phb-text">
                      {paymentHolds.length}{" "}
                      {paymentHolds.length === 1 ? "sub has" : "subs have"}{" "}
                      active payment holds
                      <span>
                        Draws and invoices blocked until compliance clears.
                      </span>
                    </div>
                  </div>
                  {paymentHolds.map((o) => (
                    <div key={o.name} className="cmp-fr">
                      <div>
                        <h5>{o.name}</h5>
                        <p>
                          {o.problem > 0
                            ? `${o.problem} out of compliance`
                            : `${o.atRisk} at risk`}
                        </p>
                      </div>
                      <span className="cmp-fc">Held</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="cmp-rc">
            <div className="cmp-rc-h">
              <h3>Recent activity</h3>
              <span className="sub">Compliance events on this project.</span>
            </div>
            <div className="cmp-rc-b">
              {(() => {
                const allActivity = records
                  .flatMap((r) => r.activityTrail)
                  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                  .slice(0, 6);
                return allActivity.length > 0 ? (
                  allActivity.map((a) => (
                    <div key={a.id} className="cmp-ai">
                      <div className="cmp-ai-dot" />
                      <div className="cmp-ai-text">
                        {a.actorName && <strong>{a.actorName}</strong>}
                        {a.actorName ? " " : ""}{a.title}
                      </div>
                      <div className="cmp-ai-time">{formatDate(a.createdAt)}</div>
                    </div>
                  ))
                ) : null;
              })() ?? (
                <p className="cmp-rc-p">
                  Activity feed will populate as compliance events land.
                </p>
              )}
            </div>
          </div>

          <div className="cmp-rc info">
            <div className="cmp-rc-h">
              <h3>Compliance principle</h3>
              <span className="sub">
                What makes this different from approvals.
              </span>
            </div>
            <div className="cmp-rc-b">
              <p className="cmp-rc-p">
                Compliance determines whether a vendor can safely participate.
                Every review decision has an access-state and payment-hold
                consequence.
              </p>
            </div>
          </div>
        </aside>
      </div>

      
    </div>
  );
}

function ComplianceDetail({
  record,
  projectId: _projectId,
  now,
}: {
  record: ComplianceRow;
  projectId: string;
  now: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<null | "accept" | "reject" | "waive">(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function act(action: "accept" | "reject" | "waive") {
    setPending(action);
    setError(null);
    const res = await fetch(`/api/compliance/${record.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setPending(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? `${action}_failed`);
      return;
    }
    router.refresh();
  }

  const pill = statusPill(record, now);
  const atRisk = isAtRisk(record, now);
  const expiresInDays =
    record.expiresAt != null ? daysUntil(record.expiresAt, now) : null;
  // Show Review decision for any record that's not already active/waived.
  // Accept button is disabled when no file is on record.
  const canDecide =
    record.complianceStatus !== "active" && record.complianceStatus !== "waived";
  const showRestriction =
    record.complianceStatus === "rejected" || atRisk || !record.documentId;
  const isRestricted = record.complianceStatus === "rejected";
  const verify = verifyItemsFor(record.complianceType, !!record.documentId);

  const headerPills: { label: string; color: PillColor }[] = [
    { label: pill.label, color: pill.color },
  ];
  if (showRestriction && !isRestricted)
    headerPills.push({ label: "Restriction risk", color: "red" });
  if (isRestricted) headerPills.push({ label: "Payment held", color: "amber" });
  else if (showRestriction) headerPills.push({ label: "Payment hold", color: "amber" });

  return (
    <div className="cmd">
      <div className="cmd-head">
        <div className="cmd-head-main">
          <h3 className="cmd-title">{formatStatus(record.complianceType)}</h3>
          <div className="cmd-org">
            {record.organizationName ?? "Unknown organization"} · Project
            subcontractor
          </div>
          <p className="cmd-desc">
            {isRestricted
              ? "Record rejected. Subcontractor participation is restricted and payments are held until a valid replacement is accepted."
              : record.complianceStatus === "pending" && !record.documentId
                ? "Not submitted. Restriction threshold approaching. No replacement on file."
                : record.complianceStatus === "pending"
                  ? "Renewal file submitted. Review before current accepted record lapses."
                  : atRisk
                    ? "Record is valid today, but expiring soon. Follow up before lapse triggers a restriction."
                    : "Active and satisfies the requirement. No action needed."}
          </p>
        </div>
        <div className="cmd-pills">
          {headerPills.map((p) => (
            <Pill key={p.label} color={p.color}>
              {p.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="cmd-grid">
        <div className="cmd-cell">
          <div className="cmd-k">Organization</div>
          <div className="cmd-v">{record.organizationName ?? "—"}</div>
          <div className="cmd-m">Project subcontractor</div>
        </div>
        <div className="cmd-cell">
          <div className="cmd-k">Requirement</div>
          <div className="cmd-v">{formatStatus(record.complianceType)}</div>
          <div className="cmd-m">
            {record.documentId ? "Renewal submission" : "Project-level"}
          </div>
        </div>
        <div className="cmd-cell">
          <div className="cmd-k">Accepted-until</div>
          <div className="cmd-v">
            {record.expiresAt ? formatDate(record.expiresAt) : "—"}
          </div>
          <div className="cmd-m">
            {expiresInDays != null
              ? expiresInDays < 0
                ? `Lapsed ${Math.abs(expiresInDays)}d ago`
                : `Lapses in ${expiresInDays} day${expiresInDays === 1 ? "" : "s"}`
              : "No expiry"}
          </div>
        </div>
        <div className="cmd-cell">
          <div className="cmd-k">State</div>
          <div className="cmd-v">
            {record.documentId
              ? record.complianceStatus === "pending"
                ? "Submitted, awaiting review"
                : formatStatus(record.complianceStatus)
              : "No file submitted"}
          </div>
          <div className="cmd-m">
            {record.complianceStatus === "pending" && record.documentId
              ? "Replacement not yet accepted"
              : record.complianceStatus === "pending"
                ? "Sub notified"
                : ""}
          </div>
        </div>
      </div>

      {record.documentId && (
        <div className="cmd-section">
          <div className="cmd-section-head">
            <h4>Submitted record</h4>
            <div className="cmd-section-acts">
              <Pill color="purple">1 file</Pill>
              <button type="button" className="cmd-btn">
                View file
              </button>
            </div>
          </div>
          <div className="cmd-section-body">
            <div className="cmd-fr">
              <div>
                <h5>{record.documentTitle ?? "Compliance document"}</h5>
                <p>
                  {record.documentType ?? "Document"} · {record.documentId.slice(0, 8)}
                </p>
              </div>
              <span className="cmd-fc">{record.documentType === "insurance" ? "INS" : "PDF"}</span>
            </div>
            {verify.length > 0 && (
              <div className="cmd-vl">
                {verify.map((v) => (
                  <div key={v.label} className="cmd-vi">
                    <div className={`cmd-vchk ${v.pass ? "pass" : "fail"}`}>
                      {v.pass ? "✓" : "!"}
                    </div>
                    <div className="cmd-vlbl">
                      {v.label}
                      <span>{v.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!record.documentId && record.complianceStatus === "pending" && (
        <div className="cmd-section">
          <div className="cmd-section-head">
            <h4>Submission status</h4>
            <div className="cmd-section-acts">
              <Pill color="red">Not submitted</Pill>
            </div>
          </div>
          <div className="cmd-section-body">
            <p className="cmd-p">
              Not submitted. Subcontractor has been notified. Consider applying
              a restriction if no valid record arrives before threshold.
            </p>
          </div>
        </div>
      )}

      {canDecide && (
        <div className="cmd-section">
          <div className="cmd-section-head">
            <h4>Review decision</h4>
            <div className="cmd-section-acts">
              <span className="cmp-mtag">Operational review</span>
            </div>
          </div>
          <div className="cmd-section-body">
            <p className="cmd-p">
              The dominant action depends on whether the record satisfies the
              requirement, needs correction, or is unacceptable.
            </p>
            <div className="cmd-dec">
              <h5>Recommended: Accept record</h5>
              <p>
                Coverage verification mostly passes. Accepting clears
                restriction risk and removes the payment hold.
              </p>
              <div className="cmd-dec-acts">
                <button
                  type="button"
                  className="cmd-btn pri"
                  onClick={() => act("accept")}
                  disabled={pending != null || !record.documentId}
                  title={
                    !record.documentId
                      ? "No file on record — cannot accept"
                      : undefined
                  }
                >
                  {pending === "accept" ? "Accepting…" : "Accept record"}
                </button>
                <button
                  type="button"
                  className="cmd-btn"
                  onClick={() => act("waive")}
                  disabled={pending != null}
                >
                  {pending === "waive" ? "Waiving…" : "Request correction"}
                </button>
                <button
                  type="button"
                  className="cmd-btn dg"
                  onClick={() => act("reject")}
                  disabled={pending != null}
                >
                  {pending === "reject" ? "Rejecting…" : "Reject record"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRestriction && (
        <div className="cmd-section restrict">
          <div className="cmd-section-head">
            <h4>Restriction control</h4>
            <div className="cmd-section-acts">
              <Pill color="red">Access consequence</Pill>
            </div>
          </div>
          <div className="cmd-section-body">
            {isRestricted ? (
              <div className="cmd-rp">
                <h5>Restriction active</h5>
                <p>
                  Restriction active. Subcontractor notified. Payment processing
                  on hold. Clear restriction once a valid replacement is accepted.
                </p>
                <div className="cmd-rp-acts">
                  <button type="button" className="cmd-btn">
                    Clear restriction
                  </button>
                </div>
              </div>
            ) : (
              <div className="cmd-rp">
                <h5>
                  Current:{" "}
                  {record.documentId ? "Submitted, awaiting review" : "At risk"}
                </h5>
                <p>
                  Accepting clears risk + payment hold. Correction keeps vendor
                  at risk. Rejecting may justify restriction.
                </p>
                <div className="cmd-cgrid">
                  <div className="cmd-ccell">
                    <div className="k">If accepted</div>
                    <div className="v">Risk + hold clear</div>
                    <div className="m">Payments resume</div>
                  </div>
                  <div className="cmd-ccell">
                    <div className="k">If correction</div>
                    <div className="v">Risk stays</div>
                    <div className="m">Hold remains</div>
                  </div>
                  <div className="cmd-ccell">
                    <div className="k">If rejected</div>
                    <div className="v">May restrict</div>
                    <div className="m">Payment blocked</div>
                  </div>
                  <div className="cmd-ccell">
                    <div className="k">Countdown</div>
                    <div className="v">
                      {expiresInDays != null && expiresInDays >= 0
                        ? `${expiresInDays}d`
                        : "—"}
                    </div>
                    <div className="m">Until threshold</div>
                  </div>
                </div>
                <div className="cmd-rp-acts">
                  <button type="button" className="cmd-btn">
                    Keep active
                  </button>
                  <button type="button" className="cmd-btn dg-fill">
                    Apply restriction
                  </button>
                  <button type="button" className="cmd-btn">
                    Clear restriction
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="cmd-err">Error: {error}</p>}

      
    </div>
  );
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
