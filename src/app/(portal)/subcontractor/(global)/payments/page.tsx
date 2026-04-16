import { redirect } from "next/navigation";
import { loadPortalShell } from "@/lib/portal-shell";

export default async function Page() {
  const shell = await loadPortalShell("subcontractor");
  const first = shell.projectShortcuts[0];
  if (first) redirect(`/subcontractor/project/${first.projectId}/payments`);
  return <p style={{ padding: 48, color: "var(--t3)", fontFamily: "var(--fb)" }}>No projects yet</p>;
}
