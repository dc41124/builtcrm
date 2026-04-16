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

      <FinancialStyles />
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

      <FinancialStyles />
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

// =============================================================================
// STYLES
// =============================================================================

function FinancialStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .fv{font-family:var(--fb);color:var(--t1)}
      .fv-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:16px;flex-wrap:wrap}
      .fv-head-main{min-width:0;flex:1}
      .fv-head-actions{display:flex;gap:8px;flex-shrink:0;padding-top:4px;flex-wrap:wrap}
      .fv-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;margin:0;color:var(--t1)}
      .fv-sub{font-family:var(--fb);font-size:13px;color:var(--t2);margin:4px 0 0;font-weight:520}

      .fv-btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-family:var(--fb);font-size:13px;font-weight:600;cursor:pointer;transition:all var(--df) var(--e);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
      .fv-btn:hover{border-color:var(--s4);background:var(--sh);color:var(--t1)}
      .fv-btn.primary{height:38px;padding:0 18px;background:var(--ac);border-color:var(--ac);color:#fff;font-weight:650}
      .fv-btn.primary:hover{background:var(--ac-h);border-color:var(--ac-h)}
      .fv-btn.mini{height:28px;padding:0 10px;font-size:11.5px}

      .fv-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden;margin-bottom:20px}
      .fv-card-pad{padding:20px 24px}
      .fv-card-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
      .fv-card-title{font-family:var(--fd);font-size:15px;font-weight:720;letter-spacing:-.02em;color:var(--t1)}
      .fv-card-meta{font-size:11.5px;color:var(--t3);font-weight:560}
      .fv-pct{font-family:var(--fd);font-size:18px;font-weight:820;color:var(--ac-t);letter-spacing:-.02em}

      .fv-section-head{padding:18px 20px 14px;border-bottom:1px solid var(--s3);display:flex;justify-content:space-between;align-items:center;gap:16px}
      .fv-section-head-main{min-width:0;flex:1}
      .fv-section-head-act{flex-shrink:0}

      .fv-stat-grid{display:grid;gap:16px}
      .fv-stat-grid-5{grid-template-columns:repeat(5,1fr)}
      .fv-stat-grid-4{grid-template-columns:repeat(4,1fr)}
      .fv-stat{text-align:center;padding:12px 8px;border-radius:var(--r-l);background:var(--s2)}
      .fv-stat-val{font-family:var(--fd);font-size:18px;font-weight:820;letter-spacing:-.02em;color:var(--t1);margin-bottom:2px}
      .fv-stat-lbl{font-size:11px;color:var(--t3);font-weight:600}
      .fv-stat-accent{background:var(--ac-s)}
      .fv-stat-accent .fv-stat-val,.fv-stat-accent .fv-stat-lbl{color:var(--ac-t)}
      .fv-stat-warn{background:var(--wr-s)}
      .fv-stat-warn .fv-stat-val,.fv-stat-warn .fv-stat-lbl{color:var(--wr-t)}

      .fv-bar{display:flex;width:100%;height:14px;background:var(--s2);border-radius:999px;overflow:hidden}
      .fv-bar-empty{background:var(--s2)}
      .fv-bar-seg{height:100%;transition:width .6s cubic-bezier(.16,1,.3,1)}
      .fv-bar-seg:first-child{border-radius:999px 0 0 999px}
      .fv-bar-seg:last-child{border-radius:0 999px 999px 0}

      .fv-legend{display:flex;gap:20px;margin-top:10px;flex-wrap:wrap}
      .fv-legend-item{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--t2);font-weight:560}
      .fv-legend-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}
      .fv-legend-val{font-family:var(--fd);font-weight:700;color:var(--t1);font-size:12px}

      .fv-two-col{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
      .fv-stack{display:flex;flex-direction:column;gap:20px}
      @media (max-width:1100px){.fv-two-col{grid-template-columns:1fr}.fv-stat-grid-5,.fv-stat-grid-4{grid-template-columns:repeat(2,1fr)}}

      .fv-table{width:100%;border-collapse:collapse}
      .fv-th{font-family:var(--fd);font-size:10.5px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;padding:10px 14px;text-align:left;border-bottom:1px solid var(--s3);white-space:nowrap;background:var(--s2)}
      .fv-td{padding:12px 14px;border-bottom:1px solid var(--s3);font-size:13px;color:var(--t1)}
      .fv-td-strong{font-family:var(--fd);font-weight:700}
      .fv-td-muted{font-size:12px;color:var(--t2)}
      .fv-td-money{font-family:var(--fd);font-size:13px;font-weight:700}
      .fv-table tbody tr:last-child .fv-td{border-bottom:none}
      .fv-table tbody tr:hover{background:var(--sh)}

      .fv-status{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:620}
      .fv-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
      .fv-dot-green{background:var(--ok)}
      .fv-dot-blue{background:var(--in)}
      .fv-dot-amber{background:var(--wr)}
      .fv-dot-red{background:var(--dg)}
      .fv-dot-gray{background:var(--s4)}

      .fv-sub-row{padding:12px 16px;display:flex;align-items:center;gap:14px}
      .fv-sub-row-divider{border-bottom:1px solid var(--s3)}
      .fv-sub-av{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-family:var(--fd);font-size:11px;font-weight:700;color:#fff;background:linear-gradient(135deg,var(--ac),var(--accent-l,var(--ac)));flex-shrink:0}
      .fv-sub-main{flex:1;min-width:0}
      .fv-sub-name{font-family:var(--fm);font-size:12.5px;font-weight:560;color:var(--t1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .fv-sub-money{text-align:right;flex-shrink:0}
      .fv-sub-val{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1)}
      .fv-sub-lbl{font-size:10px;color:var(--t3);font-weight:600;margin-top:1px}

      .fv-pill{display:inline-flex;align-items:center;gap:4px;font-family:var(--fd);font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap}
      .fv-pill-ok{background:var(--ok-s);color:var(--ok-t)}
      .fv-pill-warn{background:var(--wr-s);color:var(--wr-t)}
      .fv-pill-info{background:var(--in-s);color:var(--in-t)}
      .fv-pill-neutral{background:var(--s2);color:var(--t2)}

      .fv-retainage{display:flex;align-items:center;gap:16px;padding:16px 20px}
      .fv-dial{width:64px;height:64px;position:relative;display:grid;place-items:center;flex-shrink:0}
      .fv-dial-pct{position:absolute;font-family:var(--fd);font-size:14px;font-weight:750;color:var(--t1)}
      .fv-retainage-body{flex:1;min-width:0}
      .fv-retainage-amount{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1)}
      .fv-retainage-detail{font-size:12.5px;color:var(--t2);margin-top:3px;font-weight:520}
      .fv-retainage-amounts{display:flex;gap:20px;margin-top:8px;flex-wrap:wrap}
      .fv-ra{font-size:12px;font-weight:560;color:var(--t3)}
      .fv-ra-val{font-family:var(--fd);color:var(--t1);font-weight:700}

      .fv-timeline{padding:16px 20px}
      .fv-tl-row{display:flex;gap:12px;margin-bottom:14px;position:relative}
      .fv-tl-row:last-child{margin-bottom:0}
      .fv-tl-line{position:absolute;left:13px;top:30px;bottom:-10px;width:1.5px;background:var(--s3)}
      .fv-tl-dot{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;z-index:1;border:2px solid}
      .fv-tl-dot svg{width:12px;height:12px}
      .fv-tl-dot-paid{background:var(--ok-s);color:var(--ok-t);border-color:var(--ok-s)}
      .fv-tl-dot-pending{background:var(--wr-s);color:var(--wr-t);border-color:var(--wr-s)}
      .fv-tl-dot-submitted{background:var(--in-s);color:var(--in-t);border-color:var(--in-s)}
      .fv-tl-main{flex:1;min-width:0}
      .fv-tl-title{font-size:13px;font-weight:640;color:var(--t1)}
      .fv-tl-meta{font-size:11.5px;color:var(--t3);margin-top:2px;font-weight:520}
      .fv-tl-amount{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);flex-shrink:0}

      .fv-waiver-row{padding:12px 16px;display:flex;align-items:center;gap:14px}
      .fv-waiver-main{flex:1;min-width:0}
      .fv-waiver-title{font-size:13px;font-weight:620;color:var(--t1);text-transform:capitalize}
      .fv-waiver-meta{font-size:11.5px;color:var(--t3);margin-top:2px;font-weight:520}

      .fv-empty{font-size:13px;color:var(--t3);padding:20px 20px;font-weight:520}
    ` }} />
  );
}
