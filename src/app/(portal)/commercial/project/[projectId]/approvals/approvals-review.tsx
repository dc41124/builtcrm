"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/button";
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

const CATEGORY_BLOCKS: Record<string, { value: string; meta: string }> = {
  change_order: {
    value: "Material ordering",
    meta: "Procurement can't proceed",
  },
  procurement: {
    value: "Material ordering",
    meta: "Procurement can't proceed",
  },
  design: {
    value: "Design freeze",
    meta: "Downstream trades waiting on finishes",
  },
  general: {
    value: "Scheduled work",
    meta: "Awaiting your direction",
  },
  other: {
    value: "Scheduled work",
    meta: "Awaiting your direction",
  },
};

const THREE_DAYS_MS = 3 * 86400000;

// Inline KPI icons (shared prototype set)
const HourglassIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 00-.586-1.414L12 12l-4.414 4.414A2 2 0 007 17.828V22M17 2v4.172a2 2 0 01-.586 1.414L12 12 7.586 7.586A2 2 0 017 6.172V2" />
  </svg>
);
const AlertTriangleIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />
  </svg>
);
const CheckCircleIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
    <path d="M22 4L12 14.01l-3-3" />
  </svg>
);
const RotateIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 4v6h6M23 20v-6h-6" />
    <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
  </svg>
);

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
  rows,
  totals,
  originalContractCents,
}: {
  rows: ApprovalRow[];
  totals: ApprovalTotals;
  originalContractCents: number;
}) {
  const [now] = useState(() => Date.now());

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

  const overdueRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.approvalStatus === "pending_review" &&
          r.submittedAt &&
          now - r.submittedAt.getTime() > THREE_DAYS_MS,
      ),
    [rows, now],
  );
  const firstOverdue = overdueRows[0] ?? null;

  return (
    <div className="apr">
      <header className="apr-head">
        <div className="apr-head-main">
          <h1 className="apr-title">Approvals Center</h1>
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
          icon={HourglassIcon}
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
          icon={AlertTriangleIcon}
          iconColor="amber"
          alert={totals.overdue > 0}
        />
        <KpiCard
          label="Approved to date"
          value={rows
            .filter((r) => r.approvalStatus === "approved")
            .length.toString()}
          meta="This project"
          icon={CheckCircleIcon}
          iconColor="green"
        />
        <KpiCard
          label="Returned"
          value={totals.returned.toString()}
          meta="Sent back for revision"
          icon={RotateIcon}
          iconColor="blue"
        />
      </div>

      <div className="apr-grid">
        <div className="apr-ws">
          <div className="apr-ws-head">
            <div>
              <h3>Decision queue</h3>
              <div className="sub">
                All items awaiting your review, sorted by urgency.
              </div>
            </div>
          </div>
          <div className="apr-ws-tabs">
            {(
              [
                { id: "pending", label: `Pending (${counts.pending})` },
                { id: "approved", label: `Approved (${counts.approved})` },
                { id: "returned", label: `Returned (${counts.returned})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`apr-wtab ${activeTab === t.id ? "on" : ""}`}
                onClick={() => {
                  setActiveTab(t.id);
                  setSelectedId(null);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
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
                      className={`apr-ac ${
                        selected?.id === r.id ? "on" : ""
                      }`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div className="apr-ac-top">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="apr-ac-meta">
                            <span
                              className={`apr-type apr-type-${CATEGORY_CLASS[r.category] ?? "general"}`}
                            >
                              {CATEGORY_LABEL[r.category] ?? "Other"}
                            </span>
                          </div>
                          <div className="apr-ac-title">{r.title}</div>
                          {r.description && (
                            <div className="apr-ac-desc">{r.description}</div>
                          )}
                        </div>
                        <Pill color={sv.color}>{sv.label}</Pill>
                      </div>
                      <div className="apr-ac-foot">
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
        </div>

        <aside className="apr-rail">
          {totals.overdue > 0 && firstOverdue && (
            <div className="apr-rc danger">
              <div className="apr-rc-h">
                <h3>Needs attention</h3>
                <span className="apr-rc-sub">Review deadline passed.</span>
              </div>
              <div className="apr-rc-b">
                <p className="apr-p">
                  {totals.overdue === 1
                    ? `${firstOverdue.title} was due for review${
                        firstOverdue.submittedAt
                          ? ` on ${formatDate(
                              new Date(
                                firstOverdue.submittedAt.getTime() +
                                  THREE_DAYS_MS,
                              ),
                            )}`
                          : ""
                      }. Your contractor is waiting on your decision.`
                    : `${totals.overdue} items are past the requested decision date. Your contractor is waiting on your response.`}
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

      <style dangerouslySetInnerHTML={{ __html: `
        .apr{display:flex;flex-direction:column;gap:20px}
        .apr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .apr-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .apr-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
        .apr-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .apr-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.apr-kpis{grid-template-columns:repeat(2,1fr)}}
        .apr-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.apr-grid{grid-template-columns:1fr}}
        .apr-ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;min-width:0}
        .apr-ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
        .apr-ws-head h3{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
        .apr-ws-head .sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:4px;max-width:560px}
        .apr-ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
        .apr-wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-family:var(--fb);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df) var(--e)}
        .apr-wtab:hover{border-color:var(--s4);color:var(--t1)}
        .apr-wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:color-mix(in srgb,var(--ac) 30%,var(--s3))}
        .apr-split{display:grid;grid-template-columns:340px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}
        @media(max-width:900px){.apr-split{grid-template-columns:1fr}}
        .apr-queue{display:flex;flex-direction:column;gap:6px;max-height:720px;overflow-y:auto;min-width:0}
        .apr-queue::-webkit-scrollbar{width:4px}
        .apr-queue::-webkit-scrollbar-track{background:transparent}
        .apr-queue::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
        .apr-ac{text-align:left;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e);display:flex;flex-direction:column;gap:6px}
        .apr-ac:hover{border-color:var(--s4);box-shadow:var(--shsm)}
        .apr-ac.on{border-color:color-mix(in srgb,var(--ac) 40%,var(--s3));background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
        .apr-ac-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
        .apr-ac-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:2px}
        .apr-ac-title{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin-top:2px;letter-spacing:-.005em}
        .apr-ac-desc{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px;line-height:1.4}
        .apr-ac-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);margin-top:6px}
        .apr-detail{min-width:0}
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
      ` }} />
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
          <div
            className={`apd-v ${row.impactScheduleDays > 0 ? "warn" : row.impactScheduleDays < 0 ? "ok" : ""}`}
          >
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
          <div className="apd-k">What it blocks</div>
          <div className="apd-v">
            {(CATEGORY_BLOCKS[row.category] ?? CATEGORY_BLOCKS.general).value}
          </div>
          <div className="apd-m">
            {(CATEGORY_BLOCKS[row.category] ?? CATEGORY_BLOCKS.general).meta}
          </div>
        </div>
      </div>

      {row.description && (
        <div className="apd-section">
          <div className="apd-section-head">
            <h3>Contractor&rsquo;s explanation</h3>
          </div>
          <div className="apd-section-body">
            <p className="apd-p">{row.description}</p>
          </div>
        </div>
      )}

      <div className="apd-section">
        <div className="apd-section-head">
          <h3>Supporting documents</h3>
        </div>
        <div className="apd-section-body">
          <p className="apd-p">
            Drawings, cost breakdowns, and specs from your contractor will appear here.
          </p>
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

      <style dangerouslySetInnerHTML={{ __html: `
        .apd{display:flex;flex-direction:column;gap:14px;min-height:400px}
        .apd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
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
        .apd-v.warn{color:var(--wr-t)}
        .apd-v.ok{color:var(--ok-t)}
        .apd-section{border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
        .apd-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
        .apd-section-head h3{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0}
        .apd-section-body{padding:14px 16px}
        .apd-p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}
        .dec{border:2px solid var(--ac-m);border-radius:var(--r-l);padding:18px;background:var(--s1);display:flex;flex-direction:column;gap:10px}
        .dec h4{font-family:var(--fd);font-size:15px;font-weight:750;color:var(--t1);margin:0}
        .dec p{font-family:var(--fb);font-size:13px;color:var(--t2);margin:0;line-height:1.5}
        .dec-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px}
        .d-opt{text-align:center;border:2px solid var(--s3);border-radius:var(--r-m);padding:12px;cursor:pointer;transition:all var(--dn) var(--e);background:var(--s1)}
        .d-opt:hover{border-color:var(--s4)}
        .d-opt.on{border-color:var(--ac);background:var(--ac-s)}
        .d-opt-h{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1)}
        .d-opt-s{font-family:var(--fb);font-size:11px;color:var(--t2);margin-top:3px}
        .dec textarea{width:100%;min-height:60px;border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px;font-size:13px;font-family:var(--fb);resize:vertical;outline:none;background:var(--s1);color:var(--t1)}
        .dec textarea:focus{border-color:var(--ac-m)}
        .dec-acts{display:flex;gap:8px}
      ` }} />
    </div>
  );
}
