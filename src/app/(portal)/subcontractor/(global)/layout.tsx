import type { ReactNode } from "react";

import { getServerSession } from "@/auth/session";
import AppShell from "@/components/shell/AppShell";
import { getSubPrequalNavVisibility } from "@/domain/loaders/prequal";
import { buildNavSections } from "@/lib/portal-nav";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function SubcontractorGlobalLayout({ children }: { children: ReactNode }) {
  const shell = await loadPortalShell("subcontractor");
  const sessionData = await getServerSession();
  const subPrequalVisible = await getSubPrequalNavVisibility(
    sessionData?.session ?? null,
  );
  const navSections = buildNavSections({
    portalType: "subcontractor",
    counts: shell.navCounts,
    subPrequalVisible,
  });

  return (
    <AppShell
      portalType="subcontractor"
      orgName={shell.orgName}
      userName={shell.userName}
      userRole={shell.userRole}
      userAvatarUrl={shell.userAvatarUrl}
      orgLogoUrl={shell.orgLogoUrl}
      navSections={navSections}
      projects={shell.projects}
    >
      {children}
    </AppShell>
  );
}
