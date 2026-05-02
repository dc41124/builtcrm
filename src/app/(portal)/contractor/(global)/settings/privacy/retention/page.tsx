import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { getContractorOrgContext } from "@/domain/loaders/integrations";
import { loadRetentionAdminView } from "@/domain/loaders/retention";
import { AuthorizationError } from "@/domain/permissions";

// Step 66.5 — Retention admin surface.
//
// Read-only today (Option C scope):
//   - Tier table (source of truth from src/lib/retention/tiers.ts)
//   - Active per-table purge jobs with pending-deletion + legal-hold counts
//   - Recent sweep activity (last 14 days from audit_events)
//
// Self-serve legal-hold management + tier overrides ship in Step 66.6.
// Contractor-admin gated; subs/clients cannot reach this route.

export const dynamic = "force-dynamic";

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

const PURPLE = "#5b4fc7";

export default async function RetentionAdminPage() {
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");

  try {
    const ctx = await getContractorOrgContext(sessionData.session);
    if (ctx.role !== "contractor_admin") {
      return (
        <div style={{ padding: 24, fontFamily: F.body }}>
          <pre>Forbidden: contractor admin role required.</pre>
        </div>
      );
    }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (err.code === "unauthenticated") redirect("/login");
      return (
        <div style={{ padding: 24, fontFamily: F.body }}>
          <pre>Forbidden: {err.message}</pre>
        </div>
      );
    }
    throw err;
  }

  const view = await loadRetentionAdminView();

  return (
    <div
      style={{
        padding: "32px 40px",
        maxWidth: 1240,
        margin: "0 auto",
        fontFamily: F.body,
        color: "#171717",
      }}
    >
      <header style={{ marginBottom: 32 }}>
        <div
          style={{
            fontFamily: F.body,
            fontSize: 13,
            fontWeight: 540,
            color: "#737373",
            letterSpacing: 0.4,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Privacy &middot; Retention
        </div>
        <h1
          style={{
            fontFamily: F.display,
            fontSize: 26,
            fontWeight: 820,
            margin: 0,
            letterSpacing: -0.3,
          }}
        >
          Data retention and deletion
        </h1>
        <p
          style={{
            fontFamily: F.body,
            fontSize: 15,
            fontWeight: 540,
            color: "#525252",
            marginTop: 10,
            maxWidth: 760,
            lineHeight: 1.55,
          }}
        >
          Every table holding sensitive data is classified into a retention
          tier. Statutory tiers (CRA 6yr, ON/QC 7yr) cannot be shortened.
          Operational data is purged on a daily schedule; rows under legal
          hold are preserved regardless of age.
        </p>
      </header>

      <Section title="Retention tiers">
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: F.body,
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "#525252", fontWeight: 620 }}>
              <th style={th}>Tier</th>
              <th style={th}>Floor</th>
              <th style={th}>Configurable</th>
              <th style={th}>Rationale</th>
            </tr>
          </thead>
          <tbody>
            {view.tiers.map((row) => (
              <tr
                key={row.tier}
                style={{ borderTop: "1px solid #e5e5e5", verticalAlign: "top" }}
              >
                <td style={tdLabel}>
                  <span style={{ fontFamily: F.display, fontWeight: 680 }}>
                    {row.label}
                  </span>
                  <div
                    style={{
                      fontFamily: F.mono,
                      fontSize: 11,
                      fontWeight: 540,
                      color: "#737373",
                      marginTop: 4,
                    }}
                  >
                    {row.tier}
                  </div>
                </td>
                <td style={td}>{row.floorDescription}</td>
                <td style={td}>
                  <Pill on={row.configurable}>
                    {row.configurable ? "Yes" : "No"}
                  </Pill>
                </td>
                <td style={{ ...td, color: "#525252", lineHeight: 1.5 }}>
                  {row.rationale}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Active purge jobs">
        <p
          style={{
            fontSize: 14,
            color: "#525252",
            marginTop: 0,
            marginBottom: 16,
            lineHeight: 1.55,
          }}
        >
          The 6 jobs below are the only scheduled deletion paths in the system
          today. Each respects the {" "}
          <code style={codeStyle}>legal_hold</code> column on its target table.
          Statutory and design-archive tiers have no scheduled deletion until
          Step 66.6 ships the unified retention sweep.
        </p>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: F.body,
            fontSize: 14,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "#525252", fontWeight: 620 }}>
              <th style={th}>Job</th>
              <th style={th}>Target table</th>
              <th style={th}>Tier</th>
              <th style={th}>Window</th>
              <th style={{ ...th, textAlign: "right" }}>Eligible on next sweep</th>
              <th style={{ ...th, textAlign: "right" }}>Under legal hold</th>
            </tr>
          </thead>
          <tbody>
            {view.jobs.map((job) => (
              <tr key={job.jobId} style={{ borderTop: "1px solid #e5e5e5" }}>
                <td style={tdLabel}>
                  <span style={{ fontFamily: F.mono, fontWeight: 540 }}>
                    {job.jobId}
                  </span>
                </td>
                <td style={{ ...td, fontFamily: F.mono }}>{job.tableName}</td>
                <td style={{ ...td, fontFamily: F.mono, fontSize: 12, color: "#737373" }}>
                  {job.tier}
                </td>
                <td style={td}>
                  {job.retentionDays > 0 ? `${job.retentionDays} days` : "Per row"}
                </td>
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    fontFamily: F.display,
                    fontWeight: 740,
                    color: job.eligibleNow > 0 ? "#171717" : "#a3a3a3",
                  }}
                >
                  {job.eligibleNow.toLocaleString()}
                </td>
                <td
                  style={{
                    ...td,
                    textAlign: "right",
                    fontFamily: F.display,
                    fontWeight: 740,
                    color: job.underLegalHold > 0 ? PURPLE : "#a3a3a3",
                  }}
                >
                  {job.underLegalHold.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Recent sweep activity">
        {view.recentSweeps.length === 0 ? (
          <div
            style={{
              padding: "20px 16px",
              border: "1px dashed #d4d4d4",
              borderRadius: 8,
              color: "#737373",
              fontSize: 14,
            }}
          >
            No sweep activity in the last 14 days.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: F.body,
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ textAlign: "left", color: "#525252", fontWeight: 620 }}>
                <th style={th}>Job</th>
                <th style={th}>Ran at</th>
                <th style={{ ...th, textAlign: "right" }}>Rows deleted</th>
              </tr>
            </thead>
            <tbody>
              {view.recentSweeps.map((row, idx) => (
                <tr key={`${row.jobId}-${idx}`} style={{ borderTop: "1px solid #e5e5e5" }}>
                  <td style={{ ...tdLabel, fontFamily: F.mono, fontSize: 13 }}>
                    {row.jobId}
                  </td>
                  <td style={{ ...td, fontFamily: F.mono, fontSize: 13 }}>
                    {row.ranAt.toLocaleString()}
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: "right",
                      fontFamily: F.display,
                      fontWeight: 740,
                    }}
                  >
                    {row.deletedCount?.toLocaleString() ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Coming in Step 66.6">
        <ul style={{ marginTop: 0, paddingLeft: 20, lineHeight: 1.7, color: "#525252" }}>
          <li>
            Unified retention sweep across statutory, project-record,
            design-archive, and privacy-fulfillment tiers
          </li>
          <li>
            Project-closeout backfill: when a project is marked closed, child
            rows get their <code style={codeStyle}>retention_until</code>{" "}
            populated automatically
          </li>
          <li>
            Self-serve legal-hold management — set or release holds by
            project, table, or organization
          </li>
          <li>
            Per-org operational tier override (shorten 90 days down to a
            30-day floor)
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2
        style={{
          fontFamily: F.display,
          fontSize: 18,
          fontWeight: 740,
          margin: "0 0 14px 0",
          letterSpacing: -0.1,
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Pill({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 999,
        fontFamily: F.body,
        fontSize: 11,
        fontWeight: 700,
        background: on ? "#ecfdf5" : "#f5f5f5",
        color: on ? "#047857" : "#525252",
        letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}

const th: React.CSSProperties = {
  padding: "10px 12px",
  fontFamily: F.body,
  fontSize: 12,
  fontWeight: 620,
  color: "#525252",
  letterSpacing: 0.3,
  textTransform: "uppercase",
};

const td: React.CSSProperties = {
  padding: "12px",
  fontFamily: F.body,
  fontSize: 14,
  fontWeight: 540,
  color: "#171717",
};

const tdLabel: React.CSSProperties = {
  ...td,
  fontWeight: 620,
};

const codeStyle: React.CSSProperties = {
  fontFamily: F.mono,
  fontSize: 12,
  background: "#f5f5f5",
  padding: "2px 6px",
  borderRadius: 4,
};
