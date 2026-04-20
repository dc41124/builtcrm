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
import { formatMoneyCents } from "@/lib/format/money";

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

const formatCents = (c: number) => formatMoneyCents(c, { signed: true });

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
  nowMs: now,
  initialSelectedId = null,
}: {
  rows: ApprovalRow[];
  totals: ApprovalTotals;
  nowMs: number;
  initialSelectedId?: string | null;
}) {

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, returned: 0 };
    for (const r of rows) c[tabOf(r)] += 1;
    return c;
  }, [rows]);

  // When the user deep-links with ?open=<id>, open the tab that row lives
  // on so the deep-linked item is visible in the queue panel.
  const initialRow = initialSelectedId
    ? rows.find((r) => r.id === initialSelectedId)
    : null;
  const initialTab: TabId = initialRow
    ? tabOf(initialRow)
    : counts.pending > 0
      ? "pending"
      : "all";

  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelectedId,
  );

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
          {row.activityTrail.length > 0 ? (
            row.activityTrail.map((a) => (
              <div key={a.id} className="apd-ai">
                <div className={`apd-dot${a.activityType === "status_change" ? " ok" : ""}`} />
                <div className="apd-at">
                  {a.actorName ? <strong>{a.actorName}</strong> : null}
                  {a.actorName ? " " : ""}
                  {a.title}
                </div>
                <div className="apd-atm">{formatDate(a.createdAt)}</div>
              </div>
            ))
          ) : (
            <>
              {row.submittedAt && (
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
              )}
              {row.decidedAt && (
                <div className="apd-ai">
                  <div className="apd-dot ok" />
                  <div className="apd-at">
                    <strong>{row.decidedByName ?? "Client"}</strong>{" "}
                    {row.approvalStatus === "approved" ? "approved" : "decided on"}{" "}
                    this request
                  </div>
                  <div className="apd-atm">{formatDate(row.decidedAt)}</div>
                </div>
              )}
              {!row.submittedAt && (
                <div className="apd-ai">
                  <div className="apd-dot sys" />
                  <div className="apd-at">Draft request &mdash; not yet submitted</div>
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </div>

      <div className="apd-section">
        <div className="apd-section-head">
          <h3>Supporting documents ({row.supportingDocuments.length})</h3>
        </div>
        <div className="apd-section-body">
          {row.supportingDocuments.length === 0 ? (
            <p className="apd-note">
              No supporting documents attached yet. Attach drawings, cost breakdowns, or specs for the reviewer.
            </p>
          ) : (
            <div className="apd-docs">
              {row.supportingDocuments.map((d) => (
                <div key={d.id} className="apd-doc-row">
                  <div className="apd-doc-icon">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="apd-doc-info">
                    <div className="apd-doc-title">{d.title}</div>
                    <div className="apd-doc-meta">{d.documentType} · {d.linkRole}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      
    </div>
  );
}
