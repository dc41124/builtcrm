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

type TabId = "pending" | "approved" | "returned" | "all";

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
    value: "Procurement release",
    meta: "Can't order materials without approval",
  },
  procurement: {
    value: "Material ordering",
    meta: "Release pending client signoff",
  },
  design: {
    value: "Design freeze",
    meta: "Downstream trades waiting on finishes",
  },
  general: {
    value: "Scheduled work",
    meta: "Awaiting client direction",
  },
  other: {
    value: "Scheduled work",
    meta: "Awaiting client direction",
  },
};

// Inline KPI icons (from prototype)
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

const SHORT_TYPE_LABEL: Record<string, string> = {
  change_order: "CO",
  procurement: "Proc",
  design: "Design",
  general: "Other",
  other: "Other",
};

function shortTypeLabel(cat: string): string {
  return SHORT_TYPE_LABEL[cat] ?? "Other";
}

const THREE_DAYS_MS = 3 * 86400000;

function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "+";
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
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

type StatusView = { color: PillColor; label: string };

function statusView(r: ApprovalRow, now: number): StatusView {
  if (r.approvalStatus === "approved") return { color: "green", label: "Approved" };
  if (r.approvalStatus === "rejected") return { color: "red", label: "Rejected" };
  if (r.approvalStatus === "needs_revision")
    return { color: "amber", label: "Returned" };
  if (r.approvalStatus === "draft") return { color: "gray", label: "Draft" };
  // pending_review
  if (r.submittedAt && now - r.submittedAt.getTime() > THREE_DAYS_MS) {
    return { color: "red", label: "Overdue" };
  }
  if (r.submittedAt && now - r.submittedAt.getTime() > 2 * 86400000) {
    return { color: "amber", label: "Due soon" };
  }
  return { color: "purple", label: "Pending" };
}

function tabOf(r: ApprovalRow): Exclude<TabId, "all"> {
  if (r.approvalStatus === "pending_review" || r.approvalStatus === "draft")
    return "pending";
  if (r.approvalStatus === "approved") return "approved";
  return "returned";
}

export function ContractorApprovalsWorkspace({
  rows,
  totals,
}: {
  rows: ApprovalRow[];
  totals: ApprovalTotals;
}) {
  const [now] = useState(() => Date.now());

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, returned: 0 };
    for (const r of rows) c[tabOf(r)] += 1;
    return c;
  }, [rows]);

  const [activeTab, setActiveTab] = useState<TabId>(
    counts.pending > 0 ? "pending" : "all",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (activeTab === "all") return rows;
    return rows.filter((r) => tabOf(r) === activeTab);
  }, [rows, activeTab]);

  const selected =
    filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

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

  const dueSoonRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.approvalStatus === "pending_review" &&
          r.submittedAt &&
          now - r.submittedAt.getTime() > 2 * 86400000 &&
          now - r.submittedAt.getTime() <= THREE_DAYS_MS,
      ),
    [rows, now],
  );

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.approvalStatus !== "pending_review") continue;
      m.set(r.category, (m.get(r.category) ?? 0) + 1);
    }
    return Array.from(m.entries());
  }, [rows]);

  return (
    <div className="apw">
      <header className="apw-head">
        <div className="apw-head-main">
          <h1 className="apw-title">Approvals</h1>
          <p className="apw-desc">
            Track approval requests sent to clients for review. Monitor
            decisions across change orders, procurement releases, and design
            packages.
          </p>
        </div>
        <div className="apw-head-actions">
          <Button variant="primary">New approval request</Button>
        </div>
      </header>

      <div className="apw-kpis">
        <KpiCard
          label="Waiting on client"
          value={totals.pending.toString()}
          meta={totals.pending === 0 ? "Queue clear" : "Decisions pending"}
          icon={HourglassIcon}
          iconColor="red"
          alert={totals.pending > 0}
        />
        <KpiCard
          label="Overdue"
          value={totals.overdue.toString()}
          meta={
            totals.overdue === 0 ? "None flagged" : "Past review deadline"
          }
          icon={AlertTriangleIcon}
          iconColor="amber"
          alert={totals.overdue > 0}
        />
        <KpiCard
          label="Approved this month"
          value={totals.approvedThisPeriod.toString()}
          meta="Closed cleanly"
          icon={CheckCircleIcon}
          iconColor="purple"
        />
        <KpiCard
          label="Returned"
          value={totals.returned.toString()}
          meta={totals.returned === 0 ? "None" : "Needs revision"}
          icon={RotateIcon}
          iconColor="blue"
        />
      </div>

      <div className="apw-grid">
        <div className="apw-ws">
          <div className="apw-ws-head">
            <div>
              <h3>Approval workspace</h3>
              <div className="sub">
                Cross-type queue — COs, procurement releases, design packages, and other items needing client sign-off.
              </div>
            </div>
          </div>
          <div className="apw-ws-tabs">
            {(
              [
                { id: "pending", label: `Pending (${counts.pending})` },
                { id: "approved", label: `Approved (${counts.approved})` },
                { id: "returned", label: `Returned (${counts.returned})` },
                { id: "all", label: "All" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`apw-wtab ${activeTab === t.id ? "on" : ""}`}
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
                title="No approvals in this view"
                description="Nothing matches the current filter."
              />
            </div>
          ) : (
            <div className="apw-split">
              <div className="apw-queue">
                {filtered.map((r) => {
                  const sv = statusView(r, now);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`apw-ac ${
                        selected?.id === r.id ? "on" : ""
                      }`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div className="apw-ac-top">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="apw-ac-meta">
                            <span
                              className={`apw-type apw-type-${CATEGORY_CLASS[r.category] ?? "general"}`}
                            >
                              {CATEGORY_LABEL[r.category] ?? "Other"}
                            </span>
                          </div>
                          <div className="apw-ac-title">{r.title}</div>
                          {r.description && (
                            <div className="apw-ac-desc">{r.description}</div>
                          )}
                        </div>
                        <Pill color={sv.color}>{sv.label}</Pill>
                      </div>
                      <div className="apw-ac-foot">
                        <span>
                          {r.impactCostCents === 0
                            ? "No cost impact"
                            : formatCents(r.impactCostCents)}
                          {r.submittedAt
                            ? ` · Sent ${formatDate(r.submittedAt)}`
                            : ""}
                        </span>
                        <span>
                          {r.submittedAt
                            ? `${daysSince(r.submittedAt, now)}d waiting`
                            : ""}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="apw-detail">
                {selected ? (
                  <ApprovalDetail row={selected} now={now} />
                ) : (
                  <EmptyState
                    title="Select an approval"
                    description="Pick one from the queue to see details."
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="apw-rail">
          <div className="apw-rc danger">
            <div className="apw-rc-h">
              <h3>Overdue</h3>
              <span className="apw-rc-sub">Past review deadline.</span>
            </div>
            <div className="apw-rc-b">
              {overdueRows.length === 0 ? (
                <p className="apw-empty">Nothing overdue.</p>
              ) : (
                <>
                  <ul className="apw-rc-list">
                    {overdueRows.map((r) => (
                      <li key={r.id}>
                        <div className="apw-rc-n">{r.title}</div>
                        <div className="apw-rc-m">
                          {r.impactCostCents === 0
                            ? "No cost impact"
                            : formatCents(r.impactCostCents)}
                          {r.submittedAt
                            ? ` · ${daysSince(r.submittedAt, now) - 3}d overdue`
                            : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Button variant="primary" className="apw-rc-cta">
                    Send escalation
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="apw-rc alert">
            <div className="apw-rc-h">
              <h3>Due soon</h3>
            </div>
            <div className="apw-rc-b">
              {dueSoonRows.length === 0 ? (
                <p className="apw-empty">Nothing due soon.</p>
              ) : (
                <ul className="apw-rc-list">
                  {dueSoonRows.map((r) => (
                    <li key={r.id}>
                      <div className="apw-rc-n">{r.title}</div>
                      <div className="apw-rc-m">
                        {r.impactCostCents === 0
                          ? "No cost impact"
                          : formatCents(r.impactCostCents)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="apw-rc">
            <div className="apw-rc-h">
              <h3>By type</h3>
              <span className="apw-rc-sub">Pending rollup</span>
            </div>
            <div className="apw-rc-b">
              {byType.length === 0 ? (
                <p className="apw-empty">No pending items.</p>
              ) : (
                <div className="apw-fr-list">
                  {byType.map(([cat, n]) => (
                    <div key={cat} className="apw-fr">
                      <div>
                        <h5>{CATEGORY_LABEL[cat] ?? "Other"}</h5>
                        <p>
                          {n} pending
                        </p>
                      </div>
                      <span
                        className={`apw-type apw-type-${CATEGORY_CLASS[cat] ?? "general"}`}
                      >
                        {shortTypeLabel(cat)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .apw{display:flex;flex-direction:column;gap:20px}
        .apw-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .apw-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .apw-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;color:var(--t1);line-height:1.15;margin:0}
        .apw-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .apw-head-actions{display:flex;gap:8px;flex-shrink:0}
        .apw-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
        @media(max-width:1000px){.apw-kpis{grid-template-columns:repeat(2,1fr)}}
        .apw-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
        @media(max-width:1200px){.apw-grid{grid-template-columns:1fr}}
        .apw-ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;min-width:0}
        .apw-ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
        .apw-ws-head h3{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
        .apw-ws-head .sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:4px;max-width:560px}
        .apw-ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
        .apw-wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-family:var(--fb);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df) var(--e)}
        .apw-wtab:hover{border-color:var(--s4);color:var(--t1)}
        .apw-wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:color-mix(in srgb,var(--ac) 30%,var(--s3))}
        .apw-split{display:grid;grid-template-columns:360px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}
        @media(max-width:900px){.apw-split{grid-template-columns:1fr}}
        .apw-queue{display:flex;flex-direction:column;gap:6px;max-height:640px;overflow-y:auto;min-width:0}
        .apw-ac{text-align:left;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e);display:flex;flex-direction:column;gap:6px}
        .apw-ac:hover{border-color:var(--s4);box-shadow:var(--shsm)}
        .apw-ac.on{border-color:color-mix(in srgb,var(--ac) 40%,var(--s3));background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
        .apw-ac-top{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
        .apw-ac-meta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:2px}
        .apw-ac-title{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin-top:2px;letter-spacing:-.005em}
        .apw-ac-desc{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px;line-height:1.4}
        .apw-ac-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);margin-top:6px}
        .apw-detail{min-width:0}
        .apw-type{font-family:var(--fd);font-size:10px;font-weight:700;padding:2px 7px;border-radius:var(--r-s);display:inline-flex;align-items:center;white-space:nowrap}
        .apw-type-co{background:var(--ac-s);color:var(--ac-t);border:1px solid var(--ac)}
        .apw-type-procurement{background:var(--ok-s);color:var(--ok-t);border:1px solid var(--ok)}
        .apw-type-design{background:var(--in-s);color:var(--in-t);border:1px solid var(--in)}
        .apw-type-general{background:var(--s2);color:var(--t3);border:1px solid var(--s3)}
        .apw-rail{display:flex;flex-direction:column;gap:14px}
        .apw-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .apw-rc.danger{border-color:var(--dg-s)}
        .apw-rc.alert{border-color:var(--wr-s)}
        .apw-rc-h{padding:14px 16px 4px;display:flex;flex-direction:column;gap:2px}
        .apw-rc-h h3{font-family:var(--fd);font-size:13.5px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .apw-rc-sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
        .apw-rc-b{padding:8px 16px 16px}
        .apw-empty{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t3);margin:0}
        .apw-rc-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
        .apw-rc-cta{margin-top:10px;width:100%;justify-content:center}
        .apw-rc-n{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--t1)}
        .apw-rc-m{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2);margin-top:2px}
        .apw-fr-list{display:flex;flex-direction:column}
        .apw-fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--s2)}
        .apw-fr:last-child{border-bottom:none}
        .apw-fr h5{font-family:var(--fd);font-size:12.5px;font-weight:680;color:var(--t1);margin:0}
        .apw-fr p{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2);margin:2px 0 0}
      `}</style>
    </div>
  );
}

function ApprovalDetail({ row, now }: { row: ApprovalRow; now: number }) {
  const sv = statusView(row, now);
  const days = row.submittedAt ? daysSince(row.submittedAt, now) : null;
  const overdueBy = days != null && days > 3 ? days - 3 : null;
  const reviewDueAt = row.submittedAt
    ? new Date(row.submittedAt.getTime() + THREE_DAYS_MS)
    : null;

  return (
    <div className="apd">
      <div className="apd-head">
        <div className="apd-head-main">
          <div className="apd-cat-row">
            <span
              className={`apd-type apd-type-${CATEGORY_CLASS[row.category] ?? "general"}`}
            >
              {CATEGORY_LABEL[row.category] ?? "Other"}
            </span>
            <span className="apd-num">APR-{String(row.approvalNumber).padStart(3, "0")}</span>
          </div>
          <h2 className="apd-title">{row.title}</h2>
          {row.description && (
            <p className="apd-desc">{row.description}</p>
          )}
        </div>
        <div className="apd-pills">
          <Pill color={sv.color}>{sv.label}</Pill>
        </div>
      </div>

      <div className="apd-grid">
        <div className="apd-cell">
          <div className="apd-k">Sent to</div>
          <div className="apd-v">
            {row.assignedToOrganizationName ?? "Client"}
          </div>
          <div className="apd-m">
            {row.submittedAt
              ? "Awaiting client decision"
              : "Not submitted"}
          </div>
        </div>
        <div className="apd-cell">
          <div className="apd-k">Review due</div>
          <div
            className={`apd-v ${overdueBy != null ? "danger" : ""}`}
          >
            {reviewDueAt
              ? `${formatDate(reviewDueAt)}${overdueBy != null ? " (overdue)" : ""}`
              : "—"}
          </div>
          <div className="apd-m">
            {overdueBy != null
              ? `${overdueBy} ${overdueBy === 1 ? "day" : "days"} past deadline`
              : days != null
                ? `${days} ${days === 1 ? "day" : "days"} in review`
                : "Not yet submitted"}
          </div>
        </div>
        <div className="apd-cell">
          <div className="apd-k">Cost impact</div>
          <div
            className={`apd-v ${row.impactCostCents > 0 ? "warn" : row.impactCostCents < 0 ? "ok" : ""}`}
          >
            {row.impactCostCents === 0
              ? "No change"
              : formatCents(row.impactCostCents)}
          </div>
          <div className="apd-m">
            {row.impactCostCents === 0 ? "Schedule or process" : "Contract addition"}
          </div>
        </div>
        <div className="apd-cell">
          <div className="apd-k">What&rsquo;s blocked</div>
          <div className="apd-v">
            {(CATEGORY_BLOCKS[row.category] ?? CATEGORY_BLOCKS.general).value}
          </div>
          <div className="apd-m">
            {(CATEGORY_BLOCKS[row.category] ?? CATEGORY_BLOCKS.general).meta}
          </div>
        </div>
      </div>

      <div className="apd-section">
        <div className="apd-section-head">
          <h3>Tracking</h3>
          <div style={{ display: "flex", gap: 6 }}>
            <Button variant="secondary">Send reminder</Button>
            <Button variant="secondary">Edit request</Button>
          </div>
        </div>
        <div className="apd-section-body">
        <div className="apd-activity">
          {row.submittedAt && (
            <>
              <div className="apd-ai">
                <div className="apd-dot" />
                <div className="apd-at">
                  <strong>{row.requestedByName ?? "Contractor"}</strong> submitted approval request
                  {row.assignedToOrganizationName
                    ? ` to ${row.assignedToOrganizationName}`
                    : ""}
                </div>
                <div className="apd-atm">{formatDate(row.submittedAt)}</div>
              </div>
              <div className="apd-ai">
                <div className="apd-dot sys" />
                <div className="apd-at">Client notified via email</div>
                <div className="apd-atm">{formatDate(row.submittedAt)}</div>
              </div>
              {overdueBy != null && reviewDueAt && (
                <div className="apd-ai">
                  <div className="apd-dot sys" />
                  <div className="apd-at">
                    Review deadline reached &mdash; no response
                  </div>
                  <div className="apd-atm">{formatDate(reviewDueAt)}</div>
                </div>
              )}
              {overdueBy != null && overdueBy >= 1 && reviewDueAt && (
                <div className="apd-ai">
                  <div className="apd-dot sys" />
                  <div className="apd-at">Automated reminder sent to client</div>
                  <div className="apd-atm">
                    {formatDate(new Date(reviewDueAt.getTime() + 86400000))}
                  </div>
                </div>
              )}
            </>
          )}
          {row.decidedAt && (
            <div className="apd-ai">
              <div className="apd-dot ok" />
              <div className="apd-at">
                <strong>{row.decidedByName ?? "Client"}</strong>{" "}
                {row.approvalStatus === "approved"
                  ? "approved"
                  : "decided on"}{" "}
                this request
              </div>
              <div className="apd-atm">{formatDate(row.decidedAt)}</div>
            </div>
          )}
          {!row.submittedAt && (
            <div className="apd-ai">
              <div className="apd-dot sys" />
              <div className="apd-at">
                Draft request &mdash; not yet submitted
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      <div className="apd-section">
        <div className="apd-section-head">
          <h3>Supporting documents sent</h3>
        </div>
        <div className="apd-section-body">
          <p className="apd-note">
            Attach supporting drawings, cost breakdowns, or specs for the reviewer.
          </p>
        </div>
      </div>

      <style>{`
        .apd{display:flex;flex-direction:column;gap:14px;min-height:400px}
        .apd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
        .apd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:6px}
        .apd-cat-row{display:flex;gap:8px;align-items:center}
        .apd-num{font-family:var(--fm);font-size:11px;color:var(--t3);letter-spacing:.02em}
        .apd-type{font-family:var(--fd);font-size:10px;font-weight:700;padding:2px 7px;border-radius:var(--r-s);display:inline-flex;align-items:center;white-space:nowrap}
        .apd-type-co{background:var(--ac-s);color:var(--ac-t);border:1px solid var(--ac)}
        .apd-type-procurement{background:var(--ok-s);color:var(--ok-t);border:1px solid var(--ok)}
        .apd-type-design{background:var(--in-s);color:var(--in-t);border:1px solid var(--in)}
        .apd-type-general{background:var(--s2);color:var(--t3);border:1px solid var(--s3)}
        .apd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em;color:var(--t1);margin:0}
        .apd-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.5;margin:0;max-width:520px}
        .apd-pills{display:flex;gap:6px;flex-shrink:0}
        .apd-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .apd-cell{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
        .apd-k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .apd-v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px;color:var(--t1)}
        .apd-v.warn{color:var(--wr-t)}
        .apd-v.ok{color:var(--ok-t)}
        .apd-v.danger{color:var(--dg-t)}
        .apd-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}
        .apd-section{border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
        .apd-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
        .apd-section-head h3{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0}
        .apd-section-body{padding:14px 16px}
        .apd-activity{display:flex;flex-direction:column}
        .apd-ai{display:flex;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2);align-items:flex-start}
        .apd-ai:last-child{border-bottom:none}
        .apd-dot{width:8px;height:8px;border-radius:50%;background:var(--ac);margin-top:6px;flex-shrink:0}
        .apd-dot.ok{background:var(--ok)}
        .apd-dot.sys{background:var(--t3)}
        .apd-at{flex:1;font-family:var(--fb);font-size:13px;color:var(--t2)}
        .apd-at strong{color:var(--t1);font-weight:650}
        .apd-atm{font-family:var(--fb);font-size:11px;color:var(--t3);flex-shrink:0;padding-top:2px}
        .apd-note{font-family:var(--fb);font-size:12.5px;color:var(--t2);margin:0;line-height:1.55}
      `}</style>
    </div>
  );
}
