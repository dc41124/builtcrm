/**
 * Server-safe severity label map.
 *
 * The client-side equivalent in src/app/(portal)/safety-forms-shared.tsx
 * also includes a per-severity color; route handlers + loaders only need
 * the human label, so we keep this file dependency-free (no React, no
 * "use client" directive).
 */

export const SAFETY_SEVERITY_CONFIG = {
  first_aid: { label: "First Aid" },
  recordable: { label: "Recordable" },
  lost_time: { label: "Lost Time" },
  fatality: { label: "Fatality" },
  property_damage: { label: "Property Damage" },
  environmental: { label: "Environmental" },
} as const;

export type SafetySeverity = keyof typeof SAFETY_SEVERITY_CONFIG;

export const SAFETY_FORM_TYPE_LABELS = {
  toolbox_talk: "Toolbox Talk",
  jha: "JHA",
  incident_report: "Incident Report",
  near_miss: "Near Miss",
} as const;

export type SafetyFormType = keyof typeof SAFETY_FORM_TYPE_LABELS;
