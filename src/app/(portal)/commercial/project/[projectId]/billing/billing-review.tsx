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
  nowMs: now,
}: {
  projectName: string;
  draws: Draw[];
  nowMs: number;
}) {

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

      {/* Pay now — shown once the package is approved and still has a balance due. */}
      {!canDecide &&
        (draw.drawRequestStatus === "approved" ||
          draw.drawRequestStatus === "approved_with_note") &&
        draw.currentPaymentDueCents > 0 && (
          <PayNowBlock drawId={draw.id} />
        )}
    </div>
  );
}

function PayNowBlock({ drawId }: { drawId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function payNow() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/draw-requests/${drawId}/pay`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.url) {
        setError(data.message ?? data.error ?? "Could not start payment.");
        setPending(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="bcr-ds">
      <div className="bcr-ds-head">
        <h4>Pay this draw</h4>
        <div className="bcr-ds-actions">
          <span className="bcr-pl green">Approved</span>
        </div>
      </div>
      <div className="bcr-ds-body">
        <p className="bcr-dec-intro">
          Approved. Pay now via ACH (or card, if your contractor&apos;s plan
          allows). Processed by Stripe — ACH settles in 3–5 business days.
        </p>
        {error && <div className="bcr-dec-err">{error}</div>}
        <div className="bcr-decision-actions">
          <button
            type="button"
            className="bcr-btn primary"
            onClick={payNow}
            disabled={pending}
          >
            {pending ? "Starting secure checkout…" : "Pay this draw"}
          </button>
        </div>
      </div>
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
