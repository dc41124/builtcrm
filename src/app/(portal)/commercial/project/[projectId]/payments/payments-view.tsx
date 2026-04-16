"use client";

import { useMemo } from "react";
import Link from "next/link";

import type { ClientProjectView } from "@/domain/loaders/project-home";

type Props = {
  projectId: string;
  projectName: string;
  drawRequests: ClientProjectView["drawRequests"];
  approvals: ClientProjectView["approvals"];
};

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function fmtShortCents(cents: number): string {
  const abs = Math.abs(cents);
  if (abs >= 100_000_00) return `$${Math.round(abs / 100_000)}K`;
  return fmtCents(cents);
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtPeriod(from: Date, to: Date): string {
  const start = new Date(from);
  return start.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const PAID = new Set(["paid"]);
const PENDING = new Set(["submitted", "under_review", "returned", "revised"]);

export function CommercialPaymentsView({
  projectId,
  projectName,
  drawRequests,
  approvals,
}: Props) {
  const base = `/commercial/project/${projectId}`;
  const sortedDraws = useMemo(
    () => [...drawRequests].sort((a, b) => b.drawNumber - a.drawNumber),
    [drawRequests],
  );

  const rollup = useMemo(() => {
    const latest = sortedDraws[0];
    const contractSumCents = latest?.contractSumToDateCents ?? 0;
    const originalCents = latest?.originalContractSumCents ?? 0;
    const netCOCents = latest?.netChangeOrdersCents ?? 0;

    let paidCents = 0;
    let pendingCents = 0;
    let pendingDraw: (typeof sortedDraws)[number] | null = null;

    for (const d of sortedDraws) {
      if (PAID.has(d.drawRequestStatus)) {
        paidCents += d.currentPaymentDueCents;
      } else if (PENDING.has(d.drawRequestStatus)) {
        pendingCents += d.currentPaymentDueCents;
        if (!pendingDraw || d.drawNumber > pendingDraw.drawNumber) {
          pendingDraw = d;
        }
      }
    }

    const retainageCents = Math.max(
      0,
      (latest?.totalRetainageCents ?? 0) - (latest?.retainageReleasedCents ?? 0),
    );
    const remainingCents = Math.max(
      0,
      contractSumCents - paidCents - pendingCents - retainageCents,
    );
    const pct = (c: number) =>
      contractSumCents > 0 ? (c / contractSumCents) * 100 : 0;

    return {
      contractSumCents,
      originalCents,
      netCOCents,
      paidCents,
      pendingCents,
      retainageCents,
      remainingCents,
      pendingDraw,
      pctPaid: pct(paidCents),
      pctPending: pct(pendingCents),
      pctRetainage: pct(retainageCents),
      pctRemaining: pct(remainingCents),
    };
  }, [sortedDraws]);

  const paidCount = useMemo(
    () => sortedDraws.filter((d) => PAID.has(d.drawRequestStatus)).length,
    [sortedDraws],
  );

  // Compute running total per draw (cumulative paid, earliest → newest)
  const runningTotals = useMemo(() => {
    const byNum = [...sortedDraws].sort((a, b) => a.drawNumber - b.drawNumber);
    const map = new Map<string, number>();
    let running = 0;
    for (const d of byNum) {
      if (PAID.has(d.drawRequestStatus)) {
        running += d.currentPaymentDueCents;
      }
      map.set(d.id, running);
    }
    return map;
  }, [sortedDraws]);

  // Lien waiver summary — always render; pull from pending draw or latest
  const lwTarget = rollup.pendingDraw ?? sortedDraws[0] ?? null;
  const lwTotal = lwTarget?.lienWaivers.length ?? 0;
  const lwReceived = lwTarget
    ? lwTarget.lienWaivers.filter(
        (w) => w.lienWaiverStatus === "accepted" || w.lienWaiverStatus === "submitted",
      ).length
    : 0;
  const lwPct = lwTotal > 0 ? (lwReceived / lwTotal) * 100 : 0;
  const lwOutstanding = lwTarget
    ? lwTarget.lienWaivers
        .filter((w) => w.lienWaiverStatus === "requested")
        .map((w) => w.organizationName)
        .filter((n): n is string => n != null)
    : [];

  const changeOrderRows = useMemo(
    () =>
      approvals.filter(
        (a) => a.category === "change_order" || a.category === "scope_change",
      ),
    [approvals],
  );

  return (
    <div className="cpay">
      <div className="cpay-head">
        <div>
          <h1 className="cpay-title">Payment History</h1>
          <div className="cpay-sub">
            Complete record of your payments on the {projectName} project.
          </div>
        </div>
        <button type="button" className="cpay-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export payment report
        </button>
      </div>

      {/* ── Stats grid ── */}
      <div className="cpay-grid">
        <div className="cpay-s">
          <div className="cpay-l">Current contract value</div>
          <div className="cpay-v">{fmtCents(rollup.contractSumCents)}</div>
          <div className="cpay-m">
            {rollup.netCOCents > 0
              ? `Original ${fmtCents(rollup.originalCents)} + ${fmtCents(rollup.netCOCents)} in COs`
              : `Original ${fmtCents(rollup.originalCents)}`}
          </div>
        </div>
        <div className="cpay-s">
          <div className="cpay-l">Total paid to date</div>
          <div className="cpay-v" style={{ color: "var(--ok)" }}>
            {fmtCents(rollup.paidCents)}
          </div>
          <div className="cpay-m">
            {paidCount > 0
              ? `Across ${paidCount} approved draw${paidCount === 1 ? "" : "s"}`
              : "No payments processed yet"}
          </div>
          {rollup.pctPaid > 0 ? (
            <div className="cpay-bar-track">
              <div
                className="cpay-bar-fill"
                style={{
                  width: `${rollup.pctPaid}%`,
                  background: "var(--ok)",
                }}
              />
            </div>
          ) : null}
        </div>
        <div className="cpay-s">
          <div className="cpay-l">Retainage held</div>
          <div className="cpay-v">{fmtCents(rollup.retainageCents)}</div>
          <div className="cpay-m">
            {rollup.contractSumCents > 0
              ? `${((rollup.retainageCents / rollup.contractSumCents) * 100).toFixed(0)}% retainage on completed work`
              : "—"}
          </div>
        </div>
        <div className="cpay-s">
          <div className="cpay-l">Pending payment</div>
          <div
            className="cpay-v"
            style={rollup.pendingCents > 0 ? { color: "var(--wr)" } : undefined}
          >
            {fmtCents(rollup.pendingCents)}
          </div>
          <div className="cpay-m">
            {rollup.pendingDraw
              ? `Draw #${rollup.pendingDraw.drawNumber} · awaiting your review`
              : "No pending draws"}
          </div>
        </div>
      </div>

      {/* ── Contract progress bar ── */}
      {rollup.contractSumCents > 0 ? (
        <div className="cpay-pp">
          <div className="cpay-pp-hdr">
            <div className="cpay-pp-title">Contract payment progress</div>
            <div className="cpay-pp-pct">
              <strong>{rollup.pctPaid.toFixed(1)}%</strong> paid of total contract
            </div>
          </div>
          <div className="cpay-pp-bar">
            {rollup.pctPaid > 0 ? (
              <div className="cpay-pp-seg paid" style={{ width: `${rollup.pctPaid}%` }}>
                {rollup.pctPaid >= 12 ? `${fmtShortCents(rollup.paidCents)} paid` : null}
              </div>
            ) : null}
            {rollup.pctPending > 0 ? (
              <div className="cpay-pp-seg pending" style={{ width: `${rollup.pctPending}%` }}>
                {rollup.pctPending >= 8 ? fmtShortCents(rollup.pendingCents) : null}
              </div>
            ) : null}
            {rollup.pctRetainage > 0 ? (
              <div className="cpay-pp-seg ret" style={{ width: `${rollup.pctRetainage}%` }} />
            ) : null}
            {rollup.pctRemaining > 0 ? (
              <div className="cpay-pp-seg rem" style={{ width: `${rollup.pctRemaining}%` }}>
                {rollup.pctRemaining >= 12
                  ? `${fmtShortCents(rollup.remainingCents)} remaining`
                  : null}
              </div>
            ) : null}
          </div>
          <div className="cpay-pp-legend">
            {[
              { c: "var(--ok)", l: "Paid to date" },
              { c: "var(--wr)", l: "Pending review" },
              { c: "var(--ac)", l: "Retainage held" },
              { c: "var(--s4)", l: "Remaining on contract" },
            ].map((item) => (
              <div key={item.l} className="cpay-lg-item">
                <div className="cpay-lg-dot" style={{ background: item.c }} />
                {item.l}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── Lien waiver status ── */}
      <div className="cpay-card">
        <div className="cpay-c-head">
          <div>
            <div className="cpay-c-title">Lien waiver status</div>
            <div className="cpay-c-sub">
              Unconditional lien waivers collected from subcontractors per draw
            </div>
          </div>
          {lwTarget && lwTotal > 0 ? (
            <div className="cpay-lw-hdr-r">
              <div className="cpay-lw-bar">
                <div
                  className={`cpay-lw-fill ${lwPct === 100 ? "done" : "part"}`}
                  style={{ width: `${lwPct}%` }}
                />
              </div>
              <span className={lwPct === 100 ? "cpay-lw-ok" : "cpay-lw-warn"}>
                Draw #{lwTarget.drawNumber}: {lwReceived} of {lwTotal} received
              </span>
            </div>
          ) : null}
        </div>
        <div className="cpay-c-body">
          {lwTotal === 0 ? (
            <div className="cpay-empty-inline">
              No lien waivers tracked on this project yet.
            </div>
          ) : lwOutstanding.length > 0 ? (
            <div className="cpay-lw-row">
              <div>
                <strong>{lwOutstanding.length} outstanding:</strong>{" "}
                {lwOutstanding.join(" · ")}
              </div>
              <div className="cpay-lw-prior">
                All prior draws:{" "}
                <span className="cpay-lw-ok">100% collected</span>
              </div>
            </div>
          ) : (
            <div className="cpay-lw-row">
              All lien waivers for this draw have been received.
            </div>
          )}
        </div>
      </div>

      {/* ── Payment ledger ── */}
      <div className="cpay-card">
        <div className="cpay-c-head">
          <div>
            <div className="cpay-c-title">Payment ledger</div>
            <div className="cpay-c-sub">All payments made on this project</div>
          </div>
        </div>
        <div className="cpay-c-tbl">
          {sortedDraws.length === 0 ? (
            <div className="cpay-empty">No draws have been submitted yet.</div>
          ) : (
            <table className="cpay-t">
              <thead>
                <tr>
                  <th>Draw</th>
                  <th>Period</th>
                  <th>Submitted</th>
                  <th>Approved</th>
                  <th>Amount paid</th>
                  <th>Retainage</th>
                  <th>Lien waivers</th>
                  <th>Running total</th>
                  <th>Method</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sortedDraws.map((d) => {
                  const isPending = PENDING.has(d.drawRequestStatus);
                  const isPaid = PAID.has(d.drawRequestStatus);
                  const running = runningTotals.get(d.id) ?? 0;
                  const lwT = d.lienWaivers.length;
                  const lwR = d.lienWaivers.filter(
                    (w) =>
                      w.lienWaiverStatus === "accepted" ||
                      w.lienWaiverStatus === "submitted",
                  ).length;
                  const lwP = lwT > 0 ? (lwR / lwT) * 100 : 0;
                  return (
                    <tr
                      key={d.id}
                      style={isPending ? { background: "var(--wr-s)" } : undefined}
                    >
                      <td>
                        <strong>Draw #{d.drawNumber}</strong>
                      </td>
                      <td>{fmtPeriod(d.periodFrom, d.periodTo)}</td>
                      <td>{fmtDate(d.submittedAt)}</td>
                      <td>
                        {d.reviewedAt ? (
                          fmtDate(d.reviewedAt)
                        ) : isPending ? (
                          <span className="cpay-pl amber">Pending review</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="amt">{fmtCents(d.currentPaymentDueCents)}</td>
                      <td className="amt">{fmtCents(d.totalRetainageCents)}</td>
                      <td>
                        {lwT > 0 ? (
                          <div className="cpay-lw-inline">
                            <div className="cpay-lw-bar">
                              <div
                                className={`cpay-lw-fill ${lwP === 100 ? "done" : "part"}`}
                                style={{ width: `${lwP}%` }}
                              />
                            </div>
                            <span
                              className={lwP === 100 ? "cpay-lw-ok" : "cpay-lw-warn"}
                            >
                              {lwR}/{lwT}
                            </span>
                          </div>
                        ) : (
                          <span className="cpay-dim">—</span>
                        )}
                      </td>
                      <td className="running">
                        {isPaid ? fmtCents(running) : "—"}
                      </td>
                      <td className="method">
                        {d.paymentReferenceName ?? "—"}
                      </td>
                      <td>
                        {isPending ? (
                          <Link href={`${base}/billing`} className="cpay-rlink">
                            Review →
                          </Link>
                        ) : isPaid ? (
                          <span className="cpay-rlink">Receipt</span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Change order summary ── */}
      <div className="cpay-card">
        <div className="cpay-c-head">
          <div>
            <div className="cpay-c-title">Change order summary</div>
            <div className="cpay-c-sub">
              Approved scope changes and their financial impact
            </div>
          </div>
        </div>
        <div className="cpay-c-tbl">
          {changeOrderRows.length === 0 ? (
            <div className="cpay-empty">
              No change orders on this project yet.
            </div>
          ) : (
            <table className="cpay-t">
              <thead>
                <tr>
                  <th>Change order</th>
                  <th>Description</th>
                  <th>Date approved</th>
                  <th>Amount</th>
                  <th>Schedule impact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {changeOrderRows.map((co) => {
                  const pending = co.approvalStatus === "pending_review";
                  const approved = co.approvalStatus === "approved";
                  return (
                    <tr
                      key={co.id}
                      style={pending ? { background: "var(--wr-s)" } : undefined}
                    >
                      <td>
                        <strong>
                          CO-{String(co.approvalNumber).padStart(3, "0")}
                        </strong>
                      </td>
                      <td>{co.title}</td>
                      <td>
                        {co.decidedAt
                          ? fmtDate(co.decidedAt)
                          : pending
                            ? <span className="cpay-pl amber">Pending</span>
                            : "—"}
                      </td>
                      <td className="amt">{fmtCents(co.impactCostCents)}</td>
                      <td>
                        {co.impactScheduleDays > 0
                          ? `+${co.impactScheduleDays} days`
                          : co.impactScheduleDays < 0
                            ? `${co.impactScheduleDays} days`
                            : "No impact"}
                      </td>
                      <td>
                        <span
                          className={`cpay-pl ${
                            approved ? "green" : pending ? "amber" : "gray"
                          }`}
                        >
                          {co.approvalStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: cpayCss }} />
    </div>
  );
}

const cpayCss = `
.cpay{display:flex;flex-direction:column}
.cpay-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px}
.cpay-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.035em;line-height:1.15;color:var(--t1);margin:0}
.cpay-sub{font-family:var(--fb);font-size:13.5px;color:var(--t2);margin-top:4px}
.cpay-btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12.5px;font-weight:620;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all 120ms ease;white-space:nowrap;flex-shrink:0}
.cpay-btn:hover{background:var(--s2);border-color:var(--s4)}
.cpay-btn svg{width:14px;height:14px;flex-shrink:0}

.cpay-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.cpay-s{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:16px}
.cpay-l{font-family:var(--fd);font-size:11px;font-weight:620;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
.cpay-v{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;line-height:1.1;color:var(--t1)}
.cpay-m{font-family:var(--fb);font-size:12px;color:var(--t2);margin-top:4px}
.cpay-bar-track{height:4px;background:var(--s3);border-radius:2px;overflow:hidden;margin-top:10px}
.cpay-bar-fill{height:100%;border-radius:2px;transition:width 200ms ease}

.cpay-pp{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:20px;margin-bottom:16px}
.cpay-pp-hdr{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:12px}
.cpay-pp-title{font-family:var(--fd);font-size:15px;font-weight:680;letter-spacing:-.01em;color:var(--t1)}
.cpay-pp-pct{font-family:var(--fb);font-size:13px;color:var(--t2)}
.cpay-pp-pct strong{font-family:var(--fd);font-weight:720;color:var(--t1)}
.cpay-pp-bar{height:24px;border-radius:12px;background:var(--s3);overflow:hidden;display:flex}
.cpay-pp-seg{height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;font-family:var(--fd)}
.cpay-pp-seg.paid{background:var(--ok)}
.cpay-pp-seg.pending{background:var(--wr)}
.cpay-pp-seg.ret{background:var(--ac)}
.cpay-pp-seg.rem{background:var(--s4);color:var(--t2)}
.cpay-pp-legend{display:flex;gap:20px;margin-top:12px;flex-wrap:wrap}
.cpay-lg-item{display:flex;align-items:center;gap:6px;font-family:var(--fb);font-size:12px;color:var(--t2)}
.cpay-lg-dot{width:10px;height:10px;border-radius:3px;flex-shrink:0}

.cpay-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);overflow:hidden;margin-bottom:16px}
.cpay-c-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--s3);gap:16px;flex-wrap:wrap}
.cpay-c-title{font-family:var(--fd);font-size:15px;font-weight:680;letter-spacing:-.01em;color:var(--t1)}
.cpay-c-sub{font-family:var(--fb);font-size:12.5px;color:var(--t3);margin-top:2px}
.cpay-c-body{padding:12px 20px;font-family:var(--fb);font-size:13px;color:var(--t2)}
.cpay-c-tbl{padding:0;overflow-x:auto}

.cpay-lw-hdr-r{display:flex;align-items:center;gap:8px;flex-shrink:0}
.cpay-lw-bar{width:60px;height:5px;border-radius:3px;background:var(--s3);overflow:hidden;flex-shrink:0}
.cpay-lw-fill{height:100%;border-radius:3px}
.cpay-lw-fill.done{background:var(--ok)}
.cpay-lw-fill.part{background:var(--wr)}
.cpay-lw-ok{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--ok-t);white-space:nowrap}
.cpay-lw-warn{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--wr-t);white-space:nowrap}
.cpay-lw-row{display:flex;gap:24px;font-family:var(--fb);font-size:13px;color:var(--t2);flex-wrap:wrap;padding:4px 0}
.cpay-lw-row strong{color:var(--t1);font-weight:620}
.cpay-lw-prior{margin-left:auto;color:var(--t3)}
.cpay-lw-inline{display:flex;align-items:center;gap:4px;font-size:12px;white-space:nowrap}
.cpay-lw-inline .cpay-lw-bar{width:48px}
.cpay-lw-inline .cpay-lw-ok,.cpay-lw-inline .cpay-lw-warn{font-size:12px}
.cpay-empty-inline{font-family:var(--fb);font-size:13px;color:var(--t3);font-weight:520;padding:4px 0}

.cpay-t{width:100%;border-collapse:collapse}
.cpay-t thead th{padding:8px 12px;font-family:var(--fd);font-size:11px;font-weight:650;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;text-align:left;border-bottom:2px solid var(--s3);white-space:nowrap}
.cpay-t thead th:first-child{padding-left:20px}
.cpay-t thead th:last-child{padding-right:20px}
.cpay-t tbody td{padding:12px;font-family:var(--fb);font-size:13px;border-bottom:1px solid var(--s3);vertical-align:middle}
.cpay-t tbody td:first-child{padding-left:20px}
.cpay-t tbody td:last-child{padding-right:20px}
.cpay-t tbody tr:last-child td{border-bottom:none}
.cpay-t tbody tr:hover{background:var(--sh)}
.cpay-t .amt{font-family:var(--fd);font-weight:700;white-space:nowrap}
.cpay-t .running{font-family:var(--fd);font-size:12px;color:var(--t3);white-space:nowrap}
.cpay-t .method{font-size:12px;color:var(--t3)}
.cpay-rlink{font-size:12px;color:var(--ac-t);font-weight:560;cursor:pointer;text-decoration:none}
.cpay-rlink:hover{text-decoration:underline}

.cpay-pl{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;font-family:var(--fd);font-size:10px;font-weight:700;white-space:nowrap;text-transform:capitalize}
.cpay-pl.green{background:var(--ok-s);color:var(--ok-t)}
.cpay-pl.amber{background:var(--wr-s);color:var(--wr-t)}
.cpay-pl.gray{background:var(--s2);color:var(--t3)}
.cpay-dim{color:var(--t3)}

.cpay-empty{padding:32px 20px;text-align:center;font-family:var(--fb);font-size:13px;color:var(--t3)}

@media(max-width:1280px){.cpay-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:720px){.cpay-grid{grid-template-columns:1fr}.cpay-title{font-size:22px}}
`;
