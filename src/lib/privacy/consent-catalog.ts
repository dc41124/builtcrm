// Step 65 Session C — consent-type catalog.
//
// The five enum values mirror `consent_type` in `src/db/schema/privacy.ts`.
// `required` means the consent cannot be withdrawn while the account
// exists — toggling it off is denied at the API layer. The end-user UI
// renders required toggles in a locked state.
//
// `defaultGranted` is the initial value at signup when the user doesn't
// explicitly opt in or out. Required consents are always granted at
// signup; optional consents follow the value here.

export type ConsentTypeKey =
  | "data_processing"
  | "marketing_email"
  | "product_updates"
  | "analytics"
  | "third_party_integrations";

export type ConsentTypeMeta = {
  id: ConsentTypeKey;
  label: string;
  description: string;
  required: boolean;
  defaultGranted: boolean;
};

export const CONSENT_CATALOG: ConsentTypeMeta[] = [
  {
    id: "data_processing",
    label: "Essential service data processing",
    description:
      "Required to provide the service. Includes account, project, and billing records.",
    required: true,
    defaultGranted: true,
  },
  {
    id: "marketing_email",
    label: "Marketing email",
    description:
      "Product news, customer stories, and occasional promotional offers. Unsubscribe anytime.",
    required: false,
    defaultGranted: false,
  },
  {
    id: "product_updates",
    label: "Product updates",
    description:
      "Feature releases, downtime notices, and security advisories. Recommended.",
    required: false,
    defaultGranted: true,
  },
  {
    id: "analytics",
    label: "Anonymous usage analytics",
    description:
      "Aggregated, deidentified product analytics that help us improve the experience.",
    required: false,
    defaultGranted: false,
  },
  {
    id: "third_party_integrations",
    label: "Third-party integrations",
    description:
      "Sharing with the integrations you've connected (e.g. QuickBooks, calendar).",
    required: false,
    defaultGranted: true,
  },
];

export function getConsentMeta(id: ConsentTypeKey): ConsentTypeMeta {
  const meta = CONSENT_CATALOG.find((c) => c.id === id);
  if (!meta) throw new Error(`Unknown consent type: ${id}`);
  return meta;
}

export const ALL_CONSENT_KEYS: readonly ConsentTypeKey[] = CONSENT_CATALOG.map(
  (c) => c.id,
);
