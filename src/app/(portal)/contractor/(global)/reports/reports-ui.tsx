"use client";

import { useMemo, useState } from "react";

import { AgingBarChart } from "@/components/charts";
import type {
  ProjectReportRow,
  ReportsView,
} from "@/domain/loaders/reports";

// Reports workspace — client UI for the contractor's portfolio
// dashboard (Step 24). Two responsive breakpoints:
//   < 900px  → single-column stack; 8-col project table collapses
//              to essentials (name, status, % complete, billed,
//              open items); aging chart shrinks via recharts'
//              ResponsiveContainer.
//   900–1200 → still the trimmed column set, table doesn't scroll
//              horizontally.
//   ≥ 1200   → full 8-column table, KPI strip in three grouped
//              blocks side-by-side.
//
// KPI grouping per advisor directive: Financial / Operational / Risk.
// Risk block tints red when any of its counts > 0 so a scanning PM
// lands on problem signals before reading the other two.

// ----------------------------------------------------------------
// Formatting
// ----------------------------------------------------------------

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

function formatPercent(pct: number | null): string {
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

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

export function ReportsWorkspace({ view }: { view: ReportsView }) {
  const { context, generatedAtIso, kpis, projects, aging } = view;
  const [exporting, setExporting] = useState(false);

  const riskHot = kpis.complianceAlerts > 0 || kpis.scheduleAtRisk > 0;

  const onExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/export/reports", { method: "GET" });
      if (!res.ok) {
        setExporting(false);
        return;
      }
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

  const generatedLabel = useMemo(
    () => new Date(generatedAtIso).toLocaleString(),
    [generatedAtIso],
  );

  return (
    <main className="rpt">
      <header className="rpt-hdr">
        <div>
          <h1>Reports</h1>
          <div className="rpt-sub">
            {context.organization.name} · {projects.length} project
            {projects.length === 1 ? "" : "s"} · updated {generatedLabel}
          </div>
        </div>
        <button
          type="button"
          className="rpt-btn primary"
          onClick={onExport}
          disabled={exporting}
        >
          {exporting ? "Exporting…" : "Export PDF"}
        </button>
      </header>

      <section className="rpt-kpi-groups">
        <KpiGroup label="Financial">
          <KpiCard label="Contract value" value={formatCents(kpis.totalContractCents)} />
          <KpiCard label="Billed" value={formatCents(kpis.totalBilledCents)} />
          <KpiCard label="Unpaid" value={formatCents(kpis.totalUnpaidCents)} />
        </KpiGroup>
        <KpiGroup label="Operational">
          <KpiCard label="Active projects" value={String(kpis.activeProjects)} />
          <KpiCard label="Open RFIs" value={String(kpis.openRfis)} linkHref="/contractor/rfis" />
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
    </main>
  );
}

// ----------------------------------------------------------------
// KPI cards
// ----------------------------------------------------------------

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
    <div className={`rpt-kpi-group ${tone === "risk" ? "risk" : ""}`}>
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
    <div className={`rpt-kpi-card ${tone === "risk" ? "risk" : ""}`}>
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

// ----------------------------------------------------------------
// Projects table
// ----------------------------------------------------------------

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
                width: p.percentComplete != null ? `${p.percentComplete}%` : "0%",
              }}
            />
          </div>
          <span className="rpt-pct-label">
            {formatPercent(p.percentComplete)}
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
