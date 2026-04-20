"use client";

import { type CSSProperties } from "react";
import Link from "next/link";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Pill, type PillColor } from "@/components/pill";
import type {
  ResidentialReshapedReport,
  ResidentialWeeklyReportDetailView as FullResidentialWeeklyReportDetailView,
  ResidentialWeeklyReportsView as FullResidentialWeeklyReportsView,
} from "@/domain/loaders/weekly-reports-residential";
import type { WeeklyReportSummaryRow } from "@/domain/loaders/weekly-reports";

// Client-safe variants — drop `context`, which carries the non-serializable
// permissions.can function. The page strips context before rendering.
type ListView = Omit<FullResidentialWeeklyReportsView, "context">;
type ResidentialWeeklyReportDetailView = Omit<
  FullResidentialWeeklyReportDetailView,
  "context"
>;

// Residential client weekly-report read view ("This week at your home").
// Hero card + 5-card grid mirrors the prototype's residential layout.
// Residential portal uses warm amber/teal accent — driven by the portal
// theme tokens, no special CSS needed here beyond the warm hero gradient.

const PROGRESS_LABEL: Record<
  "done" | "in_progress" | "arrived" | "upcoming",
  string
> = {
  done: "Done",
  in_progress: "In progress",
  arrived: "Arrived",
  upcoming: "Coming up",
};

const PROGRESS_PILL: Record<
  "done" | "in_progress" | "arrived" | "upcoming",
  PillColor
> = {
  done: "green",
  in_progress: "amber",
  arrived: "green",
  upcoming: "blue",
};

// --------------------------------------------------------------------------
// Root
// --------------------------------------------------------------------------

export function ResidentialWeeklyReportsView({
  projectId,
  listView,
  detail,
}: {
  projectId: string;
  listView: ListView;
  detail: ResidentialWeeklyReportDetailView | null;
}) {
  return (
    <div className="apw">
      <header className="apw-head">
        <div className="apw-head-main">
          <h1 className="apw-title">This week at your home</h1>
          <p className="apw-desc">
            A friendly recap from the team — what happened on site, what got
            decided, and what&rsquo;s coming next. Sent each Monday morning.
          </p>
        </div>
      </header>

      {detail ? (
        <ResidentialReport
          projectId={projectId}
          reshaped={detail.reshaped}
          allReports={listView.reports}
          homeName={detail.project.name}
        />
      ) : (
        <div style={emptyShellStyle}>
          <EmptyState
            title={
              listView.reports.length === 0
                ? "No updates yet"
                : "Pick a week below"
            }
            description={
              listView.reports.length === 0
                ? "Your team will send a recap each Monday morning."
                : "Older recaps appear in the archive."
            }
          />
          {listView.reports.length > 0 && (
            <ArchiveStrip
              projectId={projectId}
              reports={listView.reports}
              activeId={null}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ResidentialReport({
  projectId,
  reshaped,
  allReports,
  homeName,
}: {
  projectId: string;
  reshaped: ResidentialReshapedReport;
  allReports: WeeklyReportSummaryRow[];
  homeName: string;
}) {
  return (
    <>
      <div style={heroStyle}>
        <div style={heroKickerStyle}>
          This week at your home · {formatWeekRange(reshaped.weekStart, reshaped.weekEnd)}
        </div>
        <h2 style={heroTitleStyle}>
          {extractHeroSentence(reshaped.heroNarrative) ??
            `A short recap from your team at ${homeName}.`}
        </h2>
        {reshaped.heroNarrative && (
          <p style={heroBodyStyle}>{reshaped.heroNarrative}</p>
        )}
        <div style={heroMetaStyle} className="no-print">
          <span>
            {reshaped.sentByName ? `From ${reshaped.sentByName}` : "From the team"}
            {reshaped.sentAt ? ` — sent ${formatDateTime(reshaped.sentAt)}` : ""}
          </span>
          <a
            href={`/api/weekly-reports/${reshaped.reportId}/pdf?portal=residential`}
            style={{ textDecoration: "none" }}
          >
            <Button variant="secondary">Save as PDF</Button>
          </a>
        </div>
      </div>

      <div style={resGridStyle}>
        <div style={cardStyle}>
          <div style={kickerStyle}>On site this week</div>
          <h3 style={cardHeadingStyle}>Progress this week</h3>
          {reshaped.progress.length === 0 ? (
            <p style={cardBodyTextStyle}>
              Quiet week — no major milestones, but the crew was on site.
            </p>
          ) : (
            <div style={progressColumnStyle}>
              {reshaped.progress.map((p, i) => (
                <div key={`${p.label}-${i}`} style={progressRowStyle}>
                  <div style={progressLabelStyle}>{p.label}</div>
                  <Pill color={PROGRESS_PILL[p.status]}>
                    {PROGRESS_LABEL[p.status]}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, ...warmCardStyle }}>
          <div style={kickerStyle}>Anything for you to do?</div>
          <h3 style={cardHeadingStyle}>What we need from you</h3>
          <p style={cardBodyTextStyle}>{reshaped.pendingActionsSummary}</p>
          {reshaped.pendingActions.length > 0 && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {reshaped.pendingActions.map((a, i) => (
                <Link
                  key={`${a.title}-${i}`}
                  href={a.href}
                  style={pendingActionLinkStyle}
                >
                  <span style={{ fontWeight: 650 }}>{a.title}</span>
                  <span style={{ fontSize: 11, color: "var(--t3)" }}>
                    {a.detail}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...cardStyle, gridColumn: "span 2" }}>
          <div style={kickerStyle}>A peek at the week</div>
          <h3 style={cardHeadingStyle}>Photos from your home</h3>
          {reshaped.photos.length === 0 ? (
            <p style={cardBodyTextStyle}>
              No photos yet this week — your team will add some when they&rsquo;re on
              site next.
            </p>
          ) : (
            <div style={photosGridStyle}>
              {reshaped.photos.map((p) => (
                <div key={p.photoId} style={photoTileStyle}>
                  <div style={photoCaptionStyle}>{p.caption ?? "Untitled"}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={kickerStyle}>Decisions & updates</div>
          <h3 style={cardHeadingStyle}>What got decided</h3>
          {reshaped.decisions.length === 0 ? (
            <p style={cardBodyTextStyle}>
              No new decisions this week. We&rsquo;ll let you know when there&rsquo;s
              something to weigh in on.
            </p>
          ) : (
            <div style={{ marginTop: 8 }}>
              {reshaped.decisions.map((d, i) => (
                <div key={`${d.title}-${i}`} style={decisionRowStyle}>
                  <h4 style={decisionTitleStyle}>{d.title}</h4>
                  <p style={decisionDetailStyle}>{d.detail}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={kickerStyle}>Looking ahead</div>
          <h3 style={cardHeadingStyle}>Coming up next week</h3>
          {reshaped.upcoming.length === 0 ? (
            <p style={cardBodyTextStyle}>
              No big milestones lined up — steady progress on what&rsquo;s already
              underway.
            </p>
          ) : (
            <ul style={upcomingListStyle}>
              {reshaped.upcoming.map((t, i) => (
                <li key={`${t}-${i}`} style={upcomingItemStyle}>
                  <span style={bulletStyle} />
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {allReports.length > 1 && (
        <div className="no-print">
          <ArchiveStrip
            projectId={projectId}
            reports={allReports}
            activeId={reshaped.reportId}
          />
        </div>
      )}
    </>
  );
}

function ArchiveStrip({
  projectId,
  reports,
  activeId,
}: {
  projectId: string;
  reports: WeeklyReportSummaryRow[];
  activeId: string | null;
}) {
  return (
    <div style={archiveStyle}>
      <div style={archiveHeaderStyle}>Earlier weeks</div>
      <div style={archiveRowStyle}>
        {reports.map((r) => (
          <Link
            key={r.id}
            href={`/residential/project/${projectId}/weekly-reports?report=${r.id}`}
            style={archiveItemStyle(activeId === r.id)}
          >
            {formatWeekShort(r.weekStart, r.weekEnd)}
          </Link>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function extractHeroSentence(narrative: string | null): string | null {
  if (!narrative) return null;
  const trimmed = narrative.trim();
  // First sentence (up to first period followed by space or end-of-string).
  const m = trimmed.match(/^(.*?[.!?])(\s|$)/);
  return (m ? m[1] : trimmed).trim();
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
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmtMD(a)} – ${fmtMD(b)}`;
}

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

// --------------------------------------------------------------------------
// Styles — uses the existing residential portal accent tokens. The hero
// gradient layers a warm-overlay onto the surface; cards float on neutral.
// --------------------------------------------------------------------------

const heroStyle: CSSProperties = {
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--ac) 18%, var(--s1)), var(--s1))",
  border: "1px solid color-mix(in srgb, var(--ac) 30%, var(--s3))",
  borderRadius: "var(--r-xl)",
  padding: "28px 30px",
  boxShadow: "var(--shsm)",
  marginBottom: 18,
  position: "relative",
  overflow: "hidden",
};

const heroKickerStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--ac-t)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 10,
};

const heroTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 30,
  fontWeight: 720,
  letterSpacing: "-0.035em",
  lineHeight: 1.1,
  marginBottom: 10,
  maxWidth: 620,
  margin: "0 0 10px 0",
};

const heroBodyStyle: CSSProperties = {
  fontSize: 14,
  color: "var(--t2)",
  maxWidth: 620,
  lineHeight: 1.6,
  marginBottom: 0,
};

const heroMetaStyle: CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 16,
  alignItems: "center",
  fontSize: 12,
  color: "var(--t3)",
  fontFamily: "var(--fd)",
};

const resGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const cardStyle: CSSProperties = {
  background: "var(--s1)",
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-xl)",
  padding: "20px 22px",
  boxShadow: "var(--shsm)",
};

const warmCardStyle: CSSProperties = {
  borderColor: "color-mix(in srgb, var(--ac) 30%, var(--s3))",
  background:
    "linear-gradient(to bottom right, var(--s1) 40%, color-mix(in srgb, var(--ac) 15%, var(--s1)))",
};

const kickerStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--ac-t)",
  fontFamily: "var(--fd)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 4,
};

const cardHeadingStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  marginBottom: 10,
  margin: "0 0 10px 0",
};

const cardBodyTextStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--t1)",
  lineHeight: 1.65,
  margin: 0,
};

const progressColumnStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  marginTop: 12,
};

const progressRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px",
  background: "var(--s2)",
  borderRadius: "var(--r-m)",
  border: "1px solid var(--s3)",
};

const progressLabelStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 13,
  fontWeight: 650,
};

const pendingActionLinkStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  padding: "10px 12px",
  background: "var(--s1)",
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-m)",
  textDecoration: "none",
  color: "var(--t1)",
  fontSize: 13,
};

const decisionRowStyle: CSSProperties = {
  padding: "14px 0",
  borderBottom: "1px dashed var(--s3)",
};

const decisionTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 4,
  margin: "0 0 4px 0",
};

const decisionDetailStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--t2)",
  lineHeight: 1.55,
  margin: 0,
};

const upcomingListStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  marginTop: 10,
  margin: "10px 0 0 0",
};

const upcomingItemStyle: CSSProperties = {
  padding: "8px 0",
  fontSize: 13,
  color: "var(--t1)",
  display: "flex",
  gap: 10,
  alignItems: "center",
  borderBottom: "1px dashed var(--s3)",
};

const bulletStyle: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "var(--ac)",
  flexShrink: 0,
};

const photosGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
  marginTop: 12,
};

const photoTileStyle: CSSProperties = {
  aspectRatio: "4 / 3",
  borderRadius: "var(--r-m)",
  overflow: "hidden",
  position: "relative",
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--ac) 50%, #8a7a5c), color-mix(in srgb, var(--ac) 30%, #6b605a))",
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

const archiveStyle: CSSProperties = {
  background: "var(--s1)",
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-l)",
  padding: "14px 18px",
};

const archiveHeaderStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 11,
  fontWeight: 700,
  color: "var(--t3)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 8,
};

const archiveRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

function archiveItemStyle(active: boolean): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${active ? "color-mix(in srgb, var(--ac) 35%, var(--s3))" : "var(--s3)"}`,
    background: active ? "var(--ac-s)" : "var(--s1)",
    color: active ? "var(--ac-t)" : "var(--t2)",
    fontFamily: "var(--fd)",
    fontSize: 12,
    fontWeight: 650,
    textDecoration: "none",
  };
}

const emptyShellStyle: CSSProperties = {
  ...cardStyle,
  padding: 32,
};
