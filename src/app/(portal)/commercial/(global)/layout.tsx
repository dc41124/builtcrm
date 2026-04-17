import type { ReactNode } from "react";

import AppShell from "@/components/shell/AppShell";
import { buildNavSections } from "@/lib/portal-nav";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function CommercialGlobalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const shell = await loadPortalShell("commercial");
  const navSections = buildNavSections({
    portalType: "commercial",
    counts: shell.navCounts,
  });

  return (
    <AppShell
      portalType="commercial"
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
