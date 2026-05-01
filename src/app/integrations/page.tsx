import type { Metadata } from "next";

import { getServerSession } from "@/auth/session";
import { loadUserPortalContext } from "@/domain/loaders/portals";

import { PublicIntegrationsUI, type IntegrationsSession } from "./ui";

// Step 64 — Public marketing version of the integration gallery.
// Same marketing-site chrome as /api-docs. Anyone (signed-in or not)
// can browse the catalog; nothing is gated.

export const metadata: Metadata = {
  title: "Integrations · BuiltCRM",
  description:
    "Browse the BuiltCRM integration ecosystem — accounting, payments, documents, project management, compliance, and more.",
  robots: { index: true, follow: true },
};

export default async function IntegrationsPage() {
  const session = await loadDocsSession();
  return <PublicIntegrationsUI session={session} />;
}

async function loadDocsSession(): Promise<IntegrationsSession> {
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
