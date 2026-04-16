"use client";

import { useMemo } from "react";

import { Button } from "@/components/button";
import { Pill } from "@/components/pill";
import type {
  ApprovalRow,
  ApprovalTotals,
} from "@/domain/loaders/approvals";

function formatCents(cents: number, signed = false): string {
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  if (!signed) return dollars;
  const sign = cents < 0 ? "-" : "+";
  return `${sign}${dollars}`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function ResidentialDecisionsReview({
  rows,
  totals,
}: {
  rows: ApprovalRow[];
  totals: ApprovalTotals;
}) {
  const pending = useMemo(
    () => rows.filter((r) => r.approvalStatus === "pending_review"),
    [rows],
  );
  const approved = useMemo(
    () => rows.filter((r) => r.approvalStatus === "approved"),
    [rows],
  );

  const firstPending = pending[0] ?? null;

  return (
    <div className="dec">
      <header className="dec-head">
        <div>
          <h1 className="dec-title">Decisions Needed</h1>
          <p className="dec-desc">
            Your builder occasionally needs your OK on something before they can
            move forward. Nothing complicated — just a quick review and your
            go-ahead.
          </p>
        </div>
      </header>

      <div className="dec-sum">
        <div className={`dec-sc ${pending.length > 0 ? "danger" : ""}`}>
          <div className="dec-sc-l">Needs your OK</div>
          <div className="dec-sc-v">{pending.length}</div>
          <div className="dec-sc-m">
            {pending.length === 0
              ? "You're all caught up"
              : "Take a look when you can"}
          </div>
        </div>
        <div className="dec-sc">
          <div className="dec-sc-l">Already approved</div>
          <div className="dec-sc-v">{approved.length}</div>
          <div className="dec-sc-m">All set</div>
        </div>
        <div className="dec-sc">
          <div className="dec-sc-l">Total project</div>
          <div className="dec-sc-v">{totals.total}</div>
          <div className="dec-sc-m">Decisions so far</div>
        </div>
      </div>

      {firstPending && (
        <div className="rac pending">
          <div style={{ marginBottom: 8 }}>
            <Pill color="red">Needs your OK</Pill>
          </div>
          <h3>{firstPending.title}</h3>
          {firstPending.description && (
            <div className="rac-desc">{firstPending.description}</div>
          )}

          <div className="rac-why">
            <h5>Why they&apos;re asking</h5>
            <p>
              {firstPending.decisionNote ??
                firstPending.description ??
                "Your builder wants to make sure you're comfortable with this before they proceed. There's no rush — just take a look and let them know."}
            </p>
          </div>

          <div className="rac-impact">
            <div className="rac-i">
              <div className="rac-k">Cost</div>
              <div className={`rac-v ${firstPending.impactCostCents === 0 ? "ok" : "warn"}`}>
                {firstPending.impactCostCents === 0
                  ? "No change"
                  : formatCents(firstPending.impactCostCents, true)}
              </div>
            </div>
            <div className="rac-i">
              <div className="rac-k">Schedule benefit</div>
              <div className="rac-v ok">
                {firstPending.impactScheduleDays === 0
                  ? "No change"
                  : firstPending.impactScheduleDays < 0
                  ? `Saves ${Math.abs(firstPending.impactScheduleDays)} days`
                  : `Adds ${firstPending.impactScheduleDays} days`}
              </div>
            </div>
          </div>

          <div className="rac-acts">
            <Button variant="primary">Sounds good — approve</Button>
            <Button variant="secondary">I have a question</Button>
          </div>
        </div>
      )}

      {pending.slice(1).map((r) => (
        <div key={r.id} className="rac pending">
          <div style={{ marginBottom: 8 }}>
            <Pill color="red">Needs your OK</Pill>
          </div>
          <h3>{r.title}</h3>
          {r.description && <div className="rac-desc">{r.description}</div>}
          <div className="rac-acts">
            <Button variant="primary">Sounds good — approve</Button>
            <Button variant="secondary">I have a question</Button>
          </div>
        </div>
      ))}

      {approved.length > 0 && (
        <>
          <div className="dec-section-title">Already approved</div>
          {approved.map((r) => (
            <div key={r.id} className="rac dim">
              <div className="rac-row-top">
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 15 }}>{r.title}</h3>
                  {r.description && <div className="rac-desc">{r.description}</div>}
                </div>
                <Pill color="green">Approved</Pill>
              </div>
              <div className="rac-meta">
                <span>
                  Cost:{" "}
                  <strong className={r.impactCostCents === 0 ? "ok" : "warn"}>
                    {r.impactCostCents === 0
                      ? "No change"
                      : formatCents(r.impactCostCents, true)}
                  </strong>
                </span>
                {r.decidedAt && (
                  <span>
                    Approved: <strong>{formatDate(r.decidedAt)}</strong>
                  </span>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {pending.length === 0 && approved.length === 0 && (
        <div className="rac">
          <h3>Nothing needs your attention</h3>
          <div className="rac-desc">
            Your builder will reach out here if anything needs your OK.
          </div>
        </div>
      )}

      
    </div>
  );
}
