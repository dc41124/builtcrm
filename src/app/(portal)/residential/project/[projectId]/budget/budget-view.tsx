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

      
    </div>
  );
}
