import { redirect } from "next/navigation";

import { loadPortalShell } from "@/lib/portal-shell";
import { ComingSoon } from "@/components/shell/coming-soon";

export default async function CommercialIndex() {
  const shell = await loadPortalShell("commercial");
  const first = shell.projectShortcuts[0];
  if (first) redirect(`/commercial/project/${first.projectId}`);
  return (
    <ComingSoon
      title="No projects yet"
      description="You don't have access to any commercial projects yet. Your project team will add you when work begins."
    />
  );
}
