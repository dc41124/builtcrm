import type { ReactNode } from "react";

import AppShell from "@/components/shell/AppShell";
import { buildNavSections } from "@/lib/portal-nav";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function ContractorGlobalLayout({ children }: { children: ReactNode }) {
  const shell = await loadPortalShell("contractor");
  const navSections = buildNavSections({
    portalType: "contractor",
    counts: shell.navCounts,
  });

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
