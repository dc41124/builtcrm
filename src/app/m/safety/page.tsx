import { redirect } from "next/navigation";

import { loadPortalShell } from "@/lib/portal-shell";

// /m/safety — entry point for the safety-forms mobile PWA.
// Subs typically have one active project; redirect there. If they have
// multiple, redirect to the first; the list page links to the others.
// If the worker has no projects, the list page renders an empty state.
export default async function MobileSafetyEntryPage() {
  const shell = await loadPortalShell("subcontractor");
  const first = shell.projectShortcuts[0];
  if (first) redirect(`/m/safety/project/${first.projectId}`);
  return (
    <div style={{ padding: 32, textAlign: "center", fontSize: 14 }}>
      <p>You don&apos;t have any active projects yet.</p>
    </div>
  );
}

// /m/safety/forms — alias the landing redirect uses. Same behavior.
export const dynamic = "force-dynamic";
