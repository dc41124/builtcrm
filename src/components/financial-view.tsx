import type {
  ContractorFinancialView,
  SubcontractorFinancialView,
} from "@/domain/loaders/financial";
import {
  formatMoneyCents,
  formatPeriodRange,
} from "@/domain/loaders/financial";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready_for_review: "Ready",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  approved_with_note: "Approved w/ note",
  returned: "Returned",
  revised: "Revised",
  paid: "Paid",
  closed: "Closed",
};

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #e2e5e9",
  borderRadius: 14,
  background: "#fff",
  padding: "18px 20px",
  marginBottom: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  marginBottom: 12,
  color: "#1a1714",
};

const statLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#9c958a",
  fontWeight: 600,
};

const statValue: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#1a1714",
  fontFamily: "monospace",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  color: "#9c958a",
  textTransform: "uppercase",
  borderBottom: "1px solid #e2e5e9",
  padding: "8px 12px",
  fontWeight: 700,
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #f1f3f5",
  fontSize: 13,
};

export function ContractorFinancialPanel({
  view,
}: {
  view: ContractorFinancialView;
}) {
  const { contract, progress, draws, subPayments, retainage } = view;

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 750, margin: 0 }}>Financials</h1>
        <p style={{ fontSize: 13, color: "#6b655b", marginTop: 4 }}>
          {view.project.name} · Contract financial overview
        </p>
      </header>

      {/* Contract summary */}
      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div style={titleStyle}>Contract Summary</div>
          <div style={{ fontSize: 11.5, color: "#9c958a" }}>
            {contract.asOfLabel}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
          }}
        >
          <Stat
            label="Original Contract"
            value={formatMoneyCents(contract.originalContractCents)}
          />
          <Stat
            label={`Change Orders (${contract.approvedChangeOrderCount})`}
            value={`+${formatMoneyCents(contract.approvedChangeOrderCents)}`}
          />
          <Stat
            label="Revised Contract"
            value={formatMoneyCents(contract.revisedContractCents)}
            highlight
          />
          <Stat
            label="Billed to Date"
            value={formatMoneyCents(contract.billedToDateCents)}
          />
          <Stat
            label="Remaining to Bill"
            value={formatMoneyCents(contract.remainingToBillCents)}
            warn
          />
        </div>
      </section>

      {/* Billing progress */}
      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={titleStyle}>Billing &amp; Payment Progress</div>
          <div
            style={{ fontSize: 16, fontWeight: 750, color: "#4a3fb0" }}
          >{`${progress.billedPct}% Billed`}</div>
        </div>
        <ProgressBar
          segments={[
            { color: "#2d8a5e", cents: progress.paidCents },
            { color: "#3178b9", cents: progress.approvedUnpaidCents },
            { color: "#c17a1a", cents: progress.underReviewCents },
            { color: "#5b4fc7", cents: progress.retainageHeldCents },
            { color: "#e2e5e9", cents: progress.remainingCents },
          ]}
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            marginTop: 10,
          }}
        >
          <Legend
            color="#2d8a5e"
            label="Paid"
            value={formatMoneyCents(progress.paidCents)}
          />
          <Legend
            color="#3178b9"
            label="Approved / Unpaid"
            value={formatMoneyCents(progress.approvedUnpaidCents)}
          />
          <Legend
            color="#c17a1a"
            label="Under Review"
            value={formatMoneyCents(progress.underReviewCents)}
          />
          <Legend
            color="#5b4fc7"
            label="Retainage Held"
            value={formatMoneyCents(progress.retainageHeldCents)}
          />
          <Legend
            color="#e2e5e9"
            label="Remaining"
            value={formatMoneyCents(progress.remainingCents)}
          />
        </div>
      </section>

      {/* Draw history */}
      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div>
            <div style={titleStyle}>Draw History</div>
            <div style={{ fontSize: 11.5, color: "#9c958a" }}>
              {view.completedDrawCount} submitted · {view.draftCount} in preparation
            </div>
          </div>
        </div>
        {draws.length === 0 ? (
          <Empty message="No draw requests yet." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Draw</th>
                <th style={thStyle}>Period</th>
                <th style={thStyle}>Amount Due</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Paid</th>
              </tr>
            </thead>
            <tbody>
              {draws.map((d) => (
                <tr key={d.id}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>
                    Draw #{d.drawNumber}
                  </td>
                  <td style={tdStyle}>
                    {formatPeriodRange(d.periodFrom, d.periodTo)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>
                    {formatMoneyCents(d.currentPaymentDueCents)}
                  </td>
                  <td style={tdStyle}>{statusLabel(d.status)}</td>
                  <td style={tdStyle}>
                    {d.paidAt
                      ? d.paidAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Sub payment rollup */}
      <section style={cardStyle}>
        <div style={titleStyle}>Subcontractor Payment Status</div>
        {subPayments.length === 0 ? (
          <Empty message="No active subcontractors on this project." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Subcontractor</th>
                <th style={thStyle}>Earned</th>
                <th style={thStyle}>Paid</th>
                <th style={thStyle}>Outstanding</th>
                <th style={thStyle}>Status</th>
              </tr>
            </thead>
            <tbody>
              {subPayments.map((s) => (
                <tr key={s.organizationId}>
                  <td style={tdStyle}>{s.organizationName}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>
                    {formatMoneyCents(s.earnedCents)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>
                    {formatMoneyCents(s.paidCents)}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>
                    {formatMoneyCents(s.outstandingCents)}
                  </td>
                  <td style={tdStyle}>
                    {s.status === "outstanding"
                      ? `${formatMoneyCents(s.outstandingCents)} due`
                      : "Current"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Retainage */}
      <section style={cardStyle}>
        <div style={titleStyle}>Retainage Summary</div>
        <div style={{ fontSize: 11.5, color: "#9c958a", marginBottom: 8 }}>
          {retainage.defaultPercent}% retainage on all work completed
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
          }}
        >
          <Stat
            label="Accumulated"
            value={formatMoneyCents(
              retainage.heldCents + retainage.releasedCents,
            )}
          />
          <Stat
            label="Released"
            value={formatMoneyCents(retainage.releasedCents)}
          />
          <Stat
            label="Balance Held"
            value={formatMoneyCents(retainage.balanceCents)}
            highlight
          />
        </div>
      </section>
    </div>
  );
}

export function SubcontractorFinancialPanel({
  view,
}: {
  view: SubcontractorFinancialView;
}) {
  const { contract, progress, paymentHistory, lienWaivers, retainage } = view;
  const earned = contract.earnedCents;

  return (
    <div>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 750, margin: 0 }}>Payments</h1>
        <p style={{ fontSize: 13, color: "#6b655b", marginTop: 4 }}>
          {view.project.name} · Your payment status — {view.organizationName}
        </p>
      </header>

      <section style={cardStyle}>
        <div style={titleStyle}>Your Summary</div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          <Stat label="Total Earned" value={formatMoneyCents(earned)} highlight />
          <Stat
            label="Total Paid"
            value={formatMoneyCents(contract.paidCents)}
          />
          <Stat
            label="Approved / Awaiting"
            value={formatMoneyCents(contract.approvedUnpaidCents)}
          />
          <Stat
            label="Retainage Held"
            value={formatMoneyCents(contract.retainageHeldCents)}
            warn
          />
        </div>
      </section>

      <section style={cardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <div style={titleStyle}>Payment Progress</div>
          <div
            style={{ fontSize: 16, fontWeight: 750, color: "#4a3fb0" }}
          >{`${progress.paidPct}% Paid`}</div>
        </div>
        <ProgressBar
          segments={[
            { color: "#2d8a5e", cents: progress.paidCents },
            { color: "#3178b9", cents: progress.approvedUnpaidCents },
            { color: "#5b4fc7", cents: progress.retainageHeldCents },
          ]}
        />
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10 }}
        >
          <Legend
            color="#2d8a5e"
            label="Paid"
            value={formatMoneyCents(progress.paidCents)}
          />
          <Legend
            color="#3178b9"
            label="Awaiting Payment"
            value={formatMoneyCents(progress.approvedUnpaidCents)}
          />
          <Legend
            color="#5b4fc7"
            label="Retainage Held"
            value={formatMoneyCents(progress.retainageHeldCents)}
          />
        </div>
      </section>

      <section style={cardStyle}>
        <div style={titleStyle}>Payment History</div>
        {paymentHistory.length === 0 ? (
          <Empty message="No billing submissions yet." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Draw</th>
                <th style={thStyle}>Submitted</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Paid</th>
              </tr>
            </thead>
            <tbody>
              {paymentHistory.map((p) => (
                <tr key={p.drawId}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>
                    Draw #{p.drawNumber}
                  </td>
                  <td style={tdStyle}>
                    {p.submittedAt
                      ? p.submittedAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td style={tdStyle}>{statusLabel(p.drawStatus)}</td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>
                    {formatMoneyCents(p.amountCents)}
                  </td>
                  <td style={tdStyle}>
                    {p.paidAt
                      ? `${p.paidAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}${
                          p.paymentReferenceName
                            ? ` · ${p.paymentReferenceName}`
                            : ""
                        }`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={cardStyle}>
        <div style={titleStyle}>Retainage Held</div>
        <div style={{ fontSize: 11.5, color: "#9c958a", marginBottom: 8 }}>
          {retainage.defaultPercent}% withheld on approved work. Released after
          substantial completion and closeout.
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
          }}
        >
          <Stat
            label="Accumulated"
            value={formatMoneyCents(retainage.heldCents)}
          />
          <Stat
            label="Released"
            value={formatMoneyCents(retainage.releasedCents)}
          />
        </div>
      </section>

      <section style={cardStyle}>
        <div style={titleStyle}>Lien Waiver Status</div>
        {lienWaivers.length === 0 ? (
          <Empty message="No lien waivers on record yet." />
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Draw</th>
                <th style={thStyle}>Type</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {lienWaivers.map((w) => (
                <tr key={w.id}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>
                    Draw #{w.drawNumber}
                  </td>
                  <td style={tdStyle}>
                    {w.lienWaiverType.replace(/_/g, " ")}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "monospace" }}>
                    {formatMoneyCents(w.amountCents)}
                  </td>
                  <td style={tdStyle}>
                    {w.lienWaiverStatus.replace(/_/g, " ")}
                  </td>
                  <td style={tdStyle}>
                    {w.submittedAt
                      ? w.submittedAt.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// ---- Small primitives ---------------------------------------------------

function Stat({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  const bg = highlight ? "#eeedfb" : warn ? "#fdf4e6" : "#f3f4f6";
  const text = highlight ? "#4a3fb0" : warn ? "#96600f" : "#1a1714";
  return (
    <div
      style={{
        background: bg,
        borderRadius: 10,
        padding: "10px 12px",
        textAlign: "center",
      }}
    >
      <div style={{ ...statValue, color: text }}>{value}</div>
      <div style={{ ...statLabel, color: text }}>{label}</div>
    </div>
  );
}

function ProgressBar({
  segments,
}: {
  segments: Array<{ color: string; cents: number }>;
}) {
  const total = segments.reduce((acc, s) => acc + Math.max(0, s.cents), 0);
  if (total === 0) {
    return (
      <div
        style={{
          width: "100%",
          height: 14,
          background: "#f3f4f6",
          borderRadius: 999,
        }}
      />
    );
  }
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: 14,
        background: "#f3f4f6",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      {segments.map((s, i) => {
        const pct = (Math.max(0, s.cents) / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={i}
            style={{ width: `${pct}%`, background: s.color, height: "100%" }}
          />
        );
      })}
    </div>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "#6b655b",
      }}
    >
      <div
        style={{ width: 10, height: 10, borderRadius: 3, background: color }}
      />
      {label}{" "}
      <span
        style={{ fontFamily: "monospace", color: "#1a1714", fontWeight: 650 }}
      >
        {value}
      </span>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div style={{ fontSize: 13, color: "#9c958a", padding: "14px 4px" }}>
      {message}
    </div>
  );
}
