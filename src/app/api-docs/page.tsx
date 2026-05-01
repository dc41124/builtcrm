import type { Metadata } from "next";

import { getServerSession } from "@/auth/session";
import { loadUserPortalContext } from "@/domain/loaders/portals";

import { ApiDocsUI, type ApiDocsSession } from "./api-docs-ui";

// Step 60 — Public API docs page. Same chrome as the rest of the
// marketing site. We load session info just so the right-side nav
// CTA can swap from "Log in / Get started free" to "Open dashboard"
// for signed-in visitors. No deeper plumbing.

export const metadata: Metadata = {
  title: "API docs · BuiltCRM",
  description:
    "REST API reference for BuiltCRM — projects, RFIs, change orders, documents, and webhooks.",
  robots: { index: true, follow: true },
};

export default async function ApiDocsPage() {
  const session = await loadDocsSession();
  return <ApiDocsUI session={session} />;
}

async function loadDocsSession(): Promise<ApiDocsSession> {
  const sessionData = await getServerSession();
  const appUserId = sessionData?.session.appUserId;
  if (!appUserId) return { signedIn: false, dashboardHref: null };
  try {
    const ctx = await loadUserPortalContext(appUserId);
    if (ctx.options.length === 0) {
      return { signedIn: true, dashboardHref: "/no-portal" };
    }
    if (ctx.options.length === 1) {
      return { signedIn: true, dashboardHref: ctx.options[0].href };
    }
    return { signedIn: true, dashboardHref: "/select-portal" };
  } catch {
    return { signedIn: true, dashboardHref: "/no-portal" };
  }
}
