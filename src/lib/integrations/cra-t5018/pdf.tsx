import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";

// Step 67 — Per-sub T5018 PDF slip generator.
//
// Mirrors the prototype's CRA T5018 form-shape: form title + reporting
// year header, then a 2-column grid of CRA boxes (22/24/26/27/28/29/82).
// One PDF per qualifying sub. Reuses the @react-pdf/renderer pattern
// established by Step 13's G702/G703 templates.

export interface T5018PdfSlipInput {
  fiscalYear: number;
  reporter: {
    legalName: string;
    businessNumber: string; // canonical 15-char form
    addr1: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
  };
  recipient: {
    legalName: string;
    businessNumber: string;
    accountNumber: string; // we use sub_org_id
    address: string | null;
  };
  totalAmountCents: number;
  paymentCount: number;
  // 1-indexed within the package, e.g. "Slip 3 of 12".
  slipIndex: number;
  slipCount: number;
}

function fmtCAD(cents: number): string {
  const dollars = cents / 100;
  return `$${dollars.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtBN(bn: string): string {
  // 9 digits + RT + 4 digits — render with a thin space at the boundary
  // so the print is human-readable without breaking the canonical form.
  if (bn.length === 15) return `${bn.slice(0, 9)} ${bn.slice(9)}`;
  return bn;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 42,
    paddingBottom: 42,
    paddingHorizontal: 46,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1714",
  },
  // Outer slip frame mirrors the prototype's bordered "official form"
  // appearance.
  frame: {
    borderWidth: 1.5,
    borderColor: "#1a1714",
    borderRadius: 4,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1714",
    paddingBottom: 10,
    marginBottom: 14,
  },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 9,
    color: "#6b655b",
    marginTop: 3,
  },
  headerRight: {
    textAlign: "right",
  },
  headerYear: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    letterSpacing: 0.4,
  },
  headerYearSub: {
    fontSize: 8.5,
    color: "#6b655b",
    marginTop: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  cell: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    width: "50%",
  },
  cellWide: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    width: "100%",
  },
  cellInner: {
    borderWidth: 1,
    borderColor: "#999999",
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#fcfcfa",
  },
  boxLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    color: "#6b655b",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  boxValue: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a1714",
    marginTop: 3,
  },
  boxValueLarge: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1a1714",
    marginTop: 3,
    letterSpacing: 0.2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#999999",
    borderTopStyle: "dashed",
    fontSize: 9,
    color: "#6b655b",
  },
  // Outside the slip frame — package metadata + disclaimer.
  attribution: {
    marginTop: 18,
    fontSize: 8.5,
    color: "#9c958a",
    lineHeight: 1.55,
  },
});

export function T5018SlipDocument(props: T5018PdfSlipInput): ReactElement {
  const reporterAddress = [
    props.reporter.addr1,
    props.reporter.city && props.reporter.province
      ? `${props.reporter.city}, ${props.reporter.province}`
      : props.reporter.city ?? props.reporter.province,
    props.reporter.postalCode,
  ]
    .filter((p): p is string => Boolean(p))
    .join(" · ");

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                T5018 — Statement of Contract Payments
              </Text>
              <Text style={styles.headerSub}>
                État des paiements contractuels · Canada Revenue Agency
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.headerYear}>{props.fiscalYear}</Text>
              <Text style={styles.headerYearSub}>
                Reporting period: Jan 1 – Dec 31
              </Text>
            </View>
          </View>

          <View style={styles.grid}>
            <View style={styles.cellWide}>
              <View style={styles.cellInner}>
                <Text style={styles.boxLabel}>Box 22 — Recipient name</Text>
                <Text style={styles.boxValue}>{props.recipient.legalName}</Text>
              </View>
            </View>
            <View style={styles.cell}>
              <View style={styles.cellInner}>
                <Text style={styles.boxLabel}>
                  Box 24 — Recipient BN/SIN
                </Text>
                <Text style={styles.boxValue}>
                  {fmtBN(props.recipient.businessNumber)}
                </Text>
              </View>
            </View>
            <View style={styles.cell}>
              <View style={styles.cellInner}>
                <Text style={styles.boxLabel}>Box 26 — Account number</Text>
                <Text style={styles.boxValue}>
                  {props.recipient.accountNumber.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={styles.cellWide}>
              <View style={styles.cellInner}>
                <Text style={styles.boxLabel}>Box 27 — Recipient address</Text>
                <Text style={styles.boxValue}>
                  {props.recipient.address ?? "—"}
                </Text>
              </View>
            </View>
            <View style={styles.cell}>
              <View style={styles.cellInner}>
                <Text style={styles.boxLabel}>
                  Box 28 — Reporting period start
                </Text>
                <Text style={styles.boxValue}>
                  January 1, {props.fiscalYear}
                </Text>
              </View>
            </View>
            <View style={styles.cell}>
              <View style={styles.cellInner}>
                <Text style={styles.boxLabel}>
                  Box 29 — Reporting period end
                </Text>
                <Text style={styles.boxValue}>
                  December 31, {props.fiscalYear}
                </Text>
              </View>
            </View>
            <View style={styles.cellWide}>
              <View style={styles.cellInner}>
                <Text style={styles.boxLabel}>
                  Box 82 — Total contract payments
                </Text>
                <Text style={styles.boxValueLarge}>
                  {fmtCAD(props.totalAmountCents)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.footer}>
            <Text>
              Reporter: {props.reporter.legalName} ·{" "}
              {fmtBN(props.reporter.businessNumber)}
            </Text>
            <Text>
              Slip {props.slipIndex} of {props.slipCount}
            </Text>
          </View>
        </View>

        <Text style={styles.attribution}>
          Generated by BuiltCRM. {reporterAddress}. This slip aggregates{" "}
          {props.paymentCount} payment{props.paymentCount === 1 ? "" : "s"}{" "}
          across all projects in fiscal year {props.fiscalYear}. Construction-
          services portion only — material-only line items are excluded per CRA
          rule. Filing deadline: February 28, {props.fiscalYear + 1}.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderT5018Slip(
  input: T5018PdfSlipInput,
): Promise<Buffer> {
  return renderToBuffer(T5018SlipDocument(input));
}
