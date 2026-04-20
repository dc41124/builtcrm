"use client";

// Stylized per-discipline architectural SVG thumbnail. Ported directly
// from the prototype at docs/specs/builtcrm_drawings_module.jsx — used
// on the sheet index whenever we don't have a real PNG thumbnail yet
// (or for share/demo where the real PDF page isn't worth rendering).
// The real thumbnail (when present) takes priority via thumbnailUrl.

export const DISCIPLINE_COLORS: Record<
  string,
  { bg: string; text: string; border: string; label: string }
> = {
  A: { bg: "#eeedfb", text: "#4a3fb0", border: "#c7c2ea", label: "Architectural" },
  S: { bg: "#e8f1fa", text: "#276299", border: "#b3d1ec", label: "Structural" },
  E: { bg: "#fdf4e6", text: "#96600f", border: "#f0cc8a", label: "Electrical" },
  M: { bg: "#e6f5f1", text: "#1f6b5c", border: "#b0d9cf", label: "Mechanical" },
  P: { bg: "#e8f1fa", text: "#276299", border: "#b3d1ec", label: "Plumbing" },
  C: { bg: "#fdf4e6", text: "#96600f", border: "#f0cc8a", label: "Civil" },
  L: { bg: "#e6f5f1", text: "#1f6b5c", border: "#b0d9cf", label: "Landscape" },
  I: { bg: "#eeedfb", text: "#4a3fb0", border: "#c7c2ea", label: "Interiors" },
  G: { bg: "#eeedfb", text: "#4a3fb0", border: "#c7c2ea", label: "General" },
  T: { bg: "#e8f1fa", text: "#276299", border: "#b3d1ec", label: "Telecom" },
  F: { bg: "#fdeaea", text: "#a52e2e", border: "#e8b4b4", label: "Fire Protection" },
};

export function DisciplineTag({ code, count }: { code: string; count?: number }) {
  const d = DISCIPLINE_COLORS[code] ?? DISCIPLINE_COLORS.A;
  return (
    <span
      className="dr-set-disc-tag"
      style={{ background: d.bg, color: d.text, border: `1px solid ${d.border}` }}
    >
      {code}
      {count !== undefined ? ` · ${count}` : ""}
    </span>
  );
}

// ---- Per-discipline preview SVG ---------------------------------------
// Each discipline renders a characteristic content pattern:
//   A — walls + doors + column dots
//   S — structural grid with column bubbles
//   E — fixture dots + run line
//   M — ducted routing with rectangle diffusers
//   P — vertical stacks + fixtures
// Any other discipline falls back to the A pattern.

export function SheetThumbnailSvg({
  discipline,
  sheetNumber,
}: {
  discipline: string | null;
  sheetNumber: string;
}) {
  const disc = discipline ?? "A";
  const d = DISCIPLINE_COLORS[disc] ?? DISCIPLINE_COLORS.A;
  return (
    <svg viewBox="0 0 100 80" preserveAspectRatio="xMidYMid meet">
      {/* sheet background */}
      <rect x="2" y="2" width="96" height="76" fill="#ffffff" stroke="#d1d5db" strokeWidth=".5" />
      {/* title block (right strip) */}
      <rect x="75" y="4" width="21" height="72" fill="#f3f4f6" stroke="#e2e5e9" strokeWidth=".3" />
      <line x1="75" y1="20" x2="96" y2="20" stroke="#d1d5db" strokeWidth=".3" />
      <line x1="75" y1="55" x2="96" y2="55" stroke="#d1d5db" strokeWidth=".3" />
      <text
        x="85.5"
        y="14"
        textAnchor="middle"
        fontSize="5"
        fontFamily="JetBrains Mono, monospace"
        fill="#9c958a"
        fontWeight="500"
      >
        {sheetNumber}
      </text>

      {/* discipline-specific content */}
      {disc === "A" || !["S", "E", "M", "P"].includes(disc) ? (
        <g stroke={d.text} strokeWidth=".4" fill="none" opacity=".5">
          <rect x="8" y="12" width="60" height="56" />
          <line x1="30" y1="12" x2="30" y2="68" />
          <line x1="48" y1="12" x2="48" y2="68" />
          <line x1="8" y1="36" x2="68" y2="36" />
          <line x1="8" y1="52" x2="68" y2="52" />
          <circle cx="15" cy="19" r="1.5" fill={d.text} opacity=".3" />
          <circle cx="36" cy="44" r="1" fill={d.text} opacity=".3" />
        </g>
      ) : null}

      {disc === "S" ? (
        <g stroke={d.text} strokeWidth=".5" fill="none" opacity=".5">
          <line x1="10" y1="20" x2="68" y2="20" />
          <line x1="10" y1="35" x2="68" y2="35" />
          <line x1="10" y1="50" x2="68" y2="50" />
          <line x1="10" y1="65" x2="68" y2="65" />
          <line x1="15" y1="15" x2="15" y2="70" />
          <line x1="30" y1="15" x2="30" y2="70" />
          <line x1="48" y1="15" x2="48" y2="70" />
          <line x1="63" y1="15" x2="63" y2="70" />
          <rect x="14" y="19" width="2" height="2" fill={d.text} />
          <rect x="29" y="19" width="2" height="2" fill={d.text} />
          <rect x="47" y="19" width="2" height="2" fill={d.text} />
          <rect x="62" y="19" width="2" height="2" fill={d.text} />
        </g>
      ) : null}

      {disc === "E" ? (
        <g stroke={d.text} strokeWidth=".3" fill="none" opacity=".5">
          <rect x="8" y="12" width="60" height="56" />
          {[20, 30, 40, 50, 60].flatMap((y) =>
            [15, 30, 45, 60].map((x) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r=".8" fill={d.text} />
            )),
          )}
          <path d="M 15 20 L 30 20 L 30 30 L 45 30" strokeDasharray="1,1" />
        </g>
      ) : null}

      {disc === "M" ? (
        <g stroke={d.text} strokeWidth=".4" fill="none" opacity=".5">
          <rect x="8" y="12" width="60" height="56" />
          <path d="M 10 18 L 65 18 L 65 28 L 18 28 L 18 38 L 55 38 L 55 50 L 25 50 L 25 62 L 50 62" />
          <rect x="50" y="30" width="4" height="6" fill={d.text} opacity=".5" />
          <rect x="20" y="42" width="4" height="6" fill={d.text} opacity=".5" />
        </g>
      ) : null}

      {disc === "P" ? (
        <g stroke={d.text} strokeWidth=".4" fill="none" opacity=".5">
          <rect x="8" y="12" width="60" height="56" />
          <path d="M 12 15 L 12 68" />
          <path d="M 40 15 L 40 68" />
          <circle cx="20" cy="25" r="2" />
          <circle cx="20" cy="45" r="2" />
          <circle cx="55" cy="25" r="2" />
          <circle cx="55" cy="55" r="2" />
          <line x1="20" y1="25" x2="40" y2="25" />
          <line x1="40" y1="45" x2="20" y2="45" />
        </g>
      ) : null}
    </svg>
  );
}
