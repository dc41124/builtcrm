"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { Pill } from "@/components/pill";
import { EmptyState } from "@/components/empty-state";
import type {
  ChangeOrderRow,
  ChangeOrderTotals,
} from "@/domain/loaders/change-orders";
import { formatDate } from "@/domain/loaders/change-order-format";
import { formatMoneyCents } from "@/lib/format/money";

const formatSignedCents = (c: number) => formatMoneyCents(c, { signed: true });

export function ResidentialScopeChangesReview({
  rows,
  totals,
}: {
  projectName: string;
  rows: ChangeOrderRow[];
  totals: ChangeOrderTotals;
}) {
  const pendingRows = rows.filter(
    (r) => r.changeOrderStatus === "pending_client_approval",
  );
  const approvedRows = rows.filter((r) => r.changeOrderStatus === "approved");

  return (
    <div className="rsc">
      <header className="rsc-head">
        <h1 className="rsc-title">Scope Changes</h1>
        <p className="rsc-desc">
          Sometimes things change during construction. When your builder needs
          to adjust something that affects cost or timing, they&apos;ll explain
          it here for your review.
        </p>
      </header>

      <div className="rsc-sum">
        <div className={`rsc-sc ${pendingRows.length > 0 ? "danger" : ""}`}>
          <div className="rsc-sc-l">Needs your OK</div>
          <div className="rsc-sc-v">{pendingRows.length}</div>
          <div className="rsc-sc-m">
            {pendingRows.length === 0
              ? "Nothing to review"
              : "Review when you're ready"}
          </div>
        </div>
        <div className="rsc-sc">
          <div className="rsc-sc-l">Already approved</div>
          <div className="rsc-sc-v">{approvedRows.length}</div>
          <div className="rsc-sc-m">Part of your project now</div>
        </div>
        <div className="rsc-sc">
          <div className="rsc-sc-l">Net cost change</div>
          <div className="rsc-sc-v">
            {formatSignedCents(totals.approvedChangesCents)}
          </div>
          <div className="rsc-sc-m">From approved changes</div>
        </div>
      </div>

      {pendingRows.length === 0 && approvedRows.length === 0 ? (
        <EmptyState
          title="No scope changes yet"
          description="When your builder needs to adjust something, it'll show up here."
        />
      ) : (
        <>
          {pendingRows.map((co) => (
            <PendingScopeCard key={co.id} co={co} />
          ))}
          {approvedRows.length > 0 && (
            <>
              <h2 className="rsc-section-title">Already approved</h2>
              {approvedRows.map((co) => (
                <ApprovedScopeCard key={co.id} co={co} />
              ))}
            </>
          )}
        </>
      )}

      
    </div>
  );
}

function PendingScopeCard({ co }: { co: ChangeOrderRow }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function approve() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/change-orders/${co.id}/approve`, {
      method: "POST",
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    router.refresh();
  }

  async function reject() {
    if (!rejectReason.trim()) {
      setError("reason_required");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`/api/change-orders/${co.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    setPending(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? "request_failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rsc-card rsc-card-pending">
      <div className="rsc-card-top">
        <Pill color="red">Needs your OK</Pill>
      </div>
      <h3 className="rsc-card-title">{co.title}</h3>
      {co.description && <p className="rsc-card-desc">{co.description}</p>}

      <div className="rsc-stats">
        <div className="rsc-stat">
          <div className="rsc-stat-k">Cost change</div>
          <div
            className="rsc-stat-v"
            style={{
              color: co.amountCents >= 0 ? "var(--wr-t)" : "var(--ok-t)",
            }}
          >
            {formatSignedCents(co.amountCents)}
          </div>
          <div className="rsc-stat-m">
            {co.amountCents >= 0
              ? "Added to your project total"
              : "Reduced from your project total"}
          </div>
        </div>
        <div className="rsc-stat">
          <div className="rsc-stat-k">Timing</div>
          <div
            className="rsc-stat-v"
            style={{
              color:
                co.scheduleImpactDays > 0
                  ? "var(--wr-t)"
                  : co.scheduleImpactDays < 0
                    ? "var(--ok-t)"
                    : "var(--t1)",
            }}
          >
            {co.scheduleImpactDays === 0
              ? "No delay"
              : co.scheduleImpactDays > 0
                ? `+${co.scheduleImpactDays} days`
                : `Saves ${Math.abs(co.scheduleImpactDays)} days`}
          </div>
          <div className="rsc-stat-m">
            {co.scheduleImpactDays > 0
              ? "Schedule impact"
              : co.scheduleImpactDays < 0
                ? "Schedule benefit"
                : "Work can continue on schedule"}
          </div>
        </div>
      </div>

      {co.reason && (
        <div className="rsc-explain">
          <h5>Why this is happening</h5>
          <p>{co.reason}</p>
        </div>
      )}

      {!showReject ? (
        <div className="rsc-acts">
          <Button variant="primary" onClick={approve} loading={pending}>
            Approve this change
          </Button>
          <Button variant="secondary" onClick={() => setShowReject(true)}>
            Ask a question first
          </Button>
        </div>
      ) : (
        <div className="rsc-reject">
          <textarea
            className="rsc-inp"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="What concerns do you have?"
          />
          <div className="rsc-acts">
            <Button variant="secondary" onClick={() => setShowReject(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={reject} loading={pending}>
              Send
            </Button>
          </div>
        </div>
      )}
      {error && <p className="rsc-err">Error: {error}</p>}

      
    </div>
  );
}

function ApprovedScopeCard({ co }: { co: ChangeOrderRow }) {
  return (
    <div className="rsa">
      <div className="rsa-top">
        <h3>{co.title}</h3>
        <Pill color="green">Approved</Pill>
      </div>
      {co.description && <p className="rsa-desc">{co.description}</p>}
      <div className="rsa-foot">
        <span>
          Cost:{" "}
          <strong
            style={{
              color: co.amountCents >= 0 ? "var(--wr-t)" : "var(--ok-t)",
            }}
          >
            {formatSignedCents(co.amountCents)}
          </strong>
        </span>
        {co.approvedAt && (
          <span>
            Approved: <strong>{formatDate(co.approvedAt)}</strong>
          </span>
        )}
      </div>
      
    </div>
  );
}
