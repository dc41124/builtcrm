import type { ReactNode } from "react";

import AppShell from "@/components/shell/AppShell";
import { buildNavSections } from "@/lib/portal-nav";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function ResidentialLayout({ children }: { children: ReactNode }) {
  const shell = await loadPortalShell("residential");
  const navSections = buildNavSections("residential");

  return (
    <AppShell
      portalType="residential"
      orgName={shell.orgName}
      userName={shell.userName}
      userRole={shell.userRole}
      navSections={navSections}
      projects={shell.projects}
      breadcrumbs={[{ label: "My Project", href: shell.projects[0]?.href ?? "#" }]}
    >
      {children}
    </AppShell>
  );
}
