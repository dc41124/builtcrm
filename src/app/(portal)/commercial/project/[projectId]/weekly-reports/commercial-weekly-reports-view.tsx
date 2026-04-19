"use client";

import { useMemo, type CSSProperties } from "react";
import Link from "next/link";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/pill";
import type {
  ClientWeeklyReportDetailView,
  ClientWeeklyReportsView,
  WeeklyReportSection,
  WeeklyReportSummaryRow,
} from "@/domain/loaders/weekly-reports";

// Commercial client weekly-report read view. Mirrors the prototype's
// 2-column commercial layout: reports timeline (left) | document-style
// read (right). Print stylesheet (in app globals) gives a passable
// "Save as PDF" via browser print until the @react-pdf/renderer wiring
// lands in a later step.

// --------------------------------------------------------------------------
// Root
// --------------------------------------------------------------------------

export function CommercialWeeklyReportsView({
  projectId,
  listView,
  detail,
}: {
  projectId: string;
  listView: ClientWeeklyReportsView;
  detail: ClientWeeklyReportDetailView | null;
}) {
  const totals = useMemo(() => computeClientTotals(listView.reports), [
    listView.reports,
  ]);

  return (
    <div className="apw">
      <header className="apw-head">
        <div className="apw-head-main">
          <h1 className="apw-title">Weekly reports</h1>
          <p className="apw-desc">
            Each Monday, your contractor sends a summary of the prior week on
            site. Reports include daily logs, photos, milestone status, and
            any open RFIs or change orders.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }} className="no-print">
          <Button variant="secondary" onClick={() => window.print()}>
            Save as PDF
          </Button>
        </div>
      </header>

      <div className="apw-kpis no-print">
        <KpiTile
          label="Latest report"
          value={
            totals.latest
              ? formatWeekShort(totals.latest.weekStart, totals.latest.weekEnd)
              : "—"
          }
          meta={
            totals.latest && totals.latest.sentAt
              ? `Sent ${formatDateTime(totals.latest.sentAt)}`
              : "Nothing sent yet"
          }
          tone="accent"
        />
        <KpiTile
          label="Received"
          value={totals.total.toString()}
          meta="Since project start"
        />
        <KpiTile
          label="Latest sender"
          value={totals.latest?.sentByName ?? "—"}
          meta="Contractor on this project"
        />
      </div>

      <div style={gridStyle}>
        <Timeline
          projectId={projectId}
          reports={listView.reports}
          activeId={detail?.report.id ?? null}
        />
        {detail ? (
          <ReportDocument detail={detail} />
        ) : (
          <div style={{ ...docStyle, padding: 32 }}>
            <EmptyState
              title={
                listView.reports.length === 0
                  ? "No reports yet"
                  : "Select a report"
              }
              description={
                listView.reports.length === 0
                  ? "Your contractor will send reports each Monday morning."
                  : "Pick a week from the timeline."
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Timeline (left)
// --------------------------------------------------------------------------

function Timeline({
  projectId,
  reports,
  activeId,
}: {
  projectId: string;
  reports: WeeklyReportSummaryRow[];
  activeId: string | null;
}) {
  return (
    <div style={{ ...timelineStyle }} className="no-print">
      <div style={timelineHeaderStyle}>Reports timeline</div>
      {reports.length === 0 ? (
        <div style={{ padding: 16 }}>
          <EmptyState
            title="No reports yet"
            description="Coming each Monday."
          />
        </div>
      ) : (
        reports.map((r) => (
          <Link
            key={r.id}
            href={`/commercial/project/${projectId}/weekly-reports?report=${r.id}`}
            style={timelineItemStyle(activeId === r.id)}
          >
            <div style={timelineItemWeekStyle(activeId === r.id)}>
              Week of {formatWeekShort(r.weekStart, r.weekEnd)}
            </div>
            <div style={timelineItemMetaStyle}>
              {r.sentAt ? `Sent ${formatDateTime(r.sentAt)}` : "—"}
            </div>
          </Link>
        ))
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Doc-style read (right)
// --------------------------------------------------------------------------

function ReportDocument({ detail }: { detail: ClientWeeklyReportDetailView }) {
  const { report, project } = detail;
  return (
    <article style={docStyle}>
      <header style={docHeaderStyle}>
        <div style={docKickerStyle}>Weekly Report</div>
        <h2 style={docTitleStyle}>
          Week of {formatWeekRange(report.weekStart, report.weekEnd)}
        </h2>
        <div style={docMetaStyle}>
          {project.name}
          <br />
          {report.sentByName
            ? `Sent by ${report.sentByName}`
            : "Sent"}
          {report.sentAt ? ` · ${formatDateTime(report.sentAt)}` : ""}
        </div>
      </header>

      <div style={docBodyStyle}>
        {report.summaryText && (
          <DocSection title="Summary">
            <p style={docPStyle}>{report.summaryText}</p>
          </DocSection>
        )}

        {report.sections.map((section) => (
          <DocSectionRenderer key={section.id} section={section} />
        ))}
      </div>

      <footer style={docFooterStyle} className="no-print">
        <div style={docFooterMetaStyle}>
          Questions or comments? Reply in Messages.
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Button variant="secondary" onClick={() => window.print()}>
            Save as PDF
          </Button>
        </div>
      </footer>
    </article>
  );
}

function DocSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={docSecStyle}>
      <h3 style={docSecTitleStyle}>{title}</h3>
      {children}
    </section>
  );
}

function DocSectionRenderer({ section }: { section: WeeklyReportSection }) {
  switch (section.sectionType) {
    case "milestones":
      return <MilestonesDoc section={section} />;
    case "photos":
      return <PhotosDoc section={section} />;
    case "rfis":
      return <RfisDoc section={section} />;
    case "change_orders":
      return <ChangeOrdersDoc section={section} />;
    case "daily_logs":
      return <DailyLogsDoc section={section} />;
    case "issues":
      return <IssuesDoc section={section} />;
  }
}

function MilestonesDoc({ section }: { section: WeeklyReportSection }) {
  const closed = (section.content.closed as MilestoneItem[] | undefined) ?? [];
  const upcoming = (section.content.upcoming as MilestoneItem[] | undefined) ?? [];
  if (closed.length === 0 && upcoming.length === 0) return null;
  return (
    <DocSection title="On site this week">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {closed.map((m) => (
          <div key={m.milestoneId} style={docRowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={docRowTitleStyle}>{m.title}</div>
              <div style={docRowMetaStyle}>
                Closed {m.closedAt ? formatDateTime(new Date(m.closedAt)) : "—"}
              </div>
            </div>
            <Pill color="green">Closed</Pill>
          </div>
        ))}
        {upcoming.map((m) => (
          <div key={m.milestoneId} style={docRowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={docRowTitleStyle}>{m.title}</div>
              <div style={docRowMetaStyle}>
                Coming {m.dueDate ? formatDateTime(new Date(m.dueDate)) : "—"}
              </div>
            </div>
            <Pill color="blue">Upcoming</Pill>
          </div>
        ))}
      </div>
    </DocSection>
  );
}

function PhotosDoc({ section }: { section: WeeklyReportSection }) {
  const items = (section.content.items as PhotoItem[] | undefined) ?? [];
  if (items.length === 0) return null;
  return (
    <DocSection title="Photos from site">
      <div style={photosGridStyle}>
        {items.slice(0, 12).map((p) => (
          <div key={p.photoId} style={photoTileStyle}>
            <div style={photoCaptionStyle}>{p.caption ?? "Untitled"}</div>
          </div>
        ))}
      </div>
    </DocSection>
  );
}

function RfisDoc({ section }: { section: WeeklyReportSection }) {
  const opened = (section.content.opened as RfiItem[] | undefined) ?? [];
  const closed = (section.content.closed as RfiItem[] | undefined) ?? [];
  if (opened.length === 0 && closed.length === 0) return null;
  return (
    <DocSection title="Open items">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {opened.map((r) => (
          <div key={`o-${r.id}`} style={docRowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={docRowTitleStyle}>
                <span style={monoStyle}>RFI-{String(r.number).padStart(3, "0")}</span>
                {r.subject}
              </div>
              <div style={docRowMetaStyle}>Opened this week</div>
            </div>
            <Pill color="amber">Open</Pill>
          </div>
        ))}
        {closed.map((r) => (
          <div key={`c-${r.id}`} style={docRowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={docRowTitleStyle}>
                <span style={monoStyle}>RFI-{String(r.number).padStart(3, "0")}</span>
                {r.subject}
              </div>
              <div style={docRowMetaStyle}>
                Closed in {r.turnaroundDays ?? "—"}d
              </div>
            </div>
            <Pill color="green">Closed</Pill>
          </div>
        ))}
      </div>
    </DocSection>
  );
}

function ChangeOrdersDoc({ section }: { section: WeeklyReportSection }) {
  const submitted = (section.content.submitted as CoItem[] | undefined) ?? [];
  const approved = (section.content.approved as CoItem[] | undefined) ?? [];
  if (submitted.length === 0 && approved.length === 0) return null;
  return (
    <DocSection title="Change orders">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {submitted.map((c) => (
          <div key={`s-${c.id}`} style={docRowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={docRowTitleStyle}>
                <span style={monoStyle}>CO-{String(c.number).padStart(3, "0")}</span>
                {c.title} · <strong>{formatCents(c.amountCents)}</strong>
              </div>
              <div style={docRowMetaStyle}>Submitted</div>
            </div>
            <Pill color="amber">Submitted</Pill>
          </div>
        ))}
        {approved.map((c) => (
          <div key={`a-${c.id}`} style={docRowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={docRowTitleStyle}>
                <span style={monoStyle}>CO-{String(c.number).padStart(3, "0")}</span>
                {c.title} · <strong>{formatCents(c.amountCents)}</strong>
              </div>
              <div style={docRowMetaStyle}>Approved</div>
            </div>
            <Pill color="green">Approved</Pill>
          </div>
        ))}
      </div>
    </DocSection>
  );
}

function DailyLogsDoc({ section }: { section: WeeklyReportSection }) {
  const entries = (section.content.entries as DailyLogEntry[] | undefined) ?? [];
  if (entries.length === 0) return null;
  return (
    <DocSection title="Daily activity">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map((e) => (
          <div key={e.logId} style={docLogRowStyle}>
            <div style={docLogDateStyle}>{formatLogDate(e.date)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={docLogReporterStyle}>{e.reporterName ?? "—"}</div>
              <div style={docLogSummaryStyle}>{e.summary ?? "(no summary)"}</div>
            </div>
          </div>
        ))}
      </div>
    </DocSection>
  );
}

function IssuesDoc({ section }: { section: WeeklyReportSection }) {
  const items = (section.content.items as IssueItem[] | undefined) ?? [];
  if (items.length === 0) return null;
  return (
    <DocSection title="Issues flagged">
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((i) => (
          <div key={i.sourceId} style={docRowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={docRowTitleStyle}>
                <span style={monoStyle}>{i.issueType}</span>
                {i.description}
              </div>
            </div>
            <Pill color="amber">Flagged</Pill>
          </div>
        ))}
      </div>
    </DocSection>
  );
}

// --------------------------------------------------------------------------
// KPI tile + helpers (lightweight clones — keeps the file standalone)
// --------------------------------------------------------------------------

function KpiTile({
  label,
  value,
  meta,
  tone = "neutral",
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: "neutral" | "accent";
}) {
  return (
    <div
      style={{
        background: "var(--s1)",
        border: `1px solid ${tone === "accent" ? "color-mix(in srgb, var(--ac) 30%, var(--s3))" : "var(--s3)"}`,
        borderRadius: "var(--r-l)",
        padding: "13px 15px",
        boxShadow: "var(--shsm)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--fd)",
          fontSize: 11,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "var(--t3)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--fd)",
          fontSize: 22,
          fontWeight: 820,
          letterSpacing: "-0.03em",
          marginTop: 4,
        }}
      >
        {value}
      </div>
      {meta && (
        <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
          {meta}
        </div>
      )}
    </div>
  );
}

type DailyLogEntry = {
  logId: string;
  date: string;
  reporterName: string | null;
  summary: string | null;
};
type PhotoItem = { photoId: string; documentId: string; caption: string | null; isHero: boolean };
type MilestoneItem = { milestoneId: string; title: string; closedAt?: string; dueDate?: string };
type RfiItem = { id: string; number: number; subject: string; turnaroundDays?: number };
type CoItem = { id: string; number: number; title: string; amountCents: number };
type IssueItem = { sourceId: string; issueType: string; description: string };

function computeClientTotals(reports: WeeklyReportSummaryRow[]): {
  total: number;
  latest: WeeklyReportSummaryRow | null;
} {
  return {
    total: reports.length,
    latest: reports[0] ?? null,
  };
}

function formatWeekShort(weekStart: string, weekEnd: string): string {
  const a = parseLocalDate(weekStart);
  const b = parseLocalDate(weekEnd);
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  const fmtMD = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return sameMonth
    ? `${fmtMD(a)} – ${b.getUTCDate()}`
    : `${fmtMD(a)} – ${fmtMD(b)}`;
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const a = parseLocalDate(weekStart);
  const b = parseLocalDate(weekEnd);
  const fmtMD = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
  return `${fmtMD(a)} – ${fmtMD(b)}, ${b.getUTCFullYear()}`;
}

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatLogDate(ymd: string): string {
  return parseLocalDate(ymd).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "+";
  const abs = Math.abs(cents);
  return `${sign}${(abs / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })}`;
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "240px minmax(0, 1fr)",
  gap: 16,
  alignItems: "start",
};

const timelineStyle: CSSProperties = {
  background: "var(--s1)",
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-xl)",
  boxShadow: "var(--shsm)",
  overflow: "hidden",
};

const timelineHeaderStyle: CSSProperties = {
  padding: "14px 16px 10px",
  borderBottom: "1px solid var(--s3)",
  fontFamily: "var(--fd)",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--t1)",
};

function timelineItemStyle(active: boolean): CSSProperties {
  return {
    display: "block",
    padding: "12px 16px",
    borderBottom: "1px solid var(--s3)",
    background: active ? "var(--ac-s)" : "transparent",
    cursor: "pointer",
    textDecoration: "none",
    color: "var(--t1)",
  };
}

function timelineItemWeekStyle(active: boolean): CSSProperties {
  return {
    fontFamily: "var(--fd)",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 3,
    color: active ? "var(--ac-t)" : "var(--t1)",
  };
}

const timelineItemMetaStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--t3)",
};

const docStyle: CSSProperties = {
  background: "var(--s1)",
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-xl)",
  boxShadow: "var(--shsm)",
  overflow: "hidden",
};

const docHeaderStyle: CSSProperties = {
  padding: "22px 26px 18px",
  borderBottom: "1px solid var(--s3)",
};

const docKickerStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--ac-t)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
};

const docTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 22,
  fontWeight: 720,
  letterSpacing: "-0.03em",
  marginBottom: 4,
  margin: 0,
};

const docMetaStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--t3)",
  fontFamily: "var(--fd)",
  marginTop: 6,
};

const docBodyStyle: CSSProperties = {
  padding: "22px 26px 26px",
};

const docSecStyle: CSSProperties = {
  marginBottom: 22,
};

const docSecTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 10,
  letterSpacing: "-0.01em",
  paddingBottom: 8,
  borderBottom: "2px solid var(--s3)",
};

const docPStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--t1)",
  lineHeight: 1.65,
};

const docFooterStyle: CSSProperties = {
  padding: "16px 26px",
  background: "var(--s2)",
  borderTop: "1px solid var(--s3)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const docFooterMetaStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--t2)",
};

const docRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px dashed var(--s3)",
  gap: 10,
};

const docRowTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 13,
  fontWeight: 650,
  color: "var(--t1)",
  marginBottom: 2,
};

const docRowMetaStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--t2)",
};

const monoStyle: CSSProperties = {
  fontFamily: "var(--fm)",
  fontSize: 10,
  color: "var(--t3)",
  marginRight: 6,
};

const docLogRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px dashed var(--s3)",
  fontSize: 12,
};

const docLogDateStyle: CSSProperties = {
  fontFamily: "var(--fm)",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--t3)",
  width: 88,
  flexShrink: 0,
};

const docLogReporterStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 11,
  fontWeight: 650,
  color: "var(--t2)",
  marginBottom: 2,
};

const docLogSummaryStyle: CSSProperties = {
  color: "var(--t1)",
  lineHeight: 1.55,
};

const photosGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
};

const photoTileStyle: CSSProperties = {
  aspectRatio: "4 / 3",
  borderRadius: "var(--r-m)",
  overflow: "hidden",
  position: "relative",
  background: "linear-gradient(135deg, #8a7a5c, #6b605a)",
};

const photoCaptionStyle: CSSProperties = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  padding: "8px 10px",
  fontSize: 10,
  fontFamily: "var(--fd)",
  fontWeight: 600,
  color: "white",
  background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
};

