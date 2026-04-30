"use client";

import { useEffect, useRef } from "react";

import type {
  SafetyFieldType,
  SafetyTemplateField,
} from "@/db/schema";

// ─────────────────────────────────────────────────────────────────────────
// Form-type config — verbatim from the prototype's `formTypes` map.
// ─────────────────────────────────────────────────────────────────────────

export const SAFETY_FORM_TYPE_CONFIG = {
  toolbox_talk: {
    label: "Toolbox Talk",
    short: "Toolbox",
    solid: "#3878a8",
    soft: "rgba(56,120,168,.12)",
    desc: "Pre-shift safety briefing with crew sign-in.",
  },
  jha: {
    label: "JHA",
    short: "JHA",
    solid: "#9c6240",
    soft: "rgba(156,98,64,.12)",
    desc: "Job Hazard Analysis — hazards + controls per task.",
  },
  incident_report: {
    label: "Incident Report",
    short: "Incident",
    solid: "#c93b3b",
    soft: "rgba(201,59,59,.12)",
    desc: "Recordable injury, property damage, or release.",
  },
  near_miss: {
    label: "Near Miss",
    short: "Near Miss",
    solid: "#c4700b",
    soft: "rgba(196,112,11,.12)",
    desc: "Close-call event with no injury or damage.",
  },
} as const;

export type SafetyFormType = keyof typeof SAFETY_FORM_TYPE_CONFIG;

// ─────────────────────────────────────────────────────────────────────────
// Severity config — verbatim from the prototype's `severities` map.
// ─────────────────────────────────────────────────────────────────────────

export const SAFETY_SEVERITY_CONFIG = {
  first_aid: { label: "First Aid", color: "#3878a8" },
  recordable: { label: "Recordable", color: "#c4700b" },
  lost_time: { label: "Lost Time", color: "#c93b3b" },
  fatality: { label: "Fatality", color: "#7a1f1f" },
  property_damage: { label: "Property Damage", color: "#6b5d8c" },
  environmental: { label: "Environmental", color: "#2e8a82" },
} as const;

export type SafetySeverity = keyof typeof SAFETY_SEVERITY_CONFIG;

// ─────────────────────────────────────────────────────────────────────────
// Icons — inline SVG, no emoji per design system. Verbatim from prototype.
// ─────────────────────────────────────────────────────────────────────────

export const Icon = {
  plus: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  check: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  x: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  warn: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  shield: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  clipboard: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h4"/></svg>,
  calendar: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  user: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  users: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  camera: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  pen: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  filter: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  search: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  chevR: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>,
  chevL: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>,
  chevD: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  back: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>,
  bell: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"/></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  send: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>,
  edit: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  clock: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 15 14"/></svg>,
  cloud: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>,
  cloudOff: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  fileText: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  alert: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  flag: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
  copy: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  refresh: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>,
  history: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>,
} as const;

// ─────────────────────────────────────────────────────────────────────────
// Pills + badges — read-only UI tokens.
// ─────────────────────────────────────────────────────────────────────────

export function FormTypeBadge({
  type,
  size = "md",
}: {
  type: SafetyFormType;
  size?: "sm" | "md";
}) {
  const cfg = SAFETY_FORM_TYPE_CONFIG[type];
  if (!cfg) return null;
  return (
    <span
      className={`sf-type-badge${size === "sm" ? " sf-type-badge-sm" : ""}`}
      style={{ background: cfg.soft, color: cfg.solid, borderColor: cfg.soft }}
    >
      <span className="sf-type-dot" style={{ background: cfg.solid }} />
      {size === "sm" ? cfg.short : cfg.label}
    </span>
  );
}

export function StatusPill({
  status,
}: {
  status: "submitted" | "draft" | "queued";
}) {
  const map = {
    submitted: { label: "Submitted", cls: "ok" },
    draft: { label: "Draft", cls: "muted" },
    queued: { label: "Queued · offline", cls: "amber" },
  };
  const s = map[status] ?? map.submitted;
  return <span className={`sf-status-pill sf-status-${s.cls}`}>{s.label}</span>;
}

export function SeverityPill({
  severity,
  size = "md",
}: {
  severity: SafetySeverity | null | undefined;
  size?: "sm" | "md";
}) {
  if (!severity) return null;
  const cfg = SAFETY_SEVERITY_CONFIG[severity];
  if (!cfg) return null;
  return (
    <span
      className={`sf-sev-pill${size === "sm" ? " sf-sev-sm" : ""}`}
      style={{
        color: cfg.color,
        borderColor: cfg.color,
        background: `${cfg.color}14`,
      }}
    >
      {Icon.alert} {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Field icon — used in the template-detail field list.
// ─────────────────────────────────────────────────────────────────────────

export function FieldTypeIcon({ type }: { type: SafetyFieldType }) {
  switch (type) {
    case "text":
    case "textarea":
      return Icon.fileText;
    case "select":
      return Icon.chevD;
    case "checklist":
      return Icon.check;
    case "datetime":
      return Icon.calendar;
    case "signature":
      return Icon.pen;
    case "photo":
      return Icon.camera;
    case "attendees":
    case "people":
      return Icon.users;
    case "hazards":
      return Icon.warn;
    case "actions":
      return Icon.flag;
    default:
      return Icon.fileText;
  }
}

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
