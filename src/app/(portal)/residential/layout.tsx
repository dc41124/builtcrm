import type { ReactNode } from "react";

// Residential portal is entirely project-scoped. The shell + nav are rendered
// one level down at residential/project/[projectId]/layout.tsx so the layout
// has access to the active projectId. This parent is a passthrough.
export default function ResidentialLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
