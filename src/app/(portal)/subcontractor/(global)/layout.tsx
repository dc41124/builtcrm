import type { ReactNode } from "react";

import AppShell from "@/components/shell/AppShell";
import { buildNavSections } from "@/lib/portal-nav";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function SubcontractorGlobalLayout({ children }: { children: ReactNode }) {
  const shell = await loadPortalShell("subcontractor");
  const navSections = buildNavSections("subcontractor");

  return (
    <AppShell
      portalType="subcontractor"
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
