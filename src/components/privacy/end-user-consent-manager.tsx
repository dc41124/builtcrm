"use client";

// Step 65 Session C — end-user privacy & consents UI.
//
// Direct port of View 03 of `builtcrm_privacy_officer_law25_paired.jsx`.
// Reused by every portal's Settings → Privacy & consents page. Three
// tabs:
//   - Consent preferences (toggle on/off)
//   - History (timeline of grants/revocations)
//   - Your data (in-product DSAR shortcuts)
//
// Mutations:
//   PATCH /api/privacy/consents          — toggle a consent
//   POST  /api/privacy/dsar/authenticated — submit a DSAR

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  CONSENT_CATALOG,
  type ConsentTypeKey,
} from "@/lib/privacy/consent-catalog";
import type { EndUserPrivacyView } from "@/domain/loaders/privacy";

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

type Tab = "preferences" | "history" | "requests";

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

export function EndUserConsentManager({ view }: { view: EndUserPrivacyView }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("preferences");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<Partial<Record<ConsentTypeKey, boolean>>>({});
  const [requestOpen, setRequestOpen] = useState<null | "access" | "deletion" | "rectification" | "portability">(null);
  const [submittedDsar, setSubmittedDsar] = useState<string | null>(null);

  async function toggleConsent(consentType: ConsentTypeKey, granted: boolean) {
    setError(null);
    setOptimistic((m) => ({ ...m, [consentType]: granted }));
    try {
      const res = await fetch("/api/privacy/consents", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consentType, granted, source: "preferences_page" }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setOptimistic((m) => {
          const next = { ...m };
          delete next[consentType];
          return next;
        });
        setError(json?.message ?? "Could not update consent.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setOptimistic((m) => {
        const next = { ...m };
        delete next[consentType];
        return next;
      });
      setError("Network error.");
    }
  }

  function isGranted(key: ConsentTypeKey): boolean {
    if (key in optimistic) return optimistic[key]!;
    return view.consents[key]?.granted ?? false;
  }

  return (
    <div style={{ fontFamily: F.body, color: "var(--t1)", paddingBottom: 60 }}>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 820, color: "var(--t1)", letterSpacing: "-.025em", lineHeight: 1.15, margin: 0 }}>
          Privacy &amp; consents
        </h1>
        <p style={{ fontSize: 14, color: "var(--t2)", marginTop: 6, maxWidth: 740, lineHeight: 1.55 }}>
          You&apos;re in control of your data. Manage what you&apos;ve agreed to share, see your full
          consent history, and request a copy or deletion of your data anytime.
        </p>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--s3)", marginBottom: 22 }}>
        <SubTab cur={tab === "preferences"} onClick={() => setTab("preferences")}>Consent preferences</SubTab>
        <SubTab cur={tab === "history"} onClick={() => setTab("history")} count={view.history.length}>History</SubTab>
        <SubTab cur={tab === "requests"} onClick={() => setTab("requests")} count={view.dsars.length}>Your data</SubTab>
      </div>

      {error && (
        <div style={{ background: "var(--dg-s)", border: "1px solid var(--dg-s)", borderRadius: 10, padding: "10px 14px", color: "var(--dg-t)", fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {tab === "preferences" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {CONSENT_CATALOG.map((meta) => {
            const granted = isGranted(meta.id);
            return (
              <div
                key={meta.id}
                style={{
                  background: meta.required ? "linear-gradient(160deg,var(--s2) 0%,var(--s1) 60%)" : "var(--s1)",
                  border: "1px solid var(--s3)",
                  borderRadius: 14,
                  padding: "18px 22px",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 18,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 700, color: "var(--t1)", letterSpacing: "-.01em" }}>
                      {meta.label}
                    </div>
                    {meta.required && (
                      <span style={{ fontFamily: F.display, fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", background: "var(--s2)", color: "var(--t3)", padding: "2px 8px", borderRadius: 999 }}>
                        Required
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.55, maxWidth: 560 }}>
                    {meta.description}
                  </div>
                </div>
                <Toggle
                  on={granted}
                  locked={meta.required}
                  disabled={pending}
                  onChange={(next) => {
                    if (!meta.required) toggleConsent(meta.id, next);
                  }}
                />
              </div>
            );
          })}

          <div style={{ display: "flex", gap: 12, padding: "14px 16px", background: "var(--in-s)", border: "1px solid var(--in-s)", borderRadius: 10, marginTop: 6 }}>
            <div style={{ color: "var(--in-t)", flexShrink: 0, marginTop: 2 }}><IconAlert /></div>
            <div style={{ fontSize: 13, color: "var(--in-t)", lineHeight: 1.55 }}>
              Changes here apply going forward. They don&apos;t delete data we&apos;ve already collected — for that, use <strong>Your data → Request deletion</strong>.
            </div>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div style={{ background: "var(--s1)", border: "1px solid var(--s3)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--s3)" }}>
            <div>
              <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 700, color: "var(--t1)", letterSpacing: "-.01em" }}>
                Consent history
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
                Every time you&apos;ve granted, revoked, or updated a consent
              </div>
            </div>
          </div>
          {view.history.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center" }}>
              <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 680, color: "var(--t1)", marginBottom: 5 }}>
                No history yet
              </div>
              <div style={{ fontSize: 13, color: "var(--t2)" }}>
                Toggle a consent in the Preferences tab to start the timeline.
              </div>
            </div>
          ) : (
            <div style={{ padding: "12px 18px" }}>
              {view.history.map((h) => (
                <div
                  key={h.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "160px 18px 1fr",
                    gap: 16,
                    padding: "12px 0",
                    borderBottom: "1px solid var(--s3)",
                  }}
                >
                  <div style={{ fontFamily: F.mono, fontSize: 12, color: "var(--t3)" }}>
                    {formatDateTime(h.occurredAt)}
                  </div>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: h.granted ? "var(--ac)" : "var(--dg)",
                      margin: "6px 4px",
                    }}
                  />
                  <div>
                    <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 680, color: "var(--t1)" }}>
                      {h.granted ? "Granted" : "Revoked"} · {consentLabelFor(h.consentType)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
                      via {h.source}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "requests" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 22 }}>
            <ActionCard
              title="Request a copy of your data"
              desc="We'll prepare a structured export of everything we hold about you and email you a secure download link within 30 days."
              cta="Request access copy"
              onClick={() => setRequestOpen("access")}
            />
            <ActionCard
              title="Correct your information"
              desc="Spot something wrong in our records? Tell us what to fix and our Privacy Officer will follow up to confirm and update."
              cta="Request correction"
              onClick={() => setRequestOpen("rectification")}
            />
            <ActionCard
              title="Portable export"
              desc="A machine-readable JSON archive of your data, suitable for transfer to another service."
              cta="Request portable export"
              onClick={() => setRequestOpen("portability")}
            />
            <ActionCard
              title="Request deletion"
              desc="We'll delete your personal data within 30 days, except records we're legally required to retain (e.g. tax records for 7 years)."
              cta="Request deletion"
              danger
              onClick={() => setRequestOpen("deletion")}
            />
          </div>

          <div style={{ background: "var(--s1)", border: "1px solid var(--s3)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--s3)" }}>
              <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 700, color: "var(--t1)", letterSpacing: "-.01em" }}>
                Active requests
              </div>
              <div style={{ fontSize: 12, color: "var(--t3)", marginTop: 2 }}>
                Requests you&apos;ve made about your data
              </div>
            </div>
            {view.dsars.length === 0 ? (
              <div style={{ padding: "32px 24px", textAlign: "center", color: "var(--t2)", fontSize: 13 }}>
                You haven&apos;t submitted any privacy requests yet.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Reference", "Type", "Submitted", "Status", "SLA"].map((h) => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {view.dsars.map((d) => {
                    const closed = d.status === "completed" || d.status === "rejected";
                    return (
                      <tr key={d.id} style={{ borderTop: "1px solid var(--s3)" }}>
                        <td style={tdStyle}><span style={{ fontFamily: F.mono, fontSize: 12, color: "var(--t2)" }}>{d.referenceCode}</span></td>
                        <td style={tdStyle}><Pill tone="acc">{REQUEST_TYPE_LABEL[d.requestType]}</Pill></td>
                        <td style={{ ...tdStyle, color: "var(--t2)", fontSize: 12.5 }}>{formatDate(d.submittedAt)}</td>
                        <td style={tdStyle}><Pill tone={d.status === "completed" ? "ok" : d.status === "rejected" ? "muted" : d.status === "in_progress" ? "info" : "warn"}>{STATUS_LABEL[d.status]}</Pill></td>
                        <td style={tdStyle}>
                          {closed ? (
                            <Pill tone="muted">Closed</Pill>
                          ) : (
                            <Pill tone={d.daysRemaining <= 3 ? "danger" : d.daysRemaining <= 10 ? "warn" : "ok"}>{d.daysRemaining}d left</Pill>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {requestOpen && (
        <RequestModal
          requestType={requestOpen}
          pending={pending}
          onClose={() => setRequestOpen(null)}
          onSubmit={async (description) => {
            setError(null);
            try {
              const res = await fetch("/api/privacy/dsar/authenticated", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  requestType: requestOpen,
                  description,
                }),
              });
              const json = await res.json().catch(() => null);
              if (!res.ok || !json?.ok) {
                setError(json?.message ?? "Could not submit request.");
                return;
              }
              setSubmittedDsar(json.referenceCode as string);
              setRequestOpen(null);
              startTransition(() => router.refresh());
            } catch {
              setError("Network error.");
            }
          }}
        />
      )}
      {submittedDsar && (
        <SuccessToast
          referenceCode={submittedDsar}
          onClose={() => setSubmittedDsar(null)}
        />
      )}
    </div>
  );
}

function consentLabelFor(key: ConsentTypeKey): string {
  return CONSENT_CATALOG.find((c) => c.id === key)?.label ?? key;
}

function SubTab({ cur, onClick, count, children }: { cur: boolean; onClick: () => void; count?: number; children: React.ReactNode }) {
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
        <span style={{ fontFamily: F.mono, fontSize: 11, fontWeight: 500, background: cur ? "var(--ac-s)" : "var(--s2)", color: cur ? "var(--ac-t)" : "var(--t2)", padding: "1px 7px", borderRadius: 999 }}>
          {count}
        </span>
      )}
    </button>
  );
}

function Toggle({ on, locked, disabled, onChange }: { on: boolean; locked?: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      onClick={() => !locked && !disabled && onChange(!on)}
      aria-pressed={on}
      style={{
        all: "unset",
        position: "relative",
        width: 44,
        height: 24,
        borderRadius: 999,
        background: on ? "var(--ac)" : "var(--s4)",
        cursor: locked ? "not-allowed" : "pointer",
        opacity: locked ? 0.55 : 1,
        flexShrink: 0,
        transition: "background 120ms",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.2)",
          transform: on ? "translateX(20px)" : "translateX(0)",
          transition: "transform 120ms",
        }}
      />
    </button>
  );
}

function ActionCard({ title, desc, cta, danger, onClick }: { title: string; desc: string; cta: string; danger?: boolean; onClick: () => void }) {
  return (
    <div style={{ background: "var(--s1)", border: "1px solid var(--s3)", borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: danger ? "var(--dg-s)" : "var(--ac-s)", color: danger ? "var(--dg-t)" : "var(--ac-t)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {danger ? <IconTrash /> : <IconDownload />}
      </div>
      <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 700, color: "var(--t1)", marginTop: 4 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: "var(--t2)", lineHeight: 1.55, flex: 1 }}>{desc}</div>
      <button
        onClick={onClick}
        style={{
          all: "unset",
          cursor: "pointer",
          fontFamily: F.display,
          fontSize: 12.5,
          fontWeight: 620,
          color: danger ? "var(--dg-t)" : "var(--ac-t)",
          marginTop: 6,
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
        }}
      >
        {cta} →
      </button>
    </div>
  );
}

function RequestModal({
  requestType,
  pending,
  onClose,
  onSubmit,
}: {
  requestType: "access" | "deletion" | "rectification" | "portability";
  pending: boolean;
  onClose: () => void;
  onSubmit: (description: string) => Promise<void>;
}) {
  const [description, setDescription] = useState("");
  const canSubmit = description.trim().length >= 10 && !pending;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(12,14,20,.5)", zIndex: 90, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "8vh 18px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--s1)", borderRadius: 18, maxWidth: 560, width: "100%", overflow: "hidden", boxShadow: "var(--shmd)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--s3)" }}>
          <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 740, color: "var(--t1)", letterSpacing: "-.018em" }}>
            {REQUEST_TYPE_LABEL[requestType]} request
          </div>
          <div style={{ fontSize: 12.5, color: "var(--t2)", marginTop: 3 }}>
            Submitted to the Privacy Officer with a 30-day SLA.
          </div>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <label style={{ fontFamily: F.display, fontSize: 12, fontWeight: 620, color: "var(--t1)" }}>
            Description <span style={{ color: "var(--dg)" }}>*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Tell us what you're looking for. Specifics like project names and timeframes help us respond faster."
            style={{ marginTop: 6, width: "100%", boxSizing: "border-box", fontFamily: F.body, fontSize: 13.5, color: "var(--t1)", border: "1px solid var(--s3)", background: "var(--s1)", borderRadius: 6, padding: "9px 12px", resize: "vertical", minHeight: 110 }}
          />
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--s3)", background: "var(--s2)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ all: "unset", cursor: "pointer", fontFamily: F.display, fontSize: 13, fontWeight: 620, color: "var(--t2)", padding: "7px 14px", borderRadius: 6 }}>Cancel</button>
          <button
            disabled={!canSubmit}
            onClick={() => onSubmit(description.trim())}
            style={{
              all: "unset",
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontFamily: F.display,
              fontSize: 13,
              fontWeight: 620,
              color: "#fff",
              background: canSubmit ? "var(--ac)" : "var(--s4)",
              padding: "7px 14px",
              borderRadius: 6,
            }}
          >
            Submit request
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessToast({ referenceCode, onClose }: { referenceCode: string; onClose: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 100,
        background: "var(--t1)",
        color: "#fff",
        fontFamily: F.display,
        fontSize: 13,
        fontWeight: 600,
        padding: "11px 16px",
        borderRadius: 10,
        boxShadow: "var(--shmd)",
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      Request submitted · <span style={{ fontFamily: F.mono }}>{referenceCode}</span>
      <button
        onClick={onClose}
        style={{ all: "unset", cursor: "pointer", color: "#fff", opacity: 0.7, marginLeft: 6 }}
      >
        ✕
      </button>
    </div>
  );
}

function Pill({ tone, children }: { tone: "ok" | "warn" | "danger" | "info" | "muted" | "acc"; children: React.ReactNode }) {
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
    <span style={{ fontFamily: F.display, fontSize: 10.5, fontWeight: 700, letterSpacing: ".02em", padding: "3px 9px", borderRadius: 999, textTransform: "uppercase", background: p.bg, color: p.fg }}>
      {children}
    </span>
  );
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
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}
function formatDateTime(d: Date): string {
  return d.toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function IconAlert() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
function IconDownload() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}
