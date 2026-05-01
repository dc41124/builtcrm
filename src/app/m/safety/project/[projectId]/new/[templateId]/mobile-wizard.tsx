"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  FieldRenderer,
  isFieldFilled,
  SAFETY_FORM_TYPE_CONFIG,
} from "@/app/(portal)/safety-forms-shared";
import type { SafetyFormTemplateRow } from "@/domain/loaders/safety-forms";

// Mobile PWA wizard for completing a safety form. One field per step,
// sticky bottom nav with Back / Next or Submit. Lifted from the
// prototype's "MOBILE · FORM (wizard)" section (lines 1705–1899).
//
// Reuses the `FieldRenderer` from safety-forms-shared so the renderer
// for each of the 11 field types stays in lockstep with the desktop
// wizard. The mobile-only wrapper handles layout, single-step display,
// progress, and submit.

export function MobileSafetyFormWizard({
  projectId,
  template,
}: {
  projectId: string;
  template: SafetyFormTemplateRow;
}) {
  const router = useRouter();
  const cfg = SAFETY_FORM_TYPE_CONFIG[template.formType];
  const fields = template.fields;

  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    const onOn = () => setIsOnline(true);
    const onOff = () => setIsOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  const currentField = fields[step];
  const isLast = step === fields.length - 1;

  const filledRequired = useMemo(
    () =>
      fields.filter((f) => f.required && isFieldFilled(f, data[f.key])).length,
    [fields, data],
  );
  const requiredCount = fields.filter((f) => f.required).length;
  const canSubmit = requiredCount > 0 && filledRequired === requiredCount;

  const updateField = (key: string, val: unknown) =>
    setData((d) => ({ ...d, [key]: val }));

  const buildTitle = (): string => {
    if (template.formType === "toolbox_talk") {
      const topic = data.topic;
      if (typeof topic === "string" && topic.length > 0) {
        return `${template.name} — ${topic}`;
      }
    }
    if (template.formType === "incident_report") {
      const loc = data.location;
      if (typeof loc === "string" && loc.length > 0) {
        return `Incident — ${loc}`;
      }
    }
    return template.name;
  };

  const buildIncidentPayload = () => {
    if (template.formType !== "incident_report") return undefined;
    return {
      severity: (data.severity as string) || "first_aid",
      incidentAt: (data.when as string) || new Date().toISOString(),
      location: (data.location as string) || "—",
      description: (data.description as string) ?? null,
      rootCauseText: (data.rootCause as string) ?? null,
      injured: Array.isArray(data.injured)
        ? (data.injured as Array<Record<string, unknown>>).map((p) => ({
            name: String(p.name ?? "—"),
            role: (p.role as string) ?? null,
            bodyPart: (p.bodyPart as string) ?? null,
            nature: (p.injury as string) ?? (p.nature as string) ?? null,
          }))
        : [],
      correctiveActions: Array.isArray(data.corrective)
        ? (data.corrective as Array<Record<string, unknown>>).map((c, i) => ({
            id: `ca-${i + 1}`,
            action: String(c.action ?? ""),
            owner: String(c.owner ?? ""),
            due: String(c.due ?? ""),
          }))
        : [],
      photoCount: Array.isArray(data.photo) ? data.photo.length : 0,
    };
  };

  const submit = async () => {
    setError(null);
    setSubmitting(true);

    const body = {
      projectId,
      templateId: template.id,
      status: "submitted" as const,
      title: buildTitle(),
      dataJson: data,
      flagged: false,
      incident: buildIncidentPayload(),
    };

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const { enqueueWrite } = await import("@/lib/offline/queue");
        const clientId = crypto.randomUUID();
        await enqueueWrite({
          clientId,
          kind: "safety_form_create",
          payload: {
            projectId,
            templateId: template.id,
            clientSubmittedAt: new Date().toISOString(),
            body,
          },
        });
        router.push(`/m/safety/project/${projectId}?queued=1`);
        return;
      }

      const res = await fetch("/api/safety-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          clientUuid: crypto.randomUUID(),
          clientSubmittedAt: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setError(j.message ?? j.error ?? "Failed to submit");
        return;
      }
      router.push(`/m/safety/project/${projectId}?submitted=1`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentField) return null;
  const progress =
    ((step + (isFieldFilled(currentField, data[currentField.key]) ? 1 : 0)) /
      fields.length) *
    100;

  return (
    <div className="sfm-page">
      <header className="sfm-hdr" style={{ background: cfg.solid }}>
        <div className="sfm-hdr-top">
          {step === 0 ? (
            <Link href={`/m/safety/project/${projectId}`} className="sfm-hdr-back">
              ← Cancel
            </Link>
          ) : (
            <button
              type="button"
              className="sfm-hdr-back"
              onClick={() => setStep(step - 1)}
            >
              ← Back
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>
              STEP {step + 1} / {fields.length}
            </span>
            <span
              className="sfm-net"
              style={{ background: isOnline ? "rgba(255,255,255,.22)" : "rgba(196,112,11,.9)" }}
            >
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        <h1 className="sfm-hdr-title" style={{ fontSize: 16 }}>
          {template.name}
        </h1>
        <div className="sfm-hdr-sub">{cfg.label}</div>
        <div className="sfm-prog">
          <div className="sfm-prog-fill" style={{ width: `${progress}%` }} />
        </div>
      </header>

      <div className="sfm-body">
        <div className="sfm-step-info">
          <span>
            Field {step + 1} of {fields.length}
          </span>
          {currentField.required && <span className="sfm-step-req">Required</span>}
        </div>
        <div className="sfm-item-label">{currentField.label}</div>
        {currentField.hint && (
          <div className="sfm-item-hint">{currentField.hint}</div>
        )}

        {/* Reuse the shared FieldRenderer — it already covers all 11
            field types (text/textarea/select/checklist/datetime/signature/
            photo/attendees/people/hazards/actions). The mobile chrome
            (.sfm-* classes) wraps it; the renderer reads from the
            existing safety-forms.css selectors via .sf-* classes. */}
        <div
          style={{
            // The shared renderer outputs .sf-* class names. Inject a
            // small adapter so mobile users still see the right widths
            // (the desktop CSS already targets these classes verbatim).
            // We also pull in the shared safety-forms.css below.
          }}
        >
          <FieldRenderer
            field={currentField}
            value={data[currentField.key]}
            onChange={(v) => updateField(currentField.key, v)}
          />
        </div>

        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(201,59,59,.11)",
              color: "#c93b3b",
              border: "1px solid rgba(201,59,59,.22)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Sticky bottom nav */}
      <nav className="sfm-nav">
        {step === 0 ? (
          <Link href={`/m/safety/project/${projectId}`} className="sfm-btn">
            Cancel
          </Link>
        ) : (
          <button
            type="button"
            className="sfm-btn"
            onClick={() => setStep(step - 1)}
          >
            ← Previous
          </button>
        )}
        {!isLast && (
          <button
            type="button"
            className="sfm-btn primary"
            onClick={() => setStep(step + 1)}
            disabled={
              currentField.required &&
              !isFieldFilled(currentField, data[currentField.key])
            }
          >
            Next →
          </button>
        )}
        {isLast && (
          <button
            type="button"
            className="sfm-btn primary"
            onClick={submit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        )}
      </nav>
    </div>
  );
}
