"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";

import { AgingBarChart } from "@/components/charts";
import type { CashflowWeek } from "@/domain/loaders/cashflow";
import type { ComplianceCell } from "@/domain/loaders/compliance-report";
import type { JobCostRow } from "@/domain/loaders/job-cost";
import type { LaborProjectRow } from "@/domain/loaders/labor-report";
import type { SchedulePerfRow } from "@/domain/loaders/schedule-performance";
import type {
  ProjectReportRow,
  ReportsView,
} from "@/domain/loaders/reports";
import { formatMoneyCentsCompact } from "@/lib/format/money";

import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowLeft,
  IconArrowUpRight,
  IconBookmark,
  IconCalculator,
  IconCalendarClock,
  IconCheckCircle2,
  IconChevronRight,
  IconClipboardCheck,
  IconClock,
  IconDollarSign,
  IconDownload,
  IconFileBarChart,
  IconFileText,
  IconGavel,
  IconHammer,
  IconHistory,
  IconLayoutDashboard,
  IconMail,
  IconMinus,
  IconMoreHorizontal,
  IconPackageCheck,
  IconPalette,
  IconPlus,
  IconReceipt,
  IconScale,
  IconSearch,
  IconShieldCheck,
  IconStar,
  IconTrendingUp,
  IconTruck,
  IconUsers,
  IconWallet,
} from "./reports-icons";


// ----------------------------------------------------------------
// Reports hub (Step 24.5). Landing catalog of 26 report surfaces
// across six categories. Nine are fully built in this pass:
// Overview, WIP, AR, Cost, Cashflow, Labor, Schedule, Compliance,
// Saved. The remaining 17 are stubbed with "coming in Step XX"
// messaging; they'll light up as their source module ships, wired
// per the notes in docs/specs/phase_4plus_build_guide.md.
//
// Visual language: hairline-first (1–1.5px strokes, low-opacity
// fills, tabular-nums), all colors routed through design tokens.
// Status tone (ok/warn/crit) uses the semantic tokens --ok/--wr/--dg
// so signal meaning doesn't re-theme with the portal accent.
// ----------------------------------------------------------------

type IconComp = ComponentType<{ size?: number }>;
type CategoryId =
  | "financial"
  | "operational"
  | "compliance"
  | "tax_legal"
  | "residential"
  | "library";

type ReportDef = {
  id: string;
  category: CategoryId;
  label: string;
  Icon: IconComp;
  desc: string;
  built: boolean;
  origin: string;
};

const CATEGORIES: Array<{
  id: CategoryId;
  label: string;
  Icon: IconComp;
  blurb: string;
}> = [
  { id: "financial", label: "Financial", Icon: IconTrendingUp, blurb: "Billing, cash, and cost performance" },
  { id: "operational", label: "Operational", Icon: IconCalendarClock, blurb: "Project health, schedule, field activity" },
  { id: "compliance", label: "Compliance", Icon: IconShieldCheck, blurb: "Documents, qualifications, and audit trail" },
  { id: "tax_legal", label: "Tax & Legal", Icon: IconScale, blurb: "Canadian tax forms and statutory ledgers" },
  { id: "residential", label: "Residential", Icon: IconPalette, blurb: "Custom-home specific surfaces" },
  { id: "library", label: "Library", Icon: IconBookmark, blurb: "Saved filter sets and scheduled deliveries" },
];

const REPORTS: ReportDef[] = [
  { id: "overview", category: "operational", label: "Portfolio Overview", Icon: IconLayoutDashboard, desc: "KPIs and aging at a glance", built: true, origin: "Step 24" },
  { id: "wip", category: "financial", label: "WIP Schedule", Icon: IconTrendingUp, desc: "Over/under billing position", built: true, origin: "Step 24.5" },
  { id: "ar", category: "financial", label: "AR Aging", Icon: IconReceipt, desc: "Unpaid invoices by age", built: true, origin: "Step 24.5" },
  { id: "cost", category: "financial", label: "Job Cost", Icon: IconCalculator, desc: "Budget vs committed vs actual vs projected", built: true, origin: "Step 24.5" },
  { id: "cashflow", category: "financial", label: "Cashflow Projection", Icon: IconWallet, desc: "12-week inflow, outflow, and balance forecast", built: true, origin: "Step 24.5" },
  { id: "payments", category: "financial", label: "Payment Tracking", Icon: IconDollarSign, desc: "Inbound draws and outbound sub payments", built: true, origin: "Step 38" },
  { id: "labor", category: "operational", label: "Labor & Productivity", Icon: IconUsers, desc: "Hours and labor cost by project and trade", built: true, origin: "Step 24.5" },
  { id: "schedule", category: "operational", label: "Schedule Performance", Icon: IconCalendarClock, desc: "SPI and planned-vs-actual timeline", built: true, origin: "Step 24.5" },
  { id: "daily-logs", category: "operational", label: "Daily Logs Rollup", Icon: IconFileBarChart, desc: "Cross-project daily log activity", built: false, origin: "Phase 4B" },
  { id: "weekly-reports", category: "operational", label: "Weekly Reports", Icon: IconFileText, desc: "Aggregated weekly progress reports", built: true, origin: "Step 39" },
  { id: "safety", category: "operational", label: "Safety Forms Summary", Icon: IconShieldCheck, desc: "Toolbox talks, JHAs, incidents", built: true, origin: "Step 52" },
  { id: "time", category: "operational", label: "Time Tracking Rollup", Icon: IconClock, desc: "Sub hours by project and crew", built: true, origin: "Step 53" },
  { id: "co-log", category: "operational", label: "Change Order Log", Icon: IconHammer, desc: "All COs with status and aging", built: false, origin: "Phase 4B" },
  { id: "rfi-log", category: "operational", label: "RFI Log", Icon: IconFileText, desc: "All RFIs with turnaround times", built: false, origin: "Phase 4B" },
  { id: "submittal-log", category: "operational", label: "Submittal Log", Icon: IconPackageCheck, desc: "Submittal status and reviewer activity", built: false, origin: "Step 20" },
  { id: "procurement", category: "operational", label: "Procurement / POs", Icon: IconTruck, desc: "POs by vendor, status, and aging", built: true, origin: "Step 41" },
  { id: "inspections", category: "operational", label: "Inspections Summary", Icon: IconClipboardCheck, desc: "QA/QC pass-fail trends", built: true, origin: "Step 45" },
  { id: "closeout", category: "operational", label: "Closeout Matrix", Icon: IconPackageCheck, desc: "Closeout completion per project", built: true, origin: "Step 48" },
  { id: "compliance", category: "compliance", label: "Compliance", Icon: IconShieldCheck, desc: "Expiring documents and sub matrix", built: true, origin: "Step 24.5" },
  { id: "prequal", category: "compliance", label: "Subcontractor Prequalification", Icon: IconCheckCircle2, desc: "Qualification status across subs", built: true, origin: "Step 49" },
  { id: "audit", category: "compliance", label: "Audit Log", Icon: IconHistory, desc: "System event history with filters", built: false, origin: "Phase 8-lite" },
  { id: "lien-waivers", category: "compliance", label: "Lien Waiver Log", Icon: IconFileText, desc: "Waiver status per draw and sub", built: true, origin: "Step 40" },
  { id: "t5018", category: "tax_legal", label: "T5018 Tax Slips", Icon: IconScale, desc: "Annual CRA slip generator", built: false, origin: "Step 67" },
  { id: "holdback", category: "tax_legal", label: "Holdback Ledger", Icon: IconGavel, desc: "Ontario Construction Act tracking", built: false, origin: "Step 68" },
  { id: "allowances", category: "residential", label: "Allowance Balance", Icon: IconPalette, desc: "Running balance across allowances", built: false, origin: "Step 74" },
  { id: "saved", category: "library", label: "Saved Reports", Icon: IconBookmark, desc: "Named filter sets and scheduled deliveries", built: true, origin: "Step 24.5" },
];

// ----------------------------------------------------------------
// Formatting helpers
// ----------------------------------------------------------------

function fmt(n: number): string {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`;
  return `${sign}$${abs}`;
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function fmtSigned(n: number): string {
  if (n === 0) return "—";
  const abs = Math.abs(n);
  const prefix = n >= 0 ? "+" : "-";
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${prefix}$${Math.round(abs / 1_000)}K`;
  return `${prefix}$${abs}`;
}

function cx(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

// ----------------------------------------------------------------
// Root component
// ----------------------------------------------------------------

export function ReportsWorkspace({ view }: { view: ReportsView }) {
  // Deep link via ?id=<tile>. Lets sidebar entries in `portal-nav.ts` open
  // a specific tile (e.g. /contractor/reports?id=time) without forcing the
  // user to scan the catalog grid. Read once on mount; subsequent
  // navigation goes through the local openReport state.
  const [reportId, setReportId] = useState<string>(() => {
    if (typeof window === "undefined") return "landing";
    const id = new URLSearchParams(window.location.search).get("id");
    return id && REPORTS.some((r) => r.id === id && r.built) ? id : "landing";
  });
  const [starred, setStarred] = useState<Set<string>>(
    () => new Set(["wip", "ar", "cashflow"]),
  );
  const [recent, setRecent] = useState<string[]>([
    "cost",
    "compliance",
    "labor",
  ]);
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  const openReport = (id: string) => {
    setRecent((prev) => [id, ...prev.filter((r) => r !== id)].slice(0, 6));
    setReportId(id);
    setQuery("");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  const goLanding = () => {
    setReportId("landing");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };
  const toggleStar = (id: string) => {
    setStarred((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export/reports", { method: "GET" });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reports-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const [updatedLabel, setUpdatedLabel] = useState("");
  useEffect(() => {
    setUpdatedLabel(new Date(view.generatedAtIso).toLocaleString());
  }, [view.generatedAtIso]);

  return (
    <main className="rpt-hub">
      {reportId === "landing" ? (
        <LandingHub
          view={view}
          updatedLabel={updatedLabel}
          starred={starred}
          recent={recent}
          query={query}
          setQuery={setQuery}
          openReport={openReport}
          toggleStar={toggleStar}
          onExport={onExport}
          exporting={exporting}
        />
      ) : (
        <ReportView
          reportId={reportId}
          view={view}
          starred={starred}
          toggleStar={toggleStar}
          goLanding={goLanding}
          openReport={openReport}
          onExport={onExport}
          exporting={exporting}
        />
      )}
    </main>
  );
}

// ----------------------------------------------------------------
// Landing hub
// ----------------------------------------------------------------

function LandingHub({
  view,
  updatedLabel,
  starred,
  recent,
  query,
  setQuery,
  openReport,
  toggleStar,
  onExport,
  exporting,
}: {
  view: ReportsView;
  updatedLabel: string;
  starred: Set<string>;
  recent: string[];
  query: string;
  setQuery: (q: string) => void;
  openReport: (id: string) => void;
  toggleStar: (id: string) => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const filtered = useMemo(() => {
    if (!query.trim()) return null;
    const q = query.toLowerCase();
    return REPORTS.filter(
      (r) =>
        r.label.toLowerCase().includes(q) ||
        r.desc.toLowerCase().includes(q) ||
        r.category.includes(q),
    );
  }, [query]);

  const starredReports = REPORTS.filter((r) => starred.has(r.id));
  const recentReports = recent
    .map((id) => REPORTS.find((r) => r.id === id))
    .filter((r): r is ReportDef => Boolean(r));
  const reportsByCategory = CATEGORIES.map((c) => ({
    ...c,
    reports: REPORTS.filter((r) => r.category === c.id && r.id !== "saved"),
  }));

  const projectCount = view.projects.length;

  return (
    <>
      <header className="rpt-hub-hdr">
        <div>
          <div className="rpt-eyebrow">
            {view.context.organization.name} · {projectCount} project{projectCount === 1 ? "" : "s"}
          </div>
          <h1>Reports</h1>
          <div className="rpt-sub">Data as of {updatedLabel}</div>
        </div>
        <div className="rpt-hub-hdr-actions">
          <button type="button" className="rpt-btn" onClick={() => openReport("saved")}>
            <IconPlus size={13} /> New saved report
          </button>
          <button
            type="button"
            className="rpt-btn primary"
            onClick={onExport}
            disabled={exporting}
          >
            <IconDownload size={13} />{" "}
            {exporting ? "Exporting…" : "Export portfolio PDF"}
          </button>
        </div>
      </header>

      <div className="rpt-hub-search">
        <IconSearch size={15} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reports — try 'wip', 'cash', 'compliance', 't5018'…"
        />
      </div>

      {filtered ? (
        <section>
          <SectionLabel>Results · {filtered.length}</SectionLabel>
          {filtered.length === 0 ? (
            <div className="rpt-hub-empty">No reports match “{query}”</div>
          ) : (
            <div className="rpt-tile-grid three">
              {filtered.map((r) => (
                <ReportTile
                  key={r.id}
                  report={r}
                  starred={starred.has(r.id)}
                  onOpen={() => openReport(r.id)}
                  onStar={() => toggleStar(r.id)}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          {starredReports.length > 0 && (
            <section className="rpt-hub-section">
              <SectionLabel Icon={IconStar}>Starred</SectionLabel>
              <div className="rpt-tile-grid four">
                {starredReports.map((r) => (
                  <ReportTile
                    key={r.id}
                    report={r}
                    starred
                    compact
                    onOpen={() => openReport(r.id)}
                    onStar={() => toggleStar(r.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {recentReports.length > 0 && (
            <section className="rpt-hub-section">
              <SectionLabel Icon={IconHistory}>Recently viewed</SectionLabel>
              <div className="rpt-tile-grid four">
                {recentReports.slice(0, 4).map((r) => (
                  <ReportTile
                    key={r.id}
                    report={r}
                    starred={starred.has(r.id)}
                    compact
                    onOpen={() => openReport(r.id)}
                    onStar={() => toggleStar(r.id)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="rpt-hub-section">
            <SectionLabel>All reports</SectionLabel>
            <div className="rpt-cat-grid">
              {reportsByCategory.map((c) => (
                <CategoryCard
                  key={c.id}
                  category={c}
                  starred={starred}
                  onOpen={openReport}
                  onStar={toggleStar}
                />
              ))}
            </div>
          </section>

          {(view.savedReports?.rows.length ?? 0) > 0 && (
            <section className="rpt-hub-section">
              <SectionLabel>
                Saved &amp; scheduled · {view.savedReports!.totals.total}
              </SectionLabel>
              <div className="rpt-saved-preview">
                <table className="rpt-saved-tbl">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Schedule</th>
                      <th>Last run</th>
                      <th className="rpt-right">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.savedReports!.rows.slice(0, 4).map((r) => (
                      <tr key={r.id} onClick={() => openReport("saved")}>
                        <td>
                          <div className="rpt-saved-name">
                            <IconBookmark size={12} />
                            {r.name}
                          </div>
                        </td>
                        <td className="rpt-t3">
                          {labelForReportType(r.reportType)}
                        </td>
                        <td className="rpt-t3">
                          {r.scheduleLabel ?? "On-demand"}
                        </td>
                        <td className="rpt-t3 rpt-num">
                          {formatLastRun(r.lastRunAt)}
                        </td>
                        <td className="rpt-t3 rpt-right">{r.ownerName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  className="rpt-saved-more"
                  onClick={() => openReport("saved")}
                >
                  View all saved reports <IconChevronRight size={12} />
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}

function SectionLabel({
  children,
  Icon,
}: {
  children: React.ReactNode;
  Icon?: IconComp;
}) {
  return (
    <div className="rpt-section-label">
      {Icon ? <Icon size={12} /> : null}
      <span>{children}</span>
    </div>
  );
}

function ReportTile({
  report,
  starred,
  compact,
  onOpen,
  onStar,
}: {
  report: ReportDef;
  starred: boolean;
  compact?: boolean;
  onOpen: () => void;
  onStar: () => void;
}) {
  const Icon = report.Icon;
  return (
    <div
      className={cx("rpt-tile", compact && "compact", !report.built && "stub")}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className={cx("rpt-tile-icon", !report.built && "stub")}>
        <Icon size={15} />
      </div>
      <div className="rpt-tile-body">
        <div className="rpt-tile-label">{report.label}</div>
        {!compact && <div className="rpt-tile-desc">{report.desc}</div>}
        {!report.built && (
          <span className="rpt-origin-pill">{report.origin}</span>
        )}
      </div>
      <button
        type="button"
        className={cx("rpt-tile-star", starred && "on")}
        onClick={(e) => {
          e.stopPropagation();
          onStar();
        }}
        aria-label={starred ? "Unstar report" : "Star report"}
      >
        <IconStar size={13} fill={starred ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

function CategoryCard({
  category,
  starred,
  onOpen,
  onStar,
}: {
  category: {
    id: CategoryId;
    label: string;
    Icon: IconComp;
    blurb: string;
    reports: ReportDef[];
  };
  starred: Set<string>;
  onOpen: (id: string) => void;
  onStar: (id: string) => void;
}) {
  const Icon = category.Icon;
  const builtCount = category.reports.filter((r) => r.built).length;
  return (
    <div className="rpt-cat">
      <div className="rpt-cat-hdr">
        <div className="rpt-cat-icon">
          <Icon size={16} />
        </div>
        <div className="rpt-cat-meta">
          <div className="rpt-cat-title">{category.label}</div>
          <div className="rpt-cat-blurb">{category.blurb}</div>
        </div>
        <div className="rpt-cat-count">
          {builtCount}/{category.reports.length}
        </div>
      </div>
      <div className="rpt-cat-list">
        {category.reports.map((r) => {
          const isStarred = starred.has(r.id);
          const RIcon = r.Icon;
          return (
            <div
              key={r.id}
              className={cx("rpt-cat-row", !r.built && "stub")}
              onClick={() => onOpen(r.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(r.id);
                }
              }}
            >
              <RIcon size={13} />
              <div className="rpt-cat-row-body">
                <div className="rpt-cat-row-label">{r.label}</div>
                <div className="rpt-cat-row-desc">{r.desc}</div>
              </div>
              {!r.built && <span className="rpt-origin-pill">{r.origin}</span>}
              <button
                type="button"
                className={cx("rpt-cat-row-star", isStarred && "on")}
                onClick={(e) => {
                  e.stopPropagation();
                  onStar(r.id);
                }}
                aria-label={isStarred ? "Unstar report" : "Star report"}
              >
                <IconStar size={11} fill={isStarred ? "currentColor" : "none"} />
              </button>
              <IconChevronRight size={13} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Report view shell
// ----------------------------------------------------------------

function ReportView({
  reportId,
  view,
  starred,
  toggleStar,
  goLanding,
  openReport,
  onExport,
  exporting,
}: {
  reportId: string;
  view: ReportsView;
  starred: Set<string>;
  toggleStar: (id: string) => void;
  goLanding: () => void;
  openReport: (id: string) => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const report = REPORTS.find((r) => r.id === reportId);
  if (!report) return null;
  const siblings = REPORTS.filter((r) => r.category === report.category);
  const isStarred = starred.has(reportId);
  const categoryLabel = CATEGORIES.find((c) => c.id === report.category)?.label;

  return (
    <>
      <div className="rpt-view-nav">
        <button type="button" className="rpt-link-btn" onClick={goLanding}>
          <IconArrowLeft size={14} /> All reports
        </button>
        <div className="rpt-view-nav-actions">
          <button
            type="button"
            className={cx("rpt-icon-btn", isStarred && "on")}
            onClick={() => toggleStar(reportId)}
            aria-label={isStarred ? "Unstar report" : "Star report"}
          >
            <IconStar size={15} fill={isStarred ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            className="rpt-btn"
            onClick={onExport}
            disabled={exporting}
          >
            <IconDownload size={13} /> {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      <header className="rpt-view-hdr">
        <div className="rpt-eyebrow">
          {categoryLabel} · {view.context.organization.name}
        </div>
        <h1>{report.label}</h1>
        <div className="rpt-sub">{report.desc}</div>
      </header>

      {siblings.length > 1 && (
        <div className="rpt-tabs">
          {siblings.map((s) => (
            <button
              key={s.id}
              type="button"
              className={cx(
                "rpt-tab",
                s.id === reportId && "active",
                !s.built && "stub",
              )}
              onClick={() => openReport(s.id)}
            >
              {s.label}
              {!s.built && (
                <span className="rpt-tab-origin">· {s.origin}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {report.built ? (
        renderReport(reportId, view)
      ) : (
        <UpcomingStub report={report} />
      )}
    </>
  );
}

function UpcomingStub({ report }: { report: ReportDef }) {
  return (
    <div className="rpt-stub">
      <div className="rpt-stub-icon">
        <IconClock size={22} />
      </div>
      <div className="rpt-eyebrow">Coming in {report.origin}</div>
      <div className="rpt-stub-label">{report.label}</div>
      <div className="rpt-stub-desc">{report.desc}</div>
      <div className="rpt-stub-foot">
        Scheduled in the Phase 4+ build guide — see{" "}
        <code>docs/specs/phase_4plus_build_guide.md</code>
      </div>
    </div>
  );
}

function renderReport(id: string, view: ReportsView) {
  switch (id) {
    case "overview":
      return <OverviewReport view={view} />;
    case "wip":
      return <WIPReport view={view} />;
    case "ar":
      return <ARReport view={view} />;
    case "cost":
      return <CostReport view={view} />;
    case "cashflow":
      return <CashflowReport view={view} />;
    case "payments":
      return <PaymentTrackingReport view={view} />;
    case "weekly-reports":
      return <WeeklyReportsAggregateReport view={view} />;
    case "lien-waivers":
      return <LienWaiverLogReportView view={view} />;
    case "procurement":
      return <ProcurementReportView view={view} />;
    case "labor":
      return <LaborReport view={view} />;
    case "schedule":
      return <ScheduleReport view={view} />;
    case "compliance":
      return <ComplianceReport view={view} />;
    case "safety":
      return <SafetyReport view={view} />;
    case "time":
      return <TimeRollupReport view={view} />;
    case "saved":
      return <SavedReportsView view={view} />;
    default:
      return null;
  }
}

// ----------------------------------------------------------------
// Shared primitives
// ----------------------------------------------------------------

function Card({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cx("rpt-card", !padded && "flush", className)}>
      {children}
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="rpt-sh">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {right}
    </div>
  );
}

type KpiTone = "neutral" | "ok" | "warn" | "crit";

function KPI({
  label,
  value,
  sub,
  trend,
  trendData,
  tone = "neutral",
  Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  trendData?: number[];
  tone?: KpiTone;
  Icon?: IconComp;
}) {
  const trendDir: "up" | "down" | "flat" =
    trend == null ? "flat" : trend > 0 ? "up" : trend < 0 ? "down" : "flat";
  const TrendIcon =
    trendDir === "up"
      ? IconArrowUpRight
      : trendDir === "down"
        ? IconArrowDownRight
        : IconMinus;
  return (
    <div className={cx("rpt-k", `tone-${tone}`)}>
      <div className="rpt-k-head">
        <div className="rpt-k-label">
          {Icon ? <Icon size={12} /> : null}
          <span>{label}</span>
        </div>
        {trend !== undefined && (
          <div className={cx("rpt-k-trend", `dir-${trendDir}`)}>
            <TrendIcon size={10} />
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div className="rpt-k-body">
        <div>
          <div className="rpt-k-value">{value}</div>
          {sub ? <div className="rpt-k-sub">{sub}</div> : null}
        </div>
        {trendData ? <Sparkline data={trendData} tone={tone} /> : null}
      </div>
    </div>
  );
}

function Sparkline({
  data,
  tone = "neutral",
  width = 80,
  height = 28,
}: {
  data: number[];
  tone?: KpiTone;
  width?: number;
  height?: number;
}) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data
    .map(
      (v, i) =>
        `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`,
    )
    .join(" ");
  const stroke = toneStroke(tone);
  return (
    <svg
      width={width}
      height={height}
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function toneStroke(tone: KpiTone): string {
  switch (tone) {
    case "ok":
      return "var(--ok)";
    case "warn":
      return "var(--wr)";
    case "crit":
      return "var(--dg)";
    default:
      return "var(--ac)";
  }
}

// ----------------------------------------------------------------
// Overview — wraps the live Step 24 dashboard content (real data)
// ----------------------------------------------------------------

function OverviewReport({ view }: { view: ReportsView }) {
  const { kpis, projects, aging } = view;
  const riskHot = kpis.complianceAlerts > 0 || kpis.scheduleAtRisk > 0;

  return (
    <div className="rpt-overview">
      <section className="rpt-kpi-groups">
        <KpiGroup label="Financial">
          <KpiCard label="Contract value" value={formatCents(kpis.totalContractCents)} />
          <KpiCard label="Billed" value={formatCents(kpis.totalBilledCents)} />
          <KpiCard label="Unpaid" value={formatCents(kpis.totalUnpaidCents)} />
        </KpiGroup>
        <KpiGroup label="Operational">
          <KpiCard label="Active projects" value={String(kpis.activeProjects)} />
          <KpiCard
            label="Open RFIs"
            value={String(kpis.openRfis)}
            linkHref="/contractor/rfis"
          />
          <KpiCard
            label="Open change orders"
            value={String(kpis.openChangeOrders)}
            linkHref="/contractor/change-orders"
          />
        </KpiGroup>
        <KpiGroup label="Risk" tone={riskHot ? "risk" : "neutral"}>
          <KpiCard
            label="Compliance alerts"
            value={String(kpis.complianceAlerts)}
            tone={kpis.complianceAlerts > 0 ? "risk" : undefined}
            linkHref="/contractor/compliance"
          />
          <KpiCard
            label="Schedule at risk"
            value={String(kpis.scheduleAtRisk)}
            tone={kpis.scheduleAtRisk > 0 ? "risk" : undefined}
          />
        </KpiGroup>
      </section>

      <section className="rpt-projects">
        <h2>Projects</h2>
        {projects.length === 0 ? (
          <div className="rpt-empty">
            No projects yet. Create a project from the dashboard to start
            populating reports.
          </div>
        ) : (
          <ProjectTable projects={projects} />
        )}
      </section>

      <section className="rpt-aging">
        <h2>Open items aging</h2>
        <p className="rpt-section-sub">
          How long open RFIs and change orders have been sitting. 30+ days is
          tinted — anything older than a month is a real operational signal,
          not just a data point.
        </p>
        <AgingBarChart data={aging} />
      </section>
    </div>
  );
}

const formatCents = (c: number) => formatMoneyCentsCompact(c);

function formatPercentNullable(pct: number | null): string {
  if (pct == null) return "—";
  return `${pct}%`;
}

function formatVariance(days: number | null): {
  label: string;
  tone: "ahead" | "onTrack" | "slip" | "neutral";
} {
  if (days == null) return { label: "—", tone: "neutral" };
  if (days < -1) return { label: `${Math.abs(days)}d ahead`, tone: "ahead" };
  if (days <= 1) return { label: "On track", tone: "onTrack" };
  return { label: `${days}d behind`, tone: "slip" };
}

function KpiGroup({
  label,
  children,
  tone = "neutral",
}: {
  label: string;
  children: React.ReactNode;
  tone?: "neutral" | "risk";
}) {
  return (
    <div className={cx("rpt-kpi-group", tone === "risk" && "risk")}>
      <div className="rpt-kpi-group-label">{label}</div>
      <div className="rpt-kpi-group-cards">{children}</div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
  linkHref,
}: {
  label: string;
  value: string;
  tone?: "risk";
  linkHref?: string;
}) {
  const content = (
    <div className={cx("rpt-kpi-card", tone === "risk" && "risk")}>
      <div className="rpt-kpi-value">{value}</div>
      <div className="rpt-kpi-label">{label}</div>
    </div>
  );
  if (linkHref) {
    return (
      <a className="rpt-kpi-link" href={linkHref}>
        {content}
      </a>
    );
  }
  return content;
}

function ProjectTable({ projects }: { projects: ProjectReportRow[] }) {
  return (
    <div className="rpt-tbl-wrap">
      <table className="rpt-tbl">
        <thead>
          <tr>
            <th>Project</th>
            <th>Status</th>
            <th className="rpt-col-wide">Contract</th>
            <th>Billed</th>
            <th>% complete</th>
            <th className="rpt-col-wide">Variance</th>
            <th className="rpt-col-wide">Compliance</th>
            <th>Open items</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProjectRow({ project: p }: { project: ProjectReportRow }) {
  const variance = formatVariance(p.scheduleVarianceDays);
  return (
    <tr
      onClick={() => {
        window.location.href = `/contractor/project/${p.id}`;
      }}
    >
      <td>
        <div className="rpt-tbl-project">
          <span className="rpt-tbl-project-name">{p.name}</span>
          {p.phase ? (
            <span className="rpt-tbl-project-phase">{p.phase}</span>
          ) : null}
        </div>
      </td>
      <td>
        <span className={`rpt-pill status status-${p.status}`}>{p.status}</span>
      </td>
      <td className="rpt-col-wide">{formatCents(p.contractValueCents)}</td>
      <td>{formatCents(p.billedCents)}</td>
      <td
        title={
          p.percentCompleteMode === "unweighted"
            ? "Unweighted — duration weighting kicks in once milestones have start dates"
            : "Duration-weighted"
        }
      >
        <div className="rpt-pct-wrap">
          <div className="rpt-pct-bar" aria-hidden>
            <div
              className="rpt-pct-fill"
              style={{
                width:
                  p.percentComplete != null ? `${p.percentComplete}%` : "0%",
              }}
            />
          </div>
          <span className="rpt-pct-label">
            {formatPercentNullable(p.percentComplete)}
          </span>
        </div>
      </td>
      <td className="rpt-col-wide">
        <span className={`rpt-pill variance variance-${variance.tone}`}>
          {variance.label}
        </span>
      </td>
      <td className="rpt-col-wide">
        <span className={`rpt-pill compliance compliance-${p.complianceStatus}`}>
          {p.complianceStatus}
        </span>
      </td>
      <td>
        <span className="rpt-open-count">{p.openItemsCount}</span>
      </td>
    </tr>
  );
}

// ----------------------------------------------------------------
// WIP Schedule
// ----------------------------------------------------------------

function WIPReport({ view }: { view: ReportsView }) {
  const wip = view.wip;
  if (!wip || wip.rows.length === 0) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        {wip
          ? "No active projects yet — add one to populate the WIP schedule."
          : "WIP schedule unavailable."}
      </div>
    );
  }

  const { rows, totals } = wip;
  const earnedOfContractPct =
    totals.contractWithCoCents > 0
      ? totals.earnedCents / totals.contractWithCoCents
      : 0;

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Contract + COs"
          value={fmt(totals.contractWithCoCents / 100)}
          Icon={IconWallet}
        />
        <KPI
          label="Earned Revenue"
          value={fmt(totals.earnedCents / 100)}
          sub={`${fmtPct(earnedOfContractPct)} of contract`}
          Icon={IconTrendingUp}
        />
        <KPI
          label="Net Over/Under"
          value={fmtSigned(totals.overUnderCents / 100)}
          sub={
            totals.overUnderCents > 0
              ? "Underbilled — catch up"
              : totals.overUnderCents < 0
                ? "Overbilled — healthy"
                : "On pace"
          }
          tone={
            totals.overUnderCents > 0
              ? "warn"
              : totals.overUnderCents < 0
                ? "ok"
                : "neutral"
          }
          Icon={
            totals.overUnderCents > 0 ? IconAlertTriangle : IconCheckCircle2
          }
        />
        <KPI
          label="Backlog"
          value={fmt(totals.backlogCents / 100)}
          sub="Contract remaining"
          Icon={IconFileText}
        />
      </div>

      <Card padded={false}>
        <div className="rpt-tbl-scroll">
          <table className="rpt-data-tbl">
            <thead>
              <tr>
                <th>Project</th>
                <th className="rpt-right">Contract + COs</th>
                <th className="rpt-right">Cost to Date</th>
                <th className="rpt-right">% Complete</th>
                <th className="rpt-right">Earned</th>
                <th className="rpt-right">Billed</th>
                <th className="rpt-right">Over / Under</th>
                <th className="rpt-right">Backlog</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.projectId}>
                  <td>
                    <div className="rpt-tbl-project-name">{r.projectName}</div>
                    <div className="rpt-tbl-project-phase">
                      {r.phase ?? "—"}
                      {r.clientName ? ` · ${r.clientName}` : ""}
                    </div>
                  </td>
                  <td className="rpt-right rpt-num">
                    {fmt(r.contractWithCoCents / 100)}
                  </td>
                  <td className="rpt-right rpt-num rpt-t2">
                    {fmt(r.costToDateCents / 100)}
                  </td>
                  <td className="rpt-right">
                    <div className="rpt-mini-pct">
                      <div className="rpt-mini-pct-bar">
                        <div
                          className="rpt-mini-pct-fill"
                          style={{
                            width: `${Math.min(100, r.percentComplete * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="rpt-num">
                        {fmtPct(r.percentComplete)}
                      </span>
                    </div>
                  </td>
                  <td className="rpt-right rpt-num">
                    {fmt(r.earnedCents / 100)}
                  </td>
                  <td className="rpt-right rpt-num">
                    {fmt(r.billedCents / 100)}
                  </td>
                  <td
                    className={cx(
                      "rpt-right rpt-num rpt-strong",
                      r.overUnderCents > 0
                        ? "tone-warn"
                        : r.overUnderCents < 0
                          ? "tone-ok"
                          : undefined,
                    )}
                  >
                    {fmtSigned(r.overUnderCents / 100)}
                  </td>
                  <td className="rpt-right rpt-num rpt-t2">
                    {fmt(r.backlogCents / 100)}
                  </td>
                </tr>
              ))}
              <tr className="rpt-tot">
                <td>Totals</td>
                <td className="rpt-right rpt-num">
                  {fmt(totals.contractWithCoCents / 100)}
                </td>
                <td className="rpt-right rpt-num">
                  {fmt(totals.costToDateCents / 100)}
                </td>
                <td className="rpt-right rpt-t3">—</td>
                <td className="rpt-right rpt-num">
                  {fmt(totals.earnedCents / 100)}
                </td>
                <td className="rpt-right rpt-num">
                  {fmt(totals.billedCents / 100)}
                </td>
                <td
                  className={cx(
                    "rpt-right rpt-num",
                    totals.overUnderCents > 0
                      ? "tone-warn"
                      : totals.overUnderCents < 0
                        ? "tone-ok"
                        : undefined,
                  )}
                >
                  {fmtSigned(totals.overUnderCents / 100)}
                </td>
                <td className="rpt-right rpt-num">
                  {fmt(totals.backlogCents / 100)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------
// AR Aging
// ----------------------------------------------------------------

function ARReport({ view }: { view: ReportsView }) {
  const ar = view.arAging;
  if (!ar || ar.totalCents === 0) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        {ar
          ? "No outstanding AR — every submitted draw has been paid in full."
          : "AR aging unavailable."}
      </div>
    );
  }

  const totalsByBucket = ar.totalsByBucket;
  const total = ar.totalCents;
  const buckets: Array<{ label: string; value: number; tone: KpiTone }> = [
    { label: "Current", value: totalsByBucket.current, tone: "neutral" },
    { label: "1–30 days", value: totalsByBucket.d1_30, tone: "neutral" },
    { label: "31–60 days", value: totalsByBucket.d31_60, tone: "warn" },
    { label: "61–90 days", value: totalsByBucket.d61_90, tone: "crit" },
    { label: "90+ days", value: totalsByBucket.d90p, tone: "crit" },
  ];
  const over60 = totalsByBucket.d61_90 + totalsByBucket.d90p;
  const trendFinal = ar.trendCents[ar.trendCents.length - 1] ?? 0;
  const trendStart = ar.trendCents[0] ?? 0;
  const trendDelta =
    trendStart > 0 ? (trendFinal - trendStart) / trendStart : 0;
  const deltaTone: KpiTone = trendDelta > 0 ? "warn" : "ok";

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Total AR"
          value={fmt(total / 100)}
          Icon={IconReceipt}
          trendData={ar.trendCents}
        />
        <KPI
          label="Current"
          value={fmt(totalsByBucket.current / 100)}
          sub={`${fmtPct(totalsByBucket.current / total)} of AR`}
          tone="ok"
          Icon={IconCheckCircle2}
        />
        <KPI
          label="Past Due"
          value={fmt(ar.pastDueCents / 100)}
          sub={`${fmtPct(ar.pastDueCents / total)} of AR`}
          tone={ar.pastDueCents > 0 ? "warn" : "ok"}
          Icon={IconClock}
        />
        <KPI
          label="60+ Days"
          value={fmt(over60 / 100)}
          sub={over60 > 0 ? "Escalate" : "None"}
          tone={over60 > 0 ? "crit" : "ok"}
          Icon={IconAlertTriangle}
        />
      </div>

      <div className="rpt-row two-one">
        <Card>
          <SectionHeading
            title="Aging distribution"
            subtitle="Dollar value outstanding in each age bucket. Tonal severity increases with age."
          />
          <ARHairlineBuckets buckets={buckets} />
        </Card>
        <Card>
          <SectionHeading title="AR trend" subtitle="Last 8 weeks." />
          <div className="rpt-trend-canvas">
            <TrendArea data={ar.trendCents} />
          </div>
          <div className="rpt-trend-foot">
            <div>
              <div className="rpt-eyebrow">Latest</div>
              <div className="rpt-trend-value">{fmt(trendFinal / 100)}</div>
            </div>
            <div className="rpt-right">
              <div className="rpt-eyebrow">8wk change</div>
              <div className={cx("rpt-trend-delta", `tone-${deltaTone}`)}>
                {trendDelta === 0
                  ? "—"
                  : `${trendDelta > 0 ? "+" : ""}${fmtPct(trendDelta)}`}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="rpt-card-hdr">
          <div className="rpt-eyebrow">By client</div>
          <div className="rpt-t3">
            {ar.rows.length}{" "}
            {ar.rows.length === 1 ? "client" : "clients"} with outstanding AR
          </div>
        </div>
        <table className="rpt-data-tbl">
          <thead>
            <tr>
              <th>Client</th>
              <th className="rpt-right">Current</th>
              <th className="rpt-right">1–30</th>
              <th className="rpt-right">31–60</th>
              <th className="rpt-right">61–90</th>
              <th className="rpt-right">90+</th>
              <th className="rpt-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {ar.rows.map((r) => (
              <tr key={r.clientOrganizationId}>
                <td className="rpt-strong">{r.clientName}</td>
                <td className="rpt-right rpt-num rpt-t2">
                  {fmt(r.current / 100)}
                </td>
                <td className="rpt-right rpt-num rpt-t2">
                  {fmt(r.d1_30 / 100)}
                </td>
                <td
                  className={cx(
                    "rpt-right rpt-num",
                    r.d31_60 > 0 && "tone-warn rpt-strong",
                  )}
                >
                  {fmt(r.d31_60 / 100)}
                </td>
                <td
                  className={cx(
                    "rpt-right rpt-num",
                    r.d61_90 > 0 && "tone-crit rpt-strong",
                  )}
                >
                  {fmt(r.d61_90 / 100)}
                </td>
                <td
                  className={cx(
                    "rpt-right rpt-num",
                    r.d90p > 0 && "tone-crit rpt-strong",
                  )}
                >
                  {fmt(r.d90p / 100)}
                </td>
                <td className="rpt-right rpt-num rpt-strong">
                  {fmt(r.totalCents / 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ARHairlineBuckets({
  buckets,
}: {
  buckets: Array<{ label: string; value: number; tone: KpiTone }>;
}) {
  const max = Math.max(...buckets.map((b) => b.value)) || 1;
  return (
    <div className="rpt-ar-buckets">
      {buckets.map((b) => {
        const pct = (b.value / max) * 100;
        return (
          <div key={b.label} className="rpt-ar-bucket">
            <div className="rpt-ar-bucket-label">{b.label}</div>
            <div className="rpt-ar-bucket-track">
              <div
                className={cx("rpt-ar-bucket-fill", `tone-${b.tone}`)}
                style={{
                  width: `${Math.max(pct, b.value > 0 ? 2 : 0)}%`,
                }}
              />
            </div>
            <div className="rpt-ar-bucket-value rpt-num">{fmt(b.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

function TrendArea({ data }: { data: number[] }) {
  const W = 200;
  const H = 80;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = W / (data.length - 1);
  const pts = data.map(
    (v, i) => [i * step, 6 + (H - 12) - ((v - min) / range) * (H - 12)] as const,
  );
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `M 0,${H} L ${line.split(" ").join(" L ")} L ${W},${H} Z`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="rpt-trend-svg"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="rpt-trend-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--ac)" stopOpacity="0.14" />
          <stop offset="100%" stopColor="var(--ac)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#rpt-trend-fill)" />
      <polyline
        points={line}
        fill="none"
        stroke="var(--ac)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ----------------------------------------------------------------
// Job Cost
// ----------------------------------------------------------------

function CostReport({ view }: { view: ReportsView }) {
  const jobCost = view.jobCost;
  if (!jobCost || jobCost.rows.length === 0) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        {jobCost
          ? "No cost data yet — add a budget (contract value) or issue the first PO to populate Job Cost."
          : "Job cost report unavailable."}
      </div>
    );
  }

  const { rows, totals } = jobCost;
  const totVar = totals.varianceCents;
  const totVarPct = totals.budgetCents > 0 ? totVar / totals.budgetCents : 0;

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Total Budget"
          value={fmt(totals.budgetCents / 100)}
          Icon={IconCalculator}
        />
        <KPI
          label="Committed"
          value={fmt(totals.committedCents / 100)}
          sub={
            totals.budgetCents > 0
              ? `${fmtPct(totals.committedCents / totals.budgetCents)} of budget`
              : undefined
          }
          Icon={IconFileText}
        />
        <KPI
          label="Actual Spent"
          value={fmt(totals.actualCents / 100)}
          sub={
            totals.budgetCents > 0
              ? `${fmtPct(totals.actualCents / totals.budgetCents)} of budget`
              : undefined
          }
          Icon={IconTrendingUp}
        />
        <KPI
          label="Projected Variance"
          value={fmtSigned(totVar / 100)}
          tone={totVar > 0 ? "crit" : totVar < 0 ? "ok" : "neutral"}
          sub={
            totals.budgetCents > 0
              ? `${totVar >= 0 ? "+" : ""}${(totVarPct * 100).toFixed(1)}% vs budget`
              : undefined
          }
          Icon={totVar > 0 ? IconAlertTriangle : IconCheckCircle2}
        />
      </div>

      <Card className="rpt-mb">
        <SectionHeading
          title="Budget vs Projected"
          subtitle="Hairline tracks show Actual, Committed, Budget, and Projected positions per project. The track scales to whichever is larger, so nothing overflows."
        />
        <div className="rpt-cost-stack">
          {rows.map((r) => (
            <CostTrack key={r.projectId} row={r} />
          ))}
        </div>
      </Card>

      <Card padded={false}>
        <table className="rpt-data-tbl">
          <thead>
            <tr>
              <th>Project</th>
              <th className="rpt-right">Budget</th>
              <th className="rpt-right">Committed</th>
              <th className="rpt-right">Actual</th>
              <th className="rpt-right">Projected</th>
              <th className="rpt-right">Variance</th>
              <th className="rpt-col-used">Cost Used</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.projectId}>
                <td className="rpt-strong">{r.projectName}</td>
                <td className="rpt-right rpt-num">
                  {fmt(r.budgetCents / 100)}
                </td>
                <td className="rpt-right rpt-num rpt-t2">
                  {fmt(r.committedCents / 100)}
                </td>
                <td className="rpt-right rpt-num">
                  {fmt(r.actualCents / 100)}
                </td>
                <td className="rpt-right rpt-num rpt-strong">
                  {fmt(r.projectedCents / 100)}
                </td>
                <td
                  className={cx(
                    "rpt-right rpt-num rpt-strong",
                    r.varianceCents > 0
                      ? "tone-crit"
                      : r.varianceCents < 0
                        ? "tone-ok"
                        : "rpt-t3",
                  )}
                >
                  {fmtSigned(r.varianceCents / 100)}
                </td>
                <td>
                  <div className="rpt-mini-pct">
                    <div className="rpt-mini-pct-bar">
                      <div
                        className={cx(
                          "rpt-mini-pct-fill",
                          r.costUsedPct > 0.9
                            ? "tone-crit"
                            : r.costUsedPct > 0.75
                              ? "tone-warn"
                              : "tone-ok",
                        )}
                        style={{
                          width: `${Math.min(100, r.costUsedPct * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="rpt-num rpt-t2">
                      {fmtPct(r.costUsedPct)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CostTrack({ row }: { row: JobCostRow }) {
  const scale = Math.max(row.budgetCents, row.projectedCents) * 1.08 || 1;
  const pos = (v: number) => (v / scale) * 100;
  const budgetX = pos(row.budgetCents);
  const committedX = pos(row.committedCents);
  const actualX = pos(row.actualCents);
  const projectedX = pos(row.projectedCents);
  const overrun = row.projectedCents > row.budgetCents;

  return (
    <div className="rpt-cost-track">
      <div className="rpt-cost-track-hdr">
        <div className="rpt-strong">{row.projectName}</div>
        <div
          className={cx(
            "rpt-num rpt-strong",
            row.varianceCents > 0
              ? "tone-crit"
              : row.varianceCents < 0
                ? "tone-ok"
                : "rpt-t3",
          )}
        >
          {fmtSigned(row.varianceCents / 100)}{" "}
          <span className="rpt-t3">
            ({row.varianceCents >= 0 ? "+" : ""}
            {(row.variancePct * 100).toFixed(1)}%)
          </span>
        </div>
      </div>

      <div className="rpt-cost-track-rail">
        <div className="rpt-cost-track-base" />
        <div
          className="rpt-cost-track-budget"
          style={{ left: 0, width: `${budgetX}%` }}
        />
        {overrun && (
          <div
            className="rpt-cost-track-overrun"
            style={{
              left: `${budgetX}%`,
              width: `${projectedX - budgetX}%`,
            }}
          />
        )}
        <div
          className="rpt-cost-track-committed"
          style={{ left: 0, width: `${committedX}%` }}
        />
        <div
          className="rpt-cost-track-actual"
          style={{ left: 0, width: `${actualX}%` }}
        />

        <CostMarker
          x={actualX}
          label="Actual"
          value={fmt(row.actualCents / 100)}
          tone="ac"
          position="top"
        />
        <CostMarker
          x={committedX}
          label="Committed"
          value={fmt(row.committedCents / 100)}
          tone="muted"
          position="bottom"
        />
        <CostMarker
          x={budgetX}
          label="Budget"
          value={fmt(row.budgetCents / 100)}
          tone="ink"
          position="top"
          isLine
        />
        <CostMarker
          x={projectedX}
          label="Projected"
          value={fmt(row.projectedCents / 100)}
          tone={overrun ? "crit" : "ok"}
          position="bottom"
          stack="far"
        />
      </div>
    </div>
  );
}

function CostMarker({
  x,
  label,
  value,
  tone,
  position,
  stack = "near",
  isLine,
}: {
  x: number;
  label: string;
  value: string;
  tone: "ac" | "muted" | "ink" | "ok" | "crit";
  position: "top" | "bottom";
  stack?: "near" | "far";
  isLine?: boolean;
}) {
  // Cap alignment: when a marker sits near an edge, center-anchoring its
  // label (the default `translateX(-50%)`) makes it bleed past the rail.
  // Shift to left-align near the left edge and right-align near the right.
  const capAnchor: "left" | "center" | "right" =
    x < 8 ? "left" : x > 92 ? "right" : "center";
  const capTransform =
    capAnchor === "left"
      ? "translateX(0%)"
      : capAnchor === "right"
        ? "translateX(-100%)"
        : "translateX(-50%)";
  return (
    <div
      className={cx(
        "rpt-cost-marker",
        `pos-${position}`,
        stack === "far" && "stack-far",
        `tone-${tone}`,
      )}
      style={{ left: `${x}%` }}
    >
      {isLine ? (
        <div className="rpt-cost-marker-line" />
      ) : (
        <div className="rpt-cost-marker-dot" />
      )}
      <div
        className="rpt-cost-marker-cap"
        style={{ transform: capTransform }}
      >
        <div className="rpt-cost-marker-label">{label}</div>
        <div className="rpt-cost-marker-value rpt-num">{value}</div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Cashflow Projection
// ----------------------------------------------------------------

function CashflowReport({ view }: { view: ReportsView }) {
  const projection = view.cashflow;
  if (!projection) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        Cashflow projection unavailable. The feed draws from pending draws,
        open POs, pending lien waivers, and scheduled retainage releases — if
        none of those are populated yet, check back after the first draw or PO
        is entered.
      </div>
    );
  }

  // Low-balance thresholds — seed values were hard-coded at $200K/$400K in
  // the prototype; keeping them as floors makes the tone signal legible on
  // a contractor's typical operating range. If the starting balance is very
  // small (early stage), we scale thresholds down to avoid perpetually-red
  // readouts.
  const bal = projection.startingBalanceCents;
  const scale = Math.max(bal, 200 * 100_000) / (400 * 100_000);
  const warnThresholdCents = Math.round(200 * 100_000 * scale);
  const critThresholdCents = Math.round(100 * 100_000 * scale);

  const lowWeek = projection.weeks.find(
    (w) => w.balanceCents === projection.totals.minBalanceCents,
  );

  const minTone: KpiTone =
    projection.totals.minBalanceCents < critThresholdCents
      ? "crit"
      : projection.totals.minBalanceCents < warnThresholdCents
        ? "warn"
        : "ok";

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Starting Balance"
          value={fmt(projection.startingBalanceCents / 100)}
          Icon={IconWallet}
        />
        <KPI
          label="Projected Inflows"
          value={fmt(projection.totals.totalInflowCents / 100)}
          sub="Next 12 weeks"
          tone="ok"
          Icon={IconArrowUpRight}
        />
        <KPI
          label="Projected Outflows"
          value={fmt(projection.totals.totalOutflowCents / 100)}
          sub="Next 12 weeks"
          tone="warn"
          Icon={IconArrowDownRight}
        />
        <KPI
          label="Projected End Balance"
          value={fmt(projection.totals.endBalanceCents / 100)}
          sub={`Low point ${fmt(projection.totals.minBalanceCents / 100)}${lowWeek ? ` at ${lowWeek.weekIso}` : ""}`}
          tone={minTone}
          Icon={IconTrendingUp}
        />
      </div>

      <Card className="rpt-mb">
        <SectionHeading
          title="Inflows, outflows &amp; running balance"
          subtitle="Paired bars show gross weekly flow side-by-side (inflow left, outflow right). The accent line traces running cash position."
        />
        <CashflowChart data={projection.weeks} />
      </Card>

      <Card padded={false}>
        <div className="rpt-card-hdr">
          <div className="rpt-eyebrow">Weekly breakdown</div>
        </div>
        <table className="rpt-data-tbl">
          <thead>
            <tr>
              <th>Week</th>
              <th>Date</th>
              <th className="rpt-right">Inflow</th>
              <th className="rpt-right">Outflow</th>
              <th className="rpt-right">Net</th>
              <th className="rpt-right">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {projection.weeks.map((w) => (
              <tr key={w.weekIso}>
                <td className="rpt-strong">{w.weekIso}</td>
                <td className="rpt-t2">{w.weekLabel}</td>
                <td className="rpt-right rpt-num tone-ok">
                  {fmt(w.inflowCents / 100)}
                </td>
                <td className="rpt-right rpt-num tone-crit">
                  {w.outflowCents === 0 ? "—" : `-${fmt(w.outflowCents / 100)}`}
                </td>
                <td
                  className={cx(
                    "rpt-right rpt-num rpt-strong",
                    w.netCents > 0
                      ? "tone-ok"
                      : w.netCents < 0
                        ? "tone-crit"
                        : undefined,
                  )}
                >
                  {w.netCents === 0
                    ? "—"
                    : `${w.netCents > 0 ? "+" : "-"}${fmt(Math.abs(w.netCents) / 100)}`}
                </td>
                <td
                  className={cx(
                    "rpt-right rpt-num rpt-strong",
                    w.balanceCents < critThresholdCents
                      ? "tone-crit"
                      : w.balanceCents < warnThresholdCents
                        ? "tone-warn"
                        : undefined,
                  )}
                >
                  {fmt(w.balanceCents / 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CashflowChart({ data }: { data: CashflowWeek[] }) {
  // Paired bars on the same upward baseline (inflow left, outflow right).
  // Nothing extends below the x-axis, so bars can't overlap the week/date
  // labels. Balance line runs in the upper band of the plot.
  const W = 960;
  const H = 300;
  const pad = { top: 28, right: 28, bottom: 58, left: 60 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  // Bar band: bottom 38% of plot. Balance band: top 62% (with 8px breathing
  // gap at the baseline so the bars and the low-balance line don't collide).
  const barBandH = plotH * 0.38;
  const balBandH = plotH * 0.62 - 8;
  const baseY = pad.top + plotH;
  const balBandTop = pad.top;

  const balances = data.map((d) => d.balanceCents);
  // Scale includes negatives so an overdrawn balance doesn't plot below
  // the band (which would bleed into the bar area). Always anchors zero
  // in range so the zero line can be drawn as a distinct reference.
  const tickStepCents = 20 * 100_000;
  const rawMax = Math.max(0, ...balances);
  const rawMin = Math.min(0, ...balances);
  const niceMax =
    Math.max(Math.ceil(rawMax / tickStepCents) * tickStepCents, tickStepCents);
  const niceMin =
    rawMin === 0
      ? 0
      : Math.floor(rawMin / tickStepCents) * tickStepCents;
  const scaleRange = niceMax - niceMin || tickStepCents;
  const yForBalance = (cents: number) =>
    balBandTop + balBandH - ((cents - niceMin) / scaleRange) * balBandH;
  const zeroY = yForBalance(0);

  const maxFlow = Math.max(
    0,
    ...data.map((d) => Math.max(d.inflowCents, d.outflowCents)),
  );
  const slotW = plotW / data.length;
  const barW = Math.min(8, slotW * 0.22);
  const flowScale = barBandH / (maxFlow || 1);

  const balPts = data.map((d, i) => {
    const x = pad.left + slotW * i + slotW / 2;
    return [x, yForBalance(d.balanceCents)] as const;
  });
  const linePath = balPts.reduce(
    (p, [x, y], i) => (i === 0 ? `M ${x},${y}` : `${p} L ${x},${y}`),
    "",
  );
  // Area fills from the line down to the zero axis (not the band bottom),
  // so the gradient reads as "area above/below zero" rather than a
  // misleading column of fill under a negative line.
  const areaPath = `${linePath} L ${balPts[balPts.length - 1][0]},${zeroY} L ${balPts[0][0]},${zeroY} Z`;

  const yTicks = 5;
  const minIdx = balances.indexOf(Math.min(...balances));
  const minPt = balPts[minIdx];
  const minVal = balances[minIdx];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="rpt-cashflow-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="rpt-bal-area" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--ac)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--ac)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const t = i / yTicks;
        const val = niceMin + t * scaleRange;
        const y = yForBalance(val);
        return (
          <g key={i}>
            <line
              x1={pad.left}
              x2={W - pad.right}
              y1={y}
              y2={y}
              stroke="var(--s3)"
              strokeDasharray={i === 0 ? "" : "2,3"}
              strokeWidth="1"
            />
            <text
              x={pad.left - 10}
              y={y + 3}
              fontSize="9.5"
              fill="var(--t3)"
              textAnchor="end"
              fontWeight="600"
              letterSpacing="0.04em"
            >
              {fmt(val / 100)}
            </text>
          </g>
        );
      })}

      {/* Zero-line reference, only when the scale dips into negatives. */}
      {niceMin < 0 && (
        <line
          x1={pad.left}
          x2={W - pad.right}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--dg)"
          strokeWidth="1"
          strokeDasharray="4,3"
          opacity="0.6"
        />
      )}

      {/* x-axis baseline for the bars */}
      <line
        x1={pad.left}
        x2={W - pad.right}
        y1={baseY}
        y2={baseY}
        stroke="var(--s4)"
        strokeWidth="1"
      />

      {/* Paired flow bars — both going UP from baseline */}
      {data.map((d, i) => {
        const cx = pad.left + slotW * i + slotW / 2;
        const inH = d.inflowCents * flowScale;
        const outH = d.outflowCents * flowScale;
        return (
          <g key={`bars-${d.weekIso}`}>
            <rect
              x={cx - barW - 1}
              y={baseY - inH}
              width={barW}
              height={inH}
              rx="0.5"
              fill="var(--ok)"
              opacity="0.38"
            />
            <rect
              x={cx + 1}
              y={baseY - outH}
              width={barW}
              height={outH}
              rx="0.5"
              fill="var(--dg)"
              opacity="0.34"
            />
          </g>
        );
      })}

      <path d={areaPath} fill="url(#rpt-bal-area)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--ac)"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {balPts.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="2.5"
          fill="var(--s1)"
          stroke="var(--ac)"
          strokeWidth="1.5"
        />
      ))}

      {minPt && (
        <g>
          <circle
            cx={minPt[0]}
            cy={minPt[1]}
            r="5"
            fill="none"
            stroke="var(--ac)"
            strokeWidth="1"
            opacity="0.4"
          />
          <line
            x1={minPt[0]}
            x2={minPt[0]}
            y1={minPt[1] + 8}
            y2={minPt[1] + 20}
            stroke="var(--t3)"
            strokeWidth="0.75"
            strokeDasharray="2,2"
          />
          <text
            x={minPt[0]}
            y={minPt[1] + 32}
            fontSize="9.5"
            fill="var(--t2)"
            textAnchor="middle"
            fontWeight="600"
            letterSpacing="0.04em"
          >
            LOW {fmt(Math.round(minVal) / 100)}
          </text>
        </g>
      )}

      {/* x-axis labels — safely below baseline in the pad.bottom region */}
      {data.map((d, i) => {
        const x = pad.left + slotW * i + slotW / 2;
        return (
          <g key={`x-${d.weekIso}`}>
            <text
              x={x}
              y={baseY + 18}
              fontSize="10"
              fill="var(--t2)"
              textAnchor="middle"
              fontWeight="600"
              letterSpacing="0.02em"
            >
              {d.weekIso}
            </text>
            <text
              x={x}
              y={baseY + 34}
              fontSize="9"
              fill="var(--t3)"
              textAnchor="middle"
            >
              {d.weekLabel}
            </text>
          </g>
        );
      })}

      {/* legend */}
      <g transform={`translate(${pad.left}, 14)`}>
        <line x1="0" y1="2" x2="16" y2="2" stroke="var(--ac)" strokeWidth="1.75" />
        <circle cx="8" cy="2" r="2.5" fill="var(--s1)" stroke="var(--ac)" strokeWidth="1.5" />
        <text x="24" y="5.5" fontSize="10" fill="var(--t2)" fontWeight="600" letterSpacing="0.02em">
          RUNNING BALANCE
        </text>
        <rect x="170" y="-1" width="4" height="6" rx="0.5" fill="var(--ok)" opacity="0.5" />
        <text x="180" y="5.5" fontSize="10" fill="var(--t3)" fontWeight="500">
          Inflow
        </text>
        <rect x="218" y="-1" width="4" height="6" rx="0.5" fill="var(--dg)" opacity="0.5" />
        <text x="228" y="5.5" fontSize="10" fill="var(--t3)" fontWeight="500">
          Outflow
        </text>
      </g>
    </svg>
  );
}

// ----------------------------------------------------------------
// Payment Tracking (Step 38) — compact summary backed by live data.
// The full interactive surface lives at /contractor/payment-tracking.
// ----------------------------------------------------------------

function PaymentTrackingReport({ view }: { view: ReportsView }) {
  const summary = view.paymentTracking;
  if (!summary) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        Payment tracking summary unavailable. Open the full page for live data.
        <div style={{ marginTop: 12 }}>
          <a href="/contractor/payment-tracking" style={paymentTrackingLinkStyle}>
            Go to Payment Tracking →
          </a>
        </div>
      </div>
    );
  }
  const outstandingK = Math.round(summary.inbound.totalOutstandingCents / 1000) / 100;
  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Outstanding (inbound)"
          value={fmt(outstandingK * 1000)}
          sub={`${summary.inbound.totalDraws} draws`}
          tone={summary.inbound.totalOutstandingCents > 0 ? "warn" : "neutral"}
          Icon={IconReceipt}
        />
        <KPI
          label="Delinquent"
          value={summary.inbound.delinquentCount.toString()}
          sub={
            summary.inbound.delinquentCount === 0
              ? "None past 30 days"
              : "Past the 30-day threshold"
          }
          tone={summary.inbound.delinquentCount > 0 ? "crit" : "ok"}
          Icon={IconAlertTriangle}
        />
        <KPI
          label="Sub payments"
          value={summary.outbound.totalWaivers.toString()}
          sub={`${summary.outbound.pendingWaiverCount} waivers pending`}
          Icon={IconDollarSign}
        />
        <KPI
          label="Retainage held"
          value={fmt(summary.outbound.totalRetainageHeldCents / 100)}
          sub="Portfolio-wide"
          Icon={IconWallet}
        />
      </div>

      {summary.topDelinquentProjects.length > 0 && (
        <Card padded={false}>
          <div className="rpt-tbl-scroll">
            <table className="rpt-data-tbl">
              <thead>
                <tr>
                  <th>Top delinquent projects</th>
                  <th className="rpt-right">Delinquent draws</th>
                  <th className="rpt-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {summary.topDelinquentProjects.map((p) => (
                  <tr key={p.projectId}>
                    <td>{p.projectName}</td>
                    <td className="rpt-right">{p.delinquentCount}</td>
                    <td className="rpt-right">
                      {fmt(p.delinquentOutstandingCents / 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div style={{ marginTop: 16 }}>
        <a href="/contractor/payment-tracking" style={paymentTrackingLinkStyle}>
          Open full payment tracking →
        </a>
      </div>
    </div>
  );
}

const paymentTrackingLinkStyle: React.CSSProperties = {
  fontFamily: "var(--fb)",
  fontSize: 13,
  fontWeight: 620,
  color: "var(--ac-t)",
  textDecoration: "none",
};

// ----------------------------------------------------------------
// Weekly Reports aggregate (Step 39) — recent sent reports across the
// portfolio. The full per-project surface lives at
// /contractor/project/<id>/weekly-reports; this tile is a glance.
// ----------------------------------------------------------------

function WeeklyReportsAggregateReport({ view }: { view: ReportsView }) {
  const summary = view.weeklyReports;
  if (!summary || summary.recentSent.length === 0) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        {summary
          ? "No weekly reports sent yet across the portfolio."
          : "Weekly-reports summary unavailable."}
        <div style={{ marginTop: 12, fontSize: 12 }}>
          Reports auto-generate Monday morning per project. Open a project to
          review or send.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Sent this quarter"
          value={summary.totalSent.toString()}
          sub="Across all projects"
          Icon={IconFileText}
        />
        <KPI
          label="Most recent"
          value={
            summary.recentSent[0]
              ? formatWeeklyReportShort(
                  summary.recentSent[0].weekStart,
                  summary.recentSent[0].weekEnd,
                )
              : "—"
          }
          sub={
            summary.recentSent[0]
              ? summary.recentSent[0].projectName
              : "Nothing sent yet"
          }
          Icon={IconCalendarClock}
        />
      </div>

      <Card padded={false}>
        <div className="rpt-tbl-scroll">
          <table className="rpt-data-tbl">
            <thead>
              <tr>
                <th>Project</th>
                <th>Week</th>
                <th>Sent by</th>
                <th>Sent at</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {summary.recentSent.map((r) => (
                <tr key={r.reportId}>
                  <td>{r.projectName}</td>
                  <td>{formatWeeklyReportShort(r.weekStart, r.weekEnd)}</td>
                  <td>{r.sentByName ?? "—"}</td>
                  <td>{formatWeeklyReportSentAt(r.sentAt)}</td>
                  <td className="rpt-right">
                    <a
                      href={`/contractor/project/${r.projectId}/weekly-reports?report=${r.reportId}`}
                      style={paymentTrackingLinkStyle}
                    >
                      Open →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function formatWeeklyReportShort(weekStart: string, weekEnd: string): string {
  const a = parseWeeklyDate(weekStart);
  const b = parseWeeklyDate(weekEnd);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  const fmtMD = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return sameMonth
    ? `${fmtMD(a)} – ${b.getUTCDate()}`
    : `${fmtMD(a)} – ${fmtMD(b)}`;
}

function parseWeeklyDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatWeeklyReportSentAt(d: Date): string {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ----------------------------------------------------------------
// Lien Waiver Log (Step 40) — every waiver across the portfolio with
// per-row status, amount, draw, sub. Filterable by project + status.
// ----------------------------------------------------------------

function LienWaiverLogReportView({ view }: { view: ReportsView }) {
  const summary = view.lienWaivers;
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const projectOptions = useMemo(() => {
    if (!summary) return [] as Array<{ id: string; name: string }>;
    const seen = new Map<string, string>();
    for (const r of summary.rows) seen.set(r.projectId, r.projectName);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [summary]);

  const filtered = useMemo(() => {
    if (!summary) return [];
    return summary.rows.filter((r) => {
      if (projectFilter !== "all" && r.projectId !== projectFilter)
        return false;
      if (statusFilter !== "all" && r.lienWaiverStatus !== statusFilter)
        return false;
      return true;
    });
  }, [summary, projectFilter, statusFilter]);

  if (!summary) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        Lien waiver log unavailable.
      </div>
    );
  }
  if (summary.rows.length === 0) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        No lien waivers recorded yet across the portfolio.
        <div style={{ marginTop: 8, fontSize: 12 }}>
          Waivers are created automatically when a draw is submitted (one per
          active sub on the project).
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Outstanding"
          value={summary.totals.outstandingCount.toString()}
          sub={fmt(summary.totals.outstandingAmountCents / 100)}
          tone={summary.totals.outstandingCount > 0 ? "warn" : "ok"}
          Icon={IconAlertTriangle}
        />
        <KPI
          label="Accepted"
          value={summary.totals.acceptedCount.toString()}
          sub="Cleared and on file"
          tone="ok"
          Icon={IconCheckCircle2}
        />
        <KPI
          label="Rejected"
          value={summary.totals.rejectedCount.toString()}
          sub={
            summary.totals.rejectedCount === 0
              ? "None"
              : "Need follow-up"
          }
          tone={summary.totals.rejectedCount > 0 ? "crit" : "neutral"}
          Icon={IconAlertTriangle}
        />
        <KPI
          label="Total"
          value={summary.totals.totalCount.toString()}
          sub="Across all draws"
          Icon={IconFileText}
        />
      </div>

      <div style={lienFilterBarStyle}>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          style={lienSelectStyle}
        >
          <option value="all">All projects ({projectOptions.length})</option>
          {projectOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={lienSelectStyle}
        >
          <option value="all">All statuses</option>
          <option value="requested">Requested</option>
          <option value="submitted">Submitted</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="waived">Waived</option>
        </select>
        <div style={lienFilterCountStyle}>
          {filtered.length} of {summary.rows.length}
        </div>
      </div>

      <Card padded={false}>
        <div className="rpt-tbl-scroll">
          <table className="rpt-data-tbl">
            <thead>
              <tr>
                <th>Project</th>
                <th>Draw</th>
                <th>Organization</th>
                <th>Type</th>
                <th>Status</th>
                <th className="rpt-right">Amount</th>
                <th>Through</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.projectName}</td>
                  <td>#{r.drawNumber.toString().padStart(3, "0")}</td>
                  <td>
                    {r.organizationName}
                    <span style={lienOrgKindStyle}>
                      {r.organizationKind === "contractor" ? " · GC" : " · Sub"}
                    </span>
                  </td>
                  <td>{lienWaiverTypeLabel(r.lienWaiverType)}</td>
                  <td>{lienWaiverStatusLabel(r.lienWaiverStatus)}</td>
                  <td className="rpt-right">{fmt(r.amountCents / 100)}</td>
                  <td>
                    {r.throughDate
                      ? new Date(r.throughDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                  <td>{r.ageDays != null ? `${r.ageDays}d` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const lienFilterBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  marginBottom: 12,
  padding: "10px 0",
  fontFamily: "var(--fb)",
};

const lienSelectStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "var(--r-m)",
  border: "1px solid var(--s3)",
  background: "var(--s1)",
  color: "var(--t1)",
  fontFamily: "var(--fb)",
  fontSize: 12,
  fontWeight: 540,
};

const lienFilterCountStyle: React.CSSProperties = {
  marginLeft: "auto",
  fontSize: 11,
  fontWeight: 620,
  color: "var(--t3)",
  fontFamily: "var(--fb)",
};

const lienOrgKindStyle: React.CSSProperties = {
  marginLeft: 4,
  fontSize: 10,
  fontWeight: 700,
  color: "var(--t3)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

function lienWaiverTypeLabel(t: string): string {
  switch (t) {
    case "conditional_progress":
      return "Conditional · Progress";
    case "unconditional_progress":
      return "Unconditional · Progress";
    case "conditional_final":
      return "Conditional · Final";
    case "unconditional_final":
      return "Unconditional · Final";
    default:
      return t;
  }
}

function lienWaiverStatusLabel(s: string): string {
  switch (s) {
    case "requested":
      return "Requested";
    case "submitted":
      return "Submitted";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    case "waived":
      return "Waived";
    default:
      return s;
  }
}

// ----------------------------------------------------------------
// Procurement / POs (Step 41) — aggregate PO counts, committed $,
// spend-YTD, by-vendor rollup, aging bucket. Detail per PO lives on
// the project-scoped procurement page.
// ----------------------------------------------------------------

function ProcurementReportView({ view }: { view: ReportsView }) {
  const summary = view.procurement;
  if (!summary) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        Procurement summary unavailable.
      </div>
    );
  }
  if (
    summary.openPoCount === 0 &&
    summary.closedYtdCount === 0 &&
    summary.byVendor.length === 0
  ) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        No purchase orders yet across the portfolio.
        <div style={{ marginTop: 8, fontSize: 12 }}>
          Open a project and issue your first PO from the Procurement tab.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Open POs"
          value={summary.openPoCount.toString()}
          sub="Issued or receiving"
          Icon={IconTruck}
          tone={summary.openPoCount > 0 ? "neutral" : "ok"}
        />
        <KPI
          label="Committed (open)"
          value={fmt(summary.committedCents / 100)}
          sub="Across open POs"
          Icon={IconWallet}
          tone={summary.committedCents > 0 ? "warn" : "neutral"}
        />
        <KPI
          label="Awaiting invoice"
          value={summary.awaitingInvoiceCount.toString()}
          sub="Fully received, not closed"
          Icon={IconReceipt}
          tone={summary.awaitingInvoiceCount > 0 ? "warn" : "ok"}
        />
        <KPI
          label="Spent YTD"
          value={fmt(summary.spendYtdCents / 100)}
          sub={`${summary.closedYtdCount} POs closed this year`}
          Icon={IconDollarSign}
          tone="ok"
        />
      </div>

      <Card padded={false} className="rpt-mb">
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--s3)" }}>
          <div
            style={{
              fontFamily: "var(--fd)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            By vendor
          </div>
        </div>
        <div className="rpt-tbl-scroll">
          <table className="rpt-data-tbl">
            <thead>
              <tr>
                <th>Vendor</th>
                <th className="rpt-right">Open POs</th>
                <th className="rpt-right">Committed</th>
                <th className="rpt-right">Spend YTD</th>
              </tr>
            </thead>
            <tbody>
              {summary.byVendor.slice(0, 25).map((v) => (
                <tr key={v.vendorId}>
                  <td>{v.vendorName}</td>
                  <td className="rpt-right">{v.openCount}</td>
                  <td className="rpt-right">{fmt(v.committedCents / 100)}</td>
                  <td className="rpt-right">{fmt(v.spendYtdCents / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card padded={false}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--s3)" }}>
          <div
            style={{
              fontFamily: "var(--fd)",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Open POs by age (ordered date → today)
          </div>
        </div>
        <div className="rpt-tbl-scroll">
          <table className="rpt-data-tbl">
            <thead>
              <tr>
                <th>Bucket</th>
                <th className="rpt-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {summary.byAging.map((b) => (
                <tr key={b.bucket}>
                  <td>
                    {b.bucket === "0_7"
                      ? "0–7 days"
                      : b.bucket === "8_14"
                        ? "8–14 days"
                        : b.bucket === "15_30"
                          ? "15–30 days"
                          : "30+ days"}
                  </td>
                  <td className="rpt-right">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------
// Labor & Productivity
// ----------------------------------------------------------------

function LaborReport({ view }: { view: ReportsView }) {
  const labor = view.labor;
  if (!labor || labor.totals.hoursTotal === 0) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        {labor
          ? "No crew hours logged yet across the portfolio."
          : "Labor report unavailable."}
      </div>
    );
  }

  const { rows, tradesOrder, totals, trendHours } = labor;
  const trendStart = trendHours[0] ?? 0;
  const trendEnd = trendHours[trendHours.length - 1] ?? 0;
  const trendPct = trendStart > 0 ? (trendEnd - trendStart) / trendStart : 0;

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Hours Logged"
          value={Math.round(totals.hoursTotal).toLocaleString()}
          sub="Last 8 weeks"
          Icon={IconClock}
          trendData={trendHours}
        />
        <KPI
          label="Crew Days"
          value={totals.crewDays.toLocaleString()}
          sub="Sum of headcount across logged shifts"
          Icon={IconUsers}
        />
        <KPI
          label="Avg Crew Size"
          value={totals.avgCrewSize.toFixed(1)}
          sub="Hours-weighted headcount"
          Icon={IconUsers}
        />
        <KPI
          label="8-Week Trend"
          value={
            trendPct === 0
              ? "—"
              : `${trendPct > 0 ? "+" : ""}${(trendPct * 100).toFixed(1)}%`
          }
          sub="Hours change vs. 8 weeks ago"
          tone={trendPct > 0.15 ? "warn" : trendPct < -0.15 ? "crit" : "ok"}
          Icon={IconTrendingUp}
        />
      </div>

      <Card className="rpt-mb">
        <SectionHeading
          title="Hours composition by trade"
          subtitle="Per-project stacked segments show how hours distribute across trades. Top 5 trades by total hours are named; the rest roll into Other."
        />
        <LaborStackedBars rows={rows} tradesOrder={tradesOrder} />
      </Card>

      <Card padded={false}>
        <table className="rpt-data-tbl">
          <thead>
            <tr>
              <th>Project</th>
              <th className="rpt-right">Hours</th>
              <th className="rpt-right">Crew Days</th>
              <th className="rpt-right">Shifts</th>
              <th>Top Trade</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const topTrade =
                Object.entries(r.hoursByTrade).sort(
                  (a, b) => b[1] - a[1],
                )[0]?.[0] ?? "—";
              return (
                <tr key={r.projectId}>
                  <td className="rpt-strong">{r.projectName}</td>
                  <td className="rpt-right rpt-num">
                    {Math.round(r.hoursTotal).toLocaleString()}
                  </td>
                  <td className="rpt-right rpt-num rpt-t2">
                    {r.crewDays.toLocaleString()}
                  </td>
                  <td className="rpt-right rpt-num rpt-t2">
                    {r.uniqueCrewDays.toLocaleString()}
                  </td>
                  <td className="rpt-t2">{topTrade}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// Deterministic palette index — consistent trade → swatch colour by slot
// position so the legend + bar segments always line up regardless of what
// actual trade names appear.
const TRADE_PALETTE = [
  "trade-slot-0",
  "trade-slot-1",
  "trade-slot-2",
  "trade-slot-3",
  "trade-slot-4",
  "trade-slot-5",
] as const;

function LaborStackedBars({
  rows,
  tradesOrder,
}: {
  rows: LaborProjectRow[];
  tradesOrder: string[];
}) {
  const maxHours = Math.max(1, ...rows.map((r) => r.hoursTotal));
  return (
    <div className="rpt-labor-stack">
      <div className="rpt-labor-rows">
        {rows.map((p) => {
          const pct = p.hoursTotal / maxHours;
          let cursor = 0;
          return (
            <div key={p.projectId} className="rpt-labor-row">
              <div className="rpt-labor-row-hdr">
                <div className="rpt-strong">{p.projectName}</div>
                <div className="rpt-t3 rpt-num">
                  {Math.round(p.hoursTotal).toLocaleString()} hrs ·{" "}
                  {p.crewDays.toLocaleString()} crew days
                </div>
              </div>
              <div
                className="rpt-labor-bar"
                style={{ width: `${Math.max(pct * 100, 10)}%` }}
              >
                {tradesOrder.map((trade, i) => {
                  const hours = p.hoursByTrade[trade] ?? 0;
                  if (hours <= 0) return null;
                  const segPct = (hours / p.hoursTotal) * 100;
                  const style: React.CSSProperties = {
                    left: `${cursor}%`,
                    width: `${segPct}%`,
                  };
                  cursor += segPct;
                  return (
                    <div
                      key={trade}
                      className={cx(
                        "rpt-labor-seg",
                        TRADE_PALETTE[i % TRADE_PALETTE.length],
                        i < tradesOrder.length - 1 && "has-divider",
                      )}
                      style={style}
                      title={`${trade}: ${Math.round(hours)}h`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="rpt-labor-legend">
        {tradesOrder.map((trade, i) => (
          <div key={trade} className="rpt-labor-legend-item">
            <div
              className={cx(
                "rpt-labor-swatch",
                TRADE_PALETTE[i % TRADE_PALETTE.length],
              )}
            />
            <span>{trade}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Schedule Performance
// ----------------------------------------------------------------

function ScheduleReport({ view }: { view: ReportsView }) {
  const schedulePerf = view.schedulePerf;
  if (!schedulePerf || schedulePerf.rows.length === 0) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        {schedulePerf
          ? "No projects with both a start and target completion date yet — add one to populate Schedule Performance."
          : "Schedule performance unavailable."}
      </div>
    );
  }

  const { rows, totals } = schedulePerf;

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Portfolio SPI"
          value={totals.avgSpi.toFixed(2)}
          sub={totals.avgSpi >= 0.95 ? "On track overall" : "Portfolio drift"}
          tone={totals.avgSpi >= 0.95 ? "ok" : "warn"}
          Icon={IconCalendarClock}
        />
        <KPI
          label="Projects Behind"
          value={String(totals.behindCount)}
          sub="SPI < 0.95"
          tone={totals.behindCount > 0 ? "warn" : "ok"}
          Icon={IconAlertTriangle}
        />
        <KPI
          label="On Track"
          value={String(totals.onTrackCount)}
          sub="SPI 0.95–1.05"
          tone="ok"
          Icon={IconCheckCircle2}
        />
        <KPI
          label="Ahead"
          value={String(totals.aheadCount)}
          sub="SPI > 1.05"
          tone="ok"
          Icon={IconTrendingUp}
        />
      </div>

      <Card className="rpt-mb">
        <SectionHeading
          title="Per-project SPI"
          subtitle="Horizontal tracks from 0.70 (behind) to 1.30 (ahead). Tick at 1.00 marks on-schedule; the dot is the project's current SPI."
        />
        <div className="rpt-spi-grid">
          {rows.map((p) => (
            <SPITrack key={p.projectId} project={p} />
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Planned vs actual timeline"
          subtitle="Hairline for planned duration. Filled line for actual/forecast. Dashed red line marks today."
        />
        <GanttStrip data={rows} />
      </Card>
    </div>
  );
}

function SPITrack({ project }: { project: SchedulePerfRow }) {
  const SPI_MIN = 0.7;
  const SPI_MAX = 1.3;
  const range = SPI_MAX - SPI_MIN;
  const spi = Math.min(Math.max(project.spi, SPI_MIN), SPI_MAX);
  const x = ((spi - SPI_MIN) / range) * 100;
  const onScheduleX = ((1 - SPI_MIN) / range) * 100;
  const tone: KpiTone =
    project.spi < 0.95 ? "crit" : project.spi > 1.05 ? "neutral" : "ok";
  const status =
    project.spi < 0.95 ? "Behind" : project.spi > 1.05 ? "Ahead" : "On track";
  const milestonesPct =
    project.milestonesTotal > 0
      ? project.milestonesHit / project.milestonesTotal
      : 0;

  return (
    <div className="rpt-spi">
      <div className="rpt-spi-head">
        <div className="rpt-spi-head-l">
          <div className="rpt-strong">{project.projectName}</div>
          <div className="rpt-spi-meta">
            <span className={cx("rpt-spi-status", `tone-${tone}`)}>{status}</span>
            <span className="rpt-t3">
              · {project.milestonesHit}/{project.milestonesTotal} milestones
            </span>
          </div>
        </div>
        <div className="rpt-right">
          <div className={cx("rpt-spi-value rpt-num", `tone-${tone}`)}>
            {project.spi.toFixed(2)}
          </div>
          <div className="rpt-eyebrow">SPI</div>
        </div>
      </div>
      <div className="rpt-spi-track">
        <div className="rpt-spi-track-base" />
        <div
          className="rpt-spi-track-tick"
          style={{ left: `${onScheduleX}%` }}
        />
        <div
          className={cx("rpt-spi-track-dot", `tone-${tone}`)}
          style={{ left: `${x}%` }}
        />
        <div className="rpt-spi-track-ms">
          <div
            className="rpt-spi-track-ms-fill"
            style={{ width: `${milestonesPct * 100}%` }}
          />
        </div>
      </div>
      <div className="rpt-spi-scale">
        <span>0.70</span>
        <span style={{ left: `${onScheduleX}%` }}>1.00</span>
        <span>1.30</span>
      </div>
    </div>
  );
}

function GanttStrip({ data }: { data: SchedulePerfRow[] }) {
  const rowH = 44;
  const W = 960;
  const labelW = 240;
  const barArea = W - labelW - 24;
  const H = data.length * rowH + 36;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="rpt-gantt-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      {[0, 25, 50, 75, 100].map((p) => (
        <g key={p}>
          <line
            x1={labelW + (p / 100) * barArea}
            x2={labelW + (p / 100) * barArea}
            y1={8}
            y2={H - 20}
            stroke="var(--s3)"
            strokeDasharray="2,3"
          />
          <text
            x={labelW + (p / 100) * barArea}
            y={H - 6}
            fontSize="9.5"
            fill="var(--t3)"
            textAnchor="middle"
            fontWeight="600"
            letterSpacing="0.04em"
          >
            {p}%
          </text>
        </g>
      ))}
      {data.map((p, i) => {
        const y = 16 + i * rowH;
        const plannedX = labelW + (p.plannedStart / 100) * barArea;
        const plannedW = ((p.plannedEnd - p.plannedStart) / 100) * barArea;
        const actualX = labelW + (p.actualStart / 100) * barArea;
        const actualW = ((p.actualEnd - p.actualStart) / 100) * barArea;
        const todayX = labelW + (p.today / 100) * barArea;
        const actualColor =
          p.spi < 0.95
            ? "var(--dg)"
            : p.spi > 1.05
              ? "var(--ac)"
              : "var(--ok)";
        return (
          <g key={p.projectId}>
            <text x="8" y={y + 10} fontSize="12" fill="var(--t1)" fontWeight="500">
              {p.projectName}
            </text>
            <text x="8" y={y + 26} fontSize="10" fill="var(--t3)" fontWeight="500">
              SPI {p.spi.toFixed(2)}
            </text>
            <line
              x1={plannedX}
              y1={y + 6}
              x2={plannedX + plannedW}
              y2={y + 6}
              stroke="var(--s4)"
              strokeWidth="1"
            />
            <line
              x1={plannedX}
              y1={y + 3}
              x2={plannedX}
              y2={y + 9}
              stroke="var(--s4)"
              strokeWidth="1"
            />
            <line
              x1={plannedX + plannedW}
              y1={y + 3}
              x2={plannedX + plannedW}
              y2={y + 9}
              stroke="var(--s4)"
              strokeWidth="1"
            />
            <rect
              x={actualX}
              y={y + 16}
              width={actualW}
              height="4"
              rx="0.5"
              fill={actualColor}
              opacity="0.88"
            />
            <line
              x1={todayX}
              y1={y - 2}
              x2={todayX}
              y2={y + 30}
              stroke="var(--dg)"
              strokeWidth="1"
              strokeDasharray="2,2"
            />
            <circle cx={todayX} cy={y + 23} r="2.5" fill="var(--dg)" />
          </g>
        );
      })}
      <g transform={`translate(${W - 340}, 4)`}>
        <line x1="0" y1="2" x2="14" y2="2" stroke="var(--s4)" strokeWidth="1" />
        <line x1="0" y1="0" x2="0" y2="4" stroke="var(--s4)" strokeWidth="1" />
        <line x1="14" y1="0" x2="14" y2="4" stroke="var(--s4)" strokeWidth="1" />
        <text x="20" y="5" fontSize="9.5" fill="var(--t2)" fontWeight="500">
          Planned
        </text>
        <rect x="76" y="0" width="14" height="4" rx="0.5" fill="var(--ok)" opacity="0.88" />
        <text x="94" y="5" fontSize="9.5" fill="var(--t2)" fontWeight="500">
          Actual
        </text>
        <line x1="146" y1="-2" x2="146" y2="7" stroke="var(--dg)" strokeWidth="1" strokeDasharray="2,2" />
        <text x="152" y="5" fontSize="9.5" fill="var(--t2)" fontWeight="500">
          Today
        </text>
      </g>
    </svg>
  );
}

// ----------------------------------------------------------------
// Compliance
// ----------------------------------------------------------------

function ComplianceReport({ view }: { view: ReportsView }) {
  const compliance = view.compliance;
  if (!compliance) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        Compliance report unavailable.
      </div>
    );
  }
  if (compliance.totals.subsTracked === 0) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        No subcontractors active on current projects yet. Invite a sub to start
        tracking compliance.
      </div>
    );
  }

  const { expiring, matrix, totals } = compliance;

  const cellLabel: Record<ComplianceCell, string> = {
    ok: "✓",
    expiring: "!",
    expired: "!",
    missing: "✕",
    "n/a": "—",
  };

  const cellTone: Record<ComplianceCell, string> = {
    ok: "ok",
    expiring: "warn",
    expired: "crit",
    missing: "crit",
    "n/a": "muted",
  };

  const formatExpires = (d: Date | null): string => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div>
      <div className="rpt-k-row three">
        <KPI
          label="Critical"
          value={String(totals.criticalCount)}
          sub="Expiring ≤14 days, expired, or missing"
          tone={totals.criticalCount > 0 ? "crit" : "ok"}
          Icon={IconAlertTriangle}
        />
        <KPI
          label="Warning"
          value={String(totals.warningCount)}
          sub="Expiring 15–45 days"
          tone={totals.warningCount > 0 ? "warn" : "ok"}
          Icon={IconClock}
        />
        <KPI
          label="Subs Tracked"
          value={String(totals.subsTracked)}
          sub="Active on current projects"
          Icon={IconUsers}
        />
      </div>

      <Card className="rpt-mb" padded={false}>
        <div className="rpt-card-hdr">
          <div className="rpt-eyebrow">Expiring in the next 90 days</div>
        </div>
        {expiring.length === 0 ? (
          <div style={{ padding: 20, color: "var(--t3)" }}>
            Nothing expiring, missing, or expired across tracked subs.
          </div>
        ) : (
          <div className="rpt-compl-list">
            {expiring.map((e) => (
              <div
                key={`${e.subOrganizationId}::${e.complianceType}`}
                className="rpt-compl-row"
              >
                <div className="rpt-compl-row-l">
                  <span
                    className={cx(
                      "rpt-compl-sev-pill",
                      `tone-${e.severity === "critical" ? "crit" : e.severity === "warning" ? "warn" : "ok"}`,
                    )}
                  >
                    {e.severity}
                  </span>
                  <div>
                    <div className="rpt-strong">{e.subName}</div>
                    <div className="rpt-t3">{e.complianceType}</div>
                  </div>
                </div>
                <div className="rpt-right">
                  <div className="rpt-num">{formatExpires(e.expiresAt)}</div>
                  <div className="rpt-t3">
                    {e.daysUntilExpiry === null
                      ? "Document missing"
                      : e.daysUntilExpiry < 0
                        ? `${Math.abs(e.daysUntilExpiry)}d overdue`
                        : `in ${e.daysUntilExpiry} days`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card padded={false}>
        <div className="rpt-card-hdr">
          <div className="rpt-eyebrow">Subcontractor compliance matrix</div>
          <div className="rpt-t3">
            Columns show the {matrix.columns.length} most-common document types
            across tracked subs.
          </div>
        </div>
        {matrix.columns.length === 0 ? (
          <div style={{ padding: 20, color: "var(--t3)" }}>
            No compliance records logged yet.
          </div>
        ) : (
          <div className="rpt-tbl-scroll">
            <table className="rpt-data-tbl">
              <thead>
                <tr>
                  <th>Subcontractor</th>
                  <th>Trade</th>
                  {matrix.columns.map((col) => (
                    <th key={col} className="rpt-center">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.subOrganizationId}>
                    <td className="rpt-strong">{row.subName}</td>
                    <td className="rpt-t2">{row.primaryTrade ?? "—"}</td>
                    {matrix.columns.map((col) => {
                      const cell = row.cells[col] ?? "missing";
                      return (
                        <td key={col} className="rpt-center">
                          <span
                            className={cx(
                              "rpt-compl-cell",
                              `tone-${cellTone[cell]}`,
                            )}
                          >
                            {cellLabel[cell]}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------
// Saved & scheduled reports
// ----------------------------------------------------------------

// Presentation-layer map from report_type id → human-readable label.
// Kept here so adding a new report type surfaces in the Library without a
// schema change; unknown types fall back to a titlecased version of the id.
const REPORT_TYPE_LABELS: Record<string, string> = {
  overview: "Portfolio Overview",
  wip: "WIP Schedule",
  ar: "AR Aging",
  cost: "Job Cost",
  cashflow: "Cashflow Projection",
  payments: "Payment Tracking",
  labor: "Labor & Productivity",
  schedule: "Schedule Performance",
  compliance: "Compliance",
  "weekly-reports": "Weekly Reports",
  "lien-waivers": "Lien Waiver Log",
  procurement: "Procurement / POs",
};

function labelForReportType(id: string): string {
  if (REPORT_TYPE_LABELS[id]) return REPORT_TYPE_LABELS[id];
  return id
    .split(/[-_]/)
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function formatLastRun(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Step 52 — Safety Forms Summary panel.
function SafetyReport({ view }: { view: ReportsView }) {
  const safety = view.safety;
  if (!safety) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        Safety report unavailable.
      </div>
    );
  }
  if (safety.totals.total === 0) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        No safety forms submitted yet. Forms appear here once your crews
        start submitting toolbox talks, JHAs, or incident reports.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeading
        title="Safety Forms Summary"
        subtitle={`Generated ${new Date(safety.generatedAtIso).toLocaleString()}`}
      />
      <div className="rpt-kpis">
        <KPI label="Total submitted" value={String(safety.totals.total)} sub="all-time" tone="neutral" Icon={IconShieldCheck} />
        <KPI label="Last 30 days" value={String(safety.totals.last30dTotal)} tone="neutral" />
        <KPI label="Toolbox talks" value={String(safety.totals.toolboxTalks)} sub="crew sign-ins" tone="neutral" />
        <KPI label="JHAs" value={String(safety.totals.jhas)} sub="hazard analyses" tone="neutral" />
        <KPI label="Incidents" value={String(safety.totals.incidents)} sub={`${safety.openIncidents} open`} tone={safety.totals.incidents > 0 ? "warn" : "ok"} />
        <KPI label="Near misses" value={String(safety.totals.nearMisses)} tone="neutral" />
        <KPI label="Days w/o lost time" value={safety.daysWithoutLostTime != null ? String(safety.daysWithoutLostTime) : "—"} tone="ok" />
        <KPI label="Toolbox completion" value={`${safety.toolboxTalkCompletionPct}%`} sub="approx, demo" tone={safety.toolboxTalkCompletionPct >= 90 ? "ok" : "warn"} />
      </div>
      <Card>
        <SectionHeading title="By project" subtitle="Submission counts per project" />
        <div style={{ overflowX: "auto" }}>
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Project</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th style={{ textAlign: "right" }}>Toolbox</th>
                <th style={{ textAlign: "right" }}>JHA</th>
                <th style={{ textAlign: "right" }}>Incidents</th>
                <th style={{ textAlign: "right" }}>Near misses</th>
                <th>Last submitted</th>
              </tr>
            </thead>
            <tbody>
              {safety.byProject.map((p) => (
                <tr key={p.projectId}>
                  <td>{p.projectName}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--fm)" }}>{p.total}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--fm)" }}>{p.toolboxTalks}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--fm)" }}>{p.jhas}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--fm)" }}>{p.incidents}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--fm)" }}>{p.nearMisses}</td>
                  <td style={{ fontFamily: "var(--fm)", fontSize: 11.5, color: "var(--t3)" }}>
                    {p.lastSubmittedAt
                      ? p.lastSubmittedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// Step 53 — Time Tracking rollup tile. Reads aggregated minutes from
// `view.timeRollup` (populated by getContractorTimeRollup). The contractor
// never sees raw time-entry rows; this view trades that detail for org-wide
// crew totals + per-project hours.
function TimeRollupReport({ view }: { view: ReportsView }) {
  const t = view.timeRollup;
  if (!t) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        Time rollup unavailable.
      </div>
    );
  }
  const totalMins = t.totalApprovedMinutes + t.totalSubmittedMinutes;
  if (totalMins === 0) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        No time entries yet. Hours appear here once your subcontractors clock
        in and submit weekly timesheets.
      </div>
    );
  }
  const fmtMins = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionHeading
        title="Time Tracking Rollup"
        subtitle="Aggregated subcontractor hours by project and crew. Contractor view — no individual entry detail."
      />
      <div className="rpt-kpis">
        <KPI
          label="Approved hours"
          value={fmtMins(t.totalApprovedMinutes)}
          sub="approved + amended"
          tone="ok"
          Icon={IconClock}
        />
        <KPI
          label="Pending approval"
          value={fmtMins(t.totalSubmittedMinutes)}
          sub="awaiting sub admin review"
          tone={t.totalSubmittedMinutes > 0 ? "warn" : "neutral"}
        />
        <KPI
          label="Active subcontractors"
          value={String(t.bySubOrg.length)}
          sub="logging hours"
          tone="neutral"
        />
        <KPI
          label="Projects with time"
          value={String(t.byProject.length)}
          tone="neutral"
        />
      </div>
      <Card>
        <SectionHeading title="By project" subtitle="Hours per project" />
        <div style={{ overflowX: "auto" }}>
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Project</th>
                <th style={{ textAlign: "right" }}>Approved</th>
                <th style={{ textAlign: "right" }}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {t.byProject.map((p) => (
                <tr key={p.projectId}>
                  <td>{p.projectName}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--fm)" }}>
                    {fmtMins(p.approvedMinutes)}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--fm)" }}>
                    {p.submittedMinutes > 0 ? fmtMins(p.submittedMinutes) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <SectionHeading
          title="By subcontractor"
          subtitle="Crew hours across all projects"
        />
        <div style={{ overflowX: "auto" }}>
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Subcontractor</th>
                <th style={{ textAlign: "right" }}>Workers</th>
                <th style={{ textAlign: "right" }}>Approved</th>
                <th style={{ textAlign: "right" }}>Pending</th>
              </tr>
            </thead>
            <tbody>
              {t.bySubOrg.map((s) => (
                <tr key={s.organizationId}>
                  <td>{s.organizationName}</td>
                  <td style={{ textAlign: "right", fontFamily: "var(--fm)" }}>
                    {s.workerCount}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--fm)" }}>
                    {fmtMins(s.approvedMinutes)}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "var(--fm)" }}>
                    {s.submittedMinutes > 0 ? fmtMins(s.submittedMinutes) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SavedReportsView({ view }: { view: ReportsView }) {
  const saved = view.savedReports;
  const [q, setQ] = useState("");

  if (!saved) {
    return (
      <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)" }}>
        Saved reports library unavailable.
      </div>
    );
  }

  const rows = saved.rows;
  const filtered = rows.filter((r) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return (
      r.name.toLowerCase().includes(needle) ||
      labelForReportType(r.reportType).toLowerCase().includes(needle) ||
      (r.scopeDescription ?? "").toLowerCase().includes(needle)
    );
  });

  if (rows.length === 0) {
    return (
      <div>
        <div className="rpt-k-row three">
          <KPI label="Saved Reports" value="0" Icon={IconBookmark} />
          <KPI label="Scheduled" value="0" Icon={IconMail} />
          <KPI label="Recipients Reached" value="0" Icon={IconUsers} />
        </div>
        <Card>
          <div style={{ padding: 24, color: "var(--t3)", fontFamily: "var(--fb)", textAlign: "center" }}>
            <div style={{ fontWeight: 600, color: "var(--t2)", marginBottom: 6 }}>
              No saved reports yet
            </div>
            <div>
              Save a report with specific filters to re-run it in one click, or
              schedule it for email delivery on a cadence.
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="rpt-k-row three">
        <KPI
          label="Saved Reports"
          value={String(saved.totals.total)}
          Icon={IconBookmark}
        />
        <KPI
          label="Scheduled"
          value={String(saved.totals.scheduledCount)}
          sub="Auto-email cadence set"
          Icon={IconMail}
        />
        <KPI
          label="Recipients Reached"
          value={String(saved.totals.uniqueRecipients)}
          sub="Unique email addresses"
          Icon={IconUsers}
        />
      </div>

      <Card padded={false}>
        <div className="rpt-card-hdr rpt-saved-ctrl">
          <div className="rpt-saved-search">
            <IconSearch size={14} />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search saved reports…"
            />
          </div>
          <div className="rpt-t3">
            {filtered.length} of {rows.length}
          </div>
          <button type="button" className="rpt-btn primary small">
            <IconPlus size={12} /> New
          </button>
        </div>
        <table className="rpt-data-tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Scope</th>
              <th>Schedule</th>
              <th>Recipients</th>
              <th>Last Run</th>
              <th>Owner</th>
              <th className="rpt-right" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <div className="rpt-saved-name">
                    <IconBookmark size={12} />
                    {r.name}
                  </div>
                </td>
                <td>
                  <span className="rpt-saved-type">
                    {labelForReportType(r.reportType)}
                  </span>
                </td>
                <td className="rpt-t3">{r.scopeDescription ?? "—"}</td>
                <td className="rpt-t3">
                  {r.scheduleLabel ? (
                    <div className="rpt-saved-sched">
                      <IconMail size={11} />
                      {r.scheduleLabel}
                    </div>
                  ) : (
                    <span>On-demand</span>
                  )}
                </td>
                <td className="rpt-t3">
                  {r.recipients.length === 0
                    ? "—"
                    : r.recipients.length === 1
                      ? r.recipients[0]
                      : `${r.recipients[0]} +${r.recipients.length - 1}`}
                </td>
                <td className="rpt-t3 rpt-num">
                  {formatLastRun(r.lastRunAt)}
                </td>
                <td className="rpt-t3">{r.ownerName}</td>
                <td className="rpt-right">
                  <button
                    type="button"
                    className="rpt-icon-btn"
                    aria-label="Actions"
                  >
                    <IconMoreHorizontal size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
