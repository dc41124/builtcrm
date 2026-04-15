"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { KpiCard } from "@/components/kpi-card";
import { Pill, type PillColor } from "@/components/pill";
import type { ClientProjectView } from "@/domain/loaders/project-home";

type Draw = ClientProjectView["drawRequests"][number];
type Line = Draw["lineItems"][number];
type Waiver = Draw["lienWaivers"][number];
type TabId = "pending" | "approved" | "returned";

type DecisionKind = "approve" | "approve-with-note" | "return";

function fmtMoney(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const v = cents / 100;
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function fmtMoneySigned(cents: number): string {
  if (cents === 0) return "$0";
  if (cents > 0) return `+${fmtMoney(cents)}`;
  return fmtMoney(cents);
}

function fmtPct(bp: number): string {
  return `${(bp / 100).toFixed(1)}%`;
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
  return `${f.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  })} – ${t.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function daysSince(d: Date | null, now: number): number | null {
  if (!d) return null;
  return Math.floor((now - new Date(d).getTime()) / 86400000);
}

function statusView(status: string): { color: PillColor; label: string } {
  switch (status) {
    case "submitted":
      return { color: "blue", label: "Awaiting contractor" };
    case "under_review":
      return { color: "purple", label: "Needs my review" };
    case "revised":
      return { color: "blue", label: "Revised" };
    case "approved":
      return { color: "green", label: "Approved" };
    case "approved_with_note":
      return { color: "green", label: "Approved with note" };
    case "returned":
      return { color: "amber", label: "Returned" };
    case "paid":
      return { color: "green", label: "Paid" };
    default:
      return { color: "gray", label: status.replace(/_/g, " ") };
  }
}

function tabOf(status: string): TabId {
  if (status === "approved" || status === "approved_with_note" || status === "paid") {
    return "approved";
  }
  if (status === "returned") return "returned";
  return "pending";
}

function waiverPill(status: Waiver["lienWaiverStatus"]): {
  color: PillColor;
  label: string;
} {
  switch (status) {
    case "accepted":
      return { color: "green", label: "On file" };
    case "submitted":
      return { color: "blue", label: "Submitted" };
    case "rejected":
      return { color: "red", label: "Rejected" };
    case "waived":
      return { color: "gray", label: "Waived" };
    default:
      return { color: "amber", label: "Requested" };
  }
}

function waiverTypeLabel(t: Waiver["lienWaiverType"]): string {
  const map: Record<Waiver["lienWaiverType"], string> = {
    conditional_progress: "Conditional progress",
    unconditional_progress: "Unconditional progress",
    conditional_final: "Conditional final",
    unconditional_final: "Unconditional final",
  };
  return map[t];
}

export function CommercialBillingReview({
  draws,
}: {
  projectName: string;
  draws: Draw[];
}) {
  const [now] = useState(() => Date.now());
  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, returned: 0 };
    for (const d of draws) c[tabOf(d.drawRequestStatus)] += 1;
    return c;
  }, [draws]);

  const [activeTab, setActiveTab] = useState<TabId>(
    counts.pending > 0 ? "pending" : counts.approved > 0 ? "approved" : "returned",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => draws.filter((d) => tabOf(d.drawRequestStatus) === activeTab),
    [draws, activeTab],
  );
  const selected = filtered.find((d) => d.id === selectedId) ?? filtered[0] ?? null;

  const summary = useMemo(() => {
    const latest = draws[0] ?? null;
    const pending = draws.find((d) => d.drawRequestStatus === "under_review");
    return {
      contractSum: latest?.contractSumToDateCents ?? 0,
      completed: latest?.totalCompletedToDateCents ?? 0,
      retainage: latest?.totalRetainageCents ?? 0,
      pendingDueCents: pending?.currentPaymentDueCents ?? 0,
      pendingCount: counts.pending,
    };
  }, [draws, counts.pending]);

  return (
    <div className="bcr">
      <header className="bcr-head">
        <div className="bcr-head-main">
          <h1 className="bcr-title">Billing / Draws</h1>
          <p className="bcr-desc">
            Review draw packages released by the contractor, inspect line-item
            progress, verify lien waivers, and return a formal billing
            decision.
          </p>
          <div className="bcr-head-pills">
            <Pill color="purple">Formal billing review</Pill>
            {counts.pending > 0 && (
              <Pill color="amber">
                {counts.pending} package{counts.pending === 1 ? "" : "s"} need
                your review
              </Pill>
            )}
          </div>
        </div>
        <div className="bcr-head-actions">
          <button type="button" className="bcr-btn">
            View all draws
          </button>
          <button type="button" className="bcr-btn pri">
            Review active draw
          </button>
        </div>
      </header>

      <div className="bcr-kpis">
        <KpiCard
          label="Needs my review"
          value={summary.pendingCount.toString()}
          meta={summary.pendingCount === 0 ? "You're all caught up" : "Waiting on you"}
          iconColor="red"
          alert={summary.pendingCount > 0}
        />
        <KpiCard
          label="Pending payment due"
          value={fmtMoney(summary.pendingDueCents)}
          meta="Across open draws"
          iconColor="amber"
          alert={summary.pendingDueCents > 0}
        />
        <KpiCard
          label="Contract sum to date"
          value={fmtMoney(summary.contractSum)}
          meta="Original + approved change orders"
          iconColor="blue"
        />
        <KpiCard
          label="Retainage held"
          value={fmtMoney(summary.retainage)}
          meta="Standard rate"
          iconColor="green"
        />
      </div>

      {draws.length === 0 ? (
        <Card>
          <EmptyState
            title="No draw requests yet"
            description="Draw applications will appear here when your contractor releases them for review."
          />
        </Card>
      ) : (
        <div className="bcr-page-grid">
          <Card
            title="Draw queue"
            subtitle="Every draw application in the current billing cycle."
            tabs={[
              { id: "pending", label: `Pending (${counts.pending})` },
              { id: "approved", label: `Approved (${counts.approved})` },
              { id: "returned", label: `Returned (${counts.returned})` },
            ]}
            activeTabId={activeTab}
            onTabChange={(id) => {
              setActiveTab(id as TabId);
              setSelectedId(null);
            }}
            padded={false}
          >
            {filtered.length === 0 ? (
              <div style={{ padding: 20 }}>
                <EmptyState
                  title="Nothing in this view"
                  description="There are no draws matching this filter."
                />
              </div>
            ) : (
              <div className="bcr-split">
                <div className="bcr-queue">
                  {filtered.map((d) => {
                    const sv = statusView(d.drawRequestStatus);
                    const waited = daysSince(d.submittedAt, now);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={`bcr-row ${
                          selected?.id === d.id ? "bcr-row-sel" : ""
                        }`}
                        onClick={() => setSelectedId(d.id)}
                      >
                        <div className="bcr-row-top">
                          <div className="bcr-row-title">
                            Draw #{d.drawNumber}
                          </div>
                          <Pill color={sv.color}>{sv.label}</Pill>
                        </div>
                        <div className="bcr-row-period">
                          {fmtRange(d.periodFrom, d.periodTo)}
                        </div>
                        <div className="bcr-row-foot">
                          <span className="bcr-row-amt">
                            {fmtMoney(d.currentPaymentDueCents)}
                          </span>
                          {waited != null &&
                            d.drawRequestStatus !== "approved" &&
                            d.drawRequestStatus !== "approved_with_note" &&
                            d.drawRequestStatus !== "paid" && (
                              <span>{waited}d waiting</span>
                            )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="bcr-detail">
                  {selected ? (
                    <DrawDetail draw={selected} />
                  ) : (
                    <EmptyState
                      title="Select a draw"
                      description="Pick one from the queue to review."
                    />
                  )}
                </div>
              </div>
            )}
          </Card>

          <aside className="bcr-rail">
            <RightRail draws={draws} selected={selected} />
          </aside>
        </div>
      )}

      <WorkspaceStyles />
    </div>
  );
}

function DrawDetail({ draw }: { draw: Draw }) {
  const router = useRouter();
  const sv = statusView(draw.drawRequestStatus);
  const canDecide = draw.drawRequestStatus === "under_review";

  const [kind, setKind] = useState<DecisionKind>("approve-with-note");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const g702: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: "1. Original contract", value: fmtMoney(draw.originalContractSumCents) },
    { label: "2. Net change orders", value: fmtMoneySigned(draw.netChangeOrdersCents) },
    { label: "3. Contract sum to date", value: fmtMoney(draw.contractSumToDateCents) },
    { label: "4. Completed & stored", value: fmtMoney(draw.totalCompletedToDateCents) },
    { label: "5. Retainage held", value: fmtMoney(draw.totalRetainageCents) },
    {
      label: "6. Total earned less retainage",
      value: fmtMoney(draw.totalEarnedLessRetainageCents),
    },
    {
      label: "7. Less previous certificates",
      value: fmtMoney(draw.previousCertificatesCents),
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

  async function submitDecision() {
    setError(null);
    if ((kind === "return" || kind === "approve-with-note") && note.trim().length === 0) {
      setError(kind === "return" ? "A return reason is required." : "A note is required.");
      return;
    }
    setPending(true);
    const body =
      kind === "approve"
        ? {}
        : kind === "approve-with-note"
          ? { note: note.trim() }
          : { reason: note.trim() };
    const res = await fetch(`/api/draw-requests/${draw.id}/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.message ?? b.error ?? "decision_failed");
      return;
    }
    router.refresh();
  }

  async function downloadWaiver(documentId: string) {
    const res = await fetch(`/api/files/${documentId}`);
    if (!res.ok) return;
    const body = await res.json();
    if (body.downloadUrl) window.open(body.downloadUrl, "_blank", "noopener");
  }

  return (
    <div className="bcr-d">
      <div className="bcr-d-head">
        <div>
          <h2 className="bcr-d-title">Draw Request #{draw.drawNumber}</h2>
          <div className="bcr-d-meta">
            <span>
              <strong>Period:</strong> {fmtRange(draw.periodFrom, draw.periodTo)}
            </span>
            <span>
              <strong>Submitted:</strong> {fmtDate(draw.submittedAt)}
            </span>
            {draw.reviewedAt && (
              <span>
                <strong>Reviewed:</strong> {fmtDate(draw.reviewedAt)}
              </span>
            )}
          </div>
        </div>
        <Pill color={sv.color}>{sv.label}</Pill>
      </div>

      {draw.reviewNote && (
        <div className="bcr-note">
          <div className="bcr-note-lbl">Your review note</div>
          <p>{draw.reviewNote}</p>
        </div>
      )}
      {draw.returnReason && (
        <div className="bcr-note bcr-note-warn">
          <div className="bcr-note-lbl">Return reason</div>
          <p>{draw.returnReason}</p>
        </div>
      )}

      <section className="bcr-section">
        <div className="bcr-section-head">
          <h3>Application summary</h3>
        </div>
        <div className="bcr-g702">
          {g702.map((item) => (
            <div
              key={item.label}
              className={`bcr-g702-item${item.highlight ? " bcr-g702-hl" : ""}`}
            >
              <div className="bcr-g702-lbl">{item.label}</div>
              <div className="bcr-g702-val">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bcr-section">
        <div className="bcr-section-head">
          <h3>Line-by-line work</h3>
          <span className="bcr-section-sub">
            {draw.lineItems.length} line items this period
          </span>
        </div>
        {draw.lineItems.length === 0 ? (
          <EmptyState
            title="No line items on this draw"
            description="Line items are pulled from the Schedule of Values."
          />
        ) : (
          <div className="bcr-table-wrap">
            <table className="bcr-g703">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Description</th>
                  <th className="right">Scheduled</th>
                  <th className="right">Previous</th>
                  <th className="right ed">This period</th>
                  <th className="right">Stored</th>
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
                  <td className="right">{fmtMoney(totals.stored)}</td>
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

      <section className="bcr-section">
        <div className="bcr-section-head">
          <h3>Lien waivers</h3>
          <span className="bcr-section-sub">Required for draw closeout</span>
        </div>
        {draw.lienWaivers.length === 0 ? (
          <EmptyState
            title="No lien waivers yet"
            description="Waivers will appear here once requested from subcontractors."
          />
        ) : (
          <div className="bcr-lws">
            {draw.lienWaivers.map((w) => {
              const pill = waiverPill(w.lienWaiverStatus);
              return (
                <div key={w.id} className="bcr-lw">
                  <div className="bcr-lw-main">
                    <div className="bcr-lw-name">{waiverTypeLabel(w.lienWaiverType)}</div>
                    <div className="bcr-lw-detail">
                      {fmtMoney(w.amountCents)} · through {fmtDate(w.throughDate)}
                    </div>
                  </div>
                  <div className="bcr-lw-actions">
                    <Pill color={pill.color}>{pill.label}</Pill>
                    {w.documentId ? (
                      <button
                        type="button"
                        className="bcr-lw-dl"
                        onClick={() => downloadWaiver(w.documentId!)}
                      >
                        Download
                      </button>
                    ) : (
                      <span className="bcr-lw-nofile">No file yet</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="bcr-section">
        <div className="bcr-section-head">
          <h3>Supporting files</h3>
          <span className="bcr-section-sub">Attachments released with this draw</span>
        </div>
        <p className="bcr-empty-copy">
          Files attached to this draw package (cover sheets, pay apps, backup
          invoices) will appear here.
        </p>
      </section>

      {canDecide && (
        <div className="bcr-dec">
          <h4>Your decision</h4>
          <p>Approve the package, add a note, or return it for clarification.</p>
          <div className="bcr-dec-opts">
            {(
              [
                {
                  k: "approve" as const,
                  h: "Approve",
                  s: "Proceed as submitted",
                },
                {
                  k: "approve-with-note" as const,
                  h: "Approve with note",
                  s: "Approve with a condition",
                },
                {
                  k: "return" as const,
                  h: "Return for clarification",
                  s: "Send back with feedback",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.k}
                type="button"
                className={`bcr-dec-opt${kind === opt.k ? " on" : ""}`}
                onClick={() => setKind(opt.k)}
              >
                <div className="bcr-dec-opt-h">{opt.h}</div>
                <div className="bcr-dec-opt-s">{opt.s}</div>
              </button>
            ))}
          </div>
          {kind !== "approve" && (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                kind === "return"
                  ? "Explain what needs clarification or additional backup…"
                  : "Add a condition or note for the contractor…"
              }
            />
          )}
          {error && <div className="bcr-dec-err">{error}</div>}
          <div className="bcr-dec-acts">
            <Button variant="primary" onClick={submitDecision} disabled={pending}>
              {pending
                ? "Submitting…"
                : kind === "return"
                  ? "Return package"
                  : kind === "approve-with-note"
                    ? "Submit approval with note"
                    : "Submit approval"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RightRail({
  draws,
  selected,
}: {
  draws: Draw[];
  selected: Draw | null;
}) {
  const snapshot = useMemo(() => {
    const latest = draws[0] ?? null;
    const billedToDate =
      draws
        .filter((d) =>
          ["approved", "approved_with_note", "paid"].includes(d.drawRequestStatus),
        )
        .reduce((acc, d) => acc + d.currentPaymentDueCents, 0) +
      (selected?.previousCertificatesCents ?? 0);
    return {
      originalContract: latest?.originalContractSumCents ?? 0,
      changeOrders: latest?.netChangeOrdersCents ?? 0,
      revisedContract: latest?.contractSumToDateCents ?? 0,
      billedToDate,
      retainage: latest?.totalRetainageCents ?? 0,
    };
  }, [draws, selected]);

  const pendingDraw = draws.find((d) => d.drawRequestStatus === "under_review");
  const showDecisionCard = pendingDraw != null;

  return (
    <>
      {showDecisionCard && (
        <div className="bcr-rc alert">
          <div className="bcr-rc-h">
            <h3>Decision needed</h3>
            <span className="sub">A draw package is awaiting your review.</span>
          </div>
          <div className="bcr-rc-b">
            <div className="bcr-mblk">
              <h4>
                Draw #{pendingDraw.drawNumber} · {fmtMoney(pendingDraw.currentPaymentDueCents)}
              </h4>
              <p>
                Affects payment timing. Approve the package, approve with a
                note, or return it for clarification.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bcr-rc">
        <div className="bcr-rc-h">
          <h3>Contract snapshot</h3>
          <span className="sub">Rolling totals across this cycle.</span>
        </div>
        <div className="bcr-rc-b">
          <div className="bcr-snap">
            <div className="bcr-snap-row">
              <span>Original contract</span>
              <span className="v">{fmtMoney(snapshot.originalContract)}</span>
            </div>
            <div className="bcr-snap-row">
              <span>Change orders</span>
              <span className="v">{fmtMoneySigned(snapshot.changeOrders)}</span>
            </div>
            <div className="bcr-snap-row total">
              <span>Revised contract</span>
              <span className="v">{fmtMoney(snapshot.revisedContract)}</span>
            </div>
            <div className="bcr-snap-row">
              <span>Billed to date</span>
              <span className="v">{fmtMoney(snapshot.billedToDate)}</span>
            </div>
            <div className="bcr-snap-row">
              <span>Retainage held</span>
              <span className="v">{fmtMoney(snapshot.retainage)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bcr-rc">
        <div className="bcr-rc-h">
          <h3>Recent activity</h3>
          <span className="sub">Billing events on this project.</span>
        </div>
        <div className="bcr-rc-b">
          <p className="bcr-rc-p">
            Activity feed will populate as draw packages are submitted, reviewed,
            and approved.
          </p>
        </div>
      </div>

      <div className="bcr-rc info">
        <div className="bcr-rc-h">
          <h3>Review principle</h3>
          <span className="sub">How billing decisions flow.</span>
        </div>
        <div className="bcr-rc-b">
          <p className="bcr-rc-p">
            Every draw package represents a formal application for payment.
            Your decision returns directly to the contractor and affects
            payment timing according to your contract.
          </p>
        </div>
      </div>
    </>
  );
}

function G703Row({ line }: { line: Line }) {
  return (
    <tr>
      <td>{line.itemNumber}</td>
      <td className="desc">{line.description}</td>
      <td className="right">{fmtMoney(line.scheduledValueCents)}</td>
      <td className="right">{fmtMoney(line.workCompletedPreviousCents)}</td>
      <td className="right ed">{fmtMoney(line.workCompletedThisPeriodCents)}</td>
      <td className="right">{fmtMoney(line.materialsPresentlyStoredCents)}</td>
      <td className="right">{fmtMoney(line.totalCompletedStoredToDateCents)}</td>
      <td className="center">{fmtPct(line.percentCompleteBasisPoints)}</td>
      <td className="right">{fmtMoney(line.balanceToFinishCents)}</td>
      <td className="right">{fmtMoney(line.retainageCents)}</td>
    </tr>
  );
}

function WorkspaceStyles() {
  return (
    <style>{`
      .bcr{display:flex;flex-direction:column;gap:20px}
      .bcr-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
      .bcr-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
      .bcr-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:0}
      .bcr-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
      .bcr-head-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
      .bcr-head-actions{display:flex;gap:8px;flex-shrink:0;padding-top:4px;flex-wrap:wrap}
      .bcr-btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12.5px;font-weight:640;cursor:pointer;transition:all var(--df) var(--e);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
      .bcr-btn:hover{border-color:var(--s4);background:var(--sh)}
      .bcr-btn.pri{background:var(--ac);border-color:var(--ac);color:#fff}
      .bcr-btn.pri:hover{background:var(--ac-h);border-color:var(--ac-h)}

      .bcr-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
      @media(max-width:1000px){.bcr-kpis{grid-template-columns:repeat(2,1fr)}}

      .bcr-page-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
      @media(max-width:1280px){.bcr-page-grid{grid-template-columns:1fr}}

      .bcr-rail{display:flex;flex-direction:column;gap:12px;min-width:0}
      .bcr-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
      .bcr-rc.alert{border-color:color-mix(in srgb,var(--wr) 30%,var(--s3))}
      .bcr-rc.info{border-color:color-mix(in srgb,var(--in) 30%,var(--s3))}
      .bcr-rc-h{padding:14px 16px 0}
      .bcr-rc-h h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
      .bcr-rc-h .sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:3px;display:block}
      .bcr-rc-b{padding:10px 16px 16px}
      .bcr-rc-p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}
      .bcr-mblk{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:12px}
      .bcr-mblk h4{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0 0 4px}
      .bcr-mblk p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:0;line-height:1.5}
      .bcr-snap{display:flex;flex-direction:column;gap:8px}
      .bcr-snap-row{display:flex;align-items:center;justify-content:space-between;gap:10px;font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2)}
      .bcr-snap-row .v{font-family:var(--fd);font-weight:700;color:var(--t1)}
      .bcr-snap-row.total{padding-top:6px;margin-top:2px;border-top:1px dashed var(--s3);color:var(--t1);font-weight:640}

      .bcr-empty-copy{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

      .bcr-split{display:grid;grid-template-columns:320px minmax(0,1fr)}
      @media(max-width:980px){.bcr-split{grid-template-columns:1fr}}
      .bcr-queue{border-right:1px solid var(--s3);max-height:820px;overflow-y:auto;display:flex;flex-direction:column;padding:12px 12px 14px;gap:6px}
      .bcr-queue::-webkit-scrollbar{width:4px}
      .bcr-queue::-webkit-scrollbar-track{background:transparent}
      .bcr-queue::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
      .bcr-row{text-align:left;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e);display:flex;flex-direction:column;gap:4px}
      .bcr-row:hover{border-color:var(--s4);background:var(--sh)}
      .bcr-row-sel,.bcr-row-sel:hover{border-color:color-mix(in srgb,var(--ac) 40%,var(--s3));background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
      .bcr-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .bcr-row-title{font-family:var(--fd);font-size:13.5px;font-weight:720;color:var(--t1);letter-spacing:-.005em}
      .bcr-row-period{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2)}
      .bcr-row-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
      .bcr-row-amt{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1)}

      .bcr-detail{padding:22px 24px;min-width:0}
      .bcr-d{display:flex;flex-direction:column;gap:22px}
      .bcr-d-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
      .bcr-d-title{font-family:var(--fd);font-size:20px;font-weight:780;letter-spacing:-.02em;color:var(--t1);margin:0 0 8px}
      .bcr-d-meta{display:flex;flex-wrap:wrap;gap:16px;font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2)}
      .bcr-d-meta strong{font-weight:680;color:var(--t1);margin-right:4px}

      .bcr-note{padding:12px 14px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--sh)}
      .bcr-note-warn{background:var(--wr-s);border-color:var(--wr)}
      .bcr-note-lbl{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
      .bcr-note-warn .bcr-note-lbl{color:var(--wr-t)}
      .bcr-note p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);margin:0;line-height:1.5}

      .bcr-section{display:flex;flex-direction:column;gap:12px}
      .bcr-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .bcr-section-head h3{font-family:var(--fd);font-size:14px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
      .bcr-section-sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3)}

      .bcr-g702{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
      @media(max-width:1280px){.bcr-g702{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:640px){.bcr-g702{grid-template-columns:1fr}}
      .bcr-g702-item{padding:14px 16px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--sh);display:flex;flex-direction:column;gap:4px}
      .bcr-g702-hl{background:var(--ac-s);border-color:var(--ac)}
      .bcr-g702-lbl{font-family:var(--fb);font-size:11.5px;font-weight:620;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
      .bcr-g702-val{font-family:var(--fd);font-size:20px;font-weight:820;color:var(--t1);letter-spacing:-.02em}
      .bcr-g702-hl .bcr-g702-val{color:var(--ac-t)}

      .bcr-table-wrap{border:1px solid var(--s3);border-radius:var(--r-m);overflow-x:auto}
      .bcr-g703{width:100%;border-collapse:collapse;font-family:var(--fb);font-size:12.5px}
      .bcr-g703 th{font-family:var(--fb);font-size:10.5px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;text-align:left;padding:10px 12px;background:var(--sh);border-bottom:1px solid var(--s3);white-space:nowrap}
      .bcr-g703 td{padding:10px 12px;border-bottom:1px solid var(--s3);font-family:var(--fm);font-size:12px;font-weight:540;color:var(--t1);white-space:nowrap}
      .bcr-g703 td.desc{font-family:var(--fb);font-weight:560;white-space:normal}
      .bcr-g703 th.right,.bcr-g703 td.right{text-align:right}
      .bcr-g703 th.center,.bcr-g703 td.center{text-align:center}
      .bcr-g703 th.ed,.bcr-g703 td.ed{background:var(--ac-s)}
      .bcr-g703 tfoot td{font-family:var(--fd);font-weight:740;background:var(--sh);border-top:2px solid var(--s3);border-bottom:none}
      .bcr-g703 tfoot td.accent{color:var(--ac-t)}
      .bcr-g703 tr:last-child td{border-bottom:none}

      .bcr-lws{display:flex;flex-direction:column;border:1px solid var(--s3);border-radius:var(--r-m);overflow:hidden}
      .bcr-lw{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid var(--s3);background:var(--s1)}
      .bcr-lw:last-child{border-bottom:none}
      .bcr-lw-main{min-width:0;display:flex;flex-direction:column;gap:2px}
      .bcr-lw-name{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1)}
      .bcr-lw-detail{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}
      .bcr-lw-actions{display:flex;align-items:center;gap:10px}
      .bcr-lw-dl{font-family:var(--fd);font-size:12px;font-weight:660;color:var(--ac-t);background:transparent;border:1px solid var(--ac);padding:6px 12px;border-radius:var(--r-s);cursor:pointer;transition:background var(--df) var(--e)}
      .bcr-lw-dl:hover{background:var(--ac-s)}
      .bcr-lw-nofile{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3)}

      .bcr-dec{border:2px solid var(--ac-m);border-radius:var(--r-l);padding:18px;background:var(--s1);display:flex;flex-direction:column;gap:10px}
      .bcr-dec h4{font-family:var(--fd);font-size:15px;font-weight:750;color:var(--t1);margin:0}
      .bcr-dec>p{font-family:var(--fb);font-size:13px;color:var(--t2);margin:0;line-height:1.5}
      .bcr-dec-opts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:4px}
      @media(max-width:760px){.bcr-dec-opts{grid-template-columns:1fr}}
      .bcr-dec-opt{text-align:center;border:2px solid var(--s3);border-radius:var(--r-m);padding:12px;cursor:pointer;transition:all var(--dn) var(--e);background:var(--s1)}
      .bcr-dec-opt:hover{border-color:var(--s4)}
      .bcr-dec-opt.on{border-color:var(--ac);background:var(--ac-s)}
      .bcr-dec-opt-h{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1)}
      .bcr-dec-opt-s{font-family:var(--fb);font-size:11px;color:var(--t2);margin-top:3px}
      .bcr-dec textarea{width:100%;min-height:72px;border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px;font-size:13px;font-family:var(--fb);resize:vertical;outline:none;background:var(--s1);color:var(--t1)}
      .bcr-dec textarea:focus{border-color:var(--ac-m)}
      .bcr-dec-err{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--dg-t)}
      .bcr-dec-acts{display:flex;gap:8px}
    `}</style>
  );
}
