"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import type {
  ApprovalRow,
  ApprovalTotals,
} from "@/domain/loaders/approvals";

type TabId = "pending" | "approved" | "returned";

const CATEGORY_LABEL: Record<string, string> = {
  change_order: "Change Order",
  procurement: "Procurement",
  design: "Design",
  general: "General",
  other: "Other",
};

const CATEGORY_CLASS: Record<string, string> = {
  change_order: "co",
  procurement: "procurement",
  design: "design",
  general: "general",
  other: "general",
};

const THREE_DAYS_MS = 3 * 86400000;

function formatCents(cents: number, signed = false): string {
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  if (!signed) return dollars;
  const sign = cents < 0 ? "-" : "+";
  return `${sign}${dollars}`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function daysSince(d: Date, now: number): number {
  return Math.floor((now - d.getTime()) / 86400000);
}

function statusView(
  r: ApprovalRow,
  now: number,
): { color: PillColor; label: string } {
  if (r.approvalStatus === "approved") return { color: "green", label: "Approved" };
  if (r.approvalStatus === "rejected") return { color: "red", label: "Rejected" };
  if (r.approvalStatus === "needs_revision")
    return { color: "amber", label: "Returned" };
  if (r.submittedAt && now - r.submittedAt.getTime() > THREE_DAYS_MS) {
    return { color: "red", label: "Overdue" };
  }
  if (r.submittedAt && now - r.submittedAt.getTime() > 2 * 86400000) {
    return { color: "amber", label: "Due soon" };
  }
  return { color: "purple", label: "Pending" };
}

function tabOf(r: ApprovalRow): TabId {
  if (r.approvalStatus === "pending_review") return "pending";
  if (r.approvalStatus === "approved") return "approved";
  return "returned";
}

export function CommercialApprovalsReview({
  projectName,
  rows,
  totals,
  originalContractCents,
}: {
  projectName: string;
  rows: ApprovalRow[];
  totals: ApprovalTotals;
  originalContractCents: number;
}) {
  const now = Date.now();

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, returned: 0 };
    for (const r of rows) c[tabOf(r)] += 1;
    return c;
  }, [rows]);

  const [activeTab, setActiveTab] = useState<TabId>(
    counts.pending > 0 ? "pending" : counts.approved > 0 ? "approved" : "returned",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] = useState(0);

  const filtered = useMemo(
    () => rows.filter((r) => tabOf(r) === activeTab),
    [rows, activeTab],
  );
  const selected =
    filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  const currentContract = originalContractCents; // simplified
  const projectedTotal = currentContract + totals.pendingCostCents;

  return (
    <div className="apr">
      <header className="apr-head">
        <div className="apr-head-main">
          <div className="apr-crumbs">{projectName} · Approvals</div>
          <h1 className="apr-title">Approval Center</h1>
          <p className="apr-desc">
            Items from your contractor that need your formal review and decision.
            Review the impact, then approve, reject, or request more information.
          </p>
        </div>
      </header>

      <div className="apr-kpis">
        <KpiCard
          label="Needs your decision"
          value={totals.pending.toString()}
          meta={totals.pending === 0 ? "You're all caught up" : "Waiting on you"}
          iconColor="red"
          alert={totals.pending > 0}
        />
        <KpiCard
          label="Overdue review"
          value={totals.overdue.toString()}
          meta={
            totals.overdue === 0
              ? "None overdue"
              : "Past requested deadline"
          }
          iconColor="amber"
          alert={totals.overdue > 0}
        />
        <KpiCard
          label="Approved to date"
          value={rows
            .filter((r) => r.approvalStatus === "approved")
            .length.toString()}
          meta="This project"
          iconColor="green"
        />
        <KpiCard
          label="Returned"
          value={totals.returned.toString()}
          meta="Sent back for revision"
          iconColor="purple"
        />
      </div>

      <div className="apr-grid">
        <Card
          title="Decision queue"
          subtitle="All items awaiting your review, sorted by urgency."
          tabs={[
            { id: "pending", label: `Pending (${counts.pending})` },
            { id: "approved", label: `Approved (${counts.approved})` },
            { id: "returned", label: `Returned (${counts.returned})` },
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
                description="There are no approvals matching this filter."
              />
            </div>
          ) : (
            <div className="apr-split">
              <div className="apr-queue">
                {filtered.map((r) => {
                  const sv = statusView(r, now);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`apr-row ${
                        selected?.id === r.id ? "apr-row-sel" : ""
                      }`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div className="apr-row-top">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="apr-row-meta">
                            <span
                              className={`apr-type apr-type-${CATEGORY_CLASS[r.category] ?? "general"}`}
                            >
                              {CATEGORY_LABEL[r.category] ?? "Other"}
                            </span>
                          </div>
                          <div className="apr-row-title">{r.title}</div>
                          {r.description && (
                            <div className="apr-row-desc">{r.description}</div>
                          )}
                        </div>
                        <Pill color={sv.color}>{sv.label}</Pill>
                      </div>
                      <div className="apr-row-foot">
                        <span>
                          {r.impactCostCents === 0
                            ? "No cost impact"
                            : formatCents(r.impactCostCents, true)}
                        </span>
                        {r.submittedAt && (
                          <span>{daysSince(r.submittedAt, now)}d waiting</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="apr-detail">
                {selected ? (
                  <ClientApprovalDetail
                    row={selected}
                    now={now}
                    decision={decision}
                    onDecision={setDecision}
                  />
                ) : (
                  <EmptyState
                    title="Select an approval"
                    description="Pick one from the queue to review."
                  />
                )}
              </div>
            </div>
          )}
        </Card>

        <aside className="apr-rail">
          {totals.overdue > 0 && (
            <div className="apr-rc danger">
              <div className="apr-rc-h">
                <h3>Needs attention</h3>
                <span className="apr-rc-sub">Review deadline passed.</span>
              </div>
              <div className="apr-rc-b">
                <p className="apr-p">
                  {totals.overdue} item{totals.overdue === 1 ? " is" : "s are"} past the requested decision date. Your contractor is waiting on your response.
                </p>
              </div>
            </div>
          )}
          <div className="apr-rc">
            <div className="apr-rc-h">
              <h3>Pending cost impact</h3>
            </div>
            <div className="apr-rc-b">
              <div className="apr-ir">
                <span className="apr-ir-l">If all pending approved</span>
                <span className="apr-ir-v warn">
                  {totals.pendingCostCents === 0
                    ? "No change"
                    : formatCents(totals.pendingCostCents, true)}
                </span>
              </div>
              <div className="apr-ir">
                <span className="apr-ir-l">Current contract</span>
                <span className="apr-ir-v">{formatCents(currentContract)}</span>
              </div>
              <div className="apr-ir">
                <span className="apr-ir-l">Projected total</span>
                <span className="apr-ir-v">{formatCents(projectedTotal)}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .apr{display:flex;flex-direction:column;gap:20px}
        .apr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .apr-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .apr-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .apr-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .apr-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .apr-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.apr-kpis{grid-template-columns:repeat(2,1fr)}}
        .apr-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.apr-grid{grid-template-columns:1fr}}
        .apr-split{display:grid;grid-template-columns:340px minmax(0,1fr)}
        @media(max-width:900px){.apr-split{grid-template-columns:1fr}}
        .apr-queue{border-right:1px solid var(--s3);max-height:720px;overflow-y:auto;display:flex;flex-direction:column}
        .apr-row{text-align:left;background:transparent;border:none;border-bottom:1px solid var(--s3);padding:14px 18px;cursor:pointer;transition:background var(--df) var(--e);display:flex;flex-direction:column;gap:6px}
        .apr-row:hover{background:var(--sh)}
        .apr-row-sel{background:var(--ac-s)}
        .apr-row-sel:hover{background:var(--ac-s)}
        .apr-row-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
        .apr-row-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}
        .apr-row-title{font-family:var(--fd);font-size:13.5px;font-weight:700;color:var(--t1);letter-spacing:-.005em}
        .apr-row-desc{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px;line-height:1.4}
        .apr-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3)}
        .apr-detail{padding:22px 24px;min-width:0}
        .apr-type{font-family:var(--fd);font-size:10px;font-weight:700;padding:2px 7px;border-radius:var(--r-s);display:inline-flex;align-items:center;white-space:nowrap}
        .apr-type-co{background:var(--ac-s);color:var(--ac-t);border:1px solid var(--ac)}
        .apr-type-procurement{background:var(--ok-s);color:var(--ok-t);border:1px solid var(--ok)}
        .apr-type-design{background:var(--in-s);color:var(--in-t);border:1px solid var(--in)}
        .apr-type-general{background:var(--s2);color:var(--t3);border:1px solid var(--s3)}
        .apr-rail{display:flex;flex-direction:column;gap:14px}
        .apr-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .apr-rc.danger{border-color:var(--dg-s)}
        .apr-rc-h{padding:14px 16px 4px;display:flex;flex-direction:column;gap:2px}
        .apr-rc-h h3{font-family:var(--fd);font-size:13.5px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .apr-rc-sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .apr-rc-b{padding:10px 16px 16px;display:flex;flex-direction:column;gap:6px}
        .apr-p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .apr-ir{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--s2)}
        .apr-ir:last-child{border-bottom:none}
        .apr-ir-l{font-family:var(--fb);font-size:12.5px;font-weight:560;color:var(--t2)}
        .apr-ir-v{font-family:var(--fd);font-size:14px;font-weight:750;color:var(--t1)}
        .apr-ir-v.warn{color:var(--wr-t)}
      `}</style>
    </div>
  );
}

function ClientApprovalDetail({
  row,
  now,
  decision,
  onDecision,
}: {
  row: ApprovalRow;
  now: number;
  decision: number;
  onDecision: (d: number) => void;
}) {
  const sv = statusView(row, now);
  const canDecide = row.approvalStatus === "pending_review";

  return (
    <div className="apd">
      <div className="apd-head">
        <div className="apd-head-main">
          <div className="apd-cat-row">
            <span
              className={`apr-type apr-type-${CATEGORY_CLASS[row.category] ?? "general"}`}
            >
              {CATEGORY_LABEL[row.category] ?? "Other"}
            </span>
            <span className="apd-num">APR-{String(row.approvalNumber).padStart(3, "0")}</span>
          </div>
          <h2 className="apd-title">{row.title}</h2>
          {row.description && <p className="apd-desc">{row.description}</p>}
        </div>
        <div className="apd-pills">
          <Pill color={sv.color}>{sv.label}</Pill>
        </div>
      </div>

      <div className="apd-grid">
        <div className="apd-cell">
          <div className="apd-k">Cost impact</div>
          <div className="apd-v">
            {row.impactCostCents === 0
              ? "No change"
              : formatCents(row.impactCostCents, true)}
          </div>
          <div className="apd-m">
            {row.impactCostCents === 0 ? "No financial change" : "Added to contract"}
          </div>
        </div>
        <div className="apd-cell">
          <div className="apd-k">Schedule risk</div>
          <div className="apd-v">
            {row.impactScheduleDays === 0
              ? "No change"
              : row.impactScheduleDays > 0
              ? `+${row.impactScheduleDays} days`
              : `${row.impactScheduleDays} days`}
          </div>
          <div className="apd-m">
            {row.impactScheduleDays > 0 ? "If not approved soon" : "Schedule benefit"}
          </div>
        </div>
        <div className="apd-cell">
          <div className="apd-k">Requested by</div>
          <div className="apd-v">{row.requestedByName ?? "Contractor"}</div>
          <div className="apd-m">Contractor PM</div>
        </div>
        <div className="apd-cell">
          <div className="apd-k">Submitted</div>
          <div className="apd-v">
            {row.submittedAt ? formatDate(row.submittedAt) : "—"}
          </div>
          <div className="apd-m">
            {row.submittedAt
              ? `${daysSince(row.submittedAt, now)}d ago`
              : "Not yet submitted"}
          </div>
        </div>
      </div>

      {canDecide && (
        <div className="dec">
          <h4>Your decision</h4>
          <p>Choose how you&apos;d like to respond to this approval request.</p>
          <div className="dec-opts">
            {[
              { label: "Approve", sub: "Proceed as submitted" },
              { label: "Approve with note", sub: "Approve with a condition" },
              { label: "Return for revision", sub: "Send back with feedback" },
            ].map((opt, i) => (
              <button
                key={i}
                type="button"
                className={`d-opt${decision === i ? " on" : ""}`}
                onClick={() => onDecision(i)}
              >
                <div className="d-opt-h">{opt.label}</div>
                <div className="d-opt-s">{opt.sub}</div>
              </button>
            ))}
          </div>
          <textarea placeholder="Add your review note or condition…" />
          <div className="dec-acts">
            <Button variant="primary">Submit decision</Button>
            <Button variant="secondary">Cancel</Button>
          </div>
        </div>
      )}

      <style>{`
        .apd{display:flex;flex-direction:column;gap:16px}
        .apd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
        .apd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
        .apd-cat-row{display:flex;gap:8px;align-items:center}
        .apd-num{font-family:var(--fm);font-size:11px;color:var(--t3);letter-spacing:.02em}
        .apd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em;color:var(--t1);margin:0}
        .apd-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.5;margin:0;max-width:520px}
        .apd-pills{display:flex;gap:6px;flex-shrink:0}
        .apd-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .apd-cell{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
        .apd-k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .apd-v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px;color:var(--t1)}
        .apd-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}
        .dec{border:2px solid var(--ac-m);border-radius:var(--r-l);padding:18px;background:var(--s1);display:flex;flex-direction:column;gap:10px}
        .dec h4{font-family:var(--fd);font-size:15px;font-weight:750;color:var(--t1);margin:0}
        .dec>p{font-family:var(--fb);font-size:13px;color:var(--t2);margin:0;line-height:1.5}
        .dec-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px}
        .d-opt{text-align:center;border:2px solid var(--s3);border-radius:var(--r-m);padding:12px;cursor:pointer;transition:all var(--dn) var(--e);background:var(--s1)}
        .d-opt:hover{border-color:var(--s4)}
        .d-opt.on{border-color:var(--ac);background:var(--ac-s)}
        .d-opt-h{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1)}
        .d-opt-s{font-family:var(--fb);font-size:11px;color:var(--t2);margin-top:3px}
        .dec textarea{width:100%;min-height:60px;border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px;font-size:13px;font-family:var(--fb);resize:vertical;outline:none;background:var(--s1);color:var(--t1)}
        .dec textarea:focus{border-color:var(--ac-m)}
        .dec-acts{display:flex;gap:8px}
      `}</style>
    </div>
  );
}
