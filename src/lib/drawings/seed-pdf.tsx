// Placeholder PDF generator for the drawings seed. Produces a
// multi-page PDF — one page per sheet — so seeded drawing sets have a
// real source file in R2 that the detail viewer can render. Uses the
// already-installed @react-pdf/renderer package; font choices stay on
// Helvetica (baked in) to avoid Node font-loading quirks.
//
// Each page is a 17×11 inch (letter landscape, but oversized to mimic
// architectural "D" sheets). A right-strip title block carries the
// project name, sheet number in a large mono font, and the sheet
// title. The drawing area on the left draws a discipline-themed
// schematic (walls + grids + dots) so the viewer has something
// recognizable to render — not the real drawing, obviously, but
// enough that demo screens don't look empty.

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Document,
  Page,
  StyleSheet,
  Svg,
  Text,
  View,
  pdf,
  Circle,
  Line,
  Rect,
} from "@react-pdf/renderer";
import React from "react";

type SeedSheet = {
  sheetNumber: string;
  sheetTitle: string;
  discipline: string | null;
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    padding: 0,
  },
  drawingArea: {
    position: "absolute",
    top: 30,
    left: 30,
    right: 170,
    bottom: 30,
  },
  titleBlock: {
    position: "absolute",
    top: 30,
    right: 30,
    bottom: 30,
    width: 140,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fafaf8",
    padding: 10,
  },
  tbLabel: {
    fontSize: 7,
    color: "#7d8290",
    letterSpacing: 0.8,
    fontWeight: 700,
    marginTop: 8,
    marginBottom: 2,
  },
  tbValue: {
    fontSize: 10,
    color: "#1a1714",
    fontWeight: 700,
  },
  tbSmall: {
    fontSize: 8,
    color: "#4a4f5c",
  },
  tbSheetNumber: {
    fontFamily: "Courier",
    fontSize: 26,
    color: "#1a1714",
    marginTop: 4,
    marginBottom: 6,
  },
  sep: {
    height: 1,
    backgroundColor: "#d1d5db",
    marginTop: 6,
    marginBottom: 2,
  },
});

function DisciplineSchematic({ discipline }: { discipline: string }) {
  // Simple SVG per discipline — the same pattern family the
  // client-side SheetThumbnailSvg uses, scaled up to fit the drawing
  // area. Keeps render cost tiny even for 30-sheet sets.
  const color =
    discipline === "S"
      ? "#276299"
      : discipline === "E"
        ? "#96600f"
        : discipline === "M" || discipline === "P"
          ? "#1f6b5c"
          : "#4a3fb0";

  if (discipline === "S") {
    return (
      <Svg viewBox="0 0 100 80" style={{ width: "100%", height: "100%" }}>
        {[15, 30, 48, 63].map((x) => (
          <Line
            key={x}
            x1={x}
            y1="15"
            x2={x}
            y2="70"
            strokeDasharray="1,1"
            stroke={color}
            strokeOpacity={0.5}
            strokeWidth={0.5}
          />
        ))}
        {[20, 35, 50, 65].map((y) => (
          <Line
            key={y}
            x1="10"
            y1={y}
            x2="68"
            y2={y}
            strokeDasharray="1,1"
            stroke={color}
            strokeOpacity={0.5}
            strokeWidth={0.5}
          />
        ))}
        {[15, 30, 48, 63].map((x) =>
          [20, 35, 50, 65].map((y) => (
            <Rect
              key={`${x}-${y}`}
              x={x - 1}
              y={y - 1}
              width={2}
              height={2}
              fill={color}
              fillOpacity={0.6}
            />
          )),
        )}
      </Svg>
    );
  }

  if (discipline === "E") {
    return (
      <Svg viewBox="0 0 100 80" style={{ width: "100%", height: "100%" }}>
        <Rect
          x="8"
          y="12"
          width="60"
          height="56"
          stroke={color}
          strokeOpacity={0.4}
          strokeWidth={0.5}
          fillOpacity={0}
        />
        {[20, 32, 44, 56].map((y) =>
          [15, 30, 45, 60].map((x) => (
            <Circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={0.8}
              fill={color}
              fillOpacity={0.5}
            />
          )),
        )}
      </Svg>
    );
  }

  if (discipline === "M") {
    return (
      <Svg viewBox="0 0 100 80" style={{ width: "100%", height: "100%" }}>
        <Rect x="8" y="12" width="60" height="56" stroke={color} strokeOpacity={0.4} strokeWidth={0.5} fillOpacity={0} />
        <Line x1="10" y1="20" x2="65" y2="20" stroke={color} strokeOpacity={0.5} strokeWidth={1} />
        <Line x1="65" y1="20" x2="65" y2="32" stroke={color} strokeOpacity={0.5} strokeWidth={1} />
        <Line x1="65" y1="32" x2="18" y2="32" stroke={color} strokeOpacity={0.5} strokeWidth={1} />
        <Line x1="18" y1="32" x2="18" y2="44" stroke={color} strokeOpacity={0.5} strokeWidth={1} />
        <Line x1="18" y1="44" x2="55" y2="44" stroke={color} strokeOpacity={0.5} strokeWidth={1} />
      </Svg>
    );
  }

  if (discipline === "P") {
    return (
      <Svg viewBox="0 0 100 80" style={{ width: "100%", height: "100%" }}>
        <Rect x="8" y="12" width="60" height="56" stroke={color} strokeOpacity={0.4} strokeWidth={0.5} fillOpacity={0} />
        <Line x1="14" y1="15" x2="14" y2="65" stroke={color} strokeOpacity={0.6} strokeWidth={1} />
        <Line x1="40" y1="15" x2="40" y2="65" stroke={color} strokeOpacity={0.6} strokeWidth={1} />
        <Circle cx="20" cy="25" r={2} stroke={color} strokeOpacity={0.6} strokeWidth={0.5} fillOpacity={0} />
        <Circle cx="20" cy="45" r={2} stroke={color} strokeOpacity={0.6} strokeWidth={0.5} fillOpacity={0} />
        <Circle cx="55" cy="25" r={2} stroke={color} strokeOpacity={0.6} strokeWidth={0.5} fillOpacity={0} />
      </Svg>
    );
  }

  // A / default
  return (
    <Svg viewBox="0 0 100 80" style={{ width: "100%", height: "100%" }}>
      <Rect x="8" y="12" width="60" height="56" stroke={color} strokeOpacity={0.5} strokeWidth={0.6} fillOpacity={0} />
      <Line x1="30" y1="12" x2="30" y2="68" stroke={color} strokeOpacity={0.5} strokeWidth={0.5} />
      <Line x1="48" y1="12" x2="48" y2="68" stroke={color} strokeOpacity={0.5} strokeWidth={0.5} />
      <Line x1="8" y1="36" x2="68" y2="36" stroke={color} strokeOpacity={0.5} strokeWidth={0.5} />
      <Line x1="8" y1="52" x2="68" y2="52" stroke={color} strokeOpacity={0.5} strokeWidth={0.5} />
    </Svg>
  );
}

function SheetPage({
  projectName,
  setName,
  version,
  sheet,
}: {
  projectName: string;
  setName: string;
  version: number;
  sheet: SeedSheet;
}) {
  return (
    <Page size={[1224, 792]} style={styles.page}>
      <View style={styles.drawingArea}>
        <DisciplineSchematic discipline={sheet.discipline ?? "A"} />
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.tbLabel}>PROJECT</Text>
        <Text style={styles.tbValue}>{projectName}</Text>
        <View style={styles.sep} />
        <Text style={styles.tbLabel}>SHEET</Text>
        <Text style={styles.tbSheetNumber}>{sheet.sheetNumber}</Text>
        <Text style={styles.tbLabel}>TITLE</Text>
        <Text style={styles.tbValue}>{sheet.sheetTitle}</Text>
        <View style={styles.sep} />
        <Text style={styles.tbLabel}>SET</Text>
        <Text style={styles.tbSmall}>
          {setName} v{version}
        </Text>
        <View style={styles.sep} />
        <Text style={styles.tbLabel}>DISCIPLINE</Text>
        <Text style={styles.tbSmall}>{sheet.discipline ?? "—"}</Text>
      </View>
    </Page>
  );
}

export async function generateSeedSheetSetPdf(input: {
  projectName: string;
  setName: string;
  version: number;
  sheets: SeedSheet[];
}): Promise<Buffer> {
  const doc = (
    <Document>
      {input.sheets.map((s, i) => (
        <SheetPage
          key={i}
          projectName={input.projectName}
          setName={input.setName}
          version={input.version}
          sheet={s}
        />
      ))}
    </Document>
  );
  // @react-pdf/renderer's `pdf()` returns an instance whose `.toBuffer()`
  // resolves to a Node Buffer. The Next app runtime never calls this;
  // it only runs from the seed script.
  const instance = pdf(doc as any);
  const buf = await instance.toBuffer();
  // Some @react-pdf versions return a stream here instead of a Buffer.
  if (Buffer.isBuffer(buf)) return buf;
  // Convert readable stream → Buffer.
  const stream = buf as unknown as NodeJS.ReadableStream;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
