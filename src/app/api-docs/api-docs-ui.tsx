"use client";

// Step 60 — Public API docs UI.
//
// TypeScript port of `docs/prototypes/builtcrm_api_docs_public.jsx`. The
// prototype is the design contract; the OpenAPI spec at
// `docs/specs/openapi.yaml` is the machine-readable counterpart.
//
// Why a custom renderer (not redoc / swagger-ui):
//   - The prototype defines a specific three-pane layout, typography stack,
//     and color tokens that match the rest of BuiltCRM's marketing surface.
//   - redoc / swagger-ui ship their own visual systems that would clash.
//   - The endpoint surface is small (12 endpoints); the data model fits
//     in this file without ceremony.
//
// API docs is just another page on the marketing site. Same nav, same
// chrome — copy of the marketing-page nav HTML rendered inline. No
// shared component, no session plumbing.
//
// What's wired beyond the prototype:
//   - Sidebar search filters the endpoint list.
//   - "Download OpenAPI" hits /openapi.yaml (the route handler).
//   - "Try it · Sign in" stays disabled per spec (auth-only feature).

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

const MKT_F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
};

const MKT_ARR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const F = {
  display: "'DM Sans',system-ui,sans-serif",
  body: "'Instrument Sans',system-ui,sans-serif",
  mono: "'JetBrains Mono',monospace",
};

// ── Tokens (light only for public docs; warm neutral palette) ────
const T = {
  bg: "#faf9f7",
  surface: "#ffffff",
  surfaceAlt: "#f3f1ec",
  surfaceDark: "#1a1714",
  codeBg: "#16151a",
  codeText: "#eae9ed",
  codeMuted: "#6b6874",
  codeAccent: "#b4adf0",
  codeString: "#7fcf97",
  codeKey: "#e8a84c",
  border: "#eeece8",
  borderDark: "#2a2930",
  textPrimary: "#1a1714",
  textSecondary: "#5e5850",
  textTertiary: "#928b80",
  accent: "#5b4fc7",
  accentSoft: "#eeedfb",
  accentText: "#4a3fb0",
  accentMuted: "#c7c2ea",
  success: "#2d8a5e",
  successSoft: "#edf7f1",
  successText: "#1e6b46",
  warning: "#c17a1a",
  warningSoft: "#fdf4e6",
  warningText: "#96600f",
  danger: "#c93b3b",
  dangerSoft: "#fdeaea",
  dangerText: "#a52e2e",
  info: "#3178b9",
  infoSoft: "#e8f1fa",
  infoText: "#276299",
};

// ── Icons (inline SVG only — CLAUDE.md no-emoji rule) ────────────
const I = {
  search: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  ),
  download: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  copy: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
};

// ── Sidebar nav structure ────────────────────────────────────────
type NavPage = { id: string; label: string; kind: "page" };
type NavEndpoint = { id: string; label: string; verb: HttpVerb; path: string };
type NavItem = NavPage | NavEndpoint;
type NavSection = { section: string; items: NavItem[] };

type HttpVerb = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

const NAV: NavSection[] = [
  {
    section: "Get started",
    items: [
      { id: "intro", label: "Introduction", kind: "page" },
      { id: "auth", label: "Authentication", kind: "page" },
      { id: "rate-limits", label: "Rate limits", kind: "page" },
      { id: "errors", label: "Errors", kind: "page" },
      { id: "versioning", label: "Versioning", kind: "page" },
    ],
  },
  {
    section: "Projects",
    items: [
      { id: "ep-projects-list", label: "List projects", verb: "GET", path: "/projects" },
      { id: "ep-projects-get", label: "Get a project", verb: "GET", path: "/projects/{id}" },
    ],
  },
  {
    section: "RFIs",
    items: [
      { id: "ep-rfis-list", label: "List RFIs", verb: "GET", path: "/rfis" },
      { id: "ep-rfis-get", label: "Get an RFI", verb: "GET", path: "/rfis/{id}" },
      { id: "ep-rfis-create", label: "Create an RFI", verb: "POST", path: "/rfis" },
    ],
  },
  {
    section: "Change orders",
    items: [
      { id: "ep-co-list", label: "List change orders", verb: "GET", path: "/change-orders" },
      { id: "ep-co-get", label: "Get a change order", verb: "GET", path: "/change-orders/{id}" },
    ],
  },
  {
    section: "Documents",
    items: [
      { id: "ep-docs-list", label: "List documents", verb: "GET", path: "/documents" },
      { id: "ep-docs-get", label: "Get a document", verb: "GET", path: "/documents/{id}" },
    ],
  },
  {
    section: "Webhooks",
    items: [
      { id: "ep-wh-create", label: "Subscribe", verb: "POST", path: "/webhooks" },
      { id: "ep-wh-delete", label: "Unsubscribe", verb: "DELETE", path: "/webhooks/{id}" },
    ],
  },
];

// ── Per-endpoint definitions ─────────────────────────────────────
type ParamLocation = "query" | "path" | "body";
type EndpointParam = {
  name: string;
  in: ParamLocation;
  type: string;
  required: boolean;
  desc: string;
};
type EndpointResponse = { code: string; desc: string };
type EndpointDef = {
  verb: HttpVerb;
  path: string;
  title: string;
  desc: string;
  params: EndpointParam[];
  responses: EndpointResponse[];
  samples: { curl: string; js: string; python: string };
  response: string;
};
type SampleLang = "curl" | "js" | "python";

const ENDPOINTS: Record<string, EndpointDef> = {
  "ep-projects-list": {
    verb: "GET",
    path: "/projects",
    title: "List projects",
    desc:
      "Returns a paginated list of projects in your organization. Results are filtered to projects the API key has access to (admin scope sees all; read/write sees projects within the key's scope).",
    params: [
      { name: "limit", in: "query", type: "integer", required: false, desc: "Page size, 1–100. Default 25." },
      { name: "cursor", in: "query", type: "string", required: false, desc: "Pagination cursor from a prior response's next_cursor." },
      { name: "status", in: "query", type: "enum", required: false, desc: "Filter: active · paused · completed · archived." },
      { name: "type", in: "query", type: "enum", required: false, desc: "Filter: residential · commercial." },
    ],
    responses: [
      { code: "200", desc: "Successful response with a project page." },
      { code: "401", desc: "Missing or invalid API key." },
      { code: "429", desc: "Rate limit exceeded. See Retry-After header." },
    ],
    samples: {
      curl: `curl https://api.builtcrm.app/v1/projects?limit=10 \\
  -H "Authorization: Bearer bcrm_live_..."`,
      js: `const res = await fetch(
  "https://api.builtcrm.app/v1/projects?limit=10",
  { headers: { Authorization: \`Bearer \${process.env.BCRM_KEY}\` } }
);
const { data, next_cursor } = await res.json();`,
      python: `import requests
r = requests.get(
  "https://api.builtcrm.app/v1/projects",
  params={"limit": 10},
  headers={"Authorization": f"Bearer {os.environ['BCRM_KEY']}"},
)
data = r.json()["data"]`,
    },
    response: `{
  "data": [
    {
      "id": "proj_01HV4K8F2N",
      "name": "Riverside Tower Fit-Out",
      "type": "commercial",
      "status": "active",
      "address": "240 Riverside Dr, Toronto ON",
      "contract_value_cents": 240000000,
      "created_at": "2025-11-04T15:22:18Z",
      "updated_at": "2026-04-13T10:14:02Z"
    }
  ],
  "next_cursor": "eyJpZCI6InByb2pfMDFIVjRLO..."
}`,
  },
  "ep-projects-get": {
    verb: "GET",
    path: "/projects/{id}",
    title: "Get a project",
    desc:
      "Returns a single project by ID, including a summary of related counts (open RFIs, pending draws, active change orders).",
    params: [
      { name: "id", in: "path", type: "string", required: true, desc: "The project ID, e.g. proj_01HV4K8F2N." },
    ],
    responses: [
      { code: "200", desc: "Project found." },
      { code: "404", desc: "Project not found or not accessible to this key." },
    ],
    samples: {
      curl: `curl https://api.builtcrm.app/v1/projects/proj_01HV4K8F2N \\
  -H "Authorization: Bearer bcrm_live_..."`,
      js: `const res = await fetch(
  \`https://api.builtcrm.app/v1/projects/\${id}\`,
  { headers: { Authorization: \`Bearer \${process.env.BCRM_KEY}\` } }
);`,
      python: `r = requests.get(
  f"https://api.builtcrm.app/v1/projects/{project_id}",
  headers={"Authorization": f"Bearer {os.environ['BCRM_KEY']}"},
)`,
    },
    response: `{
  "id": "proj_01HV4K8F2N",
  "name": "Riverside Tower Fit-Out",
  "type": "commercial",
  "status": "active",
  "address": "240 Riverside Dr, Toronto ON",
  "contract_value_cents": 240000000,
  "summary": {
    "open_rfis": 4,
    "pending_draws": 1,
    "active_change_orders": 2
  },
  "created_at": "2025-11-04T15:22:18Z"
}`,
  },
  "ep-rfis-list": {
    verb: "GET",
    path: "/rfis",
    title: "List RFIs",
    desc:
      "Returns RFIs across one or many projects, ordered by most-recently-updated. Filter by project, status, or assignee.",
    params: [
      { name: "project_id", in: "query", type: "string", required: false, desc: "Restrict to a single project." },
      { name: "status", in: "query", type: "enum", required: false, desc: "open · in_review · responded · closed." },
      { name: "limit", in: "query", type: "integer", required: false, desc: "Page size, 1–100." },
    ],
    responses: [
      { code: "200", desc: "Successful response." },
      { code: "401", desc: "Missing or invalid API key." },
    ],
    samples: {
      curl: `curl "https://api.builtcrm.app/v1/rfis?project_id=proj_01HV4K8F2N&status=open" \\
  -H "Authorization: Bearer bcrm_live_..."`,
      js: `const params = new URLSearchParams({
  project_id: "proj_01HV4K8F2N",
  status: "open",
});
const res = await fetch(\`https://api.builtcrm.app/v1/rfis?\${params}\`, {
  headers: { Authorization: \`Bearer \${process.env.BCRM_KEY}\` },
});`,
      python: `r = requests.get(
  "https://api.builtcrm.app/v1/rfis",
  params={"project_id": "proj_01HV4K8F2N", "status": "open"},
  headers={"Authorization": f"Bearer {os.environ['BCRM_KEY']}"},
)`,
    },
    response: `{
  "data": [
    {
      "id": "rfi_01HV5Q92BC",
      "project_id": "proj_01HV4K8F2N",
      "number": "RFI-014",
      "subject": "Steel column splice detail at L4",
      "status": "open",
      "trade": "structural_steel",
      "due_at": "2026-04-18T00:00:00Z",
      "created_at": "2026-04-11T08:42:00Z"
    }
  ],
  "next_cursor": null
}`,
  },
  "ep-rfis-get": {
    verb: "GET",
    path: "/rfis/{id}",
    title: "Get an RFI",
    desc: "Returns a single RFI with its full response thread and any attached documents.",
    params: [{ name: "id", in: "path", type: "string", required: true, desc: "The RFI ID." }],
    responses: [
      { code: "200", desc: "RFI found." },
      { code: "404", desc: "RFI not found." },
    ],
    samples: {
      curl: `curl https://api.builtcrm.app/v1/rfis/rfi_01HV5Q92BC \\
  -H "Authorization: Bearer bcrm_live_..."`,
      js: `const res = await fetch(\`https://api.builtcrm.app/v1/rfis/\${id}\`, {
  headers: { Authorization: \`Bearer \${process.env.BCRM_KEY}\` },
});`,
      python: `r = requests.get(
  f"https://api.builtcrm.app/v1/rfis/{rfi_id}",
  headers={"Authorization": f"Bearer {os.environ['BCRM_KEY']}"},
)`,
    },
    response: `{
  "id": "rfi_01HV5Q92BC",
  "project_id": "proj_01HV4K8F2N",
  "number": "RFI-014",
  "subject": "Steel column splice detail at L4",
  "status": "open",
  "responses": [
    {
      "id": "rfi_resp_01HV5RAE7K",
      "author_id": "usr_01HRZ31XPR",
      "body": "Splice per detail S5.02. See sheet attached.",
      "created_at": "2026-04-12T14:05:11Z"
    }
  ]
}`,
  },
  "ep-rfis-create": {
    verb: "POST",
    path: "/rfis",
    title: "Create an RFI",
    desc:
      "Creates a new RFI on a project. Requires write or admin scope. The RFI is created in status 'open' and routed to the trade lead by default.",
    params: [
      { name: "project_id", in: "body", type: "string", required: true, desc: "Target project." },
      { name: "subject", in: "body", type: "string", required: true, desc: "Short title, max 200 chars." },
      { name: "body", in: "body", type: "string", required: true, desc: "Markdown allowed." },
      { name: "trade", in: "body", type: "enum", required: false, desc: "structural · mechanical · electrical · …" },
      { name: "due_at", in: "body", type: "datetime", required: false, desc: "ISO-8601 timestamp." },
    ],
    responses: [
      { code: "201", desc: "RFI created." },
      { code: "400", desc: "Validation failed (missing or malformed fields)." },
      { code: "403", desc: "Key lacks write or admin scope." },
    ],
    samples: {
      curl: `curl -X POST https://api.builtcrm.app/v1/rfis \\
  -H "Authorization: Bearer bcrm_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "project_id": "proj_01HV4K8F2N",
    "subject": "Beam pocket dimension at gridline C-3",
    "body": "Drawing shows 8\\" but field measured 7-3/4\\". Confirm.",
    "trade": "structural"
  }'`,
      js: `const res = await fetch("https://api.builtcrm.app/v1/rfis", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.BCRM_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    project_id: "proj_01HV4K8F2N",
    subject: "Beam pocket dimension at gridline C-3",
    body: "Drawing shows 8\\" but field measured 7-3/4\\". Confirm.",
    trade: "structural",
  }),
});`,
      python: `r = requests.post(
  "https://api.builtcrm.app/v1/rfis",
  json={
    "project_id": "proj_01HV4K8F2N",
    "subject": "Beam pocket dimension at gridline C-3",
    "body": "Drawing shows 8\\" but field measured 7-3/4\\". Confirm.",
    "trade": "structural",
  },
  headers={"Authorization": f"Bearer {os.environ['BCRM_KEY']}"},
)`,
    },
    response: `{
  "id": "rfi_01HV6W12XX",
  "project_id": "proj_01HV4K8F2N",
  "number": "RFI-022",
  "subject": "Beam pocket dimension at gridline C-3",
  "status": "open",
  "trade": "structural",
  "created_at": "2026-04-14T11:08:42Z"
}`,
  },
  "ep-co-list": {
    verb: "GET",
    path: "/change-orders",
    title: "List change orders",
    desc: "Returns change orders across projects with their cost and schedule impact. Filter by project or status.",
    params: [
      { name: "project_id", in: "query", type: "string", required: false, desc: "Restrict to a single project." },
      { name: "status", in: "query", type: "enum", required: false, desc: "draft · submitted · approved · rejected." },
    ],
    responses: [{ code: "200", desc: "Successful response." }],
    samples: {
      curl: `curl "https://api.builtcrm.app/v1/change-orders?status=submitted" \\
  -H "Authorization: Bearer bcrm_live_..."`,
      js: `const res = await fetch(
  "https://api.builtcrm.app/v1/change-orders?status=submitted",
  { headers: { Authorization: \`Bearer \${process.env.BCRM_KEY}\` } }
);`,
      python: `r = requests.get(
  "https://api.builtcrm.app/v1/change-orders",
  params={"status": "submitted"},
  headers={"Authorization": f"Bearer {os.environ['BCRM_KEY']}"},
)`,
    },
    response: `{
  "data": [
    {
      "id": "co_01HV7K22ZQ",
      "project_id": "proj_01HV4K8F2N",
      "number": "CO-007",
      "subject": "Add stone veneer to lobby north wall",
      "status": "submitted",
      "amount_cents": 3450000,
      "schedule_days_impact": 4,
      "submitted_at": "2026-04-09T13:11:00Z"
    }
  ]
}`,
  },
  "ep-co-get": {
    verb: "GET",
    path: "/change-orders/{id}",
    title: "Get a change order",
    desc: "Returns a single change order with its line-item breakdown and approval timeline.",
    params: [{ name: "id", in: "path", type: "string", required: true, desc: "The change order ID." }],
    responses: [
      { code: "200", desc: "Change order found." },
      { code: "404", desc: "Change order not found." },
    ],
    samples: {
      curl: `curl https://api.builtcrm.app/v1/change-orders/co_01HV7K22ZQ \\
  -H "Authorization: Bearer bcrm_live_..."`,
      js: `const res = await fetch(\`https://api.builtcrm.app/v1/change-orders/\${id}\`, {
  headers: { Authorization: \`Bearer \${process.env.BCRM_KEY}\` },
});`,
      python: `r = requests.get(
  f"https://api.builtcrm.app/v1/change-orders/{co_id}",
  headers={"Authorization": f"Bearer {os.environ['BCRM_KEY']}"},
)`,
    },
    response: `{
  "id": "co_01HV7K22ZQ",
  "number": "CO-007",
  "status": "submitted",
  "amount_cents": 3450000,
  "schedule_days_impact": 4,
  "line_items": [
    { "description": "Stone veneer materials", "amount_cents": 2100000 },
    { "description": "Mason labor",            "amount_cents": 1200000 },
    { "description": "Sealer + cleanup",       "amount_cents":  150000 }
  ]
}`,
  },
  "ep-docs-list": {
    verb: "GET",
    path: "/documents",
    title: "List documents",
    desc:
      "Returns documents accessible to the API key. Filter by project, folder, or kind. Returns metadata only — use the document URL to download.",
    params: [
      { name: "project_id", in: "query", type: "string", required: false, desc: "Restrict to a single project." },
      { name: "kind", in: "query", type: "enum", required: false, desc: "drawing · spec · permit · contract · photo · invoice · other." },
    ],
    responses: [{ code: "200", desc: "Successful response." }],
    samples: {
      curl: `curl "https://api.builtcrm.app/v1/documents?project_id=proj_01HV4K8F2N&kind=drawing" \\
  -H "Authorization: Bearer bcrm_live_..."`,
      js: `const res = await fetch(
  \`https://api.builtcrm.app/v1/documents?project_id=\${id}&kind=drawing\`,
  { headers: { Authorization: \`Bearer \${process.env.BCRM_KEY}\` } }
);`,
      python: `r = requests.get(
  "https://api.builtcrm.app/v1/documents",
  params={"project_id": "proj_01HV4K8F2N", "kind": "drawing"},
  headers={"Authorization": f"Bearer {os.environ['BCRM_KEY']}"},
)`,
    },
    response: `{
  "data": [
    {
      "id": "doc_01HV8P55KN",
      "project_id": "proj_01HV4K8F2N",
      "kind": "drawing",
      "name": "S5.02 — Splice details.pdf",
      "size_bytes": 1840291,
      "url_expires_at": "2026-04-14T12:42:00Z",
      "url": "https://files.builtcrm.app/private/...?signed=..."
    }
  ]
}`,
  },
  "ep-docs-get": {
    verb: "GET",
    path: "/documents/{id}",
    title: "Get a document",
    desc:
      "Returns metadata and a fresh time-limited download URL. URLs expire 15 minutes after issuance — re-fetch as needed.",
    params: [{ name: "id", in: "path", type: "string", required: true, desc: "The document ID." }],
    responses: [
      { code: "200", desc: "Document found." },
      { code: "404", desc: "Document not found or not accessible." },
    ],
    samples: {
      curl: `curl https://api.builtcrm.app/v1/documents/doc_01HV8P55KN \\
  -H "Authorization: Bearer bcrm_live_..."`,
      js: `const res = await fetch(\`https://api.builtcrm.app/v1/documents/\${id}\`, {
  headers: { Authorization: \`Bearer \${process.env.BCRM_KEY}\` },
});
const { url } = await res.json();
const file = await fetch(url);`,
      python: `r = requests.get(
  f"https://api.builtcrm.app/v1/documents/{doc_id}",
  headers={"Authorization": f"Bearer {os.environ['BCRM_KEY']}"},
)
download_url = r.json()["url"]`,
    },
    response: `{
  "id": "doc_01HV8P55KN",
  "name": "S5.02 — Splice details.pdf",
  "kind": "drawing",
  "size_bytes": 1840291,
  "content_type": "application/pdf",
  "url": "https://files.builtcrm.app/private/...?signed=...",
  "url_expires_at": "2026-04-14T12:42:00Z"
}`,
  },
  "ep-wh-create": {
    verb: "POST",
    path: "/webhooks",
    title: "Subscribe to events",
    desc:
      "Creates a webhook subscription. BuiltCRM will POST signed payloads to your URL whenever any of the chosen events occur. See the Webhook event catalog for the full event list.",
    params: [
      { name: "url", in: "body", type: "string", required: true, desc: "Your HTTPS endpoint." },
      { name: "events", in: "body", type: "array", required: true, desc: 'Array of event keys, e.g. ["rfi.created", "draw.approved"].' },
      {
        name: "secret",
        in: "body",
        type: "string",
        required: false,
        desc: "If provided, used to sign payloads via HMAC-SHA256. If omitted, BuiltCRM generates one and returns it once.",
      },
    ],
    responses: [
      { code: "201", desc: "Subscription created. Generated secret returned if not supplied." },
      { code: "400", desc: "Invalid URL or unknown event keys." },
    ],
    samples: {
      curl: `curl -X POST https://api.builtcrm.app/v1/webhooks \\
  -H "Authorization: Bearer bcrm_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://example.com/hooks/builtcrm",
    "events": ["rfi.created", "co.approved", "draw.paid"]
  }'`,
      js: `const res = await fetch("https://api.builtcrm.app/v1/webhooks", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.BCRM_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://example.com/hooks/builtcrm",
    events: ["rfi.created", "co.approved", "draw.paid"],
  }),
});`,
      python: `r = requests.post(
  "https://api.builtcrm.app/v1/webhooks",
  json={
    "url": "https://example.com/hooks/builtcrm",
    "events": ["rfi.created", "co.approved", "draw.paid"],
  },
  headers={"Authorization": f"Bearer {os.environ['BCRM_KEY']}"},
)`,
    },
    response: `{
  "id": "whk_01HV9C6NQA",
  "url": "https://example.com/hooks/builtcrm",
  "events": ["rfi.created", "co.approved", "draw.paid"],
  "secret": "whsec_8d2e7f...",
  "created_at": "2026-04-14T11:18:02Z"
}`,
  },
  "ep-wh-delete": {
    verb: "DELETE",
    path: "/webhooks/{id}",
    title: "Unsubscribe",
    desc: "Permanently deletes a webhook subscription. Pending deliveries are cancelled.",
    params: [{ name: "id", in: "path", type: "string", required: true, desc: "The subscription ID." }],
    responses: [
      { code: "204", desc: "Deleted. No body." },
      { code: "404", desc: "Subscription not found." },
    ],
    samples: {
      curl: `curl -X DELETE https://api.builtcrm.app/v1/webhooks/whk_01HV9C6NQA \\
  -H "Authorization: Bearer bcrm_live_..."`,
      js: `await fetch(\`https://api.builtcrm.app/v1/webhooks/\${id}\`, {
  method: "DELETE",
  headers: { Authorization: \`Bearer \${process.env.BCRM_KEY}\` },
});`,
      python: `requests.delete(
  f"https://api.builtcrm.app/v1/webhooks/{whk_id}",
  headers={"Authorization": f"Bearer {os.environ['BCRM_KEY']}"},
)`,
    },
    response: `// 204 No Content`,
  },
};

// ── Common error codes ──────────────────────────────────────────
type ErrorEntry = { code: string; name: string; desc: string };
const ERRORS: ErrorEntry[] = [
  { code: "400", name: "Bad Request", desc: "Request body or query is malformed." },
  { code: "401", name: "Unauthorized", desc: "Missing or invalid API key." },
  { code: "403", name: "Forbidden", desc: "Key lacks the required scope." },
  { code: "404", name: "Not Found", desc: "Resource doesn't exist or isn't visible to your key." },
  { code: "409", name: "Conflict", desc: "The action conflicts with current state (e.g. duplicate idempotency key)." },
  { code: "422", name: "Unprocessable Entity", desc: "Validation failed; see error.fields." },
  { code: "429", name: "Too Many Requests", desc: "Rate limit exceeded. Honor Retry-After." },
  { code: "500", name: "Server Error", desc: "Something went wrong on our end. Retry with backoff." },
];

type SwatchKey = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
type Swatch = { bg: string; fg: string; border: string };
const VERB_COLOR: Record<SwatchKey, Swatch> = {
  GET: { bg: T.successSoft, fg: T.successText, border: "#a7d9be" },
  POST: { bg: T.accentSoft, fg: T.accentText, border: T.accentMuted },
  PUT: { bg: T.warningSoft, fg: T.warningText, border: "#f5d6a0" },
  DELETE: { bg: T.dangerSoft, fg: T.dangerText, border: "#f0b8b8" },
  PATCH: { bg: T.infoSoft, fg: T.infoText, border: "#b3d4ee" },
};

function statusColor(code: string): Swatch {
  const n = parseInt(code, 10);
  if (n >= 200 && n < 300) return { bg: T.successSoft, fg: T.successText, border: "#a7d9be" };
  if (n >= 300 && n < 400) return { bg: T.infoSoft, fg: T.infoText, border: "#b3d4ee" };
  if (n >= 400 && n < 500) return { bg: T.warningSoft, fg: T.warningText, border: "#f5d6a0" };
  return { bg: T.dangerSoft, fg: T.dangerText, border: "#f0b8b8" };
}

// ────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────

export type ApiDocsSession = {
  signedIn: boolean;
  dashboardHref: string | null;
};

export function ApiDocsUI({ session }: { session?: ApiDocsSession } = {}) {
  const signedIn = session?.signedIn ?? false;
  const dashboardHref = session?.dashboardHref ?? "/no-portal";

  const [selected, setSelected] = useState<string>("intro");
  const [lang, setLang] = useState<SampleLang>("curl");
  const [search, setSearch] = useState<string>("");

  const isEndpoint = selected.startsWith("ep-");
  const endpoint = isEndpoint ? ENDPOINTS[selected] : null;

  // Filter the nav by the search term. Sections with no remaining items
  // are hidden so the sidebar doesn't show empty headers.
  const filteredNav = useMemo<NavSection[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => {
        if (it.label.toLowerCase().includes(q)) return true;
        if ("path" in it && it.path.toLowerCase().includes(q)) return true;
        return false;
      }),
    })).filter((sec) => sec.items.length > 0);
  }, [search]);

  return (
    <div
      style={{
        fontFamily: F.body,
        background: T.bg,
        color: T.textPrimary,
        WebkitFontSmoothing: "antialiased",
        minHeight: "100vh",
      }}
    >
      {/* Marketing-site nav — copy of the nav in marketing-page.tsx. Five
          tabs (Product / Solutions / Pricing / Resources are real Links
          back to /; "API docs" is the active page). */}
      <nav style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(250,249,247,.85)", backdropFilter: "blur(16px)", borderBottom: "1px solid #eeece8", padding: "0 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textDecoration: "none", color: "inherit" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#2c2541,#5b4fc7)", display: "grid", placeItems: "center" }}>
              <svg viewBox="0 0 80 80" width="19" height="19"><rect x="14" y="14" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".5" /><rect x="26" y="26" width="26" height="26" rx="4" fill="none" stroke="white" strokeWidth="3.5" opacity=".75" /><rect x="32" y="32" width="26" height="26" rx="4" fill="white" opacity=".95" /></svg>
            </div>
            <div style={{ fontFamily: MKT_F.display, fontSize: 19, fontWeight: 780, letterSpacing: "-.04em" }}>BuiltCRM</div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Link href="/" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 560, color: "#5e5850", borderRadius: 10, cursor: "pointer", transition: "all 120ms", textDecoration: "none" }}>Product</Link>
            <Link href="/" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 560, color: "#5e5850", borderRadius: 10, cursor: "pointer", transition: "all 120ms", textDecoration: "none" }}>Solutions</Link>
            <Link href="/" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 560, color: "#5e5850", borderRadius: 10, cursor: "pointer", transition: "all 120ms", textDecoration: "none" }}>Pricing</Link>
            <Link href="/" style={{ padding: "8px 14px", fontSize: 14, fontWeight: 560, color: "#5e5850", borderRadius: 10, cursor: "pointer", transition: "all 120ms", textDecoration: "none" }}>Resources</Link>
            <span style={{ padding: "8px 14px", fontSize: 14, fontWeight: 640, color: "#1a1714", borderRadius: 10 }}>API docs</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {signedIn ? (
              <Link href={dashboardHref} style={{ height: 38, padding: "0 20px", fontSize: 13.5, fontWeight: 650, color: "white", background: "#5b4fc7", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", textDecoration: "none", fontFamily: MKT_F.body }}>
                Open dashboard <span style={{ width: 14, height: 14, display: "block" }}>{MKT_ARR}</span>
              </Link>
            ) : (
              <>
                <Link href="/login" style={{ height: 38, padding: "0 16px", fontSize: 13.5, fontWeight: 620, color: "#5e5850", background: "transparent", border: "none", borderRadius: 10, cursor: "pointer", display: "inline-flex", alignItems: "center", textDecoration: "none", fontFamily: MKT_F.body }}>Log in</Link>
                <Link href="/signup" style={{ height: 38, padding: "0 20px", fontSize: 13.5, fontWeight: 650, color: "white", background: "#5b4fc7", borderRadius: 10, display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", textDecoration: "none", fontFamily: MKT_F.body }}>
                  Get started free <span style={{ width: 14, height: 14, display: "block" }}>{MKT_ARR}</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Sub-header just for the docs page: API version pill +
          Download OpenAPI. Sits below the marketing nav. */}
      <div style={{ borderBottom: `1px solid ${T.border}`, background: T.surface, padding: "0 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: F.display, fontSize: 11, fontWeight: 700, color: T.accentText, padding: "3px 10px", background: T.accentSoft, border: `1px solid ${T.accentMuted}`, borderRadius: 999, letterSpacing: ".02em" }}>
              API · v1
            </span>
            <span style={{ fontSize: 12.5, color: T.textTertiary, fontWeight: 520 }}>REST · JSON · Bearer auth</span>
          </div>
          <a href="/openapi.yaml" download style={{ height: 30, padding: "0 12px", fontSize: 12.5, fontWeight: 600, color: T.textSecondary, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: F.display, textDecoration: "none" }}>
            <span style={{ width: 14, height: 14, display: "block" }}>{I.download}</span>
            Download OpenAPI
          </a>
        </div>
      </div>

      {/* ══════ THREE-PANE LAYOUT ══════ */}
      {/* Marketing nav 64 + sub-header 44 = 108px total chrome. */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 380px",
          maxWidth: 1440,
          margin: "0 auto",
          minHeight: "calc(100vh - 108px)",
        }}
      >
        {/* ── LEFT NAV ── */}
        <aside
          style={{
            borderRight: `1px solid ${T.border}`,
            padding: "24px 8px 40px 24px",
            position: "sticky",
            top: 108,
            height: "calc(100vh - 108px)",
            overflowY: "auto",
          }}
        >
          {/* Search */}
          <div style={{ position: "relative", marginBottom: 18 }}>
            <span
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 14,
                height: 14,
                color: T.textTertiary,
              }}
            >
              {I.search}
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search endpoints…"
              aria-label="Search the API reference"
              style={{
                width: "100%",
                height: 34,
                padding: "0 12px 0 32px",
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: T.surface,
                color: T.textPrimary,
                fontSize: 12.5,
                fontFamily: F.body,
                fontWeight: 520,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {filteredNav.length === 0 ? (
            <div
              style={{
                padding: "12px 8px",
                fontSize: 12,
                color: T.textTertiary,
                fontWeight: 520,
              }}
            >
              No results for &ldquo;{search}&rdquo;.
            </div>
          ) : (
            filteredNav.map((sec) => (
              <div key={sec.section} style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontFamily: F.display,
                    fontSize: 10.5,
                    fontWeight: 720,
                    color: T.textTertiary,
                    textTransform: "uppercase",
                    letterSpacing: ".08em",
                    padding: "0 8px 8px",
                  }}
                >
                  {sec.section}
                </div>
                {sec.items.map((it) => {
                  const isSel = selected === it.id;
                  const verbColor = "verb" in it ? VERB_COLOR[it.verb] : null;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      onClick={() => setSelected(it.id)}
                      style={{
                        all: "unset",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        width: "100%",
                        boxSizing: "border-box",
                        padding: "verb" in it ? "5px 8px" : "6px 8px",
                        borderRadius: 7,
                        fontSize: 12.5,
                        fontWeight: isSel ? 650 : 540,
                        color: isSel ? T.accentText : T.textSecondary,
                        background: isSel ? T.accentSoft : "transparent",
                        cursor: "pointer",
                        marginBottom: 1,
                        position: "relative",
                      }}
                    >
                      {isSel && (
                        <span
                          style={{
                            position: "absolute",
                            left: -1,
                            top: 6,
                            bottom: 6,
                            width: 2,
                            borderRadius: "0 2px 2px 0",
                            background: T.accent,
                          }}
                        />
                      )}
                      {verbColor && "verb" in it && (
                        <span
                          style={{
                            fontFamily: F.mono,
                            fontSize: 9,
                            fontWeight: 700,
                            padding: "2px 5px",
                            borderRadius: 4,
                            background: verbColor.bg,
                            color: verbColor.fg,
                            letterSpacing: ".02em",
                            minWidth: 38,
                            textAlign: "center",
                            flexShrink: 0,
                          }}
                        >
                          {it.verb}
                        </span>
                      )}
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </aside>

        {/* ── CENTER CONTENT ── */}
        <main style={{ padding: "40px 48px 80px", minWidth: 0 }}>
          {selected === "intro" && <IntroSection />}
          {selected === "auth" && <AuthSection />}
          {selected === "rate-limits" && <RateLimitsSection />}
          {selected === "errors" && <ErrorsSection />}
          {selected === "versioning" && <VersioningSection />}
          {isEndpoint && endpoint && <EndpointSection endpoint={endpoint} />}
        </main>

        {/* ── RIGHT CODE PANEL ── */}
        <aside
          style={{
            background: T.codeBg,
            color: T.codeText,
            padding: "24px 20px",
            position: "sticky",
            top: 108,
            height: "calc(100vh - 108px)",
            overflowY: "auto",
            borderLeft: `1px solid ${T.borderDark}`,
          }}
        >
          {isEndpoint && endpoint ? (
            <CodePanel endpoint={endpoint} lang={lang} setLang={setLang} />
          ) : (
            <PanelPlaceholder selected={selected} />
          )}
        </aside>
      </div>

      {/* Compact docs footer. The full marketing footer lives on /; we keep
          this slim because the docs page is meant to be browsed, not exited. */}
      <footer style={{ borderTop: `1px solid ${T.border}`, padding: "32px", background: T.surface }}>
        <div
          style={{
            maxWidth: 1440,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 12, color: T.textTertiary, fontWeight: 520 }}>
            BuiltCRM API · v1 · OpenAPI 3.1 spec at{" "}
            <a
              href="/openapi.yaml"
              style={{ fontFamily: F.mono, color: T.textSecondary, textDecoration: "none" }}
            >
              builtcrm.app/openapi.yaml
            </a>
          </div>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: T.textSecondary }}>
            <a href="mailto:support@builtcrm.app" style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}>
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section: Introduction
   ═══════════════════════════════════════════════════════════════ */
function IntroSection() {
  return (
    <div style={{ maxWidth: 720 }}>
      <Eyebrow>Get started</Eyebrow>
      <H1>Introduction</H1>
      <Lede>
        The BuiltCRM API is a JSON, REST-style HTTP API. Every request authenticates with a Bearer token, every response
        is JSON, and every list endpoint paginates with cursors. If you&apos;ve used Stripe, GitHub, or Linear&apos;s
        APIs, you&apos;ll feel at home in about five minutes.
      </Lede>

      <Callout kind="info" title="Base URL">
        <span style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 520 }}>https://api.builtcrm.app/v1</span> &mdash; all
        endpoints in this reference are relative to this base.
      </Callout>

      <H2>Quickstart</H2>
      <ol style={{ paddingLeft: 22, fontSize: 14, lineHeight: 1.8, color: T.textSecondary, fontWeight: 520 }}>
        <li>
          <b style={{ color: T.textPrimary, fontWeight: 680 }}>Create an API key</b> &mdash; Sign in, go to Settings
          &rarr; API keys, click <i>Create new key</i>. Save the key immediately; it&apos;s shown only once.
        </li>
        <li>
          <b style={{ color: T.textPrimary, fontWeight: 680 }}>Make your first call</b> &mdash; Hit{" "}
          <span style={{ fontFamily: F.mono, fontSize: 12.5 }}>GET /me</span> with your key. If you get a 200,
          you&apos;re authenticated.
        </li>
        <li>
          <b style={{ color: T.textPrimary, fontWeight: 680 }}>Subscribe to webhooks</b> &mdash; Most integrations are
          easier if you let BuiltCRM push to you. See the Webhooks section.
        </li>
      </ol>

      <H2>Conventions</H2>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginTop: 8, marginBottom: 32 }}>
        <tbody>
          {(
            [
              ["IDs", "ULID-style strings prefixed by resource — proj_, rfi_, co_, doc_, whk_, key_."],
              ["Money", "Always integer cents (USD or CAD). Currency at org level for now."],
              ["Times", "ISO-8601 UTC. Read-only; created server-side."],
              ["Pagination", "Cursor-based. Each list response includes a next_cursor (or null)."],
              ["Idempotency", "Send Idempotency-Key header on POST to dedupe retries (1h window)."],
            ] as const
          ).map(([k, v], i, arr) => (
            <tr key={k} style={{ borderBottom: i === arr.length - 1 ? "none" : `1px solid ${T.border}` }}>
              <td
                style={{
                  padding: "12px 0",
                  width: 140,
                  fontFamily: F.display,
                  fontWeight: 680,
                  color: T.textPrimary,
                  verticalAlign: "top",
                }}
              >
                {k}
              </td>
              <td style={{ padding: "12px 0", color: T.textSecondary, fontWeight: 520, lineHeight: 1.6 }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <H2>SDKs</H2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: T.textSecondary, fontWeight: 520, marginTop: 8 }}>
        Official SDKs are not yet published. The API is conventional REST + JSON, so any HTTP client works. Examples on
        this page show <b style={{ color: T.textPrimary }}>cURL</b>, <b style={{ color: T.textPrimary }}>JavaScript</b>{" "}
        (fetch), and <b style={{ color: T.textPrimary }}>Python</b> (requests).
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section: Authentication
   ═══════════════════════════════════════════════════════════════ */
function AuthSection() {
  const scopes: { scope: string; color: "info" | "accent" | "warning"; desc: string }[] = [
    { scope: "read", color: "info", desc: "List and fetch projects, draws, RFIs, documents. No mutations." },
    { scope: "write", color: "accent", desc: "Create and update projects, RFIs, change orders, draws, messages. Includes read." },
    { scope: "admin", color: "warning", desc: "Everything in write, plus org settings, member management, integrations." },
  ];
  const swatch = (k: "info" | "accent" | "warning"): Swatch =>
    k === "info"
      ? { bg: T.infoSoft, fg: T.infoText, border: "#b3d4ee" }
      : k === "accent"
        ? { bg: T.accentSoft, fg: T.accentText, border: T.accentMuted }
        : { bg: T.warningSoft, fg: T.warningText, border: "#f5d6a0" };

  return (
    <div style={{ maxWidth: 720 }}>
      <Eyebrow>Get started</Eyebrow>
      <H1>Authentication</H1>
      <Lede>
        Every request to the BuiltCRM API authenticates with a Bearer token in the Authorization header. Keys are scoped
        to your organization and shown in full only once at creation time.
      </Lede>

      <H2>Header format</H2>
      <pre
        style={{
          background: T.codeBg,
          color: T.codeText,
          padding: 16,
          borderRadius: 10,
          fontFamily: F.mono,
          fontSize: 13,
          lineHeight: 1.6,
          overflowX: "auto",
          margin: "12px 0 24px",
        }}
      >
        Authorization: Bearer bcrm_live_8f3e2d4c9b1a7e5f6d2c8b4a3e9f1d7c
      </pre>

      <H2>Scopes</H2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: T.textSecondary, fontWeight: 520 }}>
        BuiltCRM uses three coarse scopes. Pick the smallest that gets the job done.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12, marginBottom: 24 }}>
        {scopes.map((s) => {
          const c = swatch(s.color);
          return (
            <div
              key={s.scope}
              style={{
                padding: 12,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <span
                style={{
                  height: 22,
                  padding: "0 10px",
                  borderRadius: 999,
                  border: `1px solid ${c.border}`,
                  background: c.bg,
                  color: c.fg,
                  fontSize: 10,
                  fontWeight: 720,
                  fontFamily: F.display,
                  textTransform: "uppercase",
                  letterSpacing: ".02em",
                  display: "inline-flex",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                {s.scope}
              </span>
              <span style={{ fontSize: 13, color: T.textSecondary, fontWeight: 520, lineHeight: 1.5 }}>{s.desc}</span>
            </div>
          );
        })}
      </div>

      <Callout kind="warning" title="Treat keys like passwords">
        Don&apos;t ship them in client-side code, commit them to git, or paste them into screenshots. Rotate keys when
        staff leave or a key is suspected compromised. Revoked keys return 401 within seconds on the next call.
      </Callout>

      <H2>Test mode</H2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: T.textSecondary, fontWeight: 520 }}>
        Test-mode keys with the prefix <span style={{ fontFamily: F.mono, fontSize: 12.5 }}>bcrm_test_</span> are
        coming. Today only live keys are available, but the request shape is identical &mdash; your code won&apos;t
        change.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section: Rate limits
   ═══════════════════════════════════════════════════════════════ */
function RateLimitsSection() {
  const stats = [
    { label: "Per minute", value: "60", meta: "requests" },
    { label: "Per hour", value: "1,000", meta: "requests" },
  ];
  return (
    <div style={{ maxWidth: 720 }}>
      <Eyebrow>Get started</Eyebrow>
      <H1>Rate limits</H1>
      <Lede>
        The BuiltCRM API enforces per-key rate limits to keep things fair. Limits apply independently to each key, so
        spreading load across multiple keys works for legitimate parallelism &mdash; but talk to us before you go past 4
        keys.
      </Lede>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16, marginBottom: 28 }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              padding: "20px 22px",
              borderRadius: 14,
              border: `1px solid ${T.border}`,
              background: T.surface,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                fontWeight: 720,
                color: T.textTertiary,
                fontFamily: F.display,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontFamily: F.display,
                fontSize: 32,
                fontWeight: 820,
                letterSpacing: "-.04em",
                color: T.textPrimary,
                marginTop: 6,
              }}
            >
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: T.textTertiary, fontWeight: 520, marginTop: 2 }}>{s.meta}</div>
          </div>
        ))}
      </div>

      <H2>Response headers</H2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: T.textSecondary, fontWeight: 520 }}>
        Every API response includes the current state of your rate limit budget so you can preempt 429s.
      </p>
      <pre
        style={{
          background: T.codeBg,
          color: T.codeText,
          padding: 16,
          borderRadius: 10,
          fontFamily: F.mono,
          fontSize: 12.5,
          lineHeight: 1.65,
          overflowX: "auto",
          margin: "12px 0 24px",
        }}
      >
        {`X-RateLimit-Limit:     60
X-RateLimit-Remaining: 47
X-RateLimit-Reset:     1714589412`}
      </pre>

      <H2>When you exceed the limit</H2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: T.textSecondary, fontWeight: 520 }}>
        We respond with <span style={{ fontFamily: F.mono, fontSize: 12.5 }}>429 Too Many Requests</span> and a{" "}
        <span style={{ fontFamily: F.mono, fontSize: 12.5 }}>Retry-After</span> header in seconds. Honor it &mdash;
        automated retries that ignore Retry-After can push you into a longer cooldown.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section: Errors
   ═══════════════════════════════════════════════════════════════ */
function ErrorsSection() {
  return (
    <div style={{ maxWidth: 720 }}>
      <Eyebrow>Get started</Eyebrow>
      <H1>Errors</H1>
      <Lede>
        BuiltCRM uses standard HTTP status codes. The response body always includes a structured error object describing
        what went wrong and, when applicable, which fields failed validation.
      </Lede>

      <H2>Error envelope</H2>
      <pre
        style={{
          background: T.codeBg,
          color: T.codeText,
          padding: 16,
          borderRadius: 10,
          fontFamily: F.mono,
          fontSize: 12.5,
          lineHeight: 1.65,
          overflowX: "auto",
          margin: "12px 0 24px",
        }}
      >
        {`{
  "error": {
    "type":    "validation_failed",
    "message": "subject is required",
    "fields":  { "subject": "missing" },
    "request_id": "req_01HV9D7ZZK"
  }
}`}
      </pre>

      <H2>Status codes</H2>
      <div style={{ borderRadius: 14, border: `1px solid ${T.border}`, overflow: "hidden", marginTop: 12 }}>
        {ERRORS.map((e, i) => {
          const c = statusColor(e.code);
          return (
            <div
              key={e.code}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr 2fr",
                gap: 12,
                padding: "12px 16px",
                borderBottom: i === ERRORS.length - 1 ? "none" : `1px solid ${T.border}`,
                alignItems: "center",
                background: i % 2 === 0 ? T.surface : T.surfaceAlt,
              }}
            >
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 12,
                  fontWeight: 720,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: c.bg,
                  color: c.fg,
                  border: `1px solid ${c.border}`,
                  textAlign: "center",
                  justifySelf: "start",
                }}
              >
                {e.code}
              </span>
              <span style={{ fontFamily: F.display, fontSize: 13.5, fontWeight: 680 }}>{e.name}</span>
              <span style={{ fontSize: 12.5, color: T.textSecondary, fontWeight: 520, lineHeight: 1.5 }}>{e.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Section: Versioning
   ═══════════════════════════════════════════════════════════════ */
function VersioningSection() {
  return (
    <div style={{ maxWidth: 720 }}>
      <Eyebrow>Get started</Eyebrow>
      <H1>Versioning</H1>
      <Lede>
        The current major version is <b style={{ color: T.textPrimary }}>v1</b>, embedded in the URL path. Breaking
        changes will increment the major version (v2). Additive changes &mdash; new endpoints, new optional fields
        &mdash; ship into v1 without bumping it.
      </Lede>

      <Callout kind="info" title="What we consider non-breaking">
        Adding a new endpoint, adding an optional field to a request, adding a new field to a response, adding a new
        event type, or adding a new enum value. Clients should treat unknown response fields as ignored, not errors.
      </Callout>

      <H2>Deprecations</H2>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: T.textSecondary, fontWeight: 520 }}>
        Endpoints marked for removal will continue working for at least 12 months and emit a{" "}
        <span style={{ fontFamily: F.mono, fontSize: 12.5 }}>Deprecation</span> response header indicating the sunset
        date. The Changelog tracks every change.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Endpoint detail (the resource view)
   ═══════════════════════════════════════════════════════════════ */
function EndpointSection({ endpoint }: { endpoint: EndpointDef }) {
  const v = VERB_COLOR[endpoint.verb];
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 11,
            fontWeight: 720,
            padding: "4px 10px",
            borderRadius: 6,
            background: v.bg,
            color: v.fg,
            letterSpacing: ".02em",
            border: `1px solid ${v.border}`,
          }}
        >
          {endpoint.verb}
        </span>
        <code style={{ fontFamily: F.mono, fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{endpoint.path}</code>
        <button
          type="button"
          title="Try it — sign in to test"
          disabled
          style={{
            marginLeft: "auto",
            height: 28,
            padding: "0 12px",
            borderRadius: 7,
            border: `1px solid ${T.border}`,
            background: T.surfaceAlt,
            color: T.textTertiary,
            fontSize: 11.5,
            fontWeight: 600,
            cursor: "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: F.display,
          }}
        >
          <span style={{ width: 11, height: 11, display: "block" }}>{I.lock}</span>
          Try it · Sign in
        </button>
      </div>
      <H1>{endpoint.title}</H1>
      <Lede>{endpoint.desc}</Lede>

      <H2>Parameters</H2>
      <div
        style={{
          borderRadius: 12,
          border: `1px solid ${T.border}`,
          overflow: "hidden",
          marginTop: 12,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "150px 90px 90px 1fr",
            gap: 12,
            padding: "10px 14px",
            background: T.surfaceAlt,
            borderBottom: `1px solid ${T.border}`,
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: ".08em",
            fontWeight: 720,
            color: T.textTertiary,
            fontFamily: F.display,
          }}
        >
          <div>Name</div>
          <div>In</div>
          <div>Type</div>
          <div>Description</div>
        </div>
        {endpoint.params.length === 0 ? (
          <div style={{ padding: 16, fontSize: 13, color: T.textTertiary, fontWeight: 520 }}>No parameters.</div>
        ) : (
          endpoint.params.map((p, i) => (
            <div
              key={p.name}
              style={{
                display: "grid",
                gridTemplateColumns: "150px 90px 90px 1fr",
                gap: 12,
                padding: "12px 14px",
                borderBottom: i === endpoint.params.length - 1 ? "none" : `1px solid ${T.border}`,
                alignItems: "flex-start",
                background: T.surface,
              }}
            >
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 12.5, fontWeight: 600, color: T.textPrimary }}>
                  {p.name}
                </div>
                {p.required && (
                  <div
                    style={{
                      fontSize: 10,
                      color: T.dangerText,
                      fontWeight: 700,
                      marginTop: 2,
                      textTransform: "uppercase",
                      letterSpacing: ".04em",
                      fontFamily: F.display,
                    }}
                  >
                    Required
                  </div>
                )}
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 11.5, color: T.textTertiary, fontWeight: 520 }}>{p.in}</div>
              <div style={{ fontFamily: F.mono, fontSize: 11.5, color: T.accentText, fontWeight: 600 }}>{p.type}</div>
              <div style={{ fontSize: 12.5, color: T.textSecondary, fontWeight: 520, lineHeight: 1.5 }}>{p.desc}</div>
            </div>
          ))
        )}
      </div>

      <H2>Responses</H2>
      <div style={{ borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden", marginTop: 12 }}>
        {endpoint.responses.map((r, i) => {
          const c = statusColor(r.code);
          return (
            <div
              key={r.code}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr",
                gap: 12,
                padding: "12px 14px",
                borderBottom: i === endpoint.responses.length - 1 ? "none" : `1px solid ${T.border}`,
                alignItems: "center",
                background: i % 2 === 0 ? T.surface : T.surfaceAlt,
              }}
            >
              <span
                style={{
                  fontFamily: F.mono,
                  fontSize: 12,
                  fontWeight: 720,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: c.bg,
                  color: c.fg,
                  border: `1px solid ${c.border}`,
                  textAlign: "center",
                  justifySelf: "start",
                }}
              >
                {r.code}
              </span>
              <span style={{ fontSize: 12.5, color: T.textSecondary, fontWeight: 520, lineHeight: 1.5 }}>{r.desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Right pane: code samples
   ═══════════════════════════════════════════════════════════════ */
function CodePanel({
  endpoint,
  lang,
  setLang,
}: {
  endpoint: EndpointDef;
  lang: SampleLang;
  setLang: (l: SampleLang) => void;
}) {
  const [tab, setTab] = useState<"request" | "response">("request");
  const [copied, setCopied] = useState<boolean>(false);
  const v = VERB_COLOR[endpoint.verb];

  const sample = tab === "request" ? endpoint.samples[lang] : endpoint.response;

  const copyIt = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sample);
      }
    } catch {
      // ignore clipboard failures (insecure context, denied permission)
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          fontWeight: 720,
          color: T.codeMuted,
          fontFamily: F.display,
          marginBottom: 10,
        }}
      >
        Endpoint
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
          background: "rgba(255,255,255,.04)",
          borderRadius: 8,
          marginBottom: 18,
          border: `1px solid ${T.borderDark}`,
        }}
      >
        <span
          style={{
            fontFamily: F.mono,
            fontSize: 10,
            fontWeight: 720,
            padding: "3px 7px",
            borderRadius: 4,
            background: v.bg,
            color: v.fg,
            letterSpacing: ".02em",
          }}
        >
          {endpoint.verb}
        </span>
        <code
          style={{
            fontFamily: F.mono,
            fontSize: 12,
            color: T.codeText,
            fontWeight: 520,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {endpoint.path}
        </code>
      </div>

      {/* Request/Response tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 12,
          padding: 3,
          background: "rgba(255,255,255,.04)",
          borderRadius: 8,
          width: "fit-content",
        }}
      >
        {(["request", "response"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            style={{
              height: 28,
              padding: "0 12px",
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: tab === k ? 650 : 580,
              color: tab === k ? T.codeText : T.codeMuted,
              background: tab === k ? "rgba(255,255,255,.08)" : "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: F.display,
            }}
          >
            {k === "request" ? "Request" : "Response"}
          </button>
        ))}
      </div>

      {/* Language tabs (only for request) */}
      {tab === "request" && (
        <div style={{ display: "flex", gap: 2, marginBottom: 8, borderBottom: `1px solid ${T.borderDark}` }}>
          {(
            [
              ["curl", "cURL"],
              ["js", "JavaScript"],
              ["python", "Python"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setLang(k)}
              style={{
                padding: "8px 12px",
                fontSize: 11.5,
                fontWeight: lang === k ? 650 : 540,
                color: lang === k ? T.codeAccent : T.codeMuted,
                background: "transparent",
                border: "none",
                borderBottom: lang === k ? `2px solid ${T.codeAccent}` : "2px solid transparent",
                marginBottom: -1,
                cursor: "pointer",
                fontFamily: F.display,
              }}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Code block */}
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={copyIt}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            height: 26,
            padding: "0 9px",
            borderRadius: 6,
            border: `1px solid ${T.borderDark}`,
            background: "rgba(255,255,255,.05)",
            color: copied ? T.codeString : T.codeMuted,
            fontSize: 10.5,
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            fontFamily: F.display,
            zIndex: 2,
          }}
        >
          <span style={{ width: 11, height: 11, display: "block" }}>{copied ? I.check : I.copy}</span>
          {copied ? "Copied" : "Copy"}
        </button>
        <pre
          style={{
            background: "rgba(0,0,0,.25)",
            color: T.codeText,
            padding: "14px 16px",
            borderRadius: 8,
            fontFamily: F.mono,
            fontSize: 11.5,
            lineHeight: 1.6,
            overflowX: "auto",
            margin: 0,
            border: `1px solid ${T.borderDark}`,
            maxHeight: 360,
          }}
        >
          {sample}
        </pre>
      </div>

      {/* Status hint */}
      {tab === "response" && (
        <div style={{ marginTop: 12, fontSize: 11, color: T.codeMuted, fontWeight: 520, lineHeight: 1.5 }}>
          Successful response shape · {endpoint.responses[0]?.code}
        </div>
      )}
    </div>
  );
}

function PanelPlaceholder({ selected }: { selected: string }) {
  const labels: Record<string, string> = {
    intro: "Welcome to the API",
    auth: "Authentication",
    "rate-limits": "Rate limits",
    errors: "Errors",
    versioning: "Versioning",
  };
  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          fontWeight: 720,
          color: T.codeMuted,
          fontFamily: F.display,
          marginBottom: 12,
        }}
      >
        Reference
      </div>
      <div
        style={{
          fontFamily: F.display,
          fontSize: 16,
          fontWeight: 720,
          color: T.codeText,
          marginBottom: 8,
          letterSpacing: "-.02em",
        }}
      >
        {labels[selected] ?? ""}
      </div>
      <p style={{ fontSize: 12.5, color: T.codeMuted, lineHeight: 1.6, fontWeight: 520 }}>
        Select an endpoint from the sidebar to see request and response examples in cURL, JavaScript, and Python.
      </p>
      <div
        style={{
          marginTop: 24,
          padding: 14,
          border: `1px solid ${T.borderDark}`,
          borderRadius: 8,
          background: "rgba(255,255,255,.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ width: 14, height: 14, color: T.codeAccent, display: "inline-block" }}>{I.zap}</span>
          <span style={{ fontFamily: F.display, fontSize: 12, fontWeight: 700, color: T.codeText }}>Quick start</span>
        </div>
        <pre
          style={{
            margin: 0,
            fontFamily: F.mono,
            fontSize: 11,
            lineHeight: 1.65,
            color: T.codeText,
            whiteSpace: "pre-wrap",
          }}
        >
          {`curl https://api.builtcrm.app/v1/me \\
  -H "Authorization: Bearer bcrm_live_..."`}
        </pre>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Typography + small components
   ═══════════════════════════════════════════════════════════════ */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontFamily: F.display,
        fontSize: 11,
        fontWeight: 720,
        color: T.accentText,
        textTransform: "uppercase",
        letterSpacing: ".1em",
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function H1({ children }: { children: ReactNode }) {
  return (
    <h1
      style={{
        fontFamily: F.display,
        fontSize: 36,
        fontWeight: 800,
        letterSpacing: "-.04em",
        color: T.textPrimary,
        margin: 0,
        lineHeight: 1.1,
      }}
    >
      {children}
    </h1>
  );
}

function H2({ children }: { children: ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: F.display,
        fontSize: 18,
        fontWeight: 720,
        letterSpacing: "-.02em",
        color: T.textPrimary,
        margin: "32px 0 4px",
      }}
    >
      {children}
    </h2>
  );
}

function Lede({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 16, lineHeight: 1.65, color: T.textSecondary, fontWeight: 520, margin: "12px 0 28px" }}>
      {children}
    </p>
  );
}

function Callout({ kind, title, children }: { kind: "info" | "warning" | "success"; title: string; children: ReactNode }) {
  const c =
    kind === "warning"
      ? { bg: T.warningSoft, fg: T.warningText, border: "#f5d6a0", icon: I.alert }
      : kind === "info"
        ? { bg: T.infoSoft, fg: T.infoText, border: "#b3d4ee", icon: I.shield }
        : { bg: T.successSoft, fg: T.successText, border: "#a7d9be", icon: I.check };
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        margin: "20px 0 24px",
      }}
    >
      <div style={{ width: 18, height: 18, color: c.fg, flexShrink: 0, marginTop: 1 }}>{c.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: F.display, fontSize: 13, fontWeight: 700, color: c.fg, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: T.textSecondary, fontWeight: 520, lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}
