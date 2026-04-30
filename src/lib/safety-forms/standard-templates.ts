/**
 * Step 52 standard safety-form templates.
 *
 * Three templates seed into every contractor org during bootstrap:
 *  - Daily Toolbox Talk (toolbox_talk)
 *  - Incident Report (incident_report)
 *  - Near Miss Report (near_miss)
 *
 * The prototype shows 6 in the demo data; the other 3 (Roofing JHA,
 * Energized Electrical JHA, Toolbox Talk – Fall Protection) are demo-
 * only seeds added by the dev seed script, NOT bootstrapped into every
 * fresh org. Real customers should author those themselves once the
 * Step 52 follow-up adds the in-app field editor (see
 * production_grade_upgrades/safety_template_field_editor.md).
 *
 * Field shape mirrors the prototype's templates verbatim — same keys,
 * same labels, same options, same required flags.
 */

import type { SafetyTemplateField } from "@/db/schema";

export interface StandardTemplateSeed {
  name: string;
  formType: "toolbox_talk" | "jha" | "incident_report" | "near_miss";
  description: string;
  fields: SafetyTemplateField[];
}

export const STANDARD_SAFETY_TEMPLATES: StandardTemplateSeed[] = [
  {
    name: "Daily Toolbox Talk",
    formType: "toolbox_talk",
    description: "Pre-shift safety briefing with crew sign-in.",
    fields: [
      {
        key: "topic",
        type: "select",
        label: "Topic",
        required: true,
        options: [
          "Fall Protection",
          "Hot Work",
          "PPE Compliance",
          "Trenching/Excavation",
          "Lockout/Tagout",
          "Heat Illness",
          "Slip/Trip/Fall",
          "Other",
        ],
      },
      {
        key: "talking",
        type: "textarea",
        label: "Key talking points",
        required: true,
        hint: "What was covered. Hazards specific to today's work, controls, lessons from any recent incidents.",
      },
      {
        key: "weather",
        type: "select",
        label: "Conditions",
        required: false,
        options: [
          "Clear & dry",
          "Rain",
          "High wind",
          "Heat advisory",
          "Cold (<0°C)",
          "Other",
        ],
      },
      {
        key: "attendees",
        type: "attendees",
        label: "Crew attendees",
        required: true,
        hint: "Each attendee signs to confirm participation.",
      },
      {
        key: "leader",
        type: "signature",
        label: "Talk leader signature",
        required: true,
      },
      {
        key: "photo",
        type: "photo",
        label: "Sign-in sheet photo (opt.)",
        required: false,
      },
    ],
  },
  {
    name: "Incident Report",
    formType: "incident_report",
    description: "Recordable injury, property damage, or release.",
    fields: [
      {
        key: "severity",
        type: "select",
        label: "Severity",
        required: true,
        options: [
          "first_aid",
          "recordable",
          "lost_time",
          "fatality",
          "property_damage",
          "environmental",
        ],
      },
      {
        key: "when",
        type: "datetime",
        label: "Date & time of incident",
        required: true,
      },
      {
        key: "location",
        type: "text",
        label: "Location on site",
        required: true,
      },
      {
        key: "injured",
        type: "people",
        label: "Injured / affected parties",
        required: true,
        hint: "Add each person involved. Body part / nature of injury per person.",
      },
      {
        key: "description",
        type: "textarea",
        label: "What happened",
        required: true,
        hint: "Sequence of events leading up to and during the incident. Be factual — opinions and root cause go below.",
      },
      {
        key: "rootCause",
        type: "textarea",
        label: "Root cause analysis",
        required: true,
        hint: "Five-whys or similar. The underlying condition, not just the proximate trigger.",
      },
      {
        key: "corrective",
        type: "actions",
        label: "Corrective actions",
        required: true,
        hint: "Each with owner and target date.",
      },
      {
        key: "photo",
        type: "photo",
        label: "Incident scene photo(s)",
        required: false,
      },
      {
        key: "signoff",
        type: "signature",
        label: "Reporter signature",
        required: true,
      },
    ],
  },
  {
    name: "Near Miss Report",
    formType: "near_miss",
    description: "Close-call event with no injury or damage.",
    fields: [
      {
        key: "when",
        type: "datetime",
        label: "Date & time",
        required: true,
      },
      {
        key: "location",
        type: "text",
        label: "Location on site",
        required: true,
      },
      {
        key: "description",
        type: "textarea",
        label: "What happened",
        required: true,
        hint: "What could have happened, what stopped it, and conditions present.",
      },
      {
        key: "preventive",
        type: "textarea",
        label: "Preventive measure suggested",
        required: true,
      },
      {
        key: "signoff",
        type: "signature",
        label: "Reporter signature",
        required: true,
      },
    ],
  },
];

/**
 * Demo-only templates seeded into the dev fixture, not into every real org.
 * Real customers author these themselves once the in-app field editor lands.
 */
export const DEMO_SAFETY_TEMPLATES: StandardTemplateSeed[] = [
  {
    name: "Roofing — JHA",
    formType: "jha",
    description: "Job Hazard Analysis — hazards + controls per task.",
    fields: [
      { key: "task", type: "text", label: "Task description", required: true },
      { key: "location", type: "text", label: "Location / area", required: true },
      {
        key: "hazards",
        type: "hazards",
        label: "Hazards & controls",
        required: true,
        hint: "List each hazard, then the control measure that mitigates it.",
      },
      {
        key: "ppe",
        type: "checklist",
        label: "Required PPE",
        required: true,
        options: [
          "Hard hat",
          "Safety glasses",
          "Hi-vis vest",
          "Cut-resistant gloves",
          "Steel-toe boots",
          "Harness & lanyard",
          "Hearing protection",
          "Respirator",
        ],
      },
      {
        key: "permits",
        type: "checklist",
        label: "Permits in place",
        required: false,
        options: [
          "Hot work",
          "Confined space",
          "Energized work",
          "Excavation",
          "Roof access",
          "None required",
        ],
      },
      {
        key: "competent",
        type: "text",
        label: "Competent person on-site",
        required: true,
      },
      {
        key: "signoff",
        type: "signature",
        label: "Foreman sign-off",
        required: true,
      },
    ],
  },
  {
    name: "Energized Electrical — JHA",
    formType: "jha",
    description: "JHA for energized electrical work — LOTO + arc-flash boundaries.",
    fields: [
      { key: "task", type: "text", label: "Task description", required: true },
      {
        key: "voltage",
        type: "select",
        label: "System voltage",
        required: true,
        options: ["≤120V", "120–480V", "480V–4.16kV", "4.16kV+"],
      },
      {
        key: "loto",
        type: "checklist",
        label: "LOTO sequence verified",
        required: true,
        options: [
          "Sources identified",
          "Tagged & locked",
          "Tested dead",
          "Grounded if required",
          "PPE verified",
        ],
      },
      {
        key: "ppe",
        type: "checklist",
        label: "Arc-flash PPE category",
        required: true,
        options: ["CAT 1 (4 cal/cm²)", "CAT 2 (8)", "CAT 3 (25)", "CAT 4 (40+)"],
      },
      {
        key: "boundary",
        type: "text",
        label: "Approach boundary distance",
        required: true,
      },
      {
        key: "qualified",
        type: "text",
        label: "Qualified person performing work",
        required: true,
      },
      {
        key: "signoff",
        type: "signature",
        label: "Electrical foreman sign-off",
        required: true,
      },
    ],
  },
  {
    name: "Toolbox Talk — Fall Protection",
    formType: "toolbox_talk",
    description: "Fall-protection-specific toolbox talk.",
    fields: [
      {
        key: "topic",
        type: "select",
        label: "Topic",
        required: true,
        options: ["Fall Protection"],
      },
      {
        key: "talking",
        type: "textarea",
        label: "Key talking points",
        required: true,
      },
      {
        key: "weather",
        type: "select",
        label: "Conditions",
        required: false,
        options: [
          "Clear & dry",
          "Rain",
          "High wind",
          "Heat advisory",
          "Cold (<0°C)",
          "Other",
        ],
      },
      {
        key: "attendees",
        type: "attendees",
        label: "Crew attendees",
        required: true,
      },
      {
        key: "leader",
        type: "signature",
        label: "Talk leader signature",
        required: true,
      },
      {
        key: "photo",
        type: "photo",
        label: "Sign-in sheet photo (opt.)",
        required: false,
      },
    ],
  },
];
