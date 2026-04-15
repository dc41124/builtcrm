import type { ReactNode } from "react";

// Commercial portal is entirely project-scoped. The shell + nav are rendered
// one level down at commercial/project/[projectId]/layout.tsx so the layout
// has access to the active projectId. This parent is a passthrough.
export default function CommercialLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
