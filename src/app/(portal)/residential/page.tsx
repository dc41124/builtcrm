import { redirect } from "next/navigation";

import { loadPortalShell } from "@/lib/portal-shell";
import { ComingSoon } from "@/components/shell/coming-soon";

export default async function ResidentialIndex() {
  const shell = await loadPortalShell("residential");
  const first = shell.projectShortcuts[0];
  if (first) redirect(`/residential/project/${first.projectId}`);
  return (
    <ComingSoon
      title="No project yet"
      description="Your builder will add you to your project here once work is ready to begin."
    />
  );
}
