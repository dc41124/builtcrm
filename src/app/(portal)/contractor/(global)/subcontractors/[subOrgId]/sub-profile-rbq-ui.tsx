"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { I } from "@/components/rbq/icons";
import type { SubProfileView } from "@/domain/loaders/sub-profile";

import "../../../rbq.css";

// Step 66 — Subcontractor profile + RBQ widget client UI.
//
// Direct port of View 01 from
// docs/prototypes/builtcrm_rbq_verification_paired.jsx. The portal
// chrome (sidebar + top bar) is provided by the contractor layout, so
// only the in-content classes from the prototype are rendered here.
// All class names match the prototype 1:1.

type ToneClass = "valid" | "expiring" | "expired" | "notFound" | "suspended" | "noNumber";

const STATE_LABEL_PREFIX: Record<ToneClass, string> = {
  valid: "RBQ License · Active",
  expiring: "RBQ License · Expiring",
  expired: "RBQ License · Expired",
  notFound: "RBQ License · Not found in registry",
  suspended: "RBQ License · Suspended",
  noNumber: "RBQ Verification",
};

function deriveStateClass(view: SubProfileView): ToneClass {
  if (!view.subOrg.rbqNumber) return "noNumber";
  const r = view.rbq;
  if (!r) return "noNumber";
  if (r.status === "not_found") return "notFound";
  if (r.status === "expired") return "expired";
  if (r.status === "suspended") return "suspended";
  if (r.expiringSoon) return "expiring";
  return "valid";
}

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
  const stateClass = deriveStateClass(view);
  const [refreshing, setRefreshing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rbqInput, setRbqInput] = useState(view.subOrg.rbqNumber ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isQuebec = view.hasQuebecProject;
  const initials = (view.subOrg.legalName ?? view.subOrg.name)
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase() || "??";
  const r = view.rbq;
  const sub = view.subOrg;
  const expiryDays = r?.daysToExpiry ?? null;

  async function refresh() {
    if (!sub.rbqNumber) return;
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/contractor/rbq/refresh/${encodeURIComponent(sub.rbqNumber)}`,
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
      setError("Enter the RBQ number as 10 digits (####-####-##), e.g. 5641-9032-01.");
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
    <div className="rbq-page">
      <div className="content">
        {/* Breadcrumb (replaces prototype's portal top bar) */}
        <div className="pg-bc">
          <Link href={backHref} className="lk">Subcontractors</Link>
          <span className="sep">/</span>
          <span className="cur">{sub.legalName ?? sub.name}</span>
        </div>

        {/* Sub profile head */}
        <div className="sp-head">
          <div className="sp-avt">{initials}</div>
          <div className="sp-info">
            <div className="legal">{sub.legalName ?? sub.name}</div>
            <div className="short">
              {sub.name}
              {sub.primaryTrade ? ` · ${sub.primaryTrade}` : ""}
            </div>
            <div className="meta">
              {sub.primaryContactName && (
                <span>
                  {I.user}
                  {sub.primaryContactName}
                  {sub.primaryContactTitle ? ` · ${sub.primaryContactTitle}` : ""}
                </span>
              )}
              {sub.primaryContactEmail && (
                <span>
                  {I.mail}
                  <span style={{ fontFamily: "var(--fm)", fontSize: 12 }}>
                    {sub.primaryContactEmail}
                  </span>
                </span>
              )}
              {sub.primaryContactPhone && (
                <span>{I.phone}{sub.primaryContactPhone}</span>
              )}
              {(sub.addr1 || sub.city) && (
                <span>
                  {I.pin}
                  {[sub.addr1, sub.city, sub.stateRegion, sub.postalCode]
                    .filter((p) => p)
                    .join(", ")}
                </span>
              )}
            </div>
            <div className="pills">
              <span className="pill ok">{I.check} Onboarded</span>
              {view.activeAssignments.length > 0 && (
                <span className="pill acc">
                  {view.activeAssignments.length} active project
                  {view.activeAssignments.length === 1 ? "" : "s"}
                </span>
              )}
              {view.joinedAt && (
                <span className="pill muted">
                  Joined{" "}
                  {view.joinedAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
              {isQuebec && (
                <span className="pill info">
                  {I.qcFlag}
                  <span style={{ marginLeft: 1 }}>QC project</span>
                </span>
              )}
            </div>
          </div>
          <div className="sp-head-acts">
            <Link
              href={prequalHref}
              className="btn sec sm"
              style={{ textDecoration: "none" }}
            >
              {I.fileText} Prequalification history
            </Link>
            <div className="sp-stats">
              <div className="sp-stat">
                <div className="v">{view.activeAssignments.length}</div>
                <div className="l">Active</div>
              </div>
              <div className="sp-stat">
                <div className="v">
                  {sub.yearsInBusiness ?? "—"}
                </div>
                <div className="l">Years</div>
              </div>
              <div className="sp-stat">
                <div className="v">{sub.crewSize ?? "—"}</div>
                <div className="l">Crew</div>
              </div>
            </div>
          </div>
        </div>

        {/* Province-gated info note (only when widget is hidden) */}
        {!isQuebec && (
          <div className="note">
            <div className="ic">{I.info}</div>
            <div className="body">
              <strong>RBQ verification is hidden on this page.</strong> The
              Régie du bâtiment du Québec only licenses contractors operating
              in Quebec. The current contractor has no Quebec project with
              this sub, so the RBQ widget below is hidden. The Ontario
              equivalent — Construction Act prompt-payment compliance —
              surfaces in Step 68.
            </div>
          </div>
        )}

        <div className="sp-grid">
          {/* LEFT — RBQ widget + action prompts */}
          <div>
            <h2 className="h2" style={{ marginBottom: 12 }}>
              Compliance &amp; verification
            </h2>

            {!isQuebec ? (
              <div className="hidden-state">
                <div className="ic">{I.lock}</div>
                <div className="ti">RBQ widget hidden</div>
                <div className="desc">
                  This contractor has no Quebec project with this sub. RBQ
                  verification only renders for Quebec projects.
                </div>
              </div>
            ) : stateClass === "noNumber" ? (
              <div className="rbq-card">
                <div className="rbq-banner noNumber">
                  <div className="rbq-banner-l">
                    <div className="ic">{I.shieldLg}</div>
                    <div>
                      <div className="label">RBQ Verification</div>
                      <div className="title">
                        No RBQ number on file
                        <span className="qc">{I.qcFlag} Quebec project</span>
                      </div>
                      <div className="number">
                        Add a license number to enable verification
                      </div>
                    </div>
                  </div>
                </div>
                <div className="no-rbq">
                  <div className="ic">{I.shieldLg}</div>
                  <div className="ti">
                    Quebec contractors require an RBQ license
                  </div>
                  <div className="desc">
                    The Régie du bâtiment du Québec requires most building
                    contractors to hold a valid RBQ license. Add this
                    sub&apos;s 10-digit RBQ number to verify their license
                    status, subclasses, and expiry against the public registry.
                  </div>
                  {isAdmin && (
                    <button
                      className="btn pr"
                      onClick={() => {
                        setRbqInput("");
                        setEditOpen(true);
                      }}
                    >
                      {I.plus} Add RBQ number
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className={`rbq-card ${stateClass}`}>
                <div className={`rbq-banner ${stateClass}`}>
                  <div className="rbq-banner-l">
                    <div className="ic">
                      {stateClass === "valid" && I.shieldOk}
                      {stateClass === "expiring" && I.warnLg}
                      {stateClass === "expired" && I.shieldX}
                      {stateClass === "notFound" && I.shieldX}
                      {stateClass === "suspended" && I.shieldX}
                    </div>
                    <div>
                      <div className="label">
                        {stateClass === "valid" && STATE_LABEL_PREFIX.valid}
                        {stateClass === "expiring" && expiryDays !== null && (
                          <>RBQ License · Expiring in {expiryDays} days</>
                        )}
                        {stateClass === "expired" && expiryDays !== null && (
                          <>RBQ License · Expired {Math.abs(expiryDays)} days ago</>
                        )}
                        {stateClass === "expired" && expiryDays === null && (
                          <>RBQ License · Expired</>
                        )}
                        {stateClass === "notFound" && STATE_LABEL_PREFIX.notFound}
                        {stateClass === "suspended" && STATE_LABEL_PREFIX.suspended}
                      </div>
                      <div className="title">
                        {stateClass === "notFound"
                          ? sub.legalName ?? sub.name
                          : r?.legalName ?? sub.legalName ?? sub.name}
                        <span className="qc">
                          {I.qcFlag} Quebec project
                        </span>
                      </div>
                      <div className="number">RBQ {sub.rbqNumber}</div>
                    </div>
                  </div>
                  <div className="rbq-banner-r">
                    <div className="rbq-refresh-meta">
                      {refreshing ? (
                        <span>
                          <span className="pulse">Looking up RBQ registry…</span>
                        </span>
                      ) : (
                        <>
                          <strong>Last checked</strong>
                          <div>
                            {r?.lastCheckedAt
                              ? r.lastCheckedAt.toLocaleString()
                              : "Never"}
                          </div>
                        </>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        className="btn sec sm"
                        onClick={refresh}
                        disabled={refreshing}
                      >
                        <span className={refreshing ? "spin" : ""}>{I.refresh}</span>
                        {refreshing ? "Refreshing…" : "Refresh"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rbq-body">
                  {stateClass === "notFound" ? (
                    <div style={{ padding: "8px 0" }}>
                      <p
                        style={{
                          fontSize: 14,
                          color: "var(--t2)",
                          lineHeight: 1.6,
                          margin: "0 0 12px",
                        }}
                      >
                        The RBQ number on file (
                        <span
                          style={{
                            fontFamily: "var(--fm)",
                            color: "var(--t1)",
                          }}
                        >
                          {sub.rbqNumber}
                        </span>
                        ) does not appear in the Régie du bâtiment du Québec
                        public registry. This usually means one of:
                      </p>
                      <ul
                        style={{
                          fontSize: 13.5,
                          color: "var(--t2)",
                          lineHeight: 1.7,
                          marginTop: 0,
                          paddingLeft: 22,
                        }}
                      >
                        <li>
                          The number was entered incorrectly — verify the
                          10-digit format with the sub.
                        </li>
                        <li>
                          The license was recently issued and not yet in the
                          public dataset (typically 5–10 business days).
                        </li>
                        <li>The license has been suspended or revoked.</li>
                        <li>
                          The contractor operates under an exemption (e.g.,
                          handyman work below regulated thresholds).
                        </li>
                      </ul>
                      <div
                        style={{ marginTop: 14, display: "flex", gap: 8 }}
                      >
                        {isAdmin && (
                          <button
                            className="btn pr sm"
                            onClick={() => {
                              setRbqInput(sub.rbqNumber ?? "");
                              setEditOpen(true);
                            }}
                          >
                            {I.edit} Update RBQ number
                          </button>
                        )}
                        <a
                          className="btn sec sm"
                          href="https://www.rbq.gouv.qc.ca"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {I.ext} Open RBQ registry
                        </a>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="rbq-grid">
                        <div className="rbq-row">
                          <div className="lbl">Legal name on license</div>
                          <div className="val lg">{r?.legalName ?? "—"}</div>
                        </div>
                        <div className="rbq-row">
                          <div className="lbl">License status</div>
                          <div className="val">
                            <span
                              className={`pill lg ${
                                stateClass === "valid"
                                  ? "ok"
                                  : stateClass === "expiring"
                                    ? "warn"
                                    : "danger"
                              }`}
                            >
                              {stateClass === "valid" && I.check}
                              {stateClass === "expiring" && I.warn}
                              {(stateClass === "expired" || stateClass === "suspended") && I.x}
                              {r?.status ?? "—"}
                            </span>
                          </div>
                        </div>
                        <div className="rbq-row">
                          <div className="lbl">License number</div>
                          <div className="val mono">{sub.rbqNumber}</div>
                        </div>
                        <div className="rbq-row">
                          <div className="lbl">Issued</div>
                          <div className="val">{r?.issuedAt ?? "—"}</div>
                        </div>
                        <div className="rbq-row">
                          <div className="lbl">Expiry</div>
                          <div className="val">
                            {r?.expiryDate ?? "—"}
                            {stateClass === "expiring" && expiryDays !== null && (
                              <span
                                className="pill warn"
                                style={{ marginLeft: 8 }}
                              >
                                {I.clock} {expiryDays} days left
                              </span>
                            )}
                            {stateClass === "expired" && (
                              <span
                                className="pill danger"
                                style={{ marginLeft: 8 }}
                              >
                                {I.x} Expired
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="rbq-row">
                          <div className="lbl">
                            Subclasses ({r?.subclasses.length ?? 0})
                          </div>
                          <div
                            className="val"
                            style={{
                              fontFamily: "var(--fm)",
                              fontSize: 12.5,
                              color: "var(--ac-t)",
                            }}
                          >
                            {r?.subclasses.map((s) => s.code).join(" · ") || "—"}
                          </div>
                        </div>
                      </div>

                      {r && r.subclasses.length > 0 && (
                        <div>
                          <div className="rbq-row" style={{ marginBottom: 8 }}>
                            <div className="lbl">Authorized subclasses</div>
                          </div>
                          <div className="subclass-list">
                            {r.subclasses.map((sc) => (
                              <div className="subclass-row" key={sc.code}>
                                <span className="code">{sc.code}</span>
                                <span className="lbl">{sc.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="rbq-foot">
                  <div className="src">
                    {I.database}
                    <span>
                      Source:{" "}
                      <a
                        href="https://www.donneesquebec.ca"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        RBQ Open Data
                      </a>
                      {r?.sourceVersion && (
                        <>
                          {" · "}
                          <span className="mono">{r.sourceVersion}</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <button
                      className="ftbtn"
                      onClick={() => setHistoryOpen(true)}
                    >
                      {I.history}
                      <span>Lookup history</span>
                    </button>
                    {isAdmin && (
                      <button
                        className="ftbtn"
                        onClick={() => {
                          setRbqInput(sub.rbqNumber ?? "");
                          setEditOpen(true);
                        }}
                      >
                        {I.edit}
                        <span>Edit number</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action prompts */}
            {isQuebec &&
              sub.rbqNumber &&
              r &&
              (r.status === "expired" ||
                r.status === "not_found" ||
                r.status === "suspended") && (
                <div
                  className="card"
                  style={{ marginTop: 14, borderColor: "var(--dg-m)" }}
                >
                  <div
                    className="card-h"
                    style={{
                      background: "var(--dg-s)",
                      borderBottomColor: "var(--dg-m)",
                    }}
                  >
                    <div className="ti" style={{ color: "var(--dg-t)" }}>
                      {I.warn} Compliance action required
                    </div>
                  </div>
                  <div className="card-b">
                    <p
                      style={{
                        fontSize: 13.5,
                        color: "var(--t2)",
                        lineHeight: 1.6,
                        margin: "0 0 12px",
                      }}
                    >
                      GCs are jointly liable when a sub lacks a valid RBQ
                      license for their work category. Recommended next
                      steps:
                    </p>
                    <ul
                      style={{
                        fontSize: 13.5,
                        color: "var(--t2)",
                        lineHeight: 1.7,
                        margin: "0 0 12px",
                        paddingLeft: 22,
                      }}
                    >
                      <li>
                        Place a payment hold on this sub until license status
                        is resolved.
                      </li>
                      <li>Notify the sub directly with the issue.</li>
                      <li>
                        Pause new project assignments to this sub until
                        cleared.
                      </li>
                    </ul>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn dg sm">{I.lock} Place payment hold</button>
                      <button className="btn sec sm">{I.mail} Notify sub</button>
                      <button className="btn gh sm">Mark as acknowledged</button>
                    </div>
                  </div>
                </div>
              )}

            {isQuebec &&
              sub.rbqNumber &&
              r &&
              r.status === "active" &&
              r.expiringSoon &&
              expiryDays !== null && (
                <div
                  className="card"
                  style={{ marginTop: 14, borderColor: "var(--wr-m)" }}
                >
                  <div
                    className="card-h"
                    style={{
                      background: "var(--wr-s)",
                      borderBottomColor: "var(--wr-m)",
                    }}
                  >
                    <div className="ti" style={{ color: "var(--wr-t)" }}>
                      {I.clock} Expiry approaching
                    </div>
                  </div>
                  <div className="card-b">
                    <p
                      style={{
                        fontSize: 13.5,
                        color: "var(--t2)",
                        lineHeight: 1.6,
                        margin: "0 0 12px",
                      }}
                    >
                      This sub&apos;s license expires in{" "}
                      <strong>{expiryDays} days</strong>. The system will
                      email org admins again at 14 days, 7 days, and on the
                      day of expiry. The sub has been notified at their
                      primary contact email.
                    </p>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn pr sm">{I.mail} Send reminder</button>
                      <button className="btn sec sm">View notification history</button>
                    </div>
                  </div>
                </div>
              )}

            {error && (
              <div
                style={{
                  marginTop: 14,
                  padding: "10px 14px",
                  background: "var(--dg-s)",
                  border: "1px solid var(--dg-m)",
                  borderRadius: "var(--r-s)",
                  color: "var(--dg-t)",
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* RIGHT — side cards */}
          <div>
            <div className="side-card">
              <div className="card-h">
                <div className="ti">{I.shield} Other compliance signals</div>
              </div>
              <div className="side-list">
                <div className="side-row">
                  <div className="l">{I.fileText} Insurance (COI)</div>
                  <div className="r">
                    <span className="pill muted">Not tracked</span>
                  </div>
                </div>
                <div className="side-row">
                  <div className="l">{I.fileText} CNESST attestation</div>
                  <div className="r">
                    <span className="pill muted">Not tracked</span>
                  </div>
                </div>
                <div className="side-row">
                  <div className="l">{I.fileText} CCQ competency cards</div>
                  <div className="r">
                    <span className="pill muted">Not tracked</span>
                  </div>
                </div>
                <div className="side-row">
                  <div className="l">{I.fileText} Lien waiver template</div>
                  <div className="r">
                    <span className="pill muted">Not signed</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="side-card">
              <div className="card-h">
                <div className="ti">{I.bldg} Active assignments</div>
              </div>
              <div className="side-list">
                {view.activeAssignments.length === 0 ? (
                  <div
                    style={{
                      padding: "14px 18px",
                      color: "var(--t3)",
                      fontSize: 13,
                    }}
                  >
                    No shared project assignments yet.
                  </div>
                ) : (
                  view.activeAssignments.map((a) => (
                    <div className="side-row" key={a.projectId}>
                      <div className="l">{a.projectName}</div>
                      <div
                        className="r"
                        style={{ fontWeight: 540, color: "var(--t2)" }}
                      >
                        {a.provinceCode ?? "—"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="side-card">
              <div className="card-h">
                <div className="ti">{I.info} About RBQ verification</div>
              </div>
              <div
                className="card-b"
                style={{
                  fontSize: 12.5,
                  color: "var(--t2)",
                  lineHeight: 1.6,
                }}
              >
                <p style={{ margin: "0 0 10px" }}>
                  License data is sourced from the{" "}
                  <strong>RBQ Open Data feed</strong> (donneesquebec.ca),
                  refreshed nightly.
                </p>
                <p style={{ margin: "0 0 10px" }}>
                  This badge is a <strong>convenience signal</strong>, not
                  legal certification. The General Contractor remains
                  responsible for verifying licenses for their projects.
                </p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--t3)" }}>
                  Cache refreshes nightly at 03:00 EST.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit RBQ modal */}
      {editOpen && (
        <div className="modal-mask" onClick={() => setEditOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-h">
              <div>
                <div className="ti">
                  {sub.rbqNumber ? "Update" : "Add"} RBQ license number
                </div>
                <div className="sub">
                  10-digit format · {sub.legalName ?? sub.name}
                </div>
              </div>
              <button
                className="icon-btn"
                onClick={() => setEditOpen(false)}
                aria-label="Close"
              >
                {I.x}
              </button>
            </div>
            <div className="modal-b">
              <div className="field">
                <label>
                  RBQ license number <span className="req">*</span>
                </label>
                <input
                  className="input mono"
                  value={rbqInput}
                  onChange={(e) => setRbqInput(e.target.value)}
                  placeholder="0000-0000-00"
                  maxLength={12}
                />
                <span className="hint">
                  Format: four digits, dash, four digits, dash, two digits.
                  The first digit is typically 5 for active licenses.
                </span>
              </div>
              <div className="note">
                <div className="ic">{I.info}</div>
                <div className="body">
                  Once saved, the system will look this number up in the RBQ
                  registry within 30 seconds and update the badge. If the
                  number isn&apos;t found, the badge will turn red and you&apos;ll
                  see options to re-enter or contact the sub.
                </div>
              </div>
              {error && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "var(--dg-s)",
                    border: "1px solid var(--dg-m)",
                    borderRadius: "var(--r-s)",
                    color: "var(--dg-t)",
                    fontSize: 13,
                  }}
                >
                  {error}
                </div>
              )}
            </div>
            <div className="modal-f">
              <button
                className="btn gh"
                onClick={() => setEditOpen(false)}
                disabled={pending}
              >
                Cancel
              </button>
              <button
                className="btn pr"
                onClick={saveRbqNumber}
                disabled={pending || !isAdmin}
              >
                {I.refresh} Save &amp; verify
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History drawer */}
      {historyOpen && stateClass !== "noNumber" && (
        <>
          <div
            className="drawer-mask"
            onClick={() => setHistoryOpen(false)}
          />
          <div className="drawer">
            <div className="drawer-h">
              <div>
                <div className="ti">RBQ lookup history</div>
                <div className="id">
                  {sub.rbqNumber} · {sub.legalName ?? sub.name}
                </div>
              </div>
              <button
                className="icon-btn"
                onClick={() => setHistoryOpen(false)}
                aria-label="Close"
              >
                {I.x}
              </button>
            </div>
            <div className="drawer-b">
              <div className="tl">
                <div className="tl-row">
                  <div className="ts">
                    {r?.lastCheckedAt
                      ? r.lastCheckedAt.toLocaleString()
                      : "—"}
                  </div>
                  <div>
                    <div className="ev">
                      Cache refreshed{r ? ` — status: ${r.status}` : ""}
                    </div>
                    <div className="src">via {r?.sourceVersion ?? "stub fetcher"}</div>
                  </div>
                </div>
                <div className="tl-row">
                  <div className="ts">—</div>
                  <div>
                    <div className="ev">Number recorded on profile</div>
                    <div className="src">
                      via PATCH /api/contractor/subcontractors/.../rbq-number
                    </div>
                  </div>
                </div>
              </div>
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--t3)",
                  marginTop: 18,
                  lineHeight: 1.55,
                }}
              >
                Lookup history is captured in the audit log under the{" "}
                <span style={{ fontFamily: "var(--fm)" }}>rbq.*</span>{" "}
                action namespace. Includes nightly refreshes, manual
                refreshes by org members, and any system-triggered re-checks.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
