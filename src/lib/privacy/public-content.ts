// Step 65 Session A — public-facing privacy content shared across the
// /privacy and /privacy/officer pages.
//
// The officer values + sub-processor list are hardcoded here as a
// session-A placeholder. Session B replaces the officer fields with a
// read from the `privacy_officers` table (one row per organization,
// designated by the contractor admin). The sub-processor list stays
// hardcoded — it's not org-scoped.

export type PublicPrivacyOfficer = {
  name: string;
  role: string;
  email: string;
  phone: string;
  postal: string;
  responseSla: string;
  designatedAt: string;
  initials: string;
};

export const PUBLIC_PRIVACY_OFFICER: PublicPrivacyOfficer = {
  name: "Marielle Tremblay",
  role: "VP Operations · Designated Privacy Officer",
  email: "privacy@builtcrm.ca",
  phone: "+1 (514) 555-0148",
  postal: "1250 René-Lévesque Blvd W, Suite 2200, Montréal, QC H3B 4W8",
  responseSla: "30 days",
  designatedAt: "January 14, 2026",
  initials: "MT",
};

export type SubProcessor = {
  name: string;
  purpose: string;
  region: string;
};

export const SUB_PROCESSORS: SubProcessor[] = [
  { name: "Amazon Web Services", purpose: "Hosting, storage, compute", region: "ca-central-1 (Montréal)" },
  { name: "Stripe", purpose: "Payment processing", region: "United States" },
  { name: "Postmark", purpose: "Transactional email", region: "United States" },
  { name: "Sentry", purpose: "Error monitoring", region: "United States" },
  { name: "Trigger.dev", purpose: "Background jobs", region: "United States" },
  { name: "Cloudflare", purpose: "CDN & DDoS protection", region: "Global edge" },
];

export const POLICY_VERSION = {
  number: "3.2",
  effectiveDate: "May 1, 2026",
  lastUpdated: "April 28, 2026",
};

export type DesignationHistoryEntry = {
  period: string;
  officer: string;
  designatedBy: string;
};

export const DESIGNATION_HISTORY: DesignationHistoryEntry[] = [
  {
    period: "Jan 2026 – present",
    officer: "Marielle Tremblay, VP Operations",
    designatedBy: "Board resolution 2026-01-14",
  },
  {
    period: "Jul 2024 – Jan 2026",
    officer: "Daniel Pearson, Co-founder & CEO",
    designatedBy: "Original designation at incorporation",
  },
];
