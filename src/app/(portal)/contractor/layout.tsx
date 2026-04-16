import type { ReactNode } from "react";

// Contractor portal is split into two route groups:
//   (global)/  — cross-project pages (dashboard, settings, etc.)
//   project/[projectId]/ — project-scoped pages
// Each has its own layout that renders AppShell with/without projectId.
// This parent is a passthrough, matching the client portal pattern.
export default function ContractorLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
