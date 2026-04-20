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
  presignedSourceUrl: string;
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

  // Narrow-viewport state — drives the simplified mobile toolset (pen +
  // comment only) and also gates the touch-action CSS used by the canvas
  // pinch-zoom support.
  const [narrowViewport, setNarrowViewport] = useState(false);
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

  // Calibration — quick prompt variant; two-point lands next chunk.
  const handleCalibrate = useCallback(async () => {
    if (!canCalibrate) return;
    const entered = window.prompt(
      'Enter drawing scale (e.g. \'1/8" = 1\'-0"\'):',
      calibration.scale ?? '1/8" = 1\'-0"',
    );
    if (!entered) return;
    try {
      const res = await fetch(
        `/api/drawings/sheets/${sheet.id}/calibration`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scale: entered, source: "manual" }),
        },
      );
      if (!res.ok) throw new Error(`calibration ${res.status}`);
      router.refresh();
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : String(err));
    }
  }, [canCalibrate, sheet.id, calibration.scale, router]);

  const base = portalBase(portal, projectId);
  const currentIdx = sheetSiblings.findIndex((s) => s.id === sheet.id);
  const prev = currentIdx > 0 ? sheetSiblings[currentIdx - 1] : null;
  const next =
    currentIdx >= 0 && currentIdx < sheetSiblings.length - 1
      ? sheetSiblings[currentIdx + 1]
      : null;

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

        {canAnnotate ? (
          <div
            className={narrowViewport ? "dr-tool-strip-simplified" : undefined}
            style={{
              display: "flex",
              gap: 4,
              padding: 3,
              borderRadius: 10,
              background: "var(--surface-2)",
              marginLeft: 12,
            }}
          >
            {([
              ["select", "Pan"],
              ["pen", "Pen"],
              ["rect", "Rect"],
              ["circle", "Circle"],
              ["text", "Text"],
              ["measure_linear", "L-Measure"],
              ["measure_area", "Area"],
              ["comment", "Comment"],
              ...(canCalibrate
                ? ([["calibrate", "Calibrate"]] as Array<[Tool, string]>)
                : []),
            ] as Array<[Tool, string]>).map(([t, label]) => (
              <button
                key={t}
                className={`dr-btn xs t-${t.replace("_", "-")} ${tool === t ? "primary" : "ghost"}`}
                onClick={() => {
                  setTool(t);
                  if (t !== "measure_area") setAreaPoints([]);
                  if (t !== "calibrate") setCalibrationPoints([]);
                }}
                style={{ height: 28, padding: "0 10px", fontSize: 11 }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {saveState === "saving" ? (
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              Saving…
            </span>
          ) : saveState === "saved" ? (
            <span style={{ fontSize: 11, color: "#1e6b46" }}>Saved</span>
          ) : saveState === "error" ? (
            <span
              style={{ fontSize: 11, color: "#a52e2e" }}
              title={saveError ?? undefined}
            >
              Save failed
            </span>
          ) : null}

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
                window.location.href = `${base}/drawings/${nextSetId}`;
              }
            }}
            style={{ minWidth: 160 }}
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
          >
            Markup
          </button>
          <button
            className={`dr-btn sm ${showMeasurements ? "" : "ghost"}`}
            onClick={() => setShowMeasurements((v) => !v)}
          >
            Measure
          </button>
          <button
            className={`dr-btn sm ${showComments ? "" : "ghost"}`}
            onClick={() => setShowComments((v) => !v)}
          >
            Comments
          </button>
          <select
            className="dr-btn sm"
            value={layerFilter}
            onChange={(e) => setLayerFilter(e.target.value as typeof layerFilter)}
          >
            <option value="all">All layers</option>
            <option value="mine">Mine only</option>
            <option value="contractor">Contractor</option>
            <option value="subs">Subs</option>
          </select>

          {compareAvailable || compareUnmatchedAvailable ? (
            <button
              className={`dr-btn sm ${compareMode ? "primary" : ""}`}
              onClick={() => {
                setCompareMode((v) => !v);
                // Reset render flags so the diff effect re-runs on toggle.
                setLeftRendered(false);
                setRightRendered(false);
              }}
              title={
                compare.priorSet
                  ? `Compare against ${compare.priorSet.name} v${compare.priorSet.version}`
                  : "Compare versions"
              }
            >
              {compareMode ? "Exit compare" : "Compare"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Canvas */}
      <div className="dr-detail-canvas" ref={canvasWrapRef}>
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
            {/* Left = current version */}
            <div
              ref={leftPdfWrapRef}
              className="dr-detail-pdf-wrap"
              style={{ background: "#fff", position: "relative" }}
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
            </div>

            {/* Right = prior version (or "not in prior version" card) */}
            <div
              ref={rightPdfWrapRef}
              className="dr-detail-pdf-wrap"
              style={{ background: "#fff", position: "relative" }}
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
                {compare.priorSet
                  ? `v${compare.priorSet.version} (prior)`
                  : "No prior version"}
              </div>
              {compare.priorSheet &&
              compare.priorPresignedSourceUrl &&
              compareAvailable ? (
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
                  {/* Diff overlay — positioned over the right pane's canvas.
                      canvas:first-of-type targets the pdf canvas; our diff
                      canvas sits absolutely on top of it. Opacity lives in
                      the pixel alpha so we don't double-dim. */}
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
                      {compare.priorSet
                        ? ` No sheet with this number exists in ${compare.priorSet.name} v${compare.priorSet.version}.`
                        : ""}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Diff summary strip */}
            <div
              style={{
                gridColumn: "1 / span 2",
                fontSize: 11.5,
                color: "var(--text-secondary)",
                textAlign: "center",
                padding: "4px 0",
                fontWeight: 520,
              }}
            >
              {compareAvailable
                ? diffReady
                  ? `Differences highlighted in red (${DIFF_THRESHOLD}/255 luminance threshold).`
                  : leftRendered && rightRendered
                    ? "Computing diff…"
                    : "Rendering both versions…"
                : "Sheet added in this version — nothing to diff."}
            </div>
          </div>
        ) : (
        <div
          className="dr-detail-pdf-wrap"
          style={{
            width: containerWidth,
            height: pageSize ? pageHeightPx : undefined,
            minHeight: 600,
          }}
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
                const canvas = canvasWrapRef.current?.querySelector("canvas");
                if (canvas && !pageSize) {
                  setPageSize({ w: canvas.width, h: canvas.height });
                }
              }}
            />
          </PdfDocument>

          <svg
            ref={svgRef}
            className="dr-detail-overlay"
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
            {/* Other users' markup + measurements (read-only) */}
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
                  const shapes =
                    (doc.measurementData as MeasurementShape[] | null) ?? [];
                  return shapes.map((m) => renderMeasurement(doc.id, m, color));
                })
              : null}

            {/* My markup + measurements (editable) */}
            {showMarkups && shouldRenderMine
              ? myMarkup.map((m) => renderMarkup("me", m, myColor, true))
              : null}
            {showMeasurements && shouldRenderMine
              ? myMeasurements.map((m) => renderMeasurement("me", m, myColor))
              : null}

            {/* Draft shape preview (during drag) */}
            {draftShape && "tool" in draftShape
              ? renderMarkup("draft", draftShape, myColor, true)
              : null}
            {draftShape && "type" in draftShape
              ? renderMeasurement("draft", draftShape as MeasurementShape, myColor)
              : null}
            {tool === "calibrate" && calibrationPoints.length === 1 ? (
              <g style={{ pointerEvents: "none" }}>
                <circle
                  cx={calibrationPoints[0][0]}
                  cy={calibrationPoints[0][1]}
                  r={1.2}
                  fill={myColor}
                  stroke="#fff"
                  strokeWidth={0.3}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={calibrationPoints[0][0] + 1.5}
                  y={calibrationPoints[0][1] - 1}
                  fontSize={1.8}
                  fontFamily="DM Sans"
                  fontWeight={650}
                  fill={myColor}
                >
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
                  <circle
                    key={i}
                    cx={p[0]}
                    cy={p[1]}
                    r={0.6}
                    fill={myColor}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            ) : null}

            {/* Comment pins */}
            {showComments
              ? rootComments.map((c) => {
                  const color = colorForUserId(c.userId);
                  return (
                    <g
                      key={c.id}
                      className="pin"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCommentId(
                          c.id === selectedCommentId ? null : c.id,
                        );
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

            {/* Pending comment pin preview */}
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

          {/* Inline text-draft prompt (appears at click position) */}
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
              <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
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
          <div
            className="dr-side-title"
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span>Calibration</span>
            {canCalibrate ? (
              <button
                className="dr-btn xs ghost"
                onClick={handleCalibrate}
                style={{ height: 22, padding: "0 6px", fontSize: 10 }}
              >
                Set
              </button>
            ) : null}
          </div>
          {calibration.scale ? (
            <div style={{ fontSize: 12 }}>
              <div style={{ fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>
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
              Not calibrated. Linear + area labels show raw values until a
              scale is set.
            </div>
          )}
        </div>

        <div>
          <div className="dr-side-title">Comments ({rootComments.length})</div>
          <div className="dr-comment-list">
            {rootComments.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                No comments. Pick the Comment tool and click the sheet to add one.
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

        {canAnnotate ? (
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
        ) : (
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              borderTop: "1px solid var(--surface-3)",
              paddingTop: 10,
            }}
          >
            Read-only view — markup and comment tools are disabled for your
            role.
          </div>
        )}
      </aside>
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
