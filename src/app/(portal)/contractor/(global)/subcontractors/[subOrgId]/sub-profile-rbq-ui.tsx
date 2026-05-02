"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { SubProfileView } from "@/domain/loaders/sub-profile";

// Step 66 — Subcontractor profile + RBQ widget client UI.
//
// Direct port of View 01 from
// docs/prototypes/builtcrm_rbq_verification_paired.jsx, adapted to the
// real data model. Contractor-purple accent, DM Sans / Instrument Sans /
// JetBrains Mono per the design system.

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};
const PURPLE = "#5b4fc7";

type ToneClass = "ok" | "warn" | "danger" | "muted";

function deriveTone(view: SubProfileView): ToneClass {
  if (!view.subOrg.rbqNumber) return "muted";
  const r = view.rbq;
  if (!r) return "muted";
  if (r.status === "expired" || r.status === "not_found") return "danger";
  if (r.status === "suspended") return "danger";
  if (r.expiringSoon) return "warn";
  return "ok";
}

function deriveLabel(view: SubProfileView): string {
  if (!view.subOrg.rbqNumber) return "No RBQ on file";
  const r = view.rbq;
  if (!r) return "Pending lookup";
  if (r.status === "not_found") return "Not found in registry";
  if (r.status === "expired" && r.daysToExpiry !== null) {
    return `Expired ${Math.abs(r.daysToExpiry)} days ago`;
  }
  if (r.status === "expired") return "License expired";
  if (r.status === "suspended") return "License suspended";
  if (r.expiringSoon && r.daysToExpiry !== null) {
    return `Expiring in ${r.daysToExpiry} days`;
  }
  return "License active";
}

const TONE_BG: Record<ToneClass, string> = {
  ok: "#edf7f1",
  warn: "#fdf4e6",
  danger: "#fdeaea",
  muted: "#f3f4f6",
};
const TONE_BORDER: Record<ToneClass, string> = {
  ok: "#b8dfc7",
  warn: "#f0d9a8",
  danger: "#f0bcbc",
  muted: "#e2e5e9",
};
const TONE_TEXT: Record<ToneClass, string> = {
  ok: "#1e6b46",
  warn: "#96600f",
  danger: "#a52e2e",
  muted: "#6b655b",
};
const TONE_ICON_BG: Record<ToneClass, string> = {
  ok: "#2d8a5e",
  warn: "#c17a1a",
  danger: "#c93b3b",
  muted: "#d1d5db",
};

const RBQ_FORMAT = /^\d{4}-\d{4}-\d{2}$/;

export function SubProfileRbqUI({
  subOrgId,
  view,
  isAdmin,
  prequalHref,
  backHref,
}: {
  subOrgId: string;
  view: SubProfileView;
  isAdmin: boolean;
  prequalHref: string;
  backHref: string;
}) {
  const router = useRouter();
  const tone = deriveTone(view);
  const label = deriveLabel(view);
  const [refreshing, setRefreshing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [rbqInput, setRbqInput] = useState(view.subOrg.rbqNumber ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const showRbqWidget = view.hasQuebecProject;
  const initials = (view.subOrg.legalName ?? view.subOrg.name)
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function refresh() {
    if (!view.subOrg.rbqNumber) return;
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/contractor/rbq/refresh/${encodeURIComponent(view.subOrg.rbqNumber)}`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.message ?? "Refresh failed.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error during refresh.");
    } finally {
      setRefreshing(false);
    }
  }

  async function saveRbqNumber() {
    setError(null);
    const trimmed = rbqInput.trim();
    if (trimmed.length > 0 && !RBQ_FORMAT.test(trimmed)) {
      setError(
        "Enter the RBQ number as 10 digits (####-####-##), e.g. 5641-9032-01.",
      );
      return;
    }
    try {
      const res = await fetch(
        `/api/contractor/subcontractors/${subOrgId}/rbq-number`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ rbqNumber: trimmed }),
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.message ?? "Could not update RBQ number.");
        return;
      }
      setEditOpen(false);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error.");
    }
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1240, margin: "0 auto", fontFamily: F.body, color: "#171717" }}>
      <header style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <Link
          href={backHref}
          style={{
            fontFamily: F.body,
            fontSize: 13,
            color: "#525252",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← Subcontractors
        </Link>
        <Link
          href={prequalHref}
          style={{
            fontFamily: F.display,
            fontSize: 13,
            fontWeight: 620,
            padding: "7px 14px",
            borderRadius: 8,
            background: "#f3f4f6",
            color: "#171717",
            border: "1px solid #e5e7eb",
            textDecoration: "none",
          }}
        >
          Prequalification history
        </Link>
      </header>

      {/* Identity card */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          padding: 24,
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: 22,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${PURPLE}, #3d3399)`,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: F.display,
            fontSize: 24,
            fontWeight: 740,
            letterSpacing: "-0.02em",
          }}
        >
          {initials || "??"}
        </div>
        <div>
          <div style={{ fontFamily: F.display, fontSize: 22, fontWeight: 780, letterSpacing: "-0.022em" }}>
            {view.subOrg.legalName ?? view.subOrg.name}
          </div>
          <div style={{ fontSize: 13.5, color: "#525252", marginTop: 3 }}>
            {view.subOrg.name}
            {view.subOrg.primaryTrade ? ` · ${view.subOrg.primaryTrade}` : ""}
          </div>
          <div
            style={{
              display: "flex",
              gap: 18,
              flexWrap: "wrap",
              marginTop: 14,
              fontSize: 12.5,
              color: "#525252",
            }}
          >
            {view.subOrg.primaryContactName && (
              <span>
                {view.subOrg.primaryContactName}
                {view.subOrg.primaryContactTitle ? ` · ${view.subOrg.primaryContactTitle}` : ""}
              </span>
            )}
            {view.subOrg.primaryContactEmail && (
              <span style={{ fontFamily: F.mono }}>{view.subOrg.primaryContactEmail}</span>
            )}
            {view.subOrg.primaryContactPhone && <span>{view.subOrg.primaryContactPhone}</span>}
            {view.subOrg.city && (
              <span>
                {view.subOrg.city}
                {view.subOrg.stateRegion ? `, ${view.subOrg.stateRegion}` : ""}
                {view.subOrg.postalCode ? ` ${view.subOrg.postalCode}` : ""}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            <Pill tone="ok">Onboarded</Pill>
            {view.activeAssignments.length > 0 && (
              <Pill tone="acc">
                {view.activeAssignments.length} active project
                {view.activeAssignments.length === 1 ? "" : "s"}
              </Pill>
            )}
            {view.hasQuebecProject && <Pill tone="info">Quebec project</Pill>}
            {view.joinedAt && (
              <Pill tone="muted">
                Joined {view.joinedAt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </Pill>
            )}
          </div>
        </div>
      </section>

      {/* Two-column body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.55fr 0.9fr",
          gap: 22,
          alignItems: "start",
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: F.display,
              fontSize: 18,
              fontWeight: 740,
              margin: "0 0 12px 0",
              letterSpacing: "-0.018em",
            }}
          >
            Compliance &amp; verification
          </h2>

          {!showRbqWidget ? (
            <div
              style={{
                padding: "32px 24px",
                textAlign: "center",
                background: "#f3f4f6",
                border: "1px dashed #e2e5e9",
                borderRadius: 14,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: "#fff",
                  color: "#9c958a",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 10,
                }}
              >
                {iconLock()}
              </div>
              <div style={{ fontFamily: F.display, fontSize: 14.5, fontWeight: 700, color: "#525252", marginBottom: 4 }}>
                RBQ widget hidden
              </div>
              <div style={{ fontSize: 13, color: "#9c958a", maxWidth: 360, margin: "0 auto" }}>
                The Régie du bâtiment du Québec only licenses contractors operating
                in Quebec. RBQ verification renders only when this sub is on a
                Quebec project.
              </div>
            </div>
          ) : !view.subOrg.rbqNumber ? (
            <RbqEmptyState
              onAdd={() => {
                setRbqInput("");
                setEditOpen(true);
              }}
              isAdmin={isAdmin}
            />
          ) : (
            <RbqWidget
              tone={tone}
              label={label}
              view={view}
              refreshing={refreshing}
              onRefresh={refresh}
              onEdit={() => {
                setRbqInput(view.subOrg.rbqNumber ?? "");
                setEditOpen(true);
              }}
              isAdmin={isAdmin}
            />
          )}

          {/* Action prompts for problem states */}
          {showRbqWidget && view.subOrg.rbqNumber && view.rbq && (view.rbq.status === "expired" || view.rbq.status === "not_found" || view.rbq.status === "suspended") && (
            <ActionPrompt
              tone="danger"
              title="Compliance action required"
              body="GCs are jointly liable when a sub lacks a valid RBQ license for their work category. Recommended next steps: place a payment hold on this sub, notify them directly, and pause new project assignments until cleared."
            />
          )}

          {showRbqWidget && view.subOrg.rbqNumber && view.rbq && view.rbq.status === "active" && view.rbq.expiringSoon && view.rbq.daysToExpiry !== null && (
            <ActionPrompt
              tone="warn"
              title="Expiry approaching"
              body={`This sub's license expires in ${view.rbq.daysToExpiry} days. The system will email org admins again at 14 days, 7 days, and on the day of expiry.`}
            />
          )}

          {error && (
            <div
              style={{
                marginTop: 14,
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
        </div>

        {/* Side cards */}
        <div>
          <SideCard title="Active assignments">
            {view.activeAssignments.length === 0 ? (
              <div style={{ padding: "14px 18px", color: "#9c958a", fontSize: 13 }}>
                No shared project assignments yet.
              </div>
            ) : (
              view.activeAssignments.map((a) => (
                <div
                  key={a.projectId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 18px",
                    borderBottom: "1px solid #e5e7eb",
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: "#171717" }}>{a.projectName}</span>
                  <span style={{ color: "#9c958a", fontFamily: F.mono, fontSize: 11 }}>
                    {a.provinceCode ?? "—"}
                  </span>
                </div>
              ))
            )}
          </SideCard>

          <SideCard title="About RBQ verification">
            <div style={{ padding: "14px 18px", fontSize: 12.5, color: "#525252", lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 10px" }}>
                License data is sourced from the <strong>RBQ Open Data feed</strong>{" "}
                (donneesquebec.ca), refreshed nightly.
              </p>
              <p style={{ margin: "0 0 10px" }}>
                This badge is a <strong>convenience signal</strong>, not legal
                certification. The General Contractor remains responsible for
                verifying licenses for their projects.
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#9c958a" }}>
                Cache refreshes nightly at 03:00 EST.
              </p>
            </div>
          </SideCard>
        </div>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div
          onClick={() => setEditOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(12,14,20,.5)",
            zIndex: 90,
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            padding: "8vh 18px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 18,
              maxWidth: 520,
              width: "100%",
              boxShadow: "0 4px 16px rgba(26,23,20,.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 22px",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <div style={{ fontFamily: F.display, fontSize: 17, fontWeight: 740 }}>
                {view.subOrg.rbqNumber ? "Update" : "Add"} RBQ license number
              </div>
              <div style={{ fontSize: 12.5, color: "#525252", marginTop: 3 }}>
                10-digit format · {view.subOrg.legalName ?? view.subOrg.name}
              </div>
            </div>
            <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontFamily: F.display, fontSize: 12, fontWeight: 620 }}>
                  RBQ license number
                </label>
                <input
                  value={rbqInput}
                  onChange={(e) => setRbqInput(e.target.value)}
                  placeholder="0000-0000-00"
                  maxLength={12}
                  style={{
                    fontFamily: F.mono,
                    fontSize: 13.5,
                    border: "1px solid #e2e5e9",
                    borderRadius: 6,
                    padding: "9px 12px",
                    letterSpacing: "0.04em",
                  }}
                />
                <span style={{ fontSize: 12, color: "#9c958a" }}>
                  Format: four digits, dash, four digits, dash, two digits.
                </span>
              </div>
              {error && (
                <div
                  style={{
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
            </div>
            <div
              style={{
                padding: "14px 22px",
                borderTop: "1px solid #e5e7eb",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                background: "#f3f4f6",
              }}
            >
              <button
                onClick={() => setEditOpen(false)}
                style={btn("ghost")}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                onClick={saveRbqNumber}
                style={btn("primary")}
                disabled={pending || !isAdmin}
              >
                Save &amp; verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RbqWidget({
  tone,
  label,
  view,
  refreshing,
  onRefresh,
  onEdit,
  isAdmin,
}: {
  tone: ToneClass;
  label: string;
  view: SubProfileView;
  refreshing: boolean;
  onRefresh: () => void;
  onEdit: () => void;
  isAdmin: boolean;
}) {
  const r = view.rbq;
  const headerBg = `linear-gradient(160deg, ${TONE_BG[tone]} 0%, #fff 70%)`;
  return (
    <div
      style={{
        borderRadius: 18,
        overflow: "hidden",
        border: `1px solid ${TONE_BORDER[tone]}`,
        background: "#fff",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          background: headerBg,
          borderBottom: `1px solid ${TONE_BORDER[tone]}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background: TONE_ICON_BG[tone],
              color: "#fff",
            }}
          >
            {tone === "ok" ? iconShield() : tone === "warn" ? iconWarn() : iconShieldX()}
          </div>
          <div>
            <div
              style={{
                fontFamily: F.display,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: TONE_TEXT[tone],
              }}
            >
              RBQ License · {label}
            </div>
            <div
              style={{
                fontFamily: F.display,
                fontSize: 18,
                fontWeight: 780,
                color: "#171717",
                letterSpacing: "-0.018em",
                marginTop: 2,
              }}
            >
              {r?.legalName ?? view.subOrg.legalName ?? view.subOrg.name}
            </div>
            <div
              style={{
                fontFamily: F.mono,
                fontSize: 14,
                fontWeight: 560,
                color: "#171717",
                marginTop: 4,
                letterSpacing: "0.04em",
              }}
            >
              RBQ {view.subOrg.rbqNumber}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 11, color: "#9c958a", textAlign: "right", lineHeight: 1.35 }}>
            <strong style={{ fontFamily: F.display, fontWeight: 600, color: "#525252" }}>
              Last checked
            </strong>
            <div>
              {r?.lastCheckedAt
                ? r.lastCheckedAt.toLocaleString()
                : "Never"}
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              style={btn("secondary", "sm")}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          )}
        </div>
      </div>

      {r && r.status !== "not_found" ? (
        <div style={{ padding: "20px 22px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 18,
              marginBottom: 20,
            }}
          >
            <KV label="Legal name on license" value={r.legalName ?? "—"} large />
            <KV
              label="License status"
              value={
                <span
                  style={{
                    display: "inline-block",
                    fontFamily: F.display,
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: TONE_BG[tone],
                    color: TONE_TEXT[tone],
                    letterSpacing: "0.02em",
                    textTransform: "uppercase",
                  }}
                >
                  {r.status}
                </span>
              }
            />
            <KV label="License number" value={view.subOrg.rbqNumber ?? "—"} mono />
            <KV label="Issued" value={r.issuedAt ?? "—"} />
            <KV
              label="Expiry"
              value={
                <>
                  {r.expiryDate ?? "—"}
                  {r.expiringSoon && r.daysToExpiry !== null && (
                    <span style={{ marginLeft: 8, fontSize: 11.5, color: TONE_TEXT.warn, fontWeight: 700 }}>
                      {r.daysToExpiry} days left
                    </span>
                  )}
                </>
              }
            />
            <KV
              label={`Subclasses (${r.subclasses.length})`}
              value={
                <span style={{ fontFamily: F.mono, fontSize: 12.5, color: PURPLE }}>
                  {r.subclasses.map((s) => s.code).join(" · ") || "—"}
                </span>
              }
            />
          </div>

          {r.subclasses.length > 0 && (
            <div>
              <div style={{ fontFamily: F.display, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9c958a", marginBottom: 8 }}>
                Authorized subclasses
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {r.subclasses.map((sc) => (
                  <div
                    key={sc.code}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      background: "#f3f4f6",
                      borderRadius: 6,
                      border: "1px solid #e2e5e9",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: F.mono,
                        fontSize: 12,
                        fontWeight: 600,
                        color: PURPLE,
                        background: "#eeedfb",
                        padding: "3px 8px",
                        borderRadius: 4,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {sc.code}
                    </span>
                    <span style={{ fontSize: 13.5, color: "#171717" }}>{sc.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : r && r.status === "not_found" ? (
        <div style={{ padding: "20px 22px" }}>
          <p style={{ fontSize: 14, color: "#525252", lineHeight: 1.6, margin: "0 0 12px" }}>
            The RBQ number on file (
            <span style={{ fontFamily: F.mono, color: "#171717" }}>
              {view.subOrg.rbqNumber}
            </span>
            ) does not appear in the Régie du bâtiment du Québec public registry.
            This usually means one of:
          </p>
          <ul style={{ fontSize: 13.5, color: "#525252", lineHeight: 1.7, paddingLeft: 22, marginTop: 0 }}>
            <li>The number was entered incorrectly — verify the 10-digit format with the sub.</li>
            <li>The license was recently issued and not yet in the public dataset (5–10 business days).</li>
            <li>The license has been suspended or revoked.</li>
            <li>The contractor operates under an exemption.</li>
          </ul>
        </div>
      ) : null}

      {/* Footer with attribution */}
      <div
        style={{
          padding: "12px 22px",
          background: "#f3f4f6",
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          flexWrap: "wrap",
          fontSize: 12,
          color: "#9c958a",
        }}
      >
        <div>
          Source:{" "}
          <a
            href="https://www.donneesquebec.ca"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#525252", borderBottom: "1px solid #e2e5e9", textDecoration: "none" }}
          >
            RBQ Open Data
          </a>
          {r?.sourceVersion && (
            <span style={{ fontFamily: F.mono, fontSize: 11.5, color: "#525252", marginLeft: 8 }}>
              · {r.sourceVersion}
            </span>
          )}
        </div>
        {isAdmin && (
          <span
            style={{ cursor: "pointer", textDecoration: "underline" }}
            onClick={onEdit}
          >
            Edit number
          </span>
        )}
      </div>
    </div>
  );
}

function RbqEmptyState({ onAdd, isAdmin }: { onAdd: () => void; isAdmin: boolean }) {
  return (
    <div
      style={{
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid #e2e5e9",
        background: "#fff",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          background: "#f3f4f6",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: "#d1d5db",
            color: "#6b655b",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {iconShield()}
        </div>
        <div>
          <div
            style={{
              fontFamily: F.display,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              color: "#9c958a",
            }}
          >
            RBQ Verification
          </div>
          <div style={{ fontFamily: F.display, fontSize: 18, fontWeight: 780, color: "#171717", marginTop: 2 }}>
            No RBQ number on file
          </div>
        </div>
      </div>
      <div style={{ padding: "36px 24px", textAlign: "center" }}>
        <div style={{ fontFamily: F.display, fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
          Quebec contractors require an RBQ license
        </div>
        <div style={{ fontSize: 13.5, color: "#525252", maxWidth: 420, margin: "0 auto 16px", lineHeight: 1.55 }}>
          The Régie du bâtiment du Québec requires most building contractors to hold a valid RBQ license.
          Add this sub&apos;s 10-digit RBQ number to verify their license status, subclasses, and expiry.
        </div>
        {isAdmin && (
          <button onClick={onAdd} style={btn("primary")}>
            Add RBQ number
          </button>
        )}
      </div>
    </div>
  );
}

function ActionPrompt({ tone, title, body }: { tone: "danger" | "warn"; title: string; body: string }) {
  return (
    <div
      style={{
        marginTop: 14,
        background: "#fff",
        border: `1px solid ${TONE_BORDER[tone]}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 18px",
          background: TONE_BG[tone],
          borderBottom: `1px solid ${TONE_BORDER[tone]}`,
          fontFamily: F.display,
          fontSize: 14.5,
          fontWeight: 700,
          color: TONE_TEXT[tone],
        }}
      >
        {title}
      </div>
      <div style={{ padding: "16px 18px", fontSize: 13.5, color: "#525252", lineHeight: 1.6 }}>
        {body}
      </div>
    </div>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid #e5e7eb",
          fontFamily: F.display,
          fontSize: 14.5,
          fontWeight: 700,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function KV({
  label,
  value,
  mono,
  large,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  large?: boolean;
}) {
  return (
    <div>
      <div style={{ fontFamily: F.display, fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#9c958a", marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: large ? 16 : 14,
          color: "#171717",
          fontFamily: large ? F.display : mono ? F.mono : F.body,
          fontWeight: large ? 680 : 540,
          letterSpacing: large ? "-0.01em" : mono ? "0.03em" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Pill({ tone, children }: { tone: "ok" | "warn" | "danger" | "info" | "muted" | "acc"; children: React.ReactNode }) {
  const map = {
    ok: { bg: "#edf7f1", color: "#1e6b46" },
    warn: { bg: "#fdf4e6", color: "#96600f" },
    danger: { bg: "#fdeaea", color: "#a52e2e" },
    info: { bg: "#e8f1fa", color: "#276299" },
    muted: { bg: "#f3f4f6", color: "#6b655b" },
    acc: { bg: "#eeedfb", color: "#4a3fb0" },
  } as const;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontFamily: F.display,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
        background: map[tone].bg,
        color: map[tone].color,
      }}
    >
      {children}
    </span>
  );
}

function btn(kind: "primary" | "secondary" | "ghost", size?: "sm" | undefined): React.CSSProperties {
  const base: React.CSSProperties = {
    fontFamily: F.display,
    fontSize: size === "sm" ? 12 : 13,
    fontWeight: 620,
    padding: size === "sm" ? "5px 10px" : "7px 14px",
    borderRadius: 6,
    cursor: "pointer",
    border: "1px solid transparent",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
  if (kind === "primary") {
    return { ...base, background: PURPLE, color: "#fff" };
  }
  if (kind === "secondary") {
    return { ...base, background: "#f3f4f6", color: "#171717", borderColor: "#e2e5e9" };
  }
  return { ...base, background: "transparent", color: "#525252" };
}

function iconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function iconShieldX() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m14.5 9.5-5 5" />
      <path d="m9.5 9.5 5 5" />
    </svg>
  );
}

function iconWarn() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function iconLock() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}
