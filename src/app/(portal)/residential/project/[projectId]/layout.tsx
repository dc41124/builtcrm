import type { ReactNode } from "react";

import AppShell from "@/components/shell/AppShell";
import { buildNavSections } from "@/lib/portal-nav";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function ResidentialProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const shell = await loadPortalShell("residential", projectId);
  const navSections = buildNavSections({
    portalType: "residential",
    projectId,
    counts: shell.navCounts,
  });

  return (
    <AppShell
      portalType="residential"
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
