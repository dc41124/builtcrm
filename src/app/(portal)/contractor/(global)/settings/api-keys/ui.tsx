"use client";

// Step 58 — API Keys management UI.
//
// Direct port of docs/prototypes/builtcrm_contractor_settings_api_keys.jsx,
// rendering inside the contractor portal's AppShell. The prototype's
// outer chrome (top bar, shared settings sidebar, theme toggle) is
// intentionally omitted because the portal layout already provides
// the equivalent — same trade as Step 57's catalog page.
//
// What's wired (vs the prototype which mocks state):
//   - List/create/revoke/rotate hit real REST endpoints under
//     /api/contractor/api-keys/*. Loader feeds keys + recent api_key.*
//     audit events from the database.
//   - Create modal -> POST -> reveal modal with the FULL key (only
//     time it's surfaced). Reveal modal blocks dismissal until the
//     user clicks "Copy", matching the prototype's single-shot
//     reveal contract.
//   - Revoke modal hits DELETE; rotate (icon button) hits POST
//     /rotate, then opens the reveal modal with the new key.
//   - Non-admins (contractor_pm) see the list but no Create button
//     and no row actions. The "How API keys work" banner stays for
//     context.

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export type ApiKeyScope = "read" | "write" | "admin";

export type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  createdByName: string;
  createdByInitials: string;
  createdAtIso: string;
  lastUsedAtIso: string | null;
  revokedAtIso: string | null;
  revokedByName: string | null;
  revokeReason: string | null;
};

export type AuditRow = {
  id: string;
  kind: "created" | "revoked" | "used";
  createdAtIso: string;
  actorName: string;
  actorInitials: string;
  keyName: string | null;
  keyPrefix: string | null;
  scopes: string[] | null;
  reason: string | null;
};

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

// ── Icons ────────────────────────────────────────────────────────
// Inline SVGs only (CLAUDE.md: no emoji, all icons are inline SVGs).
const I = {
  back: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="M21 2l-9.5 9.5M15.5 7.5l3 3" />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  plus: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </svg>
  ),
  book: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" />
    </svg>
  ),
  rotate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <polyline points="21 3 21 8 16 8" />
    </svg>
  ),
};

const SCOPE_COPY: Record<
  ApiKeyScope,
  { label: string; desc: string }
> = {
  read: {
    label: "Read",
    desc: "List and fetch projects, draws, RFIs, documents. No mutations.",
  },
  write: {
    label: "Write",
    desc: "Create and update projects, RFIs, change orders, draws, messages.",
  },
  admin: {
    label: "Admin",
    desc: "Everything in Write, plus org settings, member management, integrations.",
  },
};

// Tier-exclusive scope expansion. Picking 'write' grants ['read', 'write'];
// 'admin' grants ['read', 'write', 'admin']. Matches the prototype.
function scopesForTier(tier: ApiKeyScope): ApiKeyScope[] {
  if (tier === "admin") return ["read", "write", "admin"];
  if (tier === "write") return ["read", "write"];
  return ["read"];
}
function tierFor(scopes: ApiKeyScope[]): ApiKeyScope {
  if (scopes.includes("admin")) return "admin";
  if (scopes.includes("write")) return "write";
  return "read";
}

function formatRelative(iso: string | null): string {
  if (!iso) return "Never used";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function lastUsedRel(iso: string | null): "live" | "recent" | "old" {
  if (!iso) return "old";
  const ageMs = Date.now() - new Date(iso).getTime();
  if (ageMs < 24 * 60 * 60 * 1000) return "live"; // <24h
  if (ageMs < 7 * 24 * 60 * 60 * 1000) return "recent"; // <7d
  return "old";
}

// ────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────

export function ApiKeysUI({
  orgName: _orgName,
  viewerRole,
  keys,
  audit,
}: {
  orgName: string;
  viewerRole: "contractor_admin" | "contractor_pm";
  keys: ApiKeyRow[];
  audit: AuditRow[];
}) {
  const router = useRouter();
  const isAdmin = viewerRole === "contractor_admin";
  const [filter, setFilter] = useState<"all" | "active" | "revoked">("all");
  const [modal, setModal] = useState<
    "create" | "reveal" | "revoke" | null
  >(null);
  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState<ApiKeyScope>("read");
  const [revokeTarget, setRevokeTarget] = useState<ApiKeyRow | null>(null);
  const [revealedKey, setRevealedKey] = useState<{
    fullKey: string;
    name: string;
    tier: ApiKeyScope;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startRefresh] = useTransition();

  const filteredKeys = useMemo(() => {
    return keys.filter((k) => {
      if (filter === "all") return true;
      if (filter === "active") return !k.revokedAtIso;
      if (filter === "revoked") return !!k.revokedAtIso;
      return true;
    });
  }, [keys, filter]);

  const activeCount = keys.filter((k) => !k.revokedAtIso).length;
  const revokedCount = keys.filter((k) => !!k.revokedAtIso).length;

  // Light usage stats. Total/30d derived from audit feed; full
  // request counters live in Step 59 (rate limiter).
  const used30d = audit.filter((a) => a.kind === "used").length;
  const failedAuth = audit.filter(
    (a) => a.kind === "used" && (a.reason ?? "").includes("401"),
  ).length;

  const openCreate = () => {
    setNewName("");
    setNewTier("read");
    setError(null);
    setModal("create");
  };

  const submitCreate = async () => {
    if (!newName.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contractor/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          scopes: scopesForTier(newTier),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message ?? body.error ?? "Failed to create key");
        return;
      }
      setRevealedKey({
        fullKey: body.fullKey,
        name: newName.trim(),
        tier: newTier,
      });
      setCopied(false);
      setModal("reveal");
      startRefresh(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  };

  const closeReveal = () => {
    setModal(null);
    setRevealedKey(null);
    setCopied(false);
  };

  const openRevoke = (k: ApiKeyRow) => {
    setRevokeTarget(k);
    setError(null);
    setModal("revoke");
  };

  const submitRevoke = async () => {
    if (!revokeTarget || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contractor/api-keys/${revokeTarget.id}`,
        { method: "DELETE" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message ?? body.error ?? "Failed to revoke key");
        return;
      }
      setModal(null);
      setRevokeTarget(null);
      startRefresh(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  };

  const submitRotate = async (k: ApiKeyRow) => {
    if (submitting) return;
    if (
      !window.confirm(
        `Rotate "${k.name}"?\n\nThe current key will be revoked immediately and a replacement issued. Update any integration using the old key before its next call (within seconds).`,
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/contractor/api-keys/${k.id}/rotate`,
        { method: "POST" },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(body.message ?? body.error ?? "Failed to rotate key");
        return;
      }
      setRevealedKey({
        fullKey: body.fullKey,
        name: k.name,
        tier: tierFor(k.scopes),
      });
      setCopied(false);
      setModal("reveal");
      startRefresh(() => router.refresh());
    } finally {
      setSubmitting(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
    } catch {
      // ignore clipboard failures (insecure context, denied permission)
      setCopied(true);
    }
  };

  const css = `
.ak-root{
  --ak-surface-1:#ffffff;
  --ak-surface-2:#f3f4f6;
  --ak-surface-3:#e2e5e9;
  --ak-surface-4:#d1d5db;
  --ak-surface-hover:#f5f6f8;
  --ak-text-primary:#1a1714;
  --ak-text-secondary:#6b655b;
  --ak-text-tertiary:#9c958a;
  --ak-accent:#5b4fc7;
  --ak-accent-hover:#4f44b3;
  --ak-accent-soft:#eeedfb;
  --ak-accent-text:#4a3fb0;
  --ak-accent-muted:#c7c2ea;
  --ak-success:#2d8a5e;
  --ak-success-soft:#edf7f1;
  --ak-success-text:#1e6b46;
  --ak-warning:#c17a1a;
  --ak-warning-soft:#fdf4e6;
  --ak-warning-text:#96600f;
  --ak-danger:#c93b3b;
  --ak-danger-soft:#fdeaea;
  --ak-danger-text:#a52e2e;
  --ak-info:#3178b9;
  --ak-info-soft:#e8f1fa;
  --ak-info-text:#276299;
  --ak-shadow-sm:0 1px 3px rgba(26,23,20,.05);
  --ak-shadow-lg:0 16px 48px rgba(26,23,20,.18);
  font-family:${F.body};
  color:var(--ak-text-primary);
  -webkit-font-smoothing:antialiased;
}
.ak-root *{box-sizing:border-box}
.ak-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}

/* Page header */
.ak-hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap}
.ak-hdr h2{font-family:${F.display};font-size:24px;font-weight:780;letter-spacing:-.035em;margin:0;color:var(--ak-text-primary)}
.ak-hdr p{font-size:13px;color:var(--ak-text-secondary);margin-top:4px;max-width:640px;font-weight:520;line-height:1.5}
.ak-hdr-acts{display:flex;gap:8px;align-items:center;flex-shrink:0}
.ak-btn{height:36px;padding:0 14px;border-radius:10px;border:1px solid var(--ak-surface-3);background:var(--ak-surface-1);color:var(--ak-text-secondary);font-size:12px;font-weight:620;display:inline-flex;align-items:center;gap:8px;font-family:${F.display};white-space:nowrap;transition:all .15s}
.ak-btn:hover{background:var(--ak-surface-2)}
.ak-btn.primary{background:var(--ak-accent);color:#fff;border-color:var(--ak-accent);box-shadow:var(--ak-shadow-sm)}
.ak-btn.primary:hover{background:var(--ak-accent-hover)}
.ak-btn.danger{background:var(--ak-danger);color:#fff;border-color:var(--ak-danger)}
.ak-btn.danger:hover{filter:brightness(.95)}
.ak-btn:disabled{opacity:.6;cursor:not-allowed}
.ak-btn-icon{width:14px;height:14px;display:block}
.ak-btn-icon svg{width:100%;height:100%;display:block}

/* Info banner */
.ak-banner{background:var(--ak-info-soft);border:1px solid #b3d4ee;border-radius:14px;padding:14px 16px;margin-bottom:20px;display:flex;gap:12px;align-items:flex-start}
.ak-banner-icon{width:18px;height:18px;color:var(--ak-info-text);flex-shrink:0;margin-top:1px}
.ak-banner-icon svg{width:100%;height:100%;display:block}
.ak-banner-title{font-family:${F.display};font-size:13px;font-weight:680;color:var(--ak-info-text);margin-bottom:4px}
.ak-banner-body{font-size:12.5px;color:var(--ak-text-secondary);line-height:1.55;font-weight:520}
.ak-mono-inline{font-family:${F.mono};font-size:11.5px;padding:1px 5px;border-radius:4px;background:var(--ak-surface-1);border:1px solid var(--ak-surface-3)}

/* Tab filter */
.ak-tabs{display:flex;gap:4px;background:var(--ak-surface-2);border-radius:14px;padding:4px;margin-bottom:16px;width:fit-content}
.ak-tab{height:34px;padding:0 14px;border-radius:10px;font-size:12px;font-weight:600;color:var(--ak-text-secondary);background:transparent;display:inline-flex;align-items:center;gap:8px;font-family:${F.display};white-space:nowrap;transition:all .15s}
.ak-tab.active{background:var(--ak-surface-1);color:var(--ak-text-primary);font-weight:650;box-shadow:var(--ak-shadow-sm)}
.ak-tab-cnt{min-width:18px;height:18px;padding:0 6px;border-radius:999px;background:var(--ak-surface-3);color:var(--ak-text-tertiary);font-size:9.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:${F.display}}
.ak-tab.active .ak-tab-cnt{background:var(--ak-accent-soft);color:var(--ak-accent-text)}

/* Key list */
.ak-list{background:var(--ak-surface-1);border:1px solid var(--ak-surface-3);border-radius:18px;box-shadow:var(--ak-shadow-sm);overflow:hidden;margin-bottom:24px}
.ak-list-hdr,.ak-list-row{display:grid;grid-template-columns:minmax(220px,2fr) minmax(220px,2fr) 1fr 1fr 1fr 80px;gap:16px;padding:14px 20px;align-items:center}
.ak-list-hdr{padding:12px 20px;border-bottom:1px solid var(--ak-surface-3);background:var(--ak-surface-2);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:700;color:var(--ak-text-tertiary);font-family:${F.display}}
.ak-list-row{border-bottom:1px solid var(--ak-surface-3)}
.ak-list-row:last-child{border-bottom:none}
.ak-list-row.revoked{opacity:.7}
.ak-empty{padding:48px 20px;text-align:center;color:var(--ak-text-tertiary);font-size:13px}

.ak-key-cell{display:flex;align-items:center;gap:10px;min-width:0}
.ak-key-icon{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;background:var(--ak-accent-soft);color:var(--ak-accent-text)}
.ak-key-icon.muted{background:var(--ak-surface-2);color:var(--ak-text-tertiary)}
.ak-key-icon svg{width:16px;height:16px;display:block}
.ak-key-name{font-family:${F.display};font-size:13.5px;font-weight:680;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ak-text-primary)}
.ak-key-sub{font-size:11px;color:var(--ak-text-tertiary);font-weight:520;margin-top:2px}
.ak-prefix{font-family:${F.mono};font-size:12px;color:var(--ak-text-secondary);font-weight:520;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ak-prefix-row{display:flex;gap:4px;margin-top:5px;flex-wrap:wrap}
.ak-creator{display:flex;align-items:center;gap:8px;min-width:0}
.ak-avatar{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--ak-accent),var(--ak-accent-muted));color:#fff;display:grid;place-items:center;font-family:${F.display};font-size:9px;font-weight:700;flex-shrink:0}
.ak-creator-name{font-size:12px;font-weight:580;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ak-lastused{display:flex;align-items:center;gap:6px}
.ak-lastused-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.ak-lastused-text{font-size:12px;font-weight:580}
.ak-lastused-sub{font-size:11px;color:var(--ak-text-tertiary);margin-top:2px;font-weight:520}
.ak-status{height:24px;padding:0 10px;border-radius:999px;display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:700;font-family:${F.display}}
.ak-status.active{border:1px solid #a7d9be;background:var(--ak-success-soft);color:var(--ak-success-text)}
.ak-status.active::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--ak-success)}
.ak-status.revoked{border:1px solid var(--ak-surface-3);background:var(--ak-surface-2);color:var(--ak-text-tertiary)}
.ak-row-acts{display:flex;justify-content:flex-end;gap:4px}
.ak-icon-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--ak-surface-3);background:var(--ak-surface-1);color:var(--ak-text-tertiary);display:grid;place-items:center}
.ak-icon-btn:hover{background:var(--ak-surface-hover);color:var(--ak-text-primary)}
.ak-icon-btn.danger{color:var(--ak-danger-text)}
.ak-icon-btn.danger:hover{background:var(--ak-danger-soft)}
.ak-icon-btn svg{width:14px;height:14px;display:block}

.ak-scope-pill{height:20px;padding:0 8px;border-radius:999px;display:inline-flex;align-items:center;font-size:10px;font-weight:720;font-family:${F.display};letter-spacing:.01em;text-transform:uppercase}
.ak-scope-pill.read{background:var(--ak-info-soft);color:var(--ak-info-text);border:1px solid #b3d4ee}
.ak-scope-pill.write{background:var(--ak-accent-soft);color:var(--ak-accent-text);border:1px solid var(--ak-accent-muted)}
.ak-scope-pill.admin{background:var(--ak-warning-soft);color:var(--ak-warning-text);border:1px solid #f5d6a0}

/* Stats strip */
.ak-stats-hdr{margin-bottom:12px;display:flex;align-items:baseline;justify-content:space-between}
.ak-stats-hdr h3{font-family:${F.display};font-size:16px;font-weight:720;letter-spacing:-.02em;margin:0}
.ak-stats-hdr .ak-stats-meta{font-size:11.5px;color:var(--ak-text-tertiary);font-weight:520}
.ak-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px}
.ak-stat{padding:14px 16px;background:var(--ak-surface-1);border:1px solid var(--ak-surface-3);border-radius:14px}
.ak-stat.primary{background:var(--ak-accent-soft);border-color:var(--ak-accent-muted)}
.ak-stat.success{background:var(--ak-success-soft);border-color:#a7d9be}
.ak-stat-label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ak-text-tertiary);font-weight:700;font-family:${F.display}}
.ak-stat-val{font-family:${F.display};font-size:22px;font-weight:820;letter-spacing:-.03em;margin-top:6px;color:var(--ak-text-primary)}
.ak-stat.primary .ak-stat-val{color:var(--ak-accent-text)}
.ak-stat.success .ak-stat-val{color:var(--ak-success-text)}
.ak-stat-meta{font-size:11.5px;color:var(--ak-text-secondary);margin-top:4px;font-weight:520}

/* Audit panel */
.ak-audit{background:var(--ak-surface-1);border:1px solid var(--ak-surface-3);border-radius:18px;padding:20px;margin-bottom:24px}
.ak-audit-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.ak-audit-hdr h3{font-family:${F.display};font-size:16px;font-weight:720;letter-spacing:-.02em;margin:0}
.ak-audit-hdr .ak-audit-sub{font-size:12px;color:var(--ak-text-tertiary);margin-top:2px;font-weight:520}
.ak-audit-rows{display:flex;flex-direction:column;gap:4px}
.ak-audit-row{display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:10px}
.ak-audit-row:nth-child(odd){background:var(--ak-surface-2)}
.ak-audit-icon{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex-shrink:0}
.ak-audit-icon svg{width:14px;height:14px;display:block}
.ak-audit-icon.created{background:var(--ak-success-soft);color:var(--ak-success-text)}
.ak-audit-icon.revoked{background:var(--ak-danger-soft);color:var(--ak-danger-text)}
.ak-audit-icon.used{background:var(--ak-info-soft);color:var(--ak-info-text)}
.ak-audit-body{flex:1;min-width:0}
.ak-audit-title{font-family:${F.display};font-size:13px;font-weight:650}
.ak-audit-desc{font-size:12px;color:var(--ak-text-secondary);margin-top:2px;font-weight:520}
.ak-audit-meta{display:flex;align-items:center;gap:8px;flex-shrink:0}
.ak-audit-time{font-size:11px;color:var(--ak-text-tertiary);font-weight:520;white-space:nowrap}
.ak-audit-empty{padding:24px;text-align:center;color:var(--ak-text-tertiary);font-size:12.5px;font-weight:520}

/* Modal */
.ak-backdrop{position:fixed;inset:0;background:rgba(20,18,24,.55);backdrop-filter:blur(4px);display:grid;place-items:center;z-index:100;padding:24px}
.ak-modal{background:var(--ak-surface-1);border-radius:18px;box-shadow:var(--ak-shadow-lg);overflow:hidden;border:1px solid var(--ak-surface-3)}
.ak-modal-hdr{padding:20px 24px;border-bottom:1px solid var(--ak-surface-3);display:flex;align-items:center;justify-content:space-between}
.ak-modal-hdr-l{display:flex;align-items:center;gap:12px}
.ak-modal-icon{width:36px;height:36px;border-radius:10px;display:grid;place-items:center}
.ak-modal-icon svg{width:18px;height:18px;display:block}
.ak-modal-icon.accent{background:var(--ak-accent-soft);color:var(--ak-accent-text)}
.ak-modal-icon.success{background:var(--ak-success-soft);color:var(--ak-success-text)}
.ak-modal-icon.danger{background:var(--ak-danger-soft);color:var(--ak-danger-text)}
.ak-modal-title{font-family:${F.display};font-size:16px;font-weight:720;letter-spacing:-.02em}
.ak-modal-sub{font-size:12px;color:var(--ak-text-tertiary);margin-top:1px}
.ak-modal-close{width:32px;height:32px;border-radius:8px;color:var(--ak-text-tertiary);display:grid;place-items:center}
.ak-modal-close:hover{background:var(--ak-surface-2)}
.ak-modal-close svg{width:16px;height:16px;display:block}
.ak-modal-body{padding:24px}
.ak-modal-foot{padding:14px 24px;border-top:1px solid var(--ak-surface-3);background:var(--ak-surface-2);display:flex;justify-content:flex-end;gap:8px;align-items:center}
.ak-modal-foot.split{justify-content:space-between}

.ak-label{font-family:${F.display};font-size:12px;font-weight:680;color:var(--ak-text-secondary);display:block;margin-bottom:6px}
.ak-input{width:100%;height:40px;padding:0 14px;border-radius:10px;border:1px solid var(--ak-surface-3);background:var(--ak-surface-1);color:var(--ak-text-primary);font-size:13px;font-family:${F.body};font-weight:520;box-sizing:border-box;outline:none}
.ak-input:focus{border-color:var(--ak-accent);box-shadow:0 0 0 3px var(--ak-accent-soft)}
.ak-help{font-size:11.5px;color:var(--ak-text-tertiary);margin-top:6px;font-weight:520}
.ak-scope-list{display:flex;flex-direction:column;gap:8px}
.ak-scope-card{display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:12px;border:1px solid var(--ak-surface-3);background:var(--ak-surface-1);cursor:pointer;transition:all .15s}
.ak-scope-card.selected{border-color:var(--ak-accent);background:var(--ak-accent-soft)}
.ak-scope-card input{margin-top:3px;accent-color:var(--ak-accent)}
.ak-scope-row{display:flex;align-items:center;gap:8px}
.ak-scope-name{font-family:${F.display};font-size:13px;font-weight:680}
.ak-scope-desc{font-size:12px;color:var(--ak-text-secondary);margin-top:4px;font-weight:520;line-height:1.45}

.ak-warn-banner{margin-top:12px;padding:10px 12px;background:var(--ak-warning-soft);border:1px solid #f5d6a0;border-radius:10px;display:flex;gap:10px;align-items:flex-start}
.ak-warn-banner-icon{width:14px;height:14px;color:var(--ak-warning-text);margin-top:2px;flex-shrink:0}
.ak-warn-banner-icon svg{width:100%;height:100%;display:block}
.ak-warn-banner-text{font-size:11.5px;color:var(--ak-warning-text);font-weight:580;line-height:1.5}

.ak-danger-banner{background:var(--ak-danger-soft);border:1px solid #f0b8b8;border-radius:12px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start;margin-bottom:14px}
.ak-danger-banner-icon{width:16px;height:16px;color:var(--ak-danger-text);margin-top:2px;flex-shrink:0}
.ak-danger-banner-icon svg{width:100%;height:100%;display:block}
.ak-danger-banner-title{font-family:${F.display};font-size:12.5px;font-weight:720;color:var(--ak-danger-text);margin-bottom:2px}
.ak-danger-banner-text{font-size:12px;color:var(--ak-danger-text);font-weight:520;line-height:1.5;opacity:.9}

.ak-key-display{display:flex;gap:8px;align-items:stretch;margin-top:8px}
.ak-key-display-text{flex:1;min-width:0;padding:12px 14px;border:1px solid var(--ak-surface-3);border-radius:10px;background:var(--ak-surface-2);font-family:${F.mono};font-size:13px;font-weight:520;color:var(--ak-text-primary);overflow-x:auto;white-space:nowrap;letter-spacing:.02em}
.ak-key-display-btn{min-width:110px;padding:0 16px;border-radius:10px;background:var(--ak-accent);color:#fff;font-size:12px;font-weight:650;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:${F.display};transition:background .15s}
.ak-key-display-btn.copied{background:var(--ak-success)}
.ak-key-display-btn svg{width:14px;height:14px;display:block}

.ak-quickref{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.ak-quickref-card{padding:12px;border:1px solid var(--ak-surface-3);border-radius:10px;background:var(--ak-surface-1)}
.ak-quickref-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--ak-text-tertiary);font-weight:700;font-family:${F.display}}
.ak-quickref-val{font-size:12.5px;font-weight:620;margin-top:4px}
.ak-quickref-val.mono{font-family:${F.mono}}
.ak-quickref-val.dm{font-family:${F.display}}

.ak-form-error{font-size:12px;color:var(--ak-danger-text);margin-top:8px;font-weight:580}

@media (max-width:980px){
  .ak-stats{grid-template-columns:repeat(2,1fr)}
  .ak-list-hdr,.ak-list-row{grid-template-columns:1fr;gap:6px}
  .ak-list-hdr>div:not(:first-child){display:none}
}
`;

  return (
    <div className="ak-root">
      <style>{css}</style>

      {/* Page header */}
      <div className="ak-hdr">
        <div>
          <h2>API keys</h2>
          <p>
            Generate, rotate, and revoke API keys for programmatic access to
            BuiltCRM. Each key is scoped to your organization and shown in
            full only once at creation.
          </p>
        </div>
        <div className="ak-hdr-acts">
          <button className="ak-btn" disabled title="API docs page coming in Step 60">
            <span className="ak-btn-icon">{I.book}</span>
            Read API docs
          </button>
          {isAdmin && (
            <button className="ak-btn primary" onClick={openCreate}>
              <span className="ak-btn-icon">{I.plus}</span>
              Create new key
            </button>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="ak-banner">
        <div className="ak-banner-icon">{I.shield}</div>
        <div style={{ flex: 1 }}>
          <div className="ak-banner-title">How API keys work</div>
          <div className="ak-banner-body">
            Send keys as{" "}
            <span className="ak-mono-inline">
              Authorization: Bearer bcrm_live_…
            </span>{" "}
            on every request to{" "}
            <span style={{ fontFamily: F.mono, fontSize: 11.5 }}>
              /api/v1/*
            </span>
            . Revoked keys return 401 immediately on next call. Test-mode
            keys (
            <span style={{ fontFamily: F.mono, fontSize: 11.5 }}>
              bcrm_test_
            </span>
            ) are coming soon — only live keys are available today. Try the
            sample{" "}
            <span style={{ fontFamily: F.mono, fontSize: 11.5 }}>
              GET /api/v1/ping
            </span>{" "}
            endpoint to verify your key works.
          </div>
        </div>
      </div>

      {/* Tab filter */}
      <div className="ak-tabs">
        {(
          [
            ["all", "All keys", keys.length],
            ["active", "Active", activeCount],
            ["revoked", "Revoked", revokedCount],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`ak-tab${filter === key ? " active" : ""}`}
          >
            {label}
            <span className="ak-tab-cnt">{count}</span>
          </button>
        ))}
      </div>

      {/* Key list */}
      <div className="ak-list">
        <div className="ak-list-hdr">
          <div>Key</div>
          <div>Prefix · Scopes</div>
          <div>Created by</div>
          <div>Last used</div>
          <div>Status</div>
          <div></div>
        </div>
        {filteredKeys.length === 0 ? (
          <div className="ak-empty">
            {keys.length === 0
              ? isAdmin
                ? "No API keys yet. Click \"Create new key\" to issue one."
                : "No API keys yet. Ask your org admin to issue one."
              : "No keys match this filter."}
          </div>
        ) : (
          filteredKeys.map((k) => {
            const isActive = !k.revokedAtIso;
            const dotColor =
              lastUsedRel(k.lastUsedAtIso) === "live"
                ? "var(--ak-success)"
                : lastUsedRel(k.lastUsedAtIso) === "recent"
                  ? "var(--ak-success)"
                  : "var(--ak-surface-4)";
            return (
              <div
                key={k.id}
                className={`ak-list-row${isActive ? "" : " revoked"}`}
              >
                <div className="ak-key-cell">
                  <div
                    className={`ak-key-icon${isActive ? "" : " muted"}`}
                  >
                    {I.key}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="ak-key-name">{k.name}</div>
                    <div className="ak-key-sub">
                      Created {formatDateShort(k.createdAtIso)}
                    </div>
                  </div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="ak-prefix">{k.keyPrefix}…</div>
                  <div className="ak-prefix-row">
                    {k.scopes.map((s) => (
                      <span key={s} className={`ak-scope-pill ${s}`}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ak-creator">
                  <div className="ak-avatar">{k.createdByInitials}</div>
                  <span className="ak-creator-name">{k.createdByName}</span>
                </div>
                <div>
                  <div className="ak-lastused">
                    {isActive && (
                      <span
                        className="ak-lastused-dot"
                        style={{ background: dotColor }}
                      />
                    )}
                    <span className="ak-lastused-text">
                      {formatRelative(k.lastUsedAtIso)}
                    </span>
                  </div>
                  {!isActive && k.revokedAtIso && (
                    <div className="ak-lastused-sub">
                      Revoked {formatDateShort(k.revokedAtIso)}
                    </div>
                  )}
                </div>
                <div>
                  <span
                    className={`ak-status ${isActive ? "active" : "revoked"}`}
                  >
                    {isActive ? "Active" : "Revoked"}
                  </span>
                </div>
                <div className="ak-row-acts">
                  {isActive && isAdmin ? (
                    <>
                      <button
                        className="ak-icon-btn"
                        title="Rotate key"
                        onClick={() => submitRotate(k)}
                        disabled={submitting}
                      >
                        {I.rotate}
                      </button>
                      <button
                        className="ak-icon-btn danger"
                        title="Revoke"
                        onClick={() => openRevoke(k)}
                        disabled={submitting}
                      >
                        {I.trash}
                      </button>
                    </>
                  ) : !isActive ? (
                    <button className="ak-icon-btn" title="Revoked" disabled>
                      {I.more}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Stats */}
      <div className="ak-stats-hdr">
        <h3>Usage at a glance</h3>
        <span className="ak-stats-meta">
          Aggregated across all active keys · audit-feed sample
        </span>
      </div>
      <div className="ak-stats">
        <div className="ak-stat primary">
          <div className="ak-stat-label">Active keys</div>
          <div className="ak-stat-val">{activeCount}</div>
          <div className="ak-stat-meta">
            of {keys.length} total · {revokedCount} revoked
          </div>
        </div>
        <div className="ak-stat">
          <div className="ak-stat-label">Recent usage</div>
          <div className="ak-stat-val">{used30d}</div>
          <div className="ak-stat-meta">
            sampled audit events · enable detailed metrics in Step 59
          </div>
        </div>
        <div className="ak-stat success">
          <div className="ak-stat-label">Failed auth</div>
          <div className="ak-stat-val">{failedAuth}</div>
          <div className="ak-stat-meta">
            {failedAuth === 0
              ? "No revoked-key attempts"
              : "Investigate revoked-key calls"}
          </div>
        </div>
        <div className="ak-stat">
          <div className="ak-stat-label">Endpoint</div>
          <div className="ak-stat-val" style={{ fontFamily: F.mono, fontSize: 16 }}>
            /api/v1/*
          </div>
          <div className="ak-stat-meta">Bearer-token auth, JSON only</div>
        </div>
      </div>

      {/* Audit panel */}
      <div className="ak-audit">
        <div className="ak-audit-hdr">
          <div>
            <h3>Recent activity</h3>
            <div className="ak-audit-sub">
              Key creation, revocation, and a sampled feed of usage events.
            </div>
          </div>
        </div>
        <div className="ak-audit-rows">
          {audit.length === 0 ? (
            <div className="ak-audit-empty">
              No API key activity yet. Audit events appear here as keys are
              created, used, or revoked.
            </div>
          ) : (
            audit.map((a) => {
              const titleByKind = {
                created: `API key created — ${a.keyName ?? "Unnamed"}`,
                revoked: `API key revoked — ${a.keyName ?? "Unnamed"}`,
                used: `API request — ${a.keyName ?? "Unknown key"}`,
              }[a.kind];
              const descByKind = {
                created: `Scopes: ${(a.scopes ?? []).join(", ") || "—"} · Prefix: ${a.keyPrefix ?? "—"}`,
                revoked: `Reason: ${a.reason ?? "—"} · All future calls return 401`,
                used: `Authenticated request via ${a.keyPrefix ?? "—"}`,
              }[a.kind];
              const iconByKind = {
                created: I.plus,
                revoked: I.trash,
                used: I.zap,
              }[a.kind];
              return (
                <div key={a.id} className="ak-audit-row">
                  <div className={`ak-audit-icon ${a.kind}`}>
                    {iconByKind}
                  </div>
                  <div className="ak-audit-body">
                    <div className="ak-audit-title">{titleByKind}</div>
                    <div className="ak-audit-desc">{descByKind}</div>
                  </div>
                  <div className="ak-audit-meta">
                    <div className="ak-avatar">{a.actorInitials}</div>
                    <div className="ak-audit-time">
                      {formatRelative(a.createdAtIso)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* CREATE modal */}
      {modal === "create" && (
        <div className="ak-backdrop" onClick={() => setModal(null)}>
          <div
            className="ak-modal"
            style={{ width: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ak-modal-hdr">
              <div className="ak-modal-hdr-l">
                <div className="ak-modal-icon accent">{I.key}</div>
                <div>
                  <div className="ak-modal-title">Create API key</div>
                  <div className="ak-modal-sub">
                    Scoped to your organization
                  </div>
                </div>
              </div>
              <button
                className="ak-modal-close"
                onClick={() => setModal(null)}
              >
                {I.x}
              </button>
            </div>
            <div className="ak-modal-body">
              <div style={{ marginBottom: 18 }}>
                <label className="ak-label">Key name</label>
                <input
                  className="ak-input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. CI/CD Pipeline, Reporting dashboard"
                  autoFocus
                />
                <div className="ak-help">
                  For your reference only — appears in audit logs and the
                  key list. Not sent in API requests.
                </div>
              </div>
              <div>
                <label className="ak-label">Scope</label>
                <div className="ak-scope-list">
                  {(["read", "write", "admin"] as ApiKeyScope[]).map((s) => {
                    const c = SCOPE_COPY[s];
                    const selected = newTier === s;
                    return (
                      <label
                        key={s}
                        className={`ak-scope-card${selected ? " selected" : ""}`}
                      >
                        <input
                          type="radio"
                          checked={selected}
                          onChange={() => setNewTier(s)}
                          name="ak-scope"
                        />
                        <div style={{ flex: 1 }}>
                          <div className="ak-scope-row">
                            <span className={`ak-scope-pill ${s}`}>{s}</span>
                            <span className="ak-scope-name">{c.label}</span>
                          </div>
                          <div className="ak-scope-desc">{c.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
              {newTier === "admin" && (
                <div className="ak-warn-banner">
                  <div className="ak-warn-banner-icon">{I.alert}</div>
                  <div className="ak-warn-banner-text">
                    Admin keys can modify org settings, members, and billing.
                    Use only for trusted automation.
                  </div>
                </div>
              )}
              {error && <div className="ak-form-error">{error}</div>}
            </div>
            <div className="ak-modal-foot">
              <button className="ak-btn" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="ak-btn primary"
                onClick={submitCreate}
                disabled={!newName.trim() || submitting}
              >
                {submitting ? "Generating…" : "Generate key"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVEAL modal */}
      {modal === "reveal" && revealedKey && (
        <div className="ak-backdrop">
          {/* No backdrop close — user must explicitly acknowledge */}
          <div
            className="ak-modal"
            style={{ width: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ak-modal-hdr">
              <div className="ak-modal-hdr-l">
                <div className="ak-modal-icon success">{I.check}</div>
                <div>
                  <div className="ak-modal-title">Key generated</div>
                  <div className="ak-modal-sub">
                    {revealedKey.name} · scope: {revealedKey.tier}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 24px 0" }}>
              <div className="ak-danger-banner">
                <div className="ak-danger-banner-icon">{I.alert}</div>
                <div>
                  <div className="ak-danger-banner-title">
                    This is the only time you&apos;ll see this key
                  </div>
                  <div className="ak-danger-banner-text">
                    Copy it now and store it in your secrets manager. Once you
                    close this dialog, the full key is gone — only the prefix
                    remains visible. To replace it, you&apos;ll have to
                    generate a new one.
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: "16px 24px 8px" }}>
              <div className="ak-label" style={{ textTransform: "uppercase", letterSpacing: ".06em", fontSize: 11 }}>
                Your API key
              </div>
              <div className="ak-key-display">
                <div className="ak-key-display-text">
                  {revealedKey.fullKey}
                </div>
                <button
                  className={`ak-key-display-btn${copied ? " copied" : ""}`}
                  onClick={() => copyText(revealedKey.fullKey)}
                >
                  {copied ? I.check : I.copy}
                  {copied ? "Copied" : "Copy key"}
                </button>
              </div>
              <div className="ak-help" style={{ marginTop: 8 }}>
                Use as{" "}
                <span style={{ fontFamily: F.mono, fontSize: 11 }}>
                  Authorization: Bearer {revealedKey.fullKey.slice(0, 18)}…
                </span>
              </div>
            </div>
            <div style={{ padding: "12px 24px 20px" }}>
              <div className="ak-quickref">
                <div className="ak-quickref-card">
                  <div className="ak-quickref-label">Test endpoint</div>
                  <div className="ak-quickref-val mono">
                    GET /api/v1/ping
                  </div>
                </div>
                <div className="ak-quickref-card">
                  <div className="ak-quickref-label">Endpoint scope</div>
                  <div className="ak-quickref-val mono">/api/v1/*</div>
                </div>
              </div>
            </div>
            <div className="ak-modal-foot split">
              <div
                style={{
                  fontSize: 11.5,
                  color: copied ? "var(--ak-success-text)" : "var(--ak-text-tertiary)",
                  fontWeight: copied ? 600 : 520,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {copied ? (
                  <>
                    <span style={{ width: 12, height: 12, display: "inline-block" }}>
                      {I.check}
                    </span>
                    <span>Copied to clipboard</span>
                  </>
                ) : (
                  <span>Copy the key before closing</span>
                )}
              </div>
              <button
                className="ak-btn primary"
                onClick={closeReveal}
                disabled={!copied}
              >
                I&apos;ve stored my key — close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVOKE modal */}
      {modal === "revoke" && revokeTarget && (
        <div className="ak-backdrop" onClick={() => setModal(null)}>
          <div
            className="ak-modal"
            style={{ width: 480 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "20px 24px 0" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <div className="ak-modal-icon danger">{I.alert}</div>
                <div>
                  <div className="ak-modal-title">Revoke API key?</div>
                  <div className="ak-modal-sub">
                    This action cannot be undone.
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: 14,
                  border: "1px solid var(--ak-surface-3)",
                  borderRadius: 12,
                  background: "var(--ak-surface-2)",
                  marginBottom: 14,
                }}
              >
                <div style={{ fontFamily: F.display, fontSize: 14, fontWeight: 700 }}>
                  {revokeTarget.name}
                </div>
                <div
                  style={{
                    fontFamily: F.mono,
                    fontSize: 12,
                    color: "var(--ak-text-secondary)",
                    marginTop: 4,
                    fontWeight: 520,
                  }}
                >
                  {revokeTarget.keyPrefix}…
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: "var(--ak-text-tertiary)",
                    marginTop: 6,
                    fontWeight: 520,
                  }}
                >
                  Created by {revokeTarget.createdByName} on{" "}
                  {formatDateShort(revokeTarget.createdAtIso)} · last used{" "}
                  {formatRelative(revokeTarget.lastUsedAtIso)}
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--ak-text-secondary)",
                  lineHeight: 1.55,
                  fontWeight: 520,
                  marginBottom: 14,
                }}
              >
                Any system using this key will fail with{" "}
                <span style={{ fontFamily: F.mono, fontSize: 12 }}>
                  401 Unauthorized
                </span>{" "}
                on its next request — usually within seconds. Make sure
                you&apos;ve rotated dependent integrations to a new key
                first.
              </div>
              {error && <div className="ak-form-error">{error}</div>}
            </div>
            <div className="ak-modal-foot">
              <button className="ak-btn" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                className="ak-btn danger"
                onClick={submitRevoke}
                disabled={submitting}
              >
                <span className="ak-btn-icon">{I.trash}</span>
                {submitting ? "Revoking…" : "Revoke key"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
