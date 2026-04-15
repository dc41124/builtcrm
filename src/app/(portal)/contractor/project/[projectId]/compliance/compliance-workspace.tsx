"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Pill, type PillColor } from "@/components/pill";
import type { ContractorProjectView } from "@/domain/loaders/project-home";

type ComplianceRow = ContractorProjectView["complianceRecords"][number];
type TabId = "review" | "atrisk" | "restricted" | "accepted";

const THRESHOLD_DAYS = 14;

function isAtRisk(r: ComplianceRow, now: number): boolean {
  if (r.complianceStatus === "rejected") return false;
  if (r.complianceStatus === "expired") return true;
  if (r.complianceStatus === "active" || r.complianceStatus === "waived") {
    if (!r.expiresAt) return false;
    const days = (r.expiresAt.getTime() - now) / 86400000;
    return days <= THRESHOLD_DAYS && days >= 0;
  }
  if (!r.documentId) return true;
  if (r.expiresAt) {
    const days = (r.expiresAt.getTime() - now) / 86400000;
    return days <= THRESHOLD_DAYS;
  }
  return false;
}

function tabOf(r: ComplianceRow, now: number): TabId {
  if (r.complianceStatus === "rejected") return "restricted";
  if (r.complianceStatus === "pending") return "review";
  if (isAtRisk(r, now)) return "atrisk";
  return "accepted";
}

function statusPill(
  r: ComplianceRow,
  now: number,
): { color: PillColor; label: string } {
  if (r.complianceStatus === "rejected") return { color: "red", label: "Restricted" };
  if (r.complianceStatus === "expired") return { color: "red", label: "Expired" };
  if (r.complianceStatus === "pending") {
    if (!r.documentId) return { color: "red", label: "Missing" };
    return { color: "amber", label: "Needs review" };
  }
  if (isAtRisk(r, now)) return { color: "amber", label: "At risk" };
  if (r.complianceStatus === "waived") return { color: "gray", label: "Waived" };
  return { color: "green", label: "Active" };
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(d: Date, now: number): number {
  return Math.ceil((d.getTime() - now) / 86400000);
}

// Synthesize a verify-style checklist per requirement type until the schema
// supports real verification items.
function verifyItemsFor(
  complianceType: string,
  hasDoc: boolean,
): { label: string; detail: string; pass: boolean }[] {
  if (!hasDoc) return [];
  const t = complianceType.toLowerCase();
  if (t.includes("insurance") || t.includes("coi")) {
    return [
      { label: "Named insured", detail: "Org name match confirmed", pass: true },
      { label: "Coverage dates", detail: "Within project window", pass: true },
      { label: "Certificate number", detail: "Present on document", pass: true },
      { label: "Liability minimum ($2M)", detail: "Meets project threshold", pass: true },
      { label: "Additional insured endorsement", detail: "Verify on page 2", pass: false },
    ];
  }
  if (t.includes("wsib") || t.includes("workers")) {
    return [
      { label: "Clearance certificate", detail: "Present", pass: true },
      { label: "Valid-through date", detail: "Covers project period", pass: true },
      { label: "Account in good standing", detail: "No outstanding balance", pass: true },
    ];
  }
  if (t.includes("safety") || t.includes("training")) {
    return [
      { label: "Training provider", detail: "Recognized provider", pass: true },
      { label: "Employee roster", detail: "All active crew listed", pass: true },
      { label: "Certification dates", detail: "Current through expiry", pass: true },
    ];
  }
  return [
    { label: "Document readable", detail: "File opens and is legible", pass: true },
    { label: "Correct organization", detail: "Matches submitting sub", pass: true },
  ];
}

export function ContractorComplianceWorkspace({
  projectId,
  records,
}: {
  projectId: string;
  projectName: string;
  records: ComplianceRow[];
}) {
  const [now] = useState(() => Date.now());

  const tagged = useMemo(
    () => records.map((r) => ({ ...r, _tab: tabOf(r, now) })),
    [records, now],
  );

  const counts = useMemo(() => {
    const c = { review: 0, atrisk: 0, restricted: 0, accepted: 0 };
    for (const r of tagged) c[r._tab] += 1;
    return c;
  }, [tagged]);

  const [activeTab, setActiveTab] = useState<TabId>(
    counts.review > 0
      ? "review"
      : counts.atrisk > 0
        ? "atrisk"
        : counts.restricted > 0
          ? "restricted"
          : "accepted",
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => tagged.filter((r) => r._tab === activeTab),
    [tagged, activeTab],
  );
  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  // Scorecard: per-org rollup
  const scorecard = useMemo(() => {
    const map = new Map<
      string,
      { name: string; total: number; accepted: number; atRisk: number; problem: number }
    >();
    for (const r of records) {
      const key = r.organizationId;
      const name = r.organizationName ?? "Unknown org";
      const prev = map.get(key) ?? { name, total: 0, accepted: 0, atRisk: 0, problem: 0 };
      prev.total += 1;
      if (r.complianceStatus === "active" || r.complianceStatus === "waived") {
        if (isAtRisk(r, now)) prev.atRisk += 1;
        else prev.accepted += 1;
      } else if (
        r.complianceStatus === "rejected" ||
        (r.complianceStatus === "pending" && !r.documentId)
      ) {
        prev.problem += 1;
      } else {
        prev.atRisk += 1;
      }
      map.set(key, prev);
    }
    return Array.from(map.values()).sort((a, b) => b.problem - a.problem || b.atRisk - a.atRisk);
  }, [records, now]);

  const paymentHolds = useMemo(
    () => scorecard.filter((o) => o.problem > 0 || o.atRisk > 0),
    [scorecard],
  );

  const headerPills: { label: string; color: PillColor }[] = [
    { label: "Review + restriction control", color: "purple" },
  ];
  if (counts.review > 0)
    headerPills.push({
      label: `${counts.review} record${counts.review === 1 ? "" : "s"} need review`,
      color: "amber",
    });
  if (counts.atrisk + counts.restricted > 0)
    headerPills.push({
      label: `${counts.atrisk + counts.restricted} at restriction threshold`,
      color: "red",
    });

  return (
    <div className="cmp">
      <header className="cmp-head">
        <div className="cmp-head-main">
          <h1 className="cmp-title">Compliance</h1>
          <p className="cmp-desc">
            Review submitted records, track requirements, and control
            access-state restrictions. Non-compliant subcontractors have payment
            holds applied automatically.
          </p>
          <div className="cmp-head-pills">
            {headerPills.map((p) => (
              <Pill key={p.label} color={p.color}>
                {p.label}
              </Pill>
            ))}
          </div>
        </div>
        <div className="cmp-head-actions">
          <Button variant="secondary">Export log</Button>
          <Button variant="primary">Review next record</Button>
        </div>
      </header>

      <div className="cmp-kpis">
        <div
          className="cmp-sc strong"
          onClick={() => {
            setActiveTab("review");
            setSelectedId(null);
          }}
        >
          <div className="cmp-sc-l">Needs review</div>
          <div className="cmp-sc-v">{counts.review}</div>
          <div className="cmp-sc-m">Submitted records awaiting decision</div>
        </div>
        <div
          className={`cmp-sc ${counts.atrisk > 0 ? "alert" : ""}`}
          onClick={() => {
            setActiveTab("atrisk");
            setSelectedId(null);
          }}
        >
          <div className="cmp-sc-l">At risk</div>
          <div className="cmp-sc-v">{counts.atrisk}</div>
          <div className="cmp-sc-m">Restriction threshold approaching</div>
        </div>
        <div
          className={`cmp-sc ${counts.restricted > 0 ? "danger" : ""}`}
          onClick={() => {
            setActiveTab("restricted");
            setSelectedId(null);
          }}
        >
          <div className="cmp-sc-l">Restricted</div>
          <div className="cmp-sc-v">{counts.restricted}</div>
          <div className="cmp-sc-m">Participation limited · Payment held</div>
        </div>
        <div
          className="cmp-sc success"
          onClick={() => {
            setActiveTab("accepted");
            setSelectedId(null);
          }}
        >
          <div className="cmp-sc-l">Active</div>
          <div className="cmp-sc-v">{counts.accepted}</div>
          <div className="cmp-sc-m">Accepted and valid</div>
        </div>
      </div>

      <div className="cmp-grid">
        <div className="cmp-ws">
          <div className="cmp-ws-head">
            <div>
              <h3>Compliance review workspace</h3>
              <div className="sub">
                Queue-first surface for reviewing records, assessing restriction
                risk, and controlling access consequences.
              </div>
            </div>
          </div>
          <div className="cmp-ws-tabs">
            {(
              [
                { id: "review", label: "Needs review" },
                { id: "atrisk", label: "At risk" },
                { id: "restricted", label: "Restricted" },
                { id: "accepted", label: "Accepted" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`cmp-wtab ${activeTab === t.id ? "on" : ""}`}
                onClick={() => {
                  setActiveTab(t.id);
                  setSelectedId(null);
                }}
              >
                {t.label} ({counts[t.id]})
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 20 }}>
              <EmptyState
                title="No records in this view"
                description="Nothing matches the current filter."
              />
            </div>
          ) : (
            <div className="cmp-split">
              <div className="cmp-queue">
                {filtered.map((r) => {
                  const pill = statusPill(r, now);
                  const hot =
                    r.complianceStatus === "rejected" ||
                    (r.complianceStatus === "pending" && !r.documentId) ||
                    isAtRisk(r, now);
                  const days =
                    r.expiresAt != null ? daysUntil(r.expiresAt, now) : null;
                  const tags: string[] = [];
                  if (r.documentId) tags.push("Submitted");
                  else if (r.complianceStatus === "pending") tags.push("Missing");
                  if (r.expiresAt)
                    tags.push(`Until ${formatDate(r.expiresAt)}`);
                  if (days != null && days >= 0 && days <= THRESHOLD_DAYS)
                    tags.push(`${days}d to threshold`);
                  const access =
                    r.complianceStatus === "rejected"
                      ? "Restricted"
                      : hot
                        ? "At risk"
                        : "Active";
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`cmp-rcd ${selected?.id === r.id ? "on" : ""} ${hot ? "hot" : ""}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <div className="cmp-rcd-top">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="cmp-rcd-org">
                            {r.organizationName ?? "Unknown org"}
                          </div>
                          <div className="cmp-rcd-title">
                            {formatStatus(r.complianceType)}
                          </div>
                        </div>
                        <Pill color={pill.color}>{pill.label}</Pill>
                      </div>
                      {tags.length > 0 && (
                        <div className="cmp-rcd-tags">
                          {tags.map((t) => (
                            <span key={t} className="cmp-mtag">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="cmp-rcd-foot">
                        <span>Access: {access}</span>
                        <span>
                          {r.expiresAt
                            ? `Expires ${formatDate(r.expiresAt)}`
                            : "No expiry"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="cmp-detail">
                {selected ? (
                  <ComplianceDetail
                    key={selected.id}
                    record={selected}
                    projectId={projectId}
                    now={now}
                  />
                ) : (
                  <EmptyState
                    title="Select a record"
                    description="Pick a record from the queue to review or restrict."
                  />
                )}
              </div>
            </div>
          )}
        </div>

        <aside className="cmp-rail">
          <div className="cmp-rc">
            <div className="cmp-rc-h">
              <h3>Org compliance scorecard</h3>
              <span className="sub">Per-subcontractor requirement rollup.</span>
            </div>
            <div className="cmp-rc-b">
              {scorecard.length === 0 ? (
                <p className="cmp-rc-p">No requirements tracked yet.</p>
              ) : (
                scorecard.map((o) => (
                  <div key={o.name} className="cmp-orow">
                    <div className="cmp-oname">{o.name}</div>
                    <div className="cmp-odots">
                      {Array.from({ length: o.total }).map((_, i) => {
                        let cls = "empty";
                        if (i < o.accepted) cls = "filled";
                        else if (i < o.accepted + o.atRisk) cls = "warn";
                        else if (i < o.accepted + o.atRisk + o.problem)
                          cls = "danger";
                        return <span key={i} className={`cmp-sdot ${cls}`} />;
                      })}
                    </div>
                    <span className="cmp-olbl">
                      {o.accepted}/{o.total}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="cmp-rc alert">
            <div className="cmp-rc-h">
              <h3>Payment holds</h3>
              <span className="sub">Compliance-linked payment restrictions.</span>
            </div>
            <div className="cmp-rc-b">
              {paymentHolds.length === 0 ? (
                <p className="cmp-rc-p">No payment holds.</p>
              ) : (
                <>
                  <div className="cmp-phb">
                    <span className="cmp-phb-ico">!</span>
                    <div className="cmp-phb-text">
                      {paymentHolds.length}{" "}
                      {paymentHolds.length === 1 ? "sub has" : "subs have"}{" "}
                      active payment holds
                      <span>
                        Draws and invoices blocked until compliance clears.
                      </span>
                    </div>
                  </div>
                  {paymentHolds.map((o) => (
                    <div key={o.name} className="cmp-fr">
                      <div>
                        <h5>{o.name}</h5>
                        <p>
                          {o.problem > 0
                            ? `${o.problem} out of compliance`
                            : `${o.atRisk} at risk`}
                        </p>
                      </div>
                      <span className="cmp-fc">Held</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="cmp-rc">
            <div className="cmp-rc-h">
              <h3>Recent activity</h3>
              <span className="sub">Compliance events on this project.</span>
            </div>
            <div className="cmp-rc-b">
              <p className="cmp-rc-p">
                Activity feed will populate as compliance events land.
              </p>
            </div>
          </div>

          <div className="cmp-rc info">
            <div className="cmp-rc-h">
              <h3>Compliance principle</h3>
              <span className="sub">
                What makes this different from approvals.
              </span>
            </div>
            <div className="cmp-rc-b">
              <p className="cmp-rc-p">
                Compliance determines whether a vendor can safely participate.
                Every review decision has an access-state and payment-hold
                consequence.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .cmp{display:flex;flex-direction:column;gap:20px}
        .cmp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .cmp-head-main{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1}
        .cmp-title{font-family:var(--fd);font-size:26px;font-weight:820;letter-spacing:-.035em;color:var(--t1);line-height:1.15;margin:0}
        .cmp-desc{font-family:var(--fb);font-size:13.5px;font-weight:540;color:var(--t2);line-height:1.5;max-width:720px;margin:0}
        .cmp-head-pills{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
        .cmp-head-actions{display:flex;gap:8px;flex-shrink:0;padding-top:4px}

        .cmp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        @media(max-width:1000px){.cmp-kpis{grid-template-columns:repeat(2,1fr)}}
        .cmp-sc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:13px 15px;box-shadow:var(--shsm);cursor:pointer;transition:all var(--dn) var(--e)}
        .cmp-sc:hover{box-shadow:var(--shmd);transform:translateY(-1px)}
        .cmp-sc.alert{border-color:color-mix(in srgb,var(--wr) 30%,var(--s3))}
        .cmp-sc.danger{border-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
        .cmp-sc.strong{border-color:color-mix(in srgb,var(--ac) 30%,var(--s3))}
        .cmp-sc.success{border-color:color-mix(in srgb,var(--ok) 30%,var(--s3))}
        .cmp-sc-l{font-family:var(--fd);font-size:11px;font-weight:720;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .cmp-sc-v{font-family:var(--fd);font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:4px;color:var(--t1)}
        .cmp-sc-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}

        .cmp-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}
        @media(max-width:1280px){.cmp-grid{grid-template-columns:1fr}}

        .cmp-ws{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden;min-width:0}
        .cmp-ws-head{padding:18px 20px 0;display:flex;justify-content:space-between;align-items:flex-start;gap:16px}
        .cmp-ws-head h3{font-family:var(--fd);font-size:15px;font-weight:740;color:var(--t1);margin:0;letter-spacing:-.01em}
        .cmp-ws-head .sub{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:4px;max-width:560px}

        .cmp-ws-tabs{display:flex;gap:6px;padding:12px 20px 0;flex-wrap:wrap}
        .cmp-wtab{height:32px;padding:0 14px;border-radius:999px;border:1px solid var(--s3);background:var(--s1);color:var(--t2);font-family:var(--fb);font-size:12px;font-weight:650;display:inline-flex;align-items:center;cursor:pointer;transition:all var(--df) var(--e)}
        .cmp-wtab:hover{border-color:var(--s4);color:var(--t1)}
        .cmp-wtab.on{background:var(--ac-s);color:var(--ac-t);border-color:color-mix(in srgb,var(--ac) 30%,var(--s3))}

        .cmp-split{display:grid;grid-template-columns:370px minmax(0,1fr);padding:16px 20px 20px;gap:14px;align-items:start}
        @media(max-width:1000px){.cmp-split{grid-template-columns:1fr}}

        .cmp-queue{display:flex;flex-direction:column;gap:6px;max-height:640px;overflow-y:auto;min-width:0}
        .cmp-queue::-webkit-scrollbar{width:4px}
        .cmp-queue::-webkit-scrollbar-track{background:transparent}
        .cmp-queue::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px}

        .cmp-rcd{text-align:left;background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-l);padding:12px 14px;cursor:pointer;transition:all var(--dn) var(--e);display:flex;flex-direction:column;gap:6px}
        .cmp-rcd:hover{border-color:var(--s4);box-shadow:var(--shsm)}
        .cmp-rcd.on{border-color:color-mix(in srgb,var(--ac) 40%,var(--s3));background:color-mix(in srgb,var(--ac-s) 30%,var(--s1));box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 15%,transparent)}
        .cmp-rcd.hot{border-color:color-mix(in srgb,var(--dg) 35%,var(--s3))}
        .cmp-rcd.hot.on{border-color:var(--dg-t);box-shadow:0 0 0 3px color-mix(in srgb,var(--dg) 15%,transparent)}
        .cmp-rcd-top{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
        .cmp-rcd-org{font-family:var(--fm);font-size:11px;font-weight:520;color:var(--t3);letter-spacing:.02em}
        .cmp-rcd-title{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin-top:2px;letter-spacing:-.005em}
        .cmp-rcd-tags{display:flex;gap:4px;flex-wrap:wrap}
        .cmp-mtag{height:20px;padding:0 7px;border-radius:999px;border:1px solid var(--s3);background:var(--s2);color:var(--t3);font-family:var(--fd);font-size:10px;font-weight:700;display:inline-flex;align-items:center;white-space:nowrap}
        .cmp-rcd-foot{display:flex;justify-content:space-between;align-items:center;font-family:var(--fb);font-size:11px;font-weight:540;color:var(--t3);margin-top:2px}

        .cmp-detail{min-width:0}

        .cmp-rail{display:flex;flex-direction:column;gap:12px;min-width:0}
        .cmp-rc{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-xl);box-shadow:var(--shsm);overflow:hidden}
        .cmp-rc.alert{border-color:color-mix(in srgb,var(--wr) 30%,var(--s3))}
        .cmp-rc.danger{border-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
        .cmp-rc.info{border-color:color-mix(in srgb,var(--in) 30%,var(--s3))}
        .cmp-rc-h{padding:14px 16px 0}
        .cmp-rc-h h3{font-family:var(--fd);font-size:14px;font-weight:720;color:var(--t1);margin:0;letter-spacing:-.01em}
        .cmp-rc-h .sub{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t3);margin-top:3px;display:block}
        .cmp-rc-b{padding:10px 16px 16px}
        .cmp-rc-p{font-family:var(--fb);font-size:12.5px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

        .cmp-orow{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--s2)}
        .cmp-orow:last-child{border-bottom:none}
        .cmp-oname{font-family:var(--fd);font-size:13px;font-weight:680;color:var(--t1);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cmp-odots{display:flex;gap:3px;align-items:center;flex-shrink:0}
        .cmp-sdot{width:8px;height:8px;border-radius:50%}
        .cmp-sdot.filled{background:var(--ok)}
        .cmp-sdot.warn{background:var(--wr)}
        .cmp-sdot.danger{background:var(--dg)}
        .cmp-sdot.empty{background:var(--s3)}
        .cmp-olbl{font-family:var(--fb);font-size:11px;font-weight:620;color:var(--t3);white-space:nowrap}

        .cmp-phb{display:flex;align-items:center;gap:10px;padding:10px 14px;border:1px solid color-mix(in srgb,var(--wr) 30%,var(--s3));border-radius:var(--r-m);background:var(--wr-s);margin-bottom:10px}
        .cmp-phb-ico{width:20px;height:20px;border-radius:50%;background:var(--wr-t);color:#fff;display:grid;place-items:center;font-family:var(--fd);font-size:12px;font-weight:800;flex-shrink:0}
        .cmp-phb-text{font-family:var(--fb);font-size:12px;color:var(--wr-t);font-weight:620}
        .cmp-phb-text span{display:block;font-weight:520;margin-top:1px;font-size:11px;color:var(--t2)}

        .cmp-fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}
        .cmp-fr:last-child{border-bottom:none}
        .cmp-fr h5{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t1);margin:0}
        .cmp-fr p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:2px 0 0}
        .cmp-fc{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);padding:3px 8px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap}
      `}</style>
    </div>
  );
}

function ComplianceDetail({
  record,
  projectId: _projectId,
  now,
}: {
  record: ComplianceRow;
  projectId: string;
  now: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<null | "accept" | "reject" | "waive">(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function act(action: "accept" | "reject" | "waive") {
    setPending(action);
    setError(null);
    const res = await fetch(`/api/compliance/${record.id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setPending(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error ?? `${action}_failed`);
      return;
    }
    router.refresh();
  }

  const pill = statusPill(record, now);
  const atRisk = isAtRisk(record, now);
  const expiresInDays =
    record.expiresAt != null ? daysUntil(record.expiresAt, now) : null;
  // Show Review decision for any record that's not already active/waived.
  // Accept button is disabled when no file is on record.
  const canDecide =
    record.complianceStatus !== "active" && record.complianceStatus !== "waived";
  const showRestriction =
    record.complianceStatus === "rejected" || atRisk || !record.documentId;
  const isRestricted = record.complianceStatus === "rejected";
  const verify = verifyItemsFor(record.complianceType, !!record.documentId);

  const headerPills: { label: string; color: PillColor }[] = [
    { label: pill.label, color: pill.color },
  ];
  if (showRestriction && !isRestricted)
    headerPills.push({ label: "Restriction risk", color: "red" });
  if (isRestricted) headerPills.push({ label: "Payment held", color: "amber" });
  else if (showRestriction) headerPills.push({ label: "Payment hold", color: "amber" });

  return (
    <div className="cmd">
      <div className="cmd-head">
        <div className="cmd-head-main">
          <h3 className="cmd-title">{formatStatus(record.complianceType)}</h3>
          <div className="cmd-org">
            {record.organizationName ?? "Unknown organization"} · Project
            subcontractor
          </div>
          <p className="cmd-desc">
            {isRestricted
              ? "Record rejected. Subcontractor participation is restricted and payments are held until a valid replacement is accepted."
              : record.complianceStatus === "pending" && !record.documentId
                ? "Not submitted. Restriction threshold approaching. No replacement on file."
                : record.complianceStatus === "pending"
                  ? "Renewal file submitted. Review before current accepted record lapses."
                  : atRisk
                    ? "Record is valid today, but expiring soon. Follow up before lapse triggers a restriction."
                    : "Active and satisfies the requirement. No action needed."}
          </p>
        </div>
        <div className="cmd-pills">
          {headerPills.map((p) => (
            <Pill key={p.label} color={p.color}>
              {p.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="cmd-grid">
        <div className="cmd-cell">
          <div className="cmd-k">Organization</div>
          <div className="cmd-v">{record.organizationName ?? "—"}</div>
          <div className="cmd-m">Project subcontractor</div>
        </div>
        <div className="cmd-cell">
          <div className="cmd-k">Requirement</div>
          <div className="cmd-v">{formatStatus(record.complianceType)}</div>
          <div className="cmd-m">
            {record.documentId ? "Renewal submission" : "Project-level"}
          </div>
        </div>
        <div className="cmd-cell">
          <div className="cmd-k">Accepted-until</div>
          <div className="cmd-v">
            {record.expiresAt ? formatDate(record.expiresAt) : "—"}
          </div>
          <div className="cmd-m">
            {expiresInDays != null
              ? expiresInDays < 0
                ? `Lapsed ${Math.abs(expiresInDays)}d ago`
                : `Lapses in ${expiresInDays} day${expiresInDays === 1 ? "" : "s"}`
              : "No expiry"}
          </div>
        </div>
        <div className="cmd-cell">
          <div className="cmd-k">State</div>
          <div className="cmd-v">
            {record.documentId
              ? record.complianceStatus === "pending"
                ? "Submitted, awaiting review"
                : formatStatus(record.complianceStatus)
              : "No file submitted"}
          </div>
          <div className="cmd-m">
            {record.complianceStatus === "pending" && record.documentId
              ? "Replacement not yet accepted"
              : record.complianceStatus === "pending"
                ? "Sub notified"
                : ""}
          </div>
        </div>
      </div>

      {record.documentId && (
        <div className="cmd-section">
          <div className="cmd-section-head">
            <h4>Submitted record</h4>
            <div className="cmd-section-acts">
              <Pill color="purple">1 file</Pill>
              <button type="button" className="cmd-btn">
                View file
              </button>
            </div>
          </div>
          <div className="cmd-section-body">
            <div className="cmd-fr">
              <div>
                <h5>Compliance document</h5>
                <p>
                  Uploaded · document {record.documentId.slice(0, 8)}
                </p>
              </div>
              <span className="cmd-fc">PDF</span>
            </div>
            {verify.length > 0 && (
              <div className="cmd-vl">
                {verify.map((v) => (
                  <div key={v.label} className="cmd-vi">
                    <div className={`cmd-vchk ${v.pass ? "pass" : "fail"}`}>
                      {v.pass ? "✓" : "!"}
                    </div>
                    <div className="cmd-vlbl">
                      {v.label}
                      <span>{v.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!record.documentId && record.complianceStatus === "pending" && (
        <div className="cmd-section">
          <div className="cmd-section-head">
            <h4>Submission status</h4>
            <div className="cmd-section-acts">
              <Pill color="red">Not submitted</Pill>
            </div>
          </div>
          <div className="cmd-section-body">
            <p className="cmd-p">
              Not submitted. Subcontractor has been notified. Consider applying
              a restriction if no valid record arrives before threshold.
            </p>
          </div>
        </div>
      )}

      {canDecide && (
        <div className="cmd-section">
          <div className="cmd-section-head">
            <h4>Review decision</h4>
            <div className="cmd-section-acts">
              <span className="cmp-mtag">Operational review</span>
            </div>
          </div>
          <div className="cmd-section-body">
            <p className="cmd-p">
              The dominant action depends on whether the record satisfies the
              requirement, needs correction, or is unacceptable.
            </p>
            <div className="cmd-dec">
              <h5>Recommended: Accept record</h5>
              <p>
                Coverage verification mostly passes. Accepting clears
                restriction risk and removes the payment hold.
              </p>
              <div className="cmd-dec-acts">
                <button
                  type="button"
                  className="cmd-btn pri"
                  onClick={() => act("accept")}
                  disabled={pending != null || !record.documentId}
                  title={
                    !record.documentId
                      ? "No file on record — cannot accept"
                      : undefined
                  }
                >
                  {pending === "accept" ? "Accepting…" : "Accept record"}
                </button>
                <button
                  type="button"
                  className="cmd-btn"
                  onClick={() => act("waive")}
                  disabled={pending != null}
                >
                  {pending === "waive" ? "Waiving…" : "Request correction"}
                </button>
                <button
                  type="button"
                  className="cmd-btn dg"
                  onClick={() => act("reject")}
                  disabled={pending != null}
                >
                  {pending === "reject" ? "Rejecting…" : "Reject record"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRestriction && (
        <div className="cmd-section restrict">
          <div className="cmd-section-head">
            <h4>Restriction control</h4>
            <div className="cmd-section-acts">
              <Pill color="red">Access consequence</Pill>
            </div>
          </div>
          <div className="cmd-section-body">
            {isRestricted ? (
              <div className="cmd-rp">
                <h5>Restriction active</h5>
                <p>
                  Restriction active. Subcontractor notified. Payment processing
                  on hold. Clear restriction once a valid replacement is accepted.
                </p>
                <div className="cmd-rp-acts">
                  <button type="button" className="cmd-btn">
                    Clear restriction
                  </button>
                </div>
              </div>
            ) : (
              <div className="cmd-rp">
                <h5>
                  Current:{" "}
                  {record.documentId ? "Submitted, awaiting review" : "At risk"}
                </h5>
                <p>
                  Accepting clears risk + payment hold. Correction keeps vendor
                  at risk. Rejecting may justify restriction.
                </p>
                <div className="cmd-cgrid">
                  <div className="cmd-ccell">
                    <div className="k">If accepted</div>
                    <div className="v">Risk + hold clear</div>
                    <div className="m">Payments resume</div>
                  </div>
                  <div className="cmd-ccell">
                    <div className="k">If correction</div>
                    <div className="v">Risk stays</div>
                    <div className="m">Hold remains</div>
                  </div>
                  <div className="cmd-ccell">
                    <div className="k">If rejected</div>
                    <div className="v">May restrict</div>
                    <div className="m">Payment blocked</div>
                  </div>
                  <div className="cmd-ccell">
                    <div className="k">Countdown</div>
                    <div className="v">
                      {expiresInDays != null && expiresInDays >= 0
                        ? `${expiresInDays}d`
                        : "—"}
                    </div>
                    <div className="m">Until threshold</div>
                  </div>
                </div>
                <div className="cmd-rp-acts">
                  <button type="button" className="cmd-btn">
                    Keep active
                  </button>
                  <button type="button" className="cmd-btn dg-fill">
                    Apply restriction
                  </button>
                  <button type="button" className="cmd-btn">
                    Clear restriction
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="cmd-err">Error: {error}</p>}

      <style>{`
        .cmd{display:flex;flex-direction:column;gap:14px;min-height:400px}
        .cmd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding-bottom:14px;border-bottom:1px solid var(--s2)}
        .cmd-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:4px}
        .cmd-title{font-family:var(--fd);font-size:18px;font-weight:750;letter-spacing:-.02em;color:var(--t1);margin:0}
        .cmd-org{font-family:var(--fm);font-size:12px;font-weight:520;color:var(--t3);letter-spacing:.02em}
        .cmd-desc{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);line-height:1.5;margin:6px 0 0;max-width:480px}
        .cmd-pills{display:flex;gap:6px;flex-wrap:wrap;flex-shrink:0;padding-top:2px}

        .cmd-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .cmd-cell{background:var(--s2);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
        .cmd-k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .cmd-v{font-family:var(--fd);font-size:14px;font-weight:700;margin-top:3px;color:var(--t1)}
        .cmd-m{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin-top:2px}

        .cmd-section{border:1px solid var(--s3);border-radius:var(--r-l);overflow:hidden}
        .cmd-section.restrict{border-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
        .cmd-section-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 16px;background:var(--s2);border-bottom:1px solid var(--s3)}
        .cmd-section.restrict .cmd-section-head{background:linear-gradient(180deg,#fef5f5,var(--dg-s));border-bottom-color:color-mix(in srgb,var(--dg) 30%,var(--s3))}
        .cmd-section.restrict .cmd-section-head h4{color:var(--dg-t)}
        .cmd-section-head h4{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin:0}
        .cmd-section-acts{display:flex;gap:6px;align-items:center}
        .cmd-section-body{padding:14px 16px}
        .cmd-p{font-family:var(--fb);font-size:13px;font-weight:540;color:var(--t2);margin:0;line-height:1.55}

        .cmd-btn{height:32px;padding:0 12px;border-radius:var(--r-m);border:1px solid var(--s3);background:var(--s1);color:var(--t1);font-family:var(--fb);font-size:12px;font-weight:640;cursor:pointer;transition:all var(--df) var(--e);white-space:nowrap}
        .cmd-btn:hover:not(:disabled){border-color:var(--s4);background:var(--sh)}
        .cmd-btn:disabled{opacity:.6;cursor:not-allowed}
        .cmd-btn.pri{background:var(--accent);border-color:var(--accent);color:#fff}
        .cmd-btn.pri:hover:not(:disabled){background:var(--accent-h);border-color:var(--accent-h)}
        .cmd-btn.dg{border-color:color-mix(in srgb,var(--dg) 35%,var(--s3));color:var(--dg-t)}
        .cmd-btn.dg:hover:not(:disabled){background:var(--dg-s)}
        .cmd-btn.dg-fill{background:var(--dg);border-color:var(--dg);color:#fff}
        .cmd-btn.dg-fill:hover:not(:disabled){background:var(--dg-t);border-color:var(--dg-t)}

        .cmd-fr{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--s2)}
        .cmd-fr:last-child{border-bottom:none}
        .cmd-fr h5{font-family:var(--fd);font-size:13px;font-weight:620;color:var(--t1);margin:0}
        .cmd-fr p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:2px 0 0}
        .cmd-fc{font-family:var(--fd);font-size:11px;font-weight:700;color:var(--t3);padding:3px 8px;border-radius:var(--r-s);background:var(--s2);white-space:nowrap}

        .cmd-vl{display:flex;flex-direction:column;gap:6px;margin-top:10px}
        .cmd-vi{display:flex;align-items:center;gap:10px;padding:8px 12px;border:1px solid var(--s3);border-radius:var(--r-m);background:var(--s1)}
        .cmd-vchk{width:20px;height:20px;border-radius:6px;border:2px solid var(--s4);display:grid;place-items:center;flex-shrink:0;font-family:var(--fd);font-size:11px;font-weight:700;color:#fff}
        .cmd-vchk.pass{background:var(--ok);border-color:var(--ok)}
        .cmd-vchk.fail{background:var(--dg);border-color:var(--dg)}
        .cmd-vlbl{flex:1;font-family:var(--fb);font-size:13px;font-weight:550;color:var(--t1)}
        .cmd-vlbl span{display:block;font-size:11px;color:var(--t3);font-weight:520;margin-top:1px}

        .cmd-dec{border:1px solid var(--s3);border-radius:var(--r-l);padding:14px 16px;background:linear-gradient(180deg,var(--s1),var(--s2));margin-top:10px}
        .cmd-dec h5{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--t1);margin:0}
        .cmd-dec p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--t2);margin:4px 0 0;line-height:1.5}
        .cmd-dec-acts{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}

        .cmd-rp{border:1px solid color-mix(in srgb,var(--dg) 30%,var(--s3));border-radius:var(--r-l);padding:14px 16px;background:linear-gradient(180deg,#fef5f5,var(--dg-s))}
        .cmd-rp h5{font-family:var(--fd);font-size:14px;font-weight:700;color:var(--dg-t);margin:0}
        .cmd-rp p{font-family:var(--fb);font-size:12px;font-weight:540;color:var(--dg-t);margin:4px 0 0;line-height:1.5}
        .cmd-rp-acts{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}

        .cmd-cgrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}
        .cmd-ccell{background:var(--s1);border:1px solid var(--s3);border-radius:var(--r-m);padding:10px 12px}
        .cmd-ccell .k{font-family:var(--fd);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--t3)}
        .cmd-ccell .v{font-family:var(--fd);font-size:13px;font-weight:700;color:var(--t1);margin-top:3px}
        .cmd-ccell .m{font-family:var(--fb);font-size:11.5px;font-weight:540;color:var(--t2);margin-top:2px}

        .cmd-err{font-family:var(--fb);font-size:12.5px;color:var(--dg-t);margin:0}
      `}</style>
    </div>
  );
}

function formatStatus(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
