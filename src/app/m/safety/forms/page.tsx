import { redirect } from "next/navigation";

import { loadPortalShell } from "@/lib/portal-shell";

// Alias: landing page uses /m/safety/forms. Resolve the first project and
// jump into the mobile list.
export default async function MobileSafetyFormsAlias() {
  const shell = await loadPortalShell("subcontractor");
  const first = shell.projectShortcuts[0];
  if (first) redirect(`/m/safety/project/${first.projectId}`);
  redirect("/m/safety");
}

export const dynamic = "force-dynamic";
