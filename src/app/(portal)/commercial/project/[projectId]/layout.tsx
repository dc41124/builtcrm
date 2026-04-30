import type { ReactNode } from "react";

import AppShell from "@/components/shell/AppShell";
import { buildNavSections } from "@/lib/portal-nav";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function CommercialProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const shell = await loadPortalShell("commercial", projectId);
  const navSections = buildNavSections({
    portalType: "commercial",
    projectId,
    counts: shell.navCounts,
  });

  return (
    <AppShell
      portalType="commercial"
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
