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
import {
  formatDate,
  formatSignedCents,
} from "@/domain/loaders/change-order-format";

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

      <style dangerouslySetInnerHTML={{ __html: `
        .rsc{display:flex;flex-direction:column;gap:16px}
        .rsc-head{display:flex;flex-direction:column;gap:6px}
        .rsc-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;color:var(--t1);line-height:1.15;margin:0}
        .rsc-desc{font-family:var(--fb);font-size:14px;font-weight:540;color:var(--t2);line-height:1.55;max-width:720px;margin:0}
        .rsc-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
        @media(max-width:900px){.rsc-sum{grid-template-columns:1fr}}
        .rsc-sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 16px;box-shadow:var(--shsm)}
        .rsc-sc.danger{border-color:color-mix(in srgb,var(--dg) 25%,var(--s3))}
        .rsc-sc-l{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .rsc-sc-v{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px;color:var(--t1)}
        .rsc-sc.danger .rsc-sc-v{color:var(--dg-t)}
        .rsc-sc-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:3px}
        .rsc-section-title{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:10px 0 0}
      ` }} />
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

      <style dangerouslySetInnerHTML={{ __html: `
        .rsc-card{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:20px 22px;box-shadow:var(--shsm);display:flex;flex-direction:column;gap:12px;margin-bottom:12px}
        .rsc-card-pending{border-color:var(--ac-m);border-width:2px}
        .rsc-card-top{display:flex;align-items:flex-start}
        .rsc-card-title{font-family:var(--fd);font-size:17px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
        .rsc-card-desc{font-family:var(--fb);font-size:14px;font-weight:540;color:var(--t2);line-height:1.55;margin:0}
        .rsc-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        @media(max-width:600px){.rsc-stats{grid-template-columns:1fr}}
        .rsc-stat{background:var(--s2);border-radius:var(--r-m);padding:12px 14px}
        .rsc-stat-k{font-family:var(--fb);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .rsc-stat-v{font-family:var(--fd);font-size:16px;font-weight:750;margin-top:3px;color:var(--t1)}
        .rsc-stat-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}
        .rsc-explain{padding:14px 16px;background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-m)}
        .rsc-explain h5{font-family:var(--fd);font-size:13px;font-weight:720;color:var(--ac-t);margin:0}
        .rsc-explain p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.55;margin:4px 0 0}
        .rsc-acts{display:flex;gap:8px;flex-wrap:wrap}
        .rsc-reject{display:flex;flex-direction:column;gap:10px}
        .rsc-inp{width:100%;padding:10px 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);font-family:var(--fb);font-size:13px;color:var(--t1);resize:vertical;line-height:1.5}
        .rsc-inp:focus{outline:none;border-color:var(--ac)}
        .rsc-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      ` }} />
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
      <style dangerouslySetInnerHTML={{ __html: `
        .rsa{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:16px 18px;opacity:.9;margin-bottom:10px}
        .rsa-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
        .rsa-top h3{font-family:var(--fd);font-size:15px;font-weight:720;color:var(--t1);margin:0}
        .rsa-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.5;margin:6px 0 0}
        .rsa-foot{display:flex;gap:18px;margin-top:10px;font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2)}
      ` }} />
    </div>
  );
}
