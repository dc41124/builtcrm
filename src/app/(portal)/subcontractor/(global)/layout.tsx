import type { ReactNode } from "react";
import { headers } from "next/headers";

import { auth } from "@/auth/config";
import AppShell from "@/components/shell/AppShell";
import { getSubPrequalNavVisibility } from "@/domain/loaders/prequal";
import { buildNavSections } from "@/lib/portal-nav";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function SubcontractorGlobalLayout({ children }: { children: ReactNode }) {
  const shell = await loadPortalShell("subcontractor");
  const session = await auth.api.getSession({ headers: await headers() });
  const subPrequalVisible = await getSubPrequalNavVisibility(
    (session?.session ?? null) as unknown as { appUserId?: string | null } | null,
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
      navSections={navSections}
      projects={shell.projects}
    >
      {children}
    </AppShell>
  );
}
