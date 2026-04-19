import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// PDF template for the contractor reports dashboard (Step 24).
// Pure data-in — the template does no DB reads, mirroring the
// payment-receipt + G702/G703 templates that came before it. Caller
// passes a flat snapshot and the template renders.
//
// Layout: single portrait page for small portfolios (≤12 projects);
// @react-pdf/renderer's <Page> wraps content onto additional pages
// automatically when content overflows. Color scheme neutral (grey +
// black) for print-friendliness; risk signals get a red swatch.

export type ReportsPdfData = {
  generatedAtIso: string;
  organizationName: string;
  kpis: {
    totalContractCents: number;
    totalBilledCents: number;
    totalUnpaidCents: number;
    activeProjects: number;
    openRfis: number;
    openChangeOrders: number;
    complianceAlerts: number;
    scheduleAtRisk: number;
  };
  projects: Array<{
    id: string;
    name: string;
    status: string;
    phase: string | null;
    contractValueCents: number;
    billedCents: number;
    percentComplete: number | null;
    scheduleVarianceDays: number | null;
    complianceStatus: "ok" | "expiring" | "alert";
    openItemsCount: number;
  }>;
  aging: Array<{
    label: string;
    rfis: number;
    changeOrders: number;
  }>;
};

function fmtCents(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(dollars) >= 1_000) {
    return `$${Math.round(dollars / 1_000).toLocaleString()}K`;
  }
  return `$${Math.round(dollars).toLocaleString()}`;
}

function fmtPercent(pct: number | null): string {
  return pct == null ? "—" : `${pct}%`;
}

function fmtVariance(days: number | null): string {
  if (days == null) return "—";
  if (days < -1) return `${Math.abs(days)}d ahead`;
  if (days <= 1) return "On track";
  return `${days}d behind`;
}

const styles = StyleSheet.create({
  page: {
    padding: "32pt 36pt",
    fontSize: 9,
    fontFamily: "Helvetica",
    color: "#12141b",
  },
  hdrRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#c3c8d4",
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    letterSpacing: -0.3,
  },
  subtitle: { fontSize: 9, color: "#64687a", marginTop: 2 },
  generated: { fontSize: 8, color: "#8a8f9e" },
  sectionLabel: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    color: "#64687a",
    marginTop: 14,
    marginBottom: 8,
  },
  kpiGroups: {
    flexDirection: "row",
    gap: 8,
  },
  kpiGroup: {
    flex: 1,
    padding: "8pt 10pt",
    borderWidth: 1,
    borderColor: "#e6e9ef",
    borderRadius: 4,
  },
  kpiGroupRisk: {
    borderColor: "#f1bbb3",
    backgroundColor: "#fdf5f3",
  },
  kpiGroupLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1.2,
    color: "#64687a",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  kpiGroupLabelRisk: { color: "#a93930" },
  kpiRow: { flexDirection: "row", marginBottom: 2 },
  kpiName: { flex: 2, color: "#64687a", fontSize: 8 },
  kpiValue: { flex: 1, fontFamily: "Helvetica-Bold", textAlign: "right", fontSize: 10 },
  kpiValueRisk: { color: "#a93930" },
  tbl: { marginTop: 6, borderTopWidth: 1, borderTopColor: "#c3c8d4" },
  tblHead: {
    flexDirection: "row",
    backgroundColor: "#f4f6fa",
    borderBottomWidth: 1,
    borderBottomColor: "#c3c8d4",
    padding: "4pt 6pt",
  },
  tblCol: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#64687a", textTransform: "uppercase", letterSpacing: 0.8 },
  tblRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e6e9ef",
    padding: "5pt 6pt",
  },
  col_name: { flex: 3 },
  col_pct: { flex: 1, textAlign: "right" },
  col_money: { flex: 1.3, textAlign: "right" },
  col_var: { flex: 1.5 },
  col_comp: { flex: 1 },
  col_open: { flex: 0.8, textAlign: "right" },
  agingRow: {
    flexDirection: "row",
    padding: "4pt 0",
    borderBottomWidth: 0.5,
    borderBottomColor: "#e6e9ef",
  },
  agingLabel: { flex: 2 },
  agingCell: { flex: 1, textAlign: "right" },
  agingRisk: { color: "#a93930", fontFamily: "Helvetica-Bold" },
});

export function ReportsDocument({ data }: { data: ReportsPdfData }) {
  const riskHot =
    data.kpis.complianceAlerts > 0 || data.kpis.scheduleAtRisk > 0;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.hdrRow}>
          <View>
            <Text style={styles.title}>Portfolio Report</Text>
            <Text style={styles.subtitle}>
              {data.organizationName} · {data.projects.length} project
              {data.projects.length === 1 ? "" : "s"}
            </Text>
          </View>
          <Text style={styles.generated}>
            Generated {new Date(data.generatedAtIso).toLocaleString()}
          </Text>
        </View>

        <View style={styles.kpiGroups}>
          <View style={styles.kpiGroup}>
            <Text style={styles.kpiGroupLabel}>Financial</Text>
            <View style={styles.kpiRow}>
              <Text style={styles.kpiName}>Contract value</Text>
              <Text style={styles.kpiValue}>{fmtCents(data.kpis.totalContractCents)}</Text>
            </View>
            <View style={styles.kpiRow}>
              <Text style={styles.kpiName}>Billed</Text>
              <Text style={styles.kpiValue}>{fmtCents(data.kpis.totalBilledCents)}</Text>
            </View>
            <View style={styles.kpiRow}>
              <Text style={styles.kpiName}>Unpaid</Text>
              <Text style={styles.kpiValue}>{fmtCents(data.kpis.totalUnpaidCents)}</Text>
            </View>
          </View>
          <View style={styles.kpiGroup}>
            <Text style={styles.kpiGroupLabel}>Operational</Text>
            <View style={styles.kpiRow}>
              <Text style={styles.kpiName}>Active projects</Text>
              <Text style={styles.kpiValue}>{data.kpis.activeProjects}</Text>
            </View>
            <View style={styles.kpiRow}>
              <Text style={styles.kpiName}>Open RFIs</Text>
              <Text style={styles.kpiValue}>{data.kpis.openRfis}</Text>
            </View>
            <View style={styles.kpiRow}>
              <Text style={styles.kpiName}>Open change orders</Text>
              <Text style={styles.kpiValue}>{data.kpis.openChangeOrders}</Text>
            </View>
          </View>
          <View style={[styles.kpiGroup, riskHot ? styles.kpiGroupRisk : {}]}>
            <Text
              style={[styles.kpiGroupLabel, riskHot ? styles.kpiGroupLabelRisk : {}]}
            >
              Risk
            </Text>
            <View style={styles.kpiRow}>
              <Text style={styles.kpiName}>Compliance alerts</Text>
              <Text
                style={[
                  styles.kpiValue,
                  data.kpis.complianceAlerts > 0 ? styles.kpiValueRisk : {},
                ]}
              >
                {data.kpis.complianceAlerts}
              </Text>
            </View>
            <View style={styles.kpiRow}>
              <Text style={styles.kpiName}>Schedule at risk</Text>
              <Text
                style={[
                  styles.kpiValue,
                  data.kpis.scheduleAtRisk > 0 ? styles.kpiValueRisk : {},
                ]}
              >
                {data.kpis.scheduleAtRisk}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Projects</Text>
        <View style={styles.tbl}>
          <View style={styles.tblHead}>
            <Text style={[styles.tblCol, styles.col_name]}>Project</Text>
            <Text style={[styles.tblCol, styles.col_pct]}>% complete</Text>
            <Text style={[styles.tblCol, styles.col_money]}>Contract</Text>
            <Text style={[styles.tblCol, styles.col_money]}>Billed</Text>
            <Text style={[styles.tblCol, styles.col_var]}>Variance</Text>
            <Text style={[styles.tblCol, styles.col_comp]}>Compliance</Text>
            <Text style={[styles.tblCol, styles.col_open]}>Open</Text>
          </View>
          {data.projects.map((p) => (
            <View style={styles.tblRow} key={p.id}>
              <Text style={styles.col_name}>
                {p.name}
                {p.phase ? `  ·  ${p.phase}` : ""}
              </Text>
              <Text style={styles.col_pct}>{fmtPercent(p.percentComplete)}</Text>
              <Text style={styles.col_money}>{fmtCents(p.contractValueCents)}</Text>
              <Text style={styles.col_money}>{fmtCents(p.billedCents)}</Text>
              <Text
                style={[
                  styles.col_var,
                  (p.scheduleVarianceDays ?? 0) > 7 ? styles.kpiValueRisk : {},
                ]}
              >
                {fmtVariance(p.scheduleVarianceDays)}
              </Text>
              <Text
                style={[
                  styles.col_comp,
                  p.complianceStatus === "alert" ? styles.kpiValueRisk : {},
                ]}
              >
                {p.complianceStatus}
              </Text>
              <Text style={styles.col_open}>{p.openItemsCount}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Open items aging</Text>
        <View style={styles.agingRow}>
          <Text style={[styles.tblCol, styles.agingLabel]}>Bucket</Text>
          <Text style={[styles.tblCol, styles.agingCell]}>RFIs</Text>
          <Text style={[styles.tblCol, styles.agingCell]}>Change orders</Text>
        </View>
        {data.aging.map((row) => {
          const isRisk = row.label.startsWith("30+");
          return (
            <View style={styles.agingRow} key={row.label}>
              <Text style={[styles.agingLabel, isRisk ? styles.agingRisk : {}]}>
                {row.label}
              </Text>
              <Text
                style={[
                  styles.agingCell,
                  isRisk && row.rfis > 0 ? styles.agingRisk : {},
                ]}
              >
                {row.rfis}
              </Text>
              <Text
                style={[
                  styles.agingCell,
                  isRisk && row.changeOrders > 0 ? styles.agingRisk : {},
                ]}
              >
                {row.changeOrders}
              </Text>
            </View>
          );
        })}
      </Page>
    </Document>
  );
}
