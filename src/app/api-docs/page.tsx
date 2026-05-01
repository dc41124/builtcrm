import type { Metadata } from "next";

import { ApiDocsUI } from "./api-docs-ui";

// Step 60 — API docs page. Renders inside its own isolated topbar
// (logo + OpenAPI download + API Reference + far-right search). No
// marketing chrome, no session plumbing — the page is reached either
// from the marketing footer or from the contractor settings "Read API
// docs" button, and both expect the same isolated shell.

export const metadata: Metadata = {
  title: "API docs · BuiltCRM",
  description:
    "REST API reference for BuiltCRM — projects, RFIs, change orders, documents, and webhooks.",
  robots: { index: true, follow: true },
};

export default function ApiDocsPage() {
  return <ApiDocsUI />;
}
