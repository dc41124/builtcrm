"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ProjectChip,
  StatusPill,
  TtIcons,
  WorkerAvatar,
} from "@/components/time-tracking/icons";
import { fmt12, minsToDecimal, minsToHM, minsToHMSlim } from "@/lib/time-tracking/format";
import type {
  AdminTeamView,
  AdminWorkerDetailView,
  TimeEntryRow,
} from "@/domain/loaders/time-entries";

interface Props {
  team: AdminTeamView;
  workerDetail: AdminWorkerDetailView | null;
}

export function AdminTimeTrackingShell({ team, workerDetail }: Props) {
  const router = useRouter();
  const [view, setView] = useState<"team" | "approvals" | "worker">(
    workerDetail ? "worker" : "team",
  );
  const [search, setSearch] = useState("");
  const [amendModalEntry, setAmendModalEntry] = useState<TimeEntryRow | null>(
    null,
  );
  const [rejectModalEntry, setRejectModalEntry] = useState<TimeEntryRow | null>(
    null,
  );
  const [toast, setToast] = useState<{ kind: "ok" | "wr" | "er"; text: string } | null>(
    null,
  );
  const [pending, setPending] = useState(false);

  const showToast = (kind: "ok" | "wr" | "er", text: string, ms = 2200) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), ms);
  };

  const allRunning = useMemo(
    () => team.entries.filter((e) => e.status === "running"),
    [team.entries],
  );
  const pendingApprovalEntries = useMemo(
    () => team.entries.filter((e) => e.status === "submitted"),
    [team.entries],
  );
  const teamWeekData = useMemo(
    () =>
      team.workers.map((w) => {
        const wEntries = team.entries.filter((e) => e.userId === w.id);
        const total = wEntries.reduce(
          (acc, e) =>
            acc +
            (e.status === "running"
              ? e.liveMinutes ?? 0
              : e.minutes ?? 0),
          0,
        );
        return {
          worker: w,
          entries: wEntries,
          total,
          submitted: wEntries.filter((e) => e.status === "submitted").length,
          draft: wEntries.filter((e) => e.status === "draft").length,
          running: wEntries.filter((e) => e.status === "running").length,
          approved: wEntries.filter((e) => e.status === "approved").length,
          amended: wEntries.filter((e) => e.status === "amended").length,
          rejected: wEntries.filter((e) => e.status === "rejected").length,
        };
      }),
    [team.workers, team.entries],
  );

  async function approve(id: string) {
    setPending(true);
    try {
      const r = await fetch(`/api/time-entries/${id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        showToast("er", j.message ?? "Failed to approve");
        return;
      }
      showToast("ok", "Entry approved");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function reject(id: string, reason: string) {
    setPending(true);
    try {
      const r = await fetch(`/api/time-entries/${id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reject: true, reason }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        showToast("er", j.message ?? "Failed to reject");
        return;
      }
      setRejectModalEntry(null);
      showToast("wr", "Entry rejected — worker notified");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function amend(input: {
    id: string;
    clockInAt: string;
    clockOutAt: string;
    reason: string;
  }) {
    setPending(true);
    try {
      const r = await fetch(`/api/time-entries/${input.id}/amend`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clockInAt: input.clockInAt,
          clockOutAt: input.clockOutAt,
          reason: input.reason,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { message?: string };
        showToast("er", j.message ?? "Failed to amend");
        return;
      }
      setAmendModalEntry(null);
      showToast("ok", "Entry amended · audit record created");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="tt-root"
      style={{ padding: "8px 24px 60px", minHeight: "100vh" }}
    >
      <div
        className="tt-filter-pills"
        style={{ marginBottom: 18, width: "fit-content" }}
      >
        <Link
          href="/subcontractor/time"
          className="tt-filter-pill"
          style={{ textDecoration: "none" }}
        >
          {TtIcons.user} My time
        </Link>
        <button
          className={`tt-filter-pill${view === "team" ? " active" : ""}`}
          onClick={() => setView("team")}
        >
          {TtIcons.users} Team
          <span className="tt-filter-pill-count">{team.workers.length}</span>
        </button>
        <button
          className={`tt-filter-pill${view === "approvals" ? " active" : ""}`}
          onClick={() => setView("approvals")}
        >
          {TtIcons.check} Approvals
          <span className="tt-filter-pill-count">
            {pendingApprovalEntries.length}
          </span>
        </button>
        {workerDetail && (
          <button
            className={`tt-filter-pill${view === "worker" ? " active" : ""}`}
            onClick={() => setView("worker")}
          >
            {TtIcons.user} {workerDetail.worker.name.split(" ")[0]}
          </button>
        )}
      </div>

      {view === "team" && (
        <TeamPane
          team={team}
          allRunning={allRunning}
          pendingApprovalEntries={pendingApprovalEntries}
          teamWeekData={teamWeekData}
          search={search}
          onSearch={setSearch}
          onWeekOffset={(d) => {
            const params = new URLSearchParams();
            params.set("week", String(team.weekOffset + d));
            router.push(`/subcontractor/time/admin?${params.toString()}`);
          }}
          onReviewApprovals={() => setView("approvals")}
        />
      )}
      {view === "approvals" && (
        <ApprovalsPane
          team={team}
          entries={pendingApprovalEntries}
          onAmend={(e) => setAmendModalEntry(e)}
          onApprove={approve}
          onReject={(e) => setRejectModalEntry(e)}
          onApproveAll={async () => {
            for (const e of pendingApprovalEntries) {
              await approve(e.id);
            }
          }}
          pending={pending}
        />
      )}
      {view === "worker" && workerDetail && (
        <WorkerDetailPane
          detail={workerDetail}
          onAmend={(e) => setAmendModalEntry(e)}
          onApprove={approve}
          onReject={(e) => setRejectModalEntry(e)}
          onBack={() => setView("team")}
          pending={pending}
        />
      )}

      {amendModalEntry && (
        <AmendModal
          entry={amendModalEntry}
          onCancel={() => setAmendModalEntry(null)}
          onConfirm={(input) =>
            amend({
              id: amendModalEntry.id,
              clockInAt: input.clockInAt,
              clockOutAt: input.clockOutAt,
              reason: input.reason,
            })
          }
          pending={pending}
        />
      )}
      {rejectModalEntry && (
        <RejectModal
          entry={rejectModalEntry}
          onCancel={() => setRejectModalEntry(null)}
          onConfirm={(reason) => reject(rejectModalEntry.id, reason)}
          pending={pending}
        />
      )}

      {toast && (
        <div className={`tt-toast ${toast.kind}`}>
          {toast.kind === "ok" ? TtIcons.check : TtIcons.alert}
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Team pane
// ─────────────────────────────────────────────────────────────────────────

function TeamPane(props: {
  team: AdminTeamView;
  allRunning: TimeEntryRow[];
  pendingApprovalEntries: TimeEntryRow[];
  teamWeekData: Array<{
    worker: AdminTeamView["workers"][number];
    entries: TimeEntryRow[];
    total: number;
    submitted: number;
    draft: number;
    running: number;
    approved: number;
    amended: number;
    rejected: number;
  }>;
  search: string;
  onSearch: (s: string) => void;
  onWeekOffset: (d: number) => void;
  onReviewApprovals: () => void;
}) {
  const router = useRouter();
  const teamTotal = props.teamWeekData.reduce((a, w) => a + w.total, 0);
  const isCurrent = props.team.weekOffset === 0;

  return (
    <>
      <div className="tt-page-hdr">
        <div>
          <h1 className="tt-page-title">Team timesheets</h1>
          <div className="tt-page-sub">
            {props.team.workers.length} workers · {props.allRunning.length}{" "}
            clocked in now · {props.team.pendingApprovalCount} entries awaiting
            approval
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="tt-btn primary"
            onClick={props.onReviewApprovals}
            disabled={props.team.pendingApprovalCount === 0}
          >
            {TtIcons.check} Review approvals ({props.team.pendingApprovalCount})
          </button>
        </div>
      </div>

      {props.team.pendingApprovalCount > 0 && (
        <div className="tt-banner wr">
          {TtIcons.alert}
          <span>
            <strong>{props.team.pendingApprovalCount} entries</strong> from{" "}
            {[...new Set(props.pendingApprovalEntries.map((e) => e.userId))].length}{" "}
            workers are awaiting your approval. Payroll cutoff is Sunday at
            11:59 PM.
          </span>
          <button className="tt-btn tt-banner-cta" onClick={props.onReviewApprovals}>
            Review now {TtIcons.chevR}
          </button>
        </div>
      )}

      <div className="tt-kpi-strip">
        <div className="tt-kpi">
          <div className="tt-kpi-key">Active now</div>
          <div className="tt-kpi-val">
            {props.allRunning.length}
            <span className="tt-kpi-unit">/ {props.team.workers.length}</span>
          </div>
          <div className="tt-kpi-foot ok">On the clock</div>
          <div
            className="tt-kpi-bar"
            style={{
              width:
                props.team.workers.length > 0
                  ? `${(props.allRunning.length / props.team.workers.length) * 100}%`
                  : "0%",
              background: "var(--ok)",
            }}
          />
        </div>
        <div className="tt-kpi">
          <div className="tt-kpi-key">Team week total</div>
          <div className="tt-kpi-val">
            {Math.floor(teamTotal / 60)}
            <span className="tt-kpi-unit">h</span>
          </div>
          <div className="tt-kpi-foot">
            across {props.teamWeekData.filter((w) => w.total > 0).length} workers
          </div>
        </div>
        <div className="tt-kpi">
          <div className="tt-kpi-key">Pending approval</div>
          <div className="tt-kpi-val">{props.team.pendingApprovalCount}</div>
          <div className="tt-kpi-foot wr">
            {props.team.rejectedCount} rejected
          </div>
        </div>
        <div className="tt-kpi">
          <div className="tt-kpi-key">Approved this week</div>
          <div className="tt-kpi-val">
            {props.team.entries.filter((e) => e.status === "approved").length}
            <span className="tt-kpi-unit"> entries</span>
          </div>
          <div className="tt-kpi-foot ok">{TtIcons.check} Logged</div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="tt-week-nav">
            <button
              className="tt-week-nav-btn"
              onClick={() => props.onWeekOffset(-1)}
              disabled={props.team.weekOffset <= -12}
              aria-label="Previous week"
            >
              {TtIcons.chevL}
            </button>
            <button
              className="tt-week-nav-btn"
              onClick={() => props.onWeekOffset(1)}
              disabled={props.team.weekOffset >= 0}
              aria-label="Next week"
            >
              {TtIcons.chevR}
            </button>
          </div>
          <div
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            {isCurrent ? "This week" : `${-props.team.weekOffset} week(s) ago`} ·{" "}
            {props.team.weekDays[0].display}–{props.team.weekDays[6].display}
          </div>
        </div>
        <div className="tt-search">
          {TtIcons.search}
          <input
            type="text"
            placeholder="Search workers..."
            value={props.search}
            onChange={(e) => props.onSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="tt-team-grid">
        {props.teamWeekData
          .filter(
            ({ worker }) =>
              !props.search ||
              worker.name.toLowerCase().includes(props.search.toLowerCase()),
          )
          .map((data) => {
            const projectsActive = [
              ...new Set(data.entries.map((e) => e.projectName)),
            ];
            const isRunning = data.running > 0;
            return (
              <div
                key={data.worker.id}
                className="tt-team-card"
                onClick={() =>
                  router.push(
                    `/subcontractor/time/admin?week=${props.team.weekOffset}&worker=${data.worker.id}`,
                  )
                }
                role="button"
                tabIndex={0}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    router.push(
                      `/subcontractor/time/admin?week=${props.team.weekOffset}&worker=${data.worker.id}`,
                    );
                  }
                }}
              >
                <div className="tt-team-card-hdr">
                  <WorkerAvatar initials={data.worker.initials} size="lg" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tt-team-card-name">{data.worker.name}</div>
                    <div className="tt-team-card-role">
                      {data.worker.isAdmin ? "Admin" : "Worker"}
                    </div>
                  </div>
                  <div className="tt-team-card-status">
                    {isRunning ? (
                      <span
                        className="tt-status-pill"
                        style={{
                          color: "var(--ok)",
                          background: "var(--ok-soft)",
                        }}
                      >
                        <span
                          className="tt-status-dot"
                          style={{ background: "var(--ok)" }}
                        />
                        On clock
                      </span>
                    ) : (
                      <span
                        className="tt-status-pill"
                        style={{
                          color: "var(--text-tertiary)",
                          background: "var(--surface-2)",
                        }}
                      >
                        <span
                          className="tt-status-dot"
                          style={{ background: "var(--text-tertiary)" }}
                        />
                        Off
                      </span>
                    )}
                  </div>
                </div>
                {projectsActive.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {projectsActive.map((pn) => (
                      <ProjectChip key={pn} name={pn} size="sm" />
                    ))}
                  </div>
                )}
                <div className="tt-team-card-stat-row">
                  <div>
                    <div className="tt-team-card-hours">{minsToHM(data.total)}</div>
                    <div className="tt-team-card-hours-sub">
                      {data.entries.length} entries this week
                    </div>
                  </div>
                  <div className="tt-team-card-pills">
                    {data.submitted > 0 && (
                      <span
                        className="tt-team-card-pill"
                        style={{
                          background: "var(--info-soft)",
                          color: "var(--info)",
                        }}
                      >
                        {data.submitted} pending
                      </span>
                    )}
                    {data.rejected > 0 && (
                      <span
                        className="tt-team-card-pill"
                        style={{
                          background: "var(--er-soft)",
                          color: "var(--er)",
                        }}
                      >
                        {data.rejected} rejected
                      </span>
                    )}
                    {data.approved > 0 &&
                      data.rejected === 0 &&
                      data.submitted === 0 && (
                        <span
                          className="tt-team-card-pill"
                          style={{
                            background: "var(--ok-soft)",
                            color: "var(--ok)",
                          }}
                        >
                          all set
                        </span>
                      )}
                    {data.amended > 0 && (
                      <span
                        className="tt-team-card-pill"
                        style={{
                          background: "var(--wr-soft)",
                          color: "var(--wr)",
                        }}
                      >
                        {data.amended} amended
                      </span>
                    )}
                    {data.draft > 0 && data.submitted === 0 && (
                      <span
                        className="tt-team-card-pill"
                        style={{
                          background: "var(--surface-2)",
                          color: "var(--text-tertiary)",
                        }}
                      >
                        {data.draft} draft
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Approvals pane
// ─────────────────────────────────────────────────────────────────────────

function ApprovalsPane(props: {
  team: AdminTeamView;
  entries: TimeEntryRow[];
  onAmend: (e: TimeEntryRow) => void;
  onApprove: (id: string) => void;
  onReject: (e: TimeEntryRow) => void;
  onApproveAll: () => Promise<void> | void;
  pending: boolean;
}) {
  return (
    <>
      <div className="tt-page-hdr">
        <div>
          <h1 className="tt-page-title">Pending approvals</h1>
          <div className="tt-page-sub">
            Review submitted entries. Approve, reject, or amend with audit
            trail.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="tt-btn ok"
            onClick={() => props.onApproveAll()}
            disabled={props.pending || props.entries.length === 0}
          >
            {TtIcons.check} Approve all ({props.entries.length})
          </button>
        </div>
      </div>
      {props.entries.length === 0 ? (
        <div className="tt-card">
          <div className="tt-empty">
            <div className="tt-empty-icon">{TtIcons.check}</div>
            <div className="tt-empty-title">All caught up</div>
            <div>No entries waiting on approval right now.</div>
          </div>
        </div>
      ) : (
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th style={{ width: 200 }}>Worker</th>
                <th style={{ width: 76 }}>Date</th>
                <th style={{ width: 86 }}>Start</th>
                <th style={{ width: 86 }}>End</th>
                <th style={{ width: 96 }}>Duration</th>
                <th>Project / Task</th>
                <th style={{ width: 170 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[...props.entries]
                .sort((a, b) => (a.isoDate < b.isoDate ? -1 : 1))
                .map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                        }}
                      >
                        <WorkerAvatar
                          initials={initialsOf(e.userName)}
                          size="sm"
                        />
                        <div>
                          <div
                            style={{
                              fontFamily: "'DM Sans',sans-serif",
                              fontWeight: 660,
                              fontSize: 13,
                            }}
                          >
                            {e.userName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: "'DM Sans',sans-serif",
                          fontWeight: 620,
                          fontSize: 12,
                        }}
                      >
                        {props.team.weekDays.find((d) => d.iso === e.isoDate)?.label ?? ""}
                      </span>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: "var(--text-tertiary)",
                          fontFamily: "'JetBrains Mono',monospace",
                        }}
                      >
                        {e.isoDate.slice(5)}
                      </div>
                    </td>
                    <td>
                      <span className="tt-table-time">
                        {fmt12(new Date(e.clockInAt))}
                      </span>
                    </td>
                    <td>
                      <span className="tt-table-time">
                        {e.clockOutAt ? fmt12(new Date(e.clockOutAt)) : "—"}
                      </span>
                    </td>
                    <td>
                      <span className="tt-table-dur">{minsToHM(e.minutes)}</span>
                    </td>
                    <td>
                      <ProjectChip name={e.projectName} size="sm" />
                      <div className="tt-table-task" style={{ marginTop: 4 }}>
                        {e.taskLabel ?? "—"}
                      </div>
                    </td>
                    <td>
                      <div className="tt-table-actions">
                        <button
                          className="tt-icon-action"
                          title="Amend (with audit)"
                          onClick={() => props.onAmend(e)}
                        >
                          {TtIcons.edit}
                        </button>
                        <button
                          className="tt-icon-action danger"
                          title="Reject"
                          onClick={() => props.onReject(e)}
                          disabled={props.pending}
                        >
                          {TtIcons.x}
                        </button>
                        <button
                          className="tt-icon-action ok"
                          title="Approve"
                          onClick={() => props.onApprove(e.id)}
                          disabled={props.pending}
                          style={{
                            background: "var(--ok-soft)",
                            color: "var(--ok)",
                          }}
                        >
                          {TtIcons.check}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Worker detail pane
// ─────────────────────────────────────────────────────────────────────────

function WorkerDetailPane(props: {
  detail: AdminWorkerDetailView;
  onAmend: (e: TimeEntryRow) => void;
  onApprove: (id: string) => void;
  onReject: (e: TimeEntryRow) => void;
  onBack: () => void;
  pending: boolean;
}) {
  const { detail } = props;
  const total = detail.entries.reduce(
    (a, e) =>
      a + (e.status === "running" ? e.liveMinutes ?? 0 : e.minutes ?? 0),
    0,
  );

  return (
    <>
      <div className="tt-page-hdr">
        <div>
          <button
            className="tt-btn ghost"
            onClick={props.onBack}
            style={{ marginBottom: 8 }}
          >
            {TtIcons.back} Back to team
          </button>
          <div className="tt-detail-hdr">
            <WorkerAvatar initials={detail.worker.initials} size="lg" />
            <div>
              <h1 className="tt-page-title" style={{ marginBottom: 0 }}>
                {detail.worker.name}
              </h1>
              <div className="tt-page-sub">
                {detail.worker.isAdmin ? "Admin" : "Worker"} · {detail.org.name} ·{" "}
                {detail.entries.length} entries this week
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="tt-detail">
        <div>
          <div className="tt-card" style={{ marginBottom: 18 }}>
            <div className="tt-card-hdr">
              <div>
                <div className="tt-card-title">Week summary</div>
                <div className="tt-card-sub">
                  {detail.weekDays[0].display}–{detail.weekDays[6].display}
                </div>
              </div>
              <div className="tt-week-totals" style={{ paddingRight: 0 }}>
                <div>
                  <div className="tt-week-total-key">Total</div>
                  <div className="tt-week-total-val">{minsToHM(total)}</div>
                </div>
                <div>
                  <div className="tt-week-total-key">Decimal</div>
                  <div className="tt-week-total-val">{minsToDecimal(total)}h</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.weekDays.map((d) => {
                const dayEntries = detail.entries.filter((e) => e.isoDate === d.iso);
                const dayTotal = dayEntries.reduce(
                  (a, e) =>
                    a +
                    (e.status === "running"
                      ? e.liveMinutes ?? 0
                      : e.minutes ?? 0),
                  0,
                );
                return (
                  <div
                    key={d.iso}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        width: 80,
                        fontFamily: "'DM Sans',sans-serif",
                        fontWeight: 660,
                        fontSize: 12.5,
                      }}
                    >
                      {d.label} {d.display.split(" ")[1]}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 22,
                        background: "var(--surface-2)",
                        borderRadius: 5,
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (dayTotal / 600) * 100)}%`,
                          height: "100%",
                          background:
                            dayTotal === 0
                              ? "transparent"
                              : dayEntries.some((e) => e.status === "rejected")
                                ? "var(--er)"
                                : dayEntries.some((e) => e.status === "submitted")
                                  ? "var(--info)"
                                  : dayEntries.some((e) => e.status === "approved")
                                    ? "var(--ok)"
                                    : dayEntries.some((e) => e.status === "amended")
                                      ? "var(--wr)"
                                      : "var(--accent)",
                          borderRadius: 5,
                          transition: "width .4s",
                        }}
                      />
                      {dayTotal > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            right: 9,
                            top: "50%",
                            transform: "translateY(-50%)",
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: 11,
                            fontWeight: 660,
                          }}
                        >
                          {minsToHMSlim(dayTotal)}
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        width: 64,
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        textAlign: "right",
                      }}
                    >
                      {dayEntries.length}{" "}
                      {dayEntries.length === 1 ? "entry" : "entries"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="tt-table-wrap">
            <table className="tt-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Date</th>
                  <th style={{ width: 86 }}>Start</th>
                  <th style={{ width: 86 }}>End</th>
                  <th style={{ width: 96 }}>Duration</th>
                  <th>Project / Task</th>
                  <th style={{ width: 110 }}>Status</th>
                  <th style={{ width: 130 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {detail.entries.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="tt-empty" style={{ padding: 28 }}>
                        <div className="tt-empty-title">No entries this week</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  detail.entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <span
                          style={{
                            fontFamily: "'DM Sans',sans-serif",
                            fontWeight: 620,
                            fontSize: 12,
                          }}
                        >
                          {detail.weekDays.find((d) => d.iso === e.isoDate)?.label ?? ""}
                        </span>
                        <div
                          style={{
                            fontSize: 10.5,
                            color: "var(--text-tertiary)",
                            fontFamily: "'JetBrains Mono',monospace",
                          }}
                        >
                          {e.isoDate.slice(5)}
                        </div>
                      </td>
                      <td>
                        <span className="tt-table-time">
                          {fmt12(new Date(e.clockInAt))}
                        </span>
                      </td>
                      <td>
                        <span className="tt-table-time">
                          {e.clockOutAt ? fmt12(new Date(e.clockOutAt)) : "—"}
                        </span>
                      </td>
                      <td>
                        <span className="tt-table-dur">{minsToHM(e.minutes)}</span>
                      </td>
                      <td>
                        <ProjectChip name={e.projectName} size="sm" />
                        <div className="tt-table-task" style={{ marginTop: 4 }}>
                          {e.taskLabel ?? "—"}
                        </div>
                        {e.notes && (
                          <div
                            style={{
                              fontSize: 11.5,
                              color: "var(--text-tertiary)",
                              marginTop: 3,
                              fontStyle: "italic",
                            }}
                          >
                            {e.notes}
                          </div>
                        )}
                      </td>
                      <td>
                        <StatusPill status={e.status} />
                      </td>
                      <td>
                        <div className="tt-table-actions">
                          <button
                            className="tt-icon-action"
                            title="Amend"
                            onClick={() => props.onAmend(e)}
                            disabled={e.status === "running"}
                          >
                            {TtIcons.edit}
                          </button>
                          {e.status === "submitted" && (
                            <>
                              <button
                                className="tt-icon-action danger"
                                title="Reject"
                                onClick={() => props.onReject(e)}
                                disabled={props.pending}
                              >
                                {TtIcons.x}
                              </button>
                              <button
                                className="tt-icon-action ok"
                                title="Approve"
                                onClick={() => props.onApprove(e.id)}
                                disabled={props.pending}
                                style={{
                                  background: "var(--ok-soft)",
                                  color: "var(--ok)",
                                }}
                              >
                                {TtIcons.check}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="tt-detail-rail">
          <div className="tt-rail-card">
            <h4>{TtIcons.user} Worker info</h4>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 12.5,
              }}
            >
              <RailRow
                label="Role"
                value={detail.worker.isAdmin ? "Admin" : "Worker"}
              />
              <RailRow label="Org" value={detail.org.name} />
              <RailRow
                label="Active projects"
                value={String(
                  [...new Set(detail.entries.map((e) => e.projectId))].length,
                )}
              />
            </div>
          </div>

          <div className="tt-rail-card">
            <h4>{TtIcons.history} Recent activity</h4>
            <div className="tt-audit-list">
              {detail.amendments.length === 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    textAlign: "center",
                    padding: 14,
                  }}
                >
                  No admin actions yet.
                </div>
              )}
              {detail.amendments.map((a) => (
                <div
                  key={a.id}
                  className={`tt-audit-item ${a.action}`}
                  style={{ padding: "8px 10px" }}
                >
                  <div
                    className="tt-audit-icon"
                    style={{ width: 22, height: 22 }}
                  >
                    {a.action === "amended"
                      ? TtIcons.edit
                      : a.action === "rejected"
                        ? TtIcons.x
                        : a.action === "approved"
                          ? TtIcons.check
                          : TtIcons.send}
                  </div>
                  <div className="tt-audit-body" style={{ fontSize: 11.5 }}>
                    <div>
                      <span className="tt-audit-actor">{a.actorName}</span>
                      <span className="tt-audit-action"> {a.action}</span>
                      <span className="tt-audit-when">
                        {a.createdAt
                          ? new Date(a.createdAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                    {a.reason && (
                      <div
                        className="tt-audit-reason"
                        style={{ fontSize: 11.5 }}
                      >
                        &ldquo;{a.reason}&rdquo;
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Modals (admin)
// ─────────────────────────────────────────────────────────────────────────

function AmendModal(props: {
  entry: TimeEntryRow;
  onCancel: () => void;
  onConfirm: (input: {
    clockInAt: string;
    clockOutAt: string;
    reason: string;
  }) => void;
  pending: boolean;
}) {
  const e = props.entry;
  const [start, setStart] = useState(toTimeInput(new Date(e.clockInAt)));
  const [end, setEnd] = useState(
    e.clockOutAt ? toTimeInput(new Date(e.clockOutAt)) : "16:00",
  );
  const [reason, setReason] = useState("");
  const date = e.isoDate;

  return (
    <div className="tt-modal-bg" onClick={props.onCancel}>
      <div className="tt-modal" onClick={(ev) => ev.stopPropagation()}>
        <h3>Amend entry</h3>
        <div className="tt-modal-sub">
          Editing this entry creates an audit record. The worker will be
          notified.
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 9,
            marginBottom: 14,
          }}
        >
          <WorkerAvatar initials={initialsOf(e.userName)} size="sm" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 660,
                fontSize: 13,
              }}
            >
              {e.userName}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>
              {e.isoDate}
            </div>
          </div>
          <StatusPill status={e.status} />
        </div>
        <div className="tt-modal-fields">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <div>
              <label className="tt-input-label">Start</label>
              <input
                className="tt-input"
                type="time"
                value={start}
                onChange={(ev) => setStart(ev.target.value)}
              />
            </div>
            <div>
              <label className="tt-input-label">End</label>
              <input
                className="tt-input"
                type="time"
                value={end}
                onChange={(ev) => setEnd(ev.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="tt-input-label">
              Reason for amendment{" "}
              <span style={{ color: "var(--er)", textTransform: "none" }}>
                (required)
              </span>
            </label>
            <textarea
              className="tt-textarea"
              placeholder="e.g., 'Worker forgot to clock out, corrected per text confirmation.'"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
            />
          </div>
        </div>
        <div className="tt-modal-foot">
          <button className="tt-btn ghost" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            className="tt-btn primary lg"
            disabled={props.pending || !reason.trim()}
            onClick={() =>
              props.onConfirm({
                clockInAt: new Date(`${date}T${start}:00`).toISOString(),
                clockOutAt: new Date(`${date}T${end}:00`).toISOString(),
                reason,
              })
            }
          >
            {TtIcons.edit} Save amendment
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal(props: {
  entry: TimeEntryRow;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  pending: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="tt-modal-bg" onClick={props.onCancel}>
      <div className="tt-modal" onClick={(ev) => ev.stopPropagation()}>
        <h3>Reject entry</h3>
        <div className="tt-modal-sub">
          Tell the worker what to fix. They&apos;ll get a notification and the
          entry flips back to draft for them.
        </div>
        <div className="tt-modal-fields">
          <div>
            <label className="tt-input-label">
              Reason{" "}
              <span style={{ color: "var(--er)", textTransform: "none" }}>
                (required)
              </span>
            </label>
            <textarea
              className="tt-textarea"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              placeholder="e.g., '14.5h shift exceeds policy. Revise and resubmit with break detail.'"
            />
          </div>
        </div>
        <div className="tt-modal-foot">
          <button className="tt-btn ghost" onClick={props.onCancel}>
            Cancel
          </button>
          <button
            className="tt-btn danger lg"
            disabled={props.pending || !reason.trim()}
            onClick={() => props.onConfirm(reason)}
          >
            {TtIcons.x} Reject entry
          </button>
        </div>
      </div>
    </div>
  );
}

function RailRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        paddingBottom: 7,
        borderBottom: "1px dashed var(--border)",
      }}
    >
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 620 }}>
        {value}
      </span>
    </div>
  );
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 2).toUpperCase();
  return (parts[0][0]! + parts[parts.length - 1][0]!).toUpperCase();
}

function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
