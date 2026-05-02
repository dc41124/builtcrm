import type { Metadata } from "next";

import { DsarIntakeUI } from "./dsar-intake-ui";

// Step 65 Session B — public DSAR intake page. Anyone (logged-out or
// not) can submit an access / rectification / deletion / portability
// request. Marketing aesthetic; no portal chrome. Cloudflare Turnstile
// gates the POST.

export const metadata: Metadata = {
  title: "Submit a privacy request · BuiltCRM",
  description:
    "Exercise your privacy rights under Quebec Law 25, PIPEDA, and the GDPR. Access, rectification, deletion, and portability — we respond within 30 days.",
  // Indexable so people searching for "BuiltCRM privacy request" land here.
  robots: { index: true, follow: true },
};

export default function DsarIntakePage() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;
  return <DsarIntakeUI turnstileSiteKey={turnstileSiteKey} />;
}
