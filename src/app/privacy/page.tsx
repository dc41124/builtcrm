import type { Metadata } from "next";

import { PrivacyPolicyUI } from "./privacy-policy-ui";

// Step 65 Session A — public Privacy Policy. Marketing aesthetic, no
// auth, no shell. Reachable from the marketing footer's Privacy column
// and from in-product privacy banners. The "Submit a request" CTA on
// this page deep-links to /privacy/dsar (lands in Session B).

export const metadata: Metadata = {
  title: "Privacy Policy · BuiltCRM",
  description:
    "How BuiltCRM collects, uses, shares, and protects personal information — and the rights you have to control it.",
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return <PrivacyPolicyUI />;
}
