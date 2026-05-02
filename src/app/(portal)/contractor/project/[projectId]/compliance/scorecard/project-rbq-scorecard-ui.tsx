"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type { ProjectRbqScorecardView, ScorecardRow } from "@/domain/loaders/project-rbq-scorecard";

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};
const PURPLE = "#5b4fc7";

type Tone = ScorecardRow["rbqState"];

const TONE_COLOR: Record<Tone, { bg: string; color: string; label: string }> = {
  valid: { bg: "#edf7f1", color: "#1e6b46", label: "Valid" },
  expiring: { bg: "#fdf4e6", color: "#96600f", label: "Expiring" },
  expired: { bg: "#fdeaea", color: "#a52e2e", label: "Expired" },
  suspended: { bg: "#fdeaea", color: "#a52e2e", label: "Suspended" },
  not_found: { bg: "#fdeaea", color: "#a52e2e", label: "Not found" },
  muted: { bg: "#f3f4f6", color: "#6b655b", label: "Not tracked" },
};

function isProblemTone(t: Tone): boolean {
  return t === "expired" || t === "expiring" || t === "not_found" || t === "suspended";
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
      const res = await fetch("/api/contractor/rbq/refresh-all", { method: "POST" });
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
    <div style={{ padding: "32px 40px", maxWidth: 1320, margin: "0 auto", fontFamily: F.body, color: "#171717" }}>
      <header style={{ marginBottom: 18 }}>
        <Link
          href={`/contractor/project/${view.project.id}/compliance`}
          style={{ fontSize: 13, color: "#525252", textDecoration: "none" }}
        >
          ← Compliance records
        </Link>
      </header>

      {/* Project banner */}
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: "18px 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div>
          <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 760, letterSpacing: "-0.015em" }}>
            {view.project.name}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "#525252",
              marginTop: 4,
              display: "flex",
              gap: 14,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {view.project.city && <span>{view.project.city}</span>}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontFamily: F.mono,
                fontSize: 11.5,
                color: view.isQuebecProject ? "#276299" : "#9c958a",
              }}
            >
              {view.project.provinceCode ?? "Province not set"}
              {view.isQuebecProject && " · QC project"}
            </span>
            <span>{view.rows.length} non-contractor org{view.rows.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#f3f4f6",
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #e2e5e9",
            }}
          >
            <span style={{ fontFamily: F.display, fontSize: 12.5, fontWeight: 600, color: "#525252" }}>
              Show only issues
            </span>
            <button
              onClick={() => setShowOnlyIssues(!showOnlyIssues)}
              aria-pressed={showOnlyIssues}
              style={{
                position: "relative",
                width: 36,
                height: 20,
                borderRadius: 999,
                background: showOnlyIssues ? PURPLE : "#d1d5db",
                cursor: "pointer",
                transition: "background 120ms",
                border: "none",
                padding: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: showOnlyIssues ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 2px rgba(0,0,0,.2)",
                  transition: "left 120ms",
                }}
              />
            </button>
          </div>
          {isAdmin && view.isQuebecProject && (
            <button
              onClick={bulkRefresh}
              disabled={bulkRefreshing || pending}
              style={btn("secondary", "sm")}
            >
              {bulkRefreshing ? "Refreshing…" : "Refresh all RBQ"}
            </button>
          )}
        </div>
      </div>

      {!view.isQuebecProject && (
        <div
          style={{
            marginBottom: 18,
            padding: "14px 16px",
            background: "#e8f1fa",
            border: "1px solid #cfe1f3",
            borderRadius: 10,
            fontSize: 13,
            color: "#276299",
            lineHeight: 1.55,
          }}
        >
          <strong>Province not set to Quebec.</strong> The RBQ column shows
          &quot;Not tracked&quot; for every sub. Set the project&apos;s province to Quebec
          in project settings to enable RBQ verification.
        </div>
      )}

      {error && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            background: "#fdeaea",
            border: "1px solid #f0bcbc",
            borderRadius: 8,
            color: "#a52e2e",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      <h2 style={{ fontFamily: F.display, fontSize: 18, fontWeight: 740, margin: "0 0 12px 0", letterSpacing: "-0.018em" }}>
        Sub compliance scorecard
      </h2>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: F.body }}>
          <thead>
            <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
              <Th>Subcontractor</Th>
              <Th>Trade</Th>
              <Th align="center">RBQ</Th>
              <Th align="center">Insurance</Th>
              <Th align="center">CNESST</Th>
              <Th align="center">CCQ</Th>
              <Th align="right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div style={{ padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 680, color: "#171717", marginBottom: 5 }}>
                      {view.rows.length === 0
                        ? "No non-contractor orgs on this project yet"
                        : "No compliance issues"}
                    </div>
                    <div style={{ fontSize: 13, color: "#525252", maxWidth: 360, margin: "0 auto" }}>
                      {view.rows.length === 0
                        ? "Once subs and clients are added to the project, their compliance posture appears here."
                        : "Every active sub on this project is clear across the tracked compliance signals."}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.orgId} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "#eeedfb",
                          color: "#4a3fb0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontFamily: F.display,
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {row.orgName.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 600 }}>{row.orgName}</span>
                        {row.legalName && row.legalName !== row.orgName && (
                          <span style={{ fontSize: 11.5, color: "#9c958a", marginTop: 1 }}>
                            {row.legalName}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ ...td, color: "#525252", fontSize: 12.5 }}>
                    {row.primaryTrade ?? <span style={{ color: "#9c958a" }}>—</span>}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}>
                    <ScorecardPill tone={row.rbqState} />
                    {row.rbqExpiry && (
                      <div style={{ fontFamily: F.mono, fontSize: 11, color: "#9c958a", marginTop: 4 }}>
                        exp {row.rbqExpiry}
                      </div>
                    )}
                  </td>
                  <td style={{ ...td, textAlign: "center" }}><ScorecardPill tone={row.insuranceState} /></td>
                  <td style={{ ...td, textAlign: "center" }}><ScorecardPill tone={row.cnesstState} /></td>
                  <td style={{ ...td, textAlign: "center" }}><ScorecardPill tone={row.ccqState} /></td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <Link
                      href={`/contractor/subcontractors/${row.orgId}`}
                      style={{
                        fontFamily: F.display,
                        fontSize: 12,
                        fontWeight: 620,
                        color: "#525252",
                        textDecoration: "none",
                      }}
                    >
                      View profile →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "12px 16px",
          background: "#f3f4f6",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          marginTop: 14,
          fontSize: 12,
          color: "#525252",
        }}
      >
        <span
          style={{
            fontFamily: F.display,
            fontWeight: 700,
            fontSize: 11.5,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "#9c958a",
          }}
        >
          Legend
        </span>
        <LegendDot tone="valid" /> Valid
        <LegendDot tone="expiring" /> Expiring within 30 days
        <LegendDot tone="expired" /> Expired or not found
        <LegendDot tone="muted" /> Not tracked yet
        <span style={{ marginLeft: "auto", color: "#9c958a", fontSize: 11.5 }}>
          RBQ data sourced from RBQ Open Data feed · Insurance / CNESST / CCQ
          columns wire up in their own modules.
        </span>
      </div>
    </div>
  );
}

function ScorecardPill({ tone }: { tone: Tone }) {
  const c = TONE_COLOR[tone];
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: F.display,
        fontSize: 10.5,
        fontWeight: 700,
        padding: "3px 9px",
        borderRadius: 999,
        background: c.bg,
        color: c.color,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
      }}
    >
      {c.label}
    </span>
  );
}

function LegendDot({ tone }: { tone: Tone }) {
  const dotColor =
    tone === "valid"
      ? "#2d8a5e"
      : tone === "expiring"
        ? "#c17a1a"
        : tone === "expired"
          ? "#c93b3b"
          : "#9c958a";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: dotColor,
        }}
      />
    </span>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" | "center" }) {
  return (
    <th
      style={{
        fontFamily: F.display,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "#737373",
        padding: "10px 16px",
        textAlign: align ?? "left",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      {children}
    </th>
  );
}

const td: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 13,
  color: "#171717",
  verticalAlign: "middle",
};

function btn(kind: "primary" | "secondary" | "ghost", size?: "sm"): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: F.display,
    fontSize: size === "sm" ? 12 : 13,
    fontWeight: 620,
    padding: size === "sm" ? "5px 10px" : "7px 14px",
    borderRadius: 6,
    cursor: "pointer",
    border: "1px solid transparent",
  };
  if (kind === "primary") return { ...base, background: PURPLE, color: "#fff" };
  if (kind === "secondary") return { ...base, background: "#f3f4f6", color: "#171717", borderColor: "#e2e5e9" };
  return { ...base, background: "transparent", color: "#525252" };
}
