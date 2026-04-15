"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import type { ContractorProjectView } from "@/domain/loaders/project-home";

type ComplianceRow = ContractorProjectView["complianceRecords"][number];

type TabId = "review" | "atrisk" | "restricted" | "accepted";

const THRESHOLD_DAYS = 14;

function isAtRisk(r: ComplianceRow, now: number): boolean {
  if (r.complianceStatus === "rejected") return false;
  if (r.complianceStatus === "expired") return true;
  if (r.complianceStatus === "active" || r.complianceStatus === "waived") {
    if (!r.expiresAt) return false;
    const days = (r.expiresAt.getTime() - now) / 86400000;
    return days <= THRESHOLD_DAYS && days >= 0;
  }
  // pending or missing
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

function statusPill(r: ComplianceRow, now: number): { color: PillColor; label: string } {
  if (r.complianceStatus === "rejected") return { color: "red", label: "Restricted" };
  if (r.complianceStatus === "expired") return { color: "red", label: "Expired" };
  if (r.complianceStatus === "pending") {
    if (!r.documentId) return { color: "red", label: "Missing" };
    return { color: "amber", label: "Needs review" };
  }
  if (isAtRisk(r, now)) return { color: "amber", label: "Expiring" };
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

export function ContractorComplianceWorkspace({
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
    const c = { review: 0, atrisk: 0, restricted: 0, accepted: 0 };
    for (const r of tagged) c[r._tab] += 1;
    return c;
  }, [tagged]);

  const [activeTab, setActiveTab] = useState<TabId>(
    counts.review > 0 ? "review" : counts.atrisk > 0 ? "atrisk" : "accepted",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => tagged.filter((r) => r._tab === activeTab),
    [tagged, activeTab],
  );

  const selected =
    filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const scorecard = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; accepted: number; problem: number }
    >();
    for (const r of records) {
      const key = r.organizationId;
      const name = r.organizationName ?? "Unknown org";
      const prev = map.get(key) ?? { name, total: 0, accepted: 0, problem: 0 };
      prev.total += 1;
      if (r.complianceStatus === "active" || r.complianceStatus === "waived") {
        prev.accepted += 1;
      }
      if (r.complianceStatus === "rejected" || (r.complianceStatus === "pending" && !r.documentId)) {
        prev.problem += 1;
      }
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.problem - a.problem);
  }, [records]);

  const paymentHolds = useMemo(
    () =>
      scorecard.filter((o) => o.problem > 0),
    [scorecard],
  );

  return (
    <div className="cmp">
      <header className="cmp-head">
        <div className="cmp-head-main">
          <div className="cmp-crumbs">{projectName} · Compliance</div>
          <h1 className="cmp-title">Compliance</h1>
          <p className="cmp-desc">
            Review submitted records, track requirements, and control access-state
            restrictions. Non-compliant subcontractors have payment holds applied
            automatically.
          </p>
        </div>
        <div className="cmp-head-actions">
          <Button variant="secondary">Export log</Button>
        </div>
      </header>

      <div className="cmp-kpis">
        <KpiCard
          label="Needs review"
          value={counts.review.toString()}
          meta={counts.review === 0 ? "Queue clear" : "Submitted, awaiting decision"}
          iconColor="purple"
          alert={counts.review > 0}
        />
        <KpiCard
          label="At risk"
          value={counts.atrisk.toString()}
          meta={counts.atrisk === 0 ? "None flagged" : "Restriction threshold approaching"}
          iconColor="amber"
          alert={counts.atrisk > 0}
        />
        <KpiCard
          label="Restricted"
          value={counts.restricted.toString()}
          meta={counts.restricted === 0 ? "No holds" : "Participation limited"}
          iconColor="red"
          alert={counts.restricted > 0}
        />
        <KpiCard
          label="Active"
          value={counts.accepted.toString()}
          meta="Accepted or waived"
          iconColor="green"
        />
      </div>

      <div className="cmp-grid">
        <Card
          tabs={[
            { id: "review", label: `Needs review (${counts.review})` },
            { id: "atrisk", label: `At risk (${counts.atrisk})` },
            { id: "restricted", label: `Restricted (${counts.restricted})` },
            { id: "accepted", label: `Active (${counts.accepted})` },
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
                title="No records in this view"
                description="Nothing matches the current filter."
              />
            </div>
          ) : (
            <div className="cmp-split">
              <div className="cmp-queue">
                {filtered.map((r) => {
                  const pill = statusPill(r, now);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`cmp-row ${selected?.id === r.id ? "cmp-row-sel" : ""}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div className="cmp-row-top">
                        <div className="cmp-row-org">
                          {r.organizationName ?? "Unknown org"}
                        </div>
                        <Pill color={pill.color}>{pill.label}</Pill>
                      </div>
                      <div className="cmp-row-title">{r.complianceType}</div>
                      <div className="cmp-row-foot">
                        <span>
                          {r.expiresAt
                            ? `Expires ${formatDate(r.expiresAt)}`
                            : "No expiry"}
                        </span>
                        <span>{r.documentId ? "Doc on file" : "No document"}</span>
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
        </Card>

        <aside className="cmp-rail">
          <div className="cmp-rc">
            <div className="cmp-rc-h">
              <h3>Org scorecard</h3>
              <span className="cmp-rc-sub">Per-sub requirement rollup</span>
            </div>
            <div className="cmp-rc-b">
              {scorecard.length === 0 ? (
                <p className="cmp-empty">No requirements tracked yet.</p>
              ) : (
                <ul className="cmp-osc">
                  {scorecard.map((o, i) => (
                    <li key={i} className="cmp-o-row">
                      <span className="cmp-o-name">{o.name}</span>
                      <div className="cmp-o-dots">
                        {Array.from({ length: o.total }).map((_, j) => (
                          <span
                            key={j}
                            className={`cmp-o-dot ${
                              j < o.accepted ? "ok" : j < o.accepted + (o.total - o.accepted - o.problem) ? "warn" : "bad"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="cmp-o-lbl">
                        {o.accepted}/{o.total}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="cmp-rc alert">
            <div className="cmp-rc-h">
              <h3>Payment holds</h3>
              <span className="cmp-rc-sub">Compliance-linked restrictions</span>
            </div>
            <div className="cmp-rc-b">
              {paymentHolds.length === 0 ? (
                <p className="cmp-empty">No payment holds.</p>
              ) : (
                <ul className="cmp-holds">
                  {paymentHolds.map((o, i) => (
                    <li key={i}>
                      <div className="cmp-hold-name">{o.name}</div>
                      <div className="cmp-hold-meta">
                        {o.problem} requirement{o.problem === 1 ? "" : "s"} out of compliance · draws blocked
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="cmp-rc info">
            <div className="cmp-rc-h">
              <h3>Compliance principle</h3>
            </div>
            <div className="cmp-rc-b">
              <p className="cmp-p">
                Compliance determines whether a vendor can safely participate. Every
                review decision has an access-state and payment-hold consequence.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .cmp{display:flex;flex-direction:column;gap:20px}
        .cmp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .cmp-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .cmp-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .cmp-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .cmp-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .cmp-head-actions{display:flex;gap:8px;flex-shrink:0}
        .cmp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.cmp-kpis{grid-template-columns:repeat(2,1fr)}}
        .cmp-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.cmp-grid{grid-template-columns:1fr}}
        .cmp-split{display:grid;grid-template-columns:340px minmax(0,1fr)}
        @media(max-width:900px){.cmp-split{grid-template-columns:1fr}}
        .cmp-queue{border-right:1px solid var(--s3);max-height:680px;overflow-y:auto;display:flex;flex-direction:column}
        .cmp-row{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s3);padding:14px 18px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:4px}
        .cmp-row:hover{background:var(--sh)}
        .cmp-row-sel{background:var(--ac-s)}
        .cmp-row-sel:hover{background:var(--ac-s)}
        .cmp-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .cmp-row-org{font-family:var(--fm);font-size:11px;font-weight:600;color:var(--t3);letter-spacing:.02em}
        .cmp-row-title{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .cmp-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .cmp-detail{padding:22px 24px;min-width:0}
        .cmp-rail{display:flex;flex-direction:column;gap:14px}
        .cmp-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .cmp-rc.alert{border-color:var(--wr-s)}
        .cmp-rc.info{border-color:var(--in-s)}
        .cmp-rc-h{padding:14px 16px 4px;display:flex;flex-direction:column;gap:2px}
        .cmp-rc-h h3{font-family:var(--fd);font-size:13.5px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .cmp-rc-sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .cmp-rc-b{padding:8px 16px 16px}
        .cmp-empty{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t3);margin:0}
        .cmp-osc{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
        .cmp-o-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--s2)}
        .cmp-o-row:last-child{border-bottom:none}
        .cmp-o-name{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--t1);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cmp-o-dots{display:flex;gap:3px;align-items:center;flex-shrink:0}
        .cmp-o-dot{width:8px;height:8px;border-radius:50%}
        .cmp-o-dot.ok{background:var(--ok)}
        .cmp-o-dot.warn{background:var(--wr)}
        .cmp-o-dot.bad{background:var(--dg)}
        .cmp-o-lbl{font-family:var(--fb);font-size:11px;font-weight:620;color:var(--t3);white-space:nowrap}
        .cmp-holds{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
        .cmp-hold-name{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--t1)}
        .cmp-hold-meta{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2);margin-top:2px}
        .cmp-p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
      `}</style>
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
  const [pending, setPending] = useState<null | "accept" | "reject" | "waive">(null);
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
  const canDecide = record.complianceStatus === "pending";
  const showRestriction =
    record.complianceStatus === "rejected" || atRisk || !record.documentId;

  return (
    <div className="cmd">
      <div className="cmd-head">
        <div className="cmd-head-main">
          <div className="cmd-org">{record.organizationName ?? "Unknown organization"}</div>
          <h2 className="cmd-title">{record.complianceType}</h2>
          <p className="cmd-desc">
            {record.complianceStatus === "rejected"
              ? "Record rejected. Subcontractor participation is restricted and payments are held until a valid replacement is accepted."
              : record.complianceStatus === "pending" && !record.documentId
              ? "No record submitted. Restriction threshold is approaching."
              : record.complianceStatus === "pending"
              ? "Record submitted. Decide whether it satisfies the requirement."
              : atRisk
              ? "Record is valid today, but expiring soon. Follow up before lapse triggers a restriction."
              : "Active and satisfies the requirement. No action needed."}
          </p>
        </div>
        <div className="cmd-pills">
          <Pill color={pill.color}>{pill.label}</Pill>
        </div>
      </div>

      <div className="cmd-grid">
        <Field label="Organization" value={record.organizationName ?? "—"} />
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
      </div>

      <div className="cmd-section">
        <div className="cmd-section-head">
          <h3>Submitted record</h3>
          {record.documentId ? (
            <Pill color="purple">1 file</Pill>
          ) : (
            <Pill color="red">Not submitted</Pill>
          )}
        </div>
        {record.documentId ? (
          <div className="cmd-file">
            <div>
              <div className="cmd-file-name">Compliance document</div>
              <div className="cmd-file-meta">
                Attached · document {record.documentId.slice(0, 8)}
              </div>
            </div>
            <Button variant="secondary">View file</Button>
          </div>
        ) : (
          <p className="cmd-note">
            No file uploaded. Subcontractor has been notified. Consider applying a
            restriction if nothing arrives before the threshold.
          </p>
        )}
      </div>

      {canDecide && (
        <div className="cmd-section">
          <div className="cmd-section-head">
            <h3>Review decision</h3>
          </div>
          <p className="cmd-note">
            Accept clears restriction risk and removes the payment hold. Reject keeps
            the vendor restricted and draws blocked. Waive permanently exempts this
            requirement with an audit record.
          </p>
          <div className="cmd-actions">
            <Button
              variant="primary"
              onClick={() => act("accept")}
              loading={pending === "accept"}
              disabled={!record.documentId}
            >
              Accept record
            </Button>
            <Button
              variant="secondary"
              onClick={() => act("reject")}
              loading={pending === "reject"}
            >
              Reject record
            </Button>
            <Button
              variant="ghost"
              onClick={() => act("waive")}
              loading={pending === "waive"}
            >
              Waive requirement
            </Button>
          </div>
          {error && <p className="cmd-err">Error: {error}</p>}
        </div>
      )}

      {showRestriction && (
        <div className="cmd-restrict">
          <div className="cmd-restrict-top">
            <h4>
              {record.complianceStatus === "rejected"
                ? "Restriction active"
                : "Restriction consequence"}
            </h4>
            <Pill color="red">Billing impact</Pill>
          </div>
          <p>
            {record.complianceStatus === "rejected"
              ? "Participation limited. Draws and invoices are blocked until a valid replacement is accepted."
              : "If this record lapses or is rejected, draws and invoices for this organization will be blocked until compliance clears."}
          </p>
        </div>
      )}

      <style>{`
        .cmd{display:flex;flex-direction:column;gap:18px}
        .cmd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
        .cmd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
        .cmd-org{font-family:var(--fm);font-size:12px;font-weight:600;color:var(--t3);letter-spacing:.02em}
        .cmd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.015em;color:var(--t1);margin:0}
        .cmd-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0;max-width:540px}
        .cmd-pills{display:flex;gap:6px;flex-shrink:0}
        .cmd-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:16px;background:var(--sh);border-radius:var(--r-m)}
        .cmd-section{display:flex;flex-direction:column;gap:10px;border:1px solid var(--s3);border-radius:var(--r-l);padding:16px}
        .cmd-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .cmd-section-head h3{font-family:var(--fd);font-size:13.5px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .cmd-file{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:var(--sh);border-radius:var(--r-m)}
        .cmd-file-name{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1)}
        .cmd-file-meta{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:2px}
        .cmd-note{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .cmd-actions{display:flex;gap:8px;flex-wrap:wrap}
        .cmd-err{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--dg-t);margin:0}
        .cmd-restrict{border:1px solid var(--dg-s);background:var(--dg-s);border-radius:var(--r-l);padding:14px 16px;display:flex;flex-direction:column;gap:6px}
        .cmd-restrict-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .cmd-restrict h4{font-family:var(--fd);font-size:13.5px;font-weight:720;color:var(--dg-t);margin:0;letter-spacing:-.01em}
        .cmd-restrict p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--dg-t);line-height:1.55;margin:0}
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
    <div className="cmd-field">
      <div className="cmd-k">{label}</div>
      <div className="cmd-v">{value}</div>
      {meta && <div className="cmd-m">{meta}</div>}
      <style>{`
        .cmd-field{display:flex;flex-direction:column;gap:3px;min-width:0}
        .cmd-k{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
        .cmd-v{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .cmd-m{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2)}
      `}</style>
    </div>
  );
}
