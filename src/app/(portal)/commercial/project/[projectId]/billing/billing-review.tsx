"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import type { ClientProjectView } from "@/domain/loaders/project-home";

type Draw = ClientProjectView["drawRequests"][number];
type Line = Draw["lineItems"][number];
type Waiver = Draw["lienWaivers"][number];
type TabId = "pending" | "approved" | "returned";
type DecisionKind = "approve" | "approve-with-note" | "return";
type PillClass = "accent" | "green" | "orange" | "red" | "blue" | "gray";

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
  })}–${t.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function daysSince(d: Date | null, now: number): number | null {
  if (!d) return null;
  return Math.floor((now - new Date(d).getTime()) / 86400000);
}

function statusView(status: string): { pill: PillClass; label: string } {
  switch (status) {
    case "submitted":
      return { pill: "blue", label: "Submitted" };
    case "under_review":
      return { pill: "accent", label: "Needs my review" };
    case "revised":
      return { pill: "blue", label: "Revised" };
    case "approved":
      return { pill: "green", label: "Approved" };
    case "approved_with_note":
      return { pill: "green", label: "Approved" };
    case "returned":
      return { pill: "orange", label: "Returned" };
    case "paid":
      return { pill: "green", label: "Paid" };
    default:
      return { pill: "gray", label: status.replace(/_/g, " ") };
  }
}

function tabOf(status: string): TabId {
  if (status === "approved" || status === "approved_with_note" || status === "paid") return "approved";
  if (status === "returned") return "returned";
  return "pending";
}

function drawNumLabel(num: number): string {
  return `Draw ${String(num).padStart(2, "0")}`;
}

function drawDescFor(d: Draw): string {
  if (d.drawRequestStatus === "under_review") {
    return "Released by contractor for billing review with invoice backup and milestone support.";
  }
  if (d.drawRequestStatus === "approved" || d.drawRequestStatus === "approved_with_note") {
    return "Approved and cleared in this review cycle.";
  }
  if (d.drawRequestStatus === "paid") {
    return "Payment processed and closed.";
  }
  if (d.drawRequestStatus === "returned") {
    return "Returned to the contractor for clarification or additional backup.";
  }
  if (d.drawRequestStatus === "revised") {
    return "Revised by the contractor after return. Ready for another look.";
  }
  return "Application for payment released by the contractor.";
}

function drawDetailDesc(d: Draw): string {
  return (
    "This draw package groups current-cycle invoices, support documentation, and milestone backup into one review object. Your decision determines whether it moves forward or returns for clarification."
  );
}

function tagsFor(d: Draw, now: number): string[] {
  const tags: string[] = [];
  const sv = statusView(d.drawRequestStatus);
  tags.push(sv.label);
  tags.push(fmtMoney(d.currentPaymentDueCents));
  if (
    (d.drawRequestStatus === "under_review" || d.drawRequestStatus === "submitted") &&
    d.submittedAt
  ) {
    const days = daysSince(d.submittedAt, now);
    if (days != null) tags.push(`${days} day${days === 1 ? "" : "s"} waiting`);
  }
  if (d.supportingFiles.length > 0) {
    tags.push(`${d.supportingFiles.length} support doc${d.supportingFiles.length === 1 ? "" : "s"}`);
  }
  return tags;
}

function footerTimeFor(d: Draw, now: number): string {
  if (d.paidAt) return `Paid ${fmtDate(d.paidAt)}`;
  if (d.reviewedAt) return `Reviewed ${fmtDate(d.reviewedAt)}`;
  if (d.submittedAt) {
    const days = daysSince(d.submittedAt, now);
    if (days != null) return `Released ${days}d ago`;
    return `Released ${fmtDate(d.submittedAt)}`;
  }
  return "Not yet released";
}

function waiverPill(status: Waiver["lienWaiverStatus"]): {
  pill: PillClass;
  label: string;
  dot: "received" | "pending" | "missing";
} {
  switch (status) {
    case "accepted":
    case "submitted":
      return { pill: "green", label: "Received", dot: "received" };
    case "rejected":
      return { pill: "red", label: "Missing", dot: "missing" };
    case "waived":
      return { pill: "gray", label: "Waived", dot: "received" };
    default:
      return { pill: "orange", label: "Pending", dot: "pending" };
  }
}

function waiverLabel(w: Waiver): string {
  const typeMap: Record<Waiver["lienWaiverType"], string> = {
    conditional_progress: "Conditional",
    unconditional_progress: "Unconditional",
    conditional_final: "Conditional final",
    unconditional_final: "Unconditional final",
  };
  const type = typeMap[w.lienWaiverType];
  if (w.lienWaiverStatus === "accepted" || w.lienWaiverStatus === "submitted")
    return `${type} waiver received`;
  if (w.lienWaiverStatus === "rejected") return `${type} waiver rejected`;
  if (w.lienWaiverStatus === "waived") return `${type} waiver waived`;
  return `${type} waiver requested — not yet received`;
}

function fileTypeFor(linkRole: string): string {
  const r = linkRole.toLowerCase();
  if (r.includes("primary") || r.includes("g702") || r.includes("summary")) return "Primary";
  if (r.includes("context") || r.includes("note") || r.includes("memo")) return "Context";
  return "Backup";
}

function fileDescFor(linkRole: string, documentType: string): string {
  const cleanRole = linkRole.replace(/_/g, " ");
  const cleanType = documentType.replace(/_/g, " ");
  if (!linkRole || cleanRole === cleanType) return cleanType;
  return cleanRole;
}

function dotClassFor(activityType: string): string {
  if (activityType.includes("submit") || activityType.includes("upload")) return "action";
  if (activityType.includes("approv") || activityType.includes("accept") || activityType.includes("paid"))
    return "ok";
  return "warn";
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
    const pending = draws.find((d) => d.drawRequestStatus === "under_review");
    return {
      pendingCount: counts.pending,
      currentDrawValue: pending?.currentPaymentDueCents ?? 0,
      currentDrawNum: pending?.drawNumber ?? null,
      approvedCount: counts.approved,
    };
  }, [draws, counts.pending, counts.approved]);

  return (
    <div className="bcr">
      <header className="bcr-page-header">
        <div className="bcr-page-head-main">
          <h2 className="bcr-page-title">Billing / Draws</h2>
          <p className="bcr-page-desc">
            Review draw packages released by the contractor, inspect line-item
            progress, verify lien waivers, and return a formal billing
            decision.
          </p>
          <div className="bcr-page-pills">
            <span className="bcr-pl accent">Formal billing review</span>
            {summary.pendingCount > 0 && (
              <span className="bcr-pl orange">
                {summary.pendingCount} package{summary.pendingCount === 1 ? "" : "s"} need your review
              </span>
            )}
          </div>
        </div>
        <div className="bcr-page-actions">
          <button type="button" className="bcr-btn">View all draws</button>
          <button type="button" className="bcr-btn primary">Review active draw</button>
        </div>
      </header>

      <div className="bcr-summary-strip">
        <div className="bcr-sc strong">
          <div className="bcr-sc-label">Pending review</div>
          <div className="bcr-sc-value">{summary.pendingCount}</div>
          <div className="bcr-sc-meta">
            {summary.pendingCount === 0
              ? "You're all caught up"
              : "Awaiting your billing decision"}
          </div>
        </div>
        <div className="bcr-sc">
          <div className="bcr-sc-label">Current draw value</div>
          <div className="bcr-sc-value">{fmtMoney(summary.currentDrawValue)}</div>
          <div className="bcr-sc-meta">
            {summary.currentDrawNum != null
              ? `${drawNumLabel(summary.currentDrawNum)} — active package`
              : "No active package"}
          </div>
        </div>
        <div className={`bcr-sc ${summary.pendingCount > 0 ? "alert" : ""}`}>
          <div className="bcr-sc-label">Payment impact</div>
          <div className="bcr-sc-value small">Payment timing</div>
          <div className="bcr-sc-meta">Decision affects next milestone</div>
        </div>
        <div className="bcr-sc success">
          <div className="bcr-sc-label">Approved this cycle</div>
          <div className="bcr-sc-value">{summary.approvedCount}</div>
          <div className="bcr-sc-meta">
            {summary.approvedCount === 0 ? "None yet" : "Cleared and moving forward"}
          </div>
        </div>
      </div>

      <div className="bcr-page-grid">
        <div className="bcr-workspace">
          <div className="bcr-ws-head">
            <div>
              <h3 className="bcr-ws-title">Billing review workspace</h3>
              <div className="bcr-ws-sub">
                Formal draw-package review. The queue orients you; the detail
                pane is where the review work happens.
              </div>
            </div>
          </div>
          <div className="bcr-ws-tabs">
            {(
              [
                { key: "pending", label: "Needs my review" },
                { key: "approved", label: "Approved" },
                { key: "returned", label: "Returned" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`bcr-tab${activeTab === tab.key ? " active" : ""}`}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSelectedId(null);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bcr-master-detail">
            <div>
              <div className="bcr-queue-toolbar">
                <select className="bcr-queue-filter" defaultValue="value">
                  <option value="value">Sort: Highest value</option>
                  <option value="newest">Sort: Newest first</option>
                </select>
              </div>
              <div className="bcr-thread-list">
                {filtered.length === 0 ? (
                  <p className="bcr-empty-row">No draws in this view.</p>
                ) : (
                  filtered.map((d) => {
                    const sv = statusView(d.drawRequestStatus);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={`bcr-draw-card${selected?.id === d.id ? " active" : ""}`}
                        onClick={() => setSelectedId(d.id)}
                      >
                        <div className="bcr-dc-top">
                          <div className="bcr-dc-main">
                            <div className="bcr-dc-id">
                              {drawNumLabel(d.drawNumber)}
                            </div>
                            <div className="bcr-dc-title">{drawDescFor(d)}</div>
                          </div>
                          <span className={`bcr-pl ${sv.pill}`}>{sv.label}</span>
                        </div>
                        <div className="bcr-dc-tags">
                          {tagsFor(d, now).map((t, i) => (
                            <span key={i} className="bcr-mini-tag">{t}</span>
                          ))}
                        </div>
                        <div className="bcr-dc-footer">
                          <span>
                            {fmtMoney(d.currentPaymentDueCents)} ·{" "}
                            {fmtRange(d.periodFrom, d.periodTo)}
                          </span>
                          <span>{footerTimeFor(d, now)}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {selected && <DrawDetail draw={selected} />}
          </div>
        </div>

        <aside className="bcr-rail">
          <RightRail draws={draws} selected={selected} />
        </aside>
      </div>

      <WorkspaceStyles />
    </div>
  );
}

function DrawDetail({ draw }: { draw: Draw }) {
  const router = useRouter();
  const canDecide = draw.drawRequestStatus === "under_review";

  const [kind, setKind] = useState<DecisionKind>("approve-with-note");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pills: { c: PillClass; t: string }[] = [];
  const sv = statusView(draw.drawRequestStatus);
  pills.push({ c: sv.pill, t: sv.label });
  if (draw.drawRequestStatus === "under_review") {
    pills.push({ c: "orange", t: "Payment timing" });
  }
  if (draw.returnReason) {
    pills.push({ c: "orange", t: "Was returned" });
  }

  const g702Items = [
    { label: "Contract sum", value: fmtMoney(draw.contractSumToDateCents), hl: false },
    { label: "Work complete", value: fmtMoney(draw.totalCompletedToDateCents), hl: false },
    { label: "Retainage", value: fmtMoney(draw.totalRetainageCents), hl: false },
    { label: "Current due", value: fmtMoney(draw.currentPaymentDueCents), hl: true },
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
    setSubmitted(true);
    router.refresh();
  }

  const receivedCount = draw.lienWaivers.filter(
    (w) => w.lienWaiverStatus === "accepted" || w.lienWaiverStatus === "submitted",
  ).length;

  return (
    <div className="bcr-detail-pane">
      <div className="bcr-detail-header">
        <div className="bcr-dh-main">
          <h3 className="bcr-dh-title">{drawNumLabel(draw.drawNumber)}</h3>
          <div className="bcr-dh-sub">{drawDetailDesc(draw)}</div>
        </div>
        <div className="bcr-dh-pills">
          {pills.map((p, i) => (
            <span key={i} className={`bcr-pl ${p.c}`}>{p.t}</span>
          ))}
        </div>
      </div>

      {draw.reviewNote && (
        <div className="bcr-note">
          <div className="bcr-note-lbl">Your review note</div>
          <p>{draw.reviewNote}</p>
        </div>
      )}
      {draw.returnReason && (
        <div className="bcr-note warn">
          <div className="bcr-note-lbl">Return reason</div>
          <p>{draw.returnReason}</p>
        </div>
      )}

      {/* G702 Summary */}
      <div className="bcr-ds">
        <div className="bcr-ds-head">
          <h4>G702 — Application for payment</h4>
          <div className="bcr-ds-actions">
            <span className="bcr-pl accent">AIA standard</span>
          </div>
        </div>
        <div className="bcr-ds-body">
          <div className="bcr-g702-strip">
            {g702Items.map((item) => (
              <div
                key={item.label}
                className={`bcr-g702-item${item.hl ? " accent-bg" : ""}`}
              >
                <div className="bcr-g702-label">{item.label}</div>
                <div className="bcr-g702-value">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* G703 Schedule of values */}
      {draw.lineItems.length > 0 && (
        <div className="bcr-ds">
          <div className="bcr-ds-head">
            <h4>G703 — Schedule of values</h4>
            <div className="bcr-ds-actions">
              <span className="bcr-mini-tag">
                {draw.lineItems.length} item{draw.lineItems.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="bcr-ds-body">
            <table className="bcr-sov-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Scheduled</th>
                  <th>This period</th>
                  <th>Total</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {draw.lineItems.map((l) => (
                  <G703Row key={l.id} line={l} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lien waivers */}
      {draw.lienWaivers.length > 0 && (
        <div className="bcr-ds">
          <div className="bcr-ds-head">
            <h4>Lien waivers</h4>
            <div className="bcr-ds-actions">
              <span className="bcr-mini-tag">
                {receivedCount}/{draw.lienWaivers.length} received
              </span>
            </div>
          </div>
          <div className="bcr-ds-body">
            {draw.lienWaivers.map((w) => {
              const wp = waiverPill(w.lienWaiverStatus);
              return (
                <div key={w.id} className="bcr-lien-row">
                  <div className={`bcr-lien-dot ${wp.dot}`} />
                  <div className="bcr-lien-main">
                    <div className="bcr-lien-name">
                      {w.organizationName ?? "Subcontractor"}
                    </div>
                    <div className="bcr-lien-sub">{waiverLabel(w)}</div>
                  </div>
                  <span className={`bcr-pl ${wp.pill}`}>{wp.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Supporting files */}
      {draw.supportingFiles.length > 0 && (
        <div className="bcr-ds">
          <div className="bcr-ds-head">
            <h4>Supporting files</h4>
            <div className="bcr-ds-actions">
              <span className="bcr-mini-tag">
                {draw.supportingFiles.length} file{draw.supportingFiles.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="bcr-ds-body">
            {draw.supportingFiles.map((f) => (
              <div key={f.id} className="bcr-file-row">
                <div>
                  <div className="bcr-file-name">{f.title}</div>
                  <div className="bcr-file-sub">
                    {fileDescFor(f.linkRole, f.documentType)}
                  </div>
                </div>
                <div className="bcr-file-chip">{fileTypeFor(f.linkRole)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision */}
      {canDecide && (
        <div className="bcr-ds">
          <div className="bcr-ds-head">
            <h4>Your decision</h4>
            <div className="bcr-ds-actions">
              <span className="bcr-pl accent">Action required</span>
            </div>
          </div>
          <div className="bcr-ds-body">
            <p className="bcr-dec-intro">
              Select a billing review outcome. These are formal decisions that
              return to the contractor.
            </p>
            <div className="bcr-decision-options">
              {(
                [
                  {
                    k: "approve" as const,
                    h: "Approve package",
                    s: "Confirm the draw is acceptable. Package moves forward as submitted.",
                  },
                  {
                    k: "approve-with-note" as const,
                    h: "Approve with note",
                    s: "Approve, but include a billing note with the returned review.",
                  },
                  {
                    k: "return" as const,
                    h: "Return for clarification",
                    s: "Do not approve. Send back for revision or additional backup.",
                  },
                ] as const
              ).map((opt) => (
                <div
                  key={opt.k}
                  className={`bcr-decision-option${kind === opt.k ? " selected" : ""}`}
                  onClick={() => {
                    setKind(opt.k);
                    setSubmitted(false);
                  }}
                >
                  <h5>{opt.h}</h5>
                  <p>{opt.s}</p>
                </div>
              ))}
            </div>
            <div className="bcr-decision-compose">
              <h5>
                {kind === "approve"
                  ? "Approve package"
                  : kind === "approve-with-note"
                    ? "Approve with note"
                    : "Return for clarification"}
              </h5>
              <p className="bcr-compose-desc">
                {kind === "approve"
                  ? "Your approval confirms the draw is acceptable. No note required."
                  : kind === "approve-with-note"
                    ? "Your approval will move the package forward. The contractor receives your note."
                    : "The package will be sent back. Explain what needs clarification or additional backup."}
              </p>
              {kind !== "approve" && (
                <textarea
                  className="bcr-note-area"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    kind === "return"
                      ? "Describe what needs clarification…"
                      : "Add your billing note here…"
                  }
                />
              )}
              {error && <div className="bcr-dec-err">{error}</div>}
              <div className="bcr-decision-actions">
                {submitted ? (
                  <button type="button" className="bcr-btn submitted">✓ Submitted</button>
                ) : (
                  <button
                    type="button"
                    className="bcr-btn primary"
                    onClick={submitDecision}
                    disabled={pending}
                  >
                    {pending
                      ? "Submitting…"
                      : kind === "return"
                        ? "Return package"
                        : kind === "approve-with-note"
                          ? "Submit approval with note"
                          : "Submit approval"}
                  </button>
                )}
                <button type="button" className="bcr-btn">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function G703Row({ line }: { line: Line }) {
  return (
    <tr>
      <td>{line.description}</td>
      <td className="mono">{fmtMoney(line.scheduledValueCents)}</td>
      <td className="mono">{fmtMoney(line.workCompletedThisPeriodCents)}</td>
      <td className="mono">{fmtMoney(line.totalCompletedStoredToDateCents)}</td>
      <td className="mono">{fmtPct(line.percentCompleteBasisPoints)}</td>
    </tr>
  );
}

function RightRail({
  draws,
  selected,
}: {
  draws: Draw[];
  selected: Draw | null;
}) {
  const pendingDraw = draws.find((d) => d.drawRequestStatus === "under_review");

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

  const snapRows = [
    { label: "Original contract", sub: "Base contract value", value: fmtMoney(snapshot.originalContract) },
    { label: "Change orders", sub: "Net approved changes", value: fmtMoneySigned(snapshot.changeOrders) },
    { label: "Revised contract", sub: "Current contract sum", value: fmtMoney(snapshot.revisedContract) },
    {
      label: "Billed to date",
      sub: selected != null ? `Total through ${drawNumLabel(selected.drawNumber)}` : "Total billed so far",
      value: fmtMoney(snapshot.billedToDate),
    },
    { label: "Retainage held", sub: "Standard rate", value: fmtMoney(snapshot.retainage) },
  ];

  return (
    <>
      {pendingDraw && (
        <div className="bcr-rail-card alert">
          <div className="bcr-rch">
            <h3>Decision needed</h3>
            <div className="bcr-rch-sub">Highest-priority billing action.</div>
          </div>
          <div className="bcr-rcb">
            <div className="bcr-muted-block">
              <h4>{drawNumLabel(pendingDraw.drawNumber)} affects payment timing</h4>
              <p>
                The contractor is waiting on your returned review outcome to
                update the next billing milestone. This is the highest-priority
                package.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bcr-rail-card">
        <div className="bcr-rch">
          <h3>Contract snapshot</h3>
          <div className="bcr-rch-sub">Current project financial summary.</div>
        </div>
        <div className="bcr-rcb">
          {snapRows.map((r) => (
            <div key={r.label} className="bcr-file-row">
              <div>
                <div className="bcr-file-name">{r.label}</div>
                <div className="bcr-file-sub">{r.sub}</div>
              </div>
              <div className="bcr-file-chip">{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bcr-rail-card">
        <div className="bcr-rch">
          <h3>Recent activity</h3>
          <div className="bcr-rch-sub">Billing events on this project.</div>
        </div>
        <div className="bcr-rcb">
          {selected && selected.activityTrail.length > 0 ? (
            selected.activityTrail.slice(0, 6).map((a) => (
              <div key={a.id} className="bcr-activity-item">
                <div className={`bcr-activity-dot ${dotClassFor(a.activityType)}`} />
                <div className="bcr-activity-text">
                  {a.actorName && <b>{a.actorName} </b>}
                  {a.title}
                </div>
                <div className="bcr-activity-time">{fmtDate(a.createdAt)}</div>
              </div>
            ))
          ) : (
            <p className="bcr-empty-copy">
              Activity will populate as draw packages are released, reviewed,
              and approved.
            </p>
          )}
        </div>
      </div>

      <div className="bcr-rail-card info">
        <div className="bcr-rch">
          <h3>Review principle</h3>
        </div>
        <div className="bcr-rcb">
          <p className="bcr-rcb-p">
            This page is about reviewing one formal package and returning a
            decision — not browsing invoices. Each draw is a single review
            object containing value, backup, and a decision return path.
          </p>
        </div>
      </div>
    </>
  );
}

function WorkspaceStyles() {
  return (
    <style>{`
      .bcr{display:flex;flex-direction:column;gap:20px;min-width:0}

      /* ═══ Page header ═══ */
      .bcr-page-header{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap}
      .bcr-page-head-main{min-width:0;flex:1}
      .bcr-page-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;color:var(--t1);line-height:1.15;margin:0}
      .bcr-page-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.55;max-width:720px;margin:8px 0 0}
      .bcr-page-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}
      .bcr-page-actions{display:flex;gap:8px;flex-shrink:0;padding-top:4px;flex-wrap:wrap}

      /* ═══ Pills (prototype bcr-pill) ═══ */
      .bcr-pl{height:22px;padding:0 9px;border-radius:999px;font-family:var(--fd);font-size:10px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap;border:1px solid transparent}
      .bcr-pl.accent{background:var(--ac-s);color:var(--ac-t);border-color:color-mix(in srgb,var(--ac) 30%,var(--s3))}
      .bcr-pl.green{background:var(--ok-s);color:var(--ok-t);border-color:color-mix(in srgb,var(--ok) 30%,var(--s3))}
      .bcr-pl.orange{background:var(--wr-s);color:var(--wr-t);border-color:color-mix(in srgb,var(--wr) 30%,var(--s3))}
      .bcr-pl.red{background:var(--dg-s);color:var(--dg-t);border-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
      .bcr-pl.blue{background:var(--in-s);color:var(--in-t);border-color:color-mix(in srgb,var(--in) 30%,var(--s3))}
      .bcr-pl.gray{background:var(--s2);color:var(--t3);border-color:var(--s3)}

      /* ═══ Buttons ═══ */
      .bcr-btn{height:34px;padding:0 14px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12.5px;font-weight:640;cursor:pointer;transition:all var(--df) var(--e);display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
      .bcr-btn:hover:not(:disabled){border-color:var(--s4);background:var(--sh)}
      .bcr-btn:disabled{opacity:.6;cursor:not-allowed}
      .bcr-btn.primary{background:var(--ac);border-color:var(--ac);color:#fff}
      .bcr-btn.primary:hover:not(:disabled){background:var(--ac-h);border-color:var(--ac-h)}
      .bcr-btn.submitted{background:var(--ok);border-color:var(--ok);color:#fff}

      /* ═══ Summary strip ═══ */
      .bcr-summary-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
      @media(max-width:1100px){.bcr-summary-strip{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:640px){.bcr-summary-strip{grid-template-columns:1fr}}
      .bcr-sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 16px;box-shadow:var(--shsm);transition:all var(--dn) var(--e)}
      .bcr-sc:hover{box-shadow:var(--shmd);transform:translateY(-1px)}
      .bcr-sc.strong{border-color:color-mix(in srgb,var(--ac) 35%,var(--s3));background:linear-gradient(180deg,var(--s1),color-mix(in srgb,var(--ac-s) 40%,var(--s1)))}
      .bcr-sc.alert{border-color:color-mix(in srgb,var(--wr) 35%,var(--s3));background:linear-gradient(180deg,var(--s1),color-mix(in srgb,var(--wr-s) 60%,var(--s1)))}
      .bcr-sc.success{border-color:color-mix(in srgb,var(--ok) 35%,var(--s3));background:linear-gradient(180deg,var(--s1),color-mix(in srgb,var(--ok-s) 60%,var(--s1)))}
      .bcr-sc-label{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
      .bcr-sc-value{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px;color:var(--t1)}
      .bcr-sc-value.small{font-size:16px;font-weight:720;letter-spacing:-.01em}
      .bcr-sc-meta{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px;line-height:1.4}

      /* ═══ Page grid ═══ */
      .bcr-page-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
      @media(max-width:1280px){.bcr-page-grid{grid-template-columns:1fr}}

      /* ═══ Workspace ═══ */
      .bcr-workspace{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;min-width:0}
      .bcr-ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
      .bcr-ws-title{font-family:var(--fd);font-size:15px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
      .bcr-ws-sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);margin-top:4px;line-height:1.45;max-width:560px}

      .bcr-ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
      .bcr-tab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-family:var(--fb);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df) var(--e)}
      .bcr-tab:hover{border-color:var(--s4);color:var(--t1)}
      .bcr-tab.active{background:var(--ac-s);color:var(--ac-t);border-color:color-mix(in srgb,var(--ac) 35%,var(--s3))}

      /* ═══ Master detail grid ═══ */
      .bcr-master-detail{display:grid;grid-template-columns:340px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}
      @media(max-width:1100px){.bcr-master-detail{grid-template-columns:1fr}}

      .bcr-queue-toolbar{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:10px}
      .bcr-queue-filter{height:30px;padding:0 10px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:12px;color:var(--t2);outline:none;font-weight:540;cursor:pointer}
      .bcr-thread-list{display:flex;flex-direction:column;gap:6px;max-height:680px;overflow-y:auto;padding-right:2px}
      .bcr-thread-list::-webkit-scrollbar{width:4px}
      .bcr-thread-list::-webkit-scrollbar-track{background:transparent}
      .bcr-thread-list::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}
      .bcr-empty-row{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t3);padding:20px;margin:0}

      /* ═══ Draw cards ═══ */
      .bcr-draw-card{text-align:left;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e);display:flex;flex-direction:column;gap:8px}
      .bcr-draw-card:hover{border-color:var(--s4);box-shadow:var(--shsm)}
      .bcr-draw-card.active{border-color:color-mix(in srgb,var(--ac) 45%,var(--s3));background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
      .bcr-dc-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
      .bcr-dc-main{flex:1;min-width:0}
      .bcr-dc-id{font-family:var(--fm);font-size:11px;font-weight:540;color:var(--t3);letter-spacing:.02em}
      .bcr-dc-title{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin-top:2px;line-height:1.4}
      .bcr-dc-tags{display:flex;gap:4px;flex-wrap:wrap}
      .bcr-mini-tag{height:20px;padding:0 8px;border-radius:999px;border:1px solid var(--s3);background:var(--s2);color:var(--t3);font-family:var(--fd);font-size:10px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}
      .bcr-dc-footer{display:flex;justify-content:space-between;align-items:center;font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);padding-top:2px}

      /* ═══ Detail pane ═══ */
      .bcr-detail-pane{min-height:400px;min-width:0}
      .bcr-detail-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
      .bcr-dh-main{min-width:0;flex:1}
      .bcr-dh-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em;color:var(--t1);margin:0}
      .bcr-dh-sub{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin-top:6px;line-height:1.5;max-width:480px}
      .bcr-dh-pills{display:flex;gap:6px;flex-shrink:0;flex-wrap:wrap;padding-top:2px}

      /* ═══ Detail sections (.bcr-ds) ═══ */
      .bcr-ds{margin-top:16px;border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden;background:var(--s1)}
      .bcr-ds-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
      .bcr-ds-head h4{font-family:var(--fd);font-size:13px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.005em}
      .bcr-ds-actions{display:flex;gap:6px;align-items:center}
      .bcr-ds-body{padding:14px 16px}

      .bcr-note{padding:12px 14px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--sh);margin-top:16px}
      .bcr-note.warn{background:var(--wr-s);border-color:color-mix(in srgb,var(--wr) 30%,var(--s3))}
      .bcr-note-lbl{font-family:var(--fb);font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}
      .bcr-note.warn .bcr-note-lbl{color:var(--wr-t)}
      .bcr-note p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t1);margin:0;line-height:1.5}

      /* ═══ G702 strip ═══ */
      .bcr-g702-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
      @media(max-width:900px){.bcr-g702-strip{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:520px){.bcr-g702-strip{grid-template-columns:1fr}}
      .bcr-g702-item{text-align:center;padding:12px 10px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1)}
      .bcr-g702-item.accent-bg{background:color-mix(in srgb,var(--ac-s) 60%,var(--s1));border-color:color-mix(in srgb,var(--ac) 40%,var(--s3))}
      .bcr-g702-label{font-family:var(--fd);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--t3)}
      .bcr-g702-value{font-family:var(--fd);font-size:17px;font-weight:820;color:var(--t1);margin-top:4px;letter-spacing:-.02em}
      .bcr-g702-item.accent-bg .bcr-g702-value{color:var(--ac-t)}

      /* ═══ SOV table ═══ */
      .bcr-sov-table{width:100%;border-collapse:collapse;font-size:12px}
      .bcr-sov-table th{text-align:left;font-family:var(--fd);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--t3);padding:8px 10px;border-bottom:2px solid var(--s3);background:var(--s2)}
      .bcr-sov-table td{padding:9px 10px;border-bottom:1px solid var(--s2);font-family:var(--fb);color:var(--t2);font-weight:540}
      .bcr-sov-table td:first-child{font-weight:600;color:var(--t1)}
      .bcr-sov-table td.mono{font-family:var(--fm);font-size:11.5px;font-weight:520;color:var(--t1)}
      .bcr-sov-table tr:hover td{background:var(--sh)}
      .bcr-sov-table tr:last-child td{border-bottom:none}

      /* ═══ Lien waiver rows ═══ */
      .bcr-lien-row{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1);margin-bottom:6px}
      .bcr-lien-row:last-child{margin-bottom:0}
      .bcr-lien-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
      .bcr-lien-dot.received{background:var(--ok)}
      .bcr-lien-dot.pending{background:var(--wr)}
      .bcr-lien-dot.missing{background:var(--dg)}
      .bcr-lien-main{flex:1;min-width:0}
      .bcr-lien-name{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1)}
      .bcr-lien-sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:1px}

      /* ═══ File rows ═══ */
      .bcr-file-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--s2)}
      .bcr-file-row:first-child{padding-top:0}
      .bcr-file-row:last-child{border-bottom:none;padding-bottom:0}
      .bcr-file-name{font-family:var(--fb);font-size:13px;font-weight:620;color:var(--t1)}
      .bcr-file-sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:1px}
      .bcr-file-chip{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);padding:4px 9px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap}

      /* ═══ Decision section ═══ */
      .bcr-dec-intro{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}
      .bcr-decision-options{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
      @media(max-width:900px){.bcr-decision-options{grid-template-columns:1fr}}
      .bcr-decision-option{border:1.5px solid var(--s3);border-radius:var(--r-l);padding:14px;cursor:pointer;transition:all var(--dn) var(--e);background:var(--s1);display:flex;flex-direction:column;gap:4px}
      .bcr-decision-option:hover{border-color:color-mix(in srgb,var(--ac) 35%,var(--s3));box-shadow:var(--shsm)}
      .bcr-decision-option.selected{border-color:var(--ac);background:color-mix(in srgb,var(--ac-s) 55%,var(--s1));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
      .bcr-decision-option h5{font-family:var(--fd);font-size:13px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.005em}
      .bcr-decision-option p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:2px 0 0;line-height:1.45}
      .bcr-decision-compose{border:1px solid var(--s3);border-radius:var(--r-l);padding:16px;background:linear-gradient(180deg,var(--s1),var(--s2));margin-top:12px;display:flex;flex-direction:column;gap:8px}
      .bcr-decision-compose h5{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.005em}
      .bcr-compose-desc{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.5}
      .bcr-note-area{width:100%;min-height:80px;border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px;font-family:var(--fb);font-size:13px;color:var(--t1);resize:vertical;outline:none;background:var(--s1);font-weight:540;transition:all var(--df) var(--e)}
      .bcr-note-area:focus{border-color:var(--ac);box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
      .bcr-dec-err{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--dg-t);margin:0}
      .bcr-decision-actions{display:flex;gap:8px;margin-top:4px;flex-wrap:wrap}

      /* ═══ Right rail ═══ */
      .bcr-rail{display:flex;flex-direction:column;gap:12px;min-width:0}
      .bcr-rail-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
      .bcr-rail-card.alert{border-color:color-mix(in srgb,var(--wr) 35%,var(--s3));background:linear-gradient(180deg,color-mix(in srgb,var(--wr-s) 50%,var(--s1)),var(--s1))}
      .bcr-rail-card.info{border-color:color-mix(in srgb,var(--ac) 35%,var(--s3));background:linear-gradient(180deg,color-mix(in srgb,var(--ac-s) 40%,var(--s1)),var(--s1))}
      .bcr-rch{padding:14px 16px 0}
      .bcr-rch h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.005em}
      .bcr-rch-sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:2px}
      .bcr-rcb{padding:10px 16px 16px}
      .bcr-rcb-p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

      .bcr-muted-block{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:12px}
      .bcr-muted-block h4{font-family:var(--fd);font-size:13px;font-weight:720;color:var(--t1);margin:0 0 4px;letter-spacing:-.005em}
      .bcr-muted-block p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:0;line-height:1.5}

      .bcr-empty-copy{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t3);margin:0;line-height:1.55}

      /* ═══ Activity list ═══ */
      .bcr-activity-item{display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--s2)}
      .bcr-activity-item:first-child{padding-top:0}
      .bcr-activity-item:last-child{border-bottom:none;padding-bottom:0}
      .bcr-activity-dot{width:7px;height:7px;border-radius:50%;background:var(--s4);margin-top:6px;flex-shrink:0}
      .bcr-activity-dot.action{background:var(--ac)}
      .bcr-activity-dot.ok{background:var(--ok)}
      .bcr-activity-dot.warn{background:var(--wr)}
      .bcr-activity-text{flex:1;font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);line-height:1.4}
      .bcr-activity-text b{color:var(--t1);font-weight:650}
      .bcr-activity-time{font-family:var(--fb);font-size:10px;font-weight:540;color:var(--t3);flex-shrink:0;padding-top:2px;white-space:nowrap}
    `}</style>
  );
}
