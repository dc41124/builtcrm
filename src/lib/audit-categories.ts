// Categories surfaced in the audit-log filter dropdown. Kept in a dedicated
// file with no server imports so client components (settings-shell) can pull
// the values without dragging the DB client into the browser bundle.

export const AUDIT_CATEGORIES = [
  "All events",
  "Authentication",
  "Team",
  "Permissions",
  "Billing",
  "Projects",
  "Compliance",
  "Integrations",
  "Other",
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];
