"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { I } from "@/components/rbq/icons";
import type {
  ProjectRbqScorecardView,
  ScorecardRow,
} from "@/domain/loaders/project-rbq-scorecard";

import "../../../../rbq.css";

// Step 66 — Project compliance scorecard (View 03 of the prototype).
// HTML structure + class names match the prototype 1:1; styling lives
// in rbq.css.

type Tone = ScorecardRow["rbqState"];

const RBQ_LABEL: Record<Tone, string> = {
  valid: "RBQ valid",
  expiring: "Expiring soon",
  expired: "License expired",
  suspended: "Suspended",
  not_found: "Not found",
  muted: "Not tracked",
};

const RBQ_TONE_CLASS: Record<Tone, "ok" | "warn" | "danger" | "muted"> = {
  valid: "ok",
  expiring: "warn",
  expired: "danger",
  suspended: "danger",
  not_found: "danger",
  muted: "muted",
};

function isProblemTone(t: Tone): boolean {
  return (
    t === "expired" ||
    t === "expiring" ||
    t === "not_found" ||
    t === "suspended"
  );
}

export function ProjectRbqScorecardUI({
  view,
  isAdmin,
}: {
  view: ProjectRbqScorecardView;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);
  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredRows = useMemo(() => {
    if (!showOnlyIssues) return view.rows;
    return view.rows.filter(
      (r) =>
        isProblemTone(r.rbqState) ||
        isProblemTone(r.insuranceState) ||
        isProblemTone(r.cnesstState) ||
        isProblemTone(r.ccqState),
    );
  }, [view.rows, showOnlyIssues]);

  async function bulkRefresh() {
    setError(null);
    setBulkRefreshing(true);
    try {
      const res = await fetch("/api/contractor/rbq/refresh-all", {
        method: "POST",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.message ?? "Bulk refresh failed.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error.");
    } finally {
      setBulkRefreshing(false);
    }
  }

  return (
    <div className="rbq-page">
      <div className="content">
        <div className="pg-bc">
          <Link
            href={`/contractor/project/${view.project.id}/compliance`}
            className="lk"
          >
            Compliance records
          </Link>
          <span className="sep">/</span>
          <span className="cur">Sub scorecard</span>
        </div>

        {/* Project banner */}
        <div className="proj-banner">
          <div className="info">
            <div className="ti">
              {I.bldg}
              {view.project.name}
            </div>
            <div className="meta">
              {view.project.city && (
                <span>{I.pin}{view.project.city}</span>
              )}
              {view.isQuebecProject ? (
                <span>
                  {I.qcFlag}
                  <span style={{ marginLeft: 1 }}>Quebec project</span>
                </span>
              ) : (
                <span style={{ color: "var(--t3)" }}>
                  Province: {view.project.provinceCode ?? "not set"}
                </span>
              )}
              <span>
                {I.users}
                {view.rows.length} active sub{view.rows.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="acts">
            <div className="toggle-row">
              <span className="lbl">Show only issues</span>
              <button
                type="button"
                className={`tog ${showOnlyIssues ? "on" : ""}`}
                onClick={() => setShowOnlyIssues(!showOnlyIssues)}
                aria-pressed={showOnlyIssues}
                aria-label="Show only issues"
              />
            </div>
            {isAdmin && view.isQuebecProject && (
              <button
                className="btn sec sm"
                onClick={bulkRefresh}
                disabled={bulkRefreshing || pending}
              >
                <span className={bulkRefreshing ? "spin" : ""}>{I.refresh}</span>
                {bulkRefreshing ? "Refreshing…" : "Refresh all RBQ"}
              </button>
            )}
            <button className="btn pr sm" disabled>
              {I.download} Export compliance pack
            </button>
          </div>
        </div>

        {!view.isQuebecProject && (
          <div className="note">
            <div className="ic">{I.info}</div>
            <div className="body">
              <strong>Province not set to Quebec.</strong> The RBQ column
              shows <em>Not tracked</em> for every sub. Set the project&apos;s
              province to Quebec in project settings to enable RBQ
              verification. Other compliance signals (Insurance, CNESST, CCQ)
              wire up in their own modules.
            </div>
          </div>
        )}

        {error && (
          <div className="note" style={{ background: "var(--dg-s)", borderColor: "var(--dg-m)" }}>
            <div className="ic" style={{ color: "var(--dg-t)" }}>{I.warn}</div>
            <div className="body" style={{ color: "var(--dg-t)" }}>{error}</div>
          </div>
        )}

        <h2 className="h2" style={{ marginBottom: 12 }}>
          Sub compliance scorecard
        </h2>

        <div className="card">
          <div className="card-b np">
            <table className="tbl compl-tbl">
              <thead>
                <tr>
                  <th>Subcontractor</th>
                  <th>Trade</th>
                  <th className="center">RBQ</th>
                  <th className="center">Insurance</th>
                  <th className="center">CNESST</th>
                  <th className="center">CCQ</th>
                  <th className="right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty">
                        <div className="ic">{I.check}</div>
                        <div className="ti">
                          {view.rows.length === 0
                            ? "No non-contractor orgs on this project yet"
                            : "No compliance issues"}
                        </div>
                        <div className="desc">
                          {view.rows.length === 0
                            ? "Once subs and clients are added to the project, their compliance posture appears here."
                            : "Every active sub on this project is clear across the tracked compliance signals."}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const initials = row.orgName
                      .split(/\s+/)
                      .map((w) => w.charAt(0))
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();
                    return (
                      <tr key={row.orgId}>
                        <td>
                          <div className="who-cell">
                            <div className="compl-avt">{initials}</div>
                            <div className="who">
                              <span className="name">{row.orgName}</span>
                              {row.legalName && row.legalName !== row.orgName && (
                                <span className="em">{row.legalName}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: "var(--t2)", fontSize: 12.5 }}>
                          {row.primaryTrade ?? (
                            <span style={{ color: "var(--t3)" }}>—</span>
                          )}
                        </td>
                        <td className="center">
                          <div className="badge-stack">
                            <span className={`pill ${RBQ_TONE_CLASS[row.rbqState]}`}>
                              {row.rbqState === "valid" && I.check}
                              {row.rbqState === "expiring" && I.clock}
                              {row.rbqState === "expired" && I.x}
                              {row.rbqState === "suspended" && I.x}
                              {row.rbqState === "not_found" && I.warn}
                              {RBQ_LABEL[row.rbqState]}
                            </span>
                            {row.rbqExpiry && (
                              <span className="expiry">exp {row.rbqExpiry}</span>
                            )}
                          </div>
                        </td>
                        <td className="center">
                          <span className={`pill ${RBQ_TONE_CLASS[row.insuranceState]}`}>
                            {RBQ_LABEL[row.insuranceState]}
                          </span>
                        </td>
                        <td className="center">
                          <span className={`pill ${RBQ_TONE_CLASS[row.cnesstState]}`}>
                            {RBQ_LABEL[row.cnesstState]}
                          </span>
                        </td>
                        <td className="center">
                          <span className={`pill ${RBQ_TONE_CLASS[row.ccqState]}`}>
                            {RBQ_LABEL[row.ccqState]}
                          </span>
                        </td>
                        <td className="right">
                          <Link
                            className="btn gh sm"
                            href={`/contractor/subcontractors/${row.orgId}`}
                            style={{ textDecoration: "none" }}
                          >
                            View profile {I.chevR}
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="legend">
          <span
            style={{
              fontFamily: "var(--fd)",
              fontWeight: 700,
              fontSize: 11.5,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--t3)",
            }}
          >
            Legend
          </span>
          <span className="legend-item">
            <span className="legend-dot ok" />
            Valid
          </span>
          <span className="legend-item">
            <span className="legend-dot warn" />
            Expiring within 30 days
          </span>
          <span className="legend-item">
            <span className="legend-dot danger" />
            Expired or not found
          </span>
          <span className="legend-item">
            <span className="legend-dot muted" />
            Not tracked yet
          </span>
          <span
            style={{
              marginLeft: "auto",
              color: "var(--t3)",
              fontSize: 11.5,
            }}
          >
            RBQ data sourced from RBQ Open Data feed · Insurance / CNESST /
            CCQ wire up in their own modules.
          </span>
        </div>
      </div>
    </div>
  );
}
