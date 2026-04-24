"use client";

import { useEffect, useState } from "react";

import { Icon } from "../../../../meetings-shared";
import type { MeetingType } from "@/domain/loaders/meetings";

export type AttendeePick = {
  userId: string;
  userName: string | null;
  userEmail: string;
  orgId: string;
  orgName: string;
  scope: "internal" | "sub" | "external";
};

const TYPE_OPTIONS: Array<{
  value: MeetingType;
  label: string;
  description: string;
}> = [
  { value: "oac", label: "OAC", description: "Owner-Architect-Contractor" },
  {
    value: "preconstruction",
    label: "Preconstruction",
    description: "Phase kickoff",
  },
  { value: "coordination", label: "Coordination", description: "Trade sync" },
  { value: "progress", label: "Progress", description: "Weekly review" },
  { value: "safety", label: "Safety", description: "Safety stand-down" },
  { value: "closeout", label: "Closeout", description: "Handover" },
  { value: "internal", label: "Internal", description: "PM-only sync" },
];

export function CreateMeetingModal({
  open,
  onClose,
  projectId,
  people,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  people: AttendeePick[];
  onCreated: (meetingId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MeetingType>("oac");
  const [scheduledDate, setScheduledDate] = useState(defaultDate());
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [carryPreview, setCarryPreview] = useState<{
    label: string | null;
    openActionItemCount: number;
    openAgendaItemCount: number;
  } | null>(null);

  // Wire the carry-forward preview to the real loader — keeps the modal
  // hint honest instead of a static string.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCarryPreview(null);
    const qs = new URLSearchParams({ projectId, type });
    fetch(`/api/meetings-carry-preview?${qs.toString()}`, {
      method: "GET",
    })
      .then(async (r) => {
        if (!r.ok) return null;
        return (await r.json()) as {
          sourceMeetingLabel: string | null;
          openActionItemCount: number;
          openAgendaItemCount: number;
        };
      })
      .then((data) => {
        if (cancelled || !data) return;
        setCarryPreview({
          label: data.sourceMeetingLabel,
          openActionItemCount: data.openActionItemCount,
          openAgendaItemCount: data.openAgendaItemCount,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, projectId, type]);

  if (!open) return null;

  const toggleAttendee = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const submit = async () => {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    const isoLocal = `${scheduledDate}T${scheduledTime}:00`;
    const scheduledAt = new Date(isoLocal).toISOString();
    setSubmitting(true);
    try {
      const attendees = Array.from(selectedUserIds)
        .map((uid) => {
          const p = people.find((x) => x.userId === uid);
          if (!p) return null;
          return {
            userId: p.userId,
            orgId: p.orgId,
            scope: p.scope,
          };
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          type,
          scheduledAt,
          durationMinutes,
          attendees,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.message ?? body.error ?? "Failed to create meeting");
        return;
      }
      const body = (await res.json()) as { id: string };
      onCreated(body.id);
      // Reset state
      setTitle("");
      setSelectedUserIds(new Set());
    } finally {
      setSubmitting(false);
    }
  };

  const carryHint = (() => {
    if (type === "internal") return null;
    if (!carryPreview) return null;
    const total =
      carryPreview.openActionItemCount + carryPreview.openAgendaItemCount;
    if (!carryPreview.label || total === 0) return null;
    return (
      <div className="mt-modal-carry-hint">
        {Icon.info}
        <span>
          This {TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type}{" "}
          meeting will carry forward{" "}
          <strong>{carryPreview.openActionItemCount}</strong> open action item
          {carryPreview.openActionItemCount === 1 ? "" : "s"} and{" "}
          <strong>{carryPreview.openAgendaItemCount}</strong> agenda item
          {carryPreview.openAgendaItemCount === 1 ? "" : "s"} from{" "}
          {carryPreview.label}.
        </span>
      </div>
    );
  })();

  return (
    <div className="mt-modal-veil" role="dialog" aria-modal="true">
      <div className="mt-modal">
        <div className="mt-modal-hdr">
          <h3>New meeting</h3>
          <button
            type="button"
            className="mt-btn ghost icon"
            onClick={onClose}
            aria-label="Close"
          >
            {Icon.x}
          </button>
        </div>
        <div className="mt-modal-body">
          <div className="mt-modal-field">
            <label>Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="OAC Weekly — Week 15"
              maxLength={200}
              autoFocus
            />
          </div>

          <div className="mt-modal-field">
            <label>Type</label>
            <div className="mt-modal-type-pick">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`mt-modal-type-opt${type === opt.value ? " active" : ""}`}
                  onClick={() => setType(opt.value)}
                >
                  <span className="mt-modal-type-opt-label">{opt.label}</span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--text-tertiary)",
                      fontWeight: 540,
                    }}
                  >
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {carryHint}

          <div className="mt-modal-grid">
            <div className="mt-modal-field">
              <label>Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="mt-modal-field">
              <label>Time</label>
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-modal-field">
            <label>Duration (minutes)</label>
            <input
              type="number"
              min={5}
              max={600}
              value={durationMinutes}
              onChange={(e) =>
                setDurationMinutes(
                  Math.max(5, Math.min(600, Number(e.target.value) || 60)),
                )
              }
            />
          </div>

          <div className="mt-modal-field">
            <label>Invite attendees ({selectedUserIds.size} selected)</label>
            <div
              style={{
                maxHeight: 180,
                overflowY: "auto",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 6,
              }}
            >
              {people.length === 0 ? (
                <div
                  style={{
                    padding: 12,
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                  }}
                >
                  No other project members yet.
                </div>
              ) : (
                people.map((p) => (
                  <label
                    key={p.userId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      fontSize: 12.5,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.has(p.userId)}
                      onChange={() => toggleAttendee(p.userId)}
                    />
                    <span style={{ flex: 1 }}>
                      <span
                        style={{
                          fontFamily: '"DM Sans", sans-serif',
                          fontWeight: 650,
                        }}
                      >
                        {p.userName ?? p.userEmail}
                      </span>
                      <span
                        style={{
                          marginLeft: 8,
                          color: "var(--text-tertiary)",
                          fontSize: 11,
                        }}
                      >
                        {p.orgName}
                      </span>
                    </span>
                    <span className={`mt-att-scope ${p.scope}`}>
                      {p.scope === "internal"
                        ? "Internal"
                        : p.scope === "sub"
                          ? "Sub"
                          : "External"}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {error ? (
            <div
              style={{
                padding: "8px 10px",
                background: "var(--er-soft)",
                color: "var(--er)",
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              {error}
            </div>
          ) : null}
        </div>
        <div className="mt-modal-ftr">
          <button
            type="button"
            className="mt-btn ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="mt-btn primary"
            onClick={submit}
            disabled={submitting || !title.trim()}
          >
            {submitting ? "Creating…" : "Create meeting"}
          </button>
        </div>
      </div>
    </div>
  );
}

function defaultDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
