// Document category taxonomy. Single source of truth for:
//  - the enum value list (kept in sync with `documentCategoryEnum` in
//    src/db/schema/documents.ts — Postgres enforces actual membership)
//  - category labels rendered in every portal's rail / upload modal
//  - the documentType -> category derivation used by the upload finalize
//    route when a caller doesn't pass an explicit category
//  - the residential "Plans & Specs" collapse rule
//
// Keep this list aligned with the Drizzle enum. The order here is the
// UX order (misc at bottom); the Postgres enum order is the same.

export const DOCUMENT_CATEGORIES = [
  "drawings",
  "specifications",
  "submittal",
  "contracts",
  "photos",
  "permits",
  "compliance",
  "billing_backup",
  "other",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export function isDocumentCategory(value: unknown): value is DocumentCategory {
  return (
    typeof value === "string" &&
    (DOCUMENT_CATEGORIES as readonly string[]).includes(value)
  );
}

// Server-side fallback for when an upload call doesn't specify a category.
// Kept in sync with 0015_document_categories_backfill.sql — any change here
// should be mirrored there (or the next backfill migration).
export function deriveCategoryFromDocumentType(
  documentType: string,
): DocumentCategory {
  switch (documentType.toLowerCase()) {
    case "drawing":
    case "drawings":
      return "drawings";
    case "specification":
    case "specifications":
      return "specifications";
    case "contract":
    case "contracts":
      return "contracts";
    case "submittal":
    case "submittals":
    case "submittal_reviewer":
      return "submittal";
    case "photo_log":
    case "photos":
    case "daily_log_photo":
    case "punch_item_photo":
      return "photos";
    case "permit":
    case "permits":
      return "permits";
    case "insurance":
    case "compliance":
      return "compliance";
    case "lien_waiver":
    case "billing_backup":
      return "billing_backup";
    default:
      return "other";
  }
}

// Display labels — portal-neutral. The residential collapse is handled
// separately in the workspace component (see RESIDENTIAL_RAIL below).
export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  drawings: "Drawings / Plans",
  specifications: "Specifications",
  submittal: "Submittals",
  contracts: "Contracts",
  photos: "Photos",
  permits: "Permits",
  compliance: "Compliance / Insurance",
  billing_backup: "Billing Backup",
  other: "Other",
};

// Residential portal shows a simplified rail — technical distinctions
// between drawings and specs are collapsed, and back-office categories
// (submittal, compliance, billing_backup) are hidden entirely. See the
// Step 21 design notes: homeowners get Plans & Specs + Contracts + Photos
// + Permits + Other, in that order.
export const RESIDENTIAL_RAIL: Array<{
  id: string;
  label: string;
  matchesCategories: DocumentCategory[];
}> = [
  {
    id: "plans_and_specs",
    label: "Plans & Specs",
    matchesCategories: ["drawings", "specifications"],
  },
  {
    id: "contracts",
    label: "Contracts",
    matchesCategories: ["contracts"],
  },
  {
    id: "photos",
    label: "Photos",
    matchesCategories: ["photos"],
  },
  {
    id: "permits",
    label: "Permits",
    matchesCategories: ["permits"],
  },
  {
    id: "other",
    label: "Other",
    matchesCategories: ["other"],
  },
];

// Categories hidden from the residential rail entirely — no tab, no count.
// Rows tagged with these still exist in the database; homeowners simply
// won't see them in their UI. See Step 21 policy.
export const RESIDENTIAL_HIDDEN_CATEGORIES: DocumentCategory[] = [
  "submittal",
  "compliance",
  "billing_backup",
];

// Upload flow defaults. Category-based visibility defaults apply only at
// upload-modal pre-fill time; they never override stored scope fields on
// existing rows, and never override an explicit user selection in the form.
// The loader reads the row's own visibility/audience — category is not
// consulted for access decisions.
export const CATEGORY_UPLOAD_DEFAULTS: Record<
  DocumentCategory,
  { visibilityScope: string; audienceScope: string }
> = {
  drawings: { visibilityScope: "project_wide", audienceScope: "mixed" },
  specifications: { visibilityScope: "project_wide", audienceScope: "mixed" },
  submittal: { visibilityScope: "internal_only", audienceScope: "contractor" },
  contracts: { visibilityScope: "internal_only", audienceScope: "contractor" },
  photos: { visibilityScope: "client_visible", audienceScope: "client" },
  permits: { visibilityScope: "project_wide", audienceScope: "mixed" },
  compliance: { visibilityScope: "internal_only", audienceScope: "contractor" },
  billing_backup: { visibilityScope: "internal_only", audienceScope: "contractor" },
  other: { visibilityScope: "project_wide", audienceScope: "mixed" },
};
