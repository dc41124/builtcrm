"use client";

// Sheet detail viewer. Renders the PDF page via react-pdf (dynamically
// imported so the ~300KB pdfjs bundle only loads on this route) with an
// SVG overlay on top of the canvas for per-user markups, measurements,
// and numbered comment pins. V1 is read-only annotation display — the
// edit toolbar is stubbed until the next iteration wires markup / measure
// / comment write endpoints.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

import type {
  CommentRow,
  DrawingSetSummary,
  DrawingsPortal,
  MarkupDoc,
  MeasurementDoc,
  SheetSummary,
} from "@/domain/loaders/drawings";

type PdfPageProps = {
  pageNumber: number;
  width: number;
  onRenderSuccess?: () => void;
};

// react-pdf is client-only; dynamic import with ssr:false keeps it out of
// the server bundle. We only use <Document> and <Page>.
const PdfDocument = dynamic(
  async () => {
    const mod = await import("react-pdf");
    // Worker setup. Use the bundled worker from pdfjs-dist.
    const { pdfjs } = mod;
    if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    }
    return mod.Document;
  },
  { ssr: false },
);

const PdfPage = dynamic<PdfPageProps>(
  async () => {
    const mod = await import("react-pdf");
    return mod.Page;
  },
  { ssr: false },
);

function portalBase(portal: DrawingsPortal, projectId: string): string {
  if (portal === "contractor") return `/contractor/project/${projectId}`;
  if (portal === "subcontractor") return `/subcontractor/project/${projectId}`;
  return `/${portal}/project/${projectId}`;
}

const USER_COLORS = [
  "#5b4fc7",
  "#3d6b8e",
  "#c17a1a",
  "#2d8a5e",
  "#3178b9",
  "#8b5fbf",
  "#c93b3b",
  "#1a7f9e",
];

function colorForUserId(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  }
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}

type MarkupShape =
  | { id: string; tool: "rect"; x: number; y: number; w: number; h: number; label?: string }
  | { id: string; tool: "circle"; x: number; y: number; r: number }
  | { id: string; tool: "pen"; path: string }
  | { id: string; tool: "text"; x: number; y: number; text: string };

type MeasurementShape =
  | { id: string; type: "linear"; x1: number; y1: number; x2: number; y2: number; label: string }
  | { id: string; type: "area"; points: Array<[number, number]>; label: string };

export function SheetDetailWorkspace(props: {
  projectId: string;
  set: DrawingSetSummary;
  versionChain: DrawingSetSummary[];
  sheet: SheetSummary;
  sheetSiblings: SheetSummary[];
  markups: MarkupDoc[];
  measurements: MeasurementDoc[];
  comments: CommentRow[];
  calibration: {
    scale: string | null;
    source: "title_block" | "manual" | null;
    calibratedAt: string | null;
    calibratedByName: string | null;
  };
  presignedSourceUrl: string;
  portal: DrawingsPortal;
  canAnnotate: boolean;
}) {
  const {
    projectId,
    set,
    versionChain,
    sheet,
    sheetSiblings,
    markups,
    measurements,
    comments,
    calibration,
    presignedSourceUrl,
    portal,
    canAnnotate,
  } = props;

  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [showMarkups, setShowMarkups] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);
  // View-state filter for the "Layers" button: who's markup/comments do we show?
  // Values: "all" | "mine" | "contractor" | "subs". Applied in the render pass.
  const [layerFilter, setLayerFilter] = useState<"all" | "mine" | "contractor" | "subs">("all");

  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  useEffect(() => {
    const el = canvasWrapRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      // Leave padding on each side for the canvas shadow; clamp width.
      const target = Math.min(1400, Math.max(320, rect.width - 48));
      setContainerWidth(target);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const base = portalBase(portal, projectId);

  // Neighboring sheets for prev/next navigation (scope-respecting: uses
  // sheetSiblings which is already filtered by the loader).
  const currentIdx = sheetSiblings.findIndex((s) => s.id === sheet.id);
  const prev = currentIdx > 0 ? sheetSiblings[currentIdx - 1] : null;
  const next =
    currentIdx >= 0 && currentIdx < sheetSiblings.length - 1
      ? sheetSiblings[currentIdx + 1]
      : null;

  const pageNumber = sheet.pageIndex + 1;

  const rootComments = useMemo(
    () => comments.filter((c) => c.parentCommentId === null),
    [comments],
  );

  // Apply layer filter to what's rendered. "mine" can't be computed
  // without the current user id — we pass that via contractor-vs-sub
  // at the role level here for V1. True "mine" is a follow-up.
  const visibleMarkupDocs = useMemo(() => {
    if (!showMarkups) return [];
    if (layerFilter === "contractor") {
      return markups.filter(() => portal === "contractor");
    }
    if (layerFilter === "subs") {
      return markups.filter(() => portal === "subcontractor");
    }
    return markups;
  }, [markups, layerFilter, showMarkups, portal]);

  const visibleMeasurementDocs = useMemo(() => {
    if (!showMeasurements) return [];
    return measurements;
  }, [measurements, showMeasurements]);

  const visibleCommentRoots = useMemo(() => {
    if (!showComments) return [];
    return rootComments;
  }, [rootComments, showComments]);

  return (
    <div className="dr-detail">
      {/* Toolbar */}
      <div className="dr-detail-toolbar">
        <Link href={`${base}/drawings/${set.id}`} className="dr-btn sm ghost">
          ←
        </Link>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 500 }}>
            {sheet.sheetNumber}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            {sheet.sheetTitle}
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {prev ? (
            <Link
              className="dr-btn sm"
              href={`${base}/drawings/${set.id}/sheet/${prev.id}`}
            >
              ← {prev.sheetNumber}
            </Link>
          ) : null}
          {next ? (
            <Link
              className="dr-btn sm"
              href={`${base}/drawings/${set.id}/sheet/${next.id}`}
            >
              {next.sheetNumber} →
            </Link>
          ) : null}

          <select
            className="dr-btn sm"
            value={set.id}
            onChange={(e) => {
              const nextSetId = e.target.value;
              if (nextSetId !== set.id) {
                // Try to land on a sheet with the same sheet_number in the
                // target set. If none exists, fall back to the set index.
                // Full match-and-jump lives in the loader; the naive
                // version-switch just goes to the new set's index page.
                window.location.href = `${base}/drawings/${nextSetId}`;
              }
            }}
            style={{ minWidth: 180 }}
          >
            {versionChain.map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version}
                {v.status === "current" ? " · current" : v.status === "superseded" ? " · superseded" : " · historical"}
              </option>
            ))}
          </select>

          <button
            className={`dr-btn sm ${showMarkups ? "" : "ghost"}`}
            onClick={() => setShowMarkups((v) => !v)}
            title="Toggle markup"
          >
            Markup
          </button>
          <button
            className={`dr-btn sm ${showMeasurements ? "" : "ghost"}`}
            onClick={() => setShowMeasurements((v) => !v)}
            title="Toggle measurements"
          >
            Measure
          </button>
          <button
            className={`dr-btn sm ${showComments ? "" : "ghost"}`}
            onClick={() => setShowComments((v) => !v)}
            title="Toggle comments"
          >
            Comments
          </button>
          <select
            className="dr-btn sm"
            value={layerFilter}
            onChange={(e) => setLayerFilter(e.target.value as typeof layerFilter)}
            title="Layer filter"
          >
            <option value="all">All layers</option>
            <option value="mine">Mine only</option>
            <option value="contractor">Contractor</option>
            <option value="subs">Subs</option>
          </select>

          {canAnnotate ? (
            <button className="dr-btn sm primary" disabled title="Editing tools land next">
              Edit markup (soon)
            </button>
          ) : null}
        </div>
      </div>

      {/* Canvas */}
      <div className="dr-detail-canvas" ref={canvasWrapRef}>
        <div
          className="dr-detail-pdf-wrap"
          style={
            pageSize
              ? { width: containerWidth, height: (containerWidth / pageSize.w) * pageSize.h }
              : { width: containerWidth, minHeight: 600 }
          }
        >
          <PdfDocument
            file={presignedSourceUrl}
            loading={<div style={{ padding: 40, textAlign: "center" }}>Loading PDF…</div>}
            onLoadError={(err: Error) => console.error("pdf load error", err)}
          >
            <PdfPage
              pageNumber={pageNumber}
              width={containerWidth}
              onRenderSuccess={() => {
                // Keep aspect ratio locked once we know the page size.
                const canvas = canvasWrapRef.current?.querySelector("canvas");
                if (canvas && !pageSize) {
                  // naturalWidth/Height on a rendered canvas equals its bitmap
                  // size; use it to derive aspect ratio for the overlay sizing.
                  setPageSize({ w: canvas.width, h: canvas.height });
                }
              }}
            />
          </PdfDocument>

          {/* SVG overlay — viewBox is 0–100 in both axes, matching the
              fractional coords used by markups/measurements/comments in
              the prototype. preserveAspectRatio=none would stretch; we use
              none here intentionally because the overlay stretches to the
              rendered PDF canvas, which already carries the aspect ratio. */}
          <svg
            className="dr-detail-overlay"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ width: "100%", height: "100%" }}
          >
            {visibleMarkupDocs.flatMap((doc) => {
              const color = colorForUserId(doc.userId);
              const shapes = (doc.markupData as MarkupShape[] | null) ?? [];
              return shapes.map((m) => {
                if (m.tool === "rect") {
                  return (
                    <g key={`${doc.id}-${m.id}`} className="markup">
                      <rect
                        x={m.x}
                        y={m.y}
                        width={m.w}
                        height={m.h}
                        fill={color}
                        fillOpacity={0.1}
                        stroke={color}
                        strokeWidth={0.4}
                        vectorEffect="non-scaling-stroke"
                      />
                      {m.label ? (
                        <text
                          x={m.x + 0.5}
                          y={m.y + 2.5}
                          fontSize={1.6}
                          fontFamily="DM Sans"
                          fontWeight={700}
                          fill={color}
                        >
                          {m.label}
                        </text>
                      ) : null}
                    </g>
                  );
                }
                if (m.tool === "circle") {
                  return (
                    <circle
                      key={`${doc.id}-${m.id}`}
                      className="markup"
                      cx={m.x}
                      cy={m.y}
                      r={m.r}
                      fill={color}
                      fillOpacity={0.1}
                      stroke={color}
                      strokeWidth={0.4}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                }
                if (m.tool === "pen") {
                  return (
                    <path
                      key={`${doc.id}-${m.id}`}
                      className="markup"
                      d={m.path}
                      fill="none"
                      stroke={color}
                      strokeWidth={0.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                }
                if (m.tool === "text") {
                  return (
                    <g key={`${doc.id}-${m.id}`} className="markup">
                      <text
                        x={m.x}
                        y={m.y}
                        fontSize={2}
                        fontFamily="DM Sans"
                        fontWeight={650}
                        fill={color}
                      >
                        {m.text}
                      </text>
                    </g>
                  );
                }
                return null;
              });
            })}

            {visibleMeasurementDocs.flatMap((doc) => {
              const color = colorForUserId(doc.userId);
              const shapes = (doc.measurementData as MeasurementShape[] | null) ?? [];
              return shapes.map((m) => {
                if (m.type === "linear") {
                  const midx = (m.x1 + m.x2) / 2;
                  const midy = (m.y1 + m.y2) / 2;
                  return (
                    <g key={`${doc.id}-${m.id}`} className="measure">
                      <line
                        x1={m.x1}
                        y1={m.y1}
                        x2={m.x2}
                        y2={m.y2}
                        stroke={color}
                        strokeWidth={0.4}
                        strokeDasharray="1 0.6"
                        vectorEffect="non-scaling-stroke"
                      />
                      <rect
                        x={midx - 4}
                        y={midy - 1.6}
                        width={8}
                        height={3}
                        fill="#fff"
                        stroke={color}
                        strokeWidth={0.3}
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={midx}
                        y={midy + 0.6}
                        textAnchor="middle"
                        fontSize={2}
                        fontFamily="JetBrains Mono"
                        fontWeight={600}
                        fill={color}
                      >
                        {m.label}
                      </text>
                    </g>
                  );
                }
                if (m.type === "area") {
                  const pts = m.points.map((p) => `${p[0]},${p[1]}`).join(" ");
                  const cx =
                    m.points.reduce((s, p) => s + p[0], 0) / m.points.length;
                  const cy =
                    m.points.reduce((s, p) => s + p[1], 0) / m.points.length;
                  return (
                    <g key={`${doc.id}-${m.id}`} className="measure">
                      <polygon
                        points={pts}
                        fill={color}
                        fillOpacity={0.08}
                        stroke={color}
                        strokeWidth={0.4}
                        strokeDasharray="1 0.8"
                        vectorEffect="non-scaling-stroke"
                      />
                      <rect
                        x={cx - 4}
                        y={cy - 1.6}
                        width={8}
                        height={3}
                        fill="#fff"
                        stroke={color}
                        strokeWidth={0.3}
                        vectorEffect="non-scaling-stroke"
                      />
                      <text
                        x={cx}
                        y={cy + 0.6}
                        textAnchor="middle"
                        fontSize={2}
                        fontFamily="JetBrains Mono"
                        fontWeight={600}
                        fill={color}
                      >
                        {m.label}
                      </text>
                    </g>
                  );
                }
                return null;
              });
            })}

            {visibleCommentRoots.map((c) => {
              const color = colorForUserId(c.userId);
              return (
                <g
                  key={c.id}
                  className="pin"
                  onClick={() =>
                    setSelectedCommentId(c.id === selectedCommentId ? null : c.id)
                  }
                >
                  {selectedCommentId === c.id ? (
                    <circle cx={c.x} cy={c.y} r={3.5} fill={color} opacity={0.2} />
                  ) : null}
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={2.2}
                    fill={c.resolved ? "#2d8a5e" : color}
                    stroke="#fff"
                    strokeWidth={0.5}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={c.x}
                    y={c.y + 0.7}
                    textAnchor="middle"
                    fontSize={2}
                    fontFamily="DM Sans"
                    fontWeight={700}
                    fill="#fff"
                  >
                    {c.pinNumber ?? "·"}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Side panel */}
      <aside className="dr-detail-side">
        <div>
          <div className="dr-side-title">Sheet info</div>
          <div style={{ fontSize: 13, fontWeight: 650 }}>{sheet.sheetNumber}</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {sheet.sheetTitle}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
            Page {sheet.pageIndex + 1} · {sheet.autoDetected ? "auto-detected" : "manual"}
          </div>
        </div>

        <div>
          <div className="dr-side-title">Calibration</div>
          {calibration.scale ? (
            <div style={{ fontSize: 12 }}>
              <div
                style={{
                  fontFamily: "JetBrains Mono, monospace",
                  fontWeight: 600,
                }}
              >
                {calibration.scale}
              </div>
              <div style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 2 }}>
                {calibration.source === "manual" ? "Manual" : "Title block"}
                {calibration.calibratedByName
                  ? ` · ${calibration.calibratedByName}`
                  : ""}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
              Not calibrated. Measurement labels will be unitless until a scale
              is set.
            </div>
          )}
        </div>

        <div>
          <div className="dr-side-title">
            Comments ({rootComments.length})
          </div>
          <div className="dr-comment-list">
            {rootComments.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                No comments on this sheet.
              </div>
            ) : (
              rootComments.map((c) => {
                const color = colorForUserId(c.userId);
                return (
                  <div
                    key={c.id}
                    className={`dr-comment ${c.resolved ? "resolved" : ""}`}
                    onClick={() => setSelectedCommentId(c.id)}
                    style={{
                      cursor: "pointer",
                      borderColor:
                        selectedCommentId === c.id ? color : undefined,
                    }}
                  >
                    <div className="dr-comment-hdr">
                      <span
                        className="dr-comment-pin"
                        style={{ background: c.resolved ? "#2d8a5e" : color }}
                      >
                        {c.pinNumber ?? "·"}
                      </span>
                      <span className="dr-comment-author">{c.userName ?? "Unknown"}</span>
                      <span className="dr-comment-time">
                        {new Date(c.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <div className="dr-comment-body">{c.text}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {!canAnnotate ? (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              borderTop: "1px solid var(--surface-3)",
              paddingTop: 10,
            }}
          >
            Markup editing tools are coming in the next update. You can view
            existing annotations on this sheet.
          </div>
        ) : (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              borderTop: "1px solid var(--surface-3)",
              paddingTop: 10,
            }}
          >
            Markups don&apos;t carry to new versions. When a new sheet set
            supersedes this one, annotations stay pinned here.
          </div>
        )}
      </aside>
    </div>
  );
}
