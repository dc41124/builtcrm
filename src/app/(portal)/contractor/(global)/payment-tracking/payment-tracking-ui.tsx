"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import {
  ProjectMultiSelect,
  SingleChipGroup,
  clearLinkStyle,
  filterBarStyle,
  workspaceCardStyle,
} from "@/components/portfolio-filters";
import type {
  ContractorCrossProjectPaymentsView,
  InboundEffectiveStatus,
  InboundRow,
  OutboundRow,
} from "@/domain/loaders/cross-project-payments";
import { formatMoneyCents } from "@/lib/format/money";

// Step 38 / 4D #38 — contractor-wide payment tracking. Two tabs:
//   Inbound  — draws (contractor → client)
//   Outbound — lien waivers (contractor → subs; used as sub-payment proxy)
//
// Row click deep-links to the project's billing workspace for full
// context (SOV, line items, waivers, payment history).

// --------------------------------------------------------------------------
// Formatters
// --------------------------------------------------------------------------

const formatCents = (c: number) => formatMoneyCents(c);

function ageLabel(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "Today";
  return `${days}d`;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// --------------------------------------------------------------------------
// Status → label + pill color maps
// --------------------------------------------------------------------------

const INBOUND_STATUS_LABEL: Record<InboundEffectiveStatus, string> = {
  delinquent: "Delinquent",
  partially_paid: "Partially paid",
  approved: "Approved",
  approved_with_note: "Approved (note)",
  under_review: "Under review",
  ready_for_review: "Ready for review",
  submitted: "Submitted",
  returned: "Returned",
  revised: "Revised",
  draft: "Draft",
  paid: "Paid",
  closed: "Closed",
};

const INBOUND_STATUS_PILL: Record<InboundEffectiveStatus, PillColor> = {
  delinquent: "red",
  partially_paid: "amber",
  approved: "purple",
  approved_with_note: "purple",
  under_review: "blue",
  ready_for_review: "blue",
  submitted: "blue",
  returned: "amber",
  revised: "amber",
  draft: "gray",
  paid: "green",
  closed: "gray",
};

type InboundStatusFilter =
  | "all"
  | "delinquent"
  | "partially_paid"
  | "pending_review"
  | "approved"
  | "paid"
  | "other";

const INBOUND_STATUS_OPTIONS: Array<{ id: InboundStatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "delinquent", label: "Delinquent" },
  { id: "partially_paid", label: "Partial" },
  { id: "pending_review", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "paid", label: "Paid" },
  { id: "other", label: "Other" },
];

function matchesInboundStatusFilter(
  r: InboundRow,
  f: InboundStatusFilter,
): boolean {
  if (f === "all") return true;
  if (f === "delinquent") return r.effectiveStatus === "delinquent";
  if (f === "partially_paid") return r.effectiveStatus === "partially_paid";
  if (f === "pending_review") {
    return (
      r.effectiveStatus === "submitted" ||
      r.effectiveStatus === "under_review" ||
      r.effectiveStatus === "ready_for_review"
    );
  }
  if (f === "approved") {
    return (
      r.effectiveStatus === "approved" ||
      r.effectiveStatus === "approved_with_note"
    );
  }
  if (f === "paid") return r.effectiveStatus === "paid";
  // "other" — draft, closed, returned, revised
  return (
    r.effectiveStatus === "draft" ||
    r.effectiveStatus === "closed" ||
    r.effectiveStatus === "returned" ||
    r.effectiveStatus === "revised"
  );
}

const OUTBOUND_STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  submitted: "Submitted",
  accepted: "Accepted",
  rejected: "Rejected",
  waived: "Waived",
};

const OUTBOUND_STATUS_PILL: Record<string, PillColor> = {
  requested: "amber",
  submitted: "blue",
  accepted: "green",
  rejected: "red",
  waived: "gray",
};

type OutboundStatusFilter = "all" | "requested" | "submitted" | "accepted" | "rejected" | "waived";

const OUTBOUND_STATUS_OPTIONS: Array<{ id: OutboundStatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "requested", label: "Requested" },
  { id: "submitted", label: "Submitted" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
  { id: "waived", label: "Waived" },
];

// --------------------------------------------------------------------------
// Date-range filter
// --------------------------------------------------------------------------

type DateRangeFilter = "all" | "30d" | "90d" | "ytd";

const DATE_RANGE_OPTIONS: Array<{ id: DateRangeFilter; label: string }> = [
  { id: "all", label: "All time" },
  { id: "30d", label: "Last 30d" },
  { id: "90d", label: "Last 90d" },
  { id: "ytd", label: "YTD" },
];

function matchesDateRange(anchor: Date | null, f: DateRangeFilter, nowMs: number): boolean {
  if (f === "all") return true;
  if (!anchor) return false;
  const ageMs = nowMs - anchor.getTime();
  if (f === "30d") return ageMs <= 30 * 86_400_000;
  if (f === "90d") return ageMs <= 90 * 86_400_000;
  // YTD
  const now = new Date(nowMs);
  const jan1 = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  return anchor >= jan1;
}

// --------------------------------------------------------------------------
// Root workspace
// --------------------------------------------------------------------------

type TabId = "inbound" | "outbound";

export function PaymentTrackingWorkspace({
  view,
}: {
  view: ContractorCrossProjectPaymentsView;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("inbound");

  return (
    <div className="apw">
      <header className="apw-head">
        <div className="apw-head-main">
          <h1 className="apw-title">Payment tracking</h1>
          <p className="apw-desc">
            Every draw and sub payment across the portfolio.
            <strong> Inbound</strong> tracks what clients owe you;
            <strong> Outbound</strong> tracks payments to subs — derived from
            lien waiver records until a sub-payment table lands.
          </p>
        </div>
      </header>

      <div style={tabBarStyle}>
        <TabButton
          active={activeTab === "inbound"}
          onClick={() => setActiveTab("inbound")}
          label="Inbound"
          count={view.inbound.totals.totalDraws}
        />
        <TabButton
          active={activeTab === "outbound"}
          onClick={() => setActiveTab("outbound")}
          label="Outbound to subs"
          count={view.outbound.totals.totalWaivers}
        />
      </div>

      {activeTab === "inbound" ? (
        <InboundTab view={view} />
      ) : (
        <OutboundTab view={view} />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button type="button" onClick={onClick} style={tabButtonStyle(active)}>
      {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>({count})</span>
    </button>
  );
}

// --------------------------------------------------------------------------
// Inbound tab
// --------------------------------------------------------------------------

function InboundTab({ view }: { view: ContractorCrossProjectPaymentsView }) {
  const { rows, totals } = view.inbound;
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<InboundStatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>("all");
  const [projectPanelOpen, setProjectPanelOpen] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (selectedProjects.size > 0 && !selectedProjects.has(r.projectId)) return false;
      if (!matchesInboundStatusFilter(r, statusFilter)) return false;
      // Use the approval-time anchor when present, else submittedAt.
      const anchor = r.reviewedAt ?? r.submittedAt;
      if (!matchesDateRange(anchor, dateFilter, view.generatedAtMs)) return false;
      return true;
    });
  }, [rows, selectedProjects, statusFilter, dateFilter, view.generatedAtMs]);

  const activeFilterCount =
    selectedProjects.size +
    (statusFilter !== "all" ? 1 : 0) +
    (dateFilter !== "all" ? 1 : 0);

  const toggleProject = (id: string) => {
    const next = new Set(selectedProjects);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProjects(next);
  };
  const clearFilters = () => {
    setSelectedProjects(new Set());
    setStatusFilter("all");
    setDateFilter("all");
  };

  return (
    <>
      <div className="apw-kpis">
        <KpiCard
          label="Pending draws"
          value={totals.totalDraws.toString()}
          meta={
            totals.totalDraws === 0 ? "No draws yet" : "Across all projects"
          }
          iconColor="purple"
        />
        <KpiCard
          label="Outstanding"
          value={formatCents(totals.totalOutstandingCents)}
          meta="Unpaid balance"
          iconColor="amber"
          alert={totals.totalOutstandingCents > 0}
        />
        <KpiCard
          label="Delinquent"
          value={totals.delinquentCount.toString()}
          meta={
            totals.delinquentCount === 0
              ? "None past 30 days"
              : `Past ${30}-day threshold`
          }
          iconColor="red"
          alert={totals.delinquentCount > 0}
        />
        <KpiCard
          label="Collected"
          value={formatCents(totals.totalPaidCents)}
          meta="Via recorded payments"
          iconColor="green"
        />
      </div>

      <section style={workspaceCardStyle}>
        <div style={filterBarStyle}>
          <ProjectMultiSelect
            options={view.projectOptions}
            selected={selectedProjects}
            onToggle={toggleProject}
            isOpen={projectPanelOpen}
            setOpen={setProjectPanelOpen}
            onClearAll={() => setSelectedProjects(new Set())}
          />
          <SingleChipGroup
            label="Status"
            options={INBOUND_STATUS_OPTIONS}
            activeId={statusFilter}
            onSelect={setStatusFilter}
          />
          <SingleChipGroup
            label="Date"
            options={DATE_RANGE_OPTIONS}
            activeId={dateFilter}
            onSelect={setDateFilter}
          />
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              style={clearLinkStyle}
            >
              Clear {activeFilterCount}{" "}
              {activeFilterCount === 1 ? "filter" : "filters"}
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState
              title={
                rows.length === 0
                  ? "No draws across the portfolio yet"
                  : "No draws match the current filters"
              }
              description={
                rows.length === 0
                  ? "Draws will appear here as soon as the first billing package is created."
                  : "Clear a filter or broaden the date range."
              }
            />
          </div>
        ) : (
          <InboundTable rows={filtered} />
        )}
      </section>
    </>
  );
}

function InboundTable({ rows }: { rows: InboundRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Project</th>
            <th style={thStyle}>Draw</th>
            <th style={thStyle}>Period</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Amount due</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Collected</th>
            <th style={thStyle}>Method</th>
            <th style={thStyle}>Aging</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = `/contractor/project/${r.projectId}/billing`;
            const outstanding = Math.max(
              0,
              r.currentPaymentDueCents - r.paidSumCents,
            );
            return (
              <tr key={r.id}>
                <td style={tdStyle}>
                  <span style={projectCellStyle}>{r.projectName}</span>
                </td>
                <td style={{ ...tdStyle, fontFamily: "var(--fm)" }}>
                  #{r.drawNumber.toString().padStart(3, "0")}
                </td>
                <td style={tdStyle}>
                  {formatDate(r.periodFrom)} – {formatDate(r.periodTo)}
                </td>
                <td style={tdStyle}>
                  <Pill color={INBOUND_STATUS_PILL[r.effectiveStatus]}>
                    {INBOUND_STATUS_LABEL[r.effectiveStatus]}
                  </Pill>
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontFamily: "var(--fm)",
                  }}
                >
                  {formatCents(outstanding)}
                  {r.paidSumCents > 0 && !r.paidAt && (
                    <div style={descStyle}>
                      of {formatCents(r.currentPaymentDueCents)}
                    </div>
                  )}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontFamily: "var(--fm)",
                    color: r.paidSumCents > 0 ? "var(--t1)" : "var(--t3)",
                  }}
                >
                  {r.paidSumCents > 0 ? formatCents(r.paidSumCents) : "—"}
                </td>
                <td style={tdStyle}>
                  {r.paymentMethod
                    ? r.paymentMethod
                    : r.paymentReferenceName
                      ? r.paymentReferenceName
                      : "—"}
                </td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  {ageLabel(r.agingDays)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <Link href={href} style={{ textDecoration: "none" }}>
                    <Button variant="secondary">View</Button>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --------------------------------------------------------------------------
// Outbound tab
// --------------------------------------------------------------------------

function OutboundTab({ view }: { view: ContractorCrossProjectPaymentsView }) {
  const { rows, totals } = view.outbound;
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<OutboundStatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateRangeFilter>("all");
  const [projectPanelOpen, setProjectPanelOpen] = useState(false);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (selectedProjects.size > 0 && !selectedProjects.has(r.projectId)) return false;
      if (statusFilter !== "all" && r.lienWaiverStatus !== statusFilter) return false;
      const anchor = r.submittedAt ?? r.requestedAt;
      if (!matchesDateRange(anchor, dateFilter, view.generatedAtMs)) return false;
      return true;
    });
  }, [rows, selectedProjects, statusFilter, dateFilter, view.generatedAtMs]);

  const activeFilterCount =
    selectedProjects.size +
    (statusFilter !== "all" ? 1 : 0) +
    (dateFilter !== "all" ? 1 : 0);

  const toggleProject = (id: string) => {
    const next = new Set(selectedProjects);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProjects(next);
  };
  const clearFilters = () => {
    setSelectedProjects(new Set());
    setStatusFilter("all");
    setDateFilter("all");
  };

  return (
    <>
      <div className="apw-kpis">
        <KpiCard
          label="Sub payments"
          value={totals.totalWaivers.toString()}
          meta="Lien waiver records"
          iconColor="blue"
        />
        <KpiCard
          label="Total paid"
          value={formatCents(totals.totalAmountCents)}
          meta="Across all draws + subs"
          iconColor="green"
        />
        <KpiCard
          label="Pending waivers"
          value={totals.pendingWaiverCount.toString()}
          meta={
            totals.pendingWaiverCount === 0
              ? "None outstanding"
              : "Requested or submitted"
          }
          iconColor="amber"
          alert={totals.pendingWaiverCount > 0}
        />
        <KpiCard
          label="Retainage held"
          value={formatCents(totals.totalRetainageHeldCents)}
          meta="Portfolio-wide"
          iconColor="purple"
        />
      </div>

      <div style={captionStyle}>
        Outbound rows are derived from lien waiver records. Each waiver
        corresponds to a payment to a sub for a draw period; amount reflects
        the waiver amount. A dedicated sub-payment table is a future schema
        step.
      </div>

      <section style={workspaceCardStyle}>
        <div style={filterBarStyle}>
          <ProjectMultiSelect
            options={view.projectOptions}
            selected={selectedProjects}
            onToggle={toggleProject}
            isOpen={projectPanelOpen}
            setOpen={setProjectPanelOpen}
            onClearAll={() => setSelectedProjects(new Set())}
          />
          <SingleChipGroup
            label="Waiver status"
            options={OUTBOUND_STATUS_OPTIONS}
            activeId={statusFilter}
            onSelect={setStatusFilter}
          />
          <SingleChipGroup
            label="Date"
            options={DATE_RANGE_OPTIONS}
            activeId={dateFilter}
            onSelect={setDateFilter}
          />
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              style={clearLinkStyle}
            >
              Clear {activeFilterCount}{" "}
              {activeFilterCount === 1 ? "filter" : "filters"}
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 24 }}>
            <EmptyState
              title={
                rows.length === 0
                  ? "No sub payments across the portfolio yet"
                  : "No sub payments match the current filters"
              }
              description={
                rows.length === 0
                  ? "Payments to subs appear here once the first lien waiver is requested on a draw."
                  : "Clear a filter or broaden the date range."
              }
            />
          </div>
        ) : (
          <OutboundTable rows={filtered} />
        )}
      </section>
    </>
  );
}

function OutboundTable({ rows }: { rows: OutboundRow[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Project</th>
            <th style={thStyle}>Sub</th>
            <th style={thStyle}>Draw</th>
            <th style={thStyle}>Waiver type</th>
            <th style={thStyle}>Status</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Amount</th>
            <th style={thStyle}>Through</th>
            <th style={thStyle}>Age</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const href = `/contractor/project/${r.projectId}/billing`;
            return (
              <tr key={r.id}>
                <td style={tdStyle}>
                  <span style={projectCellStyle}>{r.projectName}</span>
                </td>
                <td style={tdStyle}>
                  {r.subOrganizationName ?? (
                    <span style={{ color: "var(--t3)" }}>Unknown sub</span>
                  )}
                </td>
                <td style={{ ...tdStyle, fontFamily: "var(--fm)" }}>
                  #{r.drawNumber.toString().padStart(3, "0")}
                </td>
                <td style={tdStyle}>
                  {r.lienWaiverType.replace(/_/g, " ")}
                </td>
                <td style={tdStyle}>
                  <Pill
                    color={
                      OUTBOUND_STATUS_PILL[r.lienWaiverStatus] ?? "gray"
                    }
                  >
                    {OUTBOUND_STATUS_LABEL[r.lienWaiverStatus] ??
                      r.lienWaiverStatus}
                  </Pill>
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: "right",
                    fontFamily: "var(--fm)",
                  }}
                >
                  {formatCents(r.amountCents)}
                </td>
                <td style={tdStyle}>{formatDate(r.throughDate)}</td>
                <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                  {ageLabel(r.ageDays)}
                </td>
                <td style={{ ...tdStyle, textAlign: "right" }}>
                  <Link href={href} style={{ textDecoration: "none" }}>
                    <Button variant="secondary">View</Button>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// --------------------------------------------------------------------------
// Inline styles
// --------------------------------------------------------------------------

const tabBarStyle: CSSProperties = {
  display: "flex",
  gap: 4,
  padding: "0 0 0 2px",
  borderBottom: "1px solid var(--s3)",
  marginBottom: 4,
};

function tabButtonStyle(active: boolean): CSSProperties {
  return {
    padding: "12px 20px",
    background: "transparent",
    border: "none",
    borderBottom: `2px solid ${active ? "var(--ac)" : "transparent"}`,
    color: active ? "var(--t1)" : "var(--t2)",
    fontFamily: "var(--fd)",
    fontSize: 14,
    fontWeight: 680,
    letterSpacing: "-0.005em",
    cursor: "pointer",
    transition: "all var(--df) var(--e)",
    marginBottom: -1,
  };
}

const captionStyle: CSSProperties = {
  fontFamily: "var(--fb)",
  fontSize: 12,
  fontWeight: 520,
  color: "var(--t3)",
  padding: "0 4px",
  lineHeight: 1.5,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontFamily: "var(--fb)",
  fontSize: 13,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 16px",
  fontFamily: "var(--fb)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--t3)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--s3)",
  background: "var(--s0)",
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid var(--s2)",
  color: "var(--t1)",
  fontWeight: 540,
  verticalAlign: "top",
};

const projectCellStyle: CSSProperties = {
  fontFamily: "var(--fm)",
  fontSize: 12,
  fontWeight: 620,
  color: "var(--t2)",
  display: "block",
};

const descStyle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 520,
  color: "var(--t3)",
  marginTop: 2,
  lineHeight: 1.4,
};
