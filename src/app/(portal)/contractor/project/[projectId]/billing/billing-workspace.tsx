"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import type { ContractorProjectView } from "@/domain/loaders/project-home";

type DrawRow = ContractorProjectView["drawRequests"][number];
type DrawLine = DrawRow["lineItems"][number];
type WaiverRow = DrawRow["lienWaivers"][number];
type Sov = NonNullable<ContractorProjectView["scheduleOfValues"]>;

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  const sign = dollars < 0 ? "-" : "";
  const abs = Math.abs(dollars);
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtMoneySigned(cents: number): string {
  if (cents === 0) return "$0";
  if (cents > 0) return `+${fmtMoney(cents)}`;
  return fmtMoney(cents);
}

function fmtPct(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(1)}%`;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtRange(from: Date, to: Date): string {
  const f = new Date(from);
  const t = new Date(to);
  const sameYear = f.getFullYear() === t.getFullYear();
  const fStr = f.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const tStr = t.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fStr} – ${tStr}`;
}

function drawPill(status: string): { color: PillColor; label: string } {
  switch (status) {
    case "draft":
      return { color: "amber", label: "Draft" };
    case "submitted":
      return { color: "blue", label: "Submitted" };
    case "under_review":
      return { color: "blue", label: "Under Review" };
    case "revise":
    case "returned":
      return { color: "red", label: "Revise" };
    case "approved":
      return { color: "green", label: "Approved" };
    case "paid":
      return { color: "green", label: "Paid" };
    default:
      return { color: "gray", label: status.replace(/_/g, " ") };
  }
}

function waiverPill(status: WaiverRow["lienWaiverStatus"]): PillColor {
  switch (status) {
    case "accepted":
      return "green";
    case "submitted":
      return "blue";
    case "rejected":
      return "red";
    case "waived":
      return "gray";
    default:
      return "amber";
  }
}

function waiverTypeLabel(t: WaiverRow["lienWaiverType"]): string {
  const map: Record<WaiverRow["lienWaiverType"], string> = {
    conditional_progress: "Conditional progress",
    unconditional_progress: "Unconditional progress",
    conditional_final: "Conditional final",
    unconditional_final: "Unconditional final",
  };
  return map[t];
}

function waiverStatusLabel(s: WaiverRow["lienWaiverStatus"]): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ContractorBillingWorkspace({
  draws,
  sov,
}: {
  projectName: string;
  draws: DrawRow[];
  sov: Sov | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(draws[0]?.id ?? null);

  const selected = useMemo(
    () => draws.find((d) => d.id === selectedId) ?? draws[0] ?? null,
    [draws, selectedId],
  );

  const summary = useMemo(() => {
    const latest = draws[0] ?? null;
    const contractSum = latest?.contractSumToDateCents ?? 0;
    const completed = latest?.totalCompletedToDateCents ?? 0;
    const currentDue = draws.find((d) => d.drawRequestStatus !== "paid")?.currentPaymentDueCents
      ?? 0;
    const retainageHeld = latest?.totalRetainageCents ?? 0;
    return { contractSum, completed, currentDue, retainageHeld };
  }, [draws]);

  if (!sov) {
    return (
      <div className="bl">
        <PageHeader
          openCount={draws.filter((d) => d.drawRequestStatus !== "paid").length}
          currentDue={summary.currentDue}
        />
        <Card>
          <EmptyState
            title="No Schedule of Values yet"
            description="Create the Schedule of Values to begin tracking draw requests and billing."
          />
        </Card>
        <WorkspaceStyles />
      </div>
    );
  }

  return (
    <div className="bl">
      <PageHeader
        openCount={draws.filter((d) => d.drawRequestStatus !== "paid").length}
        currentDue={summary.currentDue}
      />

      <div className="bl-kpis">
        <KpiCard
          label="Contract Sum to Date"
          value={fmtMoney(summary.contractSum)}
          meta="Original + approved change orders"
          iconColor="purple"
        />
        <KpiCard
          label="Completed & Stored"
          value={fmtMoney(summary.completed)}
          meta={
            summary.contractSum > 0
              ? `${((summary.completed / summary.contractSum) * 100).toFixed(1)}% of contract`
              : undefined
          }
          iconColor="blue"
        />
        <KpiCard
          label="Current Payment Due"
          value={fmtMoney(summary.currentDue)}
          meta="Pending approval"
          iconColor="amber"
          alert={summary.currentDue > 0}
        />
        <KpiCard
          label="Retainage Held"
          value={fmtMoney(summary.retainageHeld)}
          meta={`${sov.defaultRetainagePercent}% default rate`}
          iconColor="green"
        />
      </div>

      {draws.length === 0 ? (
        <Card>
          <EmptyState
            title="No draw requests yet"
            description="Build the first draw request from the Schedule of Values line items."
          />
        </Card>
      ) : (
        <Card padded={false}>
          <div className="bl-split">
            <div className="bl-queue">
              <div className="bl-queue-head">Draws</div>
              {draws.map((d) => {
                const pill = drawPill(d.drawRequestStatus);
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`bl-queue-row ${selected?.id === d.id ? "bl-queue-row-sel" : ""}`}
                    onClick={() => setSelectedId(d.id)}
                  >
                    <div className="bl-queue-top">
                      <div className="bl-queue-title">Draw #{d.drawNumber}</div>
                      <Pill color={pill.color}>{pill.label}</Pill>
                    </div>
                    <div className="bl-queue-period">{fmtRange(d.periodFrom, d.periodTo)}</div>
                    <div className="bl-queue-amount">{fmtMoney(d.currentPaymentDueCents)}</div>
                  </button>
                );
              })}
            </div>
            <div className="bl-detail">
              {selected ? <DrawDetail draw={selected} sov={sov} /> : null}
            </div>
          </div>
        </Card>
      )}

      <SovSection sov={sov} />

      <WorkspaceStyles />
    </div>
  );
}

function PageHeader({
  openCount,
  currentDue,
}: {
  openCount: number;
  currentDue: number;
}) {
  return (
    <header className="bl-head">
      <div className="bl-head-main">
        <h1 className="bl-title">Billing &amp; Draw Requests</h1>
        <p className="bl-desc">
          AIA G702 / G703 draw requests, Schedule of Values, retainage and lien
          waivers.
        </p>
        <div className="bl-head-pills">
          <Pill color="purple">AIA G702 / G703 workspace</Pill>
          {openCount > 0 && (
            <Pill color="amber">
              {openCount} draw{openCount === 1 ? "" : "s"} in progress
            </Pill>
          )}
          {currentDue > 0 && (
            <Pill color="blue">{fmtMoney(currentDue)} payment due</Pill>
          )}
        </div>
      </div>
      <div className="bl-head-actions">
        <button type="button" className="bl-btn">
          Export PDF
        </button>
        <button type="button" className="bl-btn">
          Save draft
        </button>
        <button type="button" className="bl-btn pri">
          Submit for review
        </button>
      </div>
    </header>
  );
}

function DrawDetail({ draw, sov }: { draw: DrawRow; sov: Sov }) {
  const pill = drawPill(draw.drawRequestStatus);
  const retainageOnCompleted = draw.lineItems.reduce(
    (acc, l) =>
      acc +
      Math.round(
        ((l.totalCompletedStoredToDateCents - l.materialsPresentlyStoredCents) *
          l.retainagePercentApplied) /
          10000,
      ),
    0,
  );
  const retainageOnStored = Math.max(draw.totalRetainageCents - retainageOnCompleted, 0);

  const g702: Array<{ label: string; value: string; hint?: string; highlight?: boolean }> = [
    { label: "1. Original contract sum", value: fmtMoney(draw.originalContractSumCents) },
    {
      label: "2. Net change orders",
      value: fmtMoneySigned(draw.netChangeOrdersCents),
    },
    { label: "3. Contract sum to date", value: fmtMoney(draw.contractSumToDateCents) },
    {
      label: "4. Total completed & stored",
      value: fmtMoney(draw.totalCompletedToDateCents),
      hint:
        draw.contractSumToDateCents > 0
          ? `${(
              (draw.totalCompletedToDateCents / draw.contractSumToDateCents) *
              100
            ).toFixed(1)}% of contract`
          : undefined,
    },
    {
      label: "5. Total retainage",
      value: fmtMoney(draw.totalRetainageCents),
      hint: `${sov.defaultRetainagePercent}% rate`,
    },
    {
      label: "6. Total earned less retainage",
      value: fmtMoney(draw.totalEarnedLessRetainageCents),
    },
    {
      label: "7. Less previous certificates",
      value: fmtMoney(draw.previousCertificatesCents),
      hint: draw.drawNumber > 1 ? `Draws #1–${draw.drawNumber - 1}` : "First draw",
    },
    {
      label: "8. Current payment due",
      value: fmtMoney(draw.currentPaymentDueCents),
      highlight: true,
    },
    {
      label: "9. Balance to finish + retainage",
      value: fmtMoney(draw.balanceToFinishCents + draw.totalRetainageCents),
    },
  ];

  const totals = draw.lineItems.reduce(
    (acc, l) => ({
      sched: acc.sched + l.scheduledValueCents,
      prev: acc.prev + l.workCompletedPreviousCents,
      period: acc.period + l.workCompletedThisPeriodCents,
      stored: acc.stored + l.materialsPresentlyStoredCents,
      total: acc.total + l.totalCompletedStoredToDateCents,
      balance: acc.balance + l.balanceToFinishCents,
      retainage: acc.retainage + l.retainageCents,
    }),
    { sched: 0, prev: 0, period: 0, stored: 0, total: 0, balance: 0, retainage: 0 },
  );
  const totalsPct =
    totals.sched > 0 ? `${((totals.total / totals.sched) * 100).toFixed(1)}%` : "0.0%";

  const waiverCount = draw.lienWaivers.length;
  const receivedCount = draw.lienWaivers.filter(
    (w) => w.lienWaiverStatus === "accepted" || w.lienWaiverStatus === "submitted",
  ).length;

  return (
    <div className="bl-d">
      <div className="bl-d-head">
        <div className="bl-d-head-main">
          <h2 className="bl-d-title">Draw Request #{draw.drawNumber}</h2>
          <div className="bl-d-pills">
            <Pill color={pill.color}>{pill.label}</Pill>
            <Pill color="gray">Application No. {draw.drawNumber}</Pill>
          </div>
          <div className="bl-d-meta">
            <span>
              <strong>Period:</strong> {fmtRange(draw.periodFrom, draw.periodTo)}
            </span>
            <span>
              <strong>Submitted:</strong> {fmtDate(draw.submittedAt)}
            </span>
            <span>
              <strong>Reviewed:</strong> {fmtDate(draw.reviewedAt)}
            </span>
            {draw.paidAt && (
              <span>
                <strong>Paid:</strong> {fmtDate(draw.paidAt)}
                {draw.paymentReferenceName ? ` · ${draw.paymentReferenceName}` : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {draw.returnReason && (
        <div className="bl-note bl-note-warn">
          <div className="bl-note-lbl">Return Reason</div>
          <p>{draw.returnReason}</p>
        </div>
      )}
      {draw.reviewNote && (
        <div className="bl-note">
          <div className="bl-note-lbl">Review Note</div>
          <p>{draw.reviewNote}</p>
        </div>
      )}

      <section className="bl-section">
        <div className="bl-section-head">
          <h3>AIA G702 — Application Summary</h3>
        </div>
        <div className="bl-g702">
          {g702.map((item) => (
            <div
              key={item.label}
              className={`bl-g702-item ${item.highlight ? "bl-g702-hl" : ""}`}
            >
              <div className="bl-g702-lbl">{item.label}</div>
              <div className="bl-g702-val">{item.value}</div>
              {item.hint && <div className="bl-g702-hint">{item.hint}</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="bl-section">
        <div className="bl-section-head">
          <h3>G703 — Continuation Sheet</h3>
          <span className="bl-section-sub">
            Work completed this period across {draw.lineItems.length} line items
          </span>
        </div>
        {draw.lineItems.length === 0 ? (
          <EmptyState
            title="No line items on this draw"
            description="Line items are pulled from the Schedule of Values when the draw is built."
          />
        ) : (
          <div className="bl-table-wrap">
            <table className="bl-g703">
              <thead>
                <tr>
                  <th style={{ width: 46 }}>Item</th>
                  <th>Description</th>
                  <th className="right">Scheduled</th>
                  <th className="right">Previous</th>
                  <th className="right ed">This period</th>
                  <th className="right ed">Stored</th>
                  <th className="right">Total</th>
                  <th className="center">%</th>
                  <th className="right">Balance</th>
                  <th className="right">Retainage</th>
                </tr>
              </thead>
              <tbody>
                {draw.lineItems.map((l) => (
                  <G703Row key={l.id} line={l} />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td />
                  <td className="desc">Totals</td>
                  <td className="right">{fmtMoney(totals.sched)}</td>
                  <td className="right">{fmtMoney(totals.prev)}</td>
                  <td className="right accent">{fmtMoney(totals.period)}</td>
                  <td className="right accent">{fmtMoney(totals.stored)}</td>
                  <td className="right">{fmtMoney(totals.total)}</td>
                  <td className="center">{totalsPct}</td>
                  <td className="right">{fmtMoney(totals.balance)}</td>
                  <td className="right">{fmtMoney(totals.retainage)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <div className="bl-bottom">
        <section className="bl-mini">
          <div className="bl-mini-head">
            <div className="bl-mini-title">Retainage</div>
            <div className="bl-mini-sub">{sov.defaultRetainagePercent}% standard rate</div>
          </div>
          <div className="bl-mini-body">
            <div className="bl-ret">
              <span>On completed work</span>
              <span className="v">{fmtMoney(retainageOnCompleted)}</span>
            </div>
            <div className="bl-ret">
              <span>On stored materials</span>
              <span className="v">{fmtMoney(retainageOnStored)}</span>
            </div>
            <div className="bl-ret total">
              <span>Total retainage held</span>
              <span className="v">{fmtMoney(draw.totalRetainageCents)}</span>
            </div>
            <div className="bl-ret-divider" />
            <div className="bl-ret">
              <span>Released to date</span>
              <span className="v ok">{fmtMoney(draw.retainageReleasedCents)}</span>
            </div>
            <div className="bl-ret total">
              <span>Net balance</span>
              <span className="v">
                {fmtMoney(draw.totalRetainageCents - draw.retainageReleasedCents)}
              </span>
            </div>
          </div>
        </section>

        <section className="bl-mini">
          <div className="bl-mini-head">
            <div className="bl-mini-title">Lien Waivers</div>
            <div className="bl-mini-sub">Required for draw closeout</div>
          </div>
          <div className="bl-mini-body">
            {draw.lienWaivers.length === 0 ? (
              <EmptyState
                title="No lien waivers"
                description="Waivers will appear once requested from subcontractors."
              />
            ) : (
              <>
                {draw.lienWaivers.map((w) => (
                  <div key={w.id} className="bl-lw">
                    <div className="bl-lw-main">
                      <div className="bl-lw-name">{w.organizationId.slice(0, 8)}</div>
                      <div className="bl-lw-detail">
                        {waiverTypeLabel(w.lienWaiverType)} · {fmtMoney(w.amountCents)}
                      </div>
                    </div>
                    <Pill color={waiverPill(w.lienWaiverStatus)}>
                      {waiverStatusLabel(w.lienWaiverStatus)}
                    </Pill>
                  </div>
                ))}
                <div className="bl-lw-summary">
                  {receivedCount} of {waiverCount} received ·{" "}
                  {waiverCount - receivedCount} outstanding
                </div>
              </>
            )}
          </div>
        </section>

        <section className="bl-mini">
          <div className="bl-mini-head">
            <div className="bl-mini-title">Package Documents</div>
            <div className="bl-mini-sub">
              {draw.supportingFiles.length > 0
                ? `${draw.supportingFiles.length} file${draw.supportingFiles.length === 1 ? "" : "s"} attached`
                : "Attachments for this draw"}
            </div>
          </div>
          <div className="bl-mini-body">
            {draw.supportingFiles.length === 0 ? (
              <p className="bl-pkg-empty">
                Attach closeout documents, invoices, and supporting files.
                These travel with the draw package when it&apos;s submitted for
                review.
              </p>
            ) : (
              <div className="bl-pkg-files">
                {draw.supportingFiles.map((f) => (
                  <div key={f.id} className="bl-pkg-row">
                    <div className="bl-pkg-info">
                      <div className="bl-pkg-name">{f.title}</div>
                      <div className="bl-pkg-meta">
                        {f.linkRole.replace(/_/g, " ")}
                      </div>
                    </div>
                    <span className="bl-pkg-chip">
                      {f.documentType.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="bl-pkg-acts">
              <button type="button" className="bl-btn sm">
                Attach file
              </button>
              <button type="button" className="bl-btn sm pri">
                Submit for review
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function G703Row({ line }: { line: DrawLine }) {
  return (
    <tr>
      <td>{line.itemNumber}</td>
      <td className="desc">{line.description}</td>
      <td className="right">{fmtMoney(line.scheduledValueCents)}</td>
      <td className="right">{fmtMoney(line.workCompletedPreviousCents)}</td>
      <td className="right ed">{fmtMoney(line.workCompletedThisPeriodCents)}</td>
      <td className="right ed">{fmtMoney(line.materialsPresentlyStoredCents)}</td>
      <td className="right">{fmtMoney(line.totalCompletedStoredToDateCents)}</td>
      <td className="center">{fmtPct(line.percentCompleteBasisPoints)}</td>
      <td className="right">{fmtMoney(line.balanceToFinishCents)}</td>
      <td className="right">{fmtMoney(line.retainageCents)}</td>
    </tr>
  );
}

function SovSection({ sov }: { sov: Sov }) {
  const active = sov.lineItems.filter((l) => l.isActive);
  return (
    <Card>
      <div className="bl-sov-head">
        <div>
          <h3 className="bl-sov-title">Schedule of Values</h3>
          <div className="bl-sov-sub">
            v{sov.version} · {sov.sovStatus} · {sov.defaultRetainagePercent}% default retainage
          </div>
        </div>
        <div className="bl-sov-totals">
          <div>
            <div className="bl-sov-k">Original</div>
            <div className="bl-sov-v">{fmtMoney(sov.totalOriginalContractCents)}</div>
          </div>
          <div>
            <div className="bl-sov-k">Change orders</div>
            <div className="bl-sov-v">{fmtMoneySigned(sov.totalChangeOrdersCents)}</div>
          </div>
          <div>
            <div className="bl-sov-k">Contract sum</div>
            <div className="bl-sov-v bl-sov-v-hl">
              {fmtMoney(sov.totalScheduledValueCents)}
            </div>
          </div>
        </div>
      </div>
      {active.length === 0 ? (
        <EmptyState
          title="No line items yet"
          description="Add line items to the Schedule of Values to begin billing."
        />
      ) : (
        <div className="bl-table-wrap">
          <table className="bl-sov">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Item</th>
                <th style={{ width: 120 }}>Cost code</th>
                <th>Description</th>
                <th style={{ width: 110 }}>Type</th>
                <th className="right" style={{ width: 140 }}>
                  Scheduled value
                </th>
                <th className="right" style={{ width: 100 }}>
                  Retainage
                </th>
              </tr>
            </thead>
            <tbody>
              {active.map((l) => (
                <tr key={l.id}>
                  <td>{l.itemNumber}</td>
                  <td>{l.costCode ?? "—"}</td>
                  <td className="desc">{l.description}</td>
                  <td>{l.lineItemType.replace(/_/g, " ")}</td>
                  <td className="right">{fmtMoney(l.scheduledValueCents)}</td>
                  <td className="right">
                    {l.retainagePercentOverride ?? sov.defaultRetainagePercent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function WorkspaceStyles() {
  return (
    <style dangerouslySetInnerHTML={{ __html: `
      .bl{display:flex;flex-direction:column;gap:20px}
      .bl-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
      .bl-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
      .bl-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;color:var(--t1);line-height:1.15;margin:0}
      .bl-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
      .bl-head-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
      .bl-head-actions{display:flex;gap:8px;flex-shrink:0;padding-top:4px;flex-wrap:wrap}
      .bl-btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12.5px;font-weight:640;cursor:pointer;transition:all var(--df) var(--e);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
      .bl-btn:hover{border-color:var(--s4);background:var(--sh)}
      .bl-btn.pri{background:var(--ac);border-color:var(--ac);color:#fff}
      .bl-btn.pri:hover{background:var(--ac-h);border-color:var(--ac-h)}
      .bl-btn.sm{height:30px;padding:0 12px;font-size:12px}

      .bl-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
      @media(max-width:1000px){.bl-kpis{grid-template-columns:repeat(2,1fr)}}

      .bl-split{display:grid;grid-template-columns:320px minmax(0,1fr);gap:0}
      @media(max-width:980px){.bl-split{grid-template-columns:1fr}}
      .bl-queue{border-right:1px solid var(--s3);max-height:820px;overflow-y:auto;display:flex;flex-direction:column;padding:14px 14px 16px;gap:6px}
      .bl-queue::-webkit-scrollbar{width:4px}
      .bl-queue::-webkit-scrollbar-track{background:transparent}
      .bl-queue::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
      .bl-queue-head{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;padding:4px 4px 4px}
      .bl-queue-row{text-align:left;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e);display:flex;flex-direction:column;gap:4px}
      .bl-queue-row:hover{border-color:var(--s4);background:var(--sh)}
      .bl-queue-row-sel,.bl-queue-row-sel:hover{border-color:color-mix(in srgb,var(--ac) 40%,var(--s3));background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
      .bl-queue-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .bl-queue-title{font-family:var(--fd);font-size:13.5px;font-weight:720;color:var(--t1);letter-spacing:-.005em}
      .bl-queue-period{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2)}
      .bl-queue-amount{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1)}

      .bl-detail{padding:22px 24px;min-width:0}
      .bl-d{display:flex;flex-direction:column;gap:22px}
      .bl-d-head-main{display:flex;flex-direction:column;gap:10px}
      .bl-d-title{font-family:var(--fd);font-size:20px;font-weight:780;letter-spacing:-.02em;color:var(--t1);margin:0}
      .bl-d-pills{display:flex;gap:6px;flex-wrap:wrap}
      .bl-d-meta{display:flex;flex-wrap:wrap;gap:16px;font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2)}
      .bl-d-meta strong{font-weight:680;color:var(--t1);margin-right:4px}

      .bl-note{padding:12px 14px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--sh)}
      .bl-note-warn{background:var(--wr-s);border-color:var(--wr)}
      .bl-note-lbl{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
      .bl-note-warn .bl-note-lbl{color:var(--wr-t)}
      .bl-note p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);margin:0;line-height:1.5}

      .bl-section{display:flex;flex-direction:column;gap:12px}
      .bl-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .bl-section-head h3{font-family:var(--fd);font-size:14px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
      .bl-section-sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3)}

      .bl-g702{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      @media(max-width:1280px){.bl-g702{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:640px){.bl-g702{grid-template-columns:1fr}}
      .bl-g702-item{padding:14px 16px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--sh);display:flex;flex-direction:column;gap:4px}
      .bl-g702-hl{background:var(--ac-s);border-color:var(--ac)}
      .bl-g702-lbl{font-family:var(--fb);font-size:11.5px;font-weight:620;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
      .bl-g702-val{font-family:var(--fd);font-size:20px;font-weight:820;color:var(--t1);letter-spacing:-.02em}
      .bl-g702-hl .bl-g702-val{color:var(--ac-t)}
      .bl-g702-hint{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2)}

      .bl-table-wrap{border:1px solid var(--s3);border-radius:var(--r-m);overflow-x:auto}
      .bl-g703,.bl-sov{width:100%;border-collapse:collapse;font-family:var(--fb);font-size:12.5px}
      .bl-g703 th,.bl-sov th{font-family:var(--fb);font-size:10.5px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;text-align:left;padding:10px 12px;background:var(--sh);border-bottom:1px solid var(--s3);white-space:nowrap}
      .bl-g703 td,.bl-sov td{padding:10px 12px;border-bottom:1px solid var(--s3);font-family:var(--fm);font-size:12px;font-weight:540;color:var(--t1);white-space:nowrap}
      .bl-g703 td.desc,.bl-sov td.desc{font-family:var(--fb);font-weight:560;white-space:normal}
      .bl-g703 th.right,.bl-g703 td.right,.bl-sov th.right,.bl-sov td.right{text-align:right}
      .bl-g703 th.center,.bl-g703 td.center{text-align:center}
      .bl-g703 th.ed,.bl-g703 td.ed{background:var(--ac-s)}
      .bl-g703 tfoot td{font-family:var(--fd);font-weight:740;background:var(--sh);border-top:2px solid var(--s3);border-bottom:none}
      .bl-g703 tfoot td.accent{color:var(--ac-t)}
      .bl-g703 tr:last-child td,.bl-sov tr:last-child td{border-bottom:none}

      .bl-bottom{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
      @media(max-width:1280px){.bl-bottom{grid-template-columns:1fr 1fr}}
      @media(max-width:900px){.bl-bottom{grid-template-columns:1fr}}
      .bl-pkg-empty{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}
      .bl-pkg-files{display:flex;flex-direction:column;gap:6px}
      .bl-pkg-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--sh)}
      .bl-pkg-info{min-width:0;flex:1}
      .bl-pkg-name{font-family:var(--fm);font-size:12px;font-weight:540;color:var(--t1);word-break:break-all}
      .bl-pkg-meta{font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);margin-top:1px;text-transform:capitalize}
      .bl-pkg-chip{font-family:var(--fd);font-size:10px;font-weight:700;color:var(--t3);padding:2px 6px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap;flex-shrink:0}
      .bl-pkg-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
      .bl-mini{border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);display:flex;flex-direction:column}
      .bl-mini-head{padding:14px 16px;border-bottom:1px solid var(--s3)}
      .bl-mini-title{font-family:var(--fd);font-size:13.5px;font-weight:740;color:var(--t1);letter-spacing:-.005em}
      .bl-mini-sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:2px}
      .bl-mini-body{padding:14px 16px;display:flex;flex-direction:column;gap:10px}
      .bl-ret{display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2)}
      .bl-ret .v{font-family:var(--fd);font-weight:700;color:var(--t1)}
      .bl-ret .v.ok{color:var(--gn-t)}
      .bl-ret.total{padding-top:6px;border-top:1px dashed var(--s3);color:var(--t1);font-weight:640}
      .bl-ret-divider{height:1px;background:var(--s3);margin:4px 0}
      .bl-lw{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid var(--s3)}
      .bl-lw:last-of-type{border-bottom:none}
      .bl-lw-main{min-width:0}
      .bl-lw-name{font-family:var(--fm);font-size:12.5px;font-weight:580;color:var(--t1)}
      .bl-lw-detail{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:2px}
      .bl-lw-summary{margin-top:6px;font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2)}

      .bl-sov-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:14px}
      .bl-sov-title{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0 0 2px;letter-spacing:-.01em}
      .bl-sov-sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3)}
      .bl-sov-totals{display:flex;gap:18px}
      .bl-sov-k{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em}
      .bl-sov-v{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);letter-spacing:-.01em;margin-top:2px}
      .bl-sov-v-hl{color:var(--ac-t);font-weight:820}
    ` }} />
  );
}
