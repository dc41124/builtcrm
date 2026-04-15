import type { NavSection, PortalType } from "@/components/shell/AppShell";

// Builds the sidebar nav sections for a portal. If `projectId` is provided,
// project-scoped links are wired to that project; otherwise they point to a
// placeholder and are typically hidden by the layout.
export function buildNavSections(
  portalType: PortalType,
  projectId?: string,
  activeHref?: string,
): NavSection[] {
  const mark = (items: { label: string; href: string }[]): NavSection["items"] =>
    items.map((i) => ({ ...i, active: activeHref === i.href }));

  if (portalType === "contractor") {
    const sections: NavSection[] = [
      {
        label: "Workspace",
        defaultOpen: true,
        items: mark([
          { label: "Dashboard", href: "/contractor/dashboard" },
          { label: "Settings", href: "/contractor/settings" },
        ]),
      },
    ];
    if (projectId) {
      const base = `/contractor/project/${projectId}`;
      sections.push({
        label: "Project",
        defaultOpen: true,
        items: mark([
          { label: "Overview", href: `${base}` },
          { label: "Schedule", href: `${base}/schedule` },
          { label: "RFIs", href: `${base}/rfis` },
          { label: "Change Orders", href: `${base}/change-orders` },
          { label: "Approvals", href: `${base}/approvals` },
          { label: "Compliance", href: `${base}/compliance` },
          { label: "Billing", href: `${base}/billing` },
          { label: "Payments", href: `${base}/payments` },
          { label: "Selections", href: `${base}/selections` },
          { label: "Upload Requests", href: `${base}/upload-requests` },
          { label: "Messages", href: `${base}/messages` },
          { label: "Documents", href: `${base}/documents` },
        ]),
      });
    }
    return sections;
  }

  if (portalType === "subcontractor") {
    const sections: NavSection[] = [
      {
        label: "Work",
        defaultOpen: true,
        items: mark([{ label: "Today Board", href: "/subcontractor/today" }]),
      },
    ];
    if (projectId) {
      const base = `/subcontractor/project/${projectId}`;
      sections.push({
        label: "Project",
        defaultOpen: true,
        items: mark([
          { label: "Project Home", href: `${base}` },
          { label: "Schedule", href: `${base}/schedule` },
          { label: "RFIs", href: `${base}/rfis` },
          { label: "Upload Requests", href: `${base}/upload-requests` },
          { label: "Compliance", href: `${base}/compliance` },
          { label: "Financials", href: `${base}/financials` },
          { label: "Messages", href: `${base}/messages` },
          { label: "Documents", href: `${base}/documents` },
        ]),
      });
    }
    return sections;
  }

  if (portalType === "commercial") {
    if (!projectId) return [];
    const base = `/commercial/project/${projectId}`;
    return [
      {
        label: "Project",
        defaultOpen: true,
        items: mark([
          { label: "Overview", href: `${base}` },
          { label: "Schedule", href: `${base}/schedule` },
          { label: "Change Orders", href: `${base}/change-orders` },
          { label: "Approvals", href: `${base}/approvals` },
          { label: "Billing", href: `${base}/billing` },
          { label: "Payments", href: `${base}/payments` },
          { label: "Messages", href: `${base}/messages` },
          { label: "Documents", href: `${base}/documents` },
        ]),
      },
    ];
  }

  // residential
  if (!projectId) return [];
  const base = `/residential/project/${projectId}`;
  return [
    {
      label: "Project",
      defaultOpen: true,
      items: mark([
        { label: "Overview", href: `${base}` },
        { label: "Schedule", href: `${base}/schedule` },
        { label: "Scope Changes", href: `${base}/scope-changes` },
        { label: "Decisions", href: `${base}/decisions` },
        { label: "Selections", href: `${base}/selections` },
        { label: "Billing", href: `${base}/billing` },
        { label: "Messages", href: `${base}/messages` },
        { label: "Documents", href: `${base}/documents` },
      ]),
    },
  ];
}
