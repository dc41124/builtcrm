"use client";

import { useMemo } from "react";

import type { ClientProjectView, SelectionCategoryRow } from "@/domain/loaders/project-home";

type Props = {
  drawRequests: ClientProjectView["drawRequests"];
  milestones: ClientProjectView["milestones"];
  selections: SelectionCategoryRow[];
};

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const PAID = new Set(["paid"]);
const PENDING = new Set(["submitted", "under_review"]);

export function ResidentialBudgetView({
  drawRequests,
  milestones,
  selections,
}: Props) {
  const sortedDraws = useMemo(
    () => [...drawRequests].sort((a, b) => a.drawNumber - b.drawNumber),
    [drawRequests],
  );

  const rollup = useMemo(() => {
    const latest = drawRequests.reduce<(typeof drawRequests)[number] | null>(
      (a, d) => (a && a.drawNumber > d.drawNumber ? a : d),
      null,
    );
    const originalCents = latest?.originalContractSumCents ?? 0;
    const contractCents = latest?.contractSumToDateCents ?? 0;

    let paidCents = 0;
    let nextPaymentCents = 0;
    let nextDraw: (typeof drawRequests)[number] | null = null;

    for (const d of sortedDraws) {
      if (PAID.has(d.drawRequestStatus)) {
        paidCents += d.currentPaymentDueCents;
      } else if (PENDING.has(d.drawRequestStatus)) {
        if (!nextDraw) {
          nextDraw = d;
          nextPaymentCents = d.currentPaymentDueCents;
        }
      }
    }

    const remainingCents = Math.max(0, contractCents - paidCents - nextPaymentCents);
    const pctPaid = contractCents > 0 ? (paidCents / contractCents) * 100 : 0;
    const pctNext = contractCents > 0 ? (nextPaymentCents / contractCents) * 100 : 0;

    return {
      originalCents,
      contractCents,
      paidCents,
      nextPaymentCents,
      nextDraw,
      remainingCents,
      pctPaid,
      pctNext,
    };
  }, [drawRequests, sortedDraws]);

  // Selection upgrades: sum priceDelta from confirmed decisions
  const selectionItems = useMemo(() => {
    return selections.flatMap((cat) =>
      cat.items.map((item) => {
        const decision = item.currentDecision;
        const confirmed =
          item.selectionItemStatus === "confirmed" ||
          item.selectionItemStatus === "locked";
        const pending =
          item.selectionItemStatus === "exploring" ||
          item.selectionItemStatus === "provisional" ||
          item.selectionItemStatus === "revision_open";
        const delta = decision?.priceDeltaCents ?? 0;
        const type: "over" | "under" | "even" =
          delta > 0 ? "over" : delta < 0 ? "under" : "even";
        return {
          id: item.id,
          name: item.title,
          status: confirmed ? "Confirmed" : pending ? "Pending" : "Not started",
          statusType: confirmed ? "green" : pending ? "amber" : "gray",
          amount: delta !== 0 ? `${delta > 0 ? "+" : ""}${fmtCents(delta)}` : delta === 0 && confirmed ? "No cost impact" : "TBD",
          type,
        };
      }),
    );
  }, [selections]);

  const netSelectionImpact = selectionItems.reduce((sum, s) => {
    const match = s.amount.match(/[+-]?\$[\d,]+/);
    if (!match) return sum;
    const val = Number(match[0].replace(/[$,]/g, ""));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const selectionUpgradeCents = useMemo(() => {
    return selections.flatMap((c) => c.items)
      .filter((i) => i.currentDecision)
      .reduce((sum, i) => sum + (i.currentDecision?.priceDeltaCents ?? 0), 0);
  }, [selections]);

  // Payment timeline from draws + upcoming milestones
  const paymentTimeline = useMemo(() => {
    const rows: Array<{
      date: string;
      title: string;
      desc: string;
      amount: string;
      paid: boolean;
      opacity?: number;
    }> = [];

    for (const d of sortedDraws) {
      const isPaid = PAID.has(d.drawRequestStatus);
      const isPending = PENDING.has(d.drawRequestStatus);
      rows.push({
        date: d.paidAt ? fmtDate(d.paidAt) : d.submittedAt ? fmtDate(d.submittedAt) : `~${fmtDate(d.periodFrom)}`,
        title: `Draw #${d.drawNumber}`,
        desc: isPaid
          ? `Payment confirmed`
          : isPending
            ? "Awaiting your review"
            : "In preparation",
        amount: fmtCents(d.currentPaymentDueCents),
        paid: isPaid,
        opacity: !isPaid && !isPending ? 0.5 : undefined,
      });
    }

    // Add upcoming milestone-based payments for unfiled draws
    const nextMilestones = milestones
      .filter((m) => m.milestoneStatus === "scheduled" || m.milestoneStatus === "in_progress")
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
      .slice(0, 3);

    if (nextMilestones.length > 0 && sortedDraws.every((d) => PAID.has(d.drawRequestStatus) || PENDING.has(d.drawRequestStatus))) {
      for (let i = 0; i < nextMilestones.length; i++) {
        const m = nextMilestones[i];
        rows.push({
          date: `~${fmtDate(m.scheduledDate)}`,
          title: m.title,
          desc: "Payment due upon milestone completion",
          amount: "TBD",
          paid: false,
          opacity: 0.6 - i * 0.15,
        });
      }
    }

    return rows;
  }, [sortedDraws, milestones]);

  // Next milestone for the "next payment" callout
  const nextMilestone = milestones
    .filter((m) => m.milestoneStatus === "scheduled" || m.milestoneStatus === "in_progress")
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())[0] ?? null;

  const budgetStats = [
    { label: "Base contract", value: fmtCents(rollup.originalCents) },
    {
      label: "Selection upgrades",
      value: selectionUpgradeCents !== 0 ? `${selectionUpgradeCents > 0 ? "+" : ""}${fmtCents(selectionUpgradeCents)}` : "$0",
      color: selectionUpgradeCents > 0 ? "var(--wr-t)" : undefined,
    },
    { label: "Scope changes approved", value: fmtCents(rollup.contractCents - rollup.originalCents - selectionUpgradeCents) },
    { label: "Paid to date", value: fmtCents(rollup.paidCents), color: "var(--ok-t)" },
    { label: "Remaining balance", value: fmtCents(rollup.remainingCents + rollup.nextPaymentCents) },
  ];

  return (
    <div className="rbud">
      <div className="rbud-head">
        <div className="rbud-title">Your Budget</div>
        <div className="rbud-sub">
          Here&apos;s a clear picture of what your project costs, what you&apos;ve
          paid, and what&apos;s coming up next.
        </div>
      </div>

      {/* ── Budget hero ── */}
      <div className="rbud-bh">
        <div className="rbud-bh-main">
          <div className="rbud-bh-lbl">Current project total</div>
          <div className="rbud-bh-big">{fmtCents(rollup.contractCents || rollup.originalCents)}</div>
          <div className="rbud-bh-desc">
            Base contract {fmtCents(rollup.originalCents)}
            {selectionUpgradeCents > 0
              ? ` + ${fmtCents(selectionUpgradeCents)} in selection upgrades`
              : null}
          </div>
          <div className="rbud-bp">
            <div className="rbud-bp-bar">
              {rollup.pctPaid > 0 ? (
                <div className="rbud-bp-seg paid" style={{ width: `${rollup.pctPaid}%` }} />
              ) : null}
              {rollup.pctNext > 0 ? (
                <div className="rbud-bp-seg next" style={{ width: `${rollup.pctNext}%` }} />
              ) : null}
            </div>
            <div className="rbud-bp-leg">
              <div className="rbud-bp-leg-i">
                <div className="rbud-bp-dot" style={{ background: "var(--ac)" }} />
                Paid · {fmtCents(rollup.paidCents)}
              </div>
              {rollup.nextPaymentCents > 0 ? (
                <div className="rbud-bp-leg-i">
                  <div className="rbud-bp-dot" style={{ background: "var(--wr)", opacity: 0.7 }} />
                  Next payment · {fmtCents(rollup.nextPaymentCents)}
                </div>
              ) : null}
              <div className="rbud-bp-leg-i">
                <div className="rbud-bp-dot" style={{ background: "var(--s3)" }} />
                Remaining · {fmtCents(rollup.remainingCents)}
              </div>
            </div>
          </div>
        </div>

        <div className="rbud-bh-info">
          <div className="rbud-bh-info-title">Quick numbers</div>
          {budgetStats.map((s) => (
            <div key={s.label} className="rbud-bs-row">
              <span className="rbud-bs-lbl">{s.label}</span>
              <span className="rbud-bs-val" style={s.color ? { color: s.color } : undefined}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Next payment callout ── */}
      {rollup.nextDraw ? (
        <div className="rbud-np">
          <div className="rbud-np-lbl">Your next payment</div>
          <div className="rbud-np-amt">{fmtCents(rollup.nextPaymentCents)}</div>
          <div className="rbud-np-detail">
            {nextMilestone ? (
              <>
                This payment is tied to the <strong>{nextMilestone.title.toLowerCase()}</strong> milestone.
                Once your builder confirms the milestone is complete, you&apos;ll receive a notification to
                review and approve the payment.
              </>
            ) : (
              <>This payment is awaiting your review and approval.</>
            )}
          </div>
          {nextMilestone ? (
            <div className="rbud-np-milestone">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Estimated: {fmtDate(nextMilestone.scheduledDate)}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Payment history + Selections impact ── */}
      <div className="rbud-grid">
        {/* Payment history */}
        <div className="rbud-card">
          <div className="rbud-c-head">
            <div>
              <div className="rbud-c-title">Payment history</div>
              <div className="rbud-c-sub">Milestone-based payments you&apos;ve made so far</div>
            </div>
          </div>
          <div className="rbud-c-body">
            {paymentTimeline.length === 0 ? (
              <div className="rbud-empty">No payments have been processed yet.</div>
            ) : (
              paymentTimeline.map((pt, i) => (
                <div
                  key={i}
                  className="rbud-pt-row"
                  style={pt.opacity ? { opacity: pt.opacity } : undefined}
                >
                  <div className="rbud-pt-date">{pt.date}</div>
                  <div className="rbud-pt-desc">
                    <h5>{pt.title}</h5>
                    <p>{pt.desc}</p>
                  </div>
                  <div className={`rbud-pt-amt ${pt.paid ? "paid" : "up"}`}>
                    {pt.amount}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Selections & budget + tip */}
        <div>
          <div className="rbud-card">
            <div className="rbud-c-head">
              <div>
                <div className="rbud-c-title">Selections &amp; your budget</div>
                <div className="rbud-c-sub">How your choices compare to allowances</div>
              </div>
            </div>
            <div className="rbud-c-body">
              <div className="rbud-si-intro">
                Your contract includes allowances for certain items. When you pick
                something above or below the allowance, the difference shows up here.
              </div>
              {selectionItems.length === 0 ? (
                <div className="rbud-empty">No selection items published yet.</div>
              ) : (
                <>
                  {selectionItems.map((s) => (
                    <div key={s.id} className="rbud-si-row">
                      <div className="rbud-si-name">
                        <span className={`rbud-pl mini ${s.statusType}`}>
                          {s.status}
                        </span>
                        {s.name}
                      </div>
                      <div className={`rbud-si-amt ${s.type}`}>{s.amount}</div>
                    </div>
                  ))}
                  <div className="rbud-si-total">
                    <span className="rbud-si-total-lbl">Net selections impact</span>
                    <span className="rbud-si-total-val">
                      {selectionUpgradeCents > 0 ? "+" : ""}{fmtCents(selectionUpgradeCents)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rbud-tip">
            <div className="rbud-tip-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" />
              </svg>
              How payments work
            </div>
            <p>
              Your payments are tied to project milestones — not a fixed schedule.
              When your builder completes a milestone, they&apos;ll submit a payment
              request. You&apos;ll be notified to review and approve it before any
              money moves.
            </p>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: rbudCss }} />
    </div>
  );
}

const rbudCss = `
.rbud{display:flex;flex-direction:column}
.rbud-head{margin-bottom:20px}
.rbud-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.035em;line-height:1.15;color:var(--t1);margin:0}
.rbud-sub{font-family:var(--fb);font-size:13.5px;color:var(--t2);margin-top:4px;max-width:600px}

.rbud-bh{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px}
.rbud-bh-main{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:24px}
.rbud-bh-lbl{font-family:var(--fb);font-size:14px;color:var(--t2)}
.rbud-bh-big{font-family:var(--fd);font-size:36px;font-weight:820;letter-spacing:-.03em;line-height:1.1;color:var(--t1);margin-top:4px}
.rbud-bh-desc{font-family:var(--fb);font-size:13px;color:var(--t2);margin-top:8px}
.rbud-bp{margin-top:20px}
.rbud-bp-bar{height:10px;background:var(--s3);border-radius:5px;overflow:hidden;display:flex}
.rbud-bp-seg{height:100%}
.rbud-bp-seg.paid{background:var(--ac)}
.rbud-bp-seg.next{background:var(--wr);opacity:.7}
.rbud-bp-leg{display:flex;gap:20px;margin-top:12px;flex-wrap:wrap}
.rbud-bp-leg-i{display:flex;align-items:center;gap:6px;font-family:var(--fb);font-size:12px;color:var(--t2)}
.rbud-bp-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}

.rbud-bh-info{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:24px;display:flex;flex-direction:column;justify-content:space-between}
.rbud-bh-info-title{font-family:var(--fd);font-size:15px;font-weight:680;color:var(--t1);margin-bottom:12px}
.rbud-bs-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--s3)}
.rbud-bs-row:last-child{border-bottom:none}
.rbud-bs-lbl{font-family:var(--fb);font-size:13px;color:var(--t2)}
.rbud-bs-val{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1)}

.rbud-np{background:linear-gradient(135deg,var(--ac-s) 0%,var(--s1) 60%);border:1px solid rgba(42,127,111,.2);border-radius:var(--r-xl);padding:20px;margin-bottom:20px}
.rbud-np-lbl{font-family:var(--fd);font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.06em;color:var(--ac-t);margin-bottom:8px}
.rbud-np-amt{font-family:var(--fd);font-size:28px;font-weight:820;letter-spacing:-.02em;color:var(--t1)}
.rbud-np-detail{font-family:var(--fb);font-size:13px;color:var(--t2);margin-top:8px;line-height:1.5}
.rbud-np-detail strong{color:var(--t1);font-weight:620}
.rbud-np-milestone{display:inline-flex;align-items:center;gap:6px;margin-top:12px;padding:6px 12px;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-m);font-family:var(--fb);font-size:12px;font-weight:580;color:var(--ac-t)}

.rbud-grid{display:grid;grid-template-columns:1fr 380px;gap:20px}
.rbud-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden}
.rbud-c-head{padding:16px 20px;border-bottom:1px solid var(--s3)}
.rbud-c-title{font-family:var(--fd);font-size:15px;font-weight:680;letter-spacing:-.01em;color:var(--t1)}
.rbud-c-sub{font-family:var(--fb);font-size:12.5px;color:var(--t3);margin-top:2px}
.rbud-c-body{padding:16px 20px}

.rbud-pt-row{display:grid;grid-template-columns:80px 1fr auto;gap:16px;padding:16px 0;border-bottom:1px solid var(--s3);align-items:center}
.rbud-pt-row:last-child{border-bottom:none}
.rbud-pt-date{font-family:var(--fd);font-size:12px;font-weight:600;color:var(--t2)}
.rbud-pt-desc h5{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t1);margin:0 0 2px}
.rbud-pt-desc p{font-family:var(--fb);font-size:12px;color:var(--t2);margin:0}
.rbud-pt-amt{font-family:var(--fd);font-size:14px;font-weight:700;text-align:right}
.rbud-pt-amt.paid{color:var(--ok-t)}
.rbud-pt-amt.up{color:var(--t2)}

.rbud-si-intro{font-family:var(--fb);font-size:13px;color:var(--t2);margin-bottom:16px;line-height:1.5}
.rbud-si-row{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--s3)}
.rbud-si-row:last-child{border-bottom:none}
.rbud-si-name{font-family:var(--fb);font-size:13px;display:flex;align-items:center;gap:8px;color:var(--t1)}
.rbud-si-amt{font-family:var(--fd);font-size:13px;font-weight:700}
.rbud-si-amt.over{color:var(--wr-t)}
.rbud-si-amt.under{color:var(--ok-t)}
.rbud-si-amt.even{color:var(--t3)}
.rbud-si-total{margin-top:0;padding:16px 16px 0;border-top:1px solid var(--s3);display:flex;align-items:center;justify-content:space-between}
.rbud-si-total-lbl{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1)}
.rbud-si-total-val{font-family:var(--fd);font-size:15px;font-weight:700;color:var(--wr-t)}

.rbud-pl{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font-family:var(--fd);font-size:10.5px;font-weight:700;white-space:nowrap}
.rbud-pl.mini{height:18px;font-size:10px;padding:0 6px}
.rbud-pl.green{background:var(--ok-s);color:var(--ok-t)}
.rbud-pl.amber{background:var(--wr-s);color:var(--wr-t)}
.rbud-pl.gray{background:var(--s2);color:var(--t3)}

.rbud-tip{margin-top:16px;padding:16px;background:var(--ac-s);border:1px solid rgba(42,127,111,.15);border-radius:var(--r-l)}
.rbud-tip-title{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--ac-t);margin-bottom:6px;display:flex;align-items:center;gap:6px}
.rbud-tip-title svg{flex-shrink:0}
.rbud-tip p{font-family:var(--fb);font-size:12.5px;color:var(--t2);line-height:1.55;margin:0}

.rbud-empty{font-family:var(--fb);font-size:13px;color:var(--t3);padding:16px 0}

@media(max-width:1280px){.rbud-bh{grid-template-columns:1fr}.rbud-grid{grid-template-columns:1fr}}
@media(max-width:720px){.rbud-title{font-size:22px}.rbud-bh-big{font-size:28px}}
`;
