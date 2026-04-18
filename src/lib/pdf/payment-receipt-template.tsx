import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Data shape for a single payment transaction receipt. Mirrors the columns
// on `payment_transactions` plus a resolved related-entity summary and
// contextual strings (project, contractor, payer). Pure data-in — the
// template does no DB reads so a receipt can be regenerated from a flat
// row at any time.
//
// One template, two flavors: a Stripe payment (stripePaymentIntentId set)
// prints the PI id, method details, and fee breakdown; a manual payment
// (method check / wire / other) prints the external reference and note.
export type PaymentReceiptData = {
  projectName: string;
  contractorName: string;
  payerName: string | null;
  transaction: {
    id: string;
    paymentMethodType: "ach_debit" | "card" | "wire" | "check" | "other";
    transactionStatus: string;
    grossAmountCents: number;
    processingFeeCents: number;
    platformFeeCents: number;
    netAmountCents: number;
    currency: string;
    initiatedAt: Date | null;
    succeededAt: Date | null;
    stripePaymentIntentId: string | null;
    stripeChargeId: string | null;
    paymentMethodDetails: Record<string, unknown> | null;
    externalReference: string | null;
    note: string | null;
  };
  related: {
    type: string;
    label: string;
    description: string | null;
  };
};

function fmtMoney(cents: number, currency: string): string {
  const dollars = cents / 100;
  const sign = dollars < 0 ? "-" : "";
  const abs = Math.abs(dollars);
  return `${sign}${currency.toUpperCase()} ${abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtDateTime(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function titleCase(s: string): string {
  return s
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function methodLabel(
  method: PaymentReceiptData["transaction"]["paymentMethodType"],
  details: Record<string, unknown> | null,
): string {
  const base = {
    ach_debit: "ACH bank debit",
    card: "Credit/debit card",
    wire: "Wire transfer",
    check: "Check",
    other: "Other",
  }[method];
  if (!details) return base;
  const parts: string[] = [base];
  const brand = typeof details.brand === "string" ? details.brand : null;
  const bank = typeof details.bank === "string" ? details.bank : null;
  const last4 = typeof details.last4 === "string" ? details.last4 : null;
  if (brand) parts.push(titleCase(brand));
  if (bank) parts.push(bank);
  if (last4) parts.push(`•••• ${last4}`);
  return parts.join(" · ");
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 44,
    paddingBottom: 44,
    paddingHorizontal: 48,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1714",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#1a1714",
    paddingBottom: 12,
    marginBottom: 18,
  },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    letterSpacing: 0.4,
  },
  headerSub: {
    fontSize: 9,
    color: "#6b6864",
    marginTop: 4,
    letterSpacing: 0.25,
  },
  heroAmount: {
    fontFamily: "Helvetica-Bold",
    fontSize: 28,
    marginTop: 6,
  },
  heroStatus: {
    fontSize: 9,
    color: "#3a7a4c",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  heroStatusPending: { color: "#9a7020" },
  heroStatusFailed: { color: "#a23c2f" },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 18,
  },
  metaCell: {
    width: "50%",
    paddingVertical: 6,
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
    paddingVertical: 5,
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
  rowLabel: { flex: 1, fontSize: 10 },
  rowLabelBold: { flex: 1, fontSize: 10, fontFamily: "Helvetica-Bold" },
  rowValue: {
    width: 160,
    fontSize: 10,
    textAlign: "right",
  },
  rowValueBold: {
    width: 160,
    fontSize: 11,
    textAlign: "right",
    fontFamily: "Helvetica-Bold",
  },
  noteBox: {
    marginTop: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: "#d5d1cc",
    borderRadius: 3,
  },
  noteLabel: {
    fontSize: 8,
    color: "#6b6864",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  noteBody: {
    fontSize: 9.5,
    lineHeight: 1.45,
    color: "#2f2c28",
  },
  sigBlock: {
    flexDirection: "row",
    marginTop: 22,
    gap: 24,
  },
  sigCell: { flex: 1 },
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
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: "#9b968f",
    letterSpacing: 0.3,
  },
});

export function PaymentReceiptDocument({
  data,
}: {
  data: PaymentReceiptData;
}) {
  const t = data.transaction;
  const isStripe = Boolean(t.stripePaymentIntentId);
  const isSucceeded = t.transactionStatus === "succeeded";
  const isFailed =
    t.transactionStatus === "failed" || t.transactionStatus === "canceled";
  const shortId = t.id.slice(0, 8).toUpperCase();
  const primaryDate = t.succeededAt ?? t.initiatedAt;
  const heroStatusStyle = isSucceeded
    ? styles.heroStatus
    : isFailed
      ? [styles.heroStatus, styles.heroStatusFailed]
      : [styles.heroStatus, styles.heroStatusPending];
  const feeTotalCents = t.processingFeeCents + t.platformFeeCents;

  return (
    <Document
      title={`Payment receipt ${shortId}`}
      author={data.contractorName}
      subject={`Payment receipt for ${data.related.label}`}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payment receipt</Text>
          <Text style={styles.headerSub}>
            Receipt #{shortId} · {fmtDate(primaryDate)}
          </Text>
          <Text style={styles.heroAmount}>
            {fmtMoney(t.grossAmountCents, t.currency)}
          </Text>
          <Text style={heroStatusStyle}>
            {titleCase(t.transactionStatus)}
          </Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Project</Text>
            <Text style={styles.metaValue}>{data.projectName}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Paid to</Text>
            <Text style={styles.metaValue}>{data.contractorName}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Paid by</Text>
            <Text style={styles.metaValue}>{data.payerName ?? "—"}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Method</Text>
            <Text style={styles.metaValue}>
              {methodLabel(t.paymentMethodType, t.paymentMethodDetails)}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Initiated</Text>
            <Text style={styles.metaValue}>{fmtDateTime(t.initiatedAt)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>
              {isSucceeded ? "Succeeded" : "Status as of"}
            </Text>
            <Text style={styles.metaValue}>
              {fmtDateTime(t.succeededAt ?? t.initiatedAt)}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Applied to</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            {titleCase(data.related.type)} · {data.related.label}
          </Text>
        </View>
        {data.related.description && (
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={[styles.rowLabel, { color: "#6b6864" }]}>
              {data.related.description}
            </Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
          Amount breakdown
        </Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Gross amount</Text>
          <Text style={styles.rowValue}>
            {fmtMoney(t.grossAmountCents, t.currency)}
          </Text>
        </View>
        {t.processingFeeCents > 0 && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Processing fee</Text>
            <Text style={styles.rowValue}>
              −{fmtMoney(t.processingFeeCents, t.currency)}
            </Text>
          </View>
        )}
        {t.platformFeeCents > 0 && (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Platform fee</Text>
            <Text style={styles.rowValue}>
              −{fmtMoney(t.platformFeeCents, t.currency)}
            </Text>
          </View>
        )}
        <View style={[styles.row, styles.rowHighlight]}>
          <Text style={styles.rowLabelBold}>
            {feeTotalCents > 0 ? "Net transferred" : "Total"}
          </Text>
          <Text style={styles.rowValueBold}>
            {fmtMoney(t.netAmountCents, t.currency)}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
          Reference
        </Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Transaction id</Text>
          <Text style={styles.rowValue}>{t.id}</Text>
        </View>
        {isStripe ? (
          <>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Stripe payment intent</Text>
              <Text style={styles.rowValue}>
                {t.stripePaymentIntentId ?? "—"}
              </Text>
            </View>
            {t.stripeChargeId && (
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Stripe charge</Text>
                <Text style={styles.rowValue}>{t.stripeChargeId}</Text>
              </View>
            )}
          </>
        ) : (
          t.externalReference && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Reference number</Text>
              <Text style={styles.rowValue}>{t.externalReference}</Text>
            </View>
          )
        )}

        {t.note && (
          <View style={styles.noteBox}>
            <Text style={styles.noteLabel}>Note</Text>
            <Text style={styles.noteBody}>{t.note}</Text>
          </View>
        )}

        {!isStripe && (
          <View style={styles.sigBlock}>
            <View style={styles.sigCell}>
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>
                Received by &nbsp;·&nbsp; {data.contractorName}
              </Text>
            </View>
            <View style={styles.sigCell}>
              <View style={styles.sigLine} />
              <Text style={styles.sigLabel}>Date</Text>
            </View>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>
            Generated by BuiltCRM · {fmtDate(new Date())}
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
