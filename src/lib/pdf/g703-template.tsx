import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// One row in the continuation sheet. Mirrors the shape of a draw_line_item
// joined to its sov_line_item — the on-screen G703 table in the contractor
// billing workspace uses the same 10 columns in the same order.
export type G703Line = {
  itemNumber: string;
  description: string;
  scheduledValueCents: number;
  workCompletedPreviousCents: number;
  workCompletedThisPeriodCents: number;
  materialsPresentlyStoredCents: number;
  totalCompletedStoredToDateCents: number;
  percentCompleteBasisPoints: number;
  balanceToFinishCents: number;
  retainageCents: number;
};

export type G703Data = {
  projectName: string;
  contractorName: string;
  drawNumber: number;
  applicationDate: Date;
  periodFrom: Date;
  periodTo: Date;
  lines: G703Line[];
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

function fmtPct(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(1)}%`;
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Column widths tuned for landscape Letter (11" × 8.5", usable ~720pt wide
// after 40pt side margins). Description flexes; everything else is fixed.
const COL = {
  item: 42,
  description: 200,
  scheduled: 76,
  previous: 70,
  thisPeriod: 70,
  stored: 62,
  total: 76,
  pct: 44,
  balance: 72,
  retainage: 68,
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#1a1714",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: "#1a1714",
    paddingBottom: 8,
    marginBottom: 10,
  },
  headerTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    letterSpacing: 0.4,
  },
  headerSub: {
    fontSize: 8.5,
    color: "#6b6864",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  metaCell: {
    flexDirection: "row",
    gap: 6,
    fontSize: 8.5,
  },
  metaLabel: {
    color: "#6b6864",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontSize: 7.5,
    paddingTop: 1,
  },
  metaValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#efebe5",
    borderTopWidth: 1,
    borderTopColor: "#1a1714",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1714",
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  th: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#2f2c28",
  },
  thRight: {
    textAlign: "right",
  },
  thCenter: {
    textAlign: "center",
  },
  tr: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e2dd",
  },
  trAlt: {
    backgroundColor: "#faf9f6",
  },
  td: {
    fontSize: 8.5,
    color: "#1a1714",
  },
  tdRight: {
    textAlign: "right",
  },
  tdCenter: {
    textAlign: "center",
  },
  tdDesc: {
    color: "#2f2c28",
  },
  tfoot: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: "#1a1714",
    borderBottomWidth: 2,
    borderBottomColor: "#1a1714",
    backgroundColor: "#f4f1ec",
  },
  tfootLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
  },
  tfootValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    textAlign: "right",
  },
  empty: {
    padding: 24,
    textAlign: "center",
    fontSize: 10,
    color: "#6b6864",
    fontStyle: "italic",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: "#9b968f",
    letterSpacing: 0.3,
  },
});

export function G703Document({ data }: { data: G703Data }) {
  const totals = data.lines.reduce(
    (acc, l) => ({
      scheduled: acc.scheduled + l.scheduledValueCents,
      previous: acc.previous + l.workCompletedPreviousCents,
      thisPeriod: acc.thisPeriod + l.workCompletedThisPeriodCents,
      stored: acc.stored + l.materialsPresentlyStoredCents,
      total: acc.total + l.totalCompletedStoredToDateCents,
      balance: acc.balance + l.balanceToFinishCents,
      retainage: acc.retainage + l.retainageCents,
    }),
    {
      scheduled: 0,
      previous: 0,
      thisPeriod: 0,
      stored: 0,
      total: 0,
      balance: 0,
      retainage: 0,
    },
  );
  const totalsPct =
    totals.scheduled > 0
      ? `${((totals.total / totals.scheduled) * 100).toFixed(1)}%`
      : "0.0%";

  return (
    <Document
      title={`G703 — Continuation Sheet (Draw #${data.drawNumber})`}
      author={data.contractorName}
      subject="AIA G703 Continuation Sheet"
    >
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Continuation Sheet</Text>
          <Text style={styles.headerSub}>
            AIA Document G703 · Continuation of G702 Application No.{" "}
            {data.drawNumber}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Project</Text>
            <Text style={styles.metaValue}>{data.projectName}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Contractor</Text>
            <Text style={styles.metaValue}>{data.contractorName}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Period</Text>
            <Text style={styles.metaValue}>
              {fmtDate(data.periodFrom)} – {fmtDate(data.periodTo)}
            </Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{fmtDate(data.applicationDate)}</Text>
          </View>
        </View>

        {/* Table header — fixed so it repeats on every page for long SOVs */}
        <View style={styles.tableHeader} fixed>
          <Text style={[styles.th, { width: COL.item }]}>Item</Text>
          <Text style={[styles.th, { width: COL.description }]}>Description</Text>
          <Text style={[styles.th, styles.thRight, { width: COL.scheduled }]}>
            Scheduled
          </Text>
          <Text style={[styles.th, styles.thRight, { width: COL.previous }]}>
            Previous
          </Text>
          <Text style={[styles.th, styles.thRight, { width: COL.thisPeriod }]}>
            This period
          </Text>
          <Text style={[styles.th, styles.thRight, { width: COL.stored }]}>
            Stored
          </Text>
          <Text style={[styles.th, styles.thRight, { width: COL.total }]}>
            Total to date
          </Text>
          <Text style={[styles.th, styles.thCenter, { width: COL.pct }]}>
            %
          </Text>
          <Text style={[styles.th, styles.thRight, { width: COL.balance }]}>
            Balance
          </Text>
          <Text style={[styles.th, styles.thRight, { width: COL.retainage }]}>
            Retainage
          </Text>
        </View>

        {data.lines.length === 0 ? (
          <Text style={styles.empty}>
            No line items on this draw. Line items are pulled from the Schedule
            of Values when the draw is built.
          </Text>
        ) : (
          <>
            {data.lines.map((l, i) => (
              <View
                key={i}
                style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]}
                wrap={false}
              >
                <Text style={[styles.td, { width: COL.item }]}>
                  {l.itemNumber}
                </Text>
                <Text style={[styles.td, styles.tdDesc, { width: COL.description }]}>
                  {l.description}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COL.scheduled }]}>
                  {fmtMoney(l.scheduledValueCents)}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COL.previous }]}>
                  {fmtMoney(l.workCompletedPreviousCents)}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COL.thisPeriod }]}>
                  {fmtMoney(l.workCompletedThisPeriodCents)}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COL.stored }]}>
                  {fmtMoney(l.materialsPresentlyStoredCents)}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COL.total }]}>
                  {fmtMoney(l.totalCompletedStoredToDateCents)}
                </Text>
                <Text style={[styles.td, styles.tdCenter, { width: COL.pct }]}>
                  {fmtPct(l.percentCompleteBasisPoints)}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COL.balance }]}>
                  {fmtMoney(l.balanceToFinishCents)}
                </Text>
                <Text style={[styles.td, styles.tdRight, { width: COL.retainage }]}>
                  {fmtMoney(l.retainageCents)}
                </Text>
              </View>
            ))}
            <View style={styles.tfoot} wrap={false}>
              <Text style={[styles.tfootLabel, { width: COL.item + COL.description }]}>
                Totals
              </Text>
              <Text style={[styles.tfootValue, { width: COL.scheduled }]}>
                {fmtMoney(totals.scheduled)}
              </Text>
              <Text style={[styles.tfootValue, { width: COL.previous }]}>
                {fmtMoney(totals.previous)}
              </Text>
              <Text style={[styles.tfootValue, { width: COL.thisPeriod }]}>
                {fmtMoney(totals.thisPeriod)}
              </Text>
              <Text style={[styles.tfootValue, { width: COL.stored }]}>
                {fmtMoney(totals.stored)}
              </Text>
              <Text style={[styles.tfootValue, { width: COL.total }]}>
                {fmtMoney(totals.total)}
              </Text>
              <Text
                style={[styles.tfootValue, styles.tdCenter, { width: COL.pct }]}
              >
                {totalsPct}
              </Text>
              <Text style={[styles.tfootValue, { width: COL.balance }]}>
                {fmtMoney(totals.balance)}
              </Text>
              <Text style={[styles.tfootValue, { width: COL.retainage }]}>
                {fmtMoney(totals.retainage)}
              </Text>
            </View>
          </>
        )}

        <View style={styles.footer} fixed>
          <Text>
            Generated by BuiltCRM · {fmtDate(data.applicationDate)} · G703
            continues G702 application #{data.drawNumber}
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
