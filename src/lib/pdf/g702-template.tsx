import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Data shape for a G702 form. Matches the `drawRequests` schema G702 columns
// one-for-one, plus contextual fields (project/contractor/client names and
// period dates) that the calling route has to resolve. Keeping this data-only
// means the template itself is pure — no DB reads, no I/O — so the PDF can be
// regenerated from a flat row at any point.
export type G702Data = {
  projectName: string;
  contractorName: string;
  clientName: string | null;
  drawNumber: number;
  applicationDate: Date;
  periodFrom: Date;
  periodTo: Date;
  originalContractSumCents: number;
  netChangeOrdersCents: number;
  contractSumToDateCents: number;
  totalCompletedToDateCents: number;
  retainageOnCompletedCents: number;
  retainageOnStoredCents: number;
  totalRetainageCents: number;
  totalEarnedLessRetainageCents: number;
  previousCertificatesCents: number;
  currentPaymentDueCents: number;
  balanceToFinishCents: number;
};

function fmtMoney(cents: number): string {
  const dollars = cents / 100;
  const sign = dollars < 0 ? "-" : "";
  const abs = Math.abs(dollars);
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtMoneySigned(cents: number): string {
  if (cents === 0) return "$0.00";
  if (cents > 0) return `+${fmtMoney(cents)}`;
  return fmtMoney(cents);
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1714",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#1a1714",
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontSize: 9,
    color: "#6b6864",
    marginTop: 3,
    letterSpacing: 0.2,
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 18,
  },
  metaCell: {
    width: "50%",
    paddingVertical: 5,
    paddingRight: 12,
  },
  metaLabel: {
    fontSize: 8,
    color: "#6b6864",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Bold",
    color: "#1a1714",
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#1a1714",
    paddingBottom: 6,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#d5d1cc",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e2dd",
  },
  rowHighlight: {
    backgroundColor: "#f4f1ec",
    paddingHorizontal: 8,
    marginHorizontal: -8,
    paddingVertical: 8,
    borderBottomWidth: 0,
  },
  rowLabel: {
    flex: 1,
    fontSize: 10,
  },
  rowLabelBold: {
    flex: 1,
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  rowHint: {
    fontSize: 8,
    color: "#6b6864",
    marginTop: 2,
  },
  rowValue: {
    width: 130,
    fontSize: 10,
    textAlign: "right",
    fontFamily: "Helvetica",
  },
  rowValueBold: {
    width: 130,
    fontSize: 11,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  certification: {
    marginTop: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d5d1cc",
    borderRadius: 3,
  },
  certTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  certBody: {
    fontSize: 9,
    lineHeight: 1.5,
    color: "#2f2c28",
  },
  sigBlock: {
    flexDirection: "row",
    marginTop: 18,
    gap: 24,
  },
  sigCell: {
    flex: 1,
  },
  sigLine: {
    borderBottomWidth: 1,
    borderBottomColor: "#1a1714",
    height: 24,
    marginBottom: 3,
  },
  sigLabel: {
    fontSize: 8,
    color: "#6b6864",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 42,
    right: 42,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#9b968f",
    letterSpacing: 0.3,
  },
});

export function G702Document({ data }: { data: G702Data }) {
  const rows: Array<{
    label: string;
    value: string;
    hint?: string;
    highlight?: boolean;
  }> = [
    { label: "1. Original contract sum", value: fmtMoney(data.originalContractSumCents) },
    {
      label: "2. Net change by change orders",
      value: fmtMoneySigned(data.netChangeOrdersCents),
    },
    {
      label: "3. Contract sum to date (Line 1 ± 2)",
      value: fmtMoney(data.contractSumToDateCents),
    },
    {
      label: "4. Total completed & stored to date",
      value: fmtMoney(data.totalCompletedToDateCents),
      hint:
        data.contractSumToDateCents > 0
          ? `${((data.totalCompletedToDateCents / data.contractSumToDateCents) * 100).toFixed(1)}% of contract`
          : undefined,
    },
    {
      label: "5a. Retainage on completed work",
      value: fmtMoney(data.retainageOnCompletedCents),
    },
    {
      label: "5b. Retainage on stored materials",
      value: fmtMoney(data.retainageOnStoredCents),
    },
    {
      label: "5. Total retainage held",
      value: fmtMoney(data.totalRetainageCents),
    },
    {
      label: "6. Total earned less retainage (Line 4 − 5)",
      value: fmtMoney(data.totalEarnedLessRetainageCents),
    },
    {
      label: "7. Less previous certificates for payment",
      value: fmtMoney(data.previousCertificatesCents),
      hint:
        data.drawNumber > 1 ? `Draws #1–${data.drawNumber - 1}` : "First draw",
    },
    {
      label: "8. Current payment due",
      value: fmtMoney(data.currentPaymentDueCents),
      highlight: true,
    },
    {
      label: "9. Balance to finish + retainage",
      value: fmtMoney(data.balanceToFinishCents + data.totalRetainageCents),
    },
  ];

  return (
    <Document
      title={`G702 — Application for Payment (Draw #${data.drawNumber})`}
      author={data.contractorName}
      subject="AIA G702 Application and Certificate for Payment"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            Application and Certificate for Payment
          </Text>
          <Text style={styles.headerSub}>
            AIA Document G702 · Application No. {data.drawNumber}
          </Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Project</Text>
            <Text style={styles.metaValue}>{data.projectName}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Application date</Text>
            <Text style={styles.metaValue}>{fmtDate(data.applicationDate)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>To (owner)</Text>
            <Text style={styles.metaValue}>{data.clientName ?? "—"}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>From (contractor)</Text>
            <Text style={styles.metaValue}>{data.contractorName}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Application number</Text>
            <Text style={styles.metaValue}>
              {String(data.drawNumber).padStart(3, "0")}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Period</Text>
            <Text style={styles.metaValue}>
              {fmtDate(data.periodFrom)} – {fmtDate(data.periodTo)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Application summary</Text>
        {rows.map((r, i) => (
          <View
            key={i}
            style={[styles.row, r.highlight ? styles.rowHighlight : {}]}
          >
            <View style={{ flex: 1 }}>
              <Text style={r.highlight ? styles.rowLabelBold : styles.rowLabel}>
                {r.label}
              </Text>
              {r.hint && <Text style={styles.rowHint}>{r.hint}</Text>}
            </View>
            <Text style={r.highlight ? styles.rowValueBold : styles.rowValue}>
              {r.value}
            </Text>
          </View>
        ))}

        <View style={styles.certification}>
          <Text style={styles.certTitle}>Contractor&apos;s certification</Text>
          <Text style={styles.certBody}>
            The undersigned Contractor certifies that to the best of the
            Contractor&apos;s knowledge, information, and belief the Work
            covered by this Application for Payment has been completed in
            accordance with the Contract Documents, that all amounts have been
            paid by the Contractor for Work for which previous Certificates for
            Payment were issued and payments received from the Owner, and that
            current payment shown herein is now due.
          </Text>
          <View style={styles.sigBlock}>
            <View style={styles.sigCell}>
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>
                Contractor signature &nbsp;·&nbsp; {data.contractorName}
              </Text>
            </View>
            <View style={styles.sigCell}>
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>Date</Text>
            </View>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            Generated by BuiltCRM · {fmtDate(data.applicationDate)}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
