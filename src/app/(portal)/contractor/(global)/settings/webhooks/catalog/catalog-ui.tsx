"use client";

// Step 57 — Webhook Event Catalog UI.
//
// Direct port of docs/prototypes/builtcrm_webhook_event_catalog.jsx,
// rendering inside the contractor portal's AppShell. The prototype's
// outer chrome (top bar, settings sidebar) is intentionally omitted
// here because the portal layout already provides analogous nav. The
// main content area — hero, stats, test panel, TOC, filters, category
// accordions, syntax-highlighted JSON viewer, footer note — is
// reproduced byte-for-byte from the prototype, including the same CSS
// class names and color tokens.
//
// Why a client component: every interaction (search, filter, expand,
// copy-to-clipboard, theme toggle) is local UI state. No data
// fetching after first render — the catalog itself is a static
// import from src/lib/integrations/webhookEventCatalog.ts.

import { useMemo, useState } from "react";

import {
  WEBHOOK_CATEGORY_CONFIG,
  WEBHOOK_EVENT_CATALOG,
  type WebhookEventCategory,
  type WebhookEventDefinition,
  type WebhookEventDeliveryGuarantee,
} from "@/lib/integrations/webhookEventCatalog";

// ─── ICONS ──────────────────────────────────────────────────────────────────
// Inline SVGs only — matches the project convention (CLAUDE.md). Sizes
// and stroke widths are copied from the prototype to preserve visual
// weight across labels and pills.
const I = {
  search: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  copy: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  check: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  chevD: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  ),
  chevR: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
  download: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  webhook: (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2" />
      <path d="m6 17 3.13-5.78c.53-.97.43-2.22-.26-3.07A4 4 0 0 1 17 6c0 .67-.18 1.34-.49 1.93" />
      <path d="m12 17 5.99 0c1.1 0 1.95.94 2.48 1.9A4 4 0 1 1 22 17c-.01-.7-.2-1.4-.57-2" />
    </svg>
  ),
  building: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
    </svg>
  ),
  workflow: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="6" height="6" rx="1" />
      <rect x="15" y="3" width="6" height="6" rx="1" />
      <rect x="9" y="15" width="6" height="6" rx="1" />
      <path d="M6 9v3a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9" />
      <path d="M12 13v2" />
    </svg>
  ),
  dollar: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  badge: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      <path d="M16 14v8l-4-3-4 3v-8" />
    </svg>
  ),
  doc: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  info: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  terminal: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  expand: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  ),
  collapse: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  ),
};

const categoryIconFor = (cat: WebhookEventCategory) =>
  ({
    projects: I.building,
    workflows: I.workflow,
    billing: I.dollar,
    compliance: I.badge,
    documents: I.doc,
  })[cat];

// ─── JSON VIEWER ────────────────────────────────────────────────────────────
// Recursively renders an object as colored, indented JSON without
// dangerouslySetInnerHTML. Each line is its own block so the syntax
// colors paint correctly against the dark code surface; padding is a
// transparent-color span so the tabular indent line up.
function JsonNode({
  value,
  indent = 0,
  isLast = true,
  keyName = null,
}: {
  value: unknown;
  indent?: number;
  isLast?: boolean;
  keyName?: string | null;
}) {
  const pad = " ".repeat(indent * 2);
  const trail = isLast ? "" : ",";

  const renderKey = keyName !== null && (
    <>
      <span className="wec-json-key">&quot;{keyName}&quot;</span>
      <span className="wec-json-punct">: </span>
    </>
  );

  if (value === null) {
    return (
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>
        {renderKey}
        <span className="wec-json-null">null</span>
        <span className="wec-json-punct">{trail}</span>
      </div>
    );
  }
  if (typeof value === "boolean") {
    return (
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>
        {renderKey}
        <span className="wec-json-bool">{String(value)}</span>
        <span className="wec-json-punct">{trail}</span>
      </div>
    );
  }
  if (typeof value === "number") {
    return (
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>
        {renderKey}
        <span className="wec-json-num">{value}</span>
        <span className="wec-json-punct">{trail}</span>
      </div>
    );
  }
  if (typeof value === "string") {
    return (
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>
        {renderKey}
        <span className="wec-json-str">&quot;{value}&quot;</span>
        <span className="wec-json-punct">{trail}</span>
      </div>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <div className="wec-json-line">
          <span className="wec-json-pad">{pad}</span>
          {renderKey}
          <span className="wec-json-punct">[]</span>
          <span className="wec-json-punct">{trail}</span>
        </div>
      );
    }
    return (
      <>
        <div className="wec-json-line">
          <span className="wec-json-pad">{pad}</span>
          {renderKey}
          <span className="wec-json-punct">[</span>
        </div>
        {value.map((v, i) => (
          <JsonNode
            key={i}
            value={v}
            indent={indent + 1}
            isLast={i === value.length - 1}
          />
        ))}
        <div className="wec-json-line">
          <span className="wec-json-pad">{pad}</span>
          <span className="wec-json-punct">]</span>
          <span className="wec-json-punct">{trail}</span>
        </div>
      </>
    );
  }
  // object
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return (
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>
        {renderKey}
        <span className="wec-json-punct">{"{}"}</span>
        <span className="wec-json-punct">{trail}</span>
      </div>
    );
  }
  return (
    <>
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>
        {renderKey}
        <span className="wec-json-punct">{"{"}</span>
      </div>
      {keys.map((k, i) => (
        <JsonNode
          key={k}
          value={obj[k]}
          indent={indent + 1}
          isLast={i === keys.length - 1}
          keyName={k}
        />
      ))}
      <div className="wec-json-line">
        <span className="wec-json-pad">{pad}</span>
        <span className="wec-json-punct">{"}"}</span>
        <span className="wec-json-punct">{trail}</span>
      </div>
    </>
  );
}

function DeliveryBadge({ kind }: { kind: WebhookEventDeliveryGuarantee }) {
  const isAtLeast = kind === "at-least-once";
  return (
    <span
      className={`wec-delivery-badge${isAtLeast ? " atleast" : " besteffort"}`}
    >
      <span className="wec-delivery-dot" />
      {isAtLeast ? "at-least-once" : "best-effort"}
    </span>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────
export function WebhookCatalogUI({ orgName: _orgName }: { orgName: string }) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<
    WebhookEventCategory | "all"
  >("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<
    WebhookEventCategory | null
  >(null);

  const totalEvents = WEBHOOK_EVENT_CATALOG.length;
  const atLeastOnceCount = WEBHOOK_EVENT_CATALOG.filter(
    (e) => e.deliveryGuarantee === "at-least-once",
  ).length;
  const bestEffortCount = WEBHOOK_EVENT_CATALOG.filter(
    (e) => e.deliveryGuarantee === "best-effort",
  ).length;
  const allCategories = Object.keys(
    WEBHOOK_CATEGORY_CONFIG,
  ) as WebhookEventCategory[];

  const filteredEvents = useMemo<WebhookEventDefinition[]>(() => {
    const q = search.trim().toLowerCase();
    return WEBHOOK_EVENT_CATALOG.filter((e) => {
      if (filterCategory !== "all" && e.category !== filterCategory)
        return false;
      if (
        q &&
        !(e.key.includes(q) || e.description.toLowerCase().includes(q))
      )
        return false;
      return true;
    });
  }, [search, filterCategory]);

  const grouped = useMemo<
    Record<WebhookEventCategory, WebhookEventDefinition[]>
  >(() => {
    const out = {
      projects: [] as WebhookEventDefinition[],
      workflows: [] as WebhookEventDefinition[],
      billing: [] as WebhookEventDefinition[],
      compliance: [] as WebhookEventDefinition[],
      documents: [] as WebhookEventDefinition[],
    };
    filteredEvents.forEach((e) => out[e.category].push(e));
    return out;
  }, [filteredEvents]);

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const expandAll = () =>
    setExpanded(new Set(filteredEvents.map((e) => e.key)));
  const collapseAll = () => setExpanded(new Set());

  const copyText = async (key: string, text: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // ignore — copy can fail in insecure contexts; visual confirmation still fires
    }
    setCopiedKey(key);
    setTimeout(
      () => setCopiedKey((cur) => (cur === key ? null : cur)),
      1600,
    );
  };

  const jumpToCategory = (cat: WebhookEventCategory) => {
    setActiveAnchor(cat);
    if (typeof document !== "undefined") {
      const el = document.getElementById(`wec-cat-${cat}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => setActiveAnchor(null), 1500);
  };

  const css = `
.wec-root{
  --wec-accent:#5b4fc7;
  --wec-accent-deep:#4538a3;
  --wec-accent-soft:rgba(91,79,199,.1);
  --wec-ok:#2d8a5e; --wec-ok-soft:rgba(45,138,94,.11);
  --wec-wr:#c4700b; --wec-wr-soft:rgba(196,112,11,.11);
  --wec-info:#3878a8; --wec-info-soft:rgba(56,120,168,.1);
  --wec-bg:#f9f8f5;
  --wec-surface-1:#ffffff;
  --wec-surface-2:#f4f2ed;
  --wec-surface-3:#ece9e2;
  --wec-surface-hover:#f7f5f0;
  --wec-border:#e4e0d6;
  --wec-border-strong:#d6d1c4;
  --wec-text-primary:#1f1d1a;
  --wec-text-secondary:#5a5852;
  --wec-text-tertiary:#8a8884;
  --wec-shadow-sm:0 1px 2px rgba(20,18,14,.04);
  --wec-shadow-lg:0 14px 38px rgba(20,18,14,.13);
  --wec-code-bg:#1a1814;
  --wec-code-fg:#e8e5dd;
  --wec-code-key:#a99cf5;
  --wec-code-str:#9bd1a3;
  --wec-code-num:#f0c987;
  --wec-code-bool:#e89a8c;
  --wec-code-null:#8a8884;
  --wec-code-punct:#aca9a1;
  font-family:'Instrument Sans',sans-serif;
  color:var(--wec-text-primary);
  letter-spacing:-.005em;
}
.wec-root *{box-sizing:border-box}
.wec-root button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}

/* Hero */
.wec-hero{background:linear-gradient(135deg,var(--wec-surface-1),var(--wec-surface-2));border:1px solid var(--wec-border);border-radius:14px;padding:26px 28px;margin-bottom:18px;position:relative;overflow:hidden}
.wec-hero::before{content:"";position:absolute;top:-30px;right:-30px;width:200px;height:200px;background:radial-gradient(circle,var(--wec-accent-soft) 0%,transparent 70%);pointer-events:none}
.wec-hero-eyebrow{display:inline-flex;align-items:center;gap:6px;font-family:'DM Sans',sans-serif;font-weight:680;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--wec-accent);background:var(--wec-accent-soft);padding:4px 10px;border-radius:5px;margin-bottom:11px}
.wec-hero-title{font-family:'DM Sans',sans-serif;font-weight:800;font-size:28px;letter-spacing:-.025em;color:var(--wec-text-primary);line-height:1.1;margin-bottom:8px}
.wec-hero-sub{font-size:14px;color:var(--wec-text-secondary);line-height:1.55;max-width:640px;margin-bottom:18px}
.wec-hero-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px}
.wec-hero-stat{background:var(--wec-surface-1);border:1px solid var(--wec-border);border-radius:10px;padding:11px 14px}
.wec-hero-stat-key{font-size:10.5px;color:var(--wec-text-tertiary);text-transform:uppercase;letter-spacing:.06em;font-family:'DM Sans',sans-serif;font-weight:680;margin-bottom:5px}
.wec-hero-stat-val{font-family:'DM Sans',sans-serif;font-weight:780;font-size:22px;letter-spacing:-.025em;color:var(--wec-text-primary);font-variant-numeric:tabular-nums;line-height:1}
.wec-hero-stat-foot{font-size:11px;color:var(--wec-text-secondary);margin-top:5px}
.wec-hero-actions{display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:2}
.wec-btn{height:34px;padding:0 14px;border-radius:8px;background:var(--wec-surface-1);border:1px solid var(--wec-border);font-family:'DM Sans',sans-serif;font-weight:620;font-size:12.5px;color:var(--wec-text-primary);display:inline-flex;align-items:center;gap:7px;letter-spacing:-.005em;transition:all .14s;white-space:nowrap}
.wec-btn:hover{background:var(--wec-surface-2);border-color:var(--wec-border-strong)}
.wec-btn.primary{background:var(--wec-accent);color:#fff;border-color:var(--wec-accent)}
.wec-btn.primary:hover{background:var(--wec-accent-deep)}
.wec-btn.ghost{background:transparent;border-color:transparent;color:var(--wec-text-secondary)}
.wec-btn.ghost:hover{background:var(--wec-surface-2);color:var(--wec-text-primary)}
.wec-btn:disabled{opacity:.5;cursor:not-allowed}
.wec-inline-code{font-family:'JetBrains Mono',monospace;font-size:12.5px;color:var(--wec-accent);background:var(--wec-accent-soft);padding:1px 6px;border-radius:4px}

/* Test panel */
.wec-test-panel{border:1px solid var(--wec-border);border-radius:11px;background:var(--wec-surface-1);overflow:hidden;margin-bottom:18px}
.wec-test-panel-hdr{display:flex;align-items:center;gap:10px;padding:13px 16px;cursor:pointer;background:var(--wec-info-soft);border-bottom:1px solid transparent;transition:all .15s}
.wec-test-panel-hdr.open{border-bottom-color:var(--wec-border)}
.wec-test-panel-hdr:hover{filter:brightness(.97)}
.wec-test-panel-icon{width:30px;height:30px;border-radius:8px;background:var(--wec-info);color:#fff;display:grid;place-items:center;flex-shrink:0}
.wec-test-panel-title{font-family:'DM Sans',sans-serif;font-weight:720;font-size:14px;letter-spacing:-.01em;color:var(--wec-info)}
.wec-test-panel-sub{font-size:12px;color:var(--wec-text-secondary);margin-top:1px}
.wec-test-panel-body{padding:18px 18px 16px;display:flex;flex-direction:column;gap:14px;background:var(--wec-surface-2)}
.wec-test-panel-body p{margin:0;font-size:13px;line-height:1.55;color:var(--wec-text-secondary)}
.wec-test-panel-body code{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--wec-accent);background:var(--wec-accent-soft);padding:1px 6px;border-radius:4px}

/* TOC */
.wec-toc{background:var(--wec-surface-1);border:1px solid var(--wec-border);border-radius:12px;padding:18px 20px;margin-bottom:18px}
.wec-toc-hdr{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.wec-toc-title{font-family:'DM Sans',sans-serif;font-weight:740;font-size:14.5px;letter-spacing:-.012em;color:var(--wec-text-primary)}
.wec-toc-sub{font-size:12px;color:var(--wec-text-secondary);margin-top:2px}
.wec-search{position:relative;min-width:240px;flex:1;max-width:360px}
.wec-search input{width:100%;height:36px;padding:0 12px 0 36px;border-radius:8px;border:1px solid var(--wec-border);background:var(--wec-surface-2);color:var(--wec-text-primary);font-family:inherit;font-size:13px;outline:none}
.wec-search input:focus{border-color:var(--wec-accent);box-shadow:0 0 0 3px var(--wec-accent-soft);background:var(--wec-surface-1)}
.wec-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--wec-text-tertiary)}
.wec-toc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:9px}
.wec-toc-card{display:flex;align-items:center;gap:11px;padding:11px 13px;background:var(--wec-surface-2);border:1px solid var(--wec-border);border-radius:10px;cursor:pointer;transition:all .15s;border-left:3px solid;text-align:left;width:100%}
.wec-toc-card:hover{background:var(--wec-surface-hover);transform:translateY(-1px);box-shadow:var(--wec-shadow-sm)}
.wec-toc-card-icon{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;color:#fff}
.wec-toc-card-body{flex:1;min-width:0}
.wec-toc-card-name{font-family:'DM Sans',sans-serif;font-weight:700;font-size:13px;letter-spacing:-.008em;color:var(--wec-text-primary);line-height:1.2}
.wec-toc-card-cnt{font-size:11px;color:var(--wec-text-tertiary);margin-top:2px;font-family:'JetBrains Mono',monospace}
.wec-toc-card-arrow{color:var(--wec-text-tertiary);flex-shrink:0}

/* Filter pills */
.wec-filters{display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;background:var(--wec-bg);padding:6px 0}
.wec-filter-pills{display:flex;gap:4px;background:var(--wec-surface-1);border:1px solid var(--wec-border);border-radius:9px;padding:3px;flex-wrap:wrap}
.wec-filter-pill{height:28px;padding:0 11px;border-radius:6px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:11.5px;color:var(--wec-text-secondary);display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:all .12s;letter-spacing:-.005em;white-space:nowrap}
.wec-filter-pill:hover{color:var(--wec-text-primary)}
.wec-filter-pill.active{background:var(--wec-accent-soft);color:var(--wec-accent)}
.wec-filter-pill-cnt{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--wec-text-tertiary);font-weight:540}
.wec-filter-pill.active .wec-filter-pill-cnt{color:var(--wec-accent)}
.wec-filter-spacer{flex:1}

/* Category section */
.wec-cat{margin-bottom:24px;scroll-margin-top:80px}
.wec-cat.hilite .wec-cat-hdr{box-shadow:0 0 0 3px var(--wec-accent-soft);border-color:var(--wec-accent)}
.wec-cat-hdr{display:flex;align-items:center;gap:13px;padding:14px 18px;background:var(--wec-surface-1);border:1px solid var(--wec-border);border-radius:11px 11px 0 0;border-bottom:none;transition:all .25s}
.wec-cat-hdr-icon{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;color:#fff;flex-shrink:0}
.wec-cat-hdr-text{flex:1;min-width:0}
.wec-cat-hdr-name{font-family:'DM Sans',sans-serif;font-weight:760;font-size:16px;letter-spacing:-.015em;color:var(--wec-text-primary);line-height:1.2}
.wec-cat-hdr-desc{font-size:12.5px;color:var(--wec-text-secondary);margin-top:3px;line-height:1.4}
.wec-cat-hdr-cnt{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--wec-text-tertiary);background:var(--wec-surface-2);border:1px solid var(--wec-border);padding:4px 9px;border-radius:6px;font-weight:540;flex-shrink:0}
.wec-cat-events{background:var(--wec-surface-1);border:1px solid var(--wec-border);border-top:none;border-radius:0 0 11px 11px;display:flex;flex-direction:column}

/* Event cards */
.wec-event{border-bottom:1px solid var(--wec-border);transition:all .15s}
.wec-event:last-child{border-bottom:none}
.wec-event-hdr{padding:14px 18px;display:flex;align-items:flex-start;gap:14px;cursor:pointer;transition:all .12s;background:var(--wec-surface-1)}
.wec-event-hdr:hover{background:var(--wec-surface-hover)}
.wec-event.expanded .wec-event-hdr{background:var(--wec-surface-2)}
.wec-event-chev{flex-shrink:0;color:var(--wec-text-tertiary);transition:transform .2s;margin-top:3px}
.wec-event.expanded .wec-event-chev{transform:rotate(90deg);color:var(--wec-accent)}
.wec-event-body{flex:1;min-width:0}
.wec-event-row1{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:5px}
.wec-event-key{font-family:'JetBrains Mono',monospace;font-weight:680;font-size:14px;color:var(--wec-text-primary);letter-spacing:-.01em}
.wec-event-key-copy{width:24px;height:24px;border-radius:5px;display:grid;place-items:center;color:var(--wec-text-tertiary);background:transparent;border:none;cursor:pointer;opacity:0;transition:all .12s}
.wec-event-hdr:hover .wec-event-key-copy{opacity:1}
.wec-event-key-copy:hover{background:var(--wec-accent-soft);color:var(--wec-accent)}
.wec-event-key-copy.copied{opacity:1;color:var(--wec-ok)}
.wec-event-version{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--wec-text-tertiary);background:var(--wec-surface-2);border:1px solid var(--wec-border);padding:2px 6px;border-radius:4px}
.wec-event-desc{font-size:13px;color:var(--wec-text-secondary);line-height:1.55}

.wec-delivery-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:5px;font-family:'DM Sans',sans-serif;font-weight:660;font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;line-height:1.4;white-space:nowrap}
.wec-delivery-badge.atleast{color:var(--wec-ok);background:var(--wec-ok-soft)}
.wec-delivery-badge.besteffort{color:var(--wec-wr);background:var(--wec-wr-soft)}
.wec-delivery-dot{width:6px;height:6px;border-radius:50%;background:currentColor}

/* Payload viewer */
.wec-event-payload{padding:0 18px 18px;background:var(--wec-surface-2);border-top:1px solid var(--wec-border);animation:wecExpand .25s cubic-bezier(.2,.7,.3,1)}
@keyframes wecExpand{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
.wec-payload-hdr{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0 8px;flex-wrap:wrap}
.wec-payload-tabs{display:flex;gap:4px;background:transparent}
.wec-payload-tab{height:28px;padding:0 11px;border-radius:6px;font-family:'DM Sans',sans-serif;font-weight:660;font-size:11.5px;color:var(--wec-text-secondary);display:inline-flex;align-items:center;gap:5px;cursor:pointer;transition:all .12s;background:var(--wec-surface-3);border:1px solid var(--wec-border)}
.wec-payload-tab.active{background:var(--wec-surface-1);color:var(--wec-text-primary);border-color:var(--wec-border-strong)}
.wec-payload-meta{font-size:11.5px;color:var(--wec-text-tertiary);font-family:'DM Sans',sans-serif;font-weight:540;display:flex;align-items:center;gap:14px}
.wec-payload-meta strong{color:var(--wec-text-secondary);font-weight:660}
.wec-code-card{background:var(--wec-code-bg);border-radius:9px;padding:14px 0;position:relative;overflow:hidden}
.wec-code-card-hdr{display:flex;align-items:center;justify-content:space-between;padding:0 14px 12px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:10px}
.wec-code-card-label{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#7a766f;letter-spacing:.05em;text-transform:uppercase}
.wec-code-copy{height:26px;padding:0 10px;border-radius:5px;background:rgba(255,255,255,.08);color:#aca9a1;font-family:'DM Sans',sans-serif;font-weight:620;font-size:11px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;transition:all .12s;border:none}
.wec-code-copy:hover{background:rgba(255,255,255,.14);color:#fff}
.wec-code-copy.copied{background:rgba(45,138,94,.3);color:#9bd1a3}
.wec-json{font-family:'JetBrains Mono',monospace;font-size:12.5px;line-height:1.6;color:var(--wec-code-fg);padding:0 16px;overflow-x:auto;white-space:pre}
.wec-json-line{display:block;white-space:pre}
.wec-json-pad{white-space:pre;color:transparent}
.wec-json-key{color:var(--wec-code-key)}
.wec-json-str{color:var(--wec-code-str)}
.wec-json-num{color:var(--wec-code-num)}
.wec-json-bool{color:var(--wec-code-bool)}
.wec-json-null{color:var(--wec-code-null);font-style:italic}
.wec-json-punct{color:var(--wec-code-punct)}

/* Empty state */
.wec-empty{padding:50px 20px;text-align:center;color:var(--wec-text-tertiary);font-size:13px;background:var(--wec-surface-1);border:1px solid var(--wec-border);border-radius:12px}
.wec-empty-icon{width:48px;height:48px;border-radius:11px;background:var(--wec-surface-2);color:var(--wec-text-tertiary);display:grid;place-items:center;margin:0 auto 12px}
.wec-empty-title{font-family:'DM Sans',sans-serif;font-weight:680;font-size:14px;color:var(--wec-text-secondary);margin-bottom:4px}

/* Toast */
.wec-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--wec-text-primary);color:var(--wec-surface-1);padding:11px 18px;border-radius:9px;display:flex;align-items:center;gap:9px;font-family:'DM Sans',sans-serif;font-weight:620;font-size:13px;z-index:60;box-shadow:var(--wec-shadow-lg);animation:wecToastIn .25s cubic-bezier(.2,.7,.3,1)}
@keyframes wecToastIn{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}

/* Footer note */
.wec-footer-note{margin-top:30px;padding:18px 20px;background:var(--wec-surface-1);border:1px solid var(--wec-border);border-radius:11px;display:flex;align-items:flex-start;gap:13px}
.wec-footer-note-icon{width:32px;height:32px;border-radius:9px;background:var(--wec-accent-soft);color:var(--wec-accent);display:grid;place-items:center;flex-shrink:0}
.wec-footer-note-body{flex:1;font-size:13px;line-height:1.6;color:var(--wec-text-secondary)}
.wec-footer-note-body strong{color:var(--wec-text-primary);font-family:'DM Sans',sans-serif;font-weight:680}
.wec-footer-note-body code{font-family:'JetBrains Mono',monospace;font-size:11.5px;color:var(--wec-accent);background:var(--wec-accent-soft);padding:1px 5px;border-radius:3px}

/* Responsive */
@media (max-width:980px){
  .wec-hero-stats{grid-template-columns:repeat(2,1fr)}
  .wec-toc-grid{grid-template-columns:repeat(2,1fr)}
}
@media (max-width:720px){
  .wec-hero-stats{grid-template-columns:1fr 1fr}
  .wec-hero{padding:18px 18px}
  .wec-hero-title{font-size:22px}
  .wec-toc-grid{grid-template-columns:1fr}
  .wec-event-hdr{padding:12px 14px;gap:10px}
  .wec-event-payload{padding:0 14px 14px}
}
`;

  return (
    <div className="wec-root">
      <style>{css}</style>

      {/* Hero */}
      <div className="wec-hero">
        <div className="wec-hero-eyebrow">
          {I.webhook} Outbound webhooks · v1.1
        </div>
        <div className="wec-hero-title">Webhook Event Catalog</div>
        <div className="wec-hero-sub">
          Every event BuiltCRM emits to your webhook endpoints, with payload
          schemas and copy-ready examples. All payloads are JSON. Signatures
          are SHA-256 HMAC, sent in the{" "}
          <code className="wec-inline-code">X-BuiltCRM-Signature</code>{" "}
          header.
        </div>

        <div className="wec-hero-stats">
          <div className="wec-hero-stat">
            <div className="wec-hero-stat-key">Total events</div>
            <div className="wec-hero-stat-val">{totalEvents}</div>
            <div className="wec-hero-stat-foot">
              across {allCategories.length} categories
            </div>
          </div>
          <div className="wec-hero-stat">
            <div className="wec-hero-stat-key">At-least-once</div>
            <div className="wec-hero-stat-val">{atLeastOnceCount}</div>
            <div
              className="wec-hero-stat-foot"
              style={{ color: "var(--wec-ok)" }}
            >
              retried up to 5×
            </div>
          </div>
          <div className="wec-hero-stat">
            <div className="wec-hero-stat-key">Best-effort</div>
            <div className="wec-hero-stat-val">{bestEffortCount}</div>
            <div
              className="wec-hero-stat-foot"
              style={{ color: "var(--wec-wr)" }}
            >
              fired once, no retry
            </div>
          </div>
          <div className="wec-hero-stat">
            <div className="wec-hero-stat-key">API version</div>
            <div
              className="wec-hero-stat-val"
              style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 18,
              }}
            >
              v1.1
            </div>
            <div className="wec-hero-stat-foot">stable since Mar 2026</div>
          </div>
        </div>

        <div className="wec-hero-actions">
          <button
            className="wec-btn primary"
            onClick={() =>
              copyText(
                "openapi",
                "# BuiltCRM Webhook OpenAPI 3.1 spec\n# (would download .yaml)",
              )
            }
          >
            {copiedKey === "openapi" ? (
              <>
                {I.check} Copied
              </>
            ) : (
              <>
                {I.download} OpenAPI YAML
              </>
            )}
          </button>
          <button
            className="wec-btn"
            onClick={() =>
              copyText(
                "alljson",
                JSON.stringify(WEBHOOK_EVENT_CATALOG, null, 2),
              )
            }
          >
            {copiedKey === "alljson" ? (
              <>
                {I.check} Copied {totalEvents} events
              </>
            ) : (
              <>
                {I.copy} Copy all as JSON
              </>
            )}
          </button>
          <button
            className="wec-btn"
            onClick={() => setShowTestPanel(!showTestPanel)}
          >
            {I.terminal} {showTestPanel ? "Hide" : "Show"} test instructions
          </button>
        </div>
      </div>

      {/* Test panel (collapsible) */}
      {showTestPanel && (
        <div className="wec-test-panel">
          <div
            className="wec-test-panel-hdr open"
            onClick={() => setShowTestPanel(false)}
          >
            <div className="wec-test-panel-icon">{I.terminal}</div>
            <div style={{ flex: 1 }}>
              <div className="wec-test-panel-title">
                Verify webhook signatures
              </div>
              <div className="wec-test-panel-sub">
                Every request includes an HMAC-SHA256 signature. Verify it
                before trusting the payload.
              </div>
            </div>
            {I.chevD}
          </div>
          <div className="wec-test-panel-body">
            <p>
              Each outbound request is signed with your endpoint&apos;s
              signing secret. The signature is computed as{" "}
              <code>HMAC_SHA256(secret, timestamp + &quot;.&quot; + payload)</code>{" "}
              and sent in the <code>X-BuiltCRM-Signature</code> header along
              with a <code>X-BuiltCRM-Timestamp</code> header.
            </p>
            <p>
              <strong style={{ color: "var(--wec-text-primary)" }}>
                Reject any request
              </strong>{" "}
              where the signature doesn&apos;t match, or where the timestamp
              is more than 5 minutes old (replay protection). Test signing
              secrets live under{" "}
              <code>Settings › Webhooks › Signing secrets</code>.
            </p>
            <div
              className="wec-code-card"
              style={{ background: "#1a1814" }}
            >
              <div className="wec-code-card-hdr">
                <span className="wec-code-card-label">curl example</span>
                <button
                  className={`wec-code-copy${copiedKey === "curl" ? " copied" : ""}`}
                  onClick={() =>
                    copyText(
                      "curl",
                      `curl -X POST https://your-endpoint.com/webhook \\\n  -H "Content-Type: application/json" \\\n  -H "X-BuiltCRM-Signature: t=1714056181,v1=a3f4..." \\\n  -d @payload.json`,
                    )
                  }
                >
                  {copiedKey === "curl" ? I.check : I.copy}
                  {copiedKey === "curl" ? "Copied" : "Copy"}
                </button>
              </div>
              <div className="wec-json">
                <span className="wec-json-line">
                  <span className="wec-json-key">curl</span>
                  <span className="wec-json-punct"> -X POST </span>
                  <span className="wec-json-str">
                    https://your-endpoint.com/webhook
                  </span>
                  <span className="wec-json-punct"> \</span>
                </span>
                <span className="wec-json-line">
                  <span className="wec-json-pad">{"  "}</span>
                  <span className="wec-json-punct">-H </span>
                  <span className="wec-json-str">
                    &quot;Content-Type: application/json&quot;
                  </span>
                  <span className="wec-json-punct"> \</span>
                </span>
                <span className="wec-json-line">
                  <span className="wec-json-pad">{"  "}</span>
                  <span className="wec-json-punct">-H </span>
                  <span className="wec-json-str">
                    &quot;X-BuiltCRM-Signature: t=1714056181,v1=a3f4...&quot;
                  </span>
                  <span className="wec-json-punct"> \</span>
                </span>
                <span className="wec-json-line">
                  <span className="wec-json-pad">{"  "}</span>
                  <span className="wec-json-punct">-d </span>
                  <span className="wec-json-str">@payload.json</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick reference / TOC */}
      <div className="wec-toc">
        <div className="wec-toc-hdr">
          <div>
            <div className="wec-toc-title">Quick reference</div>
            <div className="wec-toc-sub">
              Jump to a category or search by event key.
            </div>
          </div>
          <div className="wec-search">
            {I.search}
            <input
              type="text"
              placeholder="Search events (e.g., rfi, draw, project)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="wec-toc-grid">
          {allCategories.map((c) => {
            const cfg = WEBHOOK_CATEGORY_CONFIG[c];
            const cnt = WEBHOOK_EVENT_CATALOG.filter(
              (e) => e.category === c,
            ).length;
            return (
              <button
                key={c}
                className="wec-toc-card"
                onClick={() => jumpToCategory(c)}
                style={{ borderLeftColor: cfg.color }}
              >
                <div
                  className="wec-toc-card-icon"
                  style={{ background: cfg.color }}
                >
                  {categoryIconFor(c)}
                </div>
                <div className="wec-toc-card-body">
                  <div className="wec-toc-card-name">{cfg.label}</div>
                  <div className="wec-toc-card-cnt">
                    {cnt} event{cnt === 1 ? "" : "s"}
                  </div>
                </div>
                <span className="wec-toc-card-arrow">{I.chevR}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter pills + expand/collapse */}
      <div className="wec-filters">
        <div className="wec-filter-pills">
          <button
            className={`wec-filter-pill${filterCategory === "all" ? " active" : ""}`}
            onClick={() => setFilterCategory("all")}
          >
            All{" "}
            <span className="wec-filter-pill-cnt">
              {WEBHOOK_EVENT_CATALOG.length}
            </span>
          </button>
          {allCategories.map((c) => {
            const cnt = WEBHOOK_EVENT_CATALOG.filter(
              (e) => e.category === c,
            ).length;
            return (
              <button
                key={c}
                className={`wec-filter-pill${filterCategory === c ? " active" : ""}`}
                onClick={() => setFilterCategory(c)}
              >
                {categoryIconFor(c)}
                {WEBHOOK_CATEGORY_CONFIG[c].label}
                <span className="wec-filter-pill-cnt">{cnt}</span>
              </button>
            );
          })}
        </div>
        <div className="wec-filter-spacer" />
        <button
          className="wec-btn ghost"
          onClick={expandAll}
          disabled={filteredEvents.length === 0}
        >
          {I.expand} Expand all
        </button>
        <button
          className="wec-btn ghost"
          onClick={collapseAll}
          disabled={expanded.size === 0}
        >
          {I.collapse} Collapse all
        </button>
      </div>

      {/* Categories + events */}
      {filteredEvents.length === 0 ? (
        <div className="wec-empty">
          <div className="wec-empty-icon">{I.search}</div>
          <div className="wec-empty-title">
            No events match &quot;{search}&quot;
          </div>
          <div>
            Try a broader term, or clear the filter to see all {totalEvents}{" "}
            events.
          </div>
        </div>
      ) : (
        allCategories.map((cat) => {
          const events = grouped[cat];
          if (events.length === 0) return null;
          const cfg = WEBHOOK_CATEGORY_CONFIG[cat];
          return (
            <section
              key={cat}
              id={`wec-cat-${cat}`}
              className={`wec-cat${activeAnchor === cat ? " hilite" : ""}`}
            >
              <div className="wec-cat-hdr">
                <div
                  className="wec-cat-hdr-icon"
                  style={{ background: cfg.color }}
                >
                  {categoryIconFor(cat)}
                </div>
                <div className="wec-cat-hdr-text">
                  <div className="wec-cat-hdr-name">{cfg.label}</div>
                  <div className="wec-cat-hdr-desc">{cfg.description}</div>
                </div>
                <span className="wec-cat-hdr-cnt">
                  {events.length} event{events.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="wec-cat-events">
                {events.map((ev) => {
                  const isOpen = expanded.has(ev.key);
                  return (
                    <div
                      key={ev.key}
                      className={`wec-event${isOpen ? " expanded" : ""}`}
                    >
                      <div
                        className="wec-event-hdr"
                        onClick={() => toggleExpand(ev.key)}
                      >
                        <span className="wec-event-chev">{I.chevR}</span>
                        <div className="wec-event-body">
                          <div className="wec-event-row1">
                            <span className="wec-event-key">{ev.key}</span>
                            <button
                              className={`wec-event-key-copy${copiedKey === `key-${ev.key}` ? " copied" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                copyText(`key-${ev.key}`, ev.key);
                              }}
                              title="Copy event key"
                            >
                              {copiedKey === `key-${ev.key}`
                                ? I.check
                                : I.copy}
                            </button>
                            <DeliveryBadge kind={ev.deliveryGuarantee} />
                            <span className="wec-event-version">
                              since {ev.sinceVersion}
                            </span>
                          </div>
                          <div className="wec-event-desc">
                            {ev.description}
                          </div>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="wec-event-payload">
                          <div className="wec-payload-hdr">
                            <div className="wec-payload-tabs">
                              <button className="wec-payload-tab active">
                                Example payload
                              </button>
                              <button className="wec-payload-tab">
                                Schema
                              </button>
                            </div>
                            <div className="wec-payload-meta">
                              <span>
                                Content-Type:{" "}
                                <strong>application/json</strong>
                              </span>
                              <span>
                                Method: <strong>POST</strong>
                              </span>
                            </div>
                          </div>
                          <div className="wec-code-card">
                            <div className="wec-code-card-hdr">
                              <span className="wec-code-card-label">
                                {ev.key} · example payload
                              </span>
                              <button
                                className={`wec-code-copy${copiedKey === `payload-${ev.key}` ? " copied" : ""}`}
                                onClick={() =>
                                  copyText(
                                    `payload-${ev.key}`,
                                    JSON.stringify(ev.examplePayload, null, 2),
                                  )
                                }
                              >
                                {copiedKey === `payload-${ev.key}`
                                  ? I.check
                                  : I.copy}
                                {copiedKey === `payload-${ev.key}`
                                  ? "Copied"
                                  : "Copy JSON"}
                              </button>
                            </div>
                            <div className="wec-json">
                              <JsonNode
                                value={ev.examplePayload}
                                indent={0}
                                isLast={true}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {/* Footer note */}
      <div className="wec-footer-note">
        <div className="wec-footer-note-icon">{I.info}</div>
        <div className="wec-footer-note-body">
          <strong>Versioning policy.</strong> Events follow semver-like
          versioning (<code>v1.0</code>, <code>v1.1</code>, etc). New optional
          fields are added in minor versions; breaking changes (renamed or
          removed fields) bump the major. Pin your endpoint to a specific
          version under <strong>Endpoints › Edit › API version</strong>. The{" "}
          <code>since</code> badge on each event indicates when it was first
          introduced.
        </div>
      </div>

      {/* Toast */}
      {copiedKey &&
        (copiedKey.startsWith("key-") ||
          copiedKey === "alljson" ||
          copiedKey === "openapi") && (
          <div className="wec-toast">
            {I.check}
            {copiedKey === "alljson" &&
              `Copied ${totalEvents} events as JSON`}
            {copiedKey === "openapi" && "OpenAPI YAML copied to clipboard"}
            {copiedKey.startsWith("key-") &&
              `Copied ${copiedKey.slice(4)}`}
          </div>
        )}
    </div>
  );
}
