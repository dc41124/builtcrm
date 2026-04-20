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
  formatDateShort,
  uploadInspectionPhoto,
} from "../../../../../inspections-shared";

type Props = {
  portalBase: string;
  detail: InspectionDetail;
};

type PendingState = Record<
  string,
  {
    outcome: InspectionOutcome;
    notes: string;
    resultId: string | null;
    photoCount: number;
    saving: boolean;
    error: string | null;
  }
>;

type UploadingState = Record<string, { error: string | null }>;

export function MobileWalkthrough({ portalBase, detail }: Props) {
  const router = useRouter();
  const orderedItems = useMemo(
    () =>
      [...detail.lineItems].sort(
        (a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0),
      ),
    [detail.lineItems],
  );
  const totalSteps = orderedItems.length;

  // Seed pending state from any existing results so a paused walk-through
  // picks up where it was.
  const [pending, setPending] = useState<PendingState>(() => {
    const out: PendingState = {};
    for (const li of orderedItems) {
      if (li.result) {
        out[li.key] = {
          outcome: li.result.outcome,
          notes: li.result.notes ?? "",
          resultId: li.result.id,
          photoCount: li.result.photoCount,
          saving: false,
          error: null,
        };
      }
    }
    return out;
  });
  const [uploading, setUploading] = useState<UploadingState>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<number>(() => {
    // Jump to the first unrecorded item if any; otherwise start at 0.
    const idx = orderedItems.findIndex((li) => !li.result);
    return idx === -1 ? 0 : idx;
  });
  const [completing, startComplete] = useTransition();
  const [completeError, setCompleteError] = useState<string | null>(null);

  const isCompleted = detail.status === "completed";
  const isCancelled = detail.status === "cancelled";
  const canEdit = detail.canEdit && !isCompleted && !isCancelled;

  const answeredCount = useMemo(() => {
    return orderedItems.filter((li) => pending[li.key]?.outcome).length;
  }, [orderedItems, pending]);

  const atReview = step >= totalSteps;
  const currentItem = orderedItems[step];

  async function saveOutcome(
    lineItemKey: string,
    outcome: InspectionOutcome,
    notes: string,
  ) {
    const prevState = pending[lineItemKey];
    setPending((prev) => ({
      ...prev,
      [lineItemKey]: {
        outcome,
        notes,
        resultId: prevState?.resultId ?? null,
        photoCount: prevState?.photoCount ?? 0,
        saving: true,
        error: null,
      },
    }));
    try {
      const res = await fetch("/api/inspection-results", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inspectionId: detail.id,
          lineItemKey,
          outcome,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "Failed to save");
      }
      const body = (await res.json()) as { id: string; outcome: string };
      setPending((prev) => ({
        ...prev,
        [lineItemKey]: {
          outcome,
          notes,
          resultId: body.id,
          photoCount: prevState?.photoCount ?? 0,
          saving: false,
          error: null,
        },
      }));
    } catch (err) {
      setPending((prev) => ({
        ...prev,
        [lineItemKey]: {
          outcome,
          notes,
          resultId: prevState?.resultId ?? null,
          photoCount: prevState?.photoCount ?? 0,
          saving: false,
          error: (err as Error).message,
        },
      }));
    }
  }

  async function onPhotoSelected(lineItemKey: string, file: File) {
    const cur = pending[lineItemKey];
    if (!cur?.resultId) return;
    setUploading((prev) => ({
      ...prev,
      [lineItemKey]: { error: null },
    }));
    try {
      await uploadInspectionPhoto({
        file,
        projectId: detail.project.id,
        inspectionResultId: cur.resultId,
      });
      setPending((prev) => ({
        ...prev,
        [lineItemKey]: {
          ...cur,
          photoCount: (cur.photoCount ?? 0) + 1,
        },
      }));
      setUploading((prev) => {
        const next = { ...prev };
        delete next[lineItemKey];
        return next;
      });
      router.refresh();
    } catch (err) {
      setUploading((prev) => ({
        ...prev,
        [lineItemKey]: { error: (err as Error).message },
      }));
    }
  }

  function pickOutcome(outcome: InspectionOutcome) {
    if (!currentItem) return;
    const existing = pending[currentItem.key];
    saveOutcome(currentItem.key, outcome, existing?.notes ?? "");
  }

  function onNotesChange(notes: string) {
    if (!currentItem) return;
    const existing = pending[currentItem.key];
    if (!existing) return;
    setPending((prev) => ({
      ...prev,
      [currentItem.key]: { ...existing, notes },
    }));
  }

  function commitNotes() {
    if (!currentItem) return;
    const existing = pending[currentItem.key];
    if (!existing?.outcome) return;
    saveOutcome(currentItem.key, existing.outcome, existing.notes);
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
          setCompleteError(body.message ?? "Failed to complete");
          return;
        }
        router.refresh();
      } catch (err) {
        setCompleteError((err as Error).message);
      }
    });
  }

  // If this is already completed or cancelled, render a read-only summary.
  if (isCompleted || isCancelled) {
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
        </div>
        <div className="in-mobile-wrap">
          <div className="in-mobile-frame">
            <div className="in-mobile-hdr">
              <div className="in-mobile-hdr-top">
                <span>{detail.numberLabel}</span>
                <span>{isCompleted ? "Complete" : "Cancelled"}</span>
              </div>
              <div className="in-mobile-hdr-title">{detail.templateName}</div>
              <div className="in-mobile-hdr-sub">
                {detail.zone}
                {detail.completedAt
                  ? ` · completed ${formatDateShort(detail.completedAt)}`
                  : ""}
              </div>
            </div>
            <div className="in-mobile-done">
              <div className="in-mobile-done-icon">{Icon.check}</div>
              <div>
                <h3>Inspection submitted</h3>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    marginTop: 6,
                  }}
                >
                  Submitted to{" "}
                  {detail.project.name} project team for review.
                </div>
              </div>
              <div className="in-mobile-done-stats">
                <Stat
                  n={detail.passCount}
                  label="Pass"
                  color="var(--success)"
                />
                <Stat
                  n={detail.failCount}
                  label="Fail"
                  color="var(--danger)"
                />
                <Stat
                  n={detail.conditionalCount}
                  label="Cond"
                  color="var(--warning)"
                />
                <Stat n={detail.naCount} label="N/A" color="#8a8a8a" />
              </div>
              {detail.linkedPunches.length > 0 && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                    lineHeight: 1.5,
                    marginTop: 4,
                  }}
                >
                  {detail.linkedPunches.length} punch item
                  {detail.linkedPunches.length === 1 ? "" : "s"} auto-created
                  for your crew to correct.
                </div>
              )}
            </div>
            <div className="in-mobile-nav">
              <Link
                href={`${portalBase}/inspections`}
                className="in-btn"
                style={{ flex: 1, justifyContent: "center", height: 40 }}
              >
                {Icon.back} Back to list
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentOutcome = currentItem
    ? pending[currentItem.key]?.outcome ?? null
    : null;
  const currentNotes = currentItem
    ? pending[currentItem.key]?.notes ?? ""
    : "";

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
      </div>

      <div className="in-sub-banner">
        {Icon.phone}
        <span>
          Walk-through mode. Tap an outcome, add a note if needed, then move on.
          Fail / conditional items require a note.
        </span>
      </div>

      <div className="in-mobile-wrap">
        <div className="in-mobile-frame">
          <div className="in-mobile-hdr">
            <div className="in-mobile-hdr-top">
              <span>
                {detail.numberLabel} · {detail.project.name}
              </span>
              <span>
                {atReview ? "Review" : `${step + 1} of ${totalSteps}`}
              </span>
            </div>
            <div className="in-mobile-hdr-title">{detail.templateName}</div>
            <div className="in-mobile-hdr-sub">
              {detail.zone}
              {detail.scheduledDate
                ? ` · scheduled ${formatDateShort(detail.scheduledDate)}`
                : ""}
            </div>
            <div className="in-mobile-prog">
              <div
                className="in-mobile-prog-fill"
                style={{
                  width: `${totalSteps ? (answeredCount / totalSteps) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          {atReview ? (
            <ReviewScreen
              answeredCount={answeredCount}
              totalSteps={totalSteps}
              pending={pending}
              onBack={() => setStep(totalSteps - 1)}
              onComplete={completeInspection}
              completing={completing}
              completeError={completeError}
              canEdit={canEdit}
            />
          ) : currentItem ? (
            <>
              <div className="in-mobile-body">
                <div className="in-mobile-step-info">
                  <span>
                    Item {step + 1} of {totalSteps}
                  </span>
                  {currentItem.ref ? (
                    <span className="in-mobile-step-ref">
                      {currentItem.ref}
                    </span>
                  ) : null}
                </div>
                <div className="in-mobile-item-label">{currentItem.label}</div>

                <div className="in-mobile-outcomes">
                  {(
                    [
                      ["pass", "Pass"],
                      ["fail", "Fail"],
                      ["conditional", "Conditional"],
                      ["na", "N/A"],
                    ] as Array<[InspectionOutcome, string]>
                  ).map(([key, label]) => {
                    const active = currentOutcome === key;
                    return (
                      <button
                        type="button"
                        key={key}
                        className={`in-mobile-out-btn${active ? ` active ${shortKey(key)}` : ""}`}
                        onClick={() => pickOutcome(key)}
                        disabled={!canEdit}
                      >
                        <OutcomeIcon outcome={key} />
                        <span className="in-mobile-out-btn-label">{label}</span>
                      </button>
                    );
                  })}
                </div>

                <textarea
                  className="in-mobile-note"
                  value={currentNotes}
                  onChange={(e) => onNotesChange(e.target.value)}
                  onBlur={commitNotes}
                  placeholder={
                    currentOutcome === "fail" || currentOutcome === "conditional"
                      ? "Note required for fail/conditional — describe issue, location, corrective action…"
                      : "Optional note…"
                  }
                  disabled={!canEdit}
                />

                {(() => {
                  const cur = pending[currentItem.key];
                  const hasResult = !!cur?.resultId;
                  const photoCount = cur?.photoCount ?? 0;
                  const uploadErr = uploading[currentItem.key]?.error ?? null;
                  const isUploading =
                    currentItem.key in uploading && !uploadErr;
                  return (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        ref={fileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onPhotoSelected(currentItem.key, file);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        className="in-mobile-photo-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!canEdit || !hasResult || isUploading}
                        title={
                          !hasResult
                            ? "Pick an outcome first, then you can attach a photo."
                            : undefined
                        }
                      >
                        {Icon.camera}
                        {isUploading
                          ? "Uploading…"
                          : photoCount > 0
                            ? `Add another photo · ${photoCount} attached`
                            : "Add photo"}
                      </button>
                      {uploadErr && (
                        <div className="in-err" style={{ fontSize: 12 }}>
                          {uploadErr}
                        </div>
                      )}
                    </>
                  );
                })()}

                {pending[currentItem.key]?.error && (
                  <div className="in-err" style={{ fontSize: 12 }}>
                    {pending[currentItem.key].error}
                  </div>
                )}
              </div>
              <div className="in-mobile-nav">
                <button
                  type="button"
                  className="in-btn"
                  onClick={() => setStep(Math.max(0, step - 1))}
                  disabled={step === 0}
                >
                  {Icon.chevL} Previous
                </button>
                <button
                  type="button"
                  className="in-btn primary"
                  onClick={() => setStep(step + 1)}
                  disabled={
                    !currentOutcome ||
                    ((currentOutcome === "fail" ||
                      currentOutcome === "conditional") &&
                      !currentNotes.trim())
                  }
                >
                  {step === totalSteps - 1 ? "Review" : "Next"} {Icon.chevR}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function shortKey(k: InspectionOutcome) {
  if (k === "pass") return "pass";
  if (k === "fail") return "fail";
  if (k === "conditional") return "cond";
  return "na";
}

function Stat({
  n,
  label,
  color,
}: {
  n: number;
  label: string;
  color: string;
}) {
  return (
    <div className="in-mobile-done-stat">
      <div className="in-mobile-done-stat-val" style={{ color }}>
        {n}
      </div>
      <div className="in-mobile-done-stat-lbl">{label}</div>
    </div>
  );
}

function ReviewScreen({
  answeredCount,
  totalSteps,
  pending,
  onBack,
  onComplete,
  completing,
  completeError,
  canEdit,
}: {
  answeredCount: number;
  totalSteps: number;
  pending: PendingState;
  onBack: () => void;
  onComplete: () => void;
  completing: boolean;
  completeError: string | null;
  canEdit: boolean;
}) {
  const summary = useMemo(() => {
    let pass = 0;
    let fail = 0;
    let cond = 0;
    let na = 0;
    for (const v of Object.values(pending)) {
      if (v.outcome === "pass") pass += 1;
      else if (v.outcome === "fail") fail += 1;
      else if (v.outcome === "conditional") cond += 1;
      else if (v.outcome === "na") na += 1;
    }
    return { pass, fail, cond, na };
  }, [pending]);

  const allAnswered = answeredCount === totalSteps;

  return (
    <>
      <div className="in-mobile-body">
        <div className="in-mobile-step-info">
          <span>Review & submit</span>
          <span className="in-mobile-step-ref">
            {answeredCount}/{totalSteps} answered
          </span>
        </div>
        <div className="in-mobile-done-stats">
          <Stat n={summary.pass} label="Pass" color="var(--success)" />
          <Stat n={summary.fail} label="Fail" color="var(--danger)" />
          <Stat n={summary.cond} label="Cond" color="var(--warning)" />
          <Stat n={summary.na} label="N/A" color="#8a8a8a" />
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            marginTop: 4,
          }}
        >
          {allAnswered
            ? "All items recorded. Submit to lock the inspection — any fail or conditional items will auto-create punch items for your crew."
            : `${totalSteps - answeredCount} item${totalSteps - answeredCount === 1 ? " is" : "s are"} still unanswered. Go back and record an outcome for each.`}
        </div>
        {completeError && (
          <div className="in-err" style={{ fontSize: 12 }}>
            {completeError}
          </div>
        )}
      </div>
      <div className="in-mobile-nav">
        <button type="button" className="in-btn" onClick={onBack}>
          {Icon.back} Back
        </button>
        <button
          type="button"
          className="in-btn primary"
          onClick={onComplete}
          disabled={!canEdit || !allAnswered || completing}
        >
          {completing ? "Submitting…" : "Submit inspection"}
        </button>
      </div>
    </>
  );
}
