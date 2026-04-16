import type { ReactNode } from "react";

import AppShell from "@/components/shell/AppShell";
import { buildNavSections } from "@/lib/portal-nav";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function ContractorProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const shell = await loadPortalShell("contractor", projectId);
  const navSections = buildNavSections("contractor", projectId);

  return (
    <AppShell
      portalType="contractor"
      orgName={shell.orgName}
      userName={shell.userName}
      userRole={shell.userRole}
      navSections={navSections}
      projects={shell.projects}
    >
      {children}
    </AppShell>
  );
}
