"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  AttendeeScope,
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

type Person = {
  userId: string;
  userName: string | null;
  userEmail: string;
  orgId: string;
  orgName: string;
  scope: AttendeeScope;
};

type Tab = "agenda" | "attendees" | "minutes" | "actions";

// Local editable view of agenda items — mirrors the server shape plus a
// stable client key for un-persisted rows.
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
  viewerRole,
}: {
  projectId: string;
  meetingId: string;
  detail: MeetingDetail;
  people: Person[];
  viewerRole: "contractor" | "subcontractor";
}) {
  const router = useRouter();
  const portalBase = `/${viewerRole}/project/${projectId}`;
  const [tab, setTab] = useState<Tab>("agenda");

  // Editable agenda state (contractor only)
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

  // Minutes state
  const [minutesDraft, setMinutesDraft] = useState(
    detail.minutes?.content ?? "",
  );
  const minutesFinalized = !!detail.minutes?.finalizedAt;
  const [minutesSaving, setMinutesSaving] = useState(false);
  const [minutesDirty, setMinutesDirty] = useState(false);

  // Add-action-item form
  const [newAction, setNewAction] = useState({
    description: "",
    assignedUserId: "",
    dueDate: "",
    originAgendaItemId: "",
  });
  const [addingAction, setAddingAction] = useState(false);

  const totalEstimated = useMemo(
    () => agenda.reduce((s, a) => s + a.estimatedMinutes, 0),
    [agenda],
  );

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

  const transitionMeeting = async (action: "start" | "complete" | "cancel") => {
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

  return (
    <>
      <div className="mt-page-hdr">
        <div>
          <Link
            href={`${portalBase}/meetings`}
            className="mt-btn ghost sm"
            style={{ marginBottom: 6 }}
          >
            {Icon.back} All meetings
          </Link>
          <h1 className="mt-page-title" style={{ fontSize: 22 }}>
            {detail.title}
          </h1>
        </div>
      </div>

      <div className="mt-detail">
        <div className="mt-detail-main">
          <section className="mt-detail-hero">
            <div className="mt-detail-hero-top">
              <div className="mt-detail-hero-left">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      fontWeight: 600,
                    }}
                  >
                    {detail.numberLabel}
                  </span>
                  <MeetingTypePill type={detail.type as MeetingType} />
                  <StatusPill status={detail.status} />
                </div>
                <h2>{detail.title}</h2>
                <div className="mt-detail-hero-meta">
                  <span>
                    {Icon.calendar} {scheduledFull}
                  </span>
                  <span>
                    {Icon.clock} {detail.durationMinutes}m
                  </span>
                  <span>
                    {Icon.user} Chair:{" "}
                    <strong>{detail.chairName ?? "—"}</strong>
                  </span>
                </div>
                {detail.status === "cancelled" && detail.cancelledReason ? (
                  <div className="mt-att-decline-note" style={{ marginTop: 10 }}>
                    {Icon.info} <span>Cancelled — {detail.cancelledReason}</span>
                  </div>
                ) : null}
              </div>
              <div className="mt-detail-hero-actions">
                {viewerRole === "contractor" ? (
                  <>
                    {detail.status === "scheduled" ? (
                      <button
                        type="button"
                        className="mt-btn primary"
                        onClick={() => transitionMeeting("start")}
                      >
                        Start meeting
                      </button>
                    ) : null}
                    {detail.status === "in_progress" ? (
                      <button
                        type="button"
                        className="mt-btn primary"
                        onClick={() => transitionMeeting("complete")}
                      >
                        Complete
                      </button>
                    ) : null}
                    {detail.status === "scheduled" ||
                    detail.status === "in_progress" ? (
                      <button
                        type="button"
                        className="mt-btn danger"
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
                <div className="mt-summary-label">Attendees</div>
                <div className="mt-summary-val">{detail.attendeeCount}</div>
                <div className="mt-summary-sub">
                  {detail.attendees.filter((a) => a.attendedStatus === "accepted").length}{" "}
                  accepted
                </div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">Agenda</div>
                <div className="mt-summary-val">{detail.agendaCount}</div>
                <div className="mt-summary-sub">
                  {totalEstimated}m planned
                </div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">Open actions</div>
                <div className="mt-summary-val">{openActions}</div>
                <div className="mt-summary-sub">
                  {doneActions} done · {inProgressActions} in progress
                </div>
              </div>
              <div className="mt-summary-item">
                <div className="mt-summary-label">Carried forward</div>
                <div className="mt-summary-val">
                  {detail.carriedForwardCount}
                </div>
                <div className="mt-summary-sub carry">
                  From prior {detail.type} meeting
                </div>
              </div>
            </div>
          </section>

          <section className="mt-detail-tabs">
            <div className="mt-detail-tab-bar">
              {(
                [
                  ["agenda", "Agenda", detail.agenda.length],
                  ["attendees", "Attendees", detail.attendees.length],
                  ["minutes", "Minutes", null],
                  ["actions", "Actions", detail.actionItems.length],
                ] as Array<[Tab, string, number | null]>
              ).map(([k, label, count]) => (
                <button
                  key={k}
                  type="button"
                  className={`mt-detail-tab${tab === k ? " active" : ""}`}
                  onClick={() => setTab(k)}
                >
                  {label}
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
                  people={people}
                  onSave={saveAgenda}
                  onAdd={addAgenda}
                  onRemove={removeAgenda}
                  onMove={moveAgenda}
                  onUpdate={updateAgenda}
                />
              ) : null}

              {tab === "attendees" ? (
                <AttendeesTab detail={detail} viewerRole={viewerRole} />
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
                  people={people}
                  canEdit={viewerRole === "contractor"}
                  newAction={newAction}
                  setNewAction={setNewAction}
                  onAdd={createAction}
                  adding={addingAction}
                  onStatus={updateActionStatus}
                  onDelete={deleteAction}
                />
              ) : null}
            </div>
          </section>
        </div>

        <aside className="mt-rail">
          <div className="mt-rail-card">
            <div className="mt-rail-hdr">
              <h4>
                {Icon.info} About this meeting
              </h4>
            </div>
            <div style={{ padding: "12px 14px", fontSize: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    fontFamily: '"DM Sans", sans-serif',
                    fontWeight: 680,
                    fontSize: 10.5,
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: 3,
                  }}
                >
                  Project
                </div>
                <div style={{ fontWeight: 640 }}>{detail.project.name}</div>
              </div>
              {detail.completedAt ? (
                <div style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      fontFamily: '"DM Sans", sans-serif',
                      fontWeight: 680,
                      fontSize: 10.5,
                      color: "var(--text-tertiary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: 3,
                    }}
                  >
                    Completed
                  </div>
                  <div style={{ fontWeight: 540 }}>
                    {formatScheduledFull(detail.completedAt)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
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
        {canEdit ? (
          <button
            type="button"
            className="mt-btn primary sm"
            onClick={onSave}
            disabled={!dirty || saving}
          >
            {saving ? "Saving…" : dirty ? "Save agenda" : "Saved"}
          </button>
        ) : null}
      </div>

      {agenda.length === 0 ? (
        <div className="mt-empty">
          <h3>No agenda yet</h3>
          <p>
            Add items so attendees know what to expect. Carry-forward from
            prior same-type meetings will show up automatically.
          </p>
        </div>
      ) : (
        <div className="mt-agenda-list">
          {agenda.map((a, idx) => (
            <div
              key={a.key}
              className={`mt-agenda-row${a.carriedFromLabel ? " carry" : ""}`}
            >
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
                      {Icon.arrowR} From {a.carriedFromLabel}
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
                          const p = people.find((p) => p.userId === uid);
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
                            {p.userName ?? p.userEmail}
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
                      <span className="mt-agenda-est">{a.estimatedMinutes}m</span>
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
                  >
                    {Icon.chevU}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(a.key, "down")}
                    disabled={idx === agenda.length - 1}
                    title="Move down"
                  >
                    {Icon.chevD}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(a.key)}
                    title="Remove"
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
          <div className="mt-agenda-total">
            <span>Total planned time</span>
            <strong>{totalEstimated} minutes</strong>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Attendees tab ──
function AttendeesTab({
  detail,
  viewerRole,
}: {
  detail: MeetingDetail;
  viewerRole: "contractor" | "subcontractor";
}) {
  return (
    <div>
      <div className="mt-detail-tab-hdr">
        <h3>Attendees ({detail.attendees.length})</h3>
        {viewerRole === "contractor" ? (
          <span
            style={{
              fontSize: 11.5,
              color: "var(--text-tertiary)",
              fontWeight: 540,
            }}
          >
            Add attendees from the project directory after creation via the
            API — UI for this lives on the create screen.
          </span>
        ) : null}
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
                    <span className="mt-att-org">{a.orgName}</span>
                  ) : null}
                  <span className={`mt-att-scope ${a.scope}`}>
                    {ATTENDEE_SCOPE_LABEL[a.scope]}
                  </span>
                </div>
              </div>
              <span className={`mt-att-rsvp ${a.attendedStatus}`}>
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
                {Icon.info} <span>{a.declineReason}</span>
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
  return (
    <div>
      <div className="mt-minutes-hdr">
        <h3>Minutes {finalizedAt ? "(published)" : canEdit ? "(draft)" : ""}</h3>
        <div style={{ display: "flex", gap: 8 }}>
          {/* AI placeholder — wired for Step 56, disabled until then.
              Kept visible so users understand the feature is coming. */}
          <button
            type="button"
            className="mt-btn ai sm"
            disabled
            title="Available after Step 56 (Meeting Minutes AI)"
          >
            {Icon.mic} Generate minutes from audio
          </button>
          {canEdit ? (
            <button
              type="button"
              className="mt-btn sm"
              onClick={onSave}
              disabled={!dirty || saving}
            >
              {saving ? "Saving…" : dirty ? "Save draft" : "Saved"}
            </button>
          ) : null}
          {canFinalize ? (
            <button type="button" className="mt-btn primary sm" onClick={onFinalize}>
              {Icon.check} Finalize &amp; publish
            </button>
          ) : null}
        </div>
      </div>

      {canEdit ? (
        <div className="mt-minutes-editor">
          <textarea
            className="mt-minutes-ta"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Start taking minutes. This draft saves on demand — finalize to publish to attendees."
          />
          <div className="mt-minutes-footer">
            <span>
              {draftedByName ? `Last drafted by ${draftedByName}` : "Draft"}
              {updatedAt ? ` · ${formatDateShort(updatedAt)}` : ""}
            </span>
            <span>{value.length} characters</span>
          </div>
        </div>
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
          <div className="mt-ai-callout-title">AI minutes — coming soon</div>
          <div className="mt-ai-callout-text">
            Upload or record the meeting audio in Step 56 and the Minutes AI
            agent will draft this document and extract action items
            automatically.
          </div>
        </div>
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
  setNewAction: (
    v: {
      description: string;
      assignedUserId: string;
      dueDate: string;
      originAgendaItemId: string;
    },
  ) => void;
  onAdd: () => void;
  adding: boolean;
  onStatus: (
    itemId: string,
    status: "open" | "in_progress" | "done",
  ) => void;
  onDelete: (itemId: string) => void;
}) {
  return (
    <div>
      <div className="mt-detail-tab-hdr">
        <h3>Action items ({actionItems.length})</h3>
      </div>

      {actionItems.length === 0 ? (
        <div className="mt-empty" style={{ marginBottom: 14 }}>
          <h3>No action items yet</h3>
          <p>
            Capture what each attendee owes by the next meeting. Open items
            automatically carry forward to the next same-type meeting.
          </p>
        </div>
      ) : (
        <div className="mt-actions-table">
          <div className="mt-actions-table-hdr">
            <div>Description</div>
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
              <div className="mt-actions-due">{formatDateShort(a.dueDate)}</div>
              <div>
                <select
                  className={`mt-actions-status-sel ${a.status}`}
                  value={a.status}
                  onChange={(e) =>
                    onStatus(a.id, e.target.value as "open" | "in_progress" | "done")
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
                  >
                    {Icon.trash}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit ? (
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
              style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 1fr" }}
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
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="mt-btn primary sm"
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
