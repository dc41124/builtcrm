"use client";

import { useMemo } from "react";

import { Button } from "@/components/button";
import { KpiCard } from "@/components/kpi-card";
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
  projectName,
  rows,
  totals,
}: {
  projectName: string;
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
          <div className="dec-crumbs">{projectName} · Decisions</div>
          <h1 className="dec-title">Decisions Needed</h1>
          <p className="dec-desc">
            Your builder occasionally needs your OK on something before they can
            move forward. Nothing complicated — just a quick review and your
            go-ahead.
          </p>
        </div>
      </header>

      <div className="dec-kpis">
        <KpiCard
          label="Needs your OK"
          value={pending.length.toString()}
          meta={pending.length === 0 ? "You're all caught up" : "Take a look when you can"}
          iconColor="red"
          alert={pending.length > 0}
        />
        <KpiCard
          label="Already approved"
          value={approved.length.toString()}
          meta="All set"
          iconColor="green"
        />
        <KpiCard
          label="Total project"
          value={totals.total.toString()}
          meta="Decisions so far"
          iconColor="purple"
        />
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
              Your builder wants to make sure you&apos;re comfortable with this
              before they proceed. There&apos;s no rush — just take a look and
              let them know.
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

      <style>{`
        .dec{display:flex;flex-direction:column;gap:20px}
        .dec-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .dec-crumbs{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t3);text-transform:uppercase;letter-spacing:.04em}
        .dec-title{font-family:var(--fd);font-size:24px;font-weight:820;letter-spacing:-.03em;color:var(--t1);line-height:1.15;margin:6px 0 4px}
        .dec-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .dec-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        @media(max-width:900px){.dec-kpis{grid-template-columns:1fr}}
        .dec-section-title{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);margin:8px 0 0}
        .rac{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);padding:18px 20px;box-shadow:var(--shsm);display:flex;flex-direction:column;gap:8px}
        .rac.pending{border-color:var(--ac-m);border-width:2px}
        .rac.dim{opacity:.88}
        .rac h3{font-family:var(--fd);font-size:16px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .rac-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.5}
        .rac-row-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
        .rac-why{margin-top:4px;padding:12px 14px;background:var(--ac-s);border:1px solid var(--ac-m);border-radius:var(--r-m)}
        .rac-why h5{font-family:var(--fd);font-size:13px;font-weight:720;color:var(--ac-t);margin:0}
        .rac-why p{font-family:var(--fb);font-size:13px;color:var(--t2);margin-top:3px;line-height:1.5}
        .rac-impact{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
        @media(max-width:700px){.rac-impact{grid-template-columns:1fr}}
        .rac-i{background:var(--s2);border-radius:var(--r-m);padding:10px 12px}
        .rac-k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .rac-v{font-family:var(--fd);font-size:16px;font-weight:750;margin-top:3px;color:var(--t1)}
        .rac-v.ok{color:var(--ok-t)}
        .rac-v.warn{color:var(--wr-t)}
        .rac-acts{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
        .rac-meta{display:flex;gap:16px;margin-top:4px;font-family:var(--fb);font-size:13px;color:var(--t2);flex-wrap:wrap}
        .rac-meta strong{color:var(--t1);font-weight:650}
        .rac-meta strong.ok{color:var(--ok-t)}
        .rac-meta strong.warn{color:var(--wr-t)}
      `}</style>
    </div>
  );
}
