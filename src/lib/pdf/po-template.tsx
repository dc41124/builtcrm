import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Data shape for a PO PDF. Pure: no DB reads, no I/O. Caller resolves
// everything from the PO detail loader + org + project rows. Matches
// the JSX prototype's detail drawer content (header, meta grid, line
// items with receiving, totals, notes) so the PDF the vendor reads
// mirrors what the contractor sees on screen.
export type PoPdfLine = {
  sortOrder: number;
  description: string;
  quantity: string;
  unit: string;
  unitCostCents: number;
  lineTotalCents: number;
};

export type PoPdfData = {
  poNumber: string;
  revisionNumber: number;
  issuedAt: Date;
  expectedDeliveryAt: Date | null;
  status: string;
  contractorName: string;
  contractorAddress: string | null;
  contractorPhone: string | null;
  vendorName: string;
  vendorContactName: string | null;
  vendorContactEmail: string | null;
  vendorAddress: string | null;
  paymentTerms: string | null;
  projectName: string;
  costCodeLabel: string | null;
  taxRatePercent: string;
  notes: string | null;
  lines: PoPdfLine[];
  subtotalCents: number;
  taxAmountCents: number;
  totalCents: number;
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

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtQty(qty: string): string {
  const n = parseFloat(qty);
  if (!Number.isFinite(n)) return qty;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 9,
    color: "#6b6864",
    marginTop: 3,
    letterSpacing: 0.2,
  },
  headerRight: { alignItems: "flex-end" },
  poNum: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    letterSpacing: 0.8,
  },
  revTag: {
    fontSize: 8,
    color: "#6b6864",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 4,
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
  metaSubValue: {
    fontSize: 9,
    color: "#2f2c28",
    marginTop: 1,
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
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#1a1714",
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: "#1a1714",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e2dd",
    alignItems: "flex-start",
  },
  colDesc: { flex: 1, paddingRight: 10 },
  colQty: { width: 60, textAlign: "right" },
  colUnit: { width: 42, textAlign: "center" },
  colUnitCost: { width: 80, textAlign: "right" },
  colTotal: { width: 90, textAlign: "right" },
  cellText: { fontSize: 9.5 },
  cellTextBold: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingVertical: 4,
  },
  totalsLabel: {
    width: 120,
    fontSize: 10,
    color: "#6b6864",
    textAlign: "right",
    paddingRight: 10,
  },
  totalsValue: {
    width: 90,
    fontSize: 10,
    textAlign: "right",
  },
  totalsGrandLabel: {
    width: 120,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    paddingRight: 10,
  },
  totalsGrandValue: {
    width: 90,
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
  },
  notesBlock: {
    marginTop: 18,
    padding: 12,
    backgroundColor: "#f8f6f2",
    borderWidth: 0.5,
    borderColor: "#d5d1cc",
    borderRadius: 3,
  },
  notesTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notesBody: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#2f2c28",
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

export function PoDocument({ data }: { data: PoPdfData }) {
  const isRevision = data.revisionNumber > 1;

  return (
    <Document
      title={`${data.poNumber} — ${data.vendorName}`}
      author={data.contractorName}
      subject="Purchase Order"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Purchase Order</Text>
            <Text style={styles.headerSub}>{data.contractorName}</Text>
            {data.contractorAddress && (
              <Text style={styles.headerSub}>{data.contractorAddress}</Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.poNum}>{data.poNumber}</Text>
            <Text style={styles.revTag}>
              {isRevision
                ? `Revision ${data.revisionNumber} · Issued ${fmtDate(data.issuedAt)}`
                : `Issued ${fmtDate(data.issuedAt)}`}
            </Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>To (vendor)</Text>
            <Text style={styles.metaValue}>{data.vendorName}</Text>
            {data.vendorContactName && (
              <Text style={styles.metaSubValue}>{data.vendorContactName}</Text>
            )}
            {data.vendorContactEmail && (
              <Text style={styles.metaSubValue}>{data.vendorContactEmail}</Text>
            )}
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Project</Text>
            <Text style={styles.metaValue}>{data.projectName}</Text>
            {data.costCodeLabel && (
              <Text style={styles.metaSubValue}>{data.costCodeLabel}</Text>
            )}
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Expected delivery</Text>
            <Text style={styles.metaValue}>
              {data.expectedDeliveryAt
                ? fmtDate(data.expectedDeliveryAt)
                : "—"}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Payment terms</Text>
            <Text style={styles.metaValue}>{data.paymentTerms ?? "—"}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Line items</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
          <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnit]}>Unit</Text>
          <Text style={[styles.tableHeaderCell, styles.colUnitCost]}>Unit cost</Text>
          <Text style={[styles.tableHeaderCell, styles.colTotal]}>Line total</Text>
        </View>
        {data.lines.map((l) => (
          <View key={l.sortOrder} style={styles.tableRow}>
            <Text style={[styles.cellText, styles.colDesc]}>{l.description}</Text>
            <Text style={[styles.cellText, styles.colQty]}>{fmtQty(l.quantity)}</Text>
            <Text style={[styles.cellText, styles.colUnit]}>{l.unit}</Text>
            <Text style={[styles.cellText, styles.colUnitCost]}>{fmtMoney(l.unitCostCents)}</Text>
            <Text style={[styles.cellTextBold, styles.colTotal]}>{fmtMoney(l.lineTotalCents)}</Text>
          </View>
        ))}

        <View style={{ marginTop: 12 }}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{fmtMoney(data.subtotalCents)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>
              Tax ({parseFloat(data.taxRatePercent).toFixed(2)}%)
            </Text>
            <Text style={styles.totalsValue}>{fmtMoney(data.taxAmountCents)}</Text>
          </View>
          <View
            style={[
              styles.totalsRow,
              {
                borderTopWidth: 1,
                borderTopColor: "#1a1714",
                marginTop: 4,
                paddingTop: 6,
              },
            ]}
          >
            <Text style={styles.totalsGrandLabel}>Total</Text>
            <Text style={styles.totalsGrandValue}>{fmtMoney(data.totalCents)}</Text>
          </View>
        </View>

        {data.notes && data.notes.trim().length > 0 && (
          <View style={styles.notesBlock}>
            <Text style={styles.notesTitle}>Notes for vendor</Text>
            <Text style={styles.notesBody}>{data.notes}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>{data.poNumber}{isRevision ? ` · rev ${data.revisionNumber}` : ""}</Text>
          <Text>{data.contractorName}</Text>
        </View>
      </Page>
    </Document>
  );
}
