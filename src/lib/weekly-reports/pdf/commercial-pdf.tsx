/* eslint-disable react/jsx-key */
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type {
  ClientWeeklyReportDetailView,
  WeeklyReportSection,
} from "@/domain/loaders/weekly-reports";

// Commercial weekly-report PDF document. Document-style layout matching
// the on-screen commercial doc view: kicker + week title + project meta
// at the top, summary section, then milestones, photos (captions only —
// real images need a presigned-URL fetch per documentId, deferred), open
// items (RFIs + COs combined per the prototype), daily activity, issues.
//
// @react-pdf/renderer ships with Helvetica/Times/Courier by default.
// We use Helvetica (close enough to Inter / DM Sans for a portfolio PDF
// without bundling a custom font asset).

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1714",
    lineHeight: 1.4,
  },
  header: {
    borderBottom: "1 solid #d1d5db",
    paddingBottom: 14,
    marginBottom: 18,
  },
  kicker: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#4a3fb0",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1a1714",
    marginBottom: 4,
  },
  meta: {
    fontSize: 9,
    color: "#6b655b",
  },
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    paddingBottom: 5,
    borderBottom: "1.5 solid #d1d5db",
    marginBottom: 8,
  },
  paragraph: { fontSize: 10, lineHeight: 1.55, marginBottom: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 5,
    borderBottom: "0.5 dashed #e2e5e9",
    gap: 8,
  },
  rowLeft: { flex: 1 },
  rowTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  rowMeta: { fontSize: 9, color: "#6b655b" },
  pill: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    color: "#6b655b",
  },
  pillGreen: { backgroundColor: "#edf7f1", color: "#1e6b46" },
  pillAmber: { backgroundColor: "#fdf4e6", color: "#96600f" },
  pillBlue: { backgroundColor: "#e8f1fa", color: "#276299" },
  mono: {
    fontFamily: "Courier",
    fontSize: 8,
    color: "#9c958a",
    marginRight: 4,
  },
  logRow: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 5,
    borderBottom: "0.5 dashed #e2e5e9",
  },
  logDate: {
    width: 80,
    fontFamily: "Courier",
    fontSize: 9,
    color: "#6b655b",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  photoTile: {
    width: 110,
    height: 75,
    backgroundColor: "#e2e5e9",
    padding: 6,
    justifyContent: "flex-end",
  },
  photoCaption: {
    fontSize: 8,
    color: "#6b655b",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: "#9c958a",
    flexDirection: "row",
    justifyContent: "space-between",
    borderTop: "0.5 solid #e2e5e9",
    paddingTop: 6,
  },
});

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function CommercialReportDocument({
  detail,
}: {
  detail: ClientWeeklyReportDetailView;
}) {
  const { report, project } = detail;
  return (
    <Document
      title={`Weekly Report — ${formatWeekRange(report.weekStart, report.weekEnd)}`}
      author={report.sentByName ?? "BuiltCRM"}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.kicker}>WEEKLY REPORT</Text>
          <Text style={styles.title}>
            Week of {formatWeekRange(report.weekStart, report.weekEnd)}
          </Text>
          <Text style={styles.meta}>{project.name}</Text>
          <Text style={styles.meta}>
            {report.sentByName ? `Sent by ${report.sentByName}` : "Sent"}
            {report.sentAt ? ` · ${formatDateTime(report.sentAt)}` : ""}
          </Text>
        </View>

        {report.summaryText && (
          <DocSection title="Summary">
            <Text style={styles.paragraph}>{report.summaryText}</Text>
          </DocSection>
        )}

        {report.sections.map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}

        <View style={styles.footer} fixed>
          <Text>{project.name}</Text>
          <Text
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

// ---------------------------------------------------------------------------
// Section blocks
// ---------------------------------------------------------------------------

function DocSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function SectionRenderer({ section }: { section: WeeklyReportSection }) {
  switch (section.sectionType) {
    case "milestones":
      return <MilestonesSection section={section} />;
    case "photos":
      return <PhotosSection section={section} />;
    case "rfis":
      return <RfisSection section={section} />;
    case "change_orders":
      return <ChangeOrdersSection section={section} />;
    case "daily_logs":
      return <DailyLogsSection section={section} />;
    case "issues":
      return <IssuesSection section={section} />;
  }
}

type MilestoneItem = {
  milestoneId: string;
  title: string;
  closedAt?: string;
  dueDate?: string;
};

function MilestonesSection({ section }: { section: WeeklyReportSection }) {
  const closed = (section.content.closed as MilestoneItem[] | undefined) ?? [];
  const upcoming = (section.content.upcoming as MilestoneItem[] | undefined) ?? [];
  if (closed.length === 0 && upcoming.length === 0) return null;
  return (
    <DocSection title="On site this week">
      {closed.map((m) => (
        <View key={m.milestoneId} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>{m.title}</Text>
            <Text style={styles.rowMeta}>
              Closed {m.closedAt ? formatDateTime(new Date(m.closedAt)) : "—"}
            </Text>
          </View>
          <Text style={[styles.pill, styles.pillGreen]}>Closed</Text>
        </View>
      ))}
      {upcoming.map((m) => (
        <View key={m.milestoneId} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>{m.title}</Text>
            <Text style={styles.rowMeta}>
              Coming {m.dueDate ? formatDateTime(new Date(m.dueDate)) : "—"}
            </Text>
          </View>
          <Text style={[styles.pill, styles.pillBlue]}>Upcoming</Text>
        </View>
      ))}
    </DocSection>
  );
}

type PhotoItem = {
  photoId: string;
  documentId: string;
  caption: string | null;
};

function PhotosSection({ section }: { section: WeeklyReportSection }) {
  const items = (section.content.items as PhotoItem[] | undefined) ?? [];
  if (items.length === 0) return null;
  // Real image rendering needs a presigned URL per documentId — deferred
  // to a follow-up. For now: caption tiles in a grid.
  return (
    <DocSection title="Photos from site">
      <View style={styles.photoGrid}>
        {items.slice(0, 12).map((p) => (
          <View key={p.photoId} style={styles.photoTile}>
            <Text style={styles.photoCaption}>{p.caption ?? "Untitled"}</Text>
          </View>
        ))}
      </View>
    </DocSection>
  );
}

type RfiItem = {
  id: string;
  number: number;
  subject: string;
  turnaroundDays?: number;
};

function RfisSection({ section }: { section: WeeklyReportSection }) {
  const opened = (section.content.opened as RfiItem[] | undefined) ?? [];
  const closed = (section.content.closed as RfiItem[] | undefined) ?? [];
  if (opened.length === 0 && closed.length === 0) return null;
  return (
    <DocSection title="Open items">
      {opened.map((r) => (
        <View key={`o-${r.id}`} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>
              <Text style={styles.mono}>RFI-{String(r.number).padStart(3, "0")}</Text>
              {r.subject}
            </Text>
            <Text style={styles.rowMeta}>Opened this week</Text>
          </View>
          <Text style={[styles.pill, styles.pillAmber]}>Open</Text>
        </View>
      ))}
      {closed.map((r) => (
        <View key={`c-${r.id}`} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>
              <Text style={styles.mono}>RFI-{String(r.number).padStart(3, "0")}</Text>
              {r.subject}
            </Text>
            <Text style={styles.rowMeta}>
              Closed in {r.turnaroundDays ?? "—"}d
            </Text>
          </View>
          <Text style={[styles.pill, styles.pillGreen]}>Closed</Text>
        </View>
      ))}
    </DocSection>
  );
}

type CoItem = {
  id: string;
  number: number;
  title: string;
  amountCents: number;
};

function ChangeOrdersSection({ section }: { section: WeeklyReportSection }) {
  const submitted = (section.content.submitted as CoItem[] | undefined) ?? [];
  const approved = (section.content.approved as CoItem[] | undefined) ?? [];
  if (submitted.length === 0 && approved.length === 0) return null;
  return (
    <DocSection title="Change orders">
      {submitted.map((c) => (
        <View key={`s-${c.id}`} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>
              <Text style={styles.mono}>CO-{String(c.number).padStart(3, "0")}</Text>
              {c.title} — {formatCents(c.amountCents)}
            </Text>
            <Text style={styles.rowMeta}>Submitted</Text>
          </View>
          <Text style={[styles.pill, styles.pillAmber]}>Submitted</Text>
        </View>
      ))}
      {approved.map((c) => (
        <View key={`a-${c.id}`} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>
              <Text style={styles.mono}>CO-{String(c.number).padStart(3, "0")}</Text>
              {c.title} — {formatCents(c.amountCents)}
            </Text>
            <Text style={styles.rowMeta}>Approved</Text>
          </View>
          <Text style={[styles.pill, styles.pillGreen]}>Approved</Text>
        </View>
      ))}
    </DocSection>
  );
}

type DailyLogEntry = {
  logId: string;
  date: string;
  reporterName: string | null;
  summary: string | null;
};

function DailyLogsSection({ section }: { section: WeeklyReportSection }) {
  const entries = (section.content.entries as DailyLogEntry[] | undefined) ?? [];
  if (entries.length === 0) return null;
  return (
    <DocSection title="Daily activity">
      {entries.map((e) => (
        <View key={e.logId} style={styles.logRow}>
          <Text style={styles.logDate}>{formatLogDate(e.date)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowMeta}>{e.reporterName ?? "—"}</Text>
            <Text style={{ fontSize: 9, lineHeight: 1.5 }}>
              {e.summary ?? "(no summary)"}
            </Text>
          </View>
        </View>
      ))}
    </DocSection>
  );
}

type IssueItem = { sourceId: string; issueType: string; description: string };

function IssuesSection({ section }: { section: WeeklyReportSection }) {
  const items = (section.content.items as IssueItem[] | undefined) ?? [];
  if (items.length === 0) return null;
  return (
    <DocSection title="Issues flagged">
      {items.map((i) => (
        <View key={i.sourceId} style={styles.row}>
          <View style={styles.rowLeft}>
            <Text style={styles.rowTitle}>
              <Text style={styles.mono}>{i.issueType}</Text>
              {i.description}
            </Text>
          </View>
          <Text style={[styles.pill, styles.pillAmber]}>Flagged</Text>
        </View>
      ))}
    </DocSection>
  );
}

// ---------------------------------------------------------------------------
// Formatters (duplicated from the on-screen view to keep this module
// self-contained; the PDF runs server-side and shouldn't depend on
// client-only utilities)
// ---------------------------------------------------------------------------

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const a = parseLocalDate(weekStart);
  const b = parseLocalDate(weekEnd);
  const fmtMD = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmtMD(a)} – ${fmtMD(b)}, ${b.getUTCFullYear()}`;
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
  const abs = Math.abs(cents);
  return `${cents < 0 ? "-" : ""}${(abs / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })}`;
}
