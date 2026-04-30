import type { ReactNode } from "react";

import AppShell from "@/components/shell/AppShell";
import { buildNavSections } from "@/lib/portal-nav";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function ResidentialGlobalLayout({
  children,
}: {
  children: ReactNode;
}) {
  const shell = await loadPortalShell("residential");
  const navSections = buildNavSections({
    portalType: "residential",
    counts: shell.navCounts,
  });

  return (
    <AppShell
      portalType="residential"
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
