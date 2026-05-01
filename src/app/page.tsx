import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { loadUserPortalContext } from "@/domain/loaders/portals";
import MarketingPage from "@/components/marketing/marketing-page";

// Root: marketing site for logged-out visitors. Signed-in users are
// redirected straight to their portal (or the picker / no-portal page);
// the marketing site is never shown to authenticated sessions.
export default async function Home() {
  const sessionData = await getServerSession();
  const appUserId = sessionData?.session.appUserId;
  if (appUserId) {
    redirect(await resolvePortalHref(appUserId));
  }
  return <MarketingPage />;
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
