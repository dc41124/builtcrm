"use client";

import { useEffect, useRef } from "react";

import type { SafetyTemplateField } from "@/db/schema";

// Re-export the pure icon/config/badge helpers from the non-client module.
// Server components must import directly from `safety-forms-icons.tsx` —
// importing them via this re-export still routes through the "use client"
// boundary, which would defeat the split.
export {
  Icon,
  FieldTypeIcon,
  FormTypeBadge,
  StatusPill,
  SeverityPill,
  SAFETY_FORM_TYPE_CONFIG,
  SAFETY_SEVERITY_CONFIG,
} from "./safety-forms-icons";
export type {
  SafetyFormType,
  SafetySeverity,
} from "./safety-forms-icons";

import {
  Icon,
  SAFETY_SEVERITY_CONFIG,
  type SafetySeverity,
} from "./safety-forms-icons";

// ─────────────────────────────────────────────────────────────────────────
// SignaturePad — pointer events, mouse + touch. Verbatim from prototype.
// Emits a base64 data URL on draw via onChange so the parent can store it
// in form data (per Decision-2: signatures stored inline).
// ─────────────────────────────────────────────────────────────────────────

export function SignaturePad({
  value,
  onChange,
  dark = false,
}: {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  dark?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef<boolean>(false);
  const lastRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dirtyRef = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = dark ? "#f1efea" : "#1a1a1a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [dark]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastRef.current = getPos(e);
  };

  const move: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastRef.current.x, lastRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastRef.current = pos;
    dirtyRef.current = true;
  };

  const end: React.PointerEventHandler<HTMLCanvasElement> = (e) => {
    drawingRef.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore — pointer wasn't captured
    }
    if (dirtyRef.current && canvasRef.current) {
      onChange(canvasRef.current.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    dirtyRef.current = false;
    onChange(null);
  };

  return (
    <div className="sf-sig-wrap">
      <canvas
        ref={canvasRef}
        className="sf-sig-canvas"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className="sf-sig-meta">
        <span>{value ? "Signed" : "Sign with finger or mouse"}</span>
        <button type="button" className="sf-sig-clear" onClick={clear} disabled={!value}>
          {Icon.refresh} Clear
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Field renderer — the wizard / admin form uses this to render any field
// type. `value` is whatever the user has entered so far, type-narrow at
// the call site or pass through unknown.
// ─────────────────────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: SafetyTemplateField;
  value: unknown;
  onChange: (next: unknown) => void;
}

export function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  switch (field.type) {
    case "text":
      return (
        <input
          className="sf-input"
          type="text"
          placeholder="Type your answer…"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "textarea":
      return (
        <textarea
          className="sf-textarea"
          placeholder="Type your answer…"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "datetime":
      return (
        <input
          className="sf-input"
          type="datetime-local"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "select":
      return (
        <select
          className="sf-select"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Choose…</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {field.key === "severity" && opt in SAFETY_SEVERITY_CONFIG
                ? SAFETY_SEVERITY_CONFIG[opt as SafetySeverity].label
                : opt}
            </option>
          ))}
        </select>
      );

    case "checklist": {
      const arr = (value as string[]) ?? [];
      return (
        <div className="sf-checklist">
          {(field.options ?? []).map((opt) => {
            const isOn = arr.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                className={`sf-check${isOn ? " active" : ""}`}
                onClick={() =>
                  onChange(
                    isOn ? arr.filter((x) => x !== opt) : [...arr, opt],
                  )
                }
              >
                <span className="sf-check-box">{isOn && Icon.check}</span>
                <span className="sf-check-label">{opt}</span>
              </button>
            );
          })}
        </div>
      );
    }

    case "attendees": {
      const arr = (value as string[]) ?? [];
      const sample = ["Marcus Chen", "Tomás Ortega", "Jen Park", "Ben Rodriguez", "Mike Sullivan", "Priya Shah", "Jose Ramirez", "Alex Kim", "Dan Carter"];
      return (
        <>
          {arr.map((name, i) => (
            <div key={i} className="sf-list-row">
              <span className="sf-list-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="sf-list-text">{name}</span>
              <span className="sf-attendee-signed">SIGNED IN</span>
              <button
                type="button"
                className="sf-list-x"
                onClick={() => onChange(arr.filter((_, idx) => idx !== i))}
              >
                {Icon.x}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="sf-list-add"
            onClick={() => onChange([...arr, sample[arr.length % sample.length]])}
          >
            {Icon.plus} Add attendee
          </button>
        </>
      );
    }

    case "people": {
      const arr = (value as Array<{ name?: string; injury?: string }>) ?? [];
      return (
        <>
          {arr.map((p, i) => (
            <div key={i} className="sf-injured-card" style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div className="sf-injured-card-name">{p.name || `Person ${i + 1}`}</div>
                <button
                  type="button"
                  className="sf-list-x"
                  style={{ marginTop: -4 }}
                  onClick={() => onChange(arr.filter((_, idx) => idx !== i))}
                >
                  {Icon.x}
                </button>
              </div>
              <input
                className="sf-input"
                style={{ height: 36, marginTop: 6, fontSize: 13 }}
                placeholder="Name"
                value={p.name ?? ""}
                onChange={(e) => {
                  const next = [...arr];
                  next[i] = { ...next[i], name: e.target.value };
                  onChange(next);
                }}
              />
              <input
                className="sf-input"
                style={{ height: 36, marginTop: 6, fontSize: 13 }}
                placeholder="Body part / nature of injury"
                value={p.injury ?? ""}
                onChange={(e) => {
                  const next = [...arr];
                  next[i] = { ...next[i], injury: e.target.value };
                  onChange(next);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="sf-list-add"
            onClick={() => onChange([...arr, { name: "", injury: "" }])}
          >
            {Icon.plus} Add affected person
          </button>
        </>
      );
    }

    case "hazards": {
      const arr = (value as Array<{ hazard?: string; control?: string }>) ?? [];
      return (
        <>
          {arr.map((h, i) => (
            <div key={i} className="sf-hazard-row">
              <div className="sf-hazard-row-hdr">
                <span className="sf-hazard-row-num">Hazard {i + 1}</span>
                <button
                  type="button"
                  className="sf-list-x"
                  onClick={() => onChange(arr.filter((_, idx) => idx !== i))}
                >
                  {Icon.x}
                </button>
              </div>
              <textarea
                className="sf-textarea"
                style={{ minHeight: 50 }}
                placeholder="Hazard description (e.g., fall from height, energized circuit…)"
                value={h.hazard ?? ""}
                onChange={(e) => {
                  const next = [...arr];
                  next[i] = { ...next[i], hazard: e.target.value };
                  onChange(next);
                }}
              />
              <textarea
                className="sf-textarea"
                style={{ minHeight: 50 }}
                placeholder="Control measure (e.g., harness + lifeline, LOTO + voltage test…)"
                value={h.control ?? ""}
                onChange={(e) => {
                  const next = [...arr];
                  next[i] = { ...next[i], control: e.target.value };
                  onChange(next);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="sf-list-add"
            onClick={() => onChange([...arr, { hazard: "", control: "" }])}
          >
            {Icon.plus} Add hazard + control
          </button>
        </>
      );
    }

    case "actions": {
      const arr = (value as Array<{ action?: string; owner?: string; due?: string }>) ?? [];
      return (
        <>
          {arr.map((a, i) => (
            <div key={i} className="sf-hazard-row">
              <div className="sf-hazard-row-hdr">
                <span className="sf-hazard-row-num">Action {i + 1}</span>
                <button
                  type="button"
                  className="sf-list-x"
                  onClick={() => onChange(arr.filter((_, idx) => idx !== i))}
                >
                  {Icon.x}
                </button>
              </div>
              <textarea
                className="sf-textarea"
                style={{ minHeight: 50 }}
                placeholder="Corrective action…"
                value={a.action ?? ""}
                onChange={(e) => {
                  const next = [...arr];
                  next[i] = { ...next[i], action: e.target.value };
                  onChange(next);
                }}
              />
              <div style={{ display: "flex", gap: 7 }}>
                <input
                  className="sf-input"
                  style={{ height: 38, fontSize: 13, flex: 2 }}
                  placeholder="Owner"
                  value={a.owner ?? ""}
                  onChange={(e) => {
                    const next = [...arr];
                    next[i] = { ...next[i], owner: e.target.value };
                    onChange(next);
                  }}
                />
                <input
                  className="sf-input"
                  style={{ height: 38, fontSize: 13, flex: 1 }}
                  type="date"
                  value={a.due ?? ""}
                  onChange={(e) => {
                    const next = [...arr];
                    next[i] = { ...next[i], due: e.target.value };
                    onChange(next);
                  }}
                />
              </div>
            </div>
          ))}
          <button
            type="button"
            className="sf-list-add"
            onClick={() => onChange([...arr, { action: "", owner: "", due: "" }])}
          >
            {Icon.plus} Add corrective action
          </button>
        </>
      );
    }

    case "photo": {
      const arr = (value as string[]) ?? [];
      return (
        <>
          <button
            type="button"
            className="sf-photo-btn"
            title="Stub — see docs/specs/production_grade_upgrades/safety_v1_stubs.md §2"
            onClick={() =>
              // STEP 52 V1 STUB — emits a client-minted IMG_#### token.
              // Real camera capture + R2 upload chain is tracked in
              // docs/specs/production_grade_upgrades/safety_v1_stubs.md §2
              // (Photo capture in the wizard). The Step 51 producer for
              // safety_form_create will gain a 4-step R2 chain mirroring
              // dailyLogs.ts at that point.
              onChange([...arr, `IMG_${Math.floor(1000 + Math.random() * 9000)}`])
            }
          >
            {Icon.camera} {arr.length === 0 ? "Take photo" : "Add another photo"}
          </button>
          {arr.length > 0 && (
            <div className="sf-photo-thumbs">
              {arr.map((p, i) => (
                <div
                  key={i}
                  className="sf-photo-thumb"
                  onClick={() => onChange(arr.filter((_, idx) => idx !== i))}
                >
                  {Icon.camera}
                  <span className="sf-photo-thumb-num">{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </>
      );
    }

    case "signature":
      return (
        <SignaturePad
          value={(value as string) ?? null}
          onChange={(dataUrl) => onChange(dataUrl)}
        />
      );

    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Filled-state helper for required-validation + progress.
// ─────────────────────────────────────────────────────────────────────────

export function isFieldFilled(field: SafetyTemplateField, value: unknown): boolean {
  if (field.type === "signature") return typeof value === "string" && value.length > 0;
  if (field.type === "photo") return Array.isArray(value) && value.length > 0;
  if (
    field.type === "attendees" ||
    field.type === "people" ||
    field.type === "hazards" ||
    field.type === "actions"
  ) {
    return Array.isArray(value) && value.length > 0;
  }
  if (field.type === "checklist") return Array.isArray(value) && value.length > 0;
  return value !== undefined && value !== null && String(value).trim().length > 0;
}
