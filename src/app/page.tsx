import { getServerSession } from "@/auth/session";
import { loadUserPortalContext } from "@/domain/loaders/portals";
import MarketingPage from "@/components/marketing/marketing-page";

// Root: marketing site for everyone. Signed-in visitors see the same
// pages with an "Open dashboard" CTA in the nav (instead of "Log in /
// Get started free") that links to their portal home, or to the portal
// picker if they have multiple. We don't auto-redirect signed-in users
// any more — clicking a marketing-nav tab from /api-docs (or anywhere
// else) used to bounce them straight into the portal, which made
// /api-docs feel like it was trapped in its own contained environment.
export default async function Home() {
  const session = await loadMarketingSession();
  return <MarketingPage session={session} />;
}

export type MarketingSession = {
  signedIn: boolean;
  dashboardHref: string | null;
};

async function loadMarketingSession(): Promise<MarketingSession> {
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
