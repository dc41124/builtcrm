"use client";

import Link from "next/link";
import { useState } from "react";

import {
  FormTypeBadge,
  Icon,
  SeverityPill,
  StatusPill,
  SAFETY_FORM_TYPE_CONFIG,
  type SafetyFormType,
} from "@/app/(portal)/safety-forms-shared";
import type { SafetyFormsWorkspaceView } from "@/domain/loaders/safety-forms";

const TYPE_KEYS: SafetyFormType[] = ["toolbox_talk", "jha", "incident_report", "near_miss"];

export function SafetyFormsWorkspace({ view }: { view: SafetyFormsWorkspaceView }) {
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "draft">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | SafetyFormType>("all");
  const [search, setSearch] = useState("");

  const filtered = view.rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (typeFilter !== "all" && r.formType !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${r.formNumber} ${r.title} ${r.submittedByUserName} ${r.submittedByOrgName}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="sf-content">
      <div className="sf-page-hdr">
        <div>
          <h1 className="sf-page-title">Safety Forms</h1>
          <p className="sf-page-sub">
            Toolbox talks, JHAs, and incident reports submitted by your crews. Mobile-first,
            offline-capable, automatically routed to admins on incident.
          </p>
        </div>
        <div className="sf-page-actions">
          <button
            className="sf-btn"
            onClick={() => alert("PDF export — coming next")}
            type="button"
          >
            {Icon.download} Export history
          </button>
          <Link href="/contractor/settings/safety-templates" className="sf-btn">
            {Icon.clipboard} Templates
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <div className="sf-kpi-strip">
        <div className="sf-kpi">
          <div className="sf-kpi-label">Total submitted</div>
          <div className="sf-kpi-row">
            <span className="sf-kpi-val">{view.kpis.total}</span>
            <span className="sf-kpi-sub">last 7 days</span>
          </div>
        </div>
        <div className="sf-kpi">
          <div className="sf-kpi-label">Toolbox talks</div>
          <div className="sf-kpi-row">
            <span className="sf-kpi-val">{view.kpis.toolboxTalks}</span>
            <span className="sf-kpi-sub">crew sign-ins</span>
          </div>
        </div>
        <div className="sf-kpi alert">
          <div className="sf-kpi-label">Incidents</div>
          <div className="sf-kpi-row">
            <span className="sf-kpi-val">{view.kpis.incidents}</span>
            <span className="sf-kpi-sub">first aid · 0 lost time</span>
          </div>
        </div>
        <div className="sf-kpi warn">
          <div className="sf-kpi-label">Near misses</div>
          <div className="sf-kpi-row">
            <span className="sf-kpi-val">{view.kpis.nearMisses}</span>
            <span className="sf-kpi-sub">close calls</span>
          </div>
        </div>
        <div className="sf-kpi">
          <div className="sf-kpi-label">Open / queued</div>
          <div className="sf-kpi-row">
            <span className="sf-kpi-val">{view.kpis.openOrQueued}</span>
            <span className="sf-kpi-sub">{view.kpis.openOrQueued > 0 ? "drafts" : "all clear"}</span>
          </div>
        </div>
      </div>

      <div className="sf-grid">
        <div>
          {/* Filter bar */}
          <div className="sf-filter-bar">
            <div className="sf-search">
              {Icon.search}
              <input
                placeholder="Search by ID, title, person, or org…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="sf-pill-group">
              {[
                { k: "all" as const, label: "All" },
                { k: "submitted" as const, label: "Submitted" },
                { k: "draft" as const, label: "Drafts" },
              ].map((p) => (
                <button
                  key={p.k}
                  className={statusFilter === p.k ? "active" : ""}
                  onClick={() => setStatusFilter(p.k)}
                  type="button"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="sf-pill-group">
              <button
                className={typeFilter === "all" ? "active" : ""}
                onClick={() => setTypeFilter("all")}
                type="button"
              >
                All types
              </button>
              {TYPE_KEYS.map((key) => {
                const cfg = SAFETY_FORM_TYPE_CONFIG[key];
                return (
                  <button
                    key={key}
                    className={typeFilter === key ? "active" : ""}
                    onClick={() => setTypeFilter(typeFilter === key ? "all" : key)}
                    type="button"
                  >
                    {cfg.short}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submissions table */}
          <div className="sf-table-wrap">
            <table className="sf-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Submission</th>
                  <th>Type</th>
                  <th>Submitted by</th>
                  <th>When</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        padding: "30px 14px",
                        color: "var(--text-tertiary)",
                        fontSize: 13,
                      }}
                    >
                      No submissions match your filters.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => (
                  <tr key={r.id} onClick={() => (window.location.href = `/contractor/project/${view.projectId}/safety-forms/${r.id}`)}>
                    <td>
                      <span className="sf-table-num">{r.formNumber}</span>
                    </td>
                    <td>
                      <div className="sf-table-title">{r.title}</div>
                      <div className="sf-table-meta">
                        {r.flagged && (
                          <span style={{ color: "var(--er)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                            {Icon.flag} flagged
                          </span>
                        )}
                        <span className="sf-table-icons">
                          {r.hasPhoto && (
                            <span>
                              {Icon.camera} photo
                            </span>
                          )}
                          {r.hasSignature && (
                            <span>
                              {Icon.pen} signed
                            </span>
                          )}
                          {r.attendeesCount > 0 && (
                            <span>
                              {Icon.users} {r.attendeesCount}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td>
                      <FormTypeBadge type={r.formType} size="sm" />
                      {r.severity && (
                        <div style={{ marginTop: 4 }}>
                          <SeverityPill severity={r.severity} size="sm" />
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 660, fontSize: 12.5 }}>
                        {r.submittedByUserName}
                      </div>
                      <div style={{ color: "var(--text-tertiary)", fontSize: 11.5, marginTop: 2 }}>
                        {r.submittedByOrgName}
                      </div>
                    </td>
                    <td
                      style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 11.5,
                        color: "var(--text-secondary)",
                      }}
                    >
                      {r.submittedAt
                        ? r.submittedAt.toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td>
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right rail */}
        <aside className="sf-rail">
          <div className="sf-rail-card">
            <h4>By form type · last 7 days</h4>
            {view.typeSummary.map((t) => {
              const cfg = SAFETY_FORM_TYPE_CONFIG[t.type];
              return (
                <div key={t.type} className="sf-rail-typeRow">
                  <span className="sf-rail-typeNum">
                    <span className="sf-type-dot" style={{ background: cfg.solid, width: 8, height: 8 }} />
                    {cfg.label}
                  </span>
                  <div className="sf-rail-typeBars">
                    {Array.from({ length: 7 }).map((_, i) => (
                      <span
                        key={i}
                        className="sf-rail-bar"
                        style={{ background: i < t.last7d ? cfg.solid : "var(--surface-3)" }}
                      />
                    ))}
                  </div>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono',monospace",
                      fontSize: 11.5,
                      color: "var(--text-tertiary)",
                      minWidth: 18,
                      textAlign: "right",
                    }}
                  >
                    {t.submitted}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="sf-rail-card">
            <h4>Compliance posture</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div className="sf-rail-typeRow">
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>OSHA recordable rate</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, color: "var(--ok)", fontSize: 13 }}>
                  0.00
                </span>
              </div>
              <div className="sf-rail-typeRow">
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Days without lost time</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>
                  184
                </span>
              </div>
              <div className="sf-rail-typeRow">
                <span style={{ fontSize: 12.5, color: "var(--text-secondary)" }}>Toolbox talk completion</span>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, color: "var(--ok)", fontSize: 13 }}>
                  96%
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
