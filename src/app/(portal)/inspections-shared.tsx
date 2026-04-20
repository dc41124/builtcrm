// Shared inline SVG icons + visual primitives used by the inspection
// workspace, detail, mobile walk-through, and template library pages.
// Copied 1:1 from docs/specs/builtcrm_inspections_module.jsx so the
// prototype visual spec stays authoritative.

import type { InspectionStatus, InspectionOutcome } from "@/domain/loaders/inspections";

export const TRADE_COLORS: Record<
  string,
  { solid: string; soft: string; label: string }
> = {
  framing: { solid: "#9c6240", soft: "rgba(156,98,64,.12)", label: "Framing" },
  electrical: {
    solid: "#c48a1a",
    soft: "rgba(196,138,26,.12)",
    label: "Electric",
  },
  plumbing: {
    solid: "#3878a8",
    soft: "rgba(56,120,168,.12)",
    label: "Plumbing",
  },
  hvac: { solid: "#2e8a82", soft: "rgba(46,138,130,.12)", label: "HVAC" },
  insulation: {
    solid: "#6b6b6b",
    soft: "rgba(107,107,107,.12)",
    label: "Insul.",
  },
  drywall: {
    solid: "#6b5d8c",
    soft: "rgba(107,93,140,.12)",
    label: "Drywall",
  },
  general: {
    solid: "#5b7a6a",
    soft: "rgba(91,122,106,.12)",
    label: "General",
  },
};

export function tradeAppearance(trade: string) {
  return TRADE_COLORS[trade] ?? TRADE_COLORS.general;
}

// -----------------------------------------------------------------------------
// Inline SVG icons
// -----------------------------------------------------------------------------

export const Icon = {
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
  ),
  check: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
  ),
  x: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
  ),
  warn: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
  ),
  dash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
  ),
  clipboard: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h6a2 2 0 0 1 2 2v2H7V4a2 2 0 0 1 2-2z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h4"/></svg>
  ),
  calendar: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
  ),
  user: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  camera: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
  ),
  filter: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
  ),
  search: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  ),
  chevR: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
  ),
  chevL: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
  ),
  back: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
  ),
  clock: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 6 12 12 15 14"/></svg>
  ),
  link: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L11.75 5.17"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  ),
  tag: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
  ),
  trash: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
  ),
  copy: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  ),
  archive: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
  ),
  grip: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>
  ),
  phone: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
  ),
};

// -----------------------------------------------------------------------------
// Visual primitives
// -----------------------------------------------------------------------------

export function TradeBadge({ trade }: { trade: string }) {
  const t = tradeAppearance(trade);
  return (
    <span
      className="in-trade-badge"
      style={{ background: t.soft, color: t.solid }}
    >
      <span className="in-trade-dot" style={{ background: t.solid }} />
      {t.label}
    </span>
  );
}

export function OutcomeIcon({
  outcome,
}: {
  outcome: InspectionOutcome | null;
}) {
  if (outcome === "pass")
    return <span className="in-oc in-oc-pass">{Icon.check}</span>;
  if (outcome === "fail")
    return <span className="in-oc in-oc-fail">{Icon.x}</span>;
  if (outcome === "conditional")
    return <span className="in-oc in-oc-cond">{Icon.warn}</span>;
  if (outcome === "na") return <span className="in-oc in-oc-na">{Icon.dash}</span>;
  return <span className="in-oc in-oc-pending" />;
}

export function PassRatePill({
  rate,
  size = "md",
}: {
  rate: number | null;
  size?: "md" | "sm";
}) {
  if (rate == null) {
    return (
      <span className={`in-rate-pill in-rate-pill-${size} none`}>—</span>
    );
  }
  const color = rate >= 95 ? "ok" : rate >= 85 ? "warn" : "fail";
  return (
    <span className={`in-rate-pill in-rate-pill-${size} ${color}`}>
      <span className="in-rate-val">{rate}%</span>
      {size !== "sm" && <span className="in-rate-lbl">pass</span>}
    </span>
  );
}

export function StatusPill({
  status,
  passRate,
  progressCount,
  itemCount,
}: {
  status: InspectionStatus;
  passRate?: number | null;
  progressCount?: number;
  itemCount?: number;
}) {
  if (status === "scheduled") {
    return (
      <span className="in-stat-pill sched">
        {Icon.calendar}Scheduled
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="in-stat-pill prog">
        {Icon.clock}In progress · {progressCount ?? 0}/{itemCount ?? 0}
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="in-stat-pill done">
        {Icon.check}Completed
        {passRate != null && (
          <span className="in-stat-rate">· {passRate}%</span>
        )}
      </span>
    );
  }
  return <span className="in-stat-pill cancelled">Cancelled</span>;
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatDateLong(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// -----------------------------------------------------------------------------
// Photo upload helper — three-step flow (presign → PUT → finalize → link).
// Mirrors the punch-item photo flow so the patterns stay consistent.
// -----------------------------------------------------------------------------

export async function uploadInspectionPhoto(input: {
  file: File;
  projectId: string;
  inspectionResultId: string;
  caption?: string;
}): Promise<{ photoId: string }> {
  const { file, projectId, inspectionResultId, caption } = input;
  const contentType = file.type || "application/octet-stream";

  const reqRes = await fetch("/api/upload/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      filename: file.name,
      contentType,
      documentType: "inspection_photo",
    }),
  });
  if (!reqRes.ok) throw new Error("Upload presign failed");
  const { uploadUrl, storageKey } = (await reqRes.json()) as {
    uploadUrl: string;
    storageKey: string;
  };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!putRes.ok) throw new Error("Upload failed");

  const finRes = await fetch("/api/upload/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      storageKey,
      title: file.name,
      documentType: "inspection_photo",
      visibilityScope: "project_wide",
      audienceScope: "internal",
    }),
  });
  if (!finRes.ok) throw new Error("Finalize failed");
  const { documentId } = (await finRes.json()) as { documentId: string };

  const linkRes = await fetch("/api/inspection-photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inspectionResultId,
      documentId,
      caption: caption ?? null,
    }),
  });
  if (!linkRes.ok) throw new Error("Link failed");
  const { id } = (await linkRes.json()) as { id: string };
  return { photoId: id };
}
