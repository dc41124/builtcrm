import { redirect } from "next/navigation";

import { getServerSession } from "@/auth/session";
import { loadUserPortalContext } from "@/domain/loaders/portals";
import MarketingPage from "@/components/marketing/marketing-page";

// Root: signed-out users see the marketing site. Signed-in users are
// dispatched to their portal (or to /select-portal if they have more than
// one, or /no-portal if they have none).
export default async function Home() {
  const sessionData = await getServerSession();

  if (sessionData) {
    const appUserId = sessionData.session.appUserId;
    if (appUserId) {
      const ctx = await loadUserPortalContext(appUserId);
      if (ctx.options.length === 0) redirect("/no-portal");
      if (ctx.options.length === 1) redirect(ctx.options[0].href);
      redirect("/select-portal");
    }
  }

  return <MarketingPage />;
}
