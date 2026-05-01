import type { Metadata } from "next";

import { ApiDocsUI } from "./api-docs-ui";

// Step 60 (Phase 8-lite.1 #60) — Public API docs page.
//
// Sits outside (auth) and (portal) so it never inherits portal chrome or
// auth gates — anyone with the URL can browse it. Intentionally session-
// agnostic: the nav shows the same signed-out marketing CTAs to everyone.
// Signed-in users navigating away (e.g. clicking the logo) hit `/`, where
// the existing redirect dispatches them to their portal.
//
// The OpenAPI spec served at /openapi.yaml is the machine-readable
// counterpart; this page is the human-readable view.

export const metadata: Metadata = {
  title: "API docs · BuiltCRM",
  description:
    "REST API reference for BuiltCRM — projects, RFIs, change orders, documents, and webhooks.",
  robots: { index: true, follow: true },
};

export default function ApiDocsPage() {
  return <ApiDocsUI />;
}
