"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { I } from "@/components/rbq/icons";
import type {
  CacheRow,
  RbqCacheAdminView,
} from "@/domain/loaders/rbq-cache-admin";

import "../../../../rbq.css";

// Step 66 — RBQ cache admin (View 02 of the prototype). HTML structure
// + class names match the prototype 1:1; styling lives in rbq.css.

type Filter = "all" | "valid" | "expiring" | "expired" | "not_found" | "suspended";

const STATE_TO_TONE: Record<CacheRow["uiState"], "ok" | "warn" | "danger"> = {
  valid: "ok",
  expiring: "warn",
  expired: "danger",
  suspended: "danger",
  not_found: "danger",
};

const STATE_LABEL: Record<CacheRow["uiState"], string> = {
  valid: "RBQ valid",
  expiring: "Expiring soon",
  expired: "License expired",
  suspended: "Suspended",
  not_found: "Not found",
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
    <div className="rbq-page">
      <div className="content">
        <div className="pg-bc">
          <Link href="/contractor" className="lk">Settings</Link>
          <span className="sep">/</span>
          <span className="lk">Compliance &amp; CCQ</span>
          <span className="sep">/</span>
          <span className="cur">RBQ License Cache</span>
        </div>

        <div style={{ marginBottom: 22 }}>
          <h1 className="h1">RBQ License Cache</h1>
          <p className="h1-sub">
            Cached lookups against the <strong>RBQ Open Data feed</strong> for
            every subcontractor in your org. Refreshed nightly at 03:00 EST.
            Force a single re-check from the row, or refresh the whole cache.
          </p>
        </div>

        {/* Settings strip */}
        <div className="settings-strip">
          <button className="stab">{I.bldg} Organization</button>
          <button className="stab">{I.users} Team &amp; roles</button>
          <button className="stab">{I.card} Plan &amp; billing</button>
          <button className="stab">{I.database} Data</button>
          <button className="stab">{I.lock} Org security</button>
          <Link className="stab" href="/contractor/settings/privacy">
            {I.shield} Privacy &amp; Law 25 <span className="note">Step 65</span>
          </Link>
          <button className="stab cur">
            {I.flag} Compliance &amp; CCQ <span className="note">Step 66</span>
          </button>
        </div>

        {/* KPIs */}
        <div className="kpi-row">
          <div className="kpi">
            <div className="lbl">{I.database} Total cached</div>
            <div className="val">{view.totalCached.toLocaleString()}</div>
            <div className="meta">
              {view.totalCached > 0
                ? `Across ${view.totalCached} cache row${view.totalCached === 1 ? "" : "s"}`
                : "No cached lookups yet"}
            </div>
          </div>
          <div className="kpi ok">
            <div className="lbl">{I.check} Valid</div>
            <div className="val">{view.validCount.toLocaleString()}</div>
            <div className="meta">
              {view.totalCached > 0
                ? `${Math.round((view.validCount / view.totalCached) * 100)}% of cache`
                : "—"}
            </div>
          </div>
          <div className="kpi warn">
            <div className="lbl">{I.clock} Expiring &lt; 30d</div>
            <div className="val">{view.expiringCount.toLocaleString()}</div>
            <div className="meta">Auto-alerts active</div>
          </div>
          <div className="kpi danger">
            <div className="lbl">{I.x} Expired</div>
            <div className="val">{view.expiredCount.toLocaleString()}</div>
            <div className="meta">Payment hold proposed</div>
          </div>
          <div className="kpi danger">
            <div className="lbl">{I.warn} Not found</div>
            <div className="val">{view.notFoundCount.toLocaleString()}</div>
            <div className="meta">Manual review needed</div>
          </div>
        </div>

        {/* Bulk action bar */}
        <div className="bulk-bar">
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div className="meta">
              {I.refresh} Cache refresh schedule
            </div>
            <div className="meta-sub">
              Nightly job runs at 03:00 EST · Stub fetcher today (real CSV
              hookup tracked in prod_cutover_prep.md)
            </div>
          </div>
          <button
            className="btn pr sm"
            onClick={bulkRefresh}
            disabled={bulkRefreshing || pending}
          >
            <span className={bulkRefreshing ? "spin" : ""}>{I.refresh}</span>
            {bulkRefreshing ? "Refreshing all…" : "Force refresh all"}
          </button>
        </div>

        {/* Filter bar */}
        <div className="filter-bar">
          <div className="search-wrap">
            <span className="si">{I.search}</span>
            <input
              placeholder="Search by RBQ number, legal name, or sub…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className={`filter-pill ${filter === "all" ? "cur" : ""}`}
            onClick={() => setFilter("all")}
          >
            All ({view.totalCached})
          </button>
          <button
            className={`filter-pill ${filter === "valid" ? "cur" : ""}`}
            onClick={() => setFilter("valid")}
          >
            Valid ({view.validCount})
          </button>
          <button
            className={`filter-pill ${filter === "expiring" ? "cur" : ""}`}
            onClick={() => setFilter("expiring")}
          >
            Expiring ({view.expiringCount})
          </button>
          <button
            className={`filter-pill ${filter === "expired" ? "cur" : ""}`}
            onClick={() => setFilter("expired")}
          >
            Expired ({view.expiredCount})
          </button>
          <button
            className={`filter-pill ${filter === "not_found" ? "cur" : ""}`}
            onClick={() => setFilter("not_found")}
          >
            Not found ({view.notFoundCount})
          </button>
          {view.suspendedCount > 0 && (
            <button
              className={`filter-pill ${filter === "suspended" ? "cur" : ""}`}
              onClick={() => setFilter("suspended")}
            >
              Suspended ({view.suspendedCount})
            </button>
          )}
          <div className="grow" />
          <button className="btn sec sm" disabled>
            {I.download} Export CSV
          </button>
        </div>

        {error && (
          <div className="note" style={{ background: "var(--dg-s)", borderColor: "var(--dg-m)", marginBottom: 14 }}>
            <div className="ic" style={{ color: "var(--dg-t)" }}>{I.warn}</div>
            <div className="body" style={{ color: "var(--dg-t)" }}>{error}</div>
          </div>
        )}

        {/* Table */}
        <div className="card">
          <div className="card-b np">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 142 }}>RBQ number</th>
                  <th>Legal name on license</th>
                  <th>Subclasses</th>
                  <th>Status</th>
                  <th>Expiry</th>
                  <th>Last checked</th>
                  <th className="right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty">
                        <div className="ic">{I.database}</div>
                        <div className="ti">
                          {view.totalCached === 0
                            ? "No cached lookups yet"
                            : "No cached lookups match your filter"}
                        </div>
                        <div className="desc">
                          {view.totalCached === 0
                            ? "Add an RBQ number to a sub's profile to populate the cache."
                            : "Adjust the filter or search to see other entries."}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.rbqNumber}>
                      <td>
                        <span className="id">{r.rbqNumber}</span>
                      </td>
                      <td>
                        <div className="who">
                          <span className="name">
                            {r.legalName ?? (
                              <span style={{ color: "var(--t3)", fontStyle: "italic" }}>
                                Not found in registry
                              </span>
                            )}
                          </span>
                          {r.associatedOrgNames.length > 0 && (
                            <span className="em">
                              {r.associatedOrgNames.join(", ")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {r.subclassesCount > 0 ? (
                          <span className="pill acc">
                            {r.subclassesCount} subclass
                            {r.subclassesCount === 1 ? "" : "es"}
                          </span>
                        ) : (
                          <span style={{ color: "var(--t3)", fontSize: 12.5 }}>
                            —
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`pill ${STATE_TO_TONE[r.uiState]}`}>
                          {r.uiState === "valid" && I.check}
                          {r.uiState === "expiring" && I.clock}
                          {r.uiState === "expired" && I.x}
                          {r.uiState === "suspended" && I.x}
                          {r.uiState === "not_found" && I.warn}
                          {STATE_LABEL[r.uiState]}
                        </span>
                      </td>
                      <td style={{ color: "var(--t2)", fontSize: 12.5 }}>
                        {r.expiryDate ?? (
                          <span style={{ color: "var(--t3)" }}>—</span>
                        )}
                      </td>
                      <td
                        style={{
                          color: "var(--t2)",
                          fontSize: 12,
                          fontFamily: "var(--fm)",
                        }}
                      >
                        {r.lastCheckedAt.toLocaleString()}
                      </td>
                      <td className="right">
                        <div className="row-act">
                          <button
                            className="btn gh sm"
                            onClick={() => refreshSingle(r.rbqNumber)}
                            disabled={
                              refreshingNumber === r.rbqNumber || pending
                            }
                          >
                            <span
                              className={
                                refreshingNumber === r.rbqNumber ? "spin" : ""
                              }
                            >
                              {I.refresh}
                            </span>
                            {refreshingNumber === r.rbqNumber
                              ? "Refreshing…"
                              : "Refresh"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="note" style={{ marginTop: 18 }}>
          <div className="ic">{I.database}</div>
          <div className="body">
            <strong>Source &amp; freshness.</strong> The cache is hydrated
            from the public RBQ Open Data CSV (
            <a
              href="https://www.donneesquebec.ca"
              style={{ color: "var(--in-t)", fontWeight: 600 }}
              target="_blank"
              rel="noopener noreferrer"
            >
              donneesquebec.ca
            </a>
            ), which the RBQ refreshes daily. Our nightly Trigger.dev job
            downloads the diff at 03:00 EST and updates rows where the source
            version differs. &quot;Force refresh&quot; performs a single-row
            re-check; today it returns deterministic stub data. Production
            hookup tracked in docs/specs/prod_cutover_prep.md.
          </div>
        </div>
      </div>
    </div>
  );
}
