/* eslint-disable react/jsx-key, jsx-a11y/alt-text */
// jsx-a11y/alt-text is disabled because @react-pdf/renderer's `<Image>` is
// not the HTML img element — it doesn't accept an `alt` prop. The lint
// rule fires regardless.
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { ResidentialReshapedReport } from "@/domain/loaders/weekly-reports-residential";

// Same shape as commercial-pdf: documentId → presigned download URL.
// Falls back to caption tile when a documentId isn't in the map.
export type PhotoUrlMap = Map<string, string>;

// Residential weekly-report PDF document. Warmer treatment matching the
// on-screen "This week at your home" view: warm header gradient (solid
// fill since PDF doesn't render CSS gradients well), big sentence
// headline, then five card sections (progress, what we need, photos,
// decisions, coming up).

const COLORS = {
  warm: "#a86b2f",
  warmSoft: "#f7ecd9",
  warmBorder: "#e6c79a",
  text: "#1a1714",
  textMuted: "#6b655b",
  textFaint: "#9c958a",
  border: "#d1d5db",
  borderSoft: "#e2e5e9",
  surface: "#ffffff",
  surfaceSoft: "#f3f4f6",
  green: "#1e6b46",
  greenSoft: "#edf7f1",
  amber: "#96600f",
  amberSoft: "#fdf4e6",
  blue: "#276299",
  blueSoft: "#e8f1fa",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.5,
  },
  hero: {
    backgroundColor: COLORS.warmSoft,
    border: `1 solid ${COLORS.warmBorder}`,
    borderRadius: 8,
    padding: 22,
    marginBottom: 18,
  },
  heroKicker: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.warm,
    letterSpacing: 1.5,
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: COLORS.text,
    marginBottom: 10,
    lineHeight: 1.25,
  },
  heroBody: {
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 1.55,
  },
  heroMeta: {
    fontSize: 9,
    color: COLORS.textFaint,
    marginTop: 10,
  },
  card: {
    backgroundColor: COLORS.surface,
    border: `1 solid ${COLORS.borderSoft}`,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardWarm: {
    border: `1 solid ${COLORS.warmBorder}`,
    backgroundColor: COLORS.warmSoft,
  },
  kicker: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: COLORS.warm,
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  cardHeading: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  cardBody: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 1.55,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.surfaceSoft,
    border: `0.5 solid ${COLORS.borderSoft}`,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 6,
  },
  progressLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  pill: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillGreen: { backgroundColor: COLORS.greenSoft, color: COLORS.green },
  pillAmber: { backgroundColor: COLORS.amberSoft, color: COLORS.amber },
  pillBlue: { backgroundColor: COLORS.blueSoft, color: COLORS.blue },
  decisionRow: {
    paddingVertical: 8,
    borderBottom: `0.5 dashed ${COLORS.borderSoft}`,
  },
  decisionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 3,
  },
  decisionDetail: {
    fontSize: 9,
    color: COLORS.textMuted,
    lineHeight: 1.5,
  },
  bulletItem: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottom: `0.5 dashed ${COLORS.borderSoft}`,
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 99,
    backgroundColor: COLORS.warm,
    marginRight: 8,
    marginTop: 4,
  },
  bulletText: { fontSize: 10, flex: 1 },
  pendingActionRow: {
    backgroundColor: COLORS.surface,
    border: `0.5 solid ${COLORS.borderSoft}`,
    borderRadius: 4,
    padding: 8,
    marginTop: 6,
  },
  pendingActionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  pendingActionDetail: {
    fontSize: 9,
    color: COLORS.textFaint,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  photoTile: {
    width: 110,
    height: 75,
    backgroundColor: COLORS.warmSoft,
    border: `0.5 solid ${COLORS.warmBorder}`,
    position: "relative",
  },
  photoImage: {
    width: 110,
    height: 75,
    objectFit: "cover",
  },
  photoCaptionOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  photoCaptionText: {
    fontSize: 7,
    color: "#ffffff",
  },
  photoCaptionFallback: {
    fontSize: 8,
    color: COLORS.textMuted,
    padding: 6,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: COLORS.textFaint,
    textAlign: "center",
  },
});

const PROGRESS_LABEL = {
  done: "Done",
  in_progress: "In progress",
  arrived: "Arrived",
  upcoming: "Coming up",
} as const;

function progressPillStyle(status: keyof typeof PROGRESS_LABEL) {
  if (status === "done" || status === "arrived")
    return [styles.pill, styles.pillGreen];
  if (status === "in_progress") return [styles.pill, styles.pillAmber];
  return [styles.pill, styles.pillBlue];
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function ResidentialReportDocument({
  reshaped,
  homeName,
  photoUrls,
}: {
  reshaped: ResidentialReshapedReport;
  homeName: string;
  photoUrls?: PhotoUrlMap;
}) {
  const urlMap = photoUrls ?? new Map<string, string>();
  return (
    <Document
      title={`This week at your home — ${formatWeekRange(reshaped.weekStart, reshaped.weekEnd)}`}
      author={reshaped.sentByName ?? "BuiltCRM"}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.hero}>
          <Text style={styles.heroKicker}>
            THIS WEEK AT YOUR HOME · {formatWeekShort(reshaped.weekStart, reshaped.weekEnd)}
          </Text>
          <Text style={styles.heroTitle}>
            {extractHeroSentence(reshaped.heroNarrative) ??
              `A short recap from your team at ${homeName}.`}
          </Text>
          {reshaped.heroNarrative && (
            <Text style={styles.heroBody}>{reshaped.heroNarrative}</Text>
          )}
          <Text style={styles.heroMeta}>
            {reshaped.sentByName
              ? `From ${reshaped.sentByName}`
              : "From the team"}
            {reshaped.sentAt
              ? ` — sent ${formatDateTime(reshaped.sentAt)}`
              : ""}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.kicker}>ON SITE THIS WEEK</Text>
          <Text style={styles.cardHeading}>Progress this week</Text>
          {reshaped.progress.length === 0 ? (
            <Text style={styles.cardBody}>
              Quiet week — no major milestones, but the crew was on site.
            </Text>
          ) : (
            reshaped.progress.map((p, i) => (
              <View key={`${p.label}-${i}`} style={styles.progressRow}>
                <Text style={styles.progressLabel}>{p.label}</Text>
                <Text style={progressPillStyle(p.status)}>
                  {PROGRESS_LABEL[p.status]}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, styles.cardWarm]}>
          <Text style={styles.kicker}>ANYTHING FOR YOU TO DO?</Text>
          <Text style={styles.cardHeading}>What we need from you</Text>
          <Text style={styles.cardBody}>{reshaped.pendingActionsSummary}</Text>
          {reshaped.pendingActions.map((a, i) => (
            <View key={`${a.title}-${i}`} style={styles.pendingActionRow}>
              <Text style={styles.pendingActionTitle}>{a.title}</Text>
              <Text style={styles.pendingActionDetail}>{a.detail}</Text>
            </View>
          ))}
        </View>

        {reshaped.photos.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.kicker}>A PEEK AT THE WEEK</Text>
            <Text style={styles.cardHeading}>Photos from your home</Text>
            <View style={styles.photoGrid}>
              {reshaped.photos.slice(0, 8).map((p) => (
                <PhotoTile
                  key={p.photoId}
                  documentId={p.documentId}
                  caption={p.caption}
                  urlMap={urlMap}
                />
              ))}
            </View>
          </View>
        )}

        {reshaped.decisions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.kicker}>DECISIONS &amp; UPDATES</Text>
            <Text style={styles.cardHeading}>What got decided</Text>
            {reshaped.decisions.map((d, i) => (
              <View key={`${d.title}-${i}`} style={styles.decisionRow}>
                <Text style={styles.decisionTitle}>{d.title}</Text>
                <Text style={styles.decisionDetail}>{d.detail}</Text>
              </View>
            ))}
          </View>
        )}

        {reshaped.upcoming.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.kicker}>LOOKING AHEAD</Text>
            <Text style={styles.cardHeading}>Coming up next week</Text>
            {reshaped.upcoming.map((t, i) => (
              <View key={`${t}-${i}`} style={styles.bulletItem}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
            `${homeName} · Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

function PhotoTile({
  documentId,
  caption,
  urlMap,
}: {
  documentId: string;
  caption: string | null;
  urlMap: PhotoUrlMap;
}) {
  const url = urlMap.get(documentId);
  if (url) {
    return (
      <View style={styles.photoTile}>
        <Image src={url} style={styles.photoImage} />
        {caption && (
          <View style={styles.photoCaptionOverlay}>
            <Text style={styles.photoCaptionText}>{caption}</Text>
          </View>
        )}
      </View>
    );
  }
  return (
    <View style={styles.photoTile}>
      <Text style={styles.photoCaptionFallback}>{caption ?? "Untitled"}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractHeroSentence(narrative: string | null): string | null {
  if (!narrative) return null;
  const trimmed = narrative.trim();
  const m = trimmed.match(/^(.*?[.!?])(\s|$)/);
  return (m ? m[1] : trimmed).trim();
}

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatWeekShort(weekStart: string, weekEnd: string): string {
  const a = parseLocalDate(weekStart);
  const b = parseLocalDate(weekEnd);
  const fmtMD = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmtMD(a)} – ${fmtMD(b)}`;
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const a = parseLocalDate(weekStart);
  const b = parseLocalDate(weekEnd);
  const fmtMD = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  return `${fmtMD(a)} – ${fmtMD(b)}, ${b.getUTCFullYear()}`;
}

function formatDateTime(d: Date): string {
  return new Date(d).toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
