"use client";

// Step 65 Sessions B+C — Privacy Officer admin UI.
//
// Direct port of View 01 of `builtcrm_privacy_officer_law25_paired.jsx`.
// Three tabs:
//   - DSAR queue (Session B)
//   - Consent register (Session C)
//   - Breach register (Session C)
//
// Contractor admins can:
//   - Designate or change the Privacy Officer
//   - Triage DSAR rows (drawer with assign / status / notes / project)
//   - Browse the consent register (read-only — toggles live in the
//     end-user manager; admins look but don't impersonate)
//   - Log new breaches, classify severity, update notify decision,
//     stamp CAI flag (informational), generate per-subject draft emails
//
// Mutations:
//   PUT   /api/contractor/privacy/officer
//   PATCH /api/contractor/privacy/dsar/[id]
//   POST  /api/contractor/privacy/breach
//   PATCH /api/contractor/privacy/breach/[id]
//   POST  /api/contractor/privacy/breach/[id]/drafts

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  BreachRegisterRow,
  DsarRequestRow,
  PrivacyAdminView,
  PrivacyOfficerCandidate,
} from "@/domain/loaders/privacy";
import type { ConsentRegisterRow } from "@/domain/privacy/consents";
import { CONSENT_CATALOG } from "@/lib/privacy/consent-catalog";

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

type StatusFilter = "all" | "received" | "in_progress" | "completed" | "rejected";
type TypeFilter = "all" | "access" | "deletion" | "rectification" | "portability";
type AdminTab = "dsar" | "consents" | "breaches";

const REQUEST_TYPE_LABEL = {
  access: "Access",
  deletion: "Deletion",
  rectification: "Rectification",
  portability: "Portability",
} as const;

const STATUS_LABEL = {
  received: "Received",
  in_progress: "In progress",
  completed: "Completed",
  rejected: "Rejected",
} as const;

export function PrivacyAdminUI({
  view,
  currentUserId,
}: {
  view: PrivacyAdminView;
  currentUserId: string;
}) {
  const router = useRouter();
  const [adminTab, setAdminTab] = useState<AdminTab>("dsar");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [openDsar, setOpenDsar] = useState<DsarRequestRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openBreach, setOpenBreach] = useState<BreachRegisterRow | null>(null);
  const [logBreachOpen, setLogBreachOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dsarsFiltered = useMemo(
    () =>
      view.dsars.filter((d) => {
        if (statusFilter !== "all" && d.status !== statusFilter) return false;
        if (typeFilter !== "all" && d.requestType !== typeFilter) return false;
        return true;
      }),
    [view.dsars, statusFilter, typeFilter],
  );

  const openCount = view.dsars.filter(
    (d) => d.status === "received" || d.status === "in_progress",
  ).length;
  const urgentCount = view.dsars.filter(
    (d) =>
      (d.status === "received" || d.status === "in_progress") &&
      d.daysRemaining <= 7,
  ).length;
  const completedCount = view.dsars.filter((d) => d.status === "completed").length;

  async function designateOfficer(userId: string) {
    setError(null);
    try {
      const res = await fetch("/api/contractor/privacy/officer", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.message ?? "Could not update designation.");
        return;
      }
      setPickerOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error.");
    }
  }

  async function patchDsar(
    id: string,
    patch: { status?: string; assignedToUserId?: string | null; notes?: string | null; projectContext?: string | null },
  ) {
    setError(null);
    try {
      const res = await fetch(`/api/contractor/privacy/dsar/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.message ?? "Could not update request.");
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError("Network error.");
      return false;
    }
  }

  return (
    <div style={{ fontFamily: F.body, color: "var(--t1)", paddingBottom: 60 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 820, color: "var(--t1)", letterSpacing: "-.025em", lineHeight: 1.15, margin: 0 }}>
          Privacy &amp; Law 25
        </h1>
        <p style={{ fontSize: 14, color: "var(--t2)", marginTop: 6, maxWidth: 740, lineHeight: 1.55 }}>
          Quebec Law 25 surface. Designate a Privacy Officer, work the DSAR queue against the
          30-day SLA, and review boundary obligations. Real CAI notification is a manual
          out-of-product step — see <a href="/docs/specs/privacy_compliance_boundary.md" style={{ color: "var(--ac-t)" }}>the compliance boundary doc</a>.
        </p>
      </div>

      {/* Officer designation card */}
      <OfficerCard
        view={view}
        onChange={() => setPickerOpen(true)}
        currentUserId={currentUserId}
      />

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 22 }}>
        <Kpi label="Open DSARs" value={openCount} sub={urgentCount > 0 ? `${urgentCount} within 7-day SLA` : "All within SLA"} tone={urgentCount > 0 ? "warn" : "ok"} />
        <Kpi label="Completed YTD" value={completedCount} sub="Across all request types" />
        <Kpi label="Total received" value={view.dsars.length} sub="Public + authenticated" />
      </div>

      {/* Boundary callout */}
      <div style={{ display: "flex", gap: 12, padding: "14px 16px", background: "var(--in-s)", border: "1px solid var(--in-s)", borderRadius: 10, marginBottom: 22 }}>
        <div style={{ color: "var(--in-t)", flexShrink: 0, marginTop: 2 }}>{IconAlert}</div>
        <div style={{ fontSize: 13, color: "var(--in-t)", lineHeight: 1.55 }}>
          <strong>What this surface does and doesn&apos;t do.</strong> This page provides the Law 25
          product affordances — DSAR intake, queue, audit trail. <strong>It does not transmit
          notifications to the Commission d&apos;accès à l&apos;information.</strong> CAI reporting
          remains a manual step performed by the Privacy Officer outside the product.
        </div>
      </div>

      {/* Tab strip */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--s3)", marginBottom: 18 }}>
        <SubTab cur={adminTab === "dsar"} onClick={() => setAdminTab("dsar")} count={openCount}>
          DSAR queue
        </SubTab>
        <SubTab cur={adminTab === "consents"} onClick={() => setAdminTab("consents")} count={view.consents.length}>
          Consent register
        </SubTab>
        <SubTab cur={adminTab === "breaches"} onClick={() => setAdminTab("breaches")} count={view.breaches.length}>
          Breach register
        </SubTab>
      </div>

      {error && (
        <div style={{ background: "var(--dg-s)", border: "1px solid var(--dg-s)", borderRadius: 10, padding: "10px 14px", color: "var(--dg-t)", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {adminTab === "dsar" && (
        <>
          {/* Filter bar */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--s1)", border: "1px solid var(--s3)", borderRadius: 10, marginBottom: 14 }}>
            <FilterPill cur={statusFilter === "all"} onClick={() => setStatusFilter("all")}>All</FilterPill>
            <FilterPill cur={statusFilter === "received"} onClick={() => setStatusFilter("received")}>Received</FilterPill>
            <FilterPill cur={statusFilter === "in_progress"} onClick={() => setStatusFilter("in_progress")}>In progress</FilterPill>
            <FilterPill cur={statusFilter === "completed"} onClick={() => setStatusFilter("completed")}>Completed</FilterPill>
            <FilterPill cur={statusFilter === "rejected"} onClick={() => setStatusFilter("rejected")}>Rejected</FilterPill>
            <span style={{ width: 1, height: 20, background: "var(--s3)" }} />
            <FilterPill cur={typeFilter === "all"} onClick={() => setTypeFilter("all")}>All types</FilterPill>
            <FilterPill cur={typeFilter === "access"} onClick={() => setTypeFilter("access")}>Access</FilterPill>
            <FilterPill cur={typeFilter === "deletion"} onClick={() => setTypeFilter("deletion")}>Deletion</FilterPill>
            <FilterPill cur={typeFilter === "rectification"} onClick={() => setTypeFilter("rectification")}>Rectification</FilterPill>
            <FilterPill cur={typeFilter === "portability"} onClick={() => setTypeFilter("portability")}>Portability</FilterPill>
          </div>

          {/* Table */}
          <div style={{ background: "var(--s1)", border: "1px solid var(--s3)", borderRadius: 14, overflow: "hidden" }}>
            {dsarsFiltered.length === 0 ? (
              <div style={{ padding: "48px 24px", textAlign: "center" }}>
                <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 680, color: "var(--t1)", marginBottom: 5 }}>
                  No matching requests
                </div>
                <div style={{ fontSize: 13, color: "var(--t2)", maxWidth: 360, margin: "0 auto" }}>
                  Adjust the filters or wait for new submissions from /privacy/dsar.
                </div>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Reference", "Requester", "Type", "Received", "SLA", "Status", "Assigned"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dsarsFiltered.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => setOpenDsar(d)}
                      style={{ cursor: "pointer", borderTop: "1px solid var(--s3)", transition: "background 120ms" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sh)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={tdStyle}><span style={{ fontFamily: F.mono, fontSize: 12, color: "var(--t2)" }}>{d.referenceCode}</span></td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 580 }}>{d.requesterName}</div>
                        <div style={{ fontFamily: F.mono, fontSize: 11.5, color: "var(--t3)", marginTop: 1 }}>{d.requesterEmail}</div>
                      </td>
                      <td style={tdStyle}>
                        <Pill tone="acc">{REQUEST_TYPE_LABEL[d.requestType]}</Pill>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--t2)", fontSize: 12.5 }}>{formatDate(d.receivedAt)}</td>
                      <td style={tdStyle}><SlaPill row={d} /></td>
                      <td style={tdStyle}><StatusPill status={d.status} /></td>
                      <td style={{ ...tdStyle, fontSize: 12.5, color: "var(--t2)" }}>
                        {d.assignedToName ?? <span style={{ color: "var(--t3)" }}>Unassigned</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {adminTab === "consents" && <ConsentRegisterTable rows={view.consents} />}

      {adminTab === "breaches" && (
        <BreachRegisterTab
          rows={view.breaches}
          onLogNew={() => setLogBreachOpen(true)}
          onOpen={(b) => setOpenBreach(b)}
        />
      )}

      {/* Drawer */}
      {openDsar && (
        <DsarDrawer
          row={openDsar}
          candidates={view.candidates}
          pending={pending}
          onClose={() => setOpenDsar(null)}
          onPatch={async (patch) => {
            const ok = await patchDsar(openDsar.id, patch);
            if (ok) setOpenDsar(null);
          }}
        />
      )}

      {/* Officer picker modal */}
      {pickerOpen && (
        <OfficerPickerModal
          candidates={view.candidates}
          currentOfficerUserId={view.officer?.userId ?? null}
          pending={pending}
          onClose={() => setPickerOpen(false)}
          onPick={designateOfficer}
        />
      )}

      {/* Log new breach modal */}
      {logBreachOpen && (
        <LogBreachModal
          pending={pending}
          onClose={() => setLogBreachOpen(false)}
          onSubmit={async (payload) => {
            setError(null);
            try {
              const res = await fetch("/api/contractor/privacy/breach", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await res.json().catch(() => null);
              if (!res.ok || !json?.ok) {
                setError(json?.message ?? "Could not log breach.");
                return;
              }
              setLogBreachOpen(false);
              startTransition(() => router.refresh());
            } catch {
              setError("Network error.");
            }
          }}
        />
      )}

      {/* Breach drawer */}
      {openBreach && (
        <BreachDrawer
          row={openBreach}
          pending={pending}
          onClose={() => setOpenBreach(null)}
          onPatch={async (patch) => {
            setError(null);
            try {
              const res = await fetch(`/api/contractor/privacy/breach/${openBreach.id}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(patch),
              });
              const json = await res.json().catch(() => null);
              if (!res.ok) {
                setError(json?.message ?? "Could not update breach.");
                return;
              }
              startTransition(() => router.refresh());
            } catch {
              setError("Network error.");
            }
          }}
          onGenerateDrafts={async () => {
            setError(null);
            try {
              const res = await fetch(
                `/api/contractor/privacy/breach/${openBreach.id}/drafts`,
                {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({}),
                },
              );
              const json = await res.json().catch(() => null);
              if (!res.ok || !json?.ok) {
                setError(json?.message ?? "Could not generate drafts.");
                return;
              }
              startTransition(() => router.refresh());
            } catch {
              setError("Network error.");
            }
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Sub-tab strip + new tab content components
// ──────────────────────────────────────────────────────────────────────

function SubTab({
  cur,
  onClick,
  count,
  children,
}: {
  cur: boolean;
  onClick: () => void;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        fontFamily: F.display,
        fontSize: 13.5,
        fontWeight: cur ? 700 : 600,
        color: cur ? "var(--t1)" : "var(--t3)",
        padding: "12px 18px",
        borderBottom: cur ? "2px solid var(--ac)" : "2px solid transparent",
        marginBottom: -1,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {children}
      {count !== undefined && (
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 11,
            fontWeight: 500,
            background: cur ? "var(--ac-s)" : "var(--s2)",
            color: cur ? "var(--ac-t)" : "var(--t2)",
            padding: "1px 7px",
            borderRadius: 999,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ConsentRegisterTable({ rows }: { rows: ConsentRegisterRow[] }) {
  const [scope, setScope] = useState<"all" | "active" | "revoked">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (scope === "active" && !r.granted) return false;
      if (scope === "revoked" && r.granted) return false;
      if (search) {
        const q = search.toLowerCase();
        const subject = (r.subjectName ?? r.subjectEmail).toLowerCase();
        if (!subject.includes(q) && !r.subjectEmail.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, scope, search]);

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--s1)", border: "1px solid var(--s3)", borderRadius: 10, marginBottom: 14 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          style={{ ...inputStyle, flex: "1 1 220px", maxWidth: 320, height: 32, padding: "5px 12px" }}
        />
        <FilterPill cur={scope === "all"} onClick={() => setScope("all")}>All</FilterPill>
        <FilterPill cur={scope === "active"} onClick={() => setScope("active")}>Granted</FilterPill>
        <FilterPill cur={scope === "revoked"} onClick={() => setScope("revoked")}>Revoked</FilterPill>
      </div>
      <div style={{ background: "var(--s1)", border: "1px solid var(--s3)", borderRadius: 14, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 680, color: "var(--t1)", marginBottom: 5 }}>
              No consent records yet
            </div>
            <div style={{ fontSize: 13, color: "var(--t2)", maxWidth: 360, margin: "0 auto" }}>
              Records are written automatically as users grant or revoke consents on their preferences page.
            </div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Subject", "Consent type", "Status", "Granted", "Revoked", "Source"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={`${r.subjectKey}:${r.consentType}`} style={{ borderTop: "1px solid var(--s3)" }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 580 }}>{r.subjectName ?? r.subjectEmail}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 11.5, color: "var(--t3)", marginTop: 1 }}>{r.subjectEmail}</div>
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 580 }}>{consentLabel(r.consentType)}</td>
                  <td style={tdStyle}>
                    {r.granted ? <Pill tone="ok">Granted</Pill> : <Pill tone="muted">Revoked</Pill>}
                  </td>
                  <td style={{ ...tdStyle, color: "var(--t2)", fontSize: 12.5 }}>{formatDate(r.grantedAt)}</td>
                  <td style={{ ...tdStyle, color: "var(--t2)", fontSize: 12.5 }}>
                    {r.revokedAt ? formatDate(r.revokedAt) : <span style={{ color: "var(--t3)" }}>—</span>}
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontFamily: F.mono, fontSize: 11.5, background: "var(--s2)", color: "var(--t2)", padding: "2px 7px", borderRadius: 999 }}>
                      {r.source}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function consentLabel(key: string): string {
  return CONSENT_CATALOG.find((c) => c.id === key)?.label ?? key;
}

function BreachRegisterTab({
  rows,
  onLogNew,
  onOpen,
}: {
  rows: BreachRegisterRow[];
  onLogNew: () => void;
  onOpen: (b: BreachRegisterRow) => void;
}) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button onClick={onLogNew} style={btnPrimaryStyle}>
          + Log new breach
        </button>
      </div>
      <div style={{ background: "var(--s1)", border: "1px solid var(--s3)", borderRadius: 14, overflow: "hidden" }}>
        {rows.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 680, color: "var(--t1)", marginBottom: 5 }}>
              No breaches logged
            </div>
            <div style={{ fontSize: 13, color: "var(--t2)", maxWidth: 360, margin: "0 auto" }}>
              Good. If something happens, log it within 72 hours of discovery — Law 25 requires it for incidents likely to cause serious harm.
            </div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Reference", "Severity", "Discovered", "Affected", "Notify", "CAI", "Status"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => onOpen(b)}
                  style={{ cursor: "pointer", borderTop: "1px solid var(--s3)", transition: "background 120ms" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--sh)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={tdStyle}><span style={{ fontFamily: F.mono, fontSize: 12, color: "var(--t2)" }}>{b.referenceCode}</span></td>
                  <td style={tdStyle}>
                    <Pill tone={severityTone(b.severity)}>{b.severity}</Pill>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--t2)", fontSize: 12.5 }}>{formatDate(b.discoveredAt)}</td>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 660 }}>{b.affectedCount ?? "—"}</div>
                    <div style={{ fontSize: 12, color: "var(--t3)" }}>{b.affectedDescription}</div>
                  </td>
                  <td style={{ ...tdStyle, color: "var(--t2)", fontSize: 12.5 }}>
                    {b.draftCount > 0 ? `${b.draftsSent}/${b.draftCount} sent` : <span style={{ color: "var(--t3)" }}>No drafts</span>}
                  </td>
                  <td style={{ ...tdStyle, fontSize: 12.5 }}>
                    {b.reportedToCaiAt ? (
                      <Pill tone="info">{formatDate(b.reportedToCaiAt)}</Pill>
                    ) : (
                      <span style={{ color: "var(--t3)" }}>Not reported</span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {b.status === "closed" ? <Pill tone="ok">Closed</Pill> : <Pill tone="warn">Open</Pill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function severityTone(s: BreachRegisterRow["severity"]): "info" | "warn" | "danger" {
  if (s === "low") return "info";
  if (s === "medium") return "warn";
  return "danger";
}

function LogBreachModal({
  pending,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [discoveredAt, setDiscoveredAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [occurredAt, setOccurredAt] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("low");
  const [affectedCount, setAffectedCount] = useState("");
  const [affectedDescription, setAffectedDescription] = useState("");
  const [dataTypesAffected, setDataTypesAffected] = useState("");
  const [containmentActions, setContainmentActions] = useState("");

  const canSubmit = !!discoveredAt && affectedDescription.trim().length > 0 && !pending;

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(12,14,20,.5)", zIndex: 90, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8vh 18px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--s1)", borderRadius: 18, maxWidth: 640, width: "100%", overflow: "hidden", boxShadow: "var(--shmd)" }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--s3)", display: "flex", alignItems: "start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 740, color: "var(--t1)", letterSpacing: "-.018em" }}>
              Log new breach
            </div>
            <div style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 3 }}>
              Required within 72 hours of discovery if likely to cause serious harm
            </div>
          </div>
          <button onClick={onClose} style={iconBtnStyle}>{IconX}</button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14, maxHeight: "62vh", overflowY: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Discovered" required>
              <input type="date" value={discoveredAt} onChange={(e) => setDiscoveredAt(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Occurred (estimated)">
              <input type="date" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <Field label="Severity" required>
            <select value={severity} onChange={(e) => setSeverity(e.target.value as never)} style={inputStyle}>
              <option value="low">Low — minimal risk of harm</option>
              <option value="medium">Medium — moderate risk, contained</option>
              <option value="high">High — serious risk, notify subjects</option>
              <option value="critical">Critical — broad exposure, notify CAI</option>
            </select>
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
            <Field label="Subjects affected">
              <input
                type="number"
                min={0}
                value={affectedCount}
                onChange={(e) => setAffectedCount(e.target.value)}
                placeholder="Count"
                style={inputStyle}
              />
            </Field>
            <Field label="Description" required>
              <input
                value={affectedDescription}
                onChange={(e) => setAffectedDescription(e.target.value)}
                placeholder="e.g. 14 subcontractor users (one trade partner)"
                style={inputStyle}
              />
            </Field>
          </div>
          <Field label="Data types affected" hint="(comma-separated)">
            <input
              value={dataTypesAffected}
              onChange={(e) => setDataTypesAffected(e.target.value)}
              placeholder="Email address, Phone number, Trade license"
              style={inputStyle}
            />
          </Field>
          <Field label="Containment actions" hint="Logged in audit trail.">
            <textarea
              rows={4}
              value={containmentActions}
              onChange={(e) => setContainmentActions(e.target.value)}
              placeholder="What was done to contain the breach? Include timestamps where possible."
              style={{ ...inputStyle, resize: "vertical", minHeight: 90, fontFamily: F.body }}
            />
          </Field>
          <div style={{ display: "flex", gap: 12, padding: "12px 14px", background: "var(--in-s)", border: "1px solid var(--in-s)", borderRadius: 10 }}>
            <div style={{ color: "var(--in-t)", flexShrink: 0, marginTop: 2 }}>{IconAlert}</div>
            <div style={{ fontSize: 13, color: "var(--in-t)", lineHeight: 1.55 }}>
              CAI notification is a manual step outside this product. Mark <strong>CAI reported</strong> on the breach row after you file with the Commission directly.
            </div>
          </div>
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--s3)", background: "var(--s2)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhostStyle}>Cancel</button>
          <button
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                discoveredAt: new Date(discoveredAt).toISOString(),
                occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
                severity,
                affectedCount: affectedCount ? Number(affectedCount) : null,
                affectedDescription,
                dataTypesAffected: dataTypesAffected
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                containmentActions: containmentActions || null,
              })
            }
            style={btnPrimaryStyle}
          >
            Log breach
          </button>
        </div>
      </div>
    </div>
  );
}

function BreachDrawer({
  row,
  pending,
  onClose,
  onPatch,
  onGenerateDrafts,
}: {
  row: BreachRegisterRow;
  pending: boolean;
  onClose: () => void;
  onPatch: (patch: Record<string, unknown>) => Promise<void>;
  onGenerateDrafts: () => Promise<void>;
}) {
  const [containment, setContainment] = useState(row.containmentActions ?? "");
  const isOpen = row.status === "open";

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(12,14,20,.42)", zIndex: 80 }} />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 600,
          maxWidth: "96vw",
          background: "var(--s1)",
          borderLeft: "1px solid var(--s3)",
          zIndex: 81,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--s3)", display: "flex", alignItems: "start", justifyContent: "space-between", gap: 14 }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 740, color: "var(--t1)", letterSpacing: "-.018em" }}>
              Breach {row.referenceCode}
            </div>
            <div style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 3 }}>
              Discovered {formatDate(row.discoveredAt)} · Logged by {row.loggedByName ?? "Unknown"}
            </div>
          </div>
          <button onClick={onClose} style={iconBtnStyle}>{IconX}</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          <DrawerRow label="Severity">
            <select
              value={row.severity}
              onChange={(e) => onPatch({ severity: e.target.value })}
              style={inputStyle}
              disabled={!isOpen || pending}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </DrawerRow>
          <DrawerRow label="Affected">
            <div>
              <strong style={{ fontFamily: F.display }}>{row.affectedCount ?? "—"}</strong> · {row.affectedDescription}
            </div>
          </DrawerRow>
          <DrawerRow label="Data types">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {row.dataTypesAffected.length === 0 ? (
                <span style={{ color: "var(--t3)" }}>None recorded</span>
              ) : (
                row.dataTypesAffected.map((dt) => (
                  <span key={dt} style={{ fontFamily: F.mono, fontSize: 11.5, background: "var(--s2)", color: "var(--t2)", padding: "2px 7px", borderRadius: 999 }}>
                    {dt}
                  </span>
                ))
              )}
            </div>
          </DrawerRow>
          <DrawerRow label="Containment actions">
            <textarea
              value={containment}
              onChange={(e) => setContainment(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
              disabled={!isOpen || pending}
            />
            {isOpen && containment !== (row.containmentActions ?? "") && (
              <button
                disabled={pending}
                onClick={() => onPatch({ containmentActions: containment || null })}
                style={{ ...btnSecondaryStyle, marginTop: 8 }}
              >
                Save containment notes
              </button>
            )}
          </DrawerRow>
          <DrawerRow label="Notify users">
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              {(["pending", "notify", "no_notify"] as const).map((d) => (
                <button
                  key={d}
                  disabled={pending}
                  onClick={() => onPatch({ notifyUsersDecision: d })}
                  style={{
                    ...btnSecondaryStyle,
                    background:
                      row.notifyUsersDecision === d ? "var(--ac-s)" : "var(--s2)",
                    color:
                      row.notifyUsersDecision === d ? "var(--ac-t)" : "var(--t1)",
                    borderColor:
                      row.notifyUsersDecision === d ? "var(--ac)" : "var(--s3)",
                  }}
                >
                  {d === "pending" ? "Pending" : d === "notify" ? "Notify" : "Don't notify"}
                </button>
              ))}
            </div>
            {row.notifyUsersDecision === "notify" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 12.5, color: "var(--t2)" }}>
                  {row.draftCount === 0
                    ? "No drafts generated yet. Drafts go to all active org members and never auto-send — you review and mark each as sent after dispatching it externally."
                    : `${row.draftsSent} of ${row.draftCount} drafts marked sent.`}
                </div>
                {row.draftCount === 0 && (
                  <button disabled={pending} onClick={onGenerateDrafts} style={btnPrimaryStyle}>
                    Generate drafts for all active members
                  </button>
                )}
                {row.notifiedUsersAt ? (
                  <div style={{ fontSize: 12, color: "var(--ok-t)" }}>
                    User notification batch attested {formatDate(row.notifiedUsersAt)}
                  </div>
                ) : (
                  <button
                    disabled={pending}
                    onClick={() => onPatch({ notifiedUsersAt: true })}
                    style={btnSecondaryStyle}
                  >
                    Mark user notification complete
                  </button>
                )}
              </div>
            )}
          </DrawerRow>
          <DrawerRow label="CAI report">
            {row.reportedToCaiAt ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Pill tone="info">Reported {formatDate(row.reportedToCaiAt)}</Pill>
                <button disabled={pending} onClick={() => onPatch({ reportedToCaiAt: null })} style={btnGhostStyle}>
                  Clear
                </button>
              </div>
            ) : (
              <button disabled={pending} onClick={() => onPatch({ reportedToCaiAt: true })} style={btnSecondaryStyle}>
                Mark as reported to CAI
              </button>
            )}
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 6, lineHeight: 1.5 }}>
              Flag-only. The product does NOT transmit anything to the Commission. Set this after you file with the CAI directly.
            </div>
          </DrawerRow>
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--s3)", background: "var(--s2)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {isOpen ? (
            <button disabled={pending} onClick={() => onPatch({ status: "closed" })} style={btnPrimaryStyle}>
              Close breach
            </button>
          ) : (
            <button disabled={pending} onClick={() => onPatch({ status: "open" })} style={btnSecondaryStyle}>
              Reopen
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function OfficerCard({
  view,
  onChange,
  currentUserId,
}: {
  view: PrivacyAdminView;
  onChange: () => void;
  currentUserId: string;
}) {
  const officer = view.officer;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 18,
        alignItems: "center",
        padding: "20px 22px",
        background: "var(--s1)",
        border: "1px solid var(--s3)",
        borderRadius: 14,
        marginBottom: 22,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: "var(--ac)" }} />
      {officer ? (
        <>
          <div style={avatarStyle}>{officer.initials}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={roleTagStyle}>Designated Privacy Officer</span>
              <Pill tone="ok">Active</Pill>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 740, color: "var(--t1)", letterSpacing: "-.018em" }}>
              {officer.name}
            </div>
            <div style={{ fontSize: 13, color: "var(--t2)", marginTop: 2, fontFamily: F.mono }}>
              {officer.email}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 6 }}>
              Designated {formatDate(officer.designatedAt)}
              {officer.designatedByName ? ` by ${officer.designatedByName}` : ""}
              {officer.userId === currentUserId ? " · This is you" : ""}
              {" · public listing on /privacy/officer"}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={onChange} style={btnSecondaryStyle}>
              Change officer
            </button>
            <a href="/privacy/officer" target="_blank" rel="noopener noreferrer" style={btnGhostSmStyle}>
              Public listing ↗
            </a>
          </div>
        </>
      ) : (
        <>
          <div style={{ ...avatarStyle, background: "var(--s2)", color: "var(--t3)" }}>?</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={roleTagStyle}>Designated Privacy Officer</span>
              <Pill tone="warn">Not designated</Pill>
            </div>
            <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 740, color: "var(--t1)", letterSpacing: "-.018em" }}>
              No Privacy Officer designated
            </div>
            <div style={{ fontSize: 13, color: "var(--t2)", marginTop: 4, maxWidth: 540 }}>
              Quebec Law 25 §3.1 requires every organization to designate one. Public DSAR
              submissions cannot be routed until you pick an officer.
            </div>
          </div>
          <button onClick={onChange} style={btnPrimaryStyle}>
            Designate officer
          </button>
        </>
      )}
    </div>
  );
}

function DsarDrawer({
  row,
  candidates,
  pending,
  onClose,
  onPatch,
}: {
  row: DsarRequestRow;
  candidates: PrivacyOfficerCandidate[];
  pending: boolean;
  onClose: () => void;
  onPatch: (patch: { status?: string; assignedToUserId?: string | null; notes?: string | null; projectContext?: string | null }) => Promise<void>;
}) {
  const [notes, setNotes] = useState(row.notes ?? "");
  const [projectContext, setProjectContext] = useState(row.projectContext ?? "");
  const [assignee, setAssignee] = useState<string>(row.assignedToUserId ?? "");

  const isOpen = row.status === "received" || row.status === "in_progress";

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(12,14,20,.42)", zIndex: 80 }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 560,
          maxWidth: "96vw",
          background: "var(--s1)",
          borderLeft: "1px solid var(--s3)",
          zIndex: 81,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--s3)", display: "flex", alignItems: "start", justifyContent: "space-between", gap: 14 }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 740, color: "var(--t1)", letterSpacing: "-.018em" }}>
              {row.requesterName}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 12, color: "var(--t2)", marginTop: 3 }}>
              {row.referenceCode} · {REQUEST_TYPE_LABEL[row.requestType]} request
            </div>
          </div>
          <button onClick={onClose} style={iconBtnStyle}>{IconX}</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>
          <DrawerRow label="Status">
            <StatusPill status={row.status} />
            {isOpen && <SlaPill row={row} style={{ marginLeft: 8 }} />}
          </DrawerRow>

          <DrawerRow label="Requester">
            <div>{row.requesterName}</div>
            <div style={{ fontFamily: F.mono, fontSize: 12.5, color: "var(--t2)", marginTop: 2 }}>{row.requesterEmail}</div>
            {row.accountEmail && (
              <div style={{ fontFamily: F.mono, fontSize: 12, color: "var(--t3)", marginTop: 1 }}>
                Account email: {row.accountEmail}
              </div>
            )}
          </DrawerRow>

          <DrawerRow label="Province">
            <span>{row.province}</span>
          </DrawerRow>

          <DrawerRow label="Description">
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.55 }}>
              {row.description}
            </div>
          </DrawerRow>

          <DrawerRow label="Project context (internal)">
            <input
              value={projectContext}
              onChange={(e) => setProjectContext(e.target.value)}
              placeholder="e.g. Maplewood Heights"
              style={inputStyle}
            />
          </DrawerRow>

          <DrawerRow label="Internal notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Triage notes — never surfaced to the requester."
              style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
            />
          </DrawerRow>

          <DrawerRow label="Received">
            <div>{formatDateTime(row.receivedAt)}</div>
            <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
              SLA due {formatDate(row.slaDueAt)}
            </div>
          </DrawerRow>

          <DrawerRow label="Assigned to">
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              style={inputStyle}
            >
              <option value="">Unassigned</option>
              {candidates.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.name} · {c.roleKey}
                </option>
              ))}
            </select>
          </DrawerRow>

          {row.completedAt && (
            <DrawerRow label="Closed">
              <div>{formatDateTime(row.completedAt)}</div>
            </DrawerRow>
          )}
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--s3)", background: "var(--s2)", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              disabled={pending}
              onClick={() =>
                onPatch({
                  notes: notes || null,
                  projectContext: projectContext || null,
                  assignedToUserId: assignee || null,
                })
              }
              style={btnSecondaryStyle}
            >
              Save details
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {isOpen && (
              <>
                <button disabled={pending} onClick={() => onPatch({ status: "rejected" })} style={btnDangerStyle}>
                  Reject
                </button>
                {row.status === "received" && (
                  <button disabled={pending} onClick={() => onPatch({ status: "in_progress" })} style={btnSecondaryStyle}>
                    Start work
                  </button>
                )}
                <button disabled={pending} onClick={() => onPatch({ status: "completed" })} style={btnPrimaryStyle}>
                  Mark complete
                </button>
              </>
            )}
            {!isOpen && (
              <button onClick={() => onPatch({ status: "in_progress" })} style={btnSecondaryStyle}>
                Reopen
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function OfficerPickerModal({
  candidates,
  currentOfficerUserId,
  pending,
  onClose,
  onPick,
}: {
  candidates: PrivacyOfficerCandidate[];
  currentOfficerUserId: string | null;
  pending: boolean;
  onClose: () => void;
  onPick: (userId: string) => Promise<void>;
}) {
  const [picked, setPicked] = useState<string | null>(currentOfficerUserId);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(12,14,20,.5)", zIndex: 90, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8vh 18px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--s1)", borderRadius: 18, maxWidth: 560, width: "100%", overflow: "hidden", boxShadow: "var(--shmd)" }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--s3)", display: "flex", alignItems: "start", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 740, color: "var(--t1)", letterSpacing: "-.018em" }}>
              Designate Privacy Officer
            </div>
            <div style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 3 }}>
              Required by Law 25 · One per organization · Public listing on /privacy/officer
            </div>
          </div>
          <button onClick={onClose} style={iconBtnStyle}>{IconX}</button>
        </div>

        <div style={{ padding: "18px 22px", maxHeight: "62vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {candidates.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--t2)", fontSize: 13 }}>
              No active contractor members in this org. Add a team member first.
            </div>
          ) : (
            candidates.map((c) => {
              const isCur = picked === c.userId;
              return (
                <div
                  key={c.userId}
                  onClick={() => setPicked(c.userId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 14px",
                    border: `1px solid ${isCur ? "var(--ac)" : "var(--s3)"}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    background: isCur ? "var(--ac-s)" : "var(--s1)",
                    transition: "all 120ms",
                  }}
                >
                  <div style={pickAvatarStyle}>{c.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F.display, fontSize: 13.5, fontWeight: 680, color: "var(--t1)" }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--t3)" }}>{c.roleKey}</div>
                  </div>
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      border: `2px solid ${isCur ? "var(--ac)" : "var(--s4)"}`,
                      background: isCur ? "var(--ac)" : "transparent",
                      flexShrink: 0,
                      position: "relative",
                    }}
                  >
                    {isCur && <span style={{ position: "absolute", inset: 3, borderRadius: "50%", background: "#fff" }} />}
                  </div>
                </div>
              );
            })
          )}
          <div style={{ display: "flex", gap: 12, padding: "14px 16px", background: "var(--in-s)", border: "1px solid var(--in-s)", borderRadius: 10, marginTop: 6 }}>
            <div style={{ color: "var(--in-t)", flexShrink: 0, marginTop: 2 }}>{IconAlert}</div>
            <div style={{ fontSize: 13, color: "var(--in-t)", lineHeight: 1.55 }}>
              The designated officer&apos;s name and contact email will appear on the public{" "}
              <strong>/privacy/officer</strong> page, satisfying Law 25 §3.1.
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--s3)", background: "var(--s2)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhostStyle}>Cancel</button>
          <button
            disabled={!picked || pending || picked === currentOfficerUserId}
            onClick={() => picked && onPick(picked)}
            style={btnPrimaryStyle}
          >
            {currentOfficerUserId ? "Confirm change" : "Confirm designation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontFamily: F.display, fontSize: 12, fontWeight: 620, color: "var(--t1)", letterSpacing: "-.005em" }}>
        {label}
        {required && <span style={{ color: "var(--dg)", marginLeft: 3 }}>*</span>}
        {hint && <span style={{ fontSize: 12, color: "var(--t3)", fontWeight: 480, marginLeft: 6 }}>{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function DrawerRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "13px 0", borderBottom: "1px solid var(--s3)" }}>
      <div style={{ fontFamily: F.display, fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--t3)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, color: "var(--t1)", lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: "ok" | "warn" }) {
  return (
    <div style={{ background: tone === "warn" ? "linear-gradient(160deg,var(--wr-s) 0%,var(--s1) 60%)" : "var(--s1)", border: "1px solid var(--s3)", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: tone === "warn" ? "var(--wr-t)" : "var(--t3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 820, color: "var(--t1)", letterSpacing: "-.03em", lineHeight: 1.05 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function FilterPill({ cur, onClick, children }: { cur: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        fontFamily: F.display,
        fontSize: 12,
        fontWeight: 600,
        color: cur ? "var(--ac-t)" : "var(--t2)",
        padding: "5px 11px",
        borderRadius: 999,
        border: `1px solid ${cur ? "var(--ac-m)" : "var(--s3)"}`,
        background: cur ? "var(--ac-s)" : "var(--s1)",
      }}
    >
      {children}
    </button>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "danger" | "info" | "muted" | "acc";
  children: React.ReactNode;
}) {
  const palettes: Record<typeof tone, { bg: string; fg: string }> = {
    ok: { bg: "var(--ok-s)", fg: "var(--ok-t)" },
    warn: { bg: "var(--wr-s)", fg: "var(--wr-t)" },
    danger: { bg: "var(--dg-s)", fg: "var(--dg-t)" },
    info: { bg: "var(--in-s)", fg: "var(--in-t)" },
    muted: { bg: "var(--s2)", fg: "var(--t3)" },
    acc: { bg: "var(--ac-s)", fg: "var(--ac-t)" },
  };
  const p = palettes[tone];
  return (
    <span style={{ fontFamily: F.display, fontSize: 10.5, fontWeight: 700, letterSpacing: ".02em", padding: "3px 9px", borderRadius: 999, textTransform: "uppercase", background: p.bg, color: p.fg, display: "inline-flex", alignItems: "center", gap: 5 }}>
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: DsarRequestRow["status"] }) {
  const tone =
    status === "completed" ? "ok" : status === "rejected" ? "muted" : status === "in_progress" ? "info" : "warn";
  return <Pill tone={tone}>{STATUS_LABEL[status]}</Pill>;
}

function SlaPill({ row, style }: { row: DsarRequestRow; style?: React.CSSProperties }) {
  if (row.status === "completed" || row.status === "rejected") {
    return <span style={style}><Pill tone="muted">Closed</Pill></span>;
  }
  const tone: "ok" | "warn" | "danger" =
    row.daysRemaining <= 3 ? "danger" : row.daysRemaining <= 10 ? "warn" : "ok";
  return (
    <span style={style}>
      <Pill tone={tone}>{row.daysRemaining}d left</Pill>
    </span>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateTime(d: Date): string {
  return d.toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontFamily: F.display,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".05em",
  textTransform: "uppercase",
  color: "var(--t3)",
  padding: "10px 16px",
  background: "var(--s2)",
  borderBottom: "1px solid var(--s3)",
};
const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 13,
  color: "var(--t1)",
  verticalAlign: "middle",
};

const inputStyle: React.CSSProperties = {
  fontFamily: F.body,
  fontSize: 13.5,
  color: "var(--t1)",
  border: "1px solid var(--s3)",
  background: "var(--s1)",
  borderRadius: 6,
  padding: "9px 12px",
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

const btnPrimaryStyle: React.CSSProperties = {
  fontFamily: F.display,
  fontSize: 13,
  fontWeight: 620,
  background: "var(--ac)",
  color: "#fff",
  border: "1px solid transparent",
  padding: "7px 14px",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const btnSecondaryStyle: React.CSSProperties = {
  ...btnPrimaryStyle,
  background: "var(--s2)",
  color: "var(--t1)",
  border: "1px solid var(--s3)",
};

const btnGhostStyle: React.CSSProperties = {
  ...btnPrimaryStyle,
  background: "transparent",
  color: "var(--t2)",
  border: "1px solid transparent",
};

const btnGhostSmStyle: React.CSSProperties = {
  ...btnGhostStyle,
  fontSize: 12,
  padding: "5px 10px",
  textDecoration: "none",
};

const btnDangerStyle: React.CSSProperties = {
  ...btnPrimaryStyle,
  background: "var(--dg-s)",
  color: "var(--dg-t)",
  border: "1px solid var(--dg-s)",
};

const iconBtnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: "1px solid var(--s3)",
  background: "var(--s1)",
  color: "var(--t2)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const avatarStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "var(--ac)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: F.display,
  fontSize: 18,
  fontWeight: 740,
  letterSpacing: "-.01em",
};

const pickAvatarStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: "50%",
  background: "var(--ac)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: F.display,
  fontSize: 11.5,
  fontWeight: 700,
};

const roleTagStyle: React.CSSProperties = {
  fontFamily: F.display,
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  background: "var(--ac-s)",
  color: "var(--ac-t)",
  padding: "3px 8px",
  borderRadius: 999,
};

const IconX = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconAlert = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
