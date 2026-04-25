import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Cover letter + table of contents for a closeout-package ZIP. The PDF
// is embedded as INDEX.pdf at the top of the archive so recipients who
// unzip into a folder see the index first by name order.

export type CloseoutCoverSection = {
  sectionLabel: string;
  items: Array<{
    indexLabel: string;
    name: string;
    sizeBytes: number;
    notes: string | null;
  }>;
};

export type CloseoutCoverData = {
  numberLabel: string; // CO-2026-0003
  title: string;
  contractorOrgName: string;
  projectName: string;
  projectAddress: string | null;
  deliveredAt: Date | null;
  deliveredByName: string | null;
  sections: CloseoutCoverSection[];
};

function fmtSize(bytes: number): string {
  if (bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) return `${(mb / 1024).toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.round(mb * 1000)} KB`;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    padding: 40,
    color: "#1a1a1a",
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#d0ccc4",
    paddingBottom: 14,
    marginBottom: 16,
  },
  number: {
    fontFamily: "Courier",
    fontSize: 10,
    color: "#5b4fc7",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  metaLabel: {
    fontSize: 8,
    color: "#8a8884",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
  },
  sectionHeader: {
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e4e2dc",
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  itemRow: {
    flexDirection: "row",
    paddingVertical: 3,
    borderBottomWidth: 0.25,
    borderBottomColor: "#eceae4",
  },
  itemIndex: {
    width: 40,
    fontFamily: "Courier",
    fontSize: 9,
    color: "#525050",
  },
  itemName: {
    flex: 1,
    fontSize: 9.5,
  },
  itemSize: {
    width: 60,
    fontFamily: "Courier",
    fontSize: 9,
    color: "#525050",
    textAlign: "right",
  },
  note: {
    marginLeft: 40,
    fontSize: 8.5,
    color: "#525050",
    fontStyle: "italic",
    paddingVertical: 2,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: "#e4e2dc",
    paddingTop: 8,
    fontSize: 8,
    color: "#8a8884",
    textAlign: "center",
  },
});

export function CloseoutCoverDocument({
  data,
}: {
  data: CloseoutCoverData;
}) {
  const deliveredLine = data.deliveredAt
    ? data.deliveredAt.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.number}>{data.numberLabel}</Text>
          <Text style={styles.title}>{data.title}</Text>
          <View style={styles.metaRow}>
            <View>
              <Text style={styles.metaLabel}>Project</Text>
              <Text style={styles.metaValue}>{data.projectName}</Text>
              {data.projectAddress ? (
                <Text style={{ fontSize: 9, color: "#525050" }}>
                  {data.projectAddress}
                </Text>
              ) : null}
            </View>
            <View>
              <Text style={styles.metaLabel}>Prepared by</Text>
              <Text style={styles.metaValue}>{data.contractorOrgName}</Text>
              {data.deliveredByName ? (
                <Text style={{ fontSize: 9, color: "#525050" }}>
                  {data.deliveredByName}
                </Text>
              ) : null}
            </View>
            {deliveredLine ? (
              <View>
                <Text style={styles.metaLabel}>Delivered</Text>
                <Text style={styles.metaValue}>{deliveredLine}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {data.sections.map((sec, idx) => (
          <View key={idx} wrap={false}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>
                {String(idx + 1).padStart(2, "0")} · {sec.sectionLabel}
              </Text>
            </View>
            {sec.items.length === 0 ? (
              <Text style={{ fontSize: 9, color: "#8a8884", fontStyle: "italic" }}>
                (no items)
              </Text>
            ) : null}
            {sec.items.map((it, j) => (
              <View key={j}>
                <View style={styles.itemRow}>
                  <Text style={styles.itemIndex}>{it.indexLabel}</Text>
                  <Text style={styles.itemName}>{it.name}</Text>
                  <Text style={styles.itemSize}>{fmtSize(it.sizeBytes)}</Text>
                </View>
                {it.notes ? (
                  <Text style={styles.note}>↳ {it.notes}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          Closeout package {data.numberLabel} · Generated by BuiltCRM for{" "}
          {data.projectName}
        </Text>
      </Page>
    </Document>
  );
}
