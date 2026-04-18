import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

import type {
  DailyLogDetailFull,
  DailyLogDetailRedacted,
} from "@/domain/loaders/daily-logs";

// Daily-log PDF templates. Three render modes match the three surfaces
// that download a PDF:
//   - "contractor": full detail (weather, crew, notes, delays/issues,
//     photos list, amendments). Reuses the DailyLogDetailFull shape.
//   - "commercial-client": redacted — weather + clientSummary +
//     highlights + milestone + photos. Uses DailyLogDetailRedacted.
//   - "residential-client": redacted with residential framing
//     (heroTitle, mood, summary, teamNote, photos).
//
// Mode is chosen at the endpoint based on the caller's role, NOT on a
// query param. A residential client cannot request the contractor PDF
// even if they guess the URL — the loader redacts at the role layer
// and we render the matching template for whatever shape came back.

const C = {
  accentContractor: "#5b4fc7",
  accentCommercial: "#3178b9",
  accentResidential: "#2a7f6f",
  text: "#1a1714",
  textMuted: "#6b655b",
  textFaint: "#9c958a",
  border: "#e2e5e9",
  bgSoft: "#f8f9fa",
  ok: "#1e6b46",
  okBg: "#edf7f1",
  warn: "#96600f",
  warnBg: "#fdf4e6",
  danger: "#a52e2e",
  dangerBg: "#fdeaea",
};

function makeStyles(accent: string) {
  return StyleSheet.create({
    page: {
      padding: 36,
      fontSize: 10,
      fontFamily: "Helvetica",
      color: C.text,
      lineHeight: 1.5,
    },
    header: {
      borderBottomWidth: 2,
      borderBottomColor: accent,
      paddingBottom: 12,
      marginBottom: 18,
    },
    headerEyebrow: {
      fontSize: 9,
      color: accent,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
    },
    title: {
      fontSize: 22,
      fontFamily: "Helvetica-Bold",
      marginTop: 4,
      color: C.text,
    },
    subline: {
      fontSize: 10,
      color: C.textMuted,
      marginTop: 4,
    },
    section: { marginBottom: 16 },
    sectionTitle: {
      fontSize: 9,
      color: C.textMuted,
      letterSpacing: 1,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
      marginBottom: 6,
    },
    wxRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
    wxCell: {
      flex: 1,
      backgroundColor: C.bgSoft,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    wxLabel: {
      fontSize: 7,
      color: C.textFaint,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      fontFamily: "Helvetica-Bold",
    },
    wxValue: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
    crewTable: { marginTop: 4 },
    crewHead: {
      flexDirection: "row",
      backgroundColor: C.bgSoft,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      paddingVertical: 5,
      paddingHorizontal: 8,
    },
    crewRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: C.border,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
    crewTotal: {
      flexDirection: "row",
      backgroundColor: C.bgSoft,
      paddingVertical: 6,
      paddingHorizontal: 8,
      fontFamily: "Helvetica-Bold",
    },
    crewOrgCol: { flex: 2, fontSize: 9 },
    crewTradeCol: { flex: 1.2, fontSize: 9, color: C.textMuted },
    crewNumCol: { flex: 1, fontSize: 9, textAlign: "right" },
    crewHeadText: {
      fontSize: 8,
      color: C.textFaint,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      fontFamily: "Helvetica-Bold",
    },
    notes: {
      fontSize: 10,
      lineHeight: 1.6,
      borderLeftWidth: 2,
      borderLeftColor: accent,
      paddingLeft: 10,
      paddingVertical: 4,
      backgroundColor: C.bgSoft,
    },
    chip: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      fontSize: 8,
      fontFamily: "Helvetica-Bold",
    },
    chipOk: { backgroundColor: C.okBg, color: C.ok },
    chipWarn: { backgroundColor: C.warnBg, color: C.warn },
    chipDanger: { backgroundColor: C.dangerBg, color: C.danger },
    issueBox: {
      backgroundColor: C.warnBg,
      borderWidth: 1,
      borderColor: C.warnBg,
      borderRadius: 6,
      padding: 8,
      marginBottom: 6,
    },
    issueBoxDanger: {
      backgroundColor: C.dangerBg,
      borderWidth: 1,
      borderColor: C.dangerBg,
      borderRadius: 6,
      padding: 8,
      marginBottom: 6,
    },
    issueHead: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.warn },
    issueHeadDanger: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.danger },
    issueBody: { fontSize: 10, color: C.textMuted, marginTop: 3 },
    bullet: { flexDirection: "row", marginBottom: 3 },
    bulletDot: { width: 10, fontSize: 10 },
    bulletText: { flex: 1, fontSize: 10 },
    teamNote: {
      backgroundColor: "#e4f2ee",
      borderLeftWidth: 2,
      borderLeftColor: C.accentResidential,
      padding: 10,
      fontStyle: "italic",
      fontSize: 11,
      marginTop: 8,
    },
    teamNoteBy: {
      marginTop: 4,
      fontSize: 9,
      color: C.accentResidential,
      fontFamily: "Helvetica-Bold",
      fontStyle: "normal",
    },
    footer: {
      position: "absolute",
      bottom: 20,
      left: 36,
      right: 36,
      fontSize: 8,
      color: C.textFaint,
      borderTopWidth: 1,
      borderTopColor: C.border,
      paddingTop: 6,
      textAlign: "center",
    },
  });
}

const CONTRACTOR_STYLES = makeStyles(C.accentContractor);
const COMMERCIAL_STYLES = makeStyles(C.accentCommercial);
const RESIDENTIAL_STYLES = makeStyles(C.accentResidential);

// ── Contractor full PDF ────────────────────────────────────────────

export function ContractorDailyLogPdf({
  log,
}: {
  log: DailyLogDetailFull;
}) {
  const s = CONTRACTOR_STYLES;
  const totalHeadcount = log.crew.reduce((a, c) => a + c.headcount, 0);
  const totalHours = log.crew.reduce((a, c) => a + c.hours, 0);
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerEyebrow}>Daily Log · {log.projectName}</Text>
          <Text style={s.title}>{formatDateLong(log.logDate)}</Text>
          <Text style={s.subline}>
            ID {log.id.slice(0, 8)} · Reported by {log.reportedByName ?? "—"} ·{" "}
            {log.status === "submitted" ? "Submitted" : "Draft"}
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Weather</Text>
          <View style={s.wxRow}>
            <WxCell
              style={s}
              label="Conditions"
              value={
                log.weather.conditions ? pretty(log.weather.conditions) : "—"
              }
            />
            <WxCell
              style={s}
              label="High"
              value={log.weather.highC != null ? `${log.weather.highC}°C` : "—"}
            />
            <WxCell
              style={s}
              label="Low"
              value={log.weather.lowC != null ? `${log.weather.lowC}°C` : "—"}
            />
            <WxCell
              style={s}
              label="Precip"
              value={
                log.weather.precipPct != null
                  ? `${log.weather.precipPct}%`
                  : "—"
              }
            />
            <WxCell
              style={s}
              label="Wind"
              value={
                log.weather.windKmh != null ? `${log.weather.windKmh} km/h` : "—"
              }
            />
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Crew on site</Text>
          <View style={s.crewTable}>
            <View style={s.crewHead}>
              <Text style={[s.crewOrgCol, s.crewHeadText]}>Org</Text>
              <Text style={[s.crewTradeCol, s.crewHeadText]}>Trade</Text>
              <Text style={[s.crewNumCol, s.crewHeadText]}>Headcount</Text>
              <Text style={[s.crewNumCol, s.crewHeadText]}>Hours</Text>
            </View>
            {log.crew.map((c) => (
              <View key={c.id} style={s.crewRow}>
                <Text style={s.crewOrgCol}>{c.orgName}</Text>
                <Text style={s.crewTradeCol}>{c.trade ?? "—"}</Text>
                <Text style={s.crewNumCol}>
                  {c.reconciledHeadcount ?? c.headcount}
                </Text>
                <Text style={s.crewNumCol}>
                  {c.reconciledHours ?? c.hours}
                </Text>
              </View>
            ))}
            <View style={s.crewTotal}>
              <Text style={s.crewOrgCol}>Total</Text>
              <Text style={s.crewTradeCol} />
              <Text style={s.crewNumCol}>{totalHeadcount}</Text>
              <Text style={s.crewNumCol}>{totalHours.toFixed(1)} hrs</Text>
            </View>
          </View>
        </View>

        {log.notes && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Work performed</Text>
            <Text style={s.notes}>{log.notes}</Text>
          </View>
        )}

        {log.delays.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Delays</Text>
            {log.delays.map((d) => (
              <View key={d.id} style={s.issueBox}>
                <Text style={s.issueHead}>
                  {pretty(d.delayType)} · {d.hoursLost}h lost
                </Text>
                <Text style={s.issueBody}>{d.description}</Text>
                {d.impactedActivity && (
                  <Text style={s.issueBody}>Impacted: {d.impactedActivity}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {log.issues.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Issues</Text>
            {log.issues.map((i) => (
              <View key={i.id} style={s.issueBoxDanger}>
                <Text style={s.issueHeadDanger}>{pretty(i.issueType)}</Text>
                <Text style={s.issueBody}>{i.description}</Text>
              </View>
            ))}
          </View>
        )}

        {log.photos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Photos ({log.photos.length})</Text>
            {log.photos.map((p) => (
              <View key={p.id} style={s.bullet}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>
                  {p.caption || p.title}
                  {p.isHero ? " (hero)" : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        {log.amendments.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Amendments</Text>
            {log.amendments.map((a) => (
              <View key={a.id} style={s.bullet}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>
                  {a.changeSummary} — {pretty(a.status)} ·{" "}
                  {a.requestedByName ?? "—"} ·{" "}
                  {new Date(a.requestedAt).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.footer} fixed>
          BuiltCRM · Generated {new Date().toLocaleString()} · Log {log.id.slice(0, 8)}
        </Text>
      </Page>
    </Document>
  );
}

// ── Commercial client redacted PDF ─────────────────────────────────

export function CommercialClientDailyLogPdf({
  log,
}: {
  log: DailyLogDetailRedacted;
}) {
  const s = COMMERCIAL_STYLES;
  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerEyebrow}>Site Update · {log.projectName}</Text>
          <Text style={s.title}>{formatDateLong(log.logDate)}</Text>
          {log.milestone && (
            <Text style={s.subline}>Milestone: {log.milestone}</Text>
          )}
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Weather</Text>
          <View style={s.wxRow}>
            <WxCell
              style={s}
              label="Conditions"
              value={log.weather.conditions ? pretty(log.weather.conditions) : "—"}
            />
            <WxCell
              style={s}
              label="High"
              value={log.weather.highC != null ? `${log.weather.highC}°C` : "—"}
            />
            <WxCell
              style={s}
              label="Low"
              value={log.weather.lowC != null ? `${log.weather.lowC}°C` : "—"}
            />
            <WxCell
              style={s}
              label="Precip"
              value={
                log.weather.precipPct != null ? `${log.weather.precipPct}%` : "—"
              }
            />
          </View>
        </View>

        {log.clientSummary && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Summary</Text>
            <Text style={s.notes}>{log.clientSummary}</Text>
          </View>
        )}

        {log.clientHighlights && log.clientHighlights.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Highlights</Text>
            {log.clientHighlights.map((h, i) => (
              <View key={i} style={s.bullet}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>{h}</Text>
              </View>
            ))}
          </View>
        )}

        {log.photos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Photos ({log.photos.length})</Text>
            {log.photos.map((p) => (
              <View key={p.id} style={s.bullet}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>{p.caption || p.title}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.footer} fixed>
          {log.projectName} · Generated {new Date().toLocaleString()}
        </Text>
      </Page>
    </Document>
  );
}

// ── Residential client "Journal" PDF ───────────────────────────────

export function ResidentialClientDailyLogPdf({
  log,
}: {
  log: DailyLogDetailRedacted;
}) {
  const s = RESIDENTIAL_STYLES;
  const title =
    log.residentialHeroTitle ??
    log.milestone ??
    log.clientSummary?.split(".")[0]?.trim() ??
    "Site update";
  const body = log.residentialSummary ?? log.clientSummary ?? "";

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <Text style={s.headerEyebrow}>
            Project Journal · {log.projectName}
          </Text>
          <Text style={s.title}>{title}</Text>
          <Text style={s.subline}>{formatDateLong(log.logDate)}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Weather</Text>
          <View style={s.wxRow}>
            <WxCell
              style={s}
              label="Conditions"
              value={log.weather.conditions ? pretty(log.weather.conditions) : "—"}
            />
            <WxCell
              style={s}
              label="High"
              value={log.weather.highC != null ? `${log.weather.highC}°C` : "—"}
            />
            <WxCell
              style={s}
              label="Low"
              value={log.weather.lowC != null ? `${log.weather.lowC}°C` : "—"}
            />
          </View>
        </View>

        {body && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Update</Text>
            <Text style={s.notes}>{body}</Text>
          </View>
        )}

        {log.clientHighlights && log.clientHighlights.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Highlights</Text>
            {log.clientHighlights.map((h, i) => (
              <View key={i} style={s.bullet}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>{h}</Text>
              </View>
            ))}
          </View>
        )}

        {log.milestone && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Milestone</Text>
            <Text style={s.bulletText}>{log.milestone}</Text>
          </View>
        )}

        {log.residentialTeamNote && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>A note from the team</Text>
            <View style={s.teamNote}>
              <Text>&ldquo;{log.residentialTeamNote}&rdquo;</Text>
              {log.residentialTeamNoteByName && (
                <Text style={s.teamNoteBy}>— {log.residentialTeamNoteByName}</Text>
              )}
            </View>
          </View>
        )}

        {log.photos.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Photos ({log.photos.length})</Text>
            {log.photos.map((p) => (
              <View key={p.id} style={s.bullet}>
                <Text style={s.bulletDot}>•</Text>
                <Text style={s.bulletText}>{p.caption || p.title}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.footer} fixed>
          {log.projectName} · Shared by your builder · Generated{" "}
          {new Date().toLocaleString()}
        </Text>
      </Page>
    </Document>
  );
}

type StylesForCell = ReturnType<typeof makeStyles>;

function WxCell({
  style,
  label,
  value,
}: {
  style: StylesForCell;
  label: string;
  value: string;
}) {
  return (
    <View style={style.wxCell}>
      <Text style={style.wxLabel}>{label}</Text>
      <Text style={style.wxValue}>{value}</Text>
    </View>
  );
}

function pretty(s: string): string {
  return s
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function formatDateLong(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
