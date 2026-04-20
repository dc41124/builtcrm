// Sheet number + title extraction from a multi-page PDF via pdfjs-dist.
//
// We don't render pages on the server — that needs node-canvas (native)
// which complicates the deploy. Instead we extract positioned text items
// and run a narrow regex against the items likely to live in the title
// block (rightmost ~22% of the page at any y). The viewer lazily renders
// thumbnails client-side and posts them back (see the thumbnail route).
//
// Sheet number patterns are construction-conventional:
//   A-101, A101, A-100A, S-1.01, E-2.02A, M-001, P-101, C-200, etc.
// The leading alpha prefix maps to a discipline char (see inferDiscipline).
// Misses fall back to "SHT-{pageIndex+1}" with auto_detected=false so the
// contractor can edit.

export type ExtractedSheet = {
  pageIndex: number;
  sheetNumber: string;
  sheetTitle: string;
  discipline: string | null;
  autoDetected: boolean;
};

const SHEET_NUMBER_RE = /\b([A-Z]{1,3})-?(\d{1,3}(?:\.\d{1,2})?[A-Z]?)\b/;

// Discipline prefix map. Single-char codes match drawing_sheets.discipline
// and project_organization_memberships.scope_discipline. Anything not in
// this map is stored as null (uncoded — shows under "Other" in the UI).
const DISCIPLINE_MAP: Record<string, string> = {
  A: "A", // Architectural
  S: "S", // Structural
  E: "E", // Electrical
  M: "M", // Mechanical
  P: "P", // Plumbing
  C: "C", // Civil
  L: "L", // Landscape
  I: "I", // Interiors
  G: "G", // General
  T: "T", // Telecom / Low voltage
  FP: "F", // Fire protection
  FS: "F",
  AS: "A",
};

export function inferDiscipline(prefix: string): string | null {
  const upper = prefix.toUpperCase();
  return DISCIPLINE_MAP[upper] ?? DISCIPLINE_MAP[upper[0]] ?? null;
}

// Run against an already-loaded pdfjs document. Returns per-page results.
// The pdfjs import is done by the caller so the heavy dep stays out of
// code paths that don't need it (e.g. the viewer reads pdfjs in the
// browser, the extraction route reads it on the server).
type PdfDocument = {
  numPages: number;
  getPage: (n: number) => Promise<PdfPage>;
};
type PdfPage = {
  getTextContent: () => Promise<{
    items: Array<{ str: string; transform: number[]; width?: number }>;
  }>;
  getViewport: (opts: { scale: number }) => { width: number; height: number };
};

export async function extractSheetsFromPdf(
  doc: PdfDocument,
): Promise<ExtractedSheet[]> {
  const out: ExtractedSheet[] = [];
  for (let pageIndex = 0; pageIndex < doc.numPages; pageIndex++) {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    // Title block heuristic: rightmost strip of the page. pdfjs text items
    // carry a transform matrix [a, b, c, d, e, f] — e is x, f is y.
    const cutoff = viewport.width * 0.78;
    const rightItems = content.items.filter((i) => {
      const x = i.transform?.[4] ?? 0;
      return x >= cutoff && i.str && i.str.trim().length > 0;
    });

    // First pass: sheet number in the title block strip.
    let sheetNumber: string | null = null;
    let prefix: string | null = null;
    for (const item of rightItems) {
      const m = item.str.match(SHEET_NUMBER_RE);
      if (m) {
        sheetNumber = `${m[1]}-${m[2]}`;
        prefix = m[1];
        break;
      }
    }

    // Fallback: scan entire page.
    if (!sheetNumber) {
      for (const item of content.items) {
        const m = item.str.match(SHEET_NUMBER_RE);
        if (m) {
          sheetNumber = `${m[1]}-${m[2]}`;
          prefix = m[1];
          break;
        }
      }
    }

    const autoDetected = !!sheetNumber;
    if (!sheetNumber) {
      sheetNumber = `SHT-${pageIndex + 1}`;
    }

    // Title heuristic: longest text item in the right strip that isn't the
    // sheet number itself. Real title-block parsing is deep work (templates
    // per firm); this is the 80% solution.
    let sheetTitle = "";
    let longest = 0;
    for (const item of rightItems) {
      const s = item.str.trim();
      if (!s || s === sheetNumber) continue;
      if (SHEET_NUMBER_RE.test(s)) continue;
      if (s.length > longest && s.length <= 80) {
        longest = s.length;
        sheetTitle = s;
      }
    }
    if (!sheetTitle) sheetTitle = `Sheet ${pageIndex + 1}`;

    out.push({
      pageIndex,
      sheetNumber,
      sheetTitle,
      discipline: prefix ? inferDiscipline(prefix) : null,
      autoDetected,
    });
  }
  return out;
}

// Loader wrapper that imports pdfjs lazily so the drawings module doesn't
// pull the ~600KB library into unrelated code paths. Node-side only — the
// viewer uses react-pdf in the browser.
export async function loadPdfFromBuffer(data: Uint8Array): Promise<PdfDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // The legacy build runs without a worker when no workerSrc is set, which
  // is what we want in a Node route handler. useSystemFonts lets pdfjs
  // fall back to host fonts when the PDF embeds unknowns — good enough
  // for text extraction where glyph fidelity doesn't matter.
  const loadingTask = pdfjs.getDocument({
    data,
    useSystemFonts: true,
  });
  return (await loadingTask.promise) as unknown as PdfDocument;
}
