"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  AttendeeScope,
  MeetingActivityRow,
  MeetingDetail,
  MeetingType,
} from "@/domain/loaders/meetings";

import {
  ATTENDEE_SCOPE_LABEL,
  Icon,
  MeetingTypePill,
  StatusPill,
  formatDateShort,
  formatScheduledFull,
  initials,
} from "../../../../../meetings-shared";
import { ActivityRail } from "../../../../../meetings-rail";

type Person = {
  userId: string;
  userName: string | null;
  userEmail: string;
  orgId: string;
  orgName: string;
  scope: AttendeeScope;
};

type Tab = "agenda" | "attendees" | "minutes" | "actions";

// Local editable view of agenda items — mirrors the server shape plus
// a stable client key for un-persisted rows.
type AgendaRow = {
  key: string;
  id: string | null;
  title: string;
  description: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  estimatedMinutes: number;
  carriedFromLabel: string | null;
};

export function MeetingDetailUI({
  projectId,
  meetingId,
  detail,
  people,
  activity,
  viewerRole,
}: {
  projectId: string;
  meetingId: string;
  detail: MeetingDetail;
  people: Person[];
  activity: MeetingActivityRow[];
  viewerRole: "contractor" | "subcontractor";
}) {
  const router = useRouter();
  const portalBase = `/${viewerRole}/project/${projectId}`;
  const [tab, setTab] = useState<Tab>("agenda");

  const [agenda, setAgenda] = useState<AgendaRow[]>(() =>
    detail.agenda.map((a) => ({
      key: a.id,
      id: a.id,
      title: a.title,
      description: a.description,
      assignedUserId: a.assignedUserId,
      assignedUserName: a.assignedUserName,
      estimatedMinutes: a.estimatedMinutes,
      carriedFromLabel: a.carriedFromLabel,
    })),
  );
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [agendaDirty, setAgendaDirty] = useState(false);

  const [minutesDraft, setMinutesDraft] = useState(
    detail.minutes?.content ?? "",
  );
  const minutesFinalized = !!detail.minutes?.finalizedAt;
  const [minutesSaving, setMinutesSaving] = useState(false);
  const [minutesDirty, setMinutesDirty] = useState(false);

  const [newAction, setNewAction] = useState({
    description: "",
    assignedUserId: "",
    dueDate: "",
    originAgendaItemId: "",
  });
  const [addingAction, setAddingAction] = useState(false);
  const [showAddAction, setShowAddAction] = useState(false);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [invitingAttendee, setInvitingAttendee] = useState(false);

  const totalEstimated = useMemo(
    () => agenda.reduce((s, a) => s + a.estimatedMinutes, 0),
    [agenda],
  );
  const overBudget = totalEstimated > detail.durationMinutes;

  const acceptedCount = detail.attendees.filter(
    (a) => a.attendedStatus === "accepted",
  ).length;
  const declinedCount = detail.attendees.filter(
    (a) => a.attendedStatus === "declined",
  ).length;
  const pendingCount = detail.attendees.filter(
    (a) =>
      a.attendedStatus === "tentative" || a.attendedStatus === "invited",
  ).length;

  const openActions = detail.actionItems.filter(
    (a) => a.status === "open",
  ).length;
  const inProgressActions = detail.actionItems.filter(
    (a) => a.status === "in_progress",
  ).length;
  const doneActions = detail.actionItems.filter(
    (a) => a.status === "done",
  ).length;

  const scheduledFull = formatScheduledFull(detail.scheduledAt);
  const canEdit = detail.canEdit && viewerRole === "contractor";

  // Attendees on the meeting, for the action-item assignee select.
  const attendeePeople = useMemo(() => {
    const ids = new Set(
      detail.attendees
        .map((a) => a.userId)
        .filter((v): v is string => !!v),
    );
    return people.filter((p) => ids.has(p.userId));
  }, [detail.attendees, people]);

  // Candidates to invite: project members not already on the attendee list.
  const invitableCandidates = useMemo(() => {
    const ids = new Set(
      detail.attendees
        .map((a) => a.userId)
        .filter((v): v is string => !!v),
    );
    return people.filter((p) => !ids.has(p.userId));
  }, [detail.attendees, people]);

  const transitionMeeting = async (
    action: "start" | "complete" | "cancel",
  ) => {
    const reason =
      action === "cancel"
        ? window.prompt("Reason for cancelling this meeting?")
        : null;
    if (action === "cancel" && reason === null) return;
    const res = await fetch(`/api/meetings/${meetingId}/transition`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(body.message ?? body.error ?? "Transition failed");
      return;
    }
    router.refresh();
  };

  const saveAgenda = async () => {
    setSavingAgenda(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/agenda`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: agenda.map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
            assignedUserId: a.assignedUserId,
            estimatedMinutes: a.estimatedMinutes,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.message ?? body.error ?? "Save failed");
        return;
      }
      setAgendaDirty(false);
      router.refresh();
    } finally {
      setSavingAgenda(false);
    }
  };

  const addAgenda = () => {
    setAgenda((items) => [
      ...items,
      {
        key: `new-${Date.now()}`,
        id: null,
        title: "New agenda item",
        description: null,
        assignedUserId: null,
        assignedUserName: null,
        estimatedMinutes: 5,
        carriedFromLabel: null,
      },
    ]);
    setAgendaDirty(true);
  };

  const removeAgenda = (key: string) => {
    setAgenda((items) => items.filter((a) => a.key !== key));
    setAgendaDirty(true);
  };

  const moveAgenda = (key: string, direction: "up" | "down") => {
    setAgenda((items) => {
      const idx = items.findIndex((a) => a.key === key);
      if (idx < 0) return items;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= items.length) return items;
      const next = [...items];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
    setAgendaDirty(true);
  };

  const updateAgenda = (key: string, patch: Partial<AgendaRow>) => {
    setAgenda((items) =>
      items.map((a) => (a.key === key ? { ...a, ...patch } : a)),
    );
    setAgendaDirty(true);
  };

  const saveMinutes = async () => {
    setMinutesSaving(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/minutes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: minutesDraft }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.message ?? body.error ?? "Save failed");
        return;
      }
      setMinutesDirty(false);
      router.refresh();
    } finally {
      setMinutesSaving(false);
    }
  };

  const finalizeMinutes = async () => {
    if (minutesDirty) {
      if (!window.confirm("Save draft before finalizing?")) return;
      await saveMinutes();
    }
    if (
      !window.confirm(
        "Finalize and publish these minutes? Attendees will be notified and the minutes can no longer be edited.",
      )
    ) {
      return;
    }
    const res = await fetch(`/api/meetings/${meetingId}/minutes/finalize`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(body.message ?? body.error ?? "Finalize failed");
      return;
    }
    router.refresh();
  };

  const createAction = async () => {
    if (!newAction.description.trim()) return;
    setAddingAction(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newAction.description.trim(),
          assignedUserId: newAction.assignedUserId || null,
          dueDate: newAction.dueDate || null,
          originAgendaItemId: newAction.originAgendaItemId || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.message ?? body.error ?? "Failed to add action");
        return;
      }
      setNewAction({
        description: "",
        assignedUserId: "",
        dueDate: "",
        originAgendaItemId: "",
      });
      setShowAddAction(false);
      router.refresh();
    } finally {
      setAddingAction(false);
    }
  };

  const updateActionStatus = async (
    itemId: string,
    status: "open" | "in_progress" | "done",
  ) => {
    const res = await fetch(
      `/api/meetings/${meetingId}/action-items/${itemId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(body.message ?? body.error ?? "Update failed");
      return;
    }
    router.refresh();
  };

  const deleteAction = async (itemId: string) => {
    if (!window.confirm("Delete this action item?")) return;
    const res = await fetch(
      `/api/meetings/${meetingId}/action-items/${itemId}`,
      { method: "DELETE" },
    );
    if (!res.ok) return;
    router.refresh();
  };

  const inviteAttendee = async () => {
    if (!inviteUserId) return;
    const candidate = invitableCandidates.find(
      (p) => p.userId === inviteUserId,
    );
    if (!candidate) return;
    setInvitingAttendee(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/attendees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: candidate.userId,
          orgId: candidate.orgId,
          roleLabel: inviteRole.trim() || null,
          scope: candidate.scope,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        window.alert(body.message ?? body.error ?? "Invite failed");
        return;
      }
      setShowInvite(false);
      setInviteUserId("");
      setInviteRole("");
      router.refresh();
    } finally {
      setInvitingAttendee(false);
    }
  };

  return (
    <>
      <div className="mt-page-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href={`${portalBase}/meetings`} className="mt-btn sm ghost">
            {Icon.back} Back
          </Link>
          <div
            className="mt-crumbs"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "var(--text-tertiary)",
            }}
          >
            <span>Meetings</span>
            {Icon.chevR}
            <strong
              style={{
                color: "var(--text-primary)",
                fontFamily: '"JetBrains Mono", monospace',
                fontWeight: 600,
              }}
            >
              {detail.numberLabel}
            </strong>
          </div>
        </div>
        <div className="mt-page-actions">
          {viewerRole === "contractor" ? (
            <>
              <button
                type="button"
                className="mt-btn sm"
                onClick={() =>
                  window.alert(
                    "Duplicate is a Phase 4+ follow-up — reschedule via the Create modal for now.",
                  )
                }
                title="Duplicate — coming soon"
              >
                {Icon.copy} Duplicate
              </button>
              <button
                type="button"
                className="mt-btn sm"
                onClick={() =>
                  window.alert(
                    "Reminder emails send on meeting creation and 24h before start.",
                  )
                }
              >
                {Icon.mail} Send reminder
              </button>
              <button
                type="button"
                className="mt-btn sm ghost icon"
                title="More"
                aria-label="More"
              >
                {Icon.more}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-detail">
        <div className="mt-detail-main">
          <section className="mt-detail-hero">
            <div className="mt-detail-hero-top">
              <div className="mt-detail-hero-left" style={{ flex: 1 }}>
                <h2>{detail.title}</h2>
                <div className="mt-detail-hero-meta">
                  <MeetingTypePill type={detail.type as MeetingType} />
                  <StatusPill status={detail.status} />
                  <span>·</span>
                  <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                    {Icon.calendar} <strong>{scheduledFull}</strong>
                  </span>
                  <span>·</span>
                  <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                    {Icon.clock} {detail.durationMinutes} min
                  </span>
                  <span>·</span>
                  <span>
                    Chaired by <strong>{detail.chairName ?? "—"}</strong>
                  </span>
                </div>
              </div>
              <div className="mt-detail-hero-actions">
                {viewerRole === "contractor" ? (
                  <>
                    {detail.status === "scheduled" ? (
                      <button
                        type="button"
                        className="mt-btn primary sm"
                        onClick={() => transitionMeeting("start")}
                      >
                        {Icon.play} Start meeting
                      </button>
                    ) : null}
                    {detail.status === "in_progress" ? (
                      <button
                        type="button"
                        className="mt-btn primary sm"
                        onClick={() => transitionMeeting("complete")}
                      >
                        {Icon.check} Complete
                      </button>
                    ) : null}
                    {detail.status === "completed" ? (
                      <button
                        type="button"
                        className="mt-btn sm"
                        onClick={() => router.push(`${portalBase}/meetings`)}
                        title="Back to workspace to schedule the next meeting"
                      >
                        {Icon.copy} Schedule next
                      </button>
                    ) : null}
                    {detail.status === "scheduled" ||
                    detail.status === "in_progress" ? (
                      <button
                        type="button"
                        className="mt-btn sm danger"
                        onClick={() => transitionMeeting("cancel")}
                      >
                        Cancel
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-detail-summary">
              <div className="mt-summary-item">
                <div className="mt-summary-label">Agenda items</div>
                <div className="mt-summary-val">{agenda.length}</div>
                <div className="mt-summary-sub">
                  {totalEstimated} min estimated ·{" "}
                  {overBudget ? (
                    <span style={{ color: "var(--wr)" }}>over budget</span>
                  ) : (
                    "within budget"
                  )}
                </div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">Attendees</div>
                <div className="mt-summary-val">{detail.attendees.length}</div>
                <div className="mt-summary-sub">
                  {acceptedCount} accepted · {declinedCount} declined ·{" "}
                  {pendingCount} pending
                </div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">Action items</div>
                <div className="mt-summary-val">
                  {detail.actionItems.length}
                </div>
                <div className="mt-summary-sub">
                  <span style={{ color: "var(--na)" }}>{openActions} open</span>{" "}
                  ·{" "}
                  <span style={{ color: "var(--wr)" }}>
                    {inProgressActions} active
                  </span>{" "}
                  ·{" "}
                  <span style={{ color: "var(--ok)" }}>
                    {doneActions} done
                  </span>
                </div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">Carry-forward</div>
                <div
                  className="mt-summary-val"
                  style={{
                    color:
                      detail.carriedForwardCount > 0
                        ? "var(--wr)"
                        : undefined,
                  }}
                >
                  {detail.carriedForwardCount}
                </div>
                <div className="mt-summary-sub">
                  {detail.carriedForwardCount > 0
                    ? `from prior ${detail.type}`
                    : "none"}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-detail-tabs">
            <div className="mt-detail-tab-bar">
              {(
                [
                  ["agenda", "Agenda", detail.agenda.length, Icon.list],
                  [
                    "attendees",
                    "Attendees",
                    detail.attendees.length,
                    Icon.users,
                  ],
                  ["minutes", "Minutes", null, Icon.edit],
                  [
                    "actions",
                    "Action items",
                    detail.actionItems.length,
                    Icon.clipboard,
                  ],
                ] as Array<[Tab, string, number | null, React.ReactNode]>
              ).map(([k, label, count, icon]) => (
                <button
                  key={k}
                  type="button"
                  className={`mt-detail-tab${tab === k ? " active" : ""}`}
                  onClick={() => setTab(k)}
                >
                  {icon} {label}
                  {count !== null ? (
                    <span className="mt-detail-tab-count">{count}</span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="mt-detail-tab-body">
              {tab === "agenda" ? (
                <AgendaTab
                  agenda={agenda}
                  canEdit={canEdit}
                  dirty={agendaDirty}
                  saving={savingAgenda}
                  totalEstimated={totalEstimated}
                  plannedMinutes={detail.durationMinutes}
                  overBudget={overBudget}
                  people={people}
                  onSave={saveAgenda}
                  onAdd={addAgenda}
                  onRemove={removeAgenda}
                  onMove={moveAgenda}
                  onUpdate={updateAgenda}
                />
              ) : null}

              {tab === "attendees" ? (
                <AttendeesTab
                  detail={detail}
                  canEdit={canEdit}
                  invitableCount={invitableCandidates.length}
                  onInviteClick={() => setShowInvite(true)}
                />
              ) : null}

              {tab === "minutes" ? (
                <MinutesTab
                  value={minutesDraft}
                  onChange={(v) => {
                    setMinutesDraft(v);
                    setMinutesDirty(true);
                  }}
                  canEdit={canEdit && !minutesFinalized}
                  canFinalize={detail.canFinalize}
                  finalizedAt={detail.minutes?.finalizedAt ?? null}
                  draftedByName={detail.minutes?.draftedByName ?? null}
                  updatedAt={detail.minutes?.updatedAt ?? null}
                  saving={minutesSaving}
                  dirty={minutesDirty}
                  onSave={saveMinutes}
                  onFinalize={finalizeMinutes}
                />
              ) : null}

              {tab === "actions" ? (
                <ActionsTab
                  actionItems={detail.actionItems}
                  agenda={detail.agenda}
                  people={attendeePeople.length > 0 ? attendeePeople : people}
                  canEdit={canEdit}
                  newAction={newAction}
                  setNewAction={setNewAction}
                  onAdd={createAction}
                  adding={addingAction}
                  onStatus={updateActionStatus}
                  onDelete={deleteAction}
                  showAddForm={showAddAction}
                  onToggleAddForm={() => setShowAddAction((v) => !v)}
                />
              ) : null}
            </div>
          </section>
        </div>

        <aside className="mt-rail">
          <ActivityRail rows={activity} portalBase={portalBase} limit={5} />

          {detail.status === "cancelled" && detail.cancelledReason ? (
            <div className="mt-rail-card" style={{ padding: 14 }}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                {Icon.info}
                <div>
                  <div
                    style={{
                      fontFamily: '"DM Sans", sans-serif',
                      fontWeight: 700,
                      fontSize: 12.5,
                      color: "var(--er)",
                    }}
                  >
                    Cancelled
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      fontWeight: 540,
                      marginTop: 3,
                    }}
                  >
                    {detail.cancelledReason}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </aside>
      </div>

      {showInvite ? (
        <InviteAttendeeModal
          candidates={invitableCandidates}
          selectedUserId={inviteUserId}
          onSelect={setInviteUserId}
          roleLabel={inviteRole}
          onRoleChange={setInviteRole}
          submitting={invitingAttendee}
          onClose={() => {
            setShowInvite(false);
            setInviteUserId("");
            setInviteRole("");
          }}
          onSubmit={inviteAttendee}
        />
      ) : null}
    </>
  );
}

// ── Agenda tab ──
function AgendaTab({
  agenda,
  canEdit,
  dirty,
  saving,
  totalEstimated,
  plannedMinutes,
  overBudget,
  people,
  onSave,
  onAdd,
  onRemove,
  onMove,
  onUpdate,
}: {
  agenda: AgendaRow[];
  canEdit: boolean;
  dirty: boolean;
  saving: boolean;
  totalEstimated: number;
  plannedMinutes: number;
  overBudget: boolean;
  people: Person[];
  onSave: () => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
  onMove: (key: string, direction: "up" | "down") => void;
  onUpdate: (key: string, patch: Partial<AgendaRow>) => void;
}) {
  return (
    <div>
      <div className="mt-detail-tab-hdr">
        <h3>Agenda</h3>
        <div style={{ display: "flex", gap: 6 }}>
          {canEdit ? (
            <button
              type="button"
              className="mt-btn xs ghost"
              onClick={() =>
                window.alert(
                  "Carry-forward from the last same-type meeting runs on creation. Use the Create Meeting modal — it previews what will carry.",
                )
              }
            >
              {Icon.copy} Copy from prior
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="mt-btn xs primary"
              onClick={onSave}
              disabled={!dirty || saving}
            >
              {saving ? "Saving…" : dirty ? "Save agenda" : "Saved"}
            </button>
          ) : null}
        </div>
      </div>

      {agenda.length === 0 ? (
        <div className="mt-empty">
          <h3>No agenda yet</h3>
          <p>
            Add items so attendees know what to expect. Carry-forward from
            prior same-type meetings shows up automatically on creation.
          </p>
        </div>
      ) : (
        <div className="mt-agenda-list">
          {agenda.map((a, idx) => (
            <div
              key={a.key}
              className={`mt-agenda-row${a.carriedFromLabel ? " carry" : ""}`}
            >
              {canEdit ? (
                <div className="mt-agenda-grip" title="Drag to reorder">
                  {Icon.grip}
                </div>
              ) : null}
              <div className="mt-agenda-num">{idx + 1}.</div>
              <div className="mt-agenda-body">
                <div className="mt-agenda-title-row">
                  {canEdit ? (
                    <input
                      type="text"
                      value={a.title}
                      maxLength={200}
                      onChange={(e) =>
                        onUpdate(a.key, { title: e.target.value })
                      }
                      style={{
                        flex: 1,
                        fontFamily: '"DM Sans", sans-serif',
                        fontWeight: 650,
                        fontSize: 13.5,
                        border: "1px solid transparent",
                        background: "transparent",
                        color: "inherit",
                        padding: "2px 4px",
                        outline: "none",
                        borderRadius: 4,
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.background = "var(--surface-1)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "transparent";
                        e.currentTarget.style.background = "transparent";
                      }}
                    />
                  ) : (
                    <span className="mt-agenda-title">{a.title}</span>
                  )}
                  {a.carriedFromLabel ? (
                    <span className="mt-carry-pill">
                      {Icon.arrowR} Carried forward
                    </span>
                  ) : null}
                </div>
                {canEdit ? (
                  <textarea
                    value={a.description ?? ""}
                    placeholder="Description (optional)"
                    maxLength={4000}
                    onChange={(e) =>
                      onUpdate(a.key, { description: e.target.value })
                    }
                    rows={2}
                    style={{
                      width: "100%",
                      fontFamily: "inherit",
                      fontSize: 12,
                      border: "1px solid transparent",
                      background: "transparent",
                      color: "var(--text-secondary)",
                      padding: "2px 4px",
                      outline: "none",
                      borderRadius: 4,
                      resize: "vertical",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.background = "var(--surface-1)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "transparent";
                      e.currentTarget.style.background = "transparent";
                    }}
                  />
                ) : a.description ? (
                  <div className="mt-agenda-desc">{a.description}</div>
                ) : null}
                <div className="mt-agenda-meta">
                  <span className="mt-agenda-meta-item">
                    {Icon.user}
                    {canEdit ? (
                      <select
                        value={a.assignedUserId ?? ""}
                        onChange={(e) => {
                          const uid = e.target.value || null;
                          const p = people.find((pp) => pp.userId === uid);
                          onUpdate(a.key, {
                            assignedUserId: uid,
                            assignedUserName: p?.userName ?? null,
                          });
                        }}
                        style={{
                          fontFamily: "inherit",
                          fontSize: 11,
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          padding: "2px 4px",
                          background: "var(--surface-1)",
                          color: "inherit",
                        }}
                      >
                        <option value="">— Presenter</option>
                        {people.map((p) => (
                          <option key={p.userId} value={p.userId}>
                            {p.userName ?? p.userEmail} · {p.orgName}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="mt-agenda-presenter">
                        {a.assignedUserName ?? "—"}
                      </span>
                    )}
                  </span>
                  <span className="mt-agenda-meta-item">
                    {Icon.clock}
                    {canEdit ? (
                      <input
                        type="number"
                        min={0}
                        max={600}
                        value={a.estimatedMinutes}
                        onChange={(e) =>
                          onUpdate(a.key, {
                            estimatedMinutes: Math.max(
                              0,
                              Math.min(600, Number(e.target.value) || 0),
                            ),
                          })
                        }
                        style={{
                          width: 52,
                          fontFamily: "inherit",
                          fontSize: 11,
                          border: "1px solid var(--border)",
                          borderRadius: 4,
                          padding: "2px 4px",
                          background: "var(--surface-1)",
                          color: "inherit",
                        }}
                      />
                    ) : (
                      <span className="mt-agenda-est">
                        {a.estimatedMinutes}m
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {canEdit ? (
                <div className="mt-agenda-actions">
                  <button
                    type="button"
                    onClick={() => onMove(a.key, "up")}
                    disabled={idx === 0}
                    title="Move up"
                    aria-label="Move up"
                  >
                    {Icon.chevU}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(a.key, "down")}
                    disabled={idx === agenda.length - 1}
                    title="Move down"
                    aria-label="Move down"
                  >
                    {Icon.chevD}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(a.key)}
                    title="Remove"
                    aria-label="Remove"
                  >
                    {Icon.trash}
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {canEdit ? (
        <>
          <button type="button" className="mt-agenda-add" onClick={onAdd}>
            {Icon.plus} Add agenda item
          </button>
          <div className={`mt-agenda-total${overBudget ? " over" : ""}`}>
            <span>Estimated total duration</span>
            <strong>
              {totalEstimated} of {plannedMinutes} min scheduled
            </strong>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Attendees tab ──
function AttendeesTab({
  detail,
  canEdit,
  invitableCount,
  onInviteClick,
}: {
  detail: MeetingDetail;
  canEdit: boolean;
  invitableCount: number;
  onInviteClick: () => void;
}) {
  return (
    <div>
      <div className="mt-detail-tab-hdr">
        <h3>Attendees</h3>
        {canEdit ? (
          <button
            type="button"
            className="mt-btn xs"
            onClick={onInviteClick}
            disabled={invitableCount === 0}
            title={
              invitableCount === 0
                ? "Everyone on the project is already invited"
                : undefined
            }
          >
            {Icon.plus} Invite
          </button>
        ) : null}
      </div>

      <div className="mt-tab-callout">
        {Icon.mail}
        <span>
          Invitations send via email + in-app notification on creation.
          RSVPs route back to the chair.
        </span>
      </div>

      <div className="mt-att-grid">
        {detail.attendees.map((a) => (
          <div key={a.id}>
            <div className="mt-att-row">
              <div className={`mt-att-avatar${a.isChair ? " chair" : ""}`}>
                {initials(a.displayName)}
              </div>
              <div className="mt-att-body">
                <div className="mt-att-name">{a.displayName}</div>
                <div className="mt-att-role">
                  {a.roleLabel ? <span>{a.roleLabel}</span> : null}
                  {a.orgName ? (
                    <span className="mt-att-org">· {a.orgName}</span>
                  ) : null}
                  <span className={`mt-att-scope ${a.scope}`}>
                    {ATTENDEE_SCOPE_LABEL[a.scope]}
                  </span>
                </div>
              </div>
              <span className={`mt-att-rsvp ${a.attendedStatus}`}>
                {a.attendedStatus === "accepted"
                  ? Icon.check
                  : a.attendedStatus === "declined"
                    ? Icon.x
                    : null}
                {a.attendedStatus === "accepted"
                  ? "Accepted"
                  : a.attendedStatus === "declined"
                    ? "Declined"
                    : a.attendedStatus === "tentative"
                      ? "Tentative"
                      : a.attendedStatus === "attended"
                        ? "Attended"
                        : a.attendedStatus === "absent"
                          ? "Absent"
                          : "Invited"}
              </span>
            </div>
            {a.attendedStatus === "declined" && a.declineReason ? (
              <div className="mt-att-decline-note">
                {Icon.info}
                <span>
                  <strong>Reason:</strong> {a.declineReason}
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Minutes tab ──
function MinutesTab({
  value,
  onChange,
  canEdit,
  canFinalize,
  finalizedAt,
  draftedByName,
  updatedAt,
  saving,
  dirty,
  onSave,
  onFinalize,
}: {
  value: string;
  onChange: (v: string) => void;
  canEdit: boolean;
  canFinalize: boolean;
  finalizedAt: string | null;
  draftedByName: string | null;
  updatedAt: string | null;
  saving: boolean;
  dirty: boolean;
  onSave: () => void;
  onFinalize: () => void;
}) {
  const savedLabel = dirty
    ? "Unsaved changes"
    : updatedAt
      ? `Auto-saved · ${formatDateShort(updatedAt)}`
      : "Draft";

  return (
    <div>
      <div className="mt-minutes-hdr">
        <h3>
          Meeting minutes{" "}
          {finalizedAt ? "— published" : canEdit ? "— draft" : ""}
        </h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            className="mt-btn ai xs"
            disabled
            title="Available after Step 56 (Meeting Minutes AI)"
          >
            {Icon.mic} Generate from audio
          </button>
          <button
            type="button"
            className="mt-btn xs ghost"
            onClick={() => {
              if (value) {
                navigator.clipboard?.writeText(value);
              }
            }}
            disabled={!value}
          >
            {Icon.copy} Copy
          </button>
          {canEdit ? (
            <button
              type="button"
              className="mt-btn xs"
              onClick={onSave}
              disabled={!dirty || saving}
            >
              {saving ? "Saving…" : dirty ? "Save draft" : "Saved"}
            </button>
          ) : null}
          {canFinalize ? (
            <button
              type="button"
              className="mt-btn xs primary"
              onClick={onFinalize}
            >
              {Icon.check} Finalize
            </button>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <>
          <div className="mt-minutes-editor">
            <div className="mt-minutes-toolbar">
              {/*
                Formatting buttons are visible (matches the JSX prototype's
                editor affordance) but act as plain text for now — plain
                textarea. Rich-text fidelity can upgrade to a proper editor
                in a later phase without changing this shell.
              */}
              <button
                type="button"
                className="mt-minutes-toolbar-btn"
                title="Bold"
              >
                {Icon.bold}
              </button>
              <button
                type="button"
                className="mt-minutes-toolbar-btn"
                title="Italic"
              >
                {Icon.italic}
              </button>
              <button
                type="button"
                className="mt-minutes-toolbar-btn"
                title="Underline"
              >
                {Icon.underline}
              </button>
              <div className="mt-minutes-toolbar-divider" />
              <button
                type="button"
                className="mt-minutes-toolbar-btn"
                title="Insert list"
              >
                {Icon.list} List
              </button>
              <button
                type="button"
                className="mt-minutes-toolbar-btn"
                title="Mark as decision"
              >
                {Icon.clipboard} Decision
              </button>
              <button
                type="button"
                className="mt-minutes-toolbar-btn"
                title="Mark as action"
              >
                {Icon.check} Action
              </button>
              <div className="mt-minutes-toolbar-divider" />
              <button
                type="button"
                className="mt-minutes-toolbar-btn"
                title="Link to RFI or Change Order"
              >
                {Icon.link} Link to RFI / CO
              </button>
              <div style={{ flex: 1 }} />
              <span
                style={{
                  fontSize: 10.5,
                  color: "var(--text-tertiary)",
                  fontWeight: 540,
                }}
              >
                {savedLabel}
              </span>
            </div>

            <textarea
              className="mt-minutes-ta"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Start typing meeting minutes, or use the AI transcription below once Phase 7.1 ships."
            />

            <div className="mt-minutes-footer">
              <span>
                {draftedByName ? (
                  <>
                    Drafted by <strong>{draftedByName}</strong>
                  </>
                ) : (
                  "Draft"
                )}{" "}
                · {finalizedAt ? "finalized" : "not yet finalized"}
              </span>
              <span>{value.length} characters</span>
            </div>
          </div>
        </>
      ) : value ? (
        <div className="mt-minutes-readonly">{value}</div>
      ) : (
        <div className="mt-minutes-readonly-pending">
          Minutes haven&apos;t been published yet. You&apos;ll be notified
          when the chair finalizes them.
        </div>
      )}

      <div className="mt-ai-callout">
        <span className="mt-ai-callout-icon">{Icon.sparkle}</span>
        <div className="mt-ai-callout-body">
          <div className="mt-ai-callout-title">
            Generate minutes from audio
          </div>
          <div className="mt-ai-callout-text">
            Upload a recording and the Minutes Assistant will draft a
            structured summary with decisions and action items.{" "}
            <strong>Available in Step 56 (Phase 7.1).</strong>
          </div>
        </div>
        <button
          type="button"
          className="mt-btn ai sm"
          disabled
          title="Available in Phase 7.1 (Step 56)"
        >
          {Icon.mic} Upload audio
        </button>
      </div>
    </div>
  );
}

// ── Actions tab ──
function ActionsTab({
  actionItems,
  agenda,
  people,
  canEdit,
  newAction,
  setNewAction,
  onAdd,
  adding,
  onStatus,
  onDelete,
  showAddForm,
  onToggleAddForm,
}: {
  actionItems: MeetingDetail["actionItems"];
  agenda: MeetingDetail["agenda"];
  people: Person[];
  canEdit: boolean;
  newAction: {
    description: string;
    assignedUserId: string;
    dueDate: string;
    originAgendaItemId: string;
  };
  setNewAction: (v: {
    description: string;
    assignedUserId: string;
    dueDate: string;
    originAgendaItemId: string;
  }) => void;
  onAdd: () => void;
  adding: boolean;
  onStatus: (
    itemId: string,
    status: "open" | "in_progress" | "done",
  ) => void;
  onDelete: (itemId: string) => void;
  showAddForm: boolean;
  onToggleAddForm: () => void;
}) {
  return (
    <div>
      <div className="mt-detail-tab-hdr">
        <h3>Action items</h3>
        {canEdit ? (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="mt-btn xs ghost"
              onClick={() =>
                window.alert(
                  "Action items already flow to assignees' 'My actions' queue on the sub portal. A top-level tasks sync lands with the tasks module.",
                )
              }
            >
              {Icon.link} Sync to task list
            </button>
            <button
              type="button"
              className="mt-btn xs primary"
              onClick={onToggleAddForm}
            >
              {Icon.plus} Add action
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-tab-callout warn">
        {Icon.arrowR}
        <span>
          Open action items on meeting completion automatically carry
          forward to the next same-type meeting on this project.
        </span>
      </div>

      {actionItems.length === 0 ? (
        <div className="mt-empty" style={{ marginBottom: 14 }}>
          <h3>No action items yet</h3>
          <p>
            Capture what each attendee owes by the next meeting. Open items
            carry forward automatically.
          </p>
        </div>
      ) : (
        <div className="mt-actions-table">
          <div className="mt-actions-table-hdr">
            <div>Action</div>
            <div>Assignee</div>
            <div>Due</div>
            <div>Status</div>
            <div></div>
          </div>
          {actionItems.map((a) => (
            <div key={a.id} className="mt-actions-row">
              <div className="mt-actions-desc">
                <div className="mt-actions-desc-main">{a.description}</div>
                {a.carriedFromLabel ? (
                  <div className="mt-actions-desc-carried">
                    {Icon.arrowR} Carried from {a.carriedFromLabel}
                  </div>
                ) : null}
              </div>
              <div className="mt-actions-assignee">
                <span className="mt-actions-assignee-name">
                  {a.assignedUserName ?? "—"}
                </span>
                {a.assignedOrgName ? (
                  <span className="mt-actions-assignee-org">
                    {a.assignedOrgName}
                  </span>
                ) : null}
              </div>
              <div className="mt-actions-due">
                {formatDateShort(a.dueDate)}
              </div>
              <div>
                <select
                  className={`mt-actions-status-sel ${a.status}`}
                  value={a.status}
                  onChange={(e) =>
                    onStatus(
                      a.id,
                      e.target.value as "open" | "in_progress" | "done",
                    )
                  }
                  disabled={!canEdit}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                {canEdit ? (
                  <button
                    type="button"
                    className="mt-btn ghost xs icon"
                    onClick={() => onDelete(a.id)}
                    title="Delete"
                    aria-label="Delete"
                  >
                    {Icon.trash}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && showAddForm ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--surface-2)",
          }}
        >
          <div
            style={{
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: 700,
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            Add action item
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              type="text"
              placeholder="What needs to happen?"
              value={newAction.description}
              maxLength={2000}
              onChange={(e) =>
                setNewAction({ ...newAction, description: e.target.value })
              }
              style={{
                height: 32,
                padding: "0 10px",
                border: "1px solid var(--border)",
                borderRadius: 6,
                background: "var(--surface-1)",
                fontFamily: "inherit",
                fontSize: 12.5,
                color: "inherit",
                outline: "none",
              }}
            />
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "1fr 1fr 1fr",
              }}
            >
              <select
                value={newAction.assignedUserId}
                onChange={(e) =>
                  setNewAction({
                    ...newAction,
                    assignedUserId: e.target.value,
                  })
                }
                style={{
                  height: 32,
                  padding: "0 8px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--surface-1)",
                  fontFamily: "inherit",
                  fontSize: 12,
                  color: "inherit",
                }}
              >
                <option value="">— Assignee</option>
                {people.map((p) => (
                  <option key={p.userId} value={p.userId}>
                    {(p.userName ?? p.userEmail) + " · " + p.orgName}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={newAction.dueDate}
                onChange={(e) =>
                  setNewAction({ ...newAction, dueDate: e.target.value })
                }
                style={{
                  height: 32,
                  padding: "0 8px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--surface-1)",
                  fontFamily: "inherit",
                  fontSize: 12,
                  color: "inherit",
                }}
              />
              <select
                value={newAction.originAgendaItemId}
                onChange={(e) =>
                  setNewAction({
                    ...newAction,
                    originAgendaItemId: e.target.value,
                  })
                }
                style={{
                  height: 32,
                  padding: "0 8px",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  background: "var(--surface-1)",
                  fontFamily: "inherit",
                  fontSize: 12,
                  color: "inherit",
                }}
              >
                <option value="">— Origin (agenda)</option>
                {agenda.map((ag, idx) => (
                  <option key={ag.id} value={ag.id}>
                    {idx + 1}. {ag.title.slice(0, 40)}
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 6,
              }}
            >
              <button
                type="button"
                className="mt-btn ghost xs"
                onClick={onToggleAddForm}
                disabled={adding}
              >
                Cancel
              </button>
              <button
                type="button"
                className="mt-btn primary xs"
                onClick={onAdd}
                disabled={!newAction.description.trim() || adding}
              >
                {adding ? "Adding…" : "Add action"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Invite modal ──
function InviteAttendeeModal({
  candidates,
  selectedUserId,
  onSelect,
  roleLabel,
  onRoleChange,
  submitting,
  onClose,
  onSubmit,
}: {
  candidates: Person[];
  selectedUserId: string;
  onSelect: (v: string) => void;
  roleLabel: string;
  onRoleChange: (v: string) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="mt-modal-veil" role="dialog" aria-modal="true">
      <div className="mt-modal" style={{ maxWidth: 440 }}>
        <div className="mt-modal-hdr">
          <h3>Invite attendee</h3>
          <button
            type="button"
            className="mt-btn ghost icon xs"
            onClick={onClose}
            aria-label="Close"
          >
            {Icon.x}
          </button>
        </div>
        <div className="mt-modal-body">
          {candidates.length === 0 ? (
            <div
              style={{
                padding: 12,
                textAlign: "center",
                fontSize: 12,
                color: "var(--text-tertiary)",
              }}
            >
              Everyone on the project is already invited.
            </div>
          ) : (
            <>
              <div className="mt-modal-field">
                <label>Project member</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => onSelect(e.target.value)}
                >
                  <option value="">— Pick someone</option>
                  {candidates.map((p) => (
                    <option key={p.userId} value={p.userId}>
                      {(p.userName ?? p.userEmail) + " · " + p.orgName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-modal-field">
                <label>Role on this meeting (optional)</label>
                <input
                  type="text"
                  value={roleLabel}
                  maxLength={120}
                  onChange={(e) => onRoleChange(e.target.value)}
                  placeholder="e.g. MEP Coordinator"
                />
              </div>
            </>
          )}
        </div>
        <div className="mt-modal-ftr">
          <button
            type="button"
            className="mt-btn ghost sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="mt-btn primary sm"
            onClick={onSubmit}
            disabled={!selectedUserId || submitting}
          >
            {submitting ? "Inviting…" : "Send invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
