"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  MILESTONE_STATUS_VALUES,
  MILESTONE_TYPE_VALUES,
  MILESTONE_VISIBILITY_VALUES,
  countdownLabel,
  formatShortDate,
  residentialTypeLabel,
  type MilestoneRow,
  type MilestoneStatus,
  type MilestoneType,
  type MilestoneVisibility,
  type PhaseGroup,
  type ScheduleStats,
} from "@/domain/loaders/schedule.shared";

type ScheduleRole =
  | "contractor_admin"
  | "contractor_pm"
  | "subcontractor_user"
  | "commercial_client"
  | "residential_client";

type PortalVariant = "contractor" | "subcontractor" | "commercial" | "residential";

type ScheduleViewProps = {
  projectId: string;
  projectName: string;
  role: ScheduleRole;
  canWrite: boolean;
  phases: PhaseGroup[];
  stats: ScheduleStats;
  overallProgressPct: number;
};

type FilterKey = "all" | "upcoming" | "in_progress" | "completed" | "missed";

const ROLE_TO_PORTAL: Record<ScheduleRole, PortalVariant> = {
  contractor_admin: "contractor",
  contractor_pm: "contractor",
  subcontractor_user: "subcontractor",
  commercial_client: "commercial",
  residential_client: "residential",
};

const PORTAL_ACCENT: Record<
  PortalVariant,
  { ac: string; ach: string; acs: string; act: string; acm: string; ri: string }
> = {
  contractor: { ac: "#5b4fc7", ach: "#4f44b3", acs: "#eeedfb", act: "#4a3fb0", acm: "#c7c2ea", ri: "rgba(91,79,199,.15)" },
  subcontractor: { ac: "#3d6b8e", ach: "#345d7c", acs: "#e8f0f6", act: "#2e5a78", acm: "#b3cede", ri: "rgba(61,107,142,.15)" },
  commercial: { ac: "#3178b9", ach: "#296aa6", acs: "#e8f1fa", act: "#276299", acm: "#b0cfe8", ri: "rgba(49,120,185,.15)" },
  residential: { ac: "#2a7f6f", ach: "#237060", acs: "#e6f5f1", act: "#1f6b5d", acm: "#a8d5ca", ri: "rgba(42,127,111,.15)" },
};

// ---- Icons --------------------------------------------------------------

const iconProps = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.4 } as const;
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const s = { width: size, height: size, display: "block" as const };
  switch (name) {
    case "calendar":
      return <svg {...iconProps} style={s}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>;
    case "check":
      return <svg {...iconProps} style={s}><polyline points="20 6 9 17 4 12" /></svg>;
    case "clock":
      return <svg {...iconProps} style={s}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>;
    case "alert":
      return <svg {...iconProps} style={s}><circle cx="12" cy="12" r="10" /><path d="M12 9v4M12 17h.01" /></svg>;
    case "dot":
      return <svg {...iconProps} style={s}><circle cx="12" cy="12" r="1.5" /></svg>;
    case "plus":
      return <svg {...iconProps} style={s}><path d="M12 5v14M5 12h14" /></svg>;
    case "download":
      return <svg {...iconProps} style={s}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
    case "circleSm":
      return <svg {...iconProps} style={s}><circle cx="12" cy="12" r="4" /></svg>;
    default:
      return null;
  }
}

const PILL_COLORS: Record<string, { bg: string; c: string }> = {
  inspection: { bg: "var(--in-s)", c: "var(--in-t)" },
  deadline: { bg: "var(--dg-s)", c: "var(--dg-t)" },
  submission: { bg: "var(--wr-s)", c: "var(--wr-t)" },
  walkthrough: { bg: "var(--sch-acs)", c: "var(--sch-act)" },
  delivery: { bg: "var(--in-s)", c: "var(--in-t)" },
  payment: { bg: "var(--ok-s)", c: "var(--ok-t)" },
  completion: { bg: "var(--ok-s)", c: "var(--ok-t)" },
  custom: { bg: "var(--s2)", c: "var(--t3)" },
};

const STATUS_VISUAL: Record<
  MilestoneStatus,
  { icon: string; bg: string; c: string; border: string }
> = {
  completed: { icon: "check", bg: "var(--ok-s)", c: "var(--ok-t)", border: "var(--ok)" },
  in_progress: { icon: "clock", bg: "var(--sch-acs)", c: "var(--sch-act)", border: "var(--sch-acm)" },
  missed: { icon: "alert", bg: "var(--dg-s)", c: "var(--dg-t)", border: "var(--dg)" },
  scheduled: { icon: "dot", bg: "var(--s2)", c: "var(--t3)", border: "var(--s4)" },
  cancelled: { icon: "dot", bg: "var(--s2)", c: "var(--t3)", border: "var(--s4)" },
};

// ---- Root --------------------------------------------------------------

export function ScheduleView(props: ScheduleViewProps) {
  const portal = ROLE_TO_PORTAL[props.role];
  const accent = PORTAL_ACCENT[portal];

  return (
    <div className={`sch sch-${portal}`}>
      <style dangerouslySetInnerHTML={{ __html: `
.sch {
  --sch-ac: ${accent.ac};
  --sch-ach: ${accent.ach};
  --sch-acs: ${accent.acs};
  --sch-act: ${accent.act};
  --sch-acm: ${accent.acm};
  --sch-ri: 0 0 0 3px ${accent.ri};
          font-family: var(--fb);
          color: var(--t1);
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }
        .sch-hdr { display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap; }
        .sch-hdr h1 { font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;margin:0;color:var(--t1); }
        .sch-hdr.client h1 { font-size:24px; }
        .sch-sub { font-size:13px;color:var(--t2);margin-top:4px;font-weight:520; }
        .sch-hdr-act { display:flex;gap:8px; }
        .sch-btn { height:38px;padding:0 16px;border-radius:var(--r-m);font-size:13px;font-weight:650;display:inline-flex;align-items:center;gap:7px;border:none;cursor:pointer;font-family:var(--fb);transition:all var(--dn) var(--e); }
        .sch-btn.primary { background:var(--sch-ac);color:#fff; }
        .sch-btn.primary:hover { background:var(--sch-ach);box-shadow:var(--shmd); }
        .sch-btn.ghost { background:var(--s1);border:1px solid var(--s3);color:var(--t2); }
        .sch-btn.ghost:hover { background:var(--sh);border-color:var(--s4);color:var(--t1); }
        .sch-btn:disabled { opacity:.55;cursor:not-allowed; }

        .sch-stats { display:flex;gap:12px;flex-wrap:wrap; }
        .sch-stat { background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 18px;flex:1;min-width:180px;display:flex;align-items:center;gap:12px; }
        .sch-stat-ic { width:36px;height:36px;border-radius:var(--r-m);display:grid;place-items:center;flex-shrink:0; }
        .sch-stat-v { font-family:var(--fd);font-size:20px;font-weight:820;letter-spacing:-.02em; }
        .sch-stat-l { font-size:11.5px;color:var(--t3);font-weight:560;margin-top:1px; }

        .sch-pb { background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:18px 20px; }
        .sch-pb-top { display:flex;justify-content:space-between;align-items:center;margin-bottom:10px; }
        .sch-pb-title { font-family:var(--fd);font-size:14px;font-weight:700;letter-spacing:-.01em; }
        .sch-pb-pct { font-family:var(--fd);font-size:20px;font-weight:820;color:var(--sch-act); }
        .sch-pb-track { width:100%;height:10px;background:var(--s2);border-radius:999px;overflow:hidden; }
        .sch-pb-fill { height:100%;border-radius:999px;background:linear-gradient(90deg,var(--sch-ac),var(--sch-ach));transition:width .6s var(--e); }
        .sch-pb-legend { display:flex;justify-content:space-between;gap:8px;margin-top:10px;flex-wrap:wrap; }
        .sch-pb-leg { font-size:10.5px;font-weight:600;color:var(--t3); }
        .sch-pb-leg.done { color:var(--ok-t); }
        .sch-pb-leg.current { color:var(--sch-act);font-weight:700; }

        .sch-tabs { display:inline-flex;gap:2px;background:var(--s2);border-radius:var(--r-m);padding:3px;width:fit-content; }
        .sch-tab { height:30px;padding:0 12px;border-radius:6px;font-size:12px;font-weight:620;color:var(--t3);background:transparent;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-family:var(--fb);transition:all var(--df); }
        .sch-tab.on { background:var(--s1);color:var(--t1);box-shadow:var(--shsm); }
        .sch-tab-ct { font-family:var(--fd);font-size:10px;font-weight:700;color:var(--sch-act);background:var(--sch-acs);min-width:16px;height:16px;padding:0 5px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center; }

        .sch-phase { display:flex;flex-direction:column;gap:6px; }
        .sch-phase-hdr { display:flex;align-items:center;gap:10px;padding-bottom:8px;margin-bottom:6px;border-bottom:1px solid var(--s3); }
        .sch-phase-dot { width:10px;height:10px;border-radius:50%;background:var(--s4);flex-shrink:0; }
        .sch-phase-dot.done { background:var(--ok); }
        .sch-phase-dot.active { background:var(--sch-ac);box-shadow:0 0 0 3px var(--sch-acs); }
        .sch-phase-name { font-family:var(--fd);font-size:15px;font-weight:720;letter-spacing:-.02em; }
        .sch-phase-dates { font-size:12px;color:var(--t3);font-weight:530; }
        .sch-phase-prog { margin-left:auto;font-family:var(--fd);font-size:12px;font-weight:700;color:var(--t3); }
        .sch-phase-prog.done { color:var(--ok-t); }
        .sch-phases { display:flex;flex-direction:column;gap:24px; }

        .sch-card { background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 18px;display:flex;align-items:center;gap:14px;transition:all var(--df);cursor:default; }
        .sch-card:hover { border-color:var(--s4);box-shadow:var(--shsm); }
        .sch-card.missed { border-left:3px solid var(--dg); }
        .sch-card.in_progress { border-left:3px solid var(--sch-ac); }
        .sch-card.completed { opacity:.7; }
        .sch-card.completed:hover { opacity:1; }
        .sch-card-ic { width:28px;height:28px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;border:2px solid var(--s4); }
        .sch-card-body { flex:1;min-width:0; }
        .sch-card-title { font-size:13.5px;font-weight:640;color:var(--t1); }
        .sch-card.completed .sch-card-title { color:var(--t3);text-decoration:line-through; }
        .sch-card-desc { font-size:12px;color:var(--t2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:520; }
        .sch-pill { font-family:var(--fd);font-size:10px;font-weight:650;padding:3px 8px;border-radius:999px;white-space:nowrap;flex-shrink:0;text-transform:capitalize; }
        .sch-assignee { display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--t3);font-weight:560;white-space:nowrap;flex-shrink:0; }
        .sch-assignee-av { width:20px;height:20px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:8px;font-weight:700;color:#fff;background:var(--sch-ac); }
        .sch-assignee-nm { font-family:var(--fd);font-size:11px;font-weight:620; }
        .sch-card-date { text-align:right;flex-shrink:0;min-width:92px; }
        .sch-card-d1 { font-size:12.5px;font-weight:600;color:var(--t1);font-family:var(--fb); }
        .sch-card-d2 { font-size:10.5px;margin-top:1px;font-weight:520;color:var(--t3); }
        .sch-card-d2.overdue { color:var(--dg-t);font-weight:650; }
        .sch-card-d2.soon { color:var(--wr-t);font-weight:600; }
        .sch-card-d2.done { color:var(--ok-t); }
        .sch-edit-btn { font-size:11px;font-weight:620;border:1px solid var(--s3);background:var(--s1);color:var(--t2);border-radius:var(--r-s);padding:4px 10px;cursor:pointer;font-family:var(--fb); }
        .sch-edit-btn:hover { background:var(--sh);color:var(--t1); }

        .sch-empty { padding:48px 24px;text-align:center;color:var(--t3);font-size:13px;font-weight:540;background:var(--s1);border:1px dashed var(--s4);border-radius:var(--r-l); }

        .sch-tl { position:relative;padding-left:32px; }
        .sch-tl-line { position:absolute;left:9px;top:4px;bottom:4px;width:2px;background:var(--s3); }
        .sch-tl-item { position:relative;margin-bottom:18px; }
        .sch-tl-dot { position:absolute;left:-28px;top:4px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;z-index:1;background:var(--s1);border:2px solid var(--s4);color:var(--t3); }
        .sch-tl-dot.done { background:var(--ok);border-color:var(--ok);color:#fff; }
        .sch-tl-dot.active { background:var(--sch-ac);border-color:var(--sch-ac);color:#fff;box-shadow:0 0 0 4px var(--sch-acs); }
        .sch-tl-dot.missed { background:var(--dg);border-color:var(--dg);color:#fff; }
        .sch-tl-card { background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 18px; }
        .sch-tl-card.active { background:linear-gradient(135deg,var(--s1),var(--sch-acs));border-color:var(--sch-acm); }
        .sch-tl-top { display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:4px; }
        .sch-tl-title { font-size:14px;font-weight:650;color:var(--t1); }
        .sch-tl-date { font-size:12px;color:var(--t3);font-weight:560;white-space:nowrap; }
        .sch-tl-desc { font-size:12.5px;color:var(--t2);line-height:1.5;font-weight:520; }
        .sch-tl-meta { font-size:11px;color:var(--t3);margin-top:8px;font-weight:560;display:flex;align-items:center;gap:8px;flex-wrap:wrap; }
        .sch-tl-meta .sch-pill { font-size:10.5px;padding:3px 8px; }

        .sch-form { background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:18px 20px;display:grid;gap:10px;max-width:560px; }
        .sch-form h2 { font-family:var(--fd);font-size:15px;font-weight:720;letter-spacing:-.02em;margin:0 0 4px; }
        .sch-form label { font-size:12px;font-weight:640;color:var(--t2);display:grid;gap:4px;font-family:var(--fb); }
        .sch-inp, .sch-sel, .sch-txt { width:100%;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s2);padding:8px 12px;font-size:13px;color:var(--t1);outline:none;font-family:var(--fb); }
        .sch-inp:focus, .sch-sel:focus, .sch-txt:focus { border-color:var(--sch-ac);box-shadow:var(--sch-ri);background:var(--s1); }
        .sch-form-row { display:grid;grid-template-columns:1fr 1fr;gap:10px; }
        .sch-form-acts { display:flex;gap:8px;justify-content:flex-end;margin-top:6px; }
        .sch-err { font-size:12px;color:var(--dg-t);font-weight:540; }
      ` }} />

      {portal === "residential" ? (
        <ResidentialTimeline {...props} />
      ) : portal === "commercial" ? (
        <CommercialTimeline {...props} />
      ) : (
        <StandardSchedule {...props} portal={portal} />
      )}
    </div>
  );
}

// ---- Standard (contractor / subcontractor) -----------------------------

function StandardSchedule({
  projectId,
  projectName,
  canWrite,
  phases,
  stats,
  overallProgressPct,
  portal,
}: ScheduleViewProps & { portal: PortalVariant }) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filteredPhases = useMemo(() => applyFilter(phases, filter), [phases, filter]);

  const isContractor = portal === "contractor";
  const subtitleDetail = isContractor
    ? `${projectName} · ${stats.total} milestone${stats.total === 1 ? "" : "s"} across ${phases.length} phase${phases.length === 1 ? "" : "s"}`
    : `${projectName} · Your milestones · ${stats.total} total`;

  return (
    <>
      <header className="sch-hdr">
        <div>
          <h1>Schedule</h1>
          <div className="sch-sub">{subtitleDetail}</div>
        </div>
        {isContractor && (
          <div className="sch-hdr-act">
            <button className="sch-btn ghost" type="button" disabled>
              <Icon name="download" size={14} /> Export
            </button>
            {canWrite && (
              <button
                className="sch-btn primary"
                type="button"
                onClick={() => setShowCreate((v) => !v)}
              >
                <Icon name="plus" size={16} />
                {showCreate ? "Close" : "Add Milestone"}
              </button>
            )}
          </div>
        )}
      </header>

      <StatsRow stats={stats} variant={portal} />

      {isContractor && (
        <ProgressCard
          title="Overall Project Progress"
          pct={overallProgressPct}
          phases={phases}
        />
      )}

      <FilterTabs filter={filter} setFilter={setFilter} stats={stats} />

      {showCreate && canWrite && <CreateMilestoneForm projectId={projectId} />}

      <div className="sch-phases">
        {filteredPhases.length === 0 ? (
          <div className="sch-empty">No milestones match this filter.</div>
        ) : isContractor ? (
          filteredPhases.map((phase) => (
            <PhaseBlock
              key={phase.name}
              phase={phase}
              readOnly={!canWrite}
              isContractor
            />
          ))
        ) : (
          <div className="sch-phase">
            {filteredPhases.flatMap((p) => p.milestones).map((m) => (
              <MilestoneCard
                key={m.id}
                milestone={m}
                readOnly={!canWrite}
                isContractor={false}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function StatsRow({
  stats,
  variant,
}: {
  stats: ScheduleStats;
  variant: PortalVariant;
}) {
  const cells =
    variant === "subcontractor"
      ? [
          { key: "completed", icon: "check", value: stats.completed, label: "Completed", tone: "ok" },
          { key: "inProgress", icon: "clock", value: stats.inProgress, label: "In Progress", tone: "ac" },
          { key: "missed", icon: "alert", value: stats.missed, label: "Overdue", tone: "dg" },
        ]
      : [
          { key: "total", icon: "calendar", value: stats.total, label: "Total Milestones", tone: "ac" },
          { key: "completed", icon: "check", value: stats.completed, label: "Completed", tone: "ok" },
          { key: "upcoming", icon: "clock", value: stats.upcoming, label: "Upcoming (2 Weeks)", tone: "in" },
          { key: "missed", icon: "alert", value: stats.missed, label: "Missed / At Risk", tone: "dg" },
        ];
  const toneStyle = (tone: string) => {
    switch (tone) {
      case "ok":
        return { bg: "var(--ok-s)", c: "var(--ok-t)" };
      case "in":
        return { bg: "var(--in-s)", c: "var(--in-t)" };
      case "dg":
        return { bg: "var(--dg-s)", c: "var(--dg-t)" };
      default:
        return { bg: "var(--sch-acs)", c: "var(--sch-act)" };
    }
  };
  return (
    <div className="sch-stats">
      {cells.map((c) => {
        const t = toneStyle(c.tone);
        return (
          <div key={c.key} className="sch-stat">
            <div className="sch-stat-ic" style={{ background: t.bg, color: t.c }}>
              <Icon name={c.icon} size={18} />
            </div>
            <div>
              <div className="sch-stat-v">{c.value}</div>
              <div className="sch-stat-l">{c.label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressCard({
  title,
  pct,
  phases,
}: {
  title: string;
  pct: number;
  phases: PhaseGroup[];
}) {
  return (
    <div className="sch-pb">
      <div className="sch-pb-top">
        <div className="sch-pb-title">{title}</div>
        <div className="sch-pb-pct">{pct}%</div>
      </div>
      <div className="sch-pb-track">
        <div className="sch-pb-fill" style={{ width: `${pct}%` }} />
      </div>
      {phases.length > 0 && (
        <div className="sch-pb-legend">
          {phases.map((p) => (
            <span
              key={p.name}
              className={`sch-pb-leg ${p.state === "completed" ? "done" : p.state === "active" ? "current" : ""}`}
            >
              {p.state === "completed" ? "✓ " : p.state === "active" ? "● " : ""}
              {p.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTabs({
  filter,
  setFilter,
  stats,
}: {
  filter: FilterKey;
  setFilter: (k: FilterKey) => void;
  stats: ScheduleStats;
}) {
  const tabs: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "all", label: "All", count: stats.total },
    { key: "upcoming", label: "Upcoming", count: stats.upcoming },
    { key: "in_progress", label: "In Progress", count: stats.inProgress },
    { key: "completed", label: "Completed", count: stats.completed },
    { key: "missed", label: "Missed", count: stats.missed },
  ];
  return (
    <div className="sch-tabs">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`sch-tab ${filter === t.key ? "on" : ""}`}
          onClick={() => setFilter(t.key)}
        >
          {t.label}
          <span className="sch-tab-ct">{t.count}</span>
        </button>
      ))}
    </div>
  );
}

function applyFilter(phases: PhaseGroup[], filter: FilterKey): PhaseGroup[] {
  if (filter === "all") return phases;
  const keep = (m: MilestoneRow) => {
    if (filter === "completed") return m.milestoneStatus === "completed";
    if (filter === "in_progress") return m.milestoneStatus === "in_progress";
    if (filter === "missed") return m.milestoneStatus === "missed";
    if (filter === "upcoming") {
      if (m.milestoneStatus !== "scheduled") return false;
      const days = (m.scheduledDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      return days >= 0 && days <= 14;
    }
    return true;
  };
  return phases
    .map((p) => ({ ...p, milestones: p.milestones.filter(keep) }))
    .filter((p) => p.milestones.length > 0);
}

function PhaseBlock({
  phase,
  readOnly,
  isContractor,
}: {
  phase: PhaseGroup;
  readOnly: boolean;
  isContractor: boolean;
}) {
  const allDone = phase.completedCount === phase.totalCount && phase.totalCount > 0;
  return (
    <section className="sch-phase">
      <div className="sch-phase-hdr">
        <span
          className={`sch-phase-dot ${phase.state === "completed" ? "done" : phase.state === "active" ? "active" : ""}`}
        />
        <span className="sch-phase-name">{phase.name}</span>
        {phase.firstDate && phase.lastDate && (
          <span className="sch-phase-dates">
            {formatShortDate(phase.firstDate)} – {formatShortDate(phase.lastDate)}
          </span>
        )}
        <span className={`sch-phase-prog ${allDone ? "done" : ""}`}>
          {phase.completedCount}/{phase.totalCount}
        </span>
      </div>
      {phase.milestones.map((m) => (
        <MilestoneCard
          key={m.id}
          milestone={m}
          readOnly={readOnly}
          isContractor={isContractor}
        />
      ))}
    </section>
  );
}

function MilestoneCard({
  milestone: m,
  readOnly,
  isContractor,
}: {
  milestone: MilestoneRow;
  readOnly: boolean;
  isContractor: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const cd = countdownLabel(m);
  const sv = STATUS_VISUAL[m.milestoneStatus];
  const pc = PILL_COLORS[m.milestoneType] ?? PILL_COLORS.custom;
  const d2Class =
    cd.tone === "overdue"
      ? "overdue"
      : cd.tone === "soon"
        ? "soon"
        : cd.tone === "done"
          ? "done"
          : "";
  return (
    <>
      <div className={`sch-card ${m.milestoneStatus}`}>
        <div
          className="sch-card-ic"
          style={{ background: sv.bg, color: sv.c, borderColor: sv.border }}
        >
          <Icon name={sv.icon} size={14} />
        </div>
        <div className="sch-card-body">
          <div className="sch-card-title">{m.title}</div>
          {m.description && <div className="sch-card-desc">{m.description}</div>}
        </div>
        <span className="sch-pill" style={{ background: pc.bg, color: pc.c }}>
          {m.milestoneType}
        </span>
        {(m.assignedToUserName || m.assignedToOrganizationName) && (
          <div className="sch-assignee">
            <div className="sch-assignee-av">
              {initialsOf(m.assignedToOrganizationName ?? m.assignedToUserName ?? "")}
            </div>
            <span className="sch-assignee-nm">
              {m.assignedToOrganizationName ?? m.assignedToUserName}
            </span>
          </div>
        )}
        <div className="sch-card-date">
          <div className="sch-card-d1">{formatShortDate(m.scheduledDate)}</div>
          <div className={`sch-card-d2 ${d2Class}`}>{cd.text}</div>
        </div>
        {!readOnly && (
          <button
            type="button"
            className="sch-edit-btn"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        )}
      </div>
      {editing && !readOnly && (
        <EditMilestoneForm
          milestone={m}
          onDone={() => setEditing(false)}
          isContractor={isContractor}
        />
      )}
    </>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// ---- Commercial timeline ------------------------------------------------

function CommercialTimeline({
  projectName,
  phases,
  overallProgressPct,
}: ScheduleViewProps) {
  // Curated subset: completed (recent), in-progress, and the next handful
  // of upcoming items. Commercial clients see the narrative, not the
  // contractor's full working list.
  const items = useMemo(() => curatedTimelineItems(phases), [phases]);

  return (
    <>
      <header className="sch-hdr client">
        <div>
          <h1>Project Schedule</h1>
          <div className="sch-sub">
            {projectName} · Updated {formatShortDate(new Date())}
          </div>
        </div>
      </header>

      <ProgressCard
        title="Overall Progress"
        pct={overallProgressPct}
        phases={phases}
      />

      <TimelineList items={items} transformLabel={(t) => labelOf(t)} />
    </>
  );
}

// ---- Residential timeline ----------------------------------------------

function ResidentialTimeline({
  projectName,
  phases,
  overallProgressPct,
}: ScheduleViewProps) {
  const items = useMemo(() => curatedTimelineItems(phases), [phases]);

  return (
    <>
      <header className="sch-hdr client">
        <div>
          <h1>Your Project Timeline</h1>
          <div className="sch-sub">
            {projectName} · Last updated {formatShortDate(new Date())}
          </div>
        </div>
      </header>

      <ProgressCard
        title="How Your Home is Coming Along"
        pct={overallProgressPct}
        phases={phases}
      />

      <TimelineList items={items} transformLabel={residentialTypeLabel} />
    </>
  );
}

function curatedTimelineItems(phases: PhaseGroup[]): MilestoneRow[] {
  const all = phases
    .flatMap((p) => p.milestones)
    .filter((m) => m.milestoneStatus !== "cancelled");
  const completed = all
    .filter((m) => m.milestoneStatus === "completed")
    .sort((a, b) => (b.completedDate ?? b.scheduledDate).getTime() - (a.completedDate ?? a.scheduledDate).getTime())
    .slice(0, 4)
    .reverse();
  const inProgress = all.filter((m) => m.milestoneStatus === "in_progress");
  const missed = all.filter((m) => m.milestoneStatus === "missed");
  const upcoming = all
    .filter((m) => m.milestoneStatus === "scheduled")
    .sort((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
    .slice(0, 4);
  return [...completed, ...missed, ...inProgress, ...upcoming];
}

function labelOf(t: MilestoneType): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function TimelineList({
  items,
  transformLabel,
}: {
  items: MilestoneRow[];
  transformLabel: (t: MilestoneType) => string;
}) {
  if (items.length === 0) {
    return <div className="sch-empty">No milestones to share yet — check back soon.</div>;
  }
  return (
    <div className="sch-tl">
      <div className="sch-tl-line" />
      {items.map((m) => (
        <TimelineItem key={m.id} milestone={m} transformLabel={transformLabel} />
      ))}
    </div>
  );
}

function TimelineItem({
  milestone: m,
  transformLabel,
}: {
  milestone: MilestoneRow;
  transformLabel: (t: MilestoneType) => string;
}) {
  const cd = countdownLabel(m);
  const isDone = m.milestoneStatus === "completed";
  const isActive = m.milestoneStatus === "in_progress";
  const isMissed = m.milestoneStatus === "missed";
  const pc = PILL_COLORS[m.milestoneType] ?? PILL_COLORS.custom;
  const dotClass = isDone ? "done" : isActive ? "active" : isMissed ? "missed" : "";
  return (
    <div className="sch-tl-item">
      <div className={`sch-tl-dot ${dotClass}`}>
        {isDone ? <Icon name="check" size={10} /> : isActive ? <Icon name="circleSm" size={10} /> : null}
      </div>
      <div className={`sch-tl-card ${isActive ? "active" : ""}`}>
        <div className="sch-tl-top">
          <span className="sch-tl-title">{m.title}</span>
          <span className="sch-tl-date">
            {isActive ? "In progress" : formatShortDate(m.scheduledDate)}
          </span>
        </div>
        {m.description && <div className="sch-tl-desc">{m.description}</div>}
        <div className="sch-tl-meta">
          <span className="sch-pill" style={{ background: pc.bg, color: pc.c }}>
            {transformLabel(m.milestoneType)}
          </span>
          <span>{cd.text}</span>
        </div>
      </div>
    </div>
  );
}

// ---- Forms --------------------------------------------------------------

function CreateMilestoneForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [milestoneType, setMilestoneType] = useState<MilestoneType>("custom");
  const [phase, setPhase] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [visibilityScope, setVisibilityScope] = useState<MilestoneVisibility>("project_wide");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !scheduledDate) {
      setError("missing_fields");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch("/api/milestones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        description: description || undefined,
        milestoneType,
        phase: phase || undefined,
        scheduledDate: new Date(scheduledDate).toISOString(),
        visibilityScope,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "create_failed");
      return;
    }
    setTitle("");
    setDescription("");
    setPhase("");
    setScheduledDate("");
    router.refresh();
  }

  return (
    <form className="sch-form" onSubmit={onSubmit}>
      <h2>New Milestone</h2>
      <label>
        Title
        <input
          className="sch-inp"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Draw #4 Submission"
        />
      </label>
      <label>
        Description
        <textarea
          className="sch-txt"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional context"
        />
      </label>
      <div className="sch-form-row">
        <label>
          Type
          <select
            className="sch-sel"
            value={milestoneType}
            onChange={(e) => setMilestoneType(e.target.value as MilestoneType)}
          >
            {MILESTONE_TYPE_VALUES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Scheduled date
          <input
            className="sch-inp"
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </label>
      </div>
      <div className="sch-form-row">
        <label>
          Phase
          <input
            className="sch-inp"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            placeholder="Phase 2 — MEP"
          />
        </label>
        <label>
          Visibility
          <select
            className="sch-sel"
            value={visibilityScope}
            onChange={(e) => setVisibilityScope(e.target.value as MilestoneVisibility)}
          >
            {MILESTONE_VISIBILITY_VALUES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="sch-form-acts">
        <button className="sch-btn primary" type="submit" disabled={pending}>
          {pending ? "Creating..." : "Create milestone"}
        </button>
      </div>
      {error && <div className="sch-err">Error: {error}</div>}
    </form>
  );
}

function EditMilestoneForm({
  milestone: m,
  onDone,
  isContractor,
}: {
  milestone: MilestoneRow;
  onDone: () => void;
  isContractor: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(m.title);
  const [description, setDescription] = useState(m.description ?? "");
  const [milestoneType, setMilestoneType] = useState<MilestoneType>(m.milestoneType);
  const [milestoneStatus, setMilestoneStatus] = useState<MilestoneStatus>(m.milestoneStatus);
  const [scheduledDate, setScheduledDate] = useState(
    m.scheduledDate.toISOString().slice(0, 10),
  );
  const [phase, setPhase] = useState(m.phase ?? "");
  const [visibilityScope, setVisibilityScope] = useState<MilestoneVisibility>(m.visibilityScope);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/milestones/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: description || null,
        milestoneType,
        milestoneStatus,
        scheduledDate: new Date(scheduledDate).toISOString(),
        phase: phase || null,
        visibilityScope,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "update_failed");
      return;
    }
    onDone();
    router.refresh();
  }

  async function cancelMilestone() {
    if (!window.confirm("Cancel this milestone? (cannot be undone)")) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/milestones/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ milestoneStatus: "cancelled" }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "cancel_failed");
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <form className="sch-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <h2>Edit Milestone</h2>
      <label>
        Title
        <input className="sch-inp" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label>
        Description
        <textarea
          className="sch-txt"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="sch-form-row">
        {isContractor && (
          <label>
            Type
            <select
              className="sch-sel"
              value={milestoneType}
              onChange={(e) => setMilestoneType(e.target.value as MilestoneType)}
            >
              {MILESTONE_TYPE_VALUES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Status
          <select
            className="sch-sel"
            value={milestoneStatus}
            onChange={(e) => setMilestoneStatus(e.target.value as MilestoneStatus)}
          >
            {MILESTONE_STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isContractor && (
        <div className="sch-form-row">
          <label>
            Scheduled date
            <input
              className="sch-inp"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </label>
          <label>
            Phase
            <input
              className="sch-inp"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
            />
          </label>
        </div>
      )}
      {isContractor && (
        <label>
          Visibility
          <select
            className="sch-sel"
            value={visibilityScope}
            onChange={(e) => setVisibilityScope(e.target.value as MilestoneVisibility)}
          >
            {MILESTONE_VISIBILITY_VALUES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="sch-form-acts">
        <button className="sch-btn ghost" type="button" onClick={onDone} disabled={pending}>
          Close
        </button>
        {isContractor && m.milestoneStatus !== "cancelled" && (
          <button className="sch-btn ghost" type="button" onClick={cancelMilestone} disabled={pending}>
            Cancel milestone
          </button>
        )}
        <button className="sch-btn primary" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
      {error && <div className="sch-err">Error: {error}</div>}
    </form>
  );
}
