"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Pill, type PillColor } from "@/components/pill";
import type {
  ContractorWeeklyReportDetailView as FullContractorWeeklyReportDetailView,
  ContractorWeeklyReportsView as FullContractorWeeklyReportsView,
  WeeklyReportSection,
  WeeklyReportSummaryRow,
} from "@/domain/loaders/weekly-reports";
import { formatMoneyCents } from "@/lib/format/money";

// Client-safe variants — drop `context`, which carries the non-serializable
// permissions.can function. Next.js forbids passing functions across the
// server/client boundary, so the page strips context before rendering.
type ContractorWeeklyReportsView = Omit<FullContractorWeeklyReportsView, "context">;
type ContractorWeeklyReportDetailView = Omit<FullContractorWeeklyReportDetailView, "context">;

// Contractor weekly-reports workspace. Mirrors the prototype's 3-column
// contractor view: list (left) | editor (center) | rail (right).
//
// Active report ID is reflected in the URL via shallow router push so
// refresh / share preserves selection. All edits are PATCHed against the
// route handlers and trigger a router.refresh() so server data re-loads.

const SECTION_LABEL: Record<WeeklyReportSection["sectionType"], string> = {
  daily_logs: "Daily logs",
  photos: "Photos",
  milestones: "Milestones",
  rfis: "RFIs & issues",
  change_orders: "Change orders",
  issues: "Issues",
};

// --------------------------------------------------------------------------
// Root
// --------------------------------------------------------------------------

export function WeeklyReportsWorkspace({
  projectId,
  listView,
  detail,
}: {
  projectId: string;
  listView: ContractorWeeklyReportsView;
  detail: ContractorWeeklyReportDetailView | null;
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  const totals = useMemo(() => computeTotals(listView.reports), [
    listView.reports,
  ]);

  async function handleGenerateOffCycle() {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/weekly-reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Generate failed: ${body.message ?? body.error ?? res.status}`);
        return;
      }
      // Refresh server props; the new report (if created) will appear in
      // the list and we navigate to it.
      if (body.reportId) {
        router.replace(
          `/contractor/project/${projectId}/weekly-reports?report=${body.reportId}`,
        );
      }
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="apw">
      <header className="apw-head">
        <div className="apw-head-main">
          <h1 className="apw-title">Weekly reports</h1>
          <p className="apw-desc">
            Auto-generated Monday mornings from the prior week&rsquo;s daily
            logs, photos, milestones, RFIs, change orders, and issues. Review
            the draft, edit sections, send to the client.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <Button
            variant="secondary"
            onClick={handleGenerateOffCycle}
            loading={generating}
          >
            Generate off-cycle
          </Button>
        </div>
      </header>

      <div className="apw-kpis">
        <KpiTile
          label="This week's draft"
          value={totals.draftCount.toString()}
          meta={
            totals.draftCount === 0
              ? "Nothing pending"
              : "Awaiting your review"
          }
          tone={totals.draftCount > 0 ? "accent" : "neutral"}
        />
        <KpiTile
          label="Sent this quarter"
          value={totals.sentThisQuarter.toString()}
          meta="Last 90 days"
        />
        <KpiTile
          label="Total this project"
          value={totals.total.toString()}
          meta="Since project start"
        />
        <KpiTile
          label="Last sent"
          value={totals.lastSentLabel ?? "—"}
          meta={totals.lastSentBy ?? "No reports sent yet"}
        />
      </div>

      <div style={gridStyle}>
        <ReportListPanel
          projectId={projectId}
          reports={listView.reports}
          activeId={detail?.report.id ?? null}
        />
        {detail ? (
          <ReportEditor
            projectId={projectId}
            detail={detail}
            onChanged={() => router.refresh()}
          />
        ) : (
          <div style={emptyEditorStyle}>
            <EmptyState
              title={
                listView.reports.length === 0
                  ? "No reports yet"
                  : "Select a report"
              }
              description={
                listView.reports.length === 0
                  ? "Click \u201CGenerate off-cycle\u201D to draft one for this week, or wait for Monday morning."
                  : "Pick a report from the list to view and edit."
              }
            />
          </div>
        )}
        <RightRail detail={detail} reports={listView.reports} />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Report list (left column)
// --------------------------------------------------------------------------

function ReportListPanel({
  projectId,
  reports,
  activeId,
}: {
  projectId: string;
  reports: WeeklyReportSummaryRow[];
  activeId: string | null;
}) {
  return (
    <div style={cardStyle}>
      <div style={listHeaderStyle}>
        <span style={listHeaderTitleStyle}>All reports</span>
        <span style={listCountStyle}>{reports.length}</span>
      </div>
      <div style={{ maxHeight: 720, overflowY: "auto" }}>
        {reports.length === 0 ? (
          <div style={{ padding: 20 }}>
            <EmptyState
              title="No reports yet"
              description="Generate or wait for Monday morning."
            />
          </div>
        ) : (
          reports.map((r) => (
            <Link
              key={r.id}
              href={`/contractor/project/${projectId}/weekly-reports?report=${r.id}`}
              style={listRowStyle(activeId === r.id)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={listRowWeekStyle(activeId === r.id)}>
                  Week of {formatWeekShort(r.weekStart, r.weekEnd)}
                </span>
                <Pill color={statusPillColor(r.status)}>
                  {STATUS_LABEL[r.status]}
                </Pill>
              </div>
              <div style={listRowTeaserStyle}>
                {r.summaryText
                  ? truncate(r.summaryText, 120)
                  : "Auto-drafted from this week's activity. Click to review."}
              </div>
              <div style={listRowFootStyle}>
                <span>{r.sectionCount} sections</span>
                <span>{formatGenerated(r)}</span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Report editor (center column)
// --------------------------------------------------------------------------

function ReportEditor({
  projectId,
  detail,
  onChanged,
}: {
  projectId: string;
  detail: ContractorWeeklyReportDetailView;
  onChanged: () => void;
}) {
  const { report, recipients } = detail;
  const isLocked = report.status === "sent" || report.status === "archived";

  // Lift drafts to the parent so the global "Save draft" button can batch
  // every dirty change (summary + section overlays) into one round-trip.
  // Per-block save buttons are gone — the section UI just toggles between
  // viewing and editing the overlay; commit happens via Save draft.
  const [summaryDraft, setSummaryDraft] = useState(report.summaryText ?? "");
  const initialOverlays = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of report.sections) {
      m[s.id] = (s.content.narrativeOverlay as string | undefined) ?? "";
    }
    return m;
  }, [report.sections]);
  const [overlayDrafts, setOverlayDrafts] =
    useState<Record<string, string>>(initialOverlays);

  const [savingDraft, setSavingDraft] = useState(false);
  const [sending, setSending] = useState(false);

  // Track which fields differ from server state.
  const summaryDirty = summaryDraft !== (report.summaryText ?? "");
  const dirtySectionIds = report.sections
    .filter(
      (s) =>
        (overlayDrafts[s.id] ?? "") !==
        ((s.content.narrativeOverlay as string | undefined) ?? ""),
    )
    .map((s) => s.id);
  const dirtyCount = (summaryDirty ? 1 : 0) + dirtySectionIds.length;

  function setOverlayDraft(sectionId: string, next: string) {
    setOverlayDrafts((prev) => ({ ...prev, [sectionId]: next }));
  }

  function discardAll() {
    setSummaryDraft(report.summaryText ?? "");
    setOverlayDrafts(initialOverlays);
  }

  async function saveDraft() {
    if (savingDraft || isLocked || dirtyCount === 0) return;
    setSavingDraft(true);
    try {
      const ops: Array<Promise<Response>> = [];
      if (summaryDirty) {
        ops.push(
          fetch(`/api/weekly-reports/${report.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ summaryText: summaryDraft }),
          }),
        );
      }
      for (const sectionId of dirtySectionIds) {
        const value = overlayDrafts[sectionId] ?? "";
        ops.push(
          fetch(
            `/api/weekly-reports/${report.id}/sections/${sectionId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ narrativeOverlay: value || null }),
            },
          ),
        );
      }
      const results = await Promise.all(ops);
      const failures = results.filter((r) => !r.ok);
      if (failures.length > 0) {
        const msgs = await Promise.all(
          failures.map((r) =>
            r
              .json()
              .then((b) => b.message ?? b.error ?? `HTTP ${r.status}`)
              .catch(() => `HTTP ${r.status}`),
          ),
        );
        alert(`Some changes failed to save:\n${msgs.join("\n")}`);
        return;
      }
      onChanged();
    } finally {
      setSavingDraft(false);
    }
  }

  async function sendReport() {
    if (sending || isLocked || recipients.length === 0) return;
    if (
      !confirm(
        `Send this report to ${recipients.length === 1 ? recipients[0].name : `${recipients.length} client members`}? This cannot be undone.`,
      )
    )
      return;
    setSending(true);
    try {
      const res = await fetch(`/api/weekly-reports/${report.id}/send`, {
        method: "POST",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Send failed: ${body.message ?? body.error ?? res.status}`);
        return;
      }
      onChanged();
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={cardStyle}>
      <div style={editorHeaderStyle}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h3 style={editorTitleStyle}>
              Week of {formatWeekRange(report.weekStart, report.weekEnd)}
            </h3>
            <Pill color={statusPillColor(report.status)}>
              {STATUS_LABEL[report.status]}
            </Pill>
          </div>
          <div style={editorSubStyle}>
            Generated {formatDateTime(report.generatedAt)}
            {report.generatedByName ? ` by ${report.generatedByName}` : " (auto)"}
            {report.sentAt
              ? ` · Sent ${formatDateTime(report.sentAt)}`
              : " · Not yet sent"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <a
            href={`/api/weekly-reports/${report.id}/pdf?portal=contractor`}
            style={{ textDecoration: "none" }}
          >
            <Button variant="secondary">Export PDF</Button>
          </a>
        </div>
      </div>

      <div style={{ padding: "18px 22px 22px" }}>
        {/* Summary block — special-styled, always editable when not locked.
            Save lives in the global footer. */}
        <div style={summaryBlockStyle}>
          <div style={summaryHeaderStyle}>
            <span style={summaryHeaderTitleStyle}>Week summary</span>
            <span style={summaryHeaderKindStyle}>
              Narrative {isLocked ? "" : "· Editable"}
            </span>
          </div>
          <div style={{ padding: "14px 16px" }}>
            <div style={summaryAutoTagStyle}>Auto-drafted from activity</div>
            <textarea
              value={summaryDraft}
              onChange={(e) => setSummaryDraft(e.target.value)}
              disabled={isLocked}
              placeholder="Write a short narrative for the client. Auto-pulled section data appears below."
              style={summaryTextareaStyle}
            />
          </div>
        </div>

        {report.sections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            isLocked={isLocked}
            overlayDraft={overlayDrafts[section.id] ?? ""}
            setOverlayDraft={(next) => setOverlayDraft(section.id, next)}
          />
        ))}
      </div>

      <div style={editorFooterStyle}>
        <div style={editorFooterMetaStyle}>
          {isLocked ? (
            <>
              This report is <strong>{report.status}</strong>
              {report.sentAt
                ? ` — sent ${formatDateTime(report.sentAt)}${report.sentByName ? ` by ${report.sentByName}` : ""}`
                : " — no further edits allowed"}
              .
            </>
          ) : recipients.length === 0 ? (
            <>
              <strong>No client recipient configured.</strong> Add a commercial or
              residential client member in{" "}
              <Link
                href={`/contractor/project/${projectId}`}
                style={{ color: "var(--ac-t)", textDecoration: "none" }}
              >
                Team
              </Link>
              {" "}before sending.
            </>
          ) : (
            <>
              Sending to:{" "}
              <strong>
                {recipients
                  .map((r) => `${r.name}${r.roleKey ? ` (${r.roleKey})` : ""}`)
                  .join(", ")}
              </strong>
              <br />
              Email notification fires immediately · status flips to Sent.
            </>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!isLocked && (
            <>
              {dirtyCount > 0 && (
                <Button
                  variant="ghost"
                  onClick={discardAll}
                  disabled={savingDraft}
                >
                  Discard
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={saveDraft}
                loading={savingDraft}
                disabled={dirtyCount === 0}
              >
                {dirtyCount === 0
                  ? "Save draft"
                  : `Save draft (${dirtyCount} change${dirtyCount === 1 ? "" : "s"})`}
              </Button>
            </>
          )}
          <Button
            variant="primary"
            disabled={
              isLocked || recipients.length === 0 || dirtyCount > 0
            }
            loading={sending}
            onClick={sendReport}
            title={
              dirtyCount > 0
                ? "Save your draft changes before sending."
                : undefined
            }
          >
            Send to client
          </Button>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Section block — renders structured snapshot + editable narrativeOverlay
// --------------------------------------------------------------------------

// Controlled section block. Overlay draft + setter come from the parent
// editor so the global "Save draft" button can batch every dirty change.
// The pencil only toggles whether the textarea is visible — actual commit
// happens in the footer.
function SectionBlock({
  section,
  isLocked,
  overlayDraft,
  setOverlayDraft,
}: {
  section: WeeklyReportSection;
  isLocked: boolean;
  overlayDraft: string;
  setOverlayDraft: (next: string) => void;
}) {
  const overlay = (section.content.narrativeOverlay as string | undefined) ?? "";
  // Open the editor automatically when there's an unsaved overlay draft
  // (e.g. the user typed, then collapsed and re-expanded a different
  // section). Falls back to "show preview when value matches saved."
  const isDirty = overlayDraft !== overlay;
  const [expanded, setExpanded] = useState(isDirty);

  const showEditor = expanded || isDirty;
  const itemCount = countItems(section);

  return (
    <div style={sectionBlockStyle}>
      <div style={sectionHeaderStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={sectionHeaderTitleStyle}>
            {SECTION_LABEL[section.sectionType]}
          </span>
          <span style={sectionHeaderKindStyle}>
            {itemCount === 0
              ? "No items this week"
              : `${itemCount} item${itemCount === 1 ? "" : "s"} · auto-pulled`}
            {isDirty ? " · unsaved" : ""}
          </span>
        </div>
        {!isLocked && (
          <Button variant="ghost" onClick={() => setExpanded(!showEditor)}>
            {showEditor
              ? "Hide overlay"
              : overlay
                ? "Edit overlay"
                : "Add overlay"}
          </Button>
        )}
      </div>
      <div style={{ padding: "14px 16px" }}>
        {overlay && !showEditor && (
          <div style={overlayPreviewStyle}>{overlay}</div>
        )}
        {showEditor && !isLocked && (
          <textarea
            value={overlayDraft}
            onChange={(e) => setOverlayDraft(e.target.value)}
            placeholder="Optional narrative on top of the auto-pulled items. Save it from the footer."
            style={overlayTextareaStyle}
          />
        )}
        <SectionContentRenderer section={section} />
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Section content renderer per type
// --------------------------------------------------------------------------

function SectionContentRenderer({ section }: { section: WeeklyReportSection }) {
  switch (section.sectionType) {
    case "daily_logs":
      return <DailyLogsContent content={section.content} />;
    case "photos":
      return <PhotosContent content={section.content} />;
    case "milestones":
      return <MilestonesContent content={section.content} />;
    case "rfis":
      return <RfisContent content={section.content} />;
    case "change_orders":
      return <ChangeOrdersContent content={section.content} />;
    case "issues":
      return <IssuesContent content={section.content} />;
  }
}

type DailyLogEntry = {
  logId: string;
  date: string;
  reporterName: string | null;
  summary: string | null;
};

function DailyLogsContent({ content }: { content: Record<string, unknown> }) {
  const entries = (content.entries as DailyLogEntry[] | undefined) ?? [];
  if (entries.length === 0) {
    return <div style={emptyHintStyle}>No logs submitted this week.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {entries.map((e) => (
        <div key={e.logId} style={logRowStyle}>
          <div style={logRowDateStyle}>{formatLogDate(e.date)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={logRowReporterStyle}>{e.reporterName ?? "Unknown"}</div>
            <div style={logRowSummaryStyle}>
              {e.summary ?? "(no summary)"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type PhotoItem = {
  photoId: string;
  documentId: string;
  caption: string | null;
  isHero: boolean;
};

function PhotosContent({ content }: { content: Record<string, unknown> }) {
  const items = (content.items as PhotoItem[] | undefined) ?? [];
  if (items.length === 0) {
    return <div style={emptyHintStyle}>No photos this week.</div>;
  }
  // Display caption-only tiles. Real images would need a presigned-URL
  // fetch per documentId; that's a polish for a later commit.
  return (
    <div style={photosGridStyle}>
      {items.slice(0, 12).map((p) => (
        <div key={p.photoId} style={photoTileStyle}>
          <div style={photoCaptionStyle}>
            {p.caption ?? (p.isHero ? "Hero photo" : "Untitled")}
          </div>
        </div>
      ))}
    </div>
  );
}

type MilestoneItem = {
  milestoneId: string;
  title: string;
  closedAt?: string;
  dueDate?: string;
};

function MilestonesContent({ content }: { content: Record<string, unknown> }) {
  const closed = (content.closed as MilestoneItem[] | undefined) ?? [];
  const upcoming = (content.upcoming as MilestoneItem[] | undefined) ?? [];
  if (closed.length === 0 && upcoming.length === 0) {
    return <div style={emptyHintStyle}>No milestone activity this week.</div>;
  }
  return (
    <>
      {closed.map((m) => (
        <div key={m.milestoneId} style={mrowStyle}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={mrowTitleStyle}>{m.title}</div>
            <div style={mrowDetailStyle}>
              Closed {m.closedAt ? formatDateTime(new Date(m.closedAt)) : "—"}
            </div>
          </div>
          <Pill color="green">Closed</Pill>
        </div>
      ))}
      {upcoming.map((m) => (
        <div key={m.milestoneId} style={mrowStyle}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={mrowTitleStyle}>{m.title}</div>
            <div style={mrowDetailStyle}>
              Due {m.dueDate ? formatDateTime(new Date(m.dueDate)) : "—"}
            </div>
          </div>
          <Pill color="blue">Upcoming</Pill>
        </div>
      ))}
    </>
  );
}

type RfiItem = {
  id: string;
  number: number;
  subject: string;
  status?: string;
  openedAt?: string;
  closedAt?: string;
  turnaroundDays?: number;
};

function RfisContent({ content }: { content: Record<string, unknown> }) {
  const opened = (content.opened as RfiItem[] | undefined) ?? [];
  const closed = (content.closed as RfiItem[] | undefined) ?? [];
  if (opened.length === 0 && closed.length === 0) {
    return <div style={emptyHintStyle}>No RFI activity this week.</div>;
  }
  return (
    <>
      {opened.map((r) => (
        <div key={`o-${r.id}`} style={mrowStyle}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={mrowTitleStyle}>
              <span style={mrowMonoStyle}>RFI-{String(r.number).padStart(3, "0")}</span>
              {r.subject}
            </div>
            <div style={mrowDetailStyle}>
              Opened {r.openedAt ? formatDateTime(new Date(r.openedAt)) : "—"}
            </div>
          </div>
          <Pill color="amber">Opened</Pill>
        </div>
      ))}
      {closed.map((r) => (
        <div key={`c-${r.id}`} style={mrowStyle}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={mrowTitleStyle}>
              <span style={mrowMonoStyle}>RFI-{String(r.number).padStart(3, "0")}</span>
              {r.subject}
            </div>
            <div style={mrowDetailStyle}>
              Closed in {r.turnaroundDays ?? "—"}d
            </div>
          </div>
          <Pill color="green">Closed</Pill>
        </div>
      ))}
    </>
  );
}

type CoItem = {
  id: string;
  number: number;
  title: string;
  amountCents: number;
  status?: string;
};

function ChangeOrdersContent({ content }: { content: Record<string, unknown> }) {
  const submitted = (content.submitted as CoItem[] | undefined) ?? [];
  const approved = (content.approved as CoItem[] | undefined) ?? [];
  if (submitted.length === 0 && approved.length === 0) {
    return <div style={emptyHintStyle}>No change-order activity this week.</div>;
  }
  return (
    <>
      {submitted.map((c) => (
        <div key={`s-${c.id}`} style={mrowStyle}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={mrowTitleStyle}>
              <span style={mrowMonoStyle}>CO-{String(c.number).padStart(3, "0")}</span>
              {c.title} · <strong>{formatCents(c.amountCents)}</strong>
            </div>
            <div style={mrowDetailStyle}>Submitted</div>
          </div>
          <Pill color="amber">Submitted</Pill>
        </div>
      ))}
      {approved.map((c) => (
        <div key={`a-${c.id}`} style={mrowStyle}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={mrowTitleStyle}>
              <span style={mrowMonoStyle}>CO-{String(c.number).padStart(3, "0")}</span>
              {c.title} · <strong>{formatCents(c.amountCents)}</strong>
            </div>
            <div style={mrowDetailStyle}>Approved</div>
          </div>
          <Pill color="green">Approved</Pill>
        </div>
      ))}
    </>
  );
}

type IssueItem = {
  sourceId: string;
  issueType: string;
  description: string;
};

function IssuesContent({ content }: { content: Record<string, unknown> }) {
  const items = (content.items as IssueItem[] | undefined) ?? [];
  if (items.length === 0) {
    // Honest empty state per the user's note: "Don't block Step 39 on
    // sourcing it. Ship with the issues section rendering empty."
    return (
      <div style={emptyHintStyle}>
        No issues flagged this week.
        {" "}
        {/* TODO: wire in punch_list issues source once Step 47 lands. */}
      </div>
    );
  }
  return (
    <>
      {items.map((i) => (
        <div key={i.sourceId} style={mrowStyle}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={mrowTitleStyle}>
              <span style={mrowMonoStyle}>{i.issueType}</span>
              {i.description}
            </div>
          </div>
          <Pill color="amber">Flagged</Pill>
        </div>
      ))}
    </>
  );
}

// --------------------------------------------------------------------------
// Right rail
// --------------------------------------------------------------------------

function RightRail({
  detail,
  reports,
}: {
  detail: ContractorWeeklyReportDetailView | null;
  reports: WeeklyReportSummaryRow[];
}) {
  const recentSent = reports.filter((r) => r.status === "sent").slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {detail && (
        <div style={cardStyle}>
          <div style={railHeaderStyle}>
            <span style={railTitleStyle}>Auto-draft ready</span>
            <div style={railSubStyle}>Sourced from this week&rsquo;s activity.</div>
          </div>
          <div style={{ padding: "12px 16px" }}>
            {detail.report.sections.map((s) => (
              <div key={s.id} style={railRowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={railRowTitleStyle}>
                    {SECTION_LABEL[s.sectionType]}
                  </div>
                  <div style={railRowMetaStyle}>
                    {countItems(s)} item{countItems(s) === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <div style={railHeaderStyle}>
          <span style={railTitleStyle}>Recent sends</span>
        </div>
        <div style={{ padding: "12px 16px" }}>
          {recentSent.length === 0 ? (
            <div style={emptyHintStyle}>No reports sent yet.</div>
          ) : (
            recentSent.map((r) => (
              <div key={r.id} style={railRowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={railRowTitleStyle}>
                    Week of {formatWeekShort(r.weekStart, r.weekEnd)}
                  </div>
                  <div style={railRowMetaStyle}>
                    Sent {r.sentAt ? formatDateTime(r.sentAt) : "—"}
                    {r.sentByName ? ` by ${r.sentByName}` : ""}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={railHeaderStyle}>
          <span style={railTitleStyle}>Schedule</span>
          <div style={railSubStyle}>
            Auto-fires Monday 6am in the project&rsquo;s local timezone.
          </div>
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const STATUS_LABEL: Record<WeeklyReportSummaryRow["status"], string> = {
  auto_draft: "Auto-draft",
  editing: "Editing",
  sent: "Sent",
  archived: "Archived",
};

function statusPillColor(s: WeeklyReportSummaryRow["status"]): PillColor {
  if (s === "sent") return "green";
  if (s === "editing") return "blue";
  if (s === "archived") return "gray";
  return "amber"; // auto_draft
}

function computeTotals(reports: WeeklyReportSummaryRow[]): {
  draftCount: number;
  sentThisQuarter: number;
  total: number;
  lastSentLabel: string | null;
  lastSentBy: string | null;
} {
  const ninetyDaysMs = 90 * 86_400_000;
  const cutoff = Date.now() - ninetyDaysMs;
  let draftCount = 0;
  let sentThisQuarter = 0;
  let lastSent: WeeklyReportSummaryRow | null = null;
  for (const r of reports) {
    if (r.status === "auto_draft" || r.status === "editing") draftCount += 1;
    if (r.status === "sent" && r.sentAt) {
      if (r.sentAt.getTime() >= cutoff) sentThisQuarter += 1;
      if (!lastSent || (lastSent.sentAt && r.sentAt > lastSent.sentAt)) {
        lastSent = r;
      }
    }
  }
  return {
    draftCount,
    sentThisQuarter,
    total: reports.length,
    lastSentLabel: lastSent?.sentAt ? formatDateTime(lastSent.sentAt) : null,
    lastSentBy: lastSent?.sentByName ?? null,
  };
}

function countItems(section: WeeklyReportSection): number {
  const c = section.content;
  switch (section.sectionType) {
    case "daily_logs":
      return ((c.entries as unknown[]) ?? []).length;
    case "photos":
      return ((c.items as unknown[]) ?? []).length;
    case "milestones":
      return (
        ((c.closed as unknown[]) ?? []).length +
        ((c.upcoming as unknown[]) ?? []).length
      );
    case "rfis":
      return (
        ((c.opened as unknown[]) ?? []).length +
        ((c.closed as unknown[]) ?? []).length
      );
    case "change_orders":
      return (
        ((c.submitted as unknown[]) ?? []).length +
        ((c.approved as unknown[]) ?? []).length
      );
    case "issues":
      return ((c.items as unknown[]) ?? []).length;
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "\u2026";
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
  // YYYY-MM-DD → UTC date (ignoring timezone). Used for display only;
  // the actual stored value is in project tz local-calendar terms, but
  // for read-only display we render the ymd as-is.
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

function formatGenerated(r: WeeklyReportSummaryRow): string {
  if (r.sentAt) return `Sent ${formatDateTime(r.sentAt)}`;
  return `Generated ${formatDateTime(r.generatedAt)}`;
}

const formatCents = (c: number) => formatMoneyCents(c, { signed: true });

// --------------------------------------------------------------------------
// Inline KPI tile (lighter than the global KpiCard for this density)
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
    <div style={kpiTileStyle(tone)}>
      <div style={kpiLabelStyle}>{label}</div>
      <div style={kpiValueStyle}>{value}</div>
      {meta && <div style={kpiMetaStyle}>{meta}</div>}
    </div>
  );
}

// --------------------------------------------------------------------------
// Styles
// --------------------------------------------------------------------------

const cardStyle: CSSProperties = {
  background: "var(--s1)",
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-xl)",
  boxShadow: "var(--shsm)",
  overflow: "hidden",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "300px minmax(0, 1fr) 280px",
  gap: 14,
  alignItems: "start",
};

const emptyEditorStyle: CSSProperties = {
  ...cardStyle,
  padding: 32,
};

const listHeaderStyle: CSSProperties = {
  padding: "14px 16px 10px",
  borderBottom: "1px solid var(--s3)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const listHeaderTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--t1)",
};

const listCountStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--t3)",
  fontFamily: "var(--fd)",
};

function listRowStyle(active: boolean): CSSProperties {
  return {
    display: "block",
    padding: "12px 14px",
    borderBottom: "1px solid var(--s3)",
    borderLeft: `3px solid ${active ? "var(--ac)" : "transparent"}`,
    background: active ? "var(--ac-s)" : "transparent",
    color: "var(--t1)",
    textDecoration: "none",
    cursor: "pointer",
  };
}

function listRowWeekStyle(active: boolean): CSSProperties {
  return {
    fontFamily: "var(--fd)",
    fontSize: 12,
    fontWeight: 700,
    color: active ? "var(--ac-t)" : "var(--t1)",
    letterSpacing: "-0.01em",
  };
}

const listRowTeaserStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--t2)",
  lineHeight: 1.45,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const listRowFootStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 8,
  fontSize: 11,
  color: "var(--t3)",
  fontFamily: "var(--fd)",
};

const editorHeaderStyle: CSSProperties = {
  padding: "18px 22px",
  borderBottom: "1px solid var(--s3)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
};

const editorTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 18,
  fontWeight: 720,
  letterSpacing: "-0.02em",
  margin: 0,
};

const editorSubStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--t3)",
  fontFamily: "var(--fd)",
};

const summaryBlockStyle: CSSProperties = {
  border: "1px solid color-mix(in srgb, var(--ac) 30%, var(--s3))",
  borderRadius: "var(--r-l)",
  marginBottom: 12,
  overflow: "hidden",
  background: "var(--ac-s)",
};

const summaryHeaderStyle: CSSProperties = {
  padding: "12px 16px",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const summaryHeaderTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--t1)",
};

const summaryHeaderKindStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 650,
  color: "var(--t3)",
  fontFamily: "var(--fd)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const summaryAutoTagStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 10,
  fontWeight: 700,
  color: "var(--ac-t)",
  fontFamily: "var(--fd)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 8,
};

const summaryTextareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 80,
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-m)",
  padding: "10px 12px",
  background: "var(--s1)",
  color: "var(--t1)",
  fontSize: 13,
  fontFamily: "var(--fb)",
  lineHeight: 1.55,
  resize: "vertical",
  outline: "none",
};

const sectionBlockStyle: CSSProperties = {
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-l)",
  marginBottom: 12,
  overflow: "hidden",
  background: "var(--si, var(--s2))",
};

const sectionHeaderStyle: CSSProperties = {
  padding: "12px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  background: "var(--s1)",
  borderBottom: "1px solid var(--s3)",
};

const sectionHeaderTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--t1)",
  letterSpacing: "-0.01em",
};

const sectionHeaderKindStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 650,
  color: "var(--t3)",
  fontFamily: "var(--fd)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const overlayPreviewStyle: CSSProperties = {
  background: "var(--s1)",
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-m)",
  padding: "10px 12px",
  fontSize: 13,
  color: "var(--t1)",
  marginBottom: 10,
  fontStyle: "italic",
  lineHeight: 1.55,
};

const overlayTextareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 60,
  border: "1px solid var(--s3)",
  borderRadius: "var(--r-m)",
  padding: "10px 12px",
  background: "var(--s1)",
  color: "var(--t1)",
  fontSize: 13,
  fontFamily: "var(--fb)",
  lineHeight: 1.55,
  resize: "vertical",
  outline: "none",
};

const editorFooterStyle: CSSProperties = {
  padding: "16px 22px",
  background: "var(--s2)",
  borderTop: "1px solid var(--s3)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const editorFooterMetaStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--t2)",
  lineHeight: 1.4,
};

const logRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  padding: "8px 0",
  borderBottom: "1px dashed var(--s3)",
  fontSize: 12,
};

const logRowDateStyle: CSSProperties = {
  fontFamily: "var(--fm)",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--t3)",
  width: 88,
  flexShrink: 0,
  paddingTop: 1,
};

const logRowReporterStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 11,
  fontWeight: 650,
  color: "var(--t2)",
  marginBottom: 2,
};

const logRowSummaryStyle: CSSProperties = {
  color: "var(--t1)",
  lineHeight: 1.5,
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

const mrowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px dashed var(--s3)",
  gap: 10,
};

const mrowTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 12,
  fontWeight: 650,
  color: "var(--t1)",
  marginBottom: 2,
};

const mrowMonoStyle: CSSProperties = {
  fontFamily: "var(--fm)",
  fontSize: 10,
  color: "var(--t3)",
  marginRight: 6,
};

const mrowDetailStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--t2)",
};

const emptyHintStyle: CSSProperties = {
  padding: "12px 0",
  fontSize: 12,
  color: "var(--t3)",
  fontStyle: "italic",
};

const railHeaderStyle: CSSProperties = {
  padding: "14px 16px 10px",
  borderBottom: "1px solid var(--s3)",
};

const railTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 13,
  fontWeight: 700,
  color: "var(--t1)",
};

const railSubStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--t3)",
  marginTop: 2,
};

const railRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px dashed var(--s3)",
  gap: 8,
};

const railRowTitleStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 12,
  fontWeight: 650,
  color: "var(--t1)",
  marginBottom: 2,
};

const railRowMetaStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--t2)",
  lineHeight: 1.4,
};

function kpiTileStyle(tone: "neutral" | "accent"): CSSProperties {
  return {
    background: "var(--s1)",
    border: `1px solid ${tone === "accent" ? "color-mix(in srgb, var(--ac) 30%, var(--s3))" : "var(--s3)"}`,
    borderRadius: "var(--r-l)",
    padding: "13px 15px",
    boxShadow: "var(--shsm)",
  };
}

const kpiLabelStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--t3)",
};

const kpiValueStyle: CSSProperties = {
  fontFamily: "var(--fd)",
  fontSize: 22,
  fontWeight: 820,
  letterSpacing: "-0.03em",
  marginTop: 4,
};

const kpiMetaStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--t3)",
  marginTop: 2,
};
