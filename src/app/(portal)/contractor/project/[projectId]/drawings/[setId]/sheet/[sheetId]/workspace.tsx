"use client";

// Sheet detail viewer + editor. react-pdf renders the PDF page to a
// canvas; an SVG overlay on top carries per-user markup/measurement/pin
// data. The overlay's viewBox is 0–100 in both axes so coords are stored
// as fractional (0–100) percentages — same shape the prototype uses.
//
// Edit model:
//   - Other users' annotations render read-only.
//   - The caller's own markup and measurement docs are pulled into
//     local state on mount; pen/rect/circle/text/measure/area shapes
//     are mutated locally and debounced-saved to the PUT endpoint.
//   - Comment pins are dropped with the "Comment" tool. We POST to the
//     sheet-comments route (MAX+1 retry for pin_number atomicity) and
//     refresh the comment list.
//
// Scope cut for this chunk:
//   - Calibration UI is a prompt-based shortcut (no two-point recal
//     pointer flow yet — that lands with the calibration polish).
//   - Compare mode is still deferred.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import type {
  CommentRow,
  DrawingSetSummary,
  DrawingsPortal,
  MarkupDoc,
  MeasurementDoc,
  SheetSummary,
} from "@/domain/loaders/drawings";

import { DISCIPLINE_COLORS } from "../../../sheet-thumbnail";

type PdfPageProps = {
  pageNumber: number;
  width: number;
  onRenderSuccess?: () => void;
};

const PdfDocument = dynamic(
  async () => {
    const mod = await import("react-pdf");
    const { pdfjs } = mod;
    if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    }
    return mod.Document;
  },
  { ssr: false },
);

const PdfPage = dynamic<PdfPageProps>(
  async () => (await import("react-pdf")).Page,
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

// ---- Markup + measurement shape types (mirror the zod schemas on the API) --

type RectShape = {
  id: string;
  tool: "rect";
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
};
type CircleShape = {
  id: string;
  tool: "circle";
  x: number;
  y: number;
  r: number;
};
type PenShape = { id: string; tool: "pen"; path: string };
type TextShape = {
  id: string;
  tool: "text";
  x: number;
  y: number;
  text: string;
};
type MarkupShape = RectShape | CircleShape | PenShape | TextShape;

type LinearMeasurement = {
  id: string;
  type: "linear";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
};
type AreaMeasurement = {
  id: string;
  type: "area";
  points: Array<[number, number]>;
  label: string;
};
type MeasurementShape = LinearMeasurement | AreaMeasurement;

type Tool =
  | "select"
  | "pen"
  | "rect"
  | "circle"
  | "text"
  | "measure_linear"
  | "measure_area"
  | "comment"
  | "calibrate";

// ---- Small utilities --------------------------------------------------

function randId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// Convert a pointer event to viewBox (0–100) coordinates. The overlay's
// stretched preserveAspectRatio=none makes this a simple percent-of-rect
// calc in both axes.
function eventToViewBox(
  e: { clientX: number; clientY: number },
  svg: SVGSVGElement,
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

// Given a linear measurement in viewBox coords and a human-readable scale
// like '1/8" = 1\'-0"', format the label. V1 accepts the common architect's
// inch-per-foot scales and falls back to a raw % if the scale can't be
// parsed. Real calibration (two-point) will replace this with an
// end-to-end distance-per-pixel factor.
function formatLinearLabel(
  dx: number,
  dy: number,
  pageWidthPx: number,
  pageHeightPx: number,
  scale: string | null,
): string {
  const pixelLen = Math.sqrt(
    Math.pow((dx / 100) * pageWidthPx, 2) +
      Math.pow((dy / 100) * pageHeightPx, 2),
  );
  if (!scale) {
    // No scale: return a raw length percentage of the long side.
    const pct = Math.sqrt(dx * dx + dy * dy);
    return `${pct.toFixed(1)}%`;
  }
  // Parse "1/X\" = 1'-0\"" — crude but functional for common US scales.
  const m = scale.match(/1\s*\/\s*(\d+)\s*"/);
  if (m) {
    const divisor = parseInt(m[1], 10);
    // 72 DPI is pdfjs's default page units. 1 inch on paper = divisor feet
    // in drawing space, so: pixels * (scale / 72) = inches on paper,
    // then inches * divisor = feet in drawing.
    const inchesOnPaper = pixelLen / 72;
    const feet = inchesOnPaper * divisor;
    const ft = Math.floor(feet);
    const inches = Math.round((feet - ft) * 12);
    return `${ft}'-${inches}"`;
  }
  return `${pixelLen.toFixed(0)}px`;
}

function formatAreaLabel(
  points: Array<[number, number]>,
  pageWidthPx: number,
  pageHeightPx: number,
  scale: string | null,
): string {
  // Shoelace in viewBox units, then convert via pdf-page units.
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  const areaViewBox = Math.abs(sum / 2); // in (viewBox units)^2
  const areaPxSq =
    (areaViewBox / 10000) * pageWidthPx * pageHeightPx;
  if (!scale) return `${areaViewBox.toFixed(1)}%`;
  const m = scale.match(/1\s*\/\s*(\d+)\s*"/);
  if (m) {
    const divisor = parseInt(m[1], 10);
    const sqFeet = (areaPxSq / (72 * 72)) * divisor * divisor;
    return `${Math.round(sqFeet)} SF`;
  }
  return `${Math.round(areaPxSq)} px²`;
}

// Parse a user-entered real distance into decimal feet. Accepts the common
// architect forms: `24'-6"`, `24' 6"`, `24.5'`, `24.5 ft`, `294"`, `294 in`,
// bare number (taken as feet). Returns null when nothing usable comes in.
function parseRealDistance(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  // 24'-6" / 24' 6" / 24' / 24'6"
  const feetInches = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)[^0-9]*(\d+(?:\.\d+)?)?\s*(?:"|in|inches)?$/);
  if (feetInches) {
    const feet = parseFloat(feetInches[1]);
    const inches = feetInches[2] ? parseFloat(feetInches[2]) : 0;
    if (!Number.isFinite(feet)) return null;
    return feet + inches / 12;
  }
  // Plain inches: 294" / 294 in
  const inchesOnly = s.match(/^(\d+(?:\.\d+)?)\s*(?:"|in|inches)$/);
  if (inchesOnly) {
    const inches = parseFloat(inchesOnly[1]);
    return inches / 12;
  }
  // Bare number — treat as feet.
  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return parseFloat(bare[1]);
  return null;
}

// Round a derived scale divisor to the nearest standard architect value so
// the stored scale text round-trips through formatLinearLabel's parser.
// Standard US divisors: 4 (3"=1'), 8, 16, 24, 32, 48, 96. Returns the
// closest, constrained to this set.
function nearestStandardDivisor(d: number): number {
  const standards = [2, 4, 8, 16, 24, 32, 48, 64, 96, 128, 192];
  let best = standards[0];
  let bestErr = Math.abs(d - best);
  for (const s of standards) {
    const err = Math.abs(d - s);
    if (err < bestErr) {
      best = s;
      bestErr = err;
    }
  }
  return best;
}

// ---- Compare-mode pixel diff ------------------------------------------
//
// Both canvases render at the same width (rendered by react-pdf). We pull
// imageData, compute a luminance delta per pixel, and paint a red tint on
// any pixel whose delta exceeds the threshold. 3% of the 0-255 luminance
// range = ~7.65; we use 10 to absorb a bit more anti-aliasing noise
// without losing real vector changes. A 1px gaussian pre-blur would help
// further but adds substantial cost — deferred.
const DIFF_THRESHOLD = 10;

function computeLuminanceDiff(
  left: HTMLCanvasElement,
  right: HTMLCanvasElement,
  target: HTMLCanvasElement,
): void {
  // Downscale the target to the smaller of the two source widths to avoid
  // false positives from differing rendered dimensions.
  const w = Math.min(left.width, right.width);
  const h = Math.min(left.height, right.height);
  target.width = w;
  target.height = h;
  const lctx = left.getContext("2d");
  const rctx = right.getContext("2d");
  const tctx = target.getContext("2d");
  if (!lctx || !rctx || !tctx) return;
  const la = lctx.getImageData(0, 0, w, h).data;
  const ra = rctx.getImageData(0, 0, w, h).data;
  const out = tctx.createImageData(w, h);
  const o = out.data;
  for (let i = 0; i < la.length; i += 4) {
    const lumL = 0.299 * la[i] + 0.587 * la[i + 1] + 0.114 * la[i + 2];
    const lumR = 0.299 * ra[i] + 0.587 * ra[i + 1] + 0.114 * ra[i + 2];
    if (Math.abs(lumL - lumR) > DIFF_THRESHOLD) {
      o[i] = 201; // #c93b3b, the "changed" red from the prototype
      o[i + 1] = 59;
      o[i + 2] = 59;
      o[i + 3] = 110; // ~43% opacity
    } else {
      o[i + 3] = 0;
    }
  }
  tctx.putImageData(out, 0, 0);
}

// ---- The component ----------------------------------------------------

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
  presignedSourceUrl: string | null;
  compare: {
    priorSet: { id: string; name: string; version: number } | null;
    priorSheet: {
      id: string;
      pageIndex: number;
      sheetNumber: string;
      sheetTitle: string;
    } | null;
    priorPresignedSourceUrl: string | null;
    unmatched: boolean;
  };
  portal: DrawingsPortal;
  canAnnotate: boolean;
  canCalibrate: boolean;
  currentUserId: string;
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
    compare,
    portal,
    canAnnotate,
    canCalibrate,
    currentUserId,
  } = props;

  const router = useRouter();

  // Seed local edit state from the server-rendered set of the caller's own
  // docs. Other users' docs stay in props and render read-only.
  const myInitialMarkup = useMemo(() => {
    const doc = markups.find((d) => d.userId === currentUserId);
    return (doc?.markupData as MarkupShape[] | null) ?? [];
  }, [markups, currentUserId]);
  const myInitialMeasurements = useMemo(() => {
    const doc = measurements.find((d) => d.userId === currentUserId);
    return (doc?.measurementData as MeasurementShape[] | null) ?? [];
  }, [measurements, currentUserId]);

  const [tool, setTool] = useState<Tool>("select");
  const [myMarkup, setMyMarkup] = useState<MarkupShape[]>(myInitialMarkup);
  const [myMeasurements, setMyMeasurements] = useState<MeasurementShape[]>(
    myInitialMeasurements,
  );
  const [localComments, setLocalComments] = useState<CommentRow[]>(comments);
  const [draftShape, setDraftShape] = useState<MarkupShape | MeasurementShape | null>(null);
  const [textPrompt, setTextPrompt] = useState<{ x: number; y: number } | null>(null);
  const [textDraft, setTextDraft] = useState("");
  const [pendingComment, setPendingComment] = useState<{ x: number; y: number } | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [areaPoints, setAreaPoints] = useState<Array<[number, number]>>([]);
  const [calibrationPoints, setCalibrationPoints] = useState<
    Array<[number, number]>
  >([]);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(true);
  const [showMarkups, setShowMarkups] = useState(true);
  const [showMeasurements, setShowMeasurements] = useState(true);
  const [layerFilter, setLayerFilter] = useState<"all" | "mine" | "contractor" | "subs">("all");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  // Zoom factor applied to the PDF render (width = containerWidth * zoom).
  // The zoom-indicator +/- buttons step this in 10% increments; ctrl+wheel
  // on the canvas also nudges it (handled inline). Clamped 0.25–3.
  const [zoom, setZoom] = useState(1);
  // Panel-level compose: when the Comment tool isn't active, the comments
  // panel textarea still lets users post a general note (placed at the
  // sheet center). This is separate from the pending-pin compose.
  const [panelCompose, setPanelCompose] = useState("");
  const [panelPosting, setPanelPosting] = useState(false);
  // Reply compose per comment — one comment at a time.
  const [replyingToCommentId, setReplyingToCommentId] = useState<string | null>(
    null,
  );
  const [replyDraft, setReplyDraft] = useState("");

  // Compare mode. Available only when the loader found a prior version
  // (same sheet_number on the set this one supersedes). When the prior
  // version exists but the sheet itself doesn't match (new sheet added
  // in this version), compareUnmatched is true and we render a state
  // card instead of the right-pane PDF.
  const compareAvailable =
    compare.priorSet !== null && compare.priorSheet !== null;
  const compareUnmatchedAvailable =
    compare.priorSet !== null && compare.unmatched;
  const [compareMode, setCompareMode] = useState(false);
  const [diffReady, setDiffReady] = useState(false);
  const leftPdfWrapRef = useRef<HTMLDivElement>(null);
  const rightPdfWrapRef = useRef<HTMLDivElement>(null);
  const diffCanvasRef = useRef<HTMLCanvasElement>(null);
  const [leftRendered, setLeftRendered] = useState(false);
  const [rightRendered, setRightRendered] = useState(false);

  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [pageSize, setPageSize] = useState<{ w: number; h: number } | null>(null);

  // Narrow-viewport state — drives CSS-driven mobile polish for the
  // floating toolbar + hidden sheet rail. The state is here so future
  // tweaks that need it JS-side have a handle; the current layout
  // relies on the dr-detail @media breakpoint.
  const [, setNarrowViewport] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 900px)");
    const onChange = () => setNarrowViewport(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Recompute diff whenever both panes finish rendering at the current
  // width. The diff canvas is absolutely positioned over the right pane;
  // its imageData tints pixels whose luminance delta exceeds the threshold.
  useEffect(() => {
    if (!compareMode) {
      setDiffReady(false);
      return;
    }
    if (!leftRendered || !rightRendered) return;
    const leftCanvas = leftPdfWrapRef.current?.querySelector("canvas");
    const rightCanvas = rightPdfWrapRef.current?.querySelector("canvas");
    const diffCanvas = diffCanvasRef.current;
    if (!leftCanvas || !rightCanvas || !diffCanvas) return;
    // Browsers throw SecurityError on cross-origin reads; the presigned
    // URLs come from the same R2 endpoint as the page, same origin for
    // dev but a separate domain in prod. Guard with try/catch so a
    // tainted canvas doesn't blow up the page.
    try {
      computeLuminanceDiff(
        leftCanvas as HTMLCanvasElement,
        rightCanvas as HTMLCanvasElement,
        diffCanvas,
      );
      setDiffReady(true);
    } catch (err) {
      console.error("diff failed", err);
      setDiffReady(false);
    }
  }, [compareMode, leftRendered, rightRendered, containerWidth]);

  const pageHeightPx = pageSize
    ? (containerWidth / pageSize.w) * pageSize.h
    : 600;

  useEffect(() => {
    const el = canvasWrapRef.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      const target = Math.min(1400, Math.max(320, rect.width - 48));
      setContainerWidth(target);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Debounced save — fires 800ms after the last markup/measurement mutation.
  // Tracks a ref-held version counter so a rapid edit during a save doesn't
  // skip an update.
  const pendingVersionRef = useRef(0);
  const lastSavedMarkupRef = useRef<string>(JSON.stringify(myInitialMarkup));
  const lastSavedMeasurementsRef = useRef<string>(
    JSON.stringify(myInitialMeasurements),
  );

  useEffect(() => {
    if (!canAnnotate) return;
    pendingVersionRef.current += 1;
    const myVersion = pendingVersionRef.current;
    const nextMarkup = JSON.stringify(myMarkup);
    const nextMeasurements = JSON.stringify(myMeasurements);
    if (
      nextMarkup === lastSavedMarkupRef.current &&
      nextMeasurements === lastSavedMeasurementsRef.current
    ) {
      return;
    }
    const handle = window.setTimeout(async () => {
      if (myVersion !== pendingVersionRef.current) return; // superseded
      setSaveState("saving");
      try {
        if (nextMarkup !== lastSavedMarkupRef.current) {
          const res = await fetch(
            `/api/drawings/sheets/${sheet.id}/markup`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ markupData: myMarkup }),
            },
          );
          if (!res.ok) throw new Error(`markup save ${res.status}`);
          lastSavedMarkupRef.current = nextMarkup;
        }
        if (nextMeasurements !== lastSavedMeasurementsRef.current) {
          const res = await fetch(
            `/api/drawings/sheets/${sheet.id}/measurement`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ measurementData: myMeasurements }),
            },
          );
          if (!res.ok) throw new Error(`measurement save ${res.status}`);
          lastSavedMeasurementsRef.current = nextMeasurements;
        }
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 1200);
      } catch (err) {
        setSaveState("error");
        setSaveError(err instanceof Error ? err.message : String(err));
      }
    }, 800);
    return () => window.clearTimeout(handle);
  }, [myMarkup, myMeasurements, sheet.id, canAnnotate]);

  // Pointer handlers — tool-dispatched. The SVG captures the pointer on
  // down so movement off-canvas still lands in our up handler.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!canAnnotate || tool === "select") return;
      const svg = svgRef.current;
      if (!svg) return;
      const pt = eventToViewBox(e, svg);
      svg.setPointerCapture(e.pointerId);
      if (tool === "pen") {
        setDraftShape({
          id: randId("pen"),
          tool: "pen",
          path: `M ${pt.x.toFixed(2)},${pt.y.toFixed(2)}`,
        });
      } else if (tool === "rect") {
        setDraftShape({
          id: randId("rect"),
          tool: "rect",
          x: pt.x,
          y: pt.y,
          w: 0,
          h: 0,
        });
      } else if (tool === "circle") {
        setDraftShape({
          id: randId("circle"),
          tool: "circle",
          x: pt.x,
          y: pt.y,
          r: 0,
        });
      } else if (tool === "text") {
        setTextPrompt({ x: pt.x, y: pt.y });
        setTextDraft("");
      } else if (tool === "comment") {
        setPendingComment({ x: pt.x, y: pt.y });
        setCommentDraft("");
      } else if (tool === "measure_linear") {
        setDraftShape({
          id: randId("ms"),
          type: "linear",
          x1: pt.x,
          y1: pt.y,
          x2: pt.x,
          y2: pt.y,
          label: "",
        });
      } else if (tool === "measure_area") {
        // Area: accumulate click points; a double-click (handled below)
        // finalizes the polygon.
        setAreaPoints((pts) => [...pts, [pt.x, pt.y]]);
      } else if (tool === "calibrate") {
        // Two-point calibration: first click stores point A, second click
        // stores B then prompts for the real-world distance and writes
        // the derived scale via PATCH /calibration. Handled in a side
        // effect so the second click can await the fetch without
        // blocking the pointer handler.
        setCalibrationPoints((pts) => {
          const next = [...pts, [pt.x, pt.y] as [number, number]];
          return next.length > 2 ? [[pt.x, pt.y]] : next;
        });
      }
    },
    [tool, canAnnotate],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!draftShape) return;
      const svg = svgRef.current;
      if (!svg) return;
      const pt = eventToViewBox(e, svg);
      if ("tool" in draftShape) {
        if (draftShape.tool === "pen") {
          setDraftShape({
            ...draftShape,
            path: `${draftShape.path} L ${pt.x.toFixed(2)},${pt.y.toFixed(2)}`,
          });
        } else if (draftShape.tool === "rect") {
          setDraftShape({
            ...draftShape,
            w: pt.x - draftShape.x,
            h: pt.y - draftShape.y,
          });
        } else if (draftShape.tool === "circle") {
          const dx = pt.x - draftShape.x;
          const dy = pt.y - draftShape.y;
          setDraftShape({
            ...draftShape,
            r: Math.sqrt(dx * dx + dy * dy),
          });
        }
      } else if (draftShape.type === "linear") {
        const dx = pt.x - draftShape.x1;
        const dy = pt.y - draftShape.y1;
        const label = formatLinearLabel(
          dx,
          dy,
          containerWidth,
          pageHeightPx,
          calibration.scale,
        );
        setDraftShape({
          ...draftShape,
          x2: pt.x,
          y2: pt.y,
          label,
        });
      }
    },
    [draftShape, containerWidth, pageHeightPx, calibration.scale],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (svg && svg.hasPointerCapture(e.pointerId)) {
        svg.releasePointerCapture(e.pointerId);
      }
      if (!draftShape) return;
      if ("tool" in draftShape) {
        // Discard tiny accidental shapes (misclicks).
        if (
          (draftShape.tool === "rect" &&
            Math.abs(draftShape.w) < 0.5 &&
            Math.abs(draftShape.h) < 0.5) ||
          (draftShape.tool === "circle" && draftShape.r < 0.5)
        ) {
          setDraftShape(null);
          return;
        }
        // Normalize rect (allow drag from any corner).
        if (draftShape.tool === "rect") {
          const rect = draftShape as RectShape;
          const normalized: RectShape = {
            ...rect,
            x: Math.min(rect.x, rect.x + rect.w),
            y: Math.min(rect.y, rect.y + rect.h),
            w: Math.abs(rect.w),
            h: Math.abs(rect.h),
          };
          setMyMarkup((m) => [...m, normalized]);
        } else {
          setMyMarkup((m) => [...m, draftShape as MarkupShape]);
        }
      } else if (draftShape.type === "linear") {
        const dx = draftShape.x2 - draftShape.x1;
        const dy = draftShape.y2 - draftShape.y1;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
          setDraftShape(null);
          return;
        }
        setMyMeasurements((ms) => [...ms, draftShape as LinearMeasurement]);
      }
      setDraftShape(null);
    },
    [draftShape],
  );

  // Two-point calibration — fires when we have a pair of points. Computes
  // the scale divisor from the pixel distance + real distance and PATCHes
  // it as a `1/N" = 1'-0"` string (rounded to the nearest standard scale).
  useEffect(() => {
    if (calibrationPoints.length !== 2) return;
    if (!canCalibrate) {
      setCalibrationPoints([]);
      return;
    }
    const [a, b] = calibrationPoints;
    const dx = (b[0] - a[0]) / 100;
    const dy = (b[1] - a[1]) / 100;
    const pixelLen = Math.sqrt(
      Math.pow(dx * containerWidth, 2) + Math.pow(dy * pageHeightPx, 2),
    );
    if (pixelLen < 4) {
      setCalibrationPoints([]);
      return;
    }
    const entered = window.prompt(
      `Enter the real-world distance between the two points (e.g. 24'-6", 24.5', 294"):`,
      "",
    );
    setCalibrationPoints([]);
    if (!entered) return;
    const realFeet = parseRealDistance(entered);
    if (realFeet === null || realFeet <= 0) {
      window.alert(`Couldn't parse "${entered}" as a distance.`);
      return;
    }
    // pixels / 72 = inches-of-paper. inches-of-paper * divisor = feet on
    // drawing, so divisor = realFeet / (pixelLen / 72).
    const inchesOfPaper = pixelLen / 72;
    const divisor = realFeet / inchesOfPaper;
    const rounded = nearestStandardDivisor(divisor);
    const scaleString = `1/${rounded}" = 1'-0"`;
    void (async () => {
      try {
        const res = await fetch(
          `/api/drawings/sheets/${sheet.id}/calibration`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scale: scaleString, source: "manual" }),
          },
        );
        if (!res.ok) throw new Error(`calibration ${res.status}`);
        router.refresh();
        setTool("select");
      } catch (err) {
        setSaveState("error");
        setSaveError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, [
    calibrationPoints,
    canCalibrate,
    containerWidth,
    pageHeightPx,
    sheet.id,
    router,
  ]);

  // Area tool double-click: finalize polygon.
  const handleAreaFinalize = useCallback(() => {
    if (areaPoints.length < 3) {
      setAreaPoints([]);
      return;
    }
    const label = formatAreaLabel(
      areaPoints,
      containerWidth,
      pageHeightPx,
      calibration.scale,
    );
    setMyMeasurements((ms) => [
      ...ms,
      { id: randId("ar"), type: "area", points: areaPoints, label },
    ]);
    setAreaPoints([]);
  }, [areaPoints, containerWidth, pageHeightPx, calibration.scale]);

  // Commit the inline text prompt to a new text markup.
  const commitTextDraft = useCallback(() => {
    if (!textPrompt || !textDraft.trim()) {
      setTextPrompt(null);
      return;
    }
    setMyMarkup((m) => [
      ...m,
      {
        id: randId("tx"),
        tool: "text",
        x: textPrompt.x,
        y: textPrompt.y,
        text: textDraft.trim(),
      },
    ]);
    setTextPrompt(null);
    setTextDraft("");
  }, [textPrompt, textDraft]);

  // Post a new comment + refresh the side panel.
  const commitPendingComment = useCallback(async () => {
    if (!pendingComment || !commentDraft.trim()) {
      setPendingComment(null);
      return;
    }
    try {
      const res = await fetch(
        `/api/drawings/sheets/${sheet.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            x: pendingComment.x,
            y: pendingComment.y,
            text: commentDraft.trim(),
          }),
        },
      );
      if (!res.ok) throw new Error(`comment post ${res.status}`);
      const body = (await res.json()) as { id: string; pinNumber: number };
      setLocalComments((cs) => [
        ...cs,
        {
          id: body.id,
          parentCommentId: null,
          userId: currentUserId,
          userName: "You",
          userInitials: "ME",
          pinNumber: body.pinNumber,
          x: pendingComment.x,
          y: pendingComment.y,
          text: commentDraft.trim(),
          resolved: false,
          resolvedAt: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      setPendingComment(null);
      setCommentDraft("");
      // Refresh the router's server state so a full page reload (or
      // version-switch) sees the new comment without stale cache.
      router.refresh();
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }, [pendingComment, commentDraft, sheet.id, currentUserId, router]);

  const base = portalBase(portal, projectId);
  const pageNumber = sheet.pageIndex + 1;

  const rootComments = useMemo(
    () => localComments.filter((c) => c.parentCommentId === null),
    [localComments],
  );

  const otherMarkupDocs = useMemo(
    () => markups.filter((d) => d.userId !== currentUserId),
    [markups, currentUserId],
  );
  const otherMeasurementDocs = useMemo(
    () => measurements.filter((d) => d.userId !== currentUserId),
    [measurements, currentUserId],
  );

  const myColor = colorForUserId(currentUserId);

  // View-state layer filter. "mine" shows only my markup/measurements;
  // "contractor"/"subs" hides mine and narrows others by role (others-by-
  // role filtering is out of scope — we mark the intent but still render
  // everyone who isn't me in those modes). "all" is the default.
  const shouldRenderOthers = layerFilter !== "mine";
  const shouldRenderMine = layerFilter === "all" || layerFilter === "mine";

  // Post a general-purpose comment from the comments-panel textarea (no
  // pin placement — drops at sheet center). Keeps the panel composer
  // useful even when the user hasn't picked the Comment tool.
  const postPanelComment = useCallback(async () => {
    if (!panelCompose.trim()) return;
    setPanelPosting(true);
    try {
      const res = await fetch(`/api/drawings/sheets/${sheet.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x: 50, y: 50, text: panelCompose.trim() }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const body = (await res.json()) as { id: string; pinNumber: number };
      setLocalComments((cs) => [
        ...cs,
        {
          id: body.id,
          parentCommentId: null,
          userId: currentUserId,
          userName: "You",
          userInitials: "ME",
          pinNumber: body.pinNumber,
          x: 50,
          y: 50,
          text: panelCompose.trim(),
          resolved: false,
          resolvedAt: null,
          createdAt: new Date().toISOString(),
        },
      ]);
      setPanelCompose("");
      router.refresh();
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setPanelPosting(false);
    }
  }, [panelCompose, sheet.id, currentUserId, router]);

  // Reply to a root comment. Thread is one level deep — prototype matches.
  const postReply = useCallback(
    async (parentCommentId: string) => {
      const text = replyDraft.trim();
      if (!text) return;
      try {
        const res = await fetch(
          `/api/drawings/comments/${parentCommentId}/reply`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
          },
        );
        if (!res.ok) throw new Error(`reply ${res.status}`);
        setReplyingToCommentId(null);
        setReplyDraft("");
        router.refresh();
      } catch (err) {
        setSaveState("error");
        setSaveError(err instanceof Error ? err.message : String(err));
      }
    },
    [replyDraft, router],
  );

  // Toggle resolved on a root comment.
  const toggleResolved = useCallback(
    async (c: CommentRow) => {
      try {
        const res = await fetch(`/api/drawings/comments/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolved: !c.resolved }),
        });
        if (!res.ok) throw new Error(`resolve ${res.status}`);
        setLocalComments((cs) =>
          cs.map((x) =>
            x.id === c.id
              ? {
                  ...x,
                  resolved: !c.resolved,
                  resolvedAt: !c.resolved ? new Date().toISOString() : null,
                }
              : x,
          ),
        );
        router.refresh();
      } catch (err) {
        setSaveState("error");
        setSaveError(err instanceof Error ? err.message : String(err));
      }
    },
    [router],
  );

  // Zoom helpers used by the +/- buttons. 10% increments, clamped.
  const stepZoom = useCallback((delta: number) => {
    setZoom((z) => Math.max(0.25, Math.min(3, +(z + delta).toFixed(2))));
  }, []);

  return (
    <div className={`dr-detail${showComments ? "" : " no-comments"}`}>
      {/* ───── Left sheet rail ───── */}
      <aside className="dr-sheet-rail">
        <div className="dr-sheet-rail-hdr">
          <h4>Sheets · v{set.version}</h4>
          <Link
            href={`${base}/drawings/${set.id}`}
            className="dr-btn xs ghost"
            title="Back to sheet index"
            aria-label="Back to sheet index"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </Link>
        </div>
        <div className="dr-sheet-rail-list">
          {(() => {
            const order = ["A", "S", "E", "M", "P", "C", "L", "I", "G", "T", "F"];
            const seen = new Set<string>();
            for (const s of sheetSiblings) if (s.discipline) seen.add(s.discipline);
            const ordered = order.filter((c) => seen.has(c));
            const extras = Array.from(seen).filter((c) => !order.includes(c));
            const disciplines = [...ordered, ...extras];
            const uncoded = sheetSiblings.filter((s) => !s.discipline);
            return (
              <>
                {disciplines.map((disc) => {
                  const group = sheetSiblings.filter((s) => s.discipline === disc);
                  if (group.length === 0) return null;
                  const dc = DISCIPLINE_COLORS[disc] ?? DISCIPLINE_COLORS.A;
                  return (
                    <div key={disc}>
                      <div className="dr-sheet-rail-disc">
                        <span>{dc.label}</span>
                        <span style={{ color: "var(--text-tertiary)" }}>{group.length}</span>
                      </div>
                      {group.map((s) => {
                        const badge = s.markupCount + s.commentCount;
                        return (
                          <Link
                            key={s.id}
                            href={`${base}/drawings/${set.id}/sheet/${s.id}`}
                            className={`dr-sheet-rail-item${s.id === sheet.id ? " active" : ""}`}
                          >
                            <span className="sr-num">{s.sheetNumber}</span>
                            <span className="sr-title">{s.sheetTitle}</span>
                            {badge > 0 ? <span className="sr-badge">{badge}</span> : null}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
                {uncoded.length > 0 ? (
                  <div>
                    <div className="dr-sheet-rail-disc">
                      <span>Other</span>
                      <span style={{ color: "var(--text-tertiary)" }}>{uncoded.length}</span>
                    </div>
                    {uncoded.map((s) => {
                      const badge = s.markupCount + s.commentCount;
                      return (
                        <Link
                          key={s.id}
                          href={`${base}/drawings/${set.id}/sheet/${s.id}`}
                          className={`dr-sheet-rail-item${s.id === sheet.id ? " active" : ""}`}
                        >
                          <span className="sr-num">{s.sheetNumber}</span>
                          <span className="sr-title">{s.sheetTitle}</span>
                          {badge > 0 ? <span className="sr-badge">{badge}</span> : null}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </>
            );
          })()}
        </div>
      </aside>

      {/* ───── Center viewer ───── */}
      <div className="dr-viewer">
        <div className="dr-viewer-topbar">
          <div className="dr-viewer-title">
            <span className="dr-viewer-title-num">{sheet.sheetNumber}</span>
            <span className="dr-viewer-title-name">{sheet.sheetTitle}</span>
            {sheet.changedFromPriorVersion ? (
              <span className="dr-pill orange">Changed in v{set.version}</span>
            ) : null}
            {saveState === "saving" ? (
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Saving…</span>
            ) : saveState === "saved" ? (
              <span style={{ fontSize: 11, color: "#1e6b46" }}>Saved</span>
            ) : saveState === "error" ? (
              <span style={{ fontSize: 11, color: "#a52e2e" }} title={saveError ?? undefined}>
                Save failed
              </span>
            ) : null}
          </div>

          <div className="dr-viewer-controls">
            {/* Scale / calibration pill */}
            {calibration.scale ? (
              <div
                className="dr-scale-pill"
                title={
                  calibration.calibratedAt
                    ? `Calibrated ${new Date(calibration.calibratedAt).toLocaleDateString()} · ${calibration.source ?? "title_block"}${calibration.calibratedByName ? ` · ${calibration.calibratedByName}` : ""}`
                    : undefined
                }
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h4M17 12h4M12 3v4M12 17v4" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="dr-scale-pill-label">Scale</span>
                <span className="dr-scale-pill-val">{calibration.scale}</span>
              </div>
            ) : canCalibrate ? (
              <button
                className="dr-scale-pill warn"
                onClick={() => {
                  setTool("calibrate");
                  setCalibrationPoints([]);
                }}
                title="Click two known points on the sheet to set scale"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h4M17 12h4M12 3v4M12 17v4" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span className="dr-scale-pill-label">Calibrate scale</span>
              </button>
            ) : (
              <div className="dr-scale-pill">
                <span className="dr-scale-pill-label">Scale</span>
                <span className="dr-scale-pill-val">—</span>
              </div>
            )}

            {/* Compare button */}
            {compareAvailable || compareUnmatchedAvailable ? (
              <button
                className={`dr-btn sm${compareMode ? " primary" : ""}`}
                onClick={() => {
                  setCompareMode((v) => !v);
                  setLeftRendered(false);
                  setRightRendered(false);
                }}
                title={
                  compare.priorSet
                    ? `Compare against ${compare.priorSet.name} v${compare.priorSet.version}`
                    : "Compare versions"
                }
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="7" height="16" rx="1" />
                  <rect x="14" y="4" width="7" height="16" rx="1" />
                  <line x1="12" y1="2" x2="12" y2="22" />
                </svg>
                Compare{compareMode && compare.priorSet ? ` · v${compare.priorSet.version}` : ""}
              </button>
            ) : null}

            {/* Version dropdown */}
            <div className="dr-version-dd">
              <button
                className="dr-version-dd-btn"
                onClick={() => setVersionMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={versionMenuOpen}
              >
                v{set.version}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {versionMenuOpen ? (
                <div className="dr-version-dd-menu" role="menu">
                  {versionChain.map((v) => (
                    <Link
                      key={v.id}
                      href={`${base}/drawings/${v.id}`}
                      className={`dr-version-dd-item${v.id === set.id ? " current" : ""}`}
                      onClick={() => setVersionMenuOpen(false)}
                    >
                      <div className="dr-version-dd-item-top">
                        <h6>{v.name} v{v.version}</h6>
                        {v.status === "current" ? (
                          <span className="dr-pill accent">Current</span>
                        ) : v.status === "superseded" ? (
                          <span className="dr-pill gray">Superseded</span>
                        ) : (
                          <span className="dr-pill gray">Historical</span>
                        )}
                      </div>
                      <div className="dr-version-dd-item-date">
                        {new Date(v.uploadedAt).toLocaleDateString()}
                        {v.uploadedByName ? ` · ${v.uploadedByName}` : ""}
                        {" · "}
                        {v.sheetCount} sheets
                      </div>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Layers (dropdown) */}
            <div style={{ position: "relative" }}>
              <button
                className="dr-btn sm icon"
                onClick={() => setShowLayerMenu((v) => !v)}
                aria-label="Layer visibility"
                title="Layer visibility"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
              </button>
              {showLayerMenu ? (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    background: "var(--surface-1)",
                    border: "1px solid var(--surface-3)",
                    borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,.12)",
                    zIndex: 40,
                    minWidth: 220,
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                  onMouseLeave={() => setShowLayerMenu(false)}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 550, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={showMarkups}
                      onChange={(e) => setShowMarkups(e.target.checked)}
                    />
                    Markups
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 550, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={showMeasurements}
                      onChange={(e) => setShowMeasurements(e.target.checked)}
                    />
                    Measurements
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 550, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={showComments}
                      onChange={(e) => setShowComments(e.target.checked)}
                    />
                    Comment pins
                  </label>
                  <div style={{ borderTop: "1px solid var(--surface-2)", margin: "6px -8px" }} />
                  <div style={{ padding: "4px 10px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-tertiary)" }}>
                    Authors
                  </div>
                  {(["all", "mine", "contractor", "subs"] as const).map((opt) => (
                    <label
                      key={opt}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 550, cursor: "pointer" }}
                    >
                      <input
                        type="radio"
                        name="layer-filter"
                        checked={layerFilter === opt}
                        onChange={() => setLayerFilter(opt)}
                      />
                      {opt === "all" ? "All" : opt === "mine" ? "Mine only" : opt === "contractor" ? "Contractor" : "Subs"}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Toggle comments panel */}
            <button
              className="dr-btn sm icon"
              onClick={() => setShowComments((v) => !v)}
              aria-label={showComments ? "Hide comments" : "Show comments"}
              title={showComments ? "Hide comments" : "Show comments"}
            >
              {showComments ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>

            <button
              className="dr-btn sm icon"
              aria-label="Download"
              title={presignedSourceUrl ? "Download source PDF" : "Source PDF not yet available"}
              onClick={() => presignedSourceUrl && window.open(presignedSourceUrl, "_blank")}
              disabled={!presignedSourceUrl}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>

            <button
              className="dr-btn sm icon"
              aria-label="More actions"
              title="More actions"
              onClick={() => alert("More actions — wired in a follow-up")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Canvas wrap */}
        <div className="dr-canvas-wrap" ref={canvasWrapRef}>
          {/* Floating toolbar (left strip) — only when annotation is allowed */}
          {canAnnotate ? (
            <div className="dr-toolbar">
              <button
                className={`dr-tool${tool === "select" ? " active" : ""}`}
                onClick={() => {
                  setTool("select");
                  setAreaPoints([]);
                  setCalibrationPoints([]);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9V4a2 2 0 014 0v3M10 13V3a2 2 0 014 0v6M14 13V5a2 2 0 014 0v9M18 12a2 2 0 014 0v3a7 7 0 01-7 7h-2a7 7 0 01-5.66-2.92L3.5 15.5A2 2 0 016.5 13l1.5 2" />
                </svg>
                <span className="dr-tool-label">Pan</span>
              </button>
              <div className="dr-tool-sep" />
              <button
                className={`dr-tool${tool === "pen" ? " active" : ""}`}
                onClick={() => setTool("pen")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                  <path d="M2 2l7.586 7.586" />
                  <circle cx="11" cy="11" r="2" />
                </svg>
                <span className="dr-tool-label">Pen</span>
              </button>
              <button
                className={`dr-tool${tool === "text" ? " active" : ""}`}
                onClick={() => setTool("text")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line x1="9" y1="20" x2="15" y2="20" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
                <span className="dr-tool-label">Text</span>
              </button>
              <button
                className={`dr-tool${tool === "rect" ? " active" : ""}`}
                onClick={() => setTool("rect")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                <span className="dr-tool-label">Rectangle</span>
              </button>
              <button
                className={`dr-tool${tool === "circle" ? " active" : ""}`}
                onClick={() => setTool("circle")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                </svg>
                <span className="dr-tool-label">Circle</span>
              </button>
              <div className="dr-tool-sep" />
              <button
                className={`dr-tool${tool === "measure_linear" ? " active" : ""}${!calibration.scale ? " warn" : ""}`}
                onClick={() => setTool("measure_linear")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.3 15.3 15.3 21.3a1 1 0 0 1-1.4 0L2.7 10.1a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0l11.2 11.2a1 1 0 0 1 0 1.4z" />
                  <path d="m7.5 10.5 2 2M10.5 7.5l2 2M13.5 4.5l2 2M4.5 13.5l2 2" />
                </svg>
                <span className="dr-tool-label">
                  Measure{!calibration.scale ? " · calibrate first" : ""}
                </span>
              </button>
              <button
                className={`dr-tool${tool === "measure_area" ? " active" : ""}${!calibration.scale ? " warn" : ""}`}
                onClick={() => {
                  setTool("measure_area");
                  setAreaPoints([]);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="3 6 9 3 21 7 18 20 5 20 3 6" />
                </svg>
                <span className="dr-tool-label">Area (double-click to close)</span>
              </button>
              {canCalibrate ? (
                <button
                  className={`dr-tool${tool === "calibrate" ? " active warn" : " warn"}`}
                  onClick={() => {
                    setTool("calibrate");
                    setCalibrationPoints([]);
                  }}
                  title="Click two known points"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h4M17 12h4M12 3v4M12 17v4" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span className="dr-tool-label">Calibrate (2pt)</span>
                </button>
              ) : null}
              <div className="dr-tool-sep" />
              <button
                className={`dr-tool${tool === "comment" ? " active" : ""}`}
                onClick={() => setTool("comment")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
                <span className="dr-tool-label">Comment pin</span>
              </button>
              <div className="dr-tool-sep" />
              <button
                className="dr-tool"
                onClick={() => setMyMarkup((m) => m.slice(0, -1))}
                disabled={myMarkup.length === 0}
                style={myMarkup.length === 0 ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                </svg>
                <span className="dr-tool-label">Undo last markup</span>
              </button>
            </div>
          ) : null}

          {/* Compare banner */}
          {compareMode && compareAvailable ? (
            <div className="dr-compare-banner">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="7" height="16" rx="1" />
                <rect x="14" y="4" width="7" height="16" rx="1" />
                <line x1="12" y1="2" x2="12" y2="22" />
              </svg>
              Comparing <strong>v{set.version}</strong> (current) vs{" "}
              <strong>v{compare.priorSet?.version}</strong> · Red highlight shows changes
            </div>
          ) : null}

          {/* Sheet canvas — PDF + SVG overlay. In compare mode, split layout. */}
          <div className="dr-sheet-canvas">
            {compareMode ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  width: "100%",
                  alignItems: "start",
                }}
              >
                <div
                  ref={leftPdfWrapRef}
                  className="dr-pdf-wrap"
                  style={{ position: "relative" }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 6,
                      left: 8,
                      fontFamily: "DM Sans, system-ui",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#4a3fb0",
                      background: "#eeedfb",
                      border: "1px solid #c7c2ea",
                      borderRadius: 6,
                      padding: "2px 8px",
                      zIndex: 5,
                    }}
                  >
                    v{set.version} (current)
                  </div>
                  {presignedSourceUrl ? (
                    <PdfDocument
                      file={presignedSourceUrl}
                      loading={<div style={{ padding: 40, textAlign: "center" }}>Loading…</div>}
                    >
                      <PdfPage
                        pageNumber={pageNumber}
                        width={Math.floor(containerWidth / 2) - 8}
                        onRenderSuccess={() => setLeftRendered(true)}
                      />
                    </PdfDocument>
                  ) : (
                    <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 12.5 }}>
                      PDF unavailable
                    </div>
                  )}
                </div>
                <div
                  ref={rightPdfWrapRef}
                  className="dr-pdf-wrap"
                  style={{ position: "relative" }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 6,
                      left: 8,
                      fontFamily: "DM Sans, system-ui",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-secondary)",
                      background: "var(--surface-2)",
                      border: "1px solid var(--surface-3)",
                      borderRadius: 6,
                      padding: "2px 8px",
                      zIndex: 5,
                    }}
                  >
                    {compare.priorSet ? `v${compare.priorSet.version} (prior)` : "No prior"}
                  </div>
                  {compare.priorSheet && compare.priorPresignedSourceUrl && compareAvailable ? (
                    <>
                      <PdfDocument
                        file={compare.priorPresignedSourceUrl}
                        loading={<div style={{ padding: 40, textAlign: "center" }}>Loading…</div>}
                      >
                        <PdfPage
                          pageNumber={compare.priorSheet.pageIndex + 1}
                          width={Math.floor(containerWidth / 2) - 8}
                          onRenderSuccess={() => setRightRendered(true)}
                        />
                      </PdfDocument>
                      <canvas
                        ref={diffCanvasRef}
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          pointerEvents: "none",
                          opacity: diffReady ? 1 : 0,
                        }}
                      />
                    </>
                  ) : (
                    <div
                      style={{
                        padding: 40,
                        textAlign: "center",
                        color: "var(--text-secondary)",
                        background:
                          "repeating-linear-gradient(45deg,#fafaf8 0 10px,#f3f4f6 10px 20px)",
                        minHeight: 400,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontFamily: "DM Sans, system-ui",
                            fontSize: 15,
                            fontWeight: 700,
                            color: "var(--text-primary)",
                            marginBottom: 6,
                          }}
                        >
                          Not in prior version
                        </div>
                        <div style={{ fontSize: 12.5, maxWidth: 340 }}>
                          {sheet.sheetNumber} was added in v{set.version}.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="dr-pdf-wrap"
                style={{ width: containerWidth * zoom, minHeight: 600 }}
              >
                {presignedSourceUrl ? (
                  <PdfDocument
                    file={presignedSourceUrl}
                    loading={
                      <div style={{ padding: 40, textAlign: "center" }}>
                        Loading PDF…
                      </div>
                    }
                    onLoadError={(err: Error) =>
                      console.error("pdf load error", err)
                    }
                  >
                    <PdfPage
                      pageNumber={pageNumber}
                      width={containerWidth * zoom}
                      onRenderSuccess={() => {
                        const canvas = canvasWrapRef.current?.querySelector("canvas");
                        if (canvas && !pageSize) {
                          setPageSize({ w: canvas.width, h: canvas.height });
                        }
                      }}
                    />
                  </PdfDocument>
                ) : (
                  // Seed data or in-flight upload — no source PDF in R2 yet.
                  // Render a labeled placeholder so the overlay still has
                  // something to sit on top of and the UI doesn't look broken.
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "11 / 8.5",
                      background:
                        "repeating-linear-gradient(45deg,#fafaf8 0 14px,#f3f4f6 14px 28px)",
                      display: "grid",
                      placeItems: "center",
                      color: "var(--text-secondary)",
                      textAlign: "center",
                      padding: 24,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontFamily: "DM Sans, system-ui",
                          fontSize: 18,
                          fontWeight: 750,
                          letterSpacing: "-0.02em",
                          color: "var(--text-primary)",
                          marginBottom: 6,
                        }}
                      >
                        {sheet.sheetNumber} · {sheet.sheetTitle}
                      </div>
                      <div style={{ fontSize: 12.5, maxWidth: 380 }}>
                        PDF preview unavailable — source file not yet uploaded.
                        Markup, measurements, and comments still work against
                        this sheet&apos;s coordinate space.
                      </div>
                    </div>
                  </div>
                )}

                <svg
                  ref={svgRef}
                  className="dr-pdf-overlay"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{
                    width: "100%",
                    height: "100%",
                    cursor: tool === "select" ? "default" : "crosshair",
                    pointerEvents: canAnnotate && tool !== "select" ? "auto" : "none",
                  }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onDoubleClick={tool === "measure_area" ? handleAreaFinalize : undefined}
                >
                  {showMarkups && shouldRenderOthers
                    ? otherMarkupDocs.flatMap((doc) => {
                        const color = colorForUserId(doc.userId);
                        const shapes = (doc.markupData as MarkupShape[] | null) ?? [];
                        return shapes.map((m) => renderMarkup(doc.id, m, color, false));
                      })
                    : null}
                  {showMeasurements && shouldRenderOthers
                    ? otherMeasurementDocs.flatMap((doc) => {
                        const color = colorForUserId(doc.userId);
                        const shapes = (doc.measurementData as MeasurementShape[] | null) ?? [];
                        return shapes.map((m) => renderMeasurement(doc.id, m, color));
                      })
                    : null}
                  {showMarkups && shouldRenderMine
                    ? myMarkup.map((m) => renderMarkup("me", m, myColor, true))
                    : null}
                  {showMeasurements && shouldRenderMine
                    ? myMeasurements.map((m) => renderMeasurement("me", m, myColor))
                    : null}

                  {draftShape && "tool" in draftShape
                    ? renderMarkup("draft", draftShape, myColor, true)
                    : null}
                  {draftShape && "type" in draftShape
                    ? renderMeasurement("draft", draftShape as MeasurementShape, myColor)
                    : null}
                  {tool === "calibrate" && calibrationPoints.length === 1 ? (
                    <g style={{ pointerEvents: "none" }}>
                      <circle cx={calibrationPoints[0][0]} cy={calibrationPoints[0][1]} r={1.2} fill={myColor} stroke="#fff" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />
                      <text x={calibrationPoints[0][0] + 1.5} y={calibrationPoints[0][1] - 1} fontSize={1.8} fontFamily="DM Sans" fontWeight={650} fill={myColor}>
                        1
                      </text>
                    </g>
                  ) : null}
                  {tool === "measure_area" && areaPoints.length > 0 ? (
                    <g>
                      <polyline
                        points={areaPoints.map((p) => `${p[0]},${p[1]}`).join(" ")}
                        fill={myColor}
                        fillOpacity={0.08}
                        stroke={myColor}
                        strokeWidth={0.4}
                        strokeDasharray="1 0.8"
                        vectorEffect="non-scaling-stroke"
                      />
                      {areaPoints.map((p, i) => (
                        <circle key={i} cx={p[0]} cy={p[1]} r={0.6} fill={myColor} vectorEffect="non-scaling-stroke" />
                      ))}
                    </g>
                  ) : null}

                  {showComments
                    ? rootComments.map((c) => {
                        const color = colorForUserId(c.userId);
                        return (
                          <g
                            key={c.id}
                            className="pin"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedCommentId(c.id === selectedCommentId ? null : c.id);
                            }}
                            style={{ pointerEvents: "auto" }}
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
                      })
                    : null}

                  {pendingComment ? (
                    <g style={{ pointerEvents: "none" }}>
                      <circle
                        cx={pendingComment.x}
                        cy={pendingComment.y}
                        r={2.2}
                        fill={myColor}
                        stroke="#fff"
                        strokeWidth={0.5}
                        opacity={0.6}
                        vectorEffect="non-scaling-stroke"
                      />
                    </g>
                  ) : null}
                </svg>

                {textPrompt ? (
                  <div
                    style={{
                      position: "absolute",
                      left: `${textPrompt.x}%`,
                      top: `${textPrompt.y}%`,
                      transform: "translate(-4px, -12px)",
                      background: "#fff",
                      border: `1px solid ${myColor}`,
                      borderRadius: 6,
                      padding: 4,
                      boxShadow: "0 4px 12px rgba(0,0,0,.1)",
                      zIndex: 10,
                    }}
                  >
                    <input
                      autoFocus
                      type="text"
                      value={textDraft}
                      onChange={(e) => setTextDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitTextDraft();
                        if (e.key === "Escape") {
                          setTextPrompt(null);
                          setTextDraft("");
                        }
                      }}
                      onBlur={commitTextDraft}
                      style={{
                        border: "none",
                        outline: "none",
                        fontFamily: "DM Sans, system-ui",
                        fontSize: 12,
                        fontWeight: 650,
                        color: myColor,
                        width: 120,
                      }}
                      placeholder="Type text…"
                    />
                  </div>
                ) : null}

                {pendingComment ? (
                  <div
                    style={{
                      position: "absolute",
                      left: `${pendingComment.x}%`,
                      top: `${pendingComment.y}%`,
                      transform: "translate(16px, -8px)",
                      background: "#fff",
                      border: `1px solid ${myColor}`,
                      borderRadius: 8,
                      padding: 8,
                      boxShadow: "0 6px 18px rgba(0,0,0,.15)",
                      zIndex: 10,
                      width: 240,
                    }}
                  >
                    <textarea
                      autoFocus
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="Write a comment…"
                      style={{
                        width: "100%",
                        height: 56,
                        border: "1px solid var(--surface-3)",
                        borderRadius: 6,
                        padding: 6,
                        fontFamily: "Instrument Sans, system-ui",
                        fontSize: 12,
                        resize: "vertical",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginTop: 6,
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        className="dr-btn xs ghost"
                        onClick={() => {
                          setPendingComment(null);
                          setCommentDraft("");
                        }}
                        style={{ height: 26, padding: "0 8px", fontSize: 11 }}
                      >
                        Cancel
                      </button>
                      <button
                        className="dr-btn xs primary"
                        onClick={commitPendingComment}
                        disabled={!commentDraft.trim()}
                        style={{ height: 26, padding: "0 8px", fontSize: 11 }}
                      >
                        Post pin
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Zoom indicator */}
          {!compareMode ? (
            <div className="dr-zoom-indicator">
              <button onClick={() => stepZoom(-0.1)} aria-label="Zoom out">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button onClick={() => stepZoom(0.1)} aria-label="Zoom in">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* ───── Right comments panel ───── */}
      {showComments ? (
        <aside className="dr-comments-panel">
          <div className="dr-comments-hdr">
            <h3>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
              Comments
              {rootComments.length > 0 ? (
                <span className="dr-pill gray">{rootComments.length}</span>
              ) : null}
            </h3>
            <button
              className="dr-btn xs ghost"
              onClick={() => setShowComments(false)}
              aria-label="Close comments"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="dr-comments-list">
            {rootComments.length === 0 ? (
              <div
                style={{
                  padding: "30px 16px",
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: 12.5,
                  fontWeight: 520,
                }}
              >
                No comments on this sheet. Click the Comment tool then click the
                sheet to pin one.
              </div>
            ) : (
              rootComments.map((c) => {
                const color = colorForUserId(c.userId);
                const replies = localComments.filter((x) => x.parentCommentId === c.id);
                return (
                  <div
                    key={c.id}
                    className={`dr-comment${selectedCommentId === c.id ? " selected" : ""}${c.resolved ? " resolved" : ""}`}
                    onClick={() => setSelectedCommentId(c.id)}
                  >
                    <div className="dr-comment-top">
                      <div
                        className="dr-comment-pin"
                        style={{ background: c.resolved ? "#2d8a5e" : color }}
                      >
                        {c.pinNumber ?? "·"}
                      </div>
                      <div className="dr-comment-user">{c.userName ?? "Unknown"}</div>
                      <div className="dr-comment-time">
                        {new Date(c.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>
                    <div className="dr-comment-body">{c.text}</div>
                    <div className="dr-comment-footer">
                      {c.resolved ? (
                        <>
                          <span style={{ color: "#1e6b46", fontWeight: 650 }}>✓ Resolved</span>
                          {canAnnotate ? (
                            <button
                              className="dr-comment-reply-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleResolved(c);
                              }}
                            >
                              Reopen
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          {canAnnotate ? (
                            <button
                              className="dr-comment-reply-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplyingToCommentId(
                                  replyingToCommentId === c.id ? null : c.id,
                                );
                                setReplyDraft("");
                              }}
                            >
                              Reply{replies.length > 0 ? ` (${replies.length})` : ""}
                            </button>
                          ) : null}
                          {canAnnotate ? (
                            <>
                              <span>·</span>
                              <button
                                className="dr-comment-reply-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleResolved(c);
                                }}
                              >
                                Resolve
                              </button>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                    {replies.length > 0 ? (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        {replies.map((r) => (
                          <div
                            key={r.id}
                            style={{
                              background: "var(--surface-2)",
                              borderRadius: 8,
                              padding: "8px 10px",
                              fontSize: 12,
                              color: "var(--text-secondary)",
                            }}
                          >
                            <div style={{ fontWeight: 680, color: "var(--text-primary)", fontSize: 12, marginBottom: 2 }}>
                              {r.userName ?? "Unknown"}
                            </div>
                            <div>{r.text}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {replyingToCommentId === c.id ? (
                      <div
                        style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <textarea
                          autoFocus
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder="Reply…"
                          style={{
                            width: "100%",
                            minHeight: 54,
                            border: "1px solid var(--surface-3)",
                            borderRadius: 8,
                            padding: "6px 8px",
                            fontFamily: "Instrument Sans, system-ui",
                            fontSize: 12,
                            resize: "vertical",
                            background: "var(--surface-1)",
                          }}
                        />
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button
                            className="dr-btn xs ghost"
                            onClick={() => {
                              setReplyingToCommentId(null);
                              setReplyDraft("");
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            className="dr-btn xs primary"
                            disabled={!replyDraft.trim()}
                            onClick={() => postReply(c.id)}
                          >
                            Post reply
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          {canAnnotate ? (
            <div className="dr-comments-composer">
              <textarea
                placeholder={
                  tool === "comment"
                    ? "Click on the sheet to pin a comment…"
                    : "Type a general note, or switch to the Comment tool to pin at a location…"
                }
                value={panelCompose}
                onChange={(e) => setPanelCompose(e.target.value)}
              />
              <div className="dr-comments-composer-foot">
                <span>{panelCompose.length} chars</span>
                <button
                  className="dr-btn sm primary"
                  disabled={!panelCompose.trim() || panelPosting}
                  onClick={postPanelComment}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2 11 13" />
                    <path d="M22 2 15 22l-4-9-9-4 20-7z" />
                  </svg>
                  {panelPosting ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          ) : null}
        </aside>
      ) : null}
    </div>
  );
}

// ---- Render helpers (kept local to the module so they close over the
// overlay's 0–100 viewBox convention without threading width props) ----

function renderMarkup(
  docKey: string,
  m: MarkupShape,
  color: string,
  editable: boolean,
): React.ReactNode {
  const k = `${docKey}-${m.id}`;
  if (m.tool === "rect") {
    return (
      <g key={k} className="markup" style={editable ? { cursor: "pointer" } : undefined}>
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
        key={k}
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
        key={k}
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
      <text
        key={k}
        className="markup"
        x={m.x}
        y={m.y}
        fontSize={2}
        fontFamily="DM Sans"
        fontWeight={650}
        fill={color}
      >
        {m.text}
      </text>
    );
  }
  return null;
}

function renderMeasurement(
  docKey: string,
  m: MeasurementShape,
  color: string,
): React.ReactNode {
  const k = `${docKey}-${m.id}`;
  if (m.type === "linear") {
    const midx = (m.x1 + m.x2) / 2;
    const midy = (m.y1 + m.y2) / 2;
    return (
      <g key={k} className="measure">
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
    const cx = m.points.reduce((s, p) => s + p[0], 0) / m.points.length;
    const cy = m.points.reduce((s, p) => s + p[1], 0) / m.points.length;
    return (
      <g key={k} className="measure">
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
}
