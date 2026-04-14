import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { loadUserPortalContext } from "@/domain/loaders/portals";

export default async function AppIndexPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const appUserId = (session.session as unknown as { appUserId?: string | null })
    .appUserId;
  if (!appUserId) redirect("/login");

  const ctx = await loadUserPortalContext(appUserId);
  if (ctx.options.length === 0) redirect("/app/no-portal");
  if (ctx.options.length === 1) redirect(ctx.options[0].href);
  redirect("/select-portal");
}
