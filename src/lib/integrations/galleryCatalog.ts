// Step 64 — Integration gallery catalog.
//
// Pure data. Imported by both the contractor-portal gallery page and
// the public marketing page. Same shape, same source. Logo + accent
// color come from the prototype's brand-colored initials approach;
// future polish pass can swap in actual provider logos with fair-use
// attribution.

export type IntegrationCategoryId =
  | "all"
  | "accounting"
  | "payments"
  | "documents"
  | "comms"
  | "pm"
  | "compliance"
  | "field"
  | "payroll"
  | "lending";

export type IntegrationCategory = {
  id: IntegrationCategoryId;
  label: string;
};

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  { id: "all",        label: "All" },
  { id: "accounting", label: "Accounting" },
  { id: "payments",   label: "Payments" },
  { id: "documents",  label: "Documents" },
  { id: "comms",      label: "Communication" },
  { id: "pm",         label: "Project Management" },
  { id: "compliance", label: "Compliance" },
  { id: "field",      label: "Field Tools" },
  { id: "payroll",    label: "Payroll" },
  { id: "lending",    label: "Lending" },
];

export type IntegrationState = "connected" | "available" | "soon";

export type IntegrationEntry = {
  id: string;
  name: string;
  category: Exclude<IntegrationCategoryId, "all">;
  desc: string;
  state: IntegrationState;
  /** Brand-accurate logo background (CSS gradient or color). */
  logoBg: string;
  /** Initials shown inside the rounded-square logo. */
  logoText: string;
  /** Override the default 16px font size on the logo (use 14 for 2-letter
   *  monograms that look cramped at 16). */
  logoFontSize?: number;
  /** Brand accent color, used by the consent-mockup modal logo block. */
  accent: string;
  /** Sandbox-only callout shown on "available" providers. */
  sandboxNote?: string;
  /** Why production isn't ready — shown in the consent mockup. */
  gateReason?: string;
};

// Realistic OAuth scopes per gated provider, used by the consent mockup
// to communicate "this is what we'd request if approved."
export const INTEGRATION_SCOPES: Record<string, string[]> = {
  procore:    ["projects.read", "rfis.read", "rfis.write", "submittals.read", "drawings.read", "users.read"],
  autodesk:   ["data:read", "data:write", "bucket:read", "account:read"],
  bluebeam:   ["studio.sessions.read", "studio.documents.read", "studio.markups.read"],
  docusign:   ["envelopes.read", "envelopes.write", "signers.read"],
  ms365:      ["openid", "email", "Files.Read", "Mail.Send", "Calendars.ReadWrite"],
  gws:        ["openid", "email", "drive.file", "calendar.events", "gmail.send"],
  slack:      ["chat:write", "channels:read", "files:write", "users:read"],
  gmail:      ["gmail.send", "gmail.modify", "gmail.labels"],
  trustlayer: ["certificates.read", "subcontractors.read", "compliance.write"],
  mycoi:      ["coi.read", "coi.subscribe", "vendors.read"],
  siteline:   ["billing.read", "draws.read", "invoices.read"],
  gcpay:      ["billing.read", "draws.write", "lien_waivers.read"],
  trimble:    ["payroll.read", "payments.read", "vendors.read"],
  ceridian:   ["employees.read", "timesheets.read", "payroll.read"],
  agave:      ["multi_provider.read", "webhooks.subscribe"],
  workato:    ["recipes.read", "connections.read"],
  built:      ["draws.read", "lender_data.read", "payments.read"],
};

export const INTEGRATION_CATALOG: IntegrationEntry[] = [
  // ─── WORKING TODAY ───
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    desc: "Accept ACH and card payments for draws, selection upgrades, and invoices. Funds route directly to your bank account.",
    state: "connected",
    logoText: "S",
    logoBg: "linear-gradient(135deg,#635bff,#4f46d6)",
    accent: "#635bff",
  },
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    category: "accounting",
    desc: "Push approved draw requests as invoices, pull payment confirmations, and map SOV cost codes to your chart of accounts.",
    state: "connected",
    logoText: "QB",
    logoBg: "linear-gradient(135deg,#2ca01c,#108a00)",
    accent: "#2ca01c",
  },
  {
    id: "xero",
    name: "Xero",
    category: "accounting",
    desc: "Sync invoices, payments, and journal entries with Xero. Same capabilities as QuickBooks for teams already on Xero.",
    state: "available",
    logoText: "X",
    logoBg: "linear-gradient(135deg,#13b5ea,#0d9dd5)",
    accent: "#13b5ea",
    sandboxNote: "Sandbox-ready · Production sync requires Xero app review.",
  },
  {
    id: "sage",
    name: "Sage Business Cloud",
    category: "accounting",
    desc: "Sync billing data with Sage Business Cloud Accounting. Invoices, payments, and journal entries flow automatically.",
    state: "available",
    logoText: "Sg",
    logoBg: "linear-gradient(135deg,#00d639,#00b62f)",
    logoFontSize: 14,
    accent: "#00d639",
    sandboxNote: "Sandbox-ready · Production sync requires Sage app review.",
  },

  // ─── COMING SOON — gated ───
  {
    id: "procore",
    name: "Procore",
    category: "pm",
    desc: "Two-way sync of projects, RFIs, submittals, and drawings between BuiltCRM and Procore for joint-venture workflows.",
    state: "soon",
    logoText: "Pc",
    logoBg: "linear-gradient(135deg,#f47920,#e35f00)",
    logoFontSize: 14,
    accent: "#f47920",
    gateReason: "Procore App Marketplace partner application",
  },
  {
    id: "autodesk",
    name: "Autodesk Construction Cloud",
    category: "pm",
    desc: "Pull drawings, sheets, and BIM 360 issues into BuiltCRM. Push RFIs and change orders back to ACC.",
    state: "soon",
    logoText: "Ad",
    logoBg: "linear-gradient(135deg,#0696d7,#005ea6)",
    logoFontSize: 14,
    accent: "#0696d7",
    gateReason: "Autodesk Forge developer agreement",
  },
  {
    id: "bluebeam",
    name: "Bluebeam Studio Prime",
    category: "documents",
    desc: "Sync Studio sessions and markup state into the project document library. Track who reviewed what.",
    state: "soon",
    logoText: "Bb",
    logoBg: "linear-gradient(135deg,#0066b3,#004580)",
    logoFontSize: 14,
    accent: "#0066b3",
    gateReason: "Bluebeam Studio Prime API access",
  },
  {
    id: "docusign",
    name: "DocuSign",
    category: "documents",
    desc: "Send change orders, contracts, and lien waivers for e-signature. Status syncs back automatically.",
    state: "soon",
    logoText: "DS",
    logoBg: "linear-gradient(135deg,#fcb53b,#dc8a14)",
    logoFontSize: 14,
    accent: "#fcb53b",
    gateReason: "DocuSign ISV partnership",
  },
  {
    id: "ms365",
    name: "Microsoft 365",
    category: "comms",
    desc: "OneDrive document attach, Outlook calendar sync, and Teams meeting links on project events.",
    state: "soon",
    logoText: "M",
    logoBg: "linear-gradient(135deg,#0078d4,#005a9e)",
    accent: "#0078d4",
    gateReason: "Microsoft Graph app verification",
  },
  {
    id: "gws",
    name: "Google Workspace",
    category: "comms",
    desc: "Drive document attach, Calendar two-way sync for project events, and Gmail outbound delivery.",
    state: "soon",
    logoText: "G",
    logoBg: "linear-gradient(135deg,#4285f4,#1a73e8)",
    accent: "#4285f4",
    gateReason: "Google OAuth app verification",
  },
  {
    id: "slack",
    name: "Slack",
    category: "comms",
    desc: "Route RFIs, change orders, and approval requests into Slack channels. Reply from Slack to update BuiltCRM.",
    state: "soon",
    logoText: "Sl",
    logoBg: "linear-gradient(135deg,#611f69,#4a154b)",
    logoFontSize: 14,
    accent: "#611f69",
    gateReason: "Slack App Directory listing",
  },
  {
    id: "gmail",
    name: "Gmail (Enhanced)",
    category: "comms",
    desc: "Native Gmail thread linking — every project gets a unique reply-to address that lands messages directly in BuiltCRM.",
    state: "soon",
    logoText: "Gm",
    logoBg: "linear-gradient(135deg,#ea4335,#c5221f)",
    logoFontSize: 14,
    accent: "#ea4335",
    gateReason: "Google Gmail API restricted scope review",
  },
  {
    id: "trustlayer",
    name: "TrustLayer",
    category: "compliance",
    desc: "Continuous COI verification for subcontractors. Auto-flag expired insurance and missing endorsements.",
    state: "soon",
    logoText: "TL",
    logoBg: "linear-gradient(135deg,#0ea5e9,#0369a1)",
    logoFontSize: 14,
    accent: "#0ea5e9",
    gateReason: "TrustLayer partner program",
  },
  {
    id: "mycoi",
    name: "myCOI",
    category: "compliance",
    desc: "Subscribe to subcontractor COI updates. Insurance changes flow into BuiltCRM compliance records.",
    state: "soon",
    logoText: "mC",
    logoBg: "linear-gradient(135deg,#0d9488,#115e59)",
    logoFontSize: 14,
    accent: "#0d9488",
    gateReason: "myCOI partner data feed",
  },
  {
    id: "siteline",
    name: "Siteline",
    category: "accounting",
    desc: "Specialty contractor billing — sync schedules of values and draw packages with Siteline workflows.",
    state: "soon",
    logoText: "St",
    logoBg: "linear-gradient(135deg,#7c3aed,#5b21b6)",
    logoFontSize: 14,
    accent: "#7c3aed",
    gateReason: "Siteline partnership",
  },
  {
    id: "gcpay",
    name: "GCPay",
    category: "payments",
    desc: "Pay subcontractors with automated lien-waiver collection on every payment. Reduce paperwork on draws.",
    state: "soon",
    logoText: "GP",
    logoBg: "linear-gradient(135deg,#16a34a,#15803d)",
    logoFontSize: 14,
    accent: "#16a34a",
    gateReason: "GCPay integration agreement",
  },
  {
    id: "trimble",
    name: "Trimble Pay",
    category: "payments",
    desc: "Cross-border payments and integrated subcontractor payment workflows for Trimble customers.",
    state: "soon",
    logoText: "Tr",
    logoBg: "linear-gradient(135deg,#005f86,#003e58)",
    logoFontSize: 14,
    accent: "#005f86",
    gateReason: "Trimble developer program",
  },
  {
    id: "ceridian",
    name: "Ceridian Dayforce",
    category: "payroll",
    desc: "Sync field-labor hours from BuiltCRM time tracking into Dayforce for payroll processing.",
    state: "soon",
    logoText: "Cd",
    logoBg: "linear-gradient(135deg,#d97706,#b45309)",
    logoFontSize: 14,
    accent: "#d97706",
    gateReason: "Ceridian Dayforce API certification",
  },
  {
    id: "agave",
    name: "Agave",
    category: "pm",
    desc: "Unified API gateway across construction tools. One integration to reach Procore, Autodesk, Sage, and more.",
    state: "soon",
    logoText: "Ag",
    logoBg: "linear-gradient(135deg,#84cc16,#4d7c0f)",
    logoFontSize: 14,
    accent: "#84cc16",
    gateReason: "Agave API key tier upgrade",
  },
  {
    id: "workato",
    name: "Workato",
    category: "pm",
    desc: "No-code automation across BuiltCRM, your CRM, ERP, and warehouse systems. Build custom workflows visually.",
    state: "soon",
    logoText: "Wk",
    logoBg: "linear-gradient(135deg,#ef4444,#b91c1c)",
    logoFontSize: 14,
    accent: "#ef4444",
    gateReason: "Workato Connector SDK partnership",
  },
  {
    id: "built",
    name: "Built Technologies",
    category: "lending",
    desc: "Construction loan administration sync — push draw packages directly to your construction lender for funding.",
    state: "soon",
    logoText: "Bt",
    logoBg: "linear-gradient(135deg,#1e40af,#1e3a8a)",
    logoFontSize: 14,
    accent: "#1e40af",
    gateReason: "Built Technologies partner program",
  },
];

/** Friendly trailing label on the consent-mockup's scope rows. Keep
 *  small — the scope string itself does the heavy lifting. */
export function scopeLabel(scope: string): string {
  if (scope.endsWith(".read")) return "Read access";
  if (scope.endsWith(".write")) return "Write access";
  if (scope.includes("subscribe")) return "Subscribe";
  if (scope.includes("send")) return "Send";
  if (scope === "openid" || scope === "email") return "Identity";
  return "Access";
}

/** Counts used by the gallery toolbar — derived once per render. */
export function getCatalogCounts() {
  return {
    all: INTEGRATION_CATALOG.length,
    connected: INTEGRATION_CATALOG.filter((c) => c.state === "connected").length,
    available: INTEGRATION_CATALOG.filter((c) => c.state === "available").length,
    soon: INTEGRATION_CATALOG.filter((c) => c.state === "soon").length,
  };
}
