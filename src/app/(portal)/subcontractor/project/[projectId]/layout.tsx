import type { ReactNode } from "react";

import AppShell from "@/components/shell/AppShell";
import { buildNavSections } from "@/lib/portal-nav";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function SubcontractorProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const shell = await loadPortalShell("subcontractor", projectId);
  const navSections = buildNavSections({
    portalType: "subcontractor",
    projectId,
    counts: shell.navCounts,
  });

  return (
    <AppShell
      portalType="subcontractor"
      orgName={shell.orgName}
      userName={shell.userName}
      userRole={shell.userRole}
      userAvatarUrl={shell.userAvatarUrl}
      navSections={navSections}
      projects={shell.projects}
    >
      {children}
    </AppShell>
  );
}
