import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { loadUserPortalContext } from "@/domain/loaders/portals";

import { PublicIntegrationsUI } from "./ui";

// Step 64 — Public marketing version of the integration gallery. Anyone
// logged-out can browse the catalog. Signed-in visitors are redirected
// straight to their portal — the marketing surface is never shown to
// authenticated sessions.

export const metadata: Metadata = {
  title: "Integrations · BuiltCRM",
  description:
    "Browse the BuiltCRM integration ecosystem — accounting, payments, documents, project management, compliance, and more.",
  robots: { index: true, follow: true },
};

export default async function IntegrationsPage() {
  const sessionData = await getServerSession();
  const appUserId = sessionData?.session.appUserId;
  if (appUserId) {
    redirect(await resolvePortalHref(appUserId));
  }
  return <PublicIntegrationsUI />;
}

async function resolvePortalHref(appUserId: string): Promise<string> {
  try {
    const ctx = await loadUserPortalContext(appUserId);
    if (ctx.options.length === 0) return "/no-portal";
    if (ctx.options.length === 1) return ctx.options[0].href;
    return "/select-portal";
  } catch {
    return "/no-portal";
  }
}
