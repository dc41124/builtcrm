"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import type {
  InspectionDetail,
  InspectionOutcome,
} from "@/domain/loaders/inspections";
import {
  Icon,
  OutcomeIcon,
  StatusPill,
  TradeBadge,
  formatDateLong,
  formatDateShort,
  uploadInspectionPhoto,
} from "../../../../../inspections-shared";

type Props = {
  portal: "contractor" | "subcontractor";
  portalBase: string;
  detail: InspectionDetail;
};

type LocalResult = {
  outcome: InspectionOutcome;
  notes: string | null;
  linkedPunchLabel: string | null;
  linkedPunchId: string | null;
  photoCount: number;
  saving: boolean;
  error: string | null;
};

export function InspectionDetailView({ portal, portalBase, detail }: Props) {
  const router = useRouter();
  const [isCompleting, startComplete] = useTransition();
  const [completeError, setCompleteError] = useState<string | null>(null);
  const fileInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const [uploadingByKey, setUploadingByKey] = useState<Map<string, string | null>>(
    new Map(),
  );

  // Local, per-line-item state for the outcome radio + notes. Seeded from
  // the loader; updates flow through /api/inspection-results.
  const [localByKey, setLocalByKey] = useState<Map<string, LocalResult>>(() => {
    const m = new Map<string, LocalResult>();
    for (const li of detail.lineItems) {
      if (li.result) {
        m.set(li.key, {
          outcome: li.result.outcome,
          notes: li.result.notes,
          linkedPunchLabel: li.result.linkedPunchLabel,
          linkedPunchId: li.result.linkedPunchId,
          photoCount: li.result.photoCount,
          saving: false,
          error: null,
        });
      }
    }
    return m;
  });

  const isCompleted = detail.status === "completed";
  const isCancelled = detail.status === "cancelled";
  const isReadOnly = isCompleted || isCancelled;

  const counts = useMemo(() => {
    let pass = 0;
    let fail = 0;
    let cond = 0;
    let na = 0;
    for (const li of detail.lineItems) {
      const r = localByKey.get(li.key) ?? null;
      const outcome = r?.outcome ?? li.result?.outcome ?? null;
      if (outcome === "pass") pass += 1;
      else if (outcome === "fail") fail += 1;
      else if (outcome === "conditional") cond += 1;
      else if (outcome === "na") na += 1;
    }
    return { pass, fail, cond, na };
  }, [detail.lineItems, localByKey]);

  const recordedCount =
    counts.pass + counts.fail + counts.cond + counts.na;
  const itemCount = detail.lineItems.length;

  async function recordOutcome(
    lineItemKey: string,
    outcome: InspectionOutcome,
  ) {
    const existing = localByKey.get(lineItemKey);
    setLocalByKey((prev) => {
      const next = new Map(prev);
      next.set(lineItemKey, {
        outcome,
        notes: existing?.notes ?? null,
        linkedPunchLabel: existing?.linkedPunchLabel ?? null,
        linkedPunchId: existing?.linkedPunchId ?? null,
        photoCount: existing?.photoCount ?? 0,
        saving: true,
        error: null,
      });
      return next;
    });

    try {
      const res = await fetch("/api/inspection-results", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inspectionId: detail.id,
          lineItemKey,
          outcome,
          notes: existing?.notes ?? null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to save outcome");
      }
      setLocalByKey((prev) => {
        const next = new Map(prev);
        const cur = next.get(lineItemKey);
        if (cur) next.set(lineItemKey, { ...cur, saving: false });
        return next;
      });
      router.refresh();
    } catch (err) {
      setLocalByKey((prev) => {
        const next = new Map(prev);
        const cur = next.get(lineItemKey);
        if (cur)
          next.set(lineItemKey, {
            ...cur,
            saving: false,
            error: (err as Error).message,
          });
        return next;
      });
    }
  }

  async function saveNotes(lineItemKey: string, notes: string) {
    const cur = localByKey.get(lineItemKey);
    if (!cur) return;
    if ((cur.notes ?? "") === notes) return;
    setLocalByKey((prev) => {
      const next = new Map(prev);
      next.set(lineItemKey, { ...cur, notes, saving: true, error: null });
      return next;
    });
    try {
      const res = await fetch("/api/inspection-results", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inspectionId: detail.id,
          lineItemKey,
          outcome: cur.outcome,
          notes,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to save note");
      }
      setLocalByKey((prev) => {
        const next = new Map(prev);
        const cur2 = next.get(lineItemKey);
        if (cur2) next.set(lineItemKey, { ...cur2, saving: false });
        return next;
      });
    } catch (err) {
      setLocalByKey((prev) => {
        const next = new Map(prev);
        const cur2 = next.get(lineItemKey);
        if (cur2)
          next.set(lineItemKey, {
            ...cur2,
            saving: false,
            error: (err as Error).message,
          });
        return next;
      });
    }
  }

  function completeInspection() {
    startComplete(async () => {
      setCompleteError(null);
      try {
        const res = await fetch(
          `/api/inspections/${detail.id}/complete`,
          { method: "POST" },
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setCompleteError(body.message ?? "Failed to complete inspection");
          return;
        }
        router.refresh();
      } catch (err) {
        setCompleteError((err as Error).message);
      }
    });
  }

  async function onPhotoSelected(
    lineItemKey: string,
    inspectionResultId: string,
    file: File,
  ) {
    setUploadingByKey((prev) => {
      const next = new Map(prev);
      next.set(lineItemKey, null);
      return next;
    });
    try {
      await uploadInspectionPhoto({
        file,
        projectId: detail.project.id,
        inspectionResultId,
      });
      // Optimistic bump so the count updates before the router.refresh round-trip.
      setLocalByKey((prev) => {
        const next = new Map(prev);
        const cur = next.get(lineItemKey);
        if (cur) {
          next.set(lineItemKey, {
            ...cur,
            photoCount: cur.photoCount + 1,
          });
        }
        return next;
      });
      setUploadingByKey((prev) => {
        const next = new Map(prev);
        next.delete(lineItemKey);
        return next;
      });
      router.refresh();
    } catch (err) {
      setUploadingByKey((prev) => {
        const next = new Map(prev);
        next.set(lineItemKey, (err as Error).message);
        return next;
      });
    }
  }

  return (
    <div className="in-content">
      <div className="in-page-hdr">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            href={`${portalBase}/inspections`}
            className="in-btn sm ghost"
          >
            {Icon.back} Back
          </Link>
          <div className="in-crumbs">
            <span>Inspections</span>
            {Icon.chevR}
            <strong>{detail.numberLabel}</strong>
          </div>
        </div>
        <div className="in-page-actions">
          <StatusPill
            status={detail.status}
            passRate={detail.passRate}
            progressCount={recordedCount}
            itemCount={itemCount}
          />
        </div>
      </div>

      <div className="in-detail">
        <div className="in-detail-main">
          <div className="in-detail-hdr-card">
            <div className="in-detail-hdr-top">
              <div className="in-detail-hdr-title">
                <span className="in-detail-hdr-num">{detail.numberLabel}</span>
                <h2 className="in-detail-hdr-name">{detail.templateName}</h2>
                <div className="in-detail-hdr-meta">
                  <span className="in-detail-hdr-meta-item">
                    <TradeBadge trade={detail.templateTradeCategory} />
                  </span>
                  <span className="in-detail-hdr-meta-item">
                    {Icon.tag}{" "}
                    <strong>{detail.zone}</strong>
                  </span>
                  <span className="in-detail-hdr-meta-item">
                    {Icon.user}{" "}
                    <strong>{detail.assignedOrgName ?? "Unassigned"}</strong>
                    {detail.assignedUserName
                      ? ` · ${detail.assignedUserName}`
                      : ""}
                  </span>
                  <span className="in-detail-hdr-meta-item">
                    {Icon.calendar} Scheduled{" "}
                    <strong>{formatDateShort(detail.scheduledDate)}</strong>
                  </span>
                  {detail.completedAt && (
                    <span className="in-detail-hdr-meta-item">
                      {Icon.check} Completed{" "}
                      <strong>{formatDateShort(detail.completedAt)}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {recordedCount > 0 && (
              <>
                <div className="in-detail-summary">
                  <div className="in-summary-cell">
                    <div className="in-summary-cell-top">
                      <span className="in-summary-cell-label">Pass</span>
                      <OutcomeIcon outcome="pass" />
                    </div>
                    <div className="in-summary-cell-val ok">{counts.pass}</div>
                  </div>
                  <div className="in-summary-cell">
                    <div className="in-summary-cell-top">
                      <span className="in-summary-cell-label">Fail</span>
                      <OutcomeIcon outcome="fail" />
                    </div>
                    <div className="in-summary-cell-val er">{counts.fail}</div>
                  </div>
                  <div className="in-summary-cell">
                    <div className="in-summary-cell-top">
                      <span className="in-summary-cell-label">Conditional</span>
                      <OutcomeIcon outcome="conditional" />
                    </div>
                    <div className="in-summary-cell-val wr">{counts.cond}</div>
                  </div>
                  <div className="in-summary-cell">
                    <div className="in-summary-cell-top">
                      <span className="in-summary-cell-label">N/A</span>
                      <OutcomeIcon outcome="na" />
                    </div>
                    <div className="in-summary-cell-val na">{counts.na}</div>
                  </div>
                </div>
                <div
                  className="in-prog"
                  title={
                    detail.passRate != null ? `${detail.passRate}% pass rate` : ""
                  }
                >
                  <div
                    className="in-prog-seg ok"
                    style={{
                      width: `${(counts.pass / Math.max(itemCount, 1)) * 100}%`,
                    }}
                  />
                  <div
                    className="in-prog-seg er"
                    style={{
                      width: `${(counts.fail / Math.max(itemCount, 1)) * 100}%`,
                    }}
                  />
                  <div
                    className="in-prog-seg wr"
                    style={{
                      width: `${(counts.cond / Math.max(itemCount, 1)) * 100}%`,
                    }}
                  />
                  <div
                    className="in-prog-seg na"
                    style={{
                      width: `${(counts.na / Math.max(itemCount, 1)) * 100}%`,
                    }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="in-items">
            <div className="in-items-hdr">
              <h3>
                Line items · {itemCount}
                {!isCompleted && recordedCount > 0 ? (
                  <span
                    style={{
                      fontWeight: 540,
                      color: "var(--text-tertiary)",
                      fontSize: 12,
                      marginLeft: 8,
                    }}
                  >
                    ({recordedCount} recorded)
                  </span>
                ) : null}
              </h3>
              {isCompleted ? (
                <span
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-tertiary)",
                    fontWeight: 540,
                  }}
                >
                  Read-only — inspection completed
                </span>
              ) : isCancelled ? (
                <span
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-tertiary)",
                    fontWeight: 540,
                  }}
                >
                  Cancelled
                </span>
              ) : detail.canComplete ? (
                <button
                  type="button"
                  className="in-btn sm primary"
                  onClick={completeInspection}
                  disabled={isCompleting}
                >
                  {Icon.check}{" "}
                  {isCompleting ? "Completing…" : "Complete inspection"}
                </button>
              ) : null}
            </div>

            {detail.lineItems.map((li, idx) => {
              const local = localByKey.get(li.key);
              const outcome: InspectionOutcome | null =
                local?.outcome ?? li.result?.outcome ?? null;
              const notes = local?.notes ?? li.result?.notes ?? "";
              return (
                <div key={li.key} className="in-item">
                  <OutcomeIcon outcome={outcome} />
                  <div className="in-item-body">
                    <div className="in-item-label">
                      {idx + 1}. {li.label}
                    </div>
                    {li.ref ? <div className="in-item-ref">{li.ref}</div> : null}
                    {(outcome === "fail" || outcome === "conditional") && (
                      <NoteEditor
                        value={notes ?? ""}
                        readOnly={isReadOnly || !detail.canEdit}
                        outcome={outcome}
                        onCommit={(v) => saveNotes(li.key, v)}
                      />
                    )}
                    {(() => {
                      const photoCount =
                        local?.photoCount ?? li.result?.photoCount ?? 0;
                      const resultId = li.result?.id ?? null;
                      const canUpload =
                        !!resultId && detail.canEdit && !isReadOnly;
                      const uploadErr = uploadingByKey.get(li.key);
                      const isUploading = uploadingByKey.has(li.key);
                      if (
                        photoCount === 0 &&
                        !li.result?.linkedPunchLabel &&
                        !canUpload
                      )
                        return null;
                      return (
                        <div className="in-item-extras">
                          {photoCount > 0 && (
                            <span className="in-item-photos">
                              {Icon.camera}
                              {photoCount} photo
                              {photoCount > 1 ? "s" : ""}
                            </span>
                          )}
                          {canUpload && (
                            <>
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                ref={(el) => {
                                  fileInputRefs.current.set(li.key, el);
                                }}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file && resultId) {
                                    onPhotoSelected(li.key, resultId, file);
                                  }
                                  e.target.value = "";
                                }}
                              />
                              <button
                                type="button"
                                className="in-item-photos"
                                style={{ cursor: "pointer", border: "none" }}
                                onClick={() =>
                                  fileInputRefs.current.get(li.key)?.click()
                                }
                                disabled={isUploading && !uploadErr}
                              >
                                {Icon.camera}
                                {isUploading && !uploadErr
                                  ? "Uploading…"
                                  : "Add photo"}
                              </button>
                            </>
                          )}
                          {li.result?.linkedPunchLabel &&
                            li.result.linkedPunchId && (
                              <Link
                                href={`${portalBase}/punch-list`}
                                className="in-item-punch-link"
                              >
                                {Icon.link}
                                {li.result.linkedPunchLabel}
                              </Link>
                            )}
                          {uploadErr && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "var(--danger)",
                                fontWeight: 540,
                              }}
                            >
                              {uploadErr}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    {local?.error && (
                      <div
                        className="in-err"
                        style={{ padding: 6, fontSize: 11.5, marginTop: 6 }}
                      >
                        {local.error}
                      </div>
                    )}
                  </div>
                  <div className="in-outcome-group">
                    {(
                      [
                        ["pass", "active-pass", Icon.check, "Pass"],
                        ["fail", "active-fail", Icon.x, "Fail"],
                        ["conditional", "active-cond", Icon.warn, "Conditional"],
                        ["na", "active-na", Icon.dash, "N/A"],
                      ] as Array<
                        [InspectionOutcome, string, React.ReactNode, string]
                      >
                    ).map(([key, activeClass, icon, title]) => (
                      <button
                        key={key}
                        type="button"
                        title={title}
                        className={`in-outcome-btn${outcome === key ? ` ${activeClass}` : ""}`}
                        disabled={
                          isReadOnly ||
                          !detail.canEdit ||
                          (local?.saving ?? false)
                        }
                        onClick={() => recordOutcome(li.key, key)}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {completeError && <div className="in-err">{completeError}</div>}
        </div>

        <aside className="in-rail">
          {detail.linkedPunches.length > 0 && (
            <div className="in-punch-card">
              <div className="in-punch-card-hdr">
                <h4>
                  <span className="er-dot" /> Auto-generated punch items
                </h4>
                <span
                  className="in-rate-pill fail"
                  style={{ fontSize: 11 }}
                >
                  <span className="in-rate-val">
                    {detail.linkedPunches.length}
                  </span>
                </span>
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  color: "var(--text-secondary)",
                  marginBottom: 12,
                  lineHeight: 1.4,
                }}
              >
                Fail and conditional outcomes are converted to punch items on
                completion. Assigned back to the sub for correction.
              </div>
              {detail.linkedPunches.map((p) => (
                <Link
                  href={`${portalBase}/punch-list`}
                  key={p.id}
                  className="in-punch-item"
                >
                  <div className="in-punch-item-top">
                    <span className="in-punch-item-num">{p.label}</span>
                    <span className={`in-punch-prio ${p.priority}`}>
                      {p.priority}
                    </span>
                  </div>
                  <div className="in-punch-item-title">{p.title}</div>
                  <div className="in-punch-item-meta">
                    <span>{p.assigneeOrgName ?? "—"}</span>
                    <span>
                      {p.dueDate ? `Due ${formatDateShort(p.dueDate)}` : p.status}
                    </span>
                  </div>
                </Link>
              ))}
              {portal === "contractor" && (
                <Link
                  href={`${portalBase}/punch-list`}
                  className="in-btn sm"
                  style={{
                    width: "100%",
                    justifyContent: "center",
                    marginTop: 4,
                  }}
                >
                  Open in punch list {Icon.chevR}
                </Link>
              )}
            </div>
          )}

          <div className="in-rail-card">
            <div className="in-rail-hdr">
              <h4>{Icon.clock} Timeline</h4>
            </div>
            {detail.timeline.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                No activity yet.
              </div>
            ) : (
              detail.timeline.map((t, i) => (
                <div className="in-rail-item" key={`${t.when}-${i}`}>
                  <div
                    className={`in-rail-item-avatar${t.kind === "punch_created" ? " punch" : t.actorName ? "" : " sys"}`}
                  >
                    {t.kind === "punch_created"
                      ? Icon.link
                      : t.actorName
                        ? t.actorName
                            .split(" ")
                            .map((w) => w[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        : "S"}
                  </div>
                  <div className="in-rail-item-body">
                    <div className="in-rail-item-text">{t.body}</div>
                    {t.targetLabel ? (
                      <div className="in-rail-item-target">{t.targetLabel}</div>
                    ) : null}
                    <div className="in-rail-item-when">
                      {formatDateLong(t.when)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function NoteEditor({
  value,
  readOnly,
  outcome,
  onCommit,
}: {
  value: string;
  readOnly: boolean;
  outcome: "fail" | "conditional";
  onCommit: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  if (readOnly) {
    if (!value) return null;
    return (
      <div className={`in-item-note ${outcome === "fail" ? "fail" : "cond"}`}>
        {value}
      </div>
    );
  }
  return (
    <div style={{ marginTop: 8 }}>
      <textarea
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (local !== value) onCommit(local);
        }}
        placeholder={
          outcome === "fail"
            ? "Note required — describe issue, location, corrective action…"
            : "Note describing the conditional…"
        }
        className="in-mobile-note"
        style={{ minHeight: 60, fontSize: 12.5 }}
      />
    </div>
  );
}
