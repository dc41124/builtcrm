import type { ReactNode } from "react";

import type {
  ContractorFinancialView,
  SubcontractorFinancialView,
  SubPaymentHistoryRow,
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

const STATUS_DOT: Record<string, "green" | "blue" | "amber" | "gray" | "red"> = {
  draft: "gray",
  ready_for_review: "gray",
  submitted: "blue",
  under_review: "amber",
  approved: "blue",
  approved_with_note: "blue",
  returned: "red",
  revised: "amber",
  paid: "green",
  closed: "green",
};

function statusLabel(s: string): string {
  return STATUS_LABELS[s] ?? s;
}

const DownloadIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const FileIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

// =============================================================================
// CONTRACTOR VIEW
// =============================================================================

export function ContractorFinancialPanel({
  view,
}: {
  view: ContractorFinancialView;
}) {
  const { contract, progress, draws, subPayments, retainage } = view;
  // Residential projects use "Scope" instead of "Trade" per the project-wide
  // copy rule (see builtcrm_residential_client_portal_pages.jsx).
  const scopeLabel = view.isResidential ? "Scope" : "Trade";

  const totalForBar =
    Math.max(0, progress.paidCents) +
    Math.max(0, progress.approvedUnpaidCents) +
    Math.max(0, progress.underReviewCents) +
    Math.max(0, progress.retainageHeldCents) +
    Math.max(0, progress.remainingCents);

  return (
    <div className="fv">
      <header className="fv-head">
        <div className="fv-head-main">
          <h1 className="fv-title">Financials</h1>
          <p className="fv-sub">
            {view.project.name} · Contract financial overview
          </p>
        </div>
        <div className="fv-head-actions">
          <button type="button" className="fv-btn">
            <DownloadIcon />
            Export Report
          </button>
          <button type="button" className="fv-btn primary">
            <FileIcon />
            New Draw Request
          </button>
        </div>
      </header>

      {/* Contract Summary */}
      <Card className="fv-card-pad">
        <div className="fv-card-top">
          <div className="fv-card-title">Contract Summary</div>
          <div className="fv-card-meta">{contract.asOfLabel}</div>
        </div>
        <div className="fv-stat-grid fv-stat-grid-5">
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
            tone="accent"
          />
          <Stat
            label="Billed to Date"
            value={formatMoneyCents(contract.billedToDateCents)}
          />
          <Stat
            label="Remaining to Bill"
            value={formatMoneyCents(contract.remainingToBillCents)}
            tone="warn"
          />
        </div>
      </Card>

      {/* Billing & Payment Progress */}
      <Card className="fv-card-pad">
        <div className="fv-card-top">
          <div className="fv-card-title">Billing &amp; Payment Progress</div>
          <div className="fv-pct">{progress.billedPct}% Billed</div>
        </div>
        <SegmentBar
          total={totalForBar}
          segments={[
            { color: "var(--ok)", cents: progress.paidCents },
            { color: "var(--in)", cents: progress.approvedUnpaidCents },
            { color: "var(--wr)", cents: progress.underReviewCents },
            { color: "var(--ac)", cents: progress.retainageHeldCents },
          ]}
        />
        <div className="fv-legend">
          <Legend
            color="var(--ok)"
            label="Paid"
            value={formatMoneyCents(progress.paidCents)}
          />
          <Legend
            color="var(--in)"
            label="Approved / Unpaid"
            value={formatMoneyCents(progress.approvedUnpaidCents)}
          />
          <Legend
            color="var(--wr)"
            label="Under Review"
            value={formatMoneyCents(progress.underReviewCents)}
          />
          <Legend
            color="var(--ac)"
            label="Retainage Held"
            value={formatMoneyCents(progress.retainageHeldCents)}
          />
          <Legend
            color="var(--s3)"
            label="Remaining"
            value={formatMoneyCents(progress.remainingCents)}
          />
        </div>
      </Card>

      <div className="fv-two-col">
        {/* Draw History */}
        <Card>
          <SectionHead
            title="Draw History"
            subtitle={`${view.completedDrawCount} completed · ${view.draftCount} in preparation`}
            action={
              <button type="button" className="fv-btn mini">
                View all
              </button>
            }
          />
          {draws.length === 0 ? (
            <Empty message="No draw requests yet." />
          ) : (
            <table className="fv-table">
              <thead>
                <tr>
                  <Th>Draw</Th>
                  <Th>Period</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Paid</Th>
                </tr>
              </thead>
              <tbody>
                {draws.map((d) => (
                  <tr key={d.id}>
                    <Td strong>Draw #{d.drawNumber}</Td>
                    <Td muted>
                      {formatPeriodRange(d.periodFrom, d.periodTo)}
                    </Td>
                    <Td money>
                      {formatMoneyCents(d.currentPaymentDueCents)}
                    </Td>
                    <Td>
                      <span className="fv-status">
                        <span
                          className={`fv-dot fv-dot-${STATUS_DOT[d.status] ?? "gray"}`}
                        />
                        {statusLabel(d.status)}
                      </span>
                    </Td>
                    <Td muted>
                      {d.paidAt
                        ? d.paidAt.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {/* Sub Payment Rollup */}
        <Card>
          <SectionHead
            title="Subcontractor Payment Status"
            subtitle={`${subPayments.length} active subcontractor${subPayments.length === 1 ? "" : "s"}`}
          />
          {subPayments.length === 0 ? (
            <Empty message="No active subcontractors on this project." />
          ) : (
            <div>
              {subPayments.map((s, i) => {
                const initials = s.organizationName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() ?? "")
                  .join("");
                return (
                  <div
                    key={s.organizationId}
                    className={`fv-sub-row${i < subPayments.length - 1 ? " fv-sub-row-divider" : ""}`}
                  >
                    <div className="fv-sub-av">{initials}</div>
                    <div className="fv-sub-main">
                      <div className="fv-sub-name">{s.organizationName}</div>
                      <div className="fv-sub-scope">
                        {s.tradeScope
                          ? `${scopeLabel} · ${s.tradeScope}`
                          : `${scopeLabel} not set`}
                      </div>
                    </div>
                    <div className="fv-sub-money">
                      <div className="fv-sub-val">
                        {formatMoneyCents(s.earnedCents)}
                      </div>
                      <div className="fv-sub-lbl">Earned</div>
                    </div>
                    <div className="fv-sub-money">
                      <div className="fv-sub-val">
                        {formatMoneyCents(s.paidCents)}
                      </div>
                      <div className="fv-sub-lbl">Paid</div>
                    </div>
                    <StatusPill
                      tone={s.status === "outstanding" ? "warn" : "ok"}
                    >
                      {s.status === "outstanding"
                        ? `${formatMoneyCents(s.outstandingCents)} due`
                        : "Current"}
                    </StatusPill>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Retainage Summary */}
      <Card>
        <SectionHead
          title="Retainage Summary"
          subtitle={`${retainage.defaultPercent}% retainage on all work completed`}
          action={
            <button type="button" className="fv-btn mini">
              Request Release
            </button>
          }
        />
        <div className="fv-retainage">
          <RetainageDial
            pct={
              retainage.heldCents + retainage.releasedCents > 0
                ? Math.round(
                    (retainage.heldCents /
                      (retainage.heldCents + retainage.releasedCents)) *
                      100,
                  )
                : 0
            }
          />
          <div className="fv-retainage-body">
            <div className="fv-retainage-amount">
              {formatMoneyCents(retainage.balanceCents)} held in retainage
            </div>
            <div className="fv-retainage-detail">
              Released at substantial completion.
            </div>
            <div className="fv-retainage-amounts">
              <RetainageAmount
                label="Accumulated"
                value={formatMoneyCents(
                  retainage.heldCents + retainage.releasedCents,
                )}
              />
              <RetainageAmount
                label="Released"
                value={formatMoneyCents(retainage.releasedCents)}
              />
              <RetainageAmount
                label="Balance"
                value={formatMoneyCents(retainage.balanceCents)}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// =============================================================================
// SUBCONTRACTOR VIEW
// =============================================================================

export function SubcontractorFinancialPanel({
  view,
}: {
  view: SubcontractorFinancialView;
}) {
  const { contract, progress, paymentHistory, lienWaivers, retainage } = view;
  const earned = contract.earnedCents;

  const totalForBar =
    Math.max(0, progress.paidCents) +
    Math.max(0, progress.approvedUnpaidCents) +
    Math.max(0, progress.retainageHeldCents);

  return (
    <div className="fv">
      <header className="fv-head">
        <div>
          <h1 className="fv-title">Payments</h1>
          <p className="fv-sub">
            {view.project.name} · Your payment status — {view.organizationName}
          </p>
        </div>
      </header>

      {/* Your Contract Summary */}
      <Card className="fv-card-pad">
        <div className="fv-card-top">
          <div className="fv-card-title">Your Contract Summary</div>
          <div className="fv-card-meta">
            {view.organizationName}
            {view.scopeLabel ? ` — ${view.scopeLabel} scope` : ""}
          </div>
        </div>
        <div className="fv-stat-grid fv-stat-grid-4">
          <Stat
            label="Contract Value"
            value={formatMoneyCents(
              earned + contract.remainingCents,
            )}
          />
          <Stat
            label="Total Earned"
            value={formatMoneyCents(earned)}
            tone="accent"
          />
          <Stat
            label="Total Paid"
            value={formatMoneyCents(contract.paidCents)}
          />
          <Stat
            label="Remaining"
            value={formatMoneyCents(contract.remainingCents)}
            tone="warn"
          />
        </div>
      </Card>

      {/* Payment Progress */}
      <Card className="fv-card-pad">
        <div className="fv-card-top">
          <div className="fv-card-title">Payment Progress</div>
          <div className="fv-pct">{progress.paidPct}% Paid</div>
        </div>
        <SegmentBar
          total={totalForBar}
          segments={[
            { color: "var(--ok)", cents: progress.paidCents },
            { color: "var(--in)", cents: progress.approvedUnpaidCents },
            { color: "var(--ac)", cents: progress.retainageHeldCents },
          ]}
        />
        <div className="fv-legend">
          <Legend
            color="var(--ok)"
            label="Paid"
            value={formatMoneyCents(progress.paidCents)}
          />
          <Legend
            color="var(--in)"
            label="Awaiting Payment"
            value={formatMoneyCents(progress.approvedUnpaidCents)}
          />
          <Legend
            color="var(--ac)"
            label="Retainage Held"
            value={formatMoneyCents(progress.retainageHeldCents)}
          />
        </div>
      </Card>

      <div className="fv-two-col">
        {/* Payment History Timeline */}
        <Card>
          <SectionHead
            title="Payment History"
            subtitle="Your billing submissions and payments received"
          />
          {paymentHistory.length === 0 ? (
            <Empty message="No billing submissions yet." />
          ) : (
            <div className="fv-timeline">
              {paymentHistory.map((p, i) => (
                <TimelineRow
                  key={p.drawId}
                  row={p}
                  last={i === paymentHistory.length - 1}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Right column: Retainage + Lien Waivers */}
        <div className="fv-stack">
          <Card>
            <SectionHead
              title="Retainage Held"
              subtitle={`${retainage.defaultPercent}% withheld on approved work`}
            />
            <div className="fv-retainage">
              <RetainageDial pct={retainage.defaultPercent} />
              <div className="fv-retainage-body">
                <div className="fv-retainage-amount">
                  {formatMoneyCents(retainage.heldCents)} held in retainage
                </div>
                <div className="fv-retainage-detail">
                  Released after substantial completion and closeout.
                </div>
                <div className="fv-retainage-amounts">
                  <RetainageAmount
                    label="Accumulated"
                    value={formatMoneyCents(retainage.heldCents)}
                  />
                  <RetainageAmount
                    label="Released"
                    value={formatMoneyCents(retainage.releasedCents)}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <SectionHead
              title="Lien Waiver Status"
              subtitle="Required for each draw payment"
            />
            {lienWaivers.length === 0 ? (
              <Empty message="No lien waivers on record yet." />
            ) : (
              <div>
                {lienWaivers.map((w, i) => (
                  <div
                    key={w.id}
                    className={`fv-waiver-row${i < lienWaivers.length - 1 ? " fv-sub-row-divider" : ""}`}
                  >
                    <div className="fv-waiver-main">
                      <div className="fv-waiver-title">
                        Draw #{w.drawNumber} —{" "}
                        {w.lienWaiverType.replace(/_/g, " ")}
                      </div>
                      <div className="fv-waiver-meta">
                        {w.submittedAt
                          ? `Submitted ${w.submittedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                          : "Not submitted"}{" "}
                        · Covers {formatMoneyCents(w.amountCents)}
                      </div>
                    </div>
                    <StatusPill
                      tone={
                        w.lienWaiverStatus === "accepted"
                          ? "ok"
                          : w.lienWaiverStatus === "submitted"
                            ? "info"
                            : "neutral"
                      }
                    >
                      {w.lienWaiverStatus.replace(/_/g, " ")}
                    </StatusPill>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// PRIMITIVES
// =============================================================================

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`fv-card ${className}`}>{children}</section>;
}

function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="fv-section-head">
      <div className="fv-section-head-main">
        <div className="fv-card-title">{title}</div>
        {subtitle && <div className="fv-card-meta">{subtitle}</div>}
      </div>
      {action && <div className="fv-section-head-act">{action}</div>}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "warn";
}) {
  return (
    <div className={`fv-stat${tone ? ` fv-stat-${tone}` : ""}`}>
      <div className="fv-stat-val">{value}</div>
      <div className="fv-stat-lbl">{label}</div>
    </div>
  );
}

function SegmentBar({
  segments,
  total,
}: {
  segments: Array<{ color: string; cents: number }>;
  total: number;
}) {
  if (total <= 0) {
    return <div className="fv-bar fv-bar-empty" />;
  }
  return (
    <div className="fv-bar">
      {segments.map((s, i) => {
        const pct = (Math.max(0, s.cents) / total) * 100;
        if (pct <= 0) return null;
        return (
          <div
            key={i}
            className="fv-bar-seg"
            style={{ width: `${pct}%`, background: s.color }}
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
    <div className="fv-legend-item">
      <span className="fv-legend-dot" style={{ background: color }} />
      {label} <span className="fv-legend-val">{value}</span>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="fv-th">{children}</th>;
}

function Td({
  children,
  strong,
  muted,
  money,
}: {
  children: ReactNode;
  strong?: boolean;
  muted?: boolean;
  money?: boolean;
}) {
  const cls = [
    "fv-td",
    strong && "fv-td-strong",
    muted && "fv-td-muted",
    money && "fv-td-money",
  ]
    .filter(Boolean)
    .join(" ");
  return <td className={cls}>{children}</td>;
}

function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "info" | "neutral";
  children: ReactNode;
}) {
  return <span className={`fv-pill fv-pill-${tone}`}>{children}</span>;
}

function RetainageDial({ pct }: { pct: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <div className="fv-dial">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--s3)"
          strokeWidth="6"
        />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--ac)"
          strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="fv-dial-pct">{pct}%</span>
    </div>
  );
}

function RetainageAmount({ label, value }: { label: string; value: string }) {
  return (
    <span className="fv-ra">
      {label}: <strong className="fv-ra-val">{value}</strong>
    </span>
  );
}

function TimelineRow({
  row,
  last,
}: {
  row: SubPaymentHistoryRow;
  last: boolean;
}) {
  const kind: "paid" | "pending" | "submitted" =
    row.drawStatus === "paid" || row.drawStatus === "closed"
      ? "paid"
      : row.drawStatus === "approved" || row.drawStatus === "approved_with_note"
        ? "pending"
        : "submitted";
  const title =
    kind === "paid"
      ? `Draw #${row.drawNumber} — Paid`
      : kind === "pending"
        ? `Draw #${row.drawNumber} — Approved, Awaiting Payment`
        : `Draw #${row.drawNumber} — ${statusLabel(row.drawStatus)}`;
  const meta =
    kind === "paid" && row.paidAt
      ? `${row.paidAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}${
          row.paymentReferenceName ? ` · ${row.paymentReferenceName}` : ""
        }`
      : row.submittedAt
        ? row.submittedAt.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—";
  return (
    <div className="fv-tl-row">
      {!last && <div className="fv-tl-line" />}
      <div className={`fv-tl-dot fv-tl-dot-${kind}`}>
        {kind === "paid" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : kind === "pending" ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        )}
      </div>
      <div className="fv-tl-main">
        <div className="fv-tl-title">{title}</div>
        <div className="fv-tl-meta">{meta}</div>
      </div>
      <div className="fv-tl-amount">{formatMoneyCents(row.amountCents)}</div>
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="fv-empty">{message}</div>;
}

