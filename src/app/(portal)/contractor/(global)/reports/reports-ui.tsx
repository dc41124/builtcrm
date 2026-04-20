"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";

import { AgingBarChart } from "@/components/charts";
import type {
  ProjectReportRow,
  ReportsView,
} from "@/domain/loaders/reports";

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

import {
  SEED_AR_BY_CLIENT,
  SEED_AR_TREND,
  SEED_CASHFLOW,
  SEED_COMPLIANCE_EXPIRING,
  SEED_JOB_COST,
  SEED_LABOR_BY_PROJECT,
  SEED_LABOR_TREND,
  SEED_PROJECTS,
  SEED_SAVED_REPORTS,
  SEED_SCHEDULE_PERF,
  SEED_STARTING_BALANCE,
  SEED_SUB_MATRIX,
} from "./reports-seed";

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
  { id: "safety", category: "operational", label: "Safety Forms Summary", Icon: IconShieldCheck, desc: "Toolbox talks, JHAs, incidents", built: false, origin: "Step 52" },
  { id: "time", category: "operational", label: "Time Tracking Rollup", Icon: IconClock, desc: "Sub hours by project and crew", built: false, origin: "Step 53" },
  { id: "co-log", category: "operational", label: "Change Order Log", Icon: IconHammer, desc: "All COs with status and aging", built: false, origin: "Phase 4B" },
  { id: "rfi-log", category: "operational", label: "RFI Log", Icon: IconFileText, desc: "All RFIs with turnaround times", built: false, origin: "Phase 4B" },
  { id: "submittal-log", category: "operational", label: "Submittal Log", Icon: IconPackageCheck, desc: "Submittal status and reviewer activity", built: false, origin: "Step 20" },
  { id: "procurement", category: "operational", label: "Procurement / POs", Icon: IconTruck, desc: "POs by vendor, status, and aging", built: false, origin: "Step 41" },
  { id: "inspections", category: "operational", label: "Inspections Summary", Icon: IconClipboardCheck, desc: "QA/QC pass-fail trends", built: false, origin: "Step 45" },
  { id: "closeout", category: "operational", label: "Closeout Matrix", Icon: IconPackageCheck, desc: "Closeout completion per project", built: false, origin: "Step 48" },
  { id: "compliance", category: "compliance", label: "Compliance", Icon: IconShieldCheck, desc: "Expiring documents and sub matrix", built: true, origin: "Step 24.5" },
  { id: "prequal", category: "compliance", label: "Subcontractor Prequalification", Icon: IconCheckCircle2, desc: "Qualification status across subs", built: false, origin: "Step 49" },
  { id: "audit", category: "compliance", label: "Audit Log", Icon: IconHistory, desc: "System event history with filters", built: false, origin: "Phase 8-lite" },
  { id: "lien-waivers", category: "compliance", label: "Lien Waiver Log", Icon: IconFileText, desc: "Waiver status per draw and sub", built: false, origin: "Step 40" },
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

function fmtK(n: number): string {
  if (n === 0) return "—";
  return `$${n}K`;
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
  const [reportId, setReportId] = useState<string>("landing");
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

          <section className="rpt-hub-section">
            <SectionLabel>
              Saved &amp; scheduled · {SEED_SAVED_REPORTS.length}
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
                  {SEED_SAVED_REPORTS.slice(0, 4).map((r) => (
                    <tr key={r.id} onClick={() => openReport("saved")}>
                      <td>
                        <div className="rpt-saved-name">
                          <IconBookmark size={12} />
                          {r.name}
                        </div>
                      </td>
                      <td className="rpt-t3">{r.type}</td>
                      <td className="rpt-t3">{r.schedule}</td>
                      <td className="rpt-t3 rpt-num">{r.lastRun}</td>
                      <td className="rpt-t3 rpt-right">{r.owner}</td>
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
      return <WIPReport />;
    case "ar":
      return <ARReport />;
    case "cost":
      return <CostReport />;
    case "cashflow":
      return <CashflowReport />;
    case "payments":
      return <PaymentTrackingReport view={view} />;
    case "weekly-reports":
      return <WeeklyReportsAggregateReport view={view} />;
    case "labor":
      return <LaborReport />;
    case "schedule":
      return <ScheduleReport />;
    case "compliance":
      return <ComplianceReport />;
    case "saved":
      return <SavedReportsView />;
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

function formatCents(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(dollars) >= 1_000) {
    return `$${Math.round(dollars / 1_000).toLocaleString()}K`;
  }
  return `$${Math.round(dollars).toLocaleString()}`;
}

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

function WIPReport() {
  const rows = SEED_PROJECTS.map((p) => {
    const contractWithCO = p.contract + p.co;
    const pctComplete = p.costToDate / p.estTotalCost;
    const earned = contractWithCO * pctComplete;
    const overUnder = earned - p.billed;
    const backlog = contractWithCO - p.billed;
    return { ...p, contractWithCO, pctComplete, earned, overUnder, backlog };
  });
  const tot = rows.reduce(
    (a, r) => ({
      contractWithCO: a.contractWithCO + r.contractWithCO,
      costToDate: a.costToDate + r.costToDate,
      earned: a.earned + r.earned,
      billed: a.billed + r.billed,
      overUnder: a.overUnder + r.overUnder,
      backlog: a.backlog + r.backlog,
    }),
    { contractWithCO: 0, costToDate: 0, earned: 0, billed: 0, overUnder: 0, backlog: 0 },
  );

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Contract + COs"
          value={fmt(tot.contractWithCO)}
          Icon={IconWallet}
          trend={4.2}
          trendData={[6100, 6180, 6240, 6320, 6400, 6470, 6535, 6625]}
        />
        <KPI
          label="Earned Revenue"
          value={fmt(tot.earned)}
          sub={`${fmtPct(tot.earned / tot.contractWithCO)} of contract`}
          Icon={IconTrendingUp}
          trend={8.1}
          trendData={[2800, 2920, 3050, 3190, 3280, 3410, 3520, 3640]}
        />
        <KPI
          label="Net Over/Under"
          value={fmtSigned(tot.overUnder)}
          sub={tot.overUnder > 0 ? "Underbilled — catch up" : "Overbilled — healthy"}
          tone={tot.overUnder > 0 ? "warn" : "ok"}
          Icon={tot.overUnder > 0 ? IconAlertTriangle : IconCheckCircle2}
        />
        <KPI
          label="Backlog"
          value={fmt(tot.backlog)}
          sub="Contract remaining"
          Icon={IconFileText}
          trend={-2.3}
          trendData={[4800, 4720, 4680, 4590, 4510, 4450, 4380, 4280]}
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
                <tr key={r.id}>
                  <td>
                    <div className="rpt-tbl-project-name">{r.name}</div>
                    <div className="rpt-tbl-project-phase">
                      {r.phase} · {r.client}
                    </div>
                  </td>
                  <td className="rpt-right rpt-num">{fmt(r.contractWithCO)}</td>
                  <td className="rpt-right rpt-num rpt-t2">
                    {fmt(r.costToDate)}
                  </td>
                  <td className="rpt-right">
                    <div className="rpt-mini-pct">
                      <div className="rpt-mini-pct-bar">
                        <div
                          className="rpt-mini-pct-fill"
                          style={{
                            width: `${Math.min(100, r.pctComplete * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="rpt-num">{fmtPct(r.pctComplete)}</span>
                    </div>
                  </td>
                  <td className="rpt-right rpt-num">{fmt(r.earned)}</td>
                  <td className="rpt-right rpt-num">{fmt(r.billed)}</td>
                  <td
                    className={cx(
                      "rpt-right rpt-num rpt-strong",
                      r.overUnder > 0 ? "tone-warn" : "tone-ok",
                    )}
                  >
                    {fmtSigned(r.overUnder)}
                  </td>
                  <td className="rpt-right rpt-num rpt-t2">{fmt(r.backlog)}</td>
                </tr>
              ))}
              <tr className="rpt-tot">
                <td>Totals</td>
                <td className="rpt-right rpt-num">{fmt(tot.contractWithCO)}</td>
                <td className="rpt-right rpt-num">{fmt(tot.costToDate)}</td>
                <td className="rpt-right rpt-t3">—</td>
                <td className="rpt-right rpt-num">{fmt(tot.earned)}</td>
                <td className="rpt-right rpt-num">{fmt(tot.billed)}</td>
                <td
                  className={cx(
                    "rpt-right rpt-num",
                    tot.overUnder > 0 ? "tone-warn" : "tone-ok",
                  )}
                >
                  {fmtSigned(tot.overUnder)}
                </td>
                <td className="rpt-right rpt-num">{fmt(tot.backlog)}</td>
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

function ARReport() {
  const bucketTot = SEED_AR_BY_CLIENT.reduce(
    (a, r) => ({
      current: a.current + r.current,
      d1_30: a.d1_30 + r.d1_30,
      d31_60: a.d31_60 + r.d31_60,
      d61_90: a.d61_90 + r.d61_90,
      d90p: a.d90p + r.d90p,
    }),
    { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 },
  );
  const total = Object.values(bucketTot).reduce((a, b) => a + b, 0);
  const pastDue = total - bucketTot.current;
  const buckets: Array<{ label: string; value: number; tone: KpiTone }> = [
    { label: "Current", value: bucketTot.current, tone: "neutral" },
    { label: "1–30 days", value: bucketTot.d1_30, tone: "neutral" },
    { label: "31–60 days", value: bucketTot.d31_60, tone: "warn" },
    { label: "61–90 days", value: bucketTot.d61_90, tone: "crit" },
    { label: "90+ days", value: bucketTot.d90p, tone: "crit" },
  ];
  const over60 = bucketTot.d61_90 + bucketTot.d90p;
  const trendFinal = SEED_AR_TREND[SEED_AR_TREND.length - 1];
  const trendStart = SEED_AR_TREND[0];

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Total AR"
          value={fmt(total)}
          Icon={IconReceipt}
          trendData={SEED_AR_TREND}
          trend={6.1}
        />
        <KPI
          label="Current"
          value={fmt(bucketTot.current)}
          sub={`${fmtPct(bucketTot.current / total)} of AR`}
          tone="ok"
          Icon={IconCheckCircle2}
        />
        <KPI
          label="Past Due"
          value={fmt(pastDue)}
          sub={`${fmtPct(pastDue / total)} of AR`}
          tone="warn"
          Icon={IconClock}
        />
        <KPI
          label="60+ Days"
          value={fmt(over60)}
          sub="Escalate"
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
            <TrendArea data={SEED_AR_TREND} />
          </div>
          <div className="rpt-trend-foot">
            <div>
              <div className="rpt-eyebrow">Latest</div>
              <div className="rpt-trend-value">{fmt(trendFinal * 1000)}</div>
            </div>
            <div className="rpt-right">
              <div className="rpt-eyebrow">8wk change</div>
              <div className="rpt-trend-delta tone-ok">
                +{fmtPct((trendFinal - trendStart) / trendStart)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card padded={false}>
        <div className="rpt-card-hdr">
          <div className="rpt-eyebrow">By client</div>
          <div className="rpt-t3">
            {SEED_AR_BY_CLIENT.length} clients with outstanding AR
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
            {SEED_AR_BY_CLIENT.map((r) => {
              const rowTotal =
                r.current + r.d1_30 + r.d31_60 + r.d61_90 + r.d90p;
              return (
                <tr key={r.client}>
                  <td className="rpt-strong">{r.client}</td>
                  <td className="rpt-right rpt-num rpt-t2">{fmt(r.current)}</td>
                  <td className="rpt-right rpt-num rpt-t2">{fmt(r.d1_30)}</td>
                  <td
                    className={cx(
                      "rpt-right rpt-num",
                      r.d31_60 > 0 && "tone-warn rpt-strong",
                    )}
                  >
                    {fmt(r.d31_60)}
                  </td>
                  <td
                    className={cx(
                      "rpt-right rpt-num",
                      r.d61_90 > 0 && "tone-crit rpt-strong",
                    )}
                  >
                    {fmt(r.d61_90)}
                  </td>
                  <td
                    className={cx(
                      "rpt-right rpt-num",
                      r.d90p > 0 && "tone-crit rpt-strong",
                    )}
                  >
                    {fmt(r.d90p)}
                  </td>
                  <td className="rpt-right rpt-num rpt-strong">
                    {fmt(rowTotal)}
                  </td>
                </tr>
              );
            })}
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

function CostReport() {
  const rows = SEED_JOB_COST.map((p) => {
    const variance = p.projected - p.budget;
    const variancePct = variance / p.budget;
    const costUsed = p.actual / p.budget;
    return { ...p, variance, variancePct, costUsed };
  });
  const tot = rows.reduce(
    (a, r) => ({
      budget: a.budget + r.budget,
      committed: a.committed + r.committed,
      actual: a.actual + r.actual,
      projected: a.projected + r.projected,
    }),
    { budget: 0, committed: 0, actual: 0, projected: 0 },
  );
  const totVar = tot.projected - tot.budget;

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI label="Total Budget" value={fmt(tot.budget)} Icon={IconCalculator} />
        <KPI
          label="Committed"
          value={fmt(tot.committed)}
          sub={`${fmtPct(tot.committed / tot.budget)} of budget`}
          Icon={IconFileText}
        />
        <KPI
          label="Actual Spent"
          value={fmt(tot.actual)}
          sub={`${fmtPct(tot.actual / tot.budget)} of budget`}
          Icon={IconTrendingUp}
        />
        <KPI
          label="Projected Variance"
          value={fmtSigned(totVar)}
          tone={totVar > 0 ? "crit" : "ok"}
          sub={`${totVar >= 0 ? "+" : ""}${((totVar / tot.budget) * 100).toFixed(1)}% vs budget`}
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
            <CostTrack key={r.id} row={r} />
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
              <tr key={r.id}>
                <td className="rpt-strong">{r.name}</td>
                <td className="rpt-right rpt-num">{fmt(r.budget)}</td>
                <td className="rpt-right rpt-num rpt-t2">{fmt(r.committed)}</td>
                <td className="rpt-right rpt-num">{fmt(r.actual)}</td>
                <td className="rpt-right rpt-num rpt-strong">
                  {fmt(r.projected)}
                </td>
                <td
                  className={cx(
                    "rpt-right rpt-num rpt-strong",
                    r.variance > 0
                      ? "tone-crit"
                      : r.variance < 0
                        ? "tone-ok"
                        : "rpt-t3",
                  )}
                >
                  {fmtSigned(r.variance)}
                </td>
                <td>
                  <div className="rpt-mini-pct">
                    <div className="rpt-mini-pct-bar">
                      <div
                        className={cx(
                          "rpt-mini-pct-fill",
                          r.costUsed > 0.9
                            ? "tone-crit"
                            : r.costUsed > 0.75
                              ? "tone-warn"
                              : "tone-ok",
                        )}
                        style={{
                          width: `${Math.min(100, r.costUsed * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="rpt-num rpt-t2">
                      {fmtPct(r.costUsed)}
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

type CostRow = {
  name: string;
  budget: number;
  committed: number;
  actual: number;
  projected: number;
  variance: number;
  variancePct: number;
};

function CostTrack({ row }: { row: CostRow }) {
  const scale = Math.max(row.budget, row.projected) * 1.08;
  const pos = (v: number) => (v / scale) * 100;
  const budgetX = pos(row.budget);
  const committedX = pos(row.committed);
  const actualX = pos(row.actual);
  const projectedX = pos(row.projected);
  const overrun = row.projected > row.budget;

  return (
    <div className="rpt-cost-track">
      <div className="rpt-cost-track-hdr">
        <div className="rpt-strong">{row.name}</div>
        <div
          className={cx(
            "rpt-num rpt-strong",
            row.variance > 0
              ? "tone-crit"
              : row.variance < 0
                ? "tone-ok"
                : "rpt-t3",
          )}
        >
          {fmtSigned(row.variance)}{" "}
          <span className="rpt-t3">
            ({row.variance >= 0 ? "+" : ""}
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
          value={fmt(row.actual)}
          tone="ac"
          position="top"
        />
        <CostMarker
          x={committedX}
          label="Committed"
          value={fmt(row.committed)}
          tone="muted"
          position="bottom"
        />
        <CostMarker
          x={budgetX}
          label="Budget"
          value={fmt(row.budget)}
          tone="ink"
          position="top"
          isLine
        />
        <CostMarker
          x={projectedX}
          label="Projected"
          value={fmt(row.projected)}
          tone={overrun ? "crit" : "ok"}
          position="bottom"
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
  isLine,
}: {
  x: number;
  label: string;
  value: string;
  tone: "ac" | "muted" | "ink" | "ok" | "crit";
  position: "top" | "bottom";
  isLine?: boolean;
}) {
  return (
    <div
      className={cx("rpt-cost-marker", `pos-${position}`, `tone-${tone}`)}
      style={{ left: `${x}%` }}
    >
      {isLine ? (
        <div className="rpt-cost-marker-line" />
      ) : (
        <div className="rpt-cost-marker-dot" />
      )}
      <div className="rpt-cost-marker-cap">
        <div className="rpt-cost-marker-label">{label}</div>
        <div className="rpt-cost-marker-value rpt-num">{value}</div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Cashflow Projection
// ----------------------------------------------------------------

function CashflowReport() {
  let balance = SEED_STARTING_BALANCE;
  const enriched = SEED_CASHFLOW.map((w) => {
    const net = w.in - w.out;
    balance += net;
    return { ...w, net, balance };
  });
  const totalIn = enriched.reduce((a, w) => a + w.in, 0);
  const totalOut = enriched.reduce((a, w) => a + w.out, 0);
  const endBalance = balance;
  const minBalance = Math.min(...enriched.map((w) => w.balance));
  const lowWeek = enriched.find((w) => w.balance === minBalance);

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Starting Balance"
          value={fmtK(SEED_STARTING_BALANCE)}
          Icon={IconWallet}
        />
        <KPI
          label="Projected Inflows"
          value={fmtK(totalIn)}
          sub="Next 12 weeks"
          tone="ok"
          Icon={IconArrowUpRight}
        />
        <KPI
          label="Projected Outflows"
          value={fmtK(totalOut)}
          sub="Next 12 weeks"
          tone="warn"
          Icon={IconArrowDownRight}
        />
        <KPI
          label="Projected End Balance"
          value={fmtK(endBalance)}
          sub={`Low point ${fmtK(minBalance)} at ${lowWeek?.week ?? "—"}`}
          tone={minBalance < 200 ? "crit" : minBalance < 400 ? "warn" : "ok"}
          Icon={IconTrendingUp}
        />
      </div>

      <Card className="rpt-mb">
        <SectionHeading
          title="Inflows, outflows &amp; running balance"
          subtitle="Paired bars show gross weekly flow side-by-side (inflow left, outflow right). The accent line traces running cash position."
        />
        <CashflowChart data={enriched} />
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
            {enriched.map((w) => (
              <tr key={w.week}>
                <td className="rpt-strong">{w.week}</td>
                <td className="rpt-t2">{w.date}</td>
                <td className="rpt-right rpt-num tone-ok">{fmtK(w.in)}</td>
                <td className="rpt-right rpt-num tone-crit">-{fmtK(w.out)}</td>
                <td
                  className={cx(
                    "rpt-right rpt-num rpt-strong",
                    w.net >= 0 ? "tone-ok" : "tone-crit",
                  )}
                >
                  {w.net >= 0 ? "+" : ""}
                  {fmtK(Math.abs(w.net))}
                </td>
                <td
                  className={cx(
                    "rpt-right rpt-num rpt-strong",
                    w.balance < 200
                      ? "tone-crit"
                      : w.balance < 400
                        ? "tone-warn"
                        : undefined,
                  )}
                >
                  {fmtK(w.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CashflowChart({
  data,
}: {
  data: Array<{
    week: string;
    date: string;
    in: number;
    out: number;
    net: number;
    balance: number;
  }>;
}) {
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

  const balances = data.map((d) => d.balance);
  const rawMaxBal = Math.max(...balances);
  const maxBal = Math.ceil(rawMaxBal / 200) * 200 || 200;

  const maxFlow = Math.max(...data.map((d) => Math.max(d.in, d.out)));
  const slotW = plotW / data.length;
  const barW = Math.min(8, slotW * 0.22);
  const flowScale = barBandH / (maxFlow || 1);

  const balPts = data.map((d, i) => {
    const x = pad.left + slotW * i + slotW / 2;
    const y = balBandTop + balBandH - (d.balance / maxBal) * balBandH;
    return [x, y] as const;
  });
  const linePath = balPts.reduce(
    (p, [x, y], i) => (i === 0 ? `M ${x},${y}` : `${p} L ${x},${y}`),
    "",
  );
  const areaPath = `${linePath} L ${balPts[balPts.length - 1][0]},${balBandTop + balBandH} L ${balPts[0][0]},${balBandTop + balBandH} Z`;

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
        const y = balBandTop + balBandH - t * balBandH;
        const val = Math.round(t * maxBal);
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
              ${val}K
            </text>
          </g>
        );
      })}

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
        const inH = d.in * flowScale;
        const outH = d.out * flowScale;
        return (
          <g key={`bars-${d.week}`}>
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
            LOW ${Math.round(minVal)}K
          </text>
        </g>
      )}

      {/* x-axis labels — safely below baseline in the pad.bottom region */}
      {data.map((d, i) => {
        const x = pad.left + slotW * i + slotW / 2;
        return (
          <g key={`x-${d.week}`}>
            <text
              x={x}
              y={baseY + 18}
              fontSize="10"
              fill="var(--t2)"
              textAnchor="middle"
              fontWeight="600"
              letterSpacing="0.02em"
            >
              {d.week}
            </text>
            <text
              x={x}
              y={baseY + 34}
              fontSize="9"
              fill="var(--t3)"
              textAnchor="middle"
            >
              {d.date}
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
// Labor & Productivity
// ----------------------------------------------------------------

function LaborReport() {
  const tot = SEED_LABOR_BY_PROJECT.reduce(
    (a, r) => ({
      hoursActual: a.hoursActual + r.hoursActual,
      hoursBudget: a.hoursBudget + r.hoursBudget,
      costActual: a.costActual + r.costActual,
      costBudget: a.costBudget + r.costBudget,
    }),
    { hoursActual: 0, hoursBudget: 0, costActual: 0, costBudget: 0 },
  );
  const avgRate = tot.costActual / tot.hoursActual;
  const hoursPct = tot.hoursActual / tot.hoursBudget;
  const costPct = tot.costActual / tot.costBudget;
  const hoursVar = tot.hoursActual - tot.hoursBudget;

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Hours Logged"
          value={tot.hoursActual.toLocaleString()}
          sub={`${Math.round(hoursPct * 100)}% of budget`}
          Icon={IconClock}
          tone={hoursPct > 1 ? "warn" : "neutral"}
          trendData={SEED_LABOR_TREND}
          trend={8.2}
        />
        <KPI
          label="Labor Cost"
          value={fmt(tot.costActual)}
          sub={`${Math.round(costPct * 100)}% of budget`}
          Icon={IconWallet}
          tone={costPct > 1 ? "warn" : "neutral"}
        />
        <KPI
          label="Avg Blended Rate"
          value={`$${Math.round(avgRate)}/hr`}
          sub="All trades combined"
          Icon={IconUsers}
        />
        <KPI
          label="Hours Variance"
          value={`${hoursVar >= 0 ? "+" : "-"}${Math.abs(hoursVar).toLocaleString()}`}
          sub="vs. budget"
          tone={hoursVar > 0 ? "warn" : "ok"}
          Icon={hoursVar > 0 ? IconAlertTriangle : IconCheckCircle2}
        />
      </div>

      <Card className="rpt-mb">
        <SectionHeading
          title="Hours composition by trade"
          subtitle="Per-project stacked segments show how hours distribute across trades. Tonal palette keeps the chart reading as data, not decoration."
        />
        <LaborStackedBars data={SEED_LABOR_BY_PROJECT} />
      </Card>

      <Card padded={false}>
        <table className="rpt-data-tbl">
          <thead>
            <tr>
              <th>Project</th>
              <th className="rpt-right">Hours Actual</th>
              <th className="rpt-right">Hours Budget</th>
              <th className="rpt-right">Cost Actual</th>
              <th className="rpt-right">Cost Budget</th>
              <th className="rpt-right">Rate</th>
              <th className="rpt-col-used">Burn</th>
            </tr>
          </thead>
          <tbody>
            {SEED_LABOR_BY_PROJECT.map((r) => {
              const burn = r.hoursActual / r.hoursBudget;
              const rate = r.costActual / r.hoursActual;
              return (
                <tr key={r.id}>
                  <td className="rpt-strong">{r.name}</td>
                  <td className="rpt-right rpt-num">
                    {r.hoursActual.toLocaleString()}
                  </td>
                  <td className="rpt-right rpt-num rpt-t2">
                    {r.hoursBudget.toLocaleString()}
                  </td>
                  <td className="rpt-right rpt-num">{fmt(r.costActual)}</td>
                  <td className="rpt-right rpt-num rpt-t2">
                    {fmt(r.costBudget)}
                  </td>
                  <td className="rpt-right rpt-num rpt-t2">
                    ${Math.round(rate)}/hr
                  </td>
                  <td>
                    <div className="rpt-mini-pct">
                      <div className="rpt-mini-pct-bar">
                        <div
                          className={cx(
                            "rpt-mini-pct-fill",
                            burn > 1
                              ? "tone-crit"
                              : burn > 0.9
                                ? "tone-warn"
                                : "tone-ok",
                          )}
                          style={{ width: `${Math.min(100, burn * 100)}%` }}
                        />
                      </div>
                      <span
                        className={cx(
                          "rpt-num rpt-strong",
                          burn > 1 ? "tone-crit" : "rpt-t2",
                        )}
                      >
                        {Math.round(burn * 100)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const TRADE_KEYS = ["gc", "electrical", "plumbing", "framing", "hvac", "other"] as const;
type TradeKey = (typeof TRADE_KEYS)[number];

const TRADE_LABELS: Record<TradeKey, string> = {
  gc: "GC Labor",
  electrical: "Electrical",
  plumbing: "Plumbing",
  framing: "Framing",
  hvac: "HVAC",
  other: "Other",
};

function LaborStackedBars({
  data,
}: {
  data: typeof SEED_LABOR_BY_PROJECT;
}) {
  const maxHours = Math.max(...data.map((d) => d.hoursActual));
  return (
    <div className="rpt-labor-stack">
      <div className="rpt-labor-rows">
        {data.map((p) => {
          const pct = p.hoursActual / maxHours;
          let cursor = 0;
          return (
            <div key={p.id} className="rpt-labor-row">
              <div className="rpt-labor-row-hdr">
                <div className="rpt-strong">{p.name}</div>
                <div className="rpt-t3 rpt-num">
                  {p.hoursActual.toLocaleString()} hrs · {fmt(p.costActual)}
                </div>
              </div>
              <div
                className="rpt-labor-bar"
                style={{
                  width: `${Math.max(pct * 100, 10)}%`,
                }}
              >
                {TRADE_KEYS.map((t, i) => {
                  const segPct = (p.trades[t] / p.hoursActual) * 100;
                  const style: React.CSSProperties = {
                    left: `${cursor}%`,
                    width: `${segPct}%`,
                  };
                  cursor += segPct;
                  return (
                    <div
                      key={t}
                      className={cx(
                        "rpt-labor-seg",
                        `trade-${t}`,
                        i < TRADE_KEYS.length - 1 && "has-divider",
                      )}
                      style={style}
                      title={`${TRADE_LABELS[t]}: ${p.trades[t]}h`}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="rpt-labor-legend">
        {TRADE_KEYS.map((t) => (
          <div key={t} className="rpt-labor-legend-item">
            <div className={cx("rpt-labor-swatch", `trade-${t}`)} />
            <span>{TRADE_LABELS[t]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Schedule Performance
// ----------------------------------------------------------------

function ScheduleReport() {
  const avgSpi =
    SEED_SCHEDULE_PERF.reduce((a, p) => a + p.spi, 0) /
    SEED_SCHEDULE_PERF.length;
  const behind = SEED_SCHEDULE_PERF.filter((p) => p.spi < 0.95).length;
  const ahead = SEED_SCHEDULE_PERF.filter((p) => p.spi > 1.05).length;
  const onTrack = SEED_SCHEDULE_PERF.length - behind - ahead;

  return (
    <div>
      <div className="rpt-k-row four">
        <KPI
          label="Portfolio SPI"
          value={avgSpi.toFixed(2)}
          sub={avgSpi >= 0.95 ? "On track overall" : "Portfolio drift"}
          tone={avgSpi >= 0.95 ? "ok" : "warn"}
          Icon={IconCalendarClock}
        />
        <KPI
          label="Projects Behind"
          value={String(behind)}
          sub="SPI < 0.95"
          tone={behind > 0 ? "warn" : "ok"}
          Icon={IconAlertTriangle}
        />
        <KPI
          label="On Track"
          value={String(onTrack)}
          sub="SPI 0.95–1.05"
          tone="ok"
          Icon={IconCheckCircle2}
        />
        <KPI
          label="Ahead"
          value={String(ahead)}
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
          {SEED_SCHEDULE_PERF.map((p) => (
            <SPITrack key={p.id} project={p} />
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeading
          title="Planned vs actual timeline"
          subtitle="Hairline for planned duration. Filled line for actual/forecast. Dashed red line marks today."
        />
        <GanttStrip data={SEED_SCHEDULE_PERF} />
      </Card>
    </div>
  );
}

function SPITrack({
  project,
}: {
  project: (typeof SEED_SCHEDULE_PERF)[number];
}) {
  const SPI_MIN = 0.7;
  const SPI_MAX = 1.3;
  const range = SPI_MAX - SPI_MIN;
  const spi = Math.min(Math.max(project.spi, SPI_MIN), SPI_MAX);
  const x = ((spi - SPI_MIN) / range) * 100;
  const onScheduleX = ((1 - SPI_MIN) / range) * 100;
  const tone: KpiTone = spi < 0.95 ? "crit" : spi > 1.05 ? "neutral" : "ok";
  const status = spi < 0.95 ? "Behind" : spi > 1.05 ? "Ahead" : "On track";
  const milestonesPct = project.milestonesHit / project.milestonesTotal;

  return (
    <div className="rpt-spi">
      <div className="rpt-spi-head">
        <div className="rpt-spi-head-l">
          <div className="rpt-strong">{project.name}</div>
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

function GanttStrip({
  data,
}: {
  data: typeof SEED_SCHEDULE_PERF;
}) {
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
          <g key={p.id}>
            <text x="8" y={y + 10} fontSize="12" fill="var(--t1)" fontWeight="500">
              {p.name}
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

function ComplianceReport() {
  const critCount = SEED_COMPLIANCE_EXPIRING.filter(
    (e) => e.sev === "critical",
  ).length;
  const warnCount = SEED_COMPLIANCE_EXPIRING.filter(
    (e) => e.sev === "warning",
  ).length;

  const cellLabel: Record<string, string> = {
    ok: "✓",
    expiring: "!",
    warning: "!",
    missing: "✕",
    "n/a": "—",
  };

  return (
    <div>
      <div className="rpt-k-row three">
        <KPI
          label="Critical"
          value={String(critCount)}
          sub="Expiring ≤14 days or missing"
          tone="crit"
          Icon={IconAlertTriangle}
        />
        <KPI
          label="Warning"
          value={String(warnCount)}
          sub="Expiring 15–45 days"
          tone="warn"
          Icon={IconClock}
        />
        <KPI
          label="Subs Tracked"
          value={String(SEED_SUB_MATRIX.length)}
          sub="Active on current projects"
          Icon={IconUsers}
        />
      </div>

      <Card className="rpt-mb" padded={false}>
        <div className="rpt-card-hdr">
          <div className="rpt-eyebrow">Expiring in the next 90 days</div>
        </div>
        <div className="rpt-compl-list">
          {SEED_COMPLIANCE_EXPIRING.map((e, i) => (
            <div key={i} className="rpt-compl-row">
              <div className="rpt-compl-row-l">
                <span
                  className={cx(
                    "rpt-compl-sev-pill",
                    `tone-${e.sev === "critical" ? "crit" : e.sev === "warning" ? "warn" : "ok"}`,
                  )}
                >
                  {e.sev}
                </span>
                <div>
                  <div className="rpt-strong">{e.sub}</div>
                  <div className="rpt-t3">{e.doc}</div>
                </div>
              </div>
              <div className="rpt-right">
                <div className="rpt-num">{e.expires}</div>
                <div className="rpt-t3">
                  {e.days === null ? "Document missing" : `in ${e.days} days`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padded={false}>
        <div className="rpt-card-hdr">
          <div className="rpt-eyebrow">Subcontractor compliance matrix</div>
        </div>
        <table className="rpt-data-tbl">
          <thead>
            <tr>
              <th>Subcontractor</th>
              <th>Trade</th>
              <th className="rpt-center">GL</th>
              <th className="rpt-center">WC</th>
              <th className="rpt-center">Auto</th>
              <th className="rpt-center">Bond</th>
              <th className="rpt-center">W-9</th>
              <th className="rpt-center">License</th>
            </tr>
          </thead>
          <tbody>
            {SEED_SUB_MATRIX.map((s) => (
              <tr key={s.name}>
                <td className="rpt-strong">{s.name}</td>
                <td className="rpt-t2">{s.trade}</td>
                {(["gl", "wc", "auto", "bond", "w9", "license"] as const).map(
                  (k) => {
                    const cell = s[k];
                    const cellTone =
                      cell === "ok"
                        ? "ok"
                        : cell === "missing"
                          ? "crit"
                          : cell === "expiring" || cell === "warning"
                            ? "warn"
                            : "muted";
                    return (
                      <td key={k} className="rpt-center">
                        <span
                          className={cx(
                            "rpt-compl-cell",
                            `tone-${cellTone}`,
                          )}
                        >
                          {cellLabel[cell] ?? "—"}
                        </span>
                      </td>
                    );
                  },
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ----------------------------------------------------------------
// Saved & scheduled reports
// ----------------------------------------------------------------

function SavedReportsView() {
  const [q, setQ] = useState("");
  const filtered = SEED_SAVED_REPORTS.filter(
    (r) =>
      r.name.toLowerCase().includes(q.toLowerCase()) ||
      r.type.toLowerCase().includes(q.toLowerCase()),
  );
  const scheduledCount = SEED_SAVED_REPORTS.filter((r) => r.schedule).length;
  const uniqueRecipients = new Set(
    SEED_SAVED_REPORTS.flatMap((r) => r.recipients),
  ).size;

  return (
    <div>
      <div className="rpt-k-row three">
        <KPI
          label="Saved Reports"
          value={String(SEED_SAVED_REPORTS.length)}
          Icon={IconBookmark}
        />
        <KPI
          label="Scheduled"
          value={String(scheduledCount)}
          sub="Auto-email cadence set"
          Icon={IconMail}
        />
        <KPI
          label="Recipients Reached"
          value={String(uniqueRecipients)}
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
            {filtered.length} of {SEED_SAVED_REPORTS.length}
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
                  <span className="rpt-saved-type">{r.type}</span>
                </td>
                <td className="rpt-t3">{r.scope}</td>
                <td className="rpt-t3">
                  <div className="rpt-saved-sched">
                    <IconMail size={11} />
                    {r.schedule}
                  </div>
                </td>
                <td className="rpt-t3">
                  {r.recipients.length === 1
                    ? r.recipients[0]
                    : `${r.recipients[0]} +${r.recipients.length - 1}`}
                </td>
                <td className="rpt-t3 rpt-num">{r.lastRun}</td>
                <td className="rpt-t3">{r.owner}</td>
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
