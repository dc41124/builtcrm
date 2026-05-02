"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { TI } from "@/components/t5018/icons";
import type { T5018WorkspaceView } from "@/domain/loaders/t5018";

import "../../../../tax-forms.css";

// Step 67 — T5018 admin client UI (workspace + 4 modals + audit
// drawer). HTML structure + class names match the prototype 1:1;
// styling lives in tax-forms.css. The portal layout already provides
// the sidebar + top bar, so the prototype's portal chrome is omitted.

type FilterTab = "all" | "eligible" | "below" | "missing";
type SortKey = "name" | "total" | "count";
type SortDir = "asc" | "desc";
type FlowState = "workspace" | "confirm" | "generating" | "success";

const SLIP_STATUS_COLOR: Record<
  "eligible" | "below_threshold" | "missing_data",
  { solid: string; soft: string; label: string }
> = {
  eligible: {
    solid: "#2d8a5e",
    soft: "rgba(45,138,94,.12)",
    label: "Eligible",
  },
  below_threshold: {
    solid: "#9c958a",
    soft: "rgba(156,149,138,.12)",
    label: "Below $500",
  },
  missing_data: {
    solid: "#c93b3b",
    soft: "rgba(201,59,59,.12)",
    label: "Missing data",
  },
};

const FILING_STATUS_COLOR: Record<
  "draft" | "ready" | "generated" | "filed",
  { solid: string; soft: string; label: string }
> = {
  draft: {
    solid: "#9c958a",
    soft: "rgba(156,149,138,.12)",
    label: "Not yet generated",
  },
  ready: {
    solid: "#5b4fc7",
    soft: "rgba(91,79,199,.12)",
    label: "Ready to generate",
  },
  generated: {
    solid: "#2d8a5e",
    soft: "rgba(45,138,94,.12)",
    label: "Generated",
  },
  filed: {
    solid: "#3178b9",
    soft: "rgba(49,120,185,.12)",
    label: "Filed with CRA",
  },
};

function fmtCAD(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function fmtCADCompact(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(2)}M`;
  if (Math.abs(dollars) >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return fmtCAD(cents);
}

function fmtBN(bn: string | null): string {
  if (!bn) return "—";
  if (bn.length === 15) return `${bn.slice(0, 9)} ${bn.slice(9, 11)}${bn.slice(11)}`;
  return bn;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function T5018WorkspaceUI({ view }: { view: T5018WorkspaceView }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [flowState, setFlowState] = useState<FlowState>("workspace");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isCanadian = view.reporter.taxJurisdiction === "CA";
  const reporterBn = view.reporter.businessNumber;
  const filingDeadline = `Feb 28, ${view.fiscalYear + 1}`;

  const filteredSubs = useMemo(() => {
    let list = [...view.aggregate.rows];
    if (filter === "eligible") {
      list = list.filter((s) => s.status === "eligible");
    } else if (filter === "below") {
      list = list.filter((s) => s.status === "below_threshold");
    } else if (filter === "missing") {
      list = list.filter((s) => s.status === "missing_data");
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) =>
          s.legalName.toLowerCase().includes(q) ||
          (s.businessNumber ?? "").toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return dir * a.legalName.localeCompare(b.legalName);
      if (sortKey === "count") return dir * (a.paymentCount - b.paymentCount);
      return dir * (a.totalAmountCents - b.totalAmountCents);
    });
    return list;
  }, [view.aggregate.rows, filter, search, sortKey, sortDir]);

  const selectedSub =
    view.aggregate.rows.find((s) => s.subOrgId === selectedSubId) ?? null;

  const blockingIssues =
    view.aggregate.missingDataCount > 0
      ? [
          {
            text: `${view.aggregate.missingDataCount} sub${view.aggregate.missingDataCount === 1 ? "" : "s"} missing Business Number — resolve before generating`,
          },
        ]
      : [];
  const advisoryIssues =
    view.aggregate.belowCount > 0
      ? [
          {
            text: `${view.aggregate.belowCount} sub${view.aggregate.belowCount === 1 ? "" : "s"} paid below the $500 threshold — excluded by CRA rule, no slip generated`,
          },
        ]
      : [];

  const canGenerate =
    isCanadian &&
    Boolean(reporterBn) &&
    view.aggregate.eligibleCount > 0 &&
    view.aggregate.missingDataCount === 0 &&
    view.yearStatus !== "filed";

  function bumpSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  function setYear(year: number) {
    startTransition(() => router.push(`?year=${year}`));
  }

  async function generate() {
    setError(null);
    setFlowState("generating");
    try {
      const res = await fetch("/api/contractor/tax-forms/t5018/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fiscalYear: view.fiscalYear }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.message ?? json?.error ?? "Generation failed.");
        setFlowState("workspace");
        return;
      }
      setFlowState("success");
      startTransition(() => router.refresh());
    } catch {
      setError("Network error during generation.");
      setFlowState("workspace");
    }
  }

  async function downloadArtifact(kind: "zip" | "xml" | "csv") {
    if (!view.currentFiling) return;
    setError(null);
    try {
      const res = await fetch(
        `/api/contractor/tax-forms/t5018/${view.currentFiling.id}/download?kind=${kind}`,
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok || !json.url) {
        setError(json?.message ?? "Download failed.");
        return;
      }
      window.location.href = json.url as string;
    } catch {
      setError("Network error during download.");
    }
  }

  return (
    <div className="t5-page">
      <div className="t5-content">
        <div className="t5-bc">
          <Link href="/contractor" className="lk">Settings</Link>
          <span className="sep">/</span>
          <span className="lk">Tax forms</span>
          <span className="sep">/</span>
          <span className="cur">T5018</span>
        </div>

        {/* Page header */}
        <div className="t5-pagehead">
          <div className="t5-pagehead-left">
            <h1>T5018 — Contractor Payment Slips</h1>
            <p>
              Issue Canada Revenue Agency contractor payment slips to subs
              paid more than $500 CAD in a calendar year. Generate the
              consolidated CRA-conformant XML plus per-sub PDF slips,
              package as a ZIP, and file with the CRA by{" "}
              <strong style={{ color: "var(--t1)", fontWeight: 660 }}>
                {filingDeadline}
              </strong>.
            </p>
          </div>
          <div className="t5-pagehead-right">
            <div className="t5-year-pick" role="tablist" aria-label="Fiscal year">
              <button
                className={view.fiscalYear === view.fiscalYear - 1 + 1 - 1 ? "" : ""}
                style={{ display: "none" }}
              />
              {[view.fiscalYear - 1, view.fiscalYear, view.fiscalYear + 1].map(
                (year) => {
                  const isCurrent = year === view.fiscalYear;
                  const filingForYear = view.filingHistory.find(
                    (f) => f.fiscalYear === year,
                  );
                  const label = filingForYear
                    ? filingForYear.status === "filed"
                      ? "filed"
                      : "generated"
                    : year === new Date().getFullYear()
                      ? "current"
                      : "—";
                  return (
                    <button
                      key={year}
                      className={isCurrent ? "active" : ""}
                      onClick={() => setYear(year)}
                      disabled={pending}
                    >
                      Fiscal {year}
                      <span className="t5-year-pick-label">{label}</span>
                    </button>
                  );
                },
              )}
            </div>
            <button
              className="t5-btn t5-btn-ghost"
              onClick={() => setShowAuditDrawer(true)}
            >
              {TI.shield}
              Audit log
            </button>
            <button
              className="t5-btn t5-btn-primary"
              disabled={!canGenerate || pending}
              onClick={() => setFlowState("confirm")}
              title={
                !canGenerate
                  ? view.yearStatus === "filed"
                    ? "Year already filed — generate a new fiscal year"
                    : "Resolve blocking issues first"
                  : "Generate T5018 package"
              }
            >
              {TI.zap}
              {view.yearStatus === "generated"
                ? "Re-generate package"
                : view.yearStatus === "filed"
                  ? "Already filed"
                  : "Generate T5018 package"}
            </button>
          </div>
        </div>

        {/* Jurisdiction banner */}
        {isCanadian ? (
          <div className="t5-banner">
            <span className="t5-banner-icon green">{TI.leaf}</span>
            <div>
              <div className="t5-banner-title">
                Canadian tax jurisdiction enabled · Business Number{" "}
                {fmtBN(reporterBn)}
              </div>
              <div className="t5-banner-meta">
                T5018 slips required for subs paid &gt; $500 CAD on
                construction services. Filing due {filingDeadline} for fiscal
                year {view.fiscalYear}.
              </div>
            </div>
            <a
              className="t5-btn t5-btn-ghost t5-banner-cta"
              href="https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/completing-filing-information-returns/t5018-statement-contract-payments.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              {TI.external}
              CRA T5018 guidance
            </a>
          </div>
        ) : (
          <div className="t5-banner">
            <span className="t5-banner-icon amber">{TI.warn}</span>
            <div>
              <div className="t5-banner-title">
                Tax forms not enabled for this organization
              </div>
              <div className="t5-banner-meta">
                T5018 surfaces require a Canadian tax jurisdiction. Update
                org settings → Organization → Tax jurisdiction to{" "}
                <strong>CA</strong>.
              </div>
            </div>
          </div>
        )}

        {!reporterBn && isCanadian && (
          <div className="t5-banner">
            <span className="t5-banner-icon red">{TI.warn}</span>
            <div>
              <div className="t5-banner-title">
                Business Number required before generating T5018
              </div>
              <div className="t5-banner-meta">
                Add your CRA-issued BN (15-char form, e.g. 871234567RT0001) in
                Org settings → Tax info. The BN is encrypted at rest under a
                dedicated key.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="t5-banner">
            <span className="t5-banner-icon red">{TI.warn}</span>
            <div>
              <div className="t5-banner-title">Generation error</div>
              <div className="t5-banner-meta">{error}</div>
            </div>
            <button
              className="t5-btn t5-btn-ghost t5-banner-cta"
              onClick={() => setError(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* KPI strip */}
        <div className="t5-kpi">
          <div className="t5-kpi-cell">
            <div className="t5-kpi-label">Qualifying subs</div>
            <div className="t5-kpi-value">{view.aggregate.eligibleCount}</div>
            <div className="t5-kpi-hint">
              paid &gt; $500 in {view.fiscalYear} ·{" "}
              <span className="ok">{view.aggregate.eligibleCount} ready</span>
            </div>
          </div>
          <div className="t5-kpi-cell">
            <div className="t5-kpi-label">Total reportable</div>
            <div className="t5-kpi-value">
              {fmtCADCompact(view.aggregate.totalEligibleCents)}
            </div>
            <div className="t5-kpi-hint">
              across{" "}
              {view.aggregate.rows
                .filter((r) => r.status === "eligible")
                .reduce((acc, s) => acc + s.paymentCount, 0)}{" "}
              payments
            </div>
          </div>
          <div className="t5-kpi-cell">
            <div className="t5-kpi-label">Below threshold</div>
            <div className="t5-kpi-value">{view.aggregate.belowCount}</div>
            <div className="t5-kpi-hint">
              {view.aggregate.belowCount === 0
                ? "no excluded subs"
                : `excluded · ${fmtCAD(
                    view.aggregate.rows
                      .filter((r) => r.status === "below_threshold")
                      .reduce((a, s) => a + s.totalAmountCents, 0),
                  )} total`}
            </div>
          </div>
          <div className="t5-kpi-cell">
            <div className="t5-kpi-label">Filing status</div>
            <div
              className="t5-kpi-value"
              style={{ color: FILING_STATUS_COLOR[view.yearStatus].solid }}
            >
              {FILING_STATUS_COLOR[view.yearStatus].label}
            </div>
            <div className="t5-kpi-hint">
              {view.yearStatus === "filed" && view.currentFiling?.craConfirmationCode && (
                <>CRA confirmation {view.currentFiling.craConfirmationCode}</>
              )}
              {view.yearStatus === "generated" && <>generated · awaiting CRA filing</>}
              {view.yearStatus === "ready" &&
                view.aggregate.missingDataCount > 0 && (
                  <span className="err">
                    {view.aggregate.missingDataCount} blocker — resolve before generating
                  </span>
                )}
              {view.yearStatus === "ready" &&
                view.aggregate.missingDataCount === 0 && (
                  <span className="ok">ready to generate</span>
                )}
              {view.yearStatus === "draft" && <>nothing eligible yet</>}
            </div>
          </div>
        </div>

        {/* Two-column workspace */}
        <div className="t5-grid-2">
          {/* Filing summary */}
          <section className="t5-card">
            <div className="t5-card-head">
              <div>
                <div className="t5-card-title">Filing summary</div>
                <div className="t5-card-sub">
                  Reporter and recipient details applied to every slip
                </div>
              </div>
            </div>
            <div className="t5-card-body">
              <div className="t5-summary-row">
                <div className="t5-summary-label">Reporter</div>
                <div>
                  <div className="t5-summary-val">{view.reporter.legalName}</div>
                  <div className="t5-summary-meta">
                    {[
                      view.reporter.addr1,
                      view.reporter.city,
                      view.reporter.province,
                      view.reporter.postalCode,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Address not on file"}
                  </div>
                </div>
              </div>
              <div className="t5-summary-row">
                <div className="t5-summary-label">Business Number</div>
                <div>
                  <div className="t5-summary-val mono">{fmtBN(reporterBn)}</div>
                  <div className="t5-summary-meta">
                    {reporterBn
                      ? "Encrypted at rest under BUSINESS_NUMBER_ENCRYPTION_KEY"
                      : "Not on file — set in Org settings"}
                  </div>
                </div>
              </div>
              <div className="t5-summary-row">
                <div className="t5-summary-label">Receiver code</div>
                <div>
                  <div className="t5-summary-val mono">
                    {view.reporter.craReceiverCode ?? "—"}
                  </div>
                  <div className="t5-summary-meta">
                    CRA-issued · for electronic transmission
                  </div>
                </div>
              </div>
              <div className="t5-summary-row">
                <div className="t5-summary-label">Reporting period</div>
                <div>
                  <div className="t5-summary-val">
                    January 1 – December 31, {view.fiscalYear}
                  </div>
                  <div className="t5-summary-meta">
                    Calendar year basis · payments-received method
                  </div>
                </div>
              </div>
              <div className="t5-summary-row">
                <div className="t5-summary-label">Filing contact</div>
                <div>
                  <div className="t5-summary-val">
                    {view.reporter.filingContactName ?? "—"}
                  </div>
                  <div className="t5-summary-meta">
                    {view.reporter.filingContactEmail ?? "—"}
                  </div>
                </div>
              </div>
              <div className="t5-summary-row">
                <div className="t5-summary-label">Filing deadline</div>
                <div>
                  <div className="t5-summary-val">{filingDeadline}</div>
                  <div className="t5-summary-meta">
                    Late filing penalty: $100–$2,500 per slip (CRA)
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Generation panel */}
          <section className="t5-card t5-genpanel">
            <div className="t5-card-head">
              <div>
                <div className="t5-card-title">Generation status</div>
                <div className="t5-card-sub">
                  CRA-conformant XML + per-sub PDF slips
                </div>
              </div>
            </div>
            <div className="t5-gen-status">
              <span
                className="t5-gen-pill"
                style={{
                  background: FILING_STATUS_COLOR[view.yearStatus].soft,
                  color: FILING_STATUS_COLOR[view.yearStatus].solid,
                }}
              >
                <span
                  style={{
                    height: 6,
                    width: 6,
                    borderRadius: "50%",
                    background: "currentColor",
                  }}
                />
                {FILING_STATUS_COLOR[view.yearStatus].label}
              </span>
              <div className="t5-gen-headline">
                Fiscal year {view.fiscalYear} ·{" "}
                {view.aggregate.eligibleCount} slip
                {view.aggregate.eligibleCount === 1 ? "" : "s"}
              </div>
              <div className="t5-gen-help">
                {view.yearStatus === "filed" &&
                  view.currentFiling?.filedAt && (
                    <>
                      Filed with CRA on{" "}
                      {view.currentFiling.filedAt.toLocaleDateString("en-CA")}.
                      Original generation available below.
                    </>
                  )}
                {view.yearStatus === "generated" && (
                  <>Package ready. Download below or proceed to CRA filing.</>
                )}
                {view.yearStatus === "ready" &&
                  view.aggregate.missingDataCount > 0 && (
                    <>
                      Resolve {view.aggregate.missingDataCount} blocking
                      issue before generating.
                    </>
                  )}
                {view.yearStatus === "ready" &&
                  view.aggregate.missingDataCount === 0 && (
                    <>All eligible subs validated. Click generate to build the CRA package.</>
                  )}
                {view.yearStatus === "draft" && (
                  <>No qualifying payments aggregated for this year yet.</>
                )}
              </div>
            </div>

            {(blockingIssues.length > 0 || advisoryIssues.length > 0) && (
              <div className="t5-gen-issues">
                {blockingIssues.map((issue, idx) => (
                  <div key={`b-${idx}`} className="t5-issue">
                    <span className="t5-issue-icon blocker">{TI.warn}</span>
                    <span className="t5-issue-text">{issue.text}</span>
                    <button
                      className="t5-issue-action"
                      onClick={() => setFilter("missing")}
                    >
                      Resolve →
                    </button>
                  </div>
                ))}
                {advisoryIssues.map((issue, idx) => (
                  <div key={`a-${idx}`} className="t5-issue">
                    <span className="t5-issue-icon advisory">{TI.info}</span>
                    <span className="t5-issue-text">{issue.text}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="t5-gen-actions">
              {view.yearStatus === "filed" && view.currentFiling && (
                <>
                  <button
                    className="t5-btn t5-btn-soft t5-gen-cta"
                    onClick={() => downloadArtifact("zip")}
                  >
                    {TI.download}
                    Download original package ({view.currentFiling.slipCount}{" "}
                    slips)
                  </button>
                  <div className="t5-gen-secondary">
                    <button
                      className="t5-btn t5-btn-ghost"
                      onClick={() => downloadArtifact("xml")}
                    >
                      {TI.file}
                      View XML
                    </button>
                    <button
                      className="t5-btn t5-btn-ghost"
                      onClick={() => downloadArtifact("csv")}
                    >
                      {TI.list}
                      Slip list
                    </button>
                  </div>
                </>
              )}
              {view.yearStatus === "generated" && (
                <>
                  <button
                    className="t5-btn t5-btn-primary t5-gen-cta"
                    onClick={() => downloadArtifact("zip")}
                  >
                    {TI.download}
                    Download T5018 package (.zip)
                  </button>
                  <div className="t5-gen-secondary">
                    <a
                      className="t5-btn t5-btn-ghost"
                      href="https://apps.cra-arc.gc.ca/ebci/iitf/cd/login"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {TI.external}
                      File with CRA
                    </a>
                    <button
                      className="t5-btn t5-btn-ghost"
                      disabled={!canGenerate}
                      onClick={() => setFlowState("confirm")}
                    >
                      {TI.refresh}
                      Re-generate
                    </button>
                  </div>
                </>
              )}
              {(view.yearStatus === "ready" ||
                view.yearStatus === "draft") && (
                <button
                  className="t5-btn t5-btn-primary t5-gen-cta"
                  disabled={!canGenerate}
                  onClick={() => setFlowState("confirm")}
                >
                  {TI.zap}
                  Generate T5018 package
                </button>
              )}
            </div>
          </section>
        </div>

        {/* Slip preview table */}
        <section className="t5-card" style={{ marginBottom: 18 }}>
          <div className="t5-card-head">
            <div>
              <div className="t5-card-title">
                Slip preview · {view.fiscalYear}
              </div>
              <div className="t5-card-sub">
                Aggregated from{" "}
                <strong style={{ color: "var(--t1)" }}>lien_waivers</strong>{" "}
                joined with{" "}
                <strong style={{ color: "var(--t1)" }}>draw_requests</strong>{" "}
                across all projects this calendar year
              </div>
            </div>
          </div>

          <div className="t5-toolbar">
            <div className="t5-search">
              {TI.search}
              <input
                placeholder="Search by sub name or BN…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="t5-tabbar">
              <button
                className={`t5-tab${filter === "all" ? " active" : ""}`}
                onClick={() => setFilter("all")}
              >
                All ({view.aggregate.rows.length})
              </button>
              <button
                className={`t5-tab${filter === "eligible" ? " active" : ""}`}
                onClick={() => setFilter("eligible")}
              >
                Eligible ({view.aggregate.eligibleCount})
              </button>
              <button
                className={`t5-tab${filter === "below" ? " active" : ""}`}
                onClick={() => setFilter("below")}
              >
                Below $500 ({view.aggregate.belowCount})
              </button>
              {view.aggregate.missingDataCount > 0 && (
                <button
                  className={`t5-tab danger${filter === "missing" ? " active" : ""}`}
                  onClick={() => setFilter("missing")}
                  style={{ color: "var(--red-text)" }}
                >
                  Blocker ({view.aggregate.missingDataCount})
                </button>
              )}
            </div>
            <div className="t5-toolbar-right">
              Showing <strong>{filteredSubs.length}</strong> of{" "}
              <strong>{view.aggregate.rows.length}</strong>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="t5-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => bumpSort("name")}>
                    Subcontractor
                  </th>
                  <th>Business Number</th>
                  <th>Mailing address</th>
                  <th
                    className="sortable right"
                    onClick={() => bumpSort("count")}
                  >
                    Payments
                  </th>
                  <th
                    className="sortable right"
                    onClick={() => bumpSort("total")}
                  >
                    {view.fiscalYear} total (CAD)
                  </th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubs.map((s) => {
                  const sc = SLIP_STATUS_COLOR[s.status];
                  const muted = s.status === "below_threshold";
                  return (
                    <tr
                      key={s.subOrgId}
                      className={muted ? "muted" : ""}
                      onClick={() => setSelectedSubId(s.subOrgId)}
                    >
                      <td>
                        <div className="t5-sub-cell">
                          <span className="t5-sub-avatar">
                            {initials(s.legalName)}
                          </span>
                          <div>
                            <div className="t5-sub-name">{s.legalName}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`t5-bn${s.businessNumber ? "" : " missing"}`}
                        >
                          {s.businessNumber
                            ? fmtBN(s.businessNumber)
                            : "BN not on file"}
                        </span>
                      </td>
                      <td style={{ color: "var(--t2)", fontSize: 12 }}>
                        {s.mailingAddress ?? "—"}
                      </td>
                      <td
                        className="right"
                        style={{ color: "var(--t2)", fontWeight: 600 }}
                      >
                        {s.paymentCount}
                      </td>
                      <td className="right">{fmtCAD(s.totalAmountCents)}</td>
                      <td>
                        <span
                          className="t5-pill"
                          style={{ background: sc.soft, color: sc.solid }}
                        >
                          {s.status === "missing_data"
                            ? TI.warn
                            : s.status === "below_threshold"
                              ? TI.x
                              : TI.check}
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredSubs.length === 0 && (
            <div
              style={{ padding: 36, textAlign: "center", color: "var(--t2)" }}
            >
              {view.aggregate.rows.length === 0
                ? "No sub payments in this fiscal year yet."
                : "No subs match the current filter."}
            </div>
          )}
        </section>

        {/* Filing history */}
        {view.filingHistory.length > 0 && (
          <section className="t5-card">
            <div className="t5-card-head">
              <div>
                <div className="t5-card-title">Filing history</div>
                <div className="t5-card-sub">
                  Prior T5018 packages generated and filed with CRA
                </div>
              </div>
            </div>
            {view.filingHistory.map((f) => {
              const sc = FILING_STATUS_COLOR[f.status];
              return (
                <div key={f.id} className="t5-history-row">
                  <div className="t5-history-yr">{f.fiscalYear}</div>
                  <div className="t5-history-meta">
                    <div className="t5-history-title">
                      {f.slipCount} slip{f.slipCount === 1 ? "" : "s"} ·{" "}
                      {fmtCAD(f.totalAmountCents)} reported
                    </div>
                    <div className="t5-history-sub">
                      Generated {f.generatedAt.toLocaleString("en-CA")} by{" "}
                      {f.generatedByName ?? "—"} · sha256:
                      {f.xmlChecksum.slice(0, 8)}…
                      {f.filedAt && (
                        <>
                          {" "}
                          · Filed {f.filedAt.toLocaleString("en-CA")}
                          {f.craConfirmationCode &&
                            ` · ${f.craConfirmationCode}`}
                        </>
                      )}
                    </div>
                  </div>
                  <span
                    className="t5-pill"
                    style={{ background: sc.soft, color: sc.solid }}
                  >
                    {f.status === "filed" ? TI.check : TI.package}
                    {sc.label}
                  </span>
                  <div className="t5-history-actions">
                    <Link
                      className="t5-btn t5-btn-ghost"
                      href={`?year=${f.fiscalYear}`}
                    >
                      {TI.eye}
                      View year
                    </Link>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>

      {/* Slip detail modal */}
      {selectedSub && (
        <div
          className="t5-modal-bg"
          onClick={() => setSelectedSubId(null)}
        >
          <div
            className="t5-modal wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="t5-modal-head">
              <div>
                <div className="t5-modal-title">
                  Slip preview — {selectedSub.legalName}
                </div>
                <div className="t5-modal-sub">
                  {selectedSub.paymentCount} payment
                  {selectedSub.paymentCount === 1 ? "" : "s"} aggregated for
                  fiscal year {view.fiscalYear}
                </div>
              </div>
              <button
                className="t5-icon-btn"
                onClick={() => setSelectedSubId(null)}
                aria-label="Close"
              >
                {TI.x}
              </button>
            </div>
            <div className="t5-modal-body">
              {selectedSub.status === "missing_data" && (
                <div className="t5-banner" style={{ marginBottom: 18 }}>
                  <span className="t5-banner-icon red">{TI.warn}</span>
                  <div>
                    <div className="t5-banner-title">
                      Business Number missing
                    </div>
                    <div className="t5-banner-meta">
                      Cannot include in filing until BN is captured. Edit
                      subcontractor profile to add it.
                    </div>
                  </div>
                </div>
              )}

              <div className="t5-slip">
                <div className="t5-slip-head">
                  <div className="t5-slip-head-left">
                    <h3>T5018 — Statement of Contract Payments</h3>
                    <p>
                      État des paiements contractuels · Canada Revenue
                      Agency
                    </p>
                  </div>
                  <div className="t5-slip-head-right">
                    <strong>{view.fiscalYear}</strong>
                    Reporting period: Jan 1 – Dec 31
                  </div>
                </div>
                <div className="t5-slip-grid">
                  <div className="t5-slip-cell" style={{ gridColumn: "1 / -1" }}>
                    <div className="t5-slip-box-label">
                      Box 22 — Recipient name
                    </div>
                    <div className="t5-slip-box-val">{selectedSub.legalName}</div>
                  </div>
                  <div className="t5-slip-cell">
                    <div className="t5-slip-box-label">
                      Box 24 — Recipient BN/SIN
                    </div>
                    <div className="t5-slip-box-val">
                      {fmtBN(selectedSub.businessNumber)}
                    </div>
                  </div>
                  <div className="t5-slip-cell">
                    <div className="t5-slip-box-label">
                      Box 26 — Account number
                    </div>
                    <div className="t5-slip-box-val">
                      {selectedSub.subOrgId.toUpperCase()}
                    </div>
                  </div>
                  <div className="t5-slip-cell" style={{ gridColumn: "1 / -1" }}>
                    <div className="t5-slip-box-label">
                      Box 27 — Recipient address
                    </div>
                    <div className="t5-slip-box-val">
                      {selectedSub.mailingAddress ?? "—"}
                    </div>
                  </div>
                  <div className="t5-slip-cell">
                    <div className="t5-slip-box-label">
                      Box 28 — Reporting period start
                    </div>
                    <div className="t5-slip-box-val">
                      January 1, {view.fiscalYear}
                    </div>
                  </div>
                  <div className="t5-slip-cell">
                    <div className="t5-slip-box-label">
                      Box 29 — Reporting period end
                    </div>
                    <div className="t5-slip-box-val">
                      December 31, {view.fiscalYear}
                    </div>
                  </div>
                  <div className="t5-slip-cell" style={{ gridColumn: "1 / -1" }}>
                    <div className="t5-slip-box-label">
                      Box 82 — Total contract payments
                    </div>
                    <div className="t5-slip-amt">
                      {fmtCAD(selectedSub.totalAmountCents)}
                    </div>
                  </div>
                </div>
                <div className="t5-slip-foot">
                  <span>
                    Reporter: {view.reporter.legalName} ·{" "}
                    {fmtBN(reporterBn)}
                  </span>
                  <span>
                    Slip {filteredSubs.indexOf(selectedSub) + 1} of{" "}
                    {view.aggregate.eligibleCount}
                  </span>
                </div>
              </div>
            </div>
            <div className="t5-modal-foot">
              <button
                className="t5-btn t5-btn-ghost"
                onClick={() => setSelectedSubId(null)}
              >
                Close
              </button>
              <Link
                className="t5-btn t5-btn-ghost"
                href={`/contractor/subcontractors/${selectedSub.subOrgId}`}
              >
                {TI.external}
                Open subcontractor profile
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Generate confirm modal */}
      {flowState === "confirm" && (
        <div
          className="t5-modal-bg"
          onClick={() => setFlowState("workspace")}
        >
          <div className="t5-modal" onClick={(e) => e.stopPropagation()}>
            <div className="t5-modal-head">
              <div>
                <div className="t5-modal-title">
                  Generate T5018 package — fiscal year {view.fiscalYear}
                </div>
                <div className="t5-modal-sub">
                  Final review before creating CRA-conformant outputs
                </div>
              </div>
              <button
                className="t5-icon-btn"
                onClick={() => setFlowState("workspace")}
                aria-label="Close"
              >
                {TI.x}
              </button>
            </div>
            <div className="t5-modal-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <div
                  className="t5-summary-row"
                  style={{
                    borderBottom: "1px solid var(--s3)",
                    paddingBottom: 14,
                  }}
                >
                  <div className="t5-summary-label">Reporter</div>
                  <div>
                    <div className="t5-summary-val">
                      {view.reporter.legalName}
                    </div>
                    <div className="t5-summary-val mono">
                      {fmtBN(reporterBn)}
                    </div>
                  </div>
                </div>
                <div
                  className="t5-summary-row"
                  style={{
                    borderBottom: "1px solid var(--s3)",
                    paddingBottom: 14,
                  }}
                >
                  <div className="t5-summary-label">Slips to generate</div>
                  <div>
                    <div className="t5-summary-val">
                      {view.aggregate.eligibleCount} slip
                      {view.aggregate.eligibleCount === 1 ? "" : "s"}
                    </div>
                    <div className="t5-summary-meta">
                      All eligible · BN validated · &gt; $500 threshold
                    </div>
                  </div>
                </div>
                <div
                  className="t5-summary-row"
                  style={{
                    borderBottom: "1px solid var(--s3)",
                    paddingBottom: 14,
                  }}
                >
                  <div className="t5-summary-label">Total reportable</div>
                  <div>
                    <div
                      className="t5-summary-val"
                      style={{
                        fontFamily: "var(--font-d)",
                        fontWeight: 760,
                        fontSize: 18,
                      }}
                    >
                      {fmtCAD(view.aggregate.totalEligibleCents)}
                    </div>
                    <div className="t5-summary-meta">
                      Box 82 sum across all slips
                    </div>
                  </div>
                </div>
                <div className="t5-summary-row">
                  <div className="t5-summary-label">Outputs</div>
                  <div>
                    <div className="t5-summary-val">
                      CRA XML (1 file) + per-sub PDF (×{" "}
                      {view.aggregate.eligibleCount}) + ZIP bundle
                    </div>
                    <div className="t5-summary-meta">
                      XML structure conforms to CRA T5018 boxes 22/24/26/27/28/29/82
                    </div>
                  </div>
                </div>
              </div>

              {advisoryIssues.length > 0 && (
                <div
                  style={{
                    marginTop: 18,
                    padding: 12,
                    background: "var(--amber-soft)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid rgba(193,122,26,.25)",
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      color: "var(--amber-text)",
                      marginTop: 1,
                      flexShrink: 0,
                    }}
                  >
                    {TI.info}
                  </span>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--amber-text)",
                      lineHeight: 1.55,
                    }}
                  >
                    <strong style={{ fontWeight: 700 }}>Heads up:</strong>{" "}
                    {view.aggregate.belowCount} sub
                    {view.aggregate.belowCount === 1 ? "" : "s"} paid below the
                    $500 CAD threshold {view.aggregate.belowCount === 1 ? "is" : "are"}{" "}
                    excluded from this filing per CRA rule. They remain visible
                    in the workspace but no slip is issued.
                  </div>
                </div>
              )}
            </div>
            <div className="t5-modal-foot">
              <button
                className="t5-btn t5-btn-ghost"
                onClick={() => setFlowState("workspace")}
              >
                Cancel
              </button>
              <button
                className="t5-btn t5-btn-primary"
                onClick={generate}
                disabled={!canGenerate}
              >
                {TI.zap}
                Generate {view.aggregate.eligibleCount} slip
                {view.aggregate.eligibleCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generating spinner */}
      {flowState === "generating" && (
        <div className="t5-modal-bg">
          <div
            className="t5-modal"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="t5-modal-body"
              style={{ padding: 36, textAlign: "center" }}
            >
              <div className="t5-spinner" />
              <div className="t5-success-headline" style={{ marginTop: 18 }}>
                Generating T5018 package…
              </div>
              <div className="t5-success-meta">
                Aggregating{" "}
                {view.aggregate.rows
                  .filter((r) => r.status === "eligible")
                  .reduce((acc, s) => acc + s.paymentCount, 0)}{" "}
                payments across {view.aggregate.eligibleCount} subs.
              </div>
              <div
                className="t5-gen-steps"
                style={{ textAlign: "left", maxWidth: 280, margin: "18px auto 0" }}
              >
                <div className="t5-gen-step done">
                  <span className="t5-gen-step-dot">{TI.check}</span>
                  Aggregated payments
                </div>
                <div className="t5-gen-step done">
                  <span className="t5-gen-step-dot">{TI.check}</span>
                  Validated against CRA boxes
                </div>
                <div className="t5-gen-step">
                  <span className="t5-gen-step-dot" />
                  Building XML + PDF outputs…
                </div>
                <div className="t5-gen-step">
                  <span className="t5-gen-step-dot" />
                  Packaging ZIP
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {flowState === "success" && view.currentFiling && (
        <div
          className="t5-modal-bg"
          onClick={() => setFlowState("workspace")}
        >
          <div className="t5-modal" onClick={(e) => e.stopPropagation()}>
            <div className="t5-modal-head">
              <div>
                <div className="t5-modal-title">T5018 package ready</div>
                <div className="t5-modal-sub">
                  Fiscal year {view.fiscalYear} ·{" "}
                  {view.currentFiling.slipCount} slips ·{" "}
                  {fmtCAD(view.currentFiling.totalAmountCents)} reported
                </div>
              </div>
              <button
                className="t5-icon-btn"
                onClick={() => setFlowState("workspace")}
                aria-label="Close"
              >
                {TI.x}
              </button>
            </div>
            <div className="t5-modal-body">
              <div className="t5-success-icon">{TI.checkLg}</div>
              <div className="t5-success-headline">
                Package generated successfully
              </div>
              <div className="t5-success-meta">
                Audit event{" "}
                <span style={{ fontFamily: "var(--font-m)" }}>
                  tax.t5018.generated
                </span>{" "}
                recorded. SHA-256 checksum sha256:
                {view.currentFiling.xmlChecksum.slice(0, 12)}…
              </div>

              <div className="t5-files">
                <div
                  className="t5-file-row"
                  onClick={() => downloadArtifact("zip")}
                  style={{ cursor: "pointer" }}
                >
                  <span className="t5-file-icon">{TI.package}</span>
                  <div>
                    <div className="t5-file-name">
                      T5018-{view.fiscalYear}.zip
                    </div>
                    <div className="t5-file-meta">
                      Bundle · XML + {view.currentFiling.slipCount} PDF slips
                    </div>
                  </div>
                </div>
                <div
                  className="t5-file-row"
                  onClick={() => downloadArtifact("xml")}
                  style={{ cursor: "pointer" }}
                >
                  <span className="t5-file-icon">{TI.file}</span>
                  <div>
                    <div className="t5-file-name">
                      T5018-{view.fiscalYear}.xml
                    </div>
                    <div className="t5-file-meta">
                      CRA-conformant XML · 1 summary +{" "}
                      {view.currentFiling.slipCount} slips
                    </div>
                  </div>
                </div>
                <div
                  className="t5-file-row"
                  onClick={() => downloadArtifact("csv")}
                  style={{ cursor: "pointer" }}
                >
                  <span className="t5-file-icon">{TI.list}</span>
                  <div>
                    <div className="t5-file-name">
                      T5018-summary-{view.fiscalYear}.csv
                    </div>
                    <div className="t5-file-meta">
                      Reconciliation summary for your records
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 18,
                  padding: 12,
                  background: "var(--info-soft)",
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    color: "var(--info-text)",
                    marginTop: 1,
                    flexShrink: 0,
                  }}
                >
                  {TI.info}
                </span>
                <div
                  style={{
                    fontSize: 12.5,
                    color: "var(--info-text)",
                    lineHeight: 1.55,
                  }}
                >
                  Next step: log into your CRA{" "}
                  <em>Internet File Transfer</em> portal and upload the XML.
                  File by <strong>{filingDeadline}</strong> to avoid late-
                  filing penalties.
                </div>
              </div>
            </div>
            <div className="t5-modal-foot">
              <button
                className="t5-btn t5-btn-ghost"
                onClick={() => setFlowState("workspace")}
              >
                Close
              </button>
              <a
                className="t5-btn t5-btn-soft"
                href="https://apps.cra-arc.gc.ca/ebci/iitf/cd/login"
                target="_blank"
                rel="noopener noreferrer"
              >
                {TI.external}
                CRA upload portal
              </a>
              <button
                className="t5-btn t5-btn-primary"
                onClick={() => downloadArtifact("zip")}
              >
                {TI.download}
                Download package (.zip)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit drawer */}
      {showAuditDrawer && (
        <>
          <div
            className="t5-drawer-bg"
            onClick={() => setShowAuditDrawer(false)}
          />
          <aside className="t5-drawer">
            <div className="t5-drawer-head">
              <div>
                <div className="t5-modal-title">Audit log</div>
                <div className="t5-modal-sub">
                  T5018 surface — last 30 events
                </div>
              </div>
              <button
                className="t5-icon-btn"
                onClick={() => setShowAuditDrawer(false)}
                aria-label="Close"
              >
                {TI.x}
              </button>
            </div>
            <div className="t5-drawer-body">
              {view.recentAuditEvents.length === 0 ? (
                <div style={{ color: "var(--t3)", fontSize: 13 }}>
                  No T5018 audit events yet. Generate a package to see this
                  feed populate.
                </div>
              ) : (
                <div className="t5-feed">
                  {view.recentAuditEvents.map((row, idx) => {
                    const kind = row.action.includes("generated")
                      ? "generate"
                      : row.action.includes("filed")
                        ? "file"
                        : row.action.includes("download")
                          ? "preview"
                          : "aggregate";
                    return (
                      <div key={`${idx}-${row.action}`} className="t5-feed-row">
                        <span className={`t5-feed-icon ${kind}`}>
                          {kind === "generate"
                            ? TI.zap
                            : kind === "file"
                              ? TI.shield
                              : kind === "preview"
                                ? TI.eye
                                : TI.refresh}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div className="t5-feed-text">
                            <strong>{row.actorName ?? "System"}</strong>{" "}
                            {row.action.replace(/^tax\.t5018\./, "")}
                          </div>
                          {row.metadata && (
                            <div className="t5-feed-text">
                              <span className="target">
                                {row.metadata.fiscalYear
                                  ? `fiscal ${row.metadata.fiscalYear}`
                                  : null}
                                {row.metadata.slipCount
                                  ? ` · ${row.metadata.slipCount} slips`
                                  : null}
                                {row.metadata.totalAmountCents
                                  ? ` · ${fmtCAD(Number(row.metadata.totalAmountCents))}`
                                  : null}
                              </span>
                            </div>
                          )}
                          <div className="t5-feed-when">
                            {row.createdAt.toLocaleString("en-CA")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
