import { redirect } from "next/navigation";

import { requireServerSession } from "@/auth/session";

import { NotificationsPage } from "@/components/notifications/notifications-page";
import { getAccessibleProjects } from "@/domain/loaders/portals";

export default async function ContractorNotificationsPage() {
  const { session } = await requireServerSession();
  const appUserId = (session)
    .appUserId;
  if (!appUserId) redirect("/login");

  const accessible = await getAccessibleProjects(appUserId, "contractor");
  return (
    <NotificationsPage
      portalType="contractor"
      projects={accessible.map((p) => ({ id: p.projectId, name: p.projectName }))}
    />
  );
}
