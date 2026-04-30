"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  FieldRenderer,
  FormTypeBadge,
  Icon,
  isFieldFilled,
  SAFETY_FORM_TYPE_CONFIG,
} from "@/app/(portal)/safety-forms-shared";
import type { SafetyFormTemplateRow } from "@/domain/loaders/safety-forms";

export function SafetyFormWizard({
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
    () => fields.filter((f) => f.required && isFieldFilled(f, data[f.key])).length,
    [fields, data],
  );
  const requiredCount = fields.filter((f) => f.required).length;
  const canSubmit = requiredCount > 0 && filledRequired === requiredCount;

  const updateField = (key: string, val: unknown) =>
    setData((d) => ({ ...d, [key]: val }));

  const buildTitle = (): string => {
    // Toolbox talks: "Daily Toolbox Talk — <topic>"
    if (template.formType === "toolbox_talk") {
      const topic = data.topic;
      if (typeof topic === "string" && topic.length > 0) {
        return `${template.name} — ${topic}`;
      }
    }
    // Incidents: severity + location
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
      // Step 51 outbox: queue when offline.
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
        router.push(`/subcontractor/project/${projectId}/safety-forms?queued=1`);
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
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        setError(data.message ?? data.error ?? "Failed to submit");
        return;
      }
      router.push(`/subcontractor/project/${projectId}/safety-forms?submitted=1`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentField) return null;

  return (
    <div className="sf-content">
      <div className="sf-page-hdr">
        <div>
          <button
            type="button"
            className="sf-btn ghost"
            onClick={() => {
              if (step === 0) router.back();
              else setStep(step - 1);
            }}
            style={{ marginBottom: 8 }}
          >
            {Icon.back} {step === 0 ? "Back to forms" : "Previous step"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FormTypeBadge type={template.formType} size="md" />
            <h1 className="sf-page-title" style={{ marginBottom: 0 }}>
              {template.name}
            </h1>
          </div>
        </div>
        <div className={`sf-conn-pill${isOnline ? "" : " offline"}`}>
          {isOnline ? Icon.cloud : Icon.cloudOff}
          {isOnline ? "Online · auto-saving" : "Offline · saving locally"}
        </div>
      </div>

      <div className="sf-wiz-prog">
        <div className="sf-wiz-prog-meta">
          <span>
            <strong style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 720 }}>
              Step {step + 1}
            </strong>{" "}
            of {fields.length}
          </span>
          <span>
            {Math.round(
              ((step + (isFieldFilled(currentField, data[currentField.key]) ? 1 : 0)) /
                fields.length) *
                100,
            )}
            % complete
          </span>
        </div>
        <div className="sf-wiz-prog-bar">
          <div
            className="sf-wiz-prog-fill"
            style={{
              width: `${((step + (isFieldFilled(currentField, data[currentField.key]) ? 1 : 0)) / fields.length) * 100}%`,
              background: cfg.solid,
            }}
          />
        </div>
      </div>

      <div className="sf-wiz-grid">
        <aside className="sf-wiz-rail">
          <div className="sf-wiz-rail-title">All steps</div>
          <div className="sf-wiz-rail-list">
            {fields.map((f, idx) => {
              const filled = isFieldFilled(f, data[f.key]);
              const isCur = idx === step;
              const cls = `sf-wiz-step${isCur ? " current" : ""}${filled && !isCur ? " done" : ""}`;
              return (
                <button
                  key={f.key}
                  type="button"
                  className={cls}
                  onClick={() => setStep(idx)}
                >
                  <span className="sf-wiz-step-num">
                    {filled && !isCur ? Icon.check : String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="sf-wiz-step-label">{f.label}</span>
                  {f.required && !filled && <span className="sf-wiz-step-req">•</span>}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="sf-wiz-card">
          <div className="sf-wiz-card-hdr">
            <div className="sf-wiz-card-meta">
              <span>
                Field {step + 1} of {fields.length}
              </span>
              {currentField.required && <span className="sf-wiz-card-req">Required</span>}
            </div>
            <div className="sf-wiz-card-label">{currentField.label}</div>
            {currentField.hint && <div className="sf-wiz-card-hint">{currentField.hint}</div>}
          </div>

          <div className="sf-wiz-card-body">
            <FieldRenderer
              field={currentField}
              value={data[currentField.key]}
              onChange={(v) => updateField(currentField.key, v)}
            />
            {error && (
              <div className="sf-err" style={{ marginTop: 12 }}>
                {error}
              </div>
            )}
          </div>

          <div className="sf-wiz-card-foot">
            <button
              type="button"
              className="sf-btn"
              onClick={() => {
                if (step === 0) router.back();
                else setStep(step - 1);
              }}
            >
              {Icon.chevL} {step === 0 ? "Cancel" : "Previous"}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {!isLast && !currentField.required && (
                <button type="button" className="sf-btn ghost" onClick={() => setStep(step + 1)}>
                  Skip for now
                </button>
              )}
              {!isLast && (
                <button
                  type="button"
                  className="sf-btn primary"
                  onClick={() => setStep(step + 1)}
                  disabled={
                    currentField.required && !isFieldFilled(currentField, data[currentField.key])
                  }
                >
                  Next {Icon.chevR}
                </button>
              )}
              {isLast && (
                <button
                  type="button"
                  className="sf-btn primary"
                  onClick={submit}
                  disabled={!canSubmit || submitting}
                >
                  {Icon.send} {submitting ? "Submitting…" : "Submit form"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
