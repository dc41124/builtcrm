"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type {
  CacheRow,
  RbqCacheAdminView,
} from "@/domain/loaders/rbq-cache-admin";

// Step 66 — RBQ cache admin client UI (View 02 of the prototype).

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};
const PURPLE = "#5b4fc7";

type Filter = "all" | "valid" | "expiring" | "expired" | "not_found" | "suspended";

const STATE_COLOR: Record<CacheRow["uiState"], { bg: string; color: string; label: string }> = {
  valid: { bg: "#edf7f1", color: "#1e6b46", label: "RBQ valid" },
  expiring: { bg: "#fdf4e6", color: "#96600f", label: "Expiring soon" },
  expired: { bg: "#fdeaea", color: "#a52e2e", label: "License expired" },
  suspended: { bg: "#fdeaea", color: "#a52e2e", label: "Suspended" },
  not_found: { bg: "#fdeaea", color: "#a52e2e", label: "Not found" },
};

export function RbqCacheAdminUI({ view }: { view: RbqCacheAdminView }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [bulkRefreshing, setBulkRefreshing] = useState(false);
  const [refreshingNumber, setRefreshingNumber] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return view.rows.filter((r) => {
      if (filter !== "all" && r.uiState !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          r.rbqNumber,
          r.legalName ?? "",
          ...r.associatedOrgNames,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [view.rows, filter, search]);

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

  async function refreshSingle(rbqNumber: string) {
    setError(null);
    setRefreshingNumber(rbqNumber);
    try {
      const res = await fetch(
        `/api/contractor/rbq/refresh/${encodeURIComponent(rbqNumber)}`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.message ?? "Refresh failed.");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error.");
    } finally {
      setRefreshingNumber(null);
    }
  }

  return (
    <div style={{ padding: "32px 40px", maxWidth: 1320, margin: "0 auto", fontFamily: F.body, color: "#171717" }}>
      <header style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: F.body, fontSize: 13, fontWeight: 540, color: "#737373", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8 }}>
          Settings · Compliance &amp; CCQ
        </div>
        <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 820, margin: 0, letterSpacing: "-0.025em" }}>
          RBQ License Cache
        </h1>
        <p style={{ fontFamily: F.body, fontSize: 14, fontWeight: 540, color: "#525252", marginTop: 10, maxWidth: 740, lineHeight: 1.55 }}>
          Cached lookups against the <strong>RBQ Open Data feed</strong> for every
          subcontractor in your org. Refreshed nightly at 03:00 EST. Force a
          single re-check from the row, or refresh the whole cache.
        </p>
      </header>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 12,
          marginBottom: 22,
        }}
      >
        <Kpi label="Total cached" value={view.totalCached} />
        <Kpi
          label="Valid"
          value={view.validCount}
          tone="ok"
          meta={view.totalCached > 0 ? `${Math.round((view.validCount / view.totalCached) * 100)}% of cache` : "—"}
        />
        <Kpi label="Expiring < 30d" value={view.expiringCount} tone="warn" meta="Auto-alerts active" />
        <Kpi label="Expired" value={view.expiredCount} tone="danger" meta="Payment hold proposed" />
        <Kpi label="Not found" value={view.notFoundCount} tone="danger" meta="Manual review needed" />
      </div>

      {/* Bulk action bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 16px",
          background: "#eeedfb",
          border: "1px solid #c7c2ea",
          borderRadius: 10,
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 620, color: "#4a3fb0" }}>
            Cache refresh schedule
          </div>
          <div style={{ fontSize: 12, color: "#4a3fb0", opacity: 0.8, marginTop: 2 }}>
            Nightly job runs at 03:00 EST · Stub fetcher today (real CSV
            hookup tracked in prod_cutover_prep.md)
          </div>
        </div>
        <button
          onClick={bulkRefresh}
          disabled={bulkRefreshing || pending}
          style={btn("primary", "sm")}
        >
          {bulkRefreshing ? "Refreshing all…" : "Force refresh all"}
        </button>
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "12px 14px",
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          marginBottom: 14,
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 220,
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#f3f4f6",
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #e2e5e9",
          }}
        >
          <span style={{ color: "#9c958a" }}>{iconSearch()}</span>
          <input
            placeholder="Search by RBQ number, legal name, or org…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              fontFamily: F.body,
              fontSize: 13,
              color: "#171717",
            }}
          />
        </div>
        <FilterPill cur={filter === "all"} onClick={() => setFilter("all")}>
          All ({view.totalCached})
        </FilterPill>
        <FilterPill cur={filter === "valid"} onClick={() => setFilter("valid")}>
          Valid ({view.validCount})
        </FilterPill>
        <FilterPill cur={filter === "expiring"} onClick={() => setFilter("expiring")}>
          Expiring ({view.expiringCount})
        </FilterPill>
        <FilterPill cur={filter === "expired"} onClick={() => setFilter("expired")}>
          Expired ({view.expiredCount})
        </FilterPill>
        <FilterPill cur={filter === "not_found"} onClick={() => setFilter("not_found")}>
          Not found ({view.notFoundCount})
        </FilterPill>
        {view.suspendedCount > 0 && (
          <FilterPill cur={filter === "suspended"} onClick={() => setFilter("suspended")}>
            Suspended ({view.suspendedCount})
          </FilterPill>
        )}
      </div>

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

      {/* Table */}
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
              <Th>RBQ number</Th>
              <Th>Legal name on license</Th>
              <Th>Subclasses</Th>
              <Th>Status</Th>
              <Th>Expiry</Th>
              <Th>Last checked</Th>
              <Th align="right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div style={{ padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ fontFamily: F.display, fontSize: 15, fontWeight: 680, color: "#171717", marginBottom: 5 }}>
                      No cached lookups match your filter
                    </div>
                    <div style={{ fontSize: 13, color: "#525252", maxWidth: 360, margin: "0 auto" }}>
                      {view.totalCached === 0
                        ? "Add an RBQ number to a sub's profile to populate the cache."
                        : "Adjust the filter or search to see other entries."}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.rbqNumber} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={td}>
                    <span style={{ fontFamily: F.mono, fontSize: 12.5, fontWeight: 560, letterSpacing: "0.04em" }}>
                      {r.rbqNumber}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: 600 }}>
                        {r.legalName ?? (
                          <span style={{ color: "#9c958a", fontStyle: "italic" }}>
                            Not found in registry
                          </span>
                        )}
                      </span>
                      {r.associatedOrgNames.length > 0 && (
                        <span style={{ fontSize: 11.5, color: "#9c958a", marginTop: 1 }}>
                          {r.associatedOrgNames.join(", ")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={td}>
                    {r.subclassesCount > 0 ? (
                      <span
                        style={{
                          fontFamily: F.display,
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: "3px 9px",
                          borderRadius: 999,
                          background: "#eeedfb",
                          color: "#4a3fb0",
                          textTransform: "uppercase",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {r.subclassesCount} subclass{r.subclassesCount === 1 ? "" : "es"}
                      </span>
                    ) : (
                      <span style={{ color: "#9c958a", fontSize: 12.5 }}>—</span>
                    )}
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        display: "inline-block",
                        fontFamily: F.display,
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "3px 9px",
                        borderRadius: 999,
                        background: STATE_COLOR[r.uiState].bg,
                        color: STATE_COLOR[r.uiState].color,
                        textTransform: "uppercase",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {STATE_COLOR[r.uiState].label}
                    </span>
                  </td>
                  <td style={{ ...td, color: "#525252", fontSize: 12.5 }}>
                    {r.expiryDate ?? <span style={{ color: "#9c958a" }}>—</span>}
                  </td>
                  <td style={{ ...td, color: "#525252", fontSize: 12, fontFamily: F.mono }}>
                    {r.lastCheckedAt.toLocaleString()}
                  </td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      onClick={() => refreshSingle(r.rbqNumber)}
                      disabled={refreshingNumber === r.rbqNumber || pending}
                      style={btn("ghost", "sm")}
                    >
                      {refreshingNumber === r.rbqNumber ? "Refreshing…" : "Refresh"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 18,
          padding: "14px 16px",
          background: "#e8f1fa",
          border: "1px solid #cfe1f3",
          borderRadius: 10,
          fontSize: 13,
          color: "#276299",
          lineHeight: 1.55,
        }}
      >
        <strong>Source &amp; freshness.</strong> The cache is hydrated from the
        public RBQ Open Data CSV (donneesquebec.ca), which the RBQ refreshes
        daily. Our nightly Trigger.dev job downloads the diff at 03:00 EST and
        upserts rows. &quot;Force refresh&quot; performs a single-row re-check; today
        it returns deterministic stub data. Production hookup tracked in
        docs/specs/prod_cutover_prep.md.
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
  meta,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "danger";
  meta?: string;
}) {
  const toneStyle =
    tone === "ok"
      ? { background: "linear-gradient(160deg, #edf7f1 0%, #fff 60%)", labelColor: "#1e6b46" }
      : tone === "warn"
        ? { background: "linear-gradient(160deg, #fdf4e6 0%, #fff 60%)", labelColor: "#96600f" }
        : tone === "danger"
          ? { background: "linear-gradient(160deg, #fdeaea 0%, #fff 60%)", labelColor: "#a52e2e" }
          : { background: "#fff", labelColor: "#737373" };
  return (
    <div
      style={{
        background: toneStyle.background,
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: toneStyle.labelColor,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: F.display, fontSize: 24, fontWeight: 820, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
        {value.toLocaleString()}
      </div>
      {meta && (
        <div style={{ fontSize: 11.5, color: "#525252", marginTop: 3 }}>{meta}</div>
      )}
    </div>
  );
}

function FilterPill({
  cur,
  onClick,
  children,
}: {
  cur: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: F.display,
        fontSize: 12,
        fontWeight: 600,
        color: cur ? "#4a3fb0" : "#525252",
        padding: "5px 11px",
        borderRadius: 999,
        border: cur ? "1px solid #c7c2ea" : "1px solid #e2e5e9",
        background: cur ? "#eeedfb" : "#fff",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: "right" }) {
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

function iconSearch() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
