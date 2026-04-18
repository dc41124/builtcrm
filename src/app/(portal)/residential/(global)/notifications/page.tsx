import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import { NotificationsPage } from "@/components/notifications/notifications-page";
import { getAccessibleProjects } from "@/domain/loaders/portals";

export default async function ResidentialNotificationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const appUserId = (session.session as unknown as { appUserId?: string | null })
    .appUserId;
  if (!appUserId) redirect("/login");

  const accessible = await getAccessibleProjects(appUserId, "residential");
  return (
    <NotificationsPage
      portalType="residential"
      projects={accessible.map((p) => ({ id: p.projectId, name: p.projectName }))}
    />
  );
}
