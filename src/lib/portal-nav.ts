import type { NavItem, NavSection, PortalType } from "@/components/shell/AppShell";
import type { NavCounts } from "./portal-nav-counts";

export type BuildNavOptions = {
  portalType: PortalType;
  projectId?: string;
  activeHref?: string;
  /** Map of href → unread/pending count. Items with a count > 0 get a badge. */
  counts?: NavCounts;
};

// Builds the sidebar nav sections for a portal. Structure matches the grouped
// layouts defined in docs/prototypes/ (design system shell + each portal's
// own prototype file). Some items point to routes that do not exist yet —
// those routes are part of the remaining build and will render 404 or
// ComingSoon placeholders until implemented.
export function buildNavSections(options: BuildNavOptions): NavSection[] {
  const { portalType, projectId, activeHref, counts } = options;
  const mark = (items: NavItem[]): NavItem[] =>
    items.map((i) => {
      const badge = counts?.[i.href];
      return {
        ...i,
        active: activeHref === i.href,
        badge: badge && badge > 0 ? badge : i.badge,
      };
    });

  if (portalType === "contractor") {
    if (projectId) {
      // Inside a project: show project-scoped nav with Dashboard as escape hatch.
      const base = `/contractor/project/${projectId}`;
      return [
        {
          label: "Overview",
          defaultOpen: true,
          items: mark([
            { label: "Dashboard", href: "/contractor/dashboard" },
          ]),
        },
        {
          label: "Project",
          defaultOpen: true,
          items: mark([
            { label: "Project Home", href: `${base}` },
            { label: "Schedule", href: `${base}/schedule` },
            { label: "RFIs", href: `${base}/rfis` },
            { label: "Change Orders", href: `${base}/change-orders` },
            { label: "Approvals", href: `${base}/approvals` },
            { label: "Compliance", href: `${base}/compliance` },
            { label: "Billing", href: `${base}/billing` },
            { label: "Financials", href: `${base}/financials` },
            { label: "Selections", href: `${base}/selections` },
            { label: "Upload Requests", href: `${base}/upload-requests` },
            { label: "Messages", href: `${base}/messages` },
            { label: "Documents", href: `${base}/documents` },
          ]),
        },
        {
          label: "Settings",
          defaultOpen: false,
          placement: "after-projects",
          items: mark([
            { label: "Organization", href: "/contractor/settings/organization" },
            { label: "Team & Roles", href: "/contractor/settings/team" },
            { label: "Integrations", href: "/contractor/settings/integrations" },
            { label: "Payments", href: "/contractor/settings/payments" },
          ]),
        },
      ];
    }
    // No project context: show cross-project nav.
    return [
      {
        label: "Core",
        defaultOpen: true,
        items: mark([
          { label: "Dashboard", href: "/contractor/dashboard" },
          { label: "Approvals", href: "/contractor/approvals" },
          { label: "Messages", href: "/contractor/messages" },
        ]),
      },
      {
        label: "Workflows",
        defaultOpen: true,
        items: mark([
          { label: "Billing & Draws", href: "/contractor/billing" },
          { label: "RFIs", href: "/contractor/rfis" },
          { label: "Change Orders", href: "/contractor/change-orders" },
          { label: "Compliance", href: "/contractor/compliance" },
          { label: "Upload Requests", href: "/contractor/upload-requests" },
          { label: "Documents", href: "/contractor/documents" },
        ]),
      },
      {
        label: "Financials",
        defaultOpen: true,
        items: mark([
          { label: "Budget Overview", href: "/contractor/budget" },
          { label: "Payment Tracking", href: "/contractor/payment-tracking" },
          { label: "Retainage", href: "/contractor/retainage" },
        ]),
      },
      {
        label: "Settings",
        defaultOpen: false,
        placement: "after-projects",
        items: mark([
          { label: "Organization", href: "/contractor/settings/organization" },
          { label: "Team & Roles", href: "/contractor/settings/team" },
          { label: "Integrations", href: "/contractor/settings/integrations" },
        ]),
      },
    ];
  }

  if (portalType === "subcontractor") {
    if (projectId) {
      // Inside a project: show project-scoped nav with Today Board as escape hatch.
      const base = `/subcontractor/project/${projectId}`;
      return [
        {
          label: "Overview",
          defaultOpen: true,
          items: mark([
            { label: "Today Board", href: "/subcontractor/today" },
          ]),
        },
        {
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
        },
        {
          label: "Company",
          defaultOpen: false,
          placement: "after-projects",
          items: mark([
            { label: "Team", href: "/subcontractor/team" },
            { label: "Settings", href: "/subcontractor/settings" },
          ]),
        },
      ];
    }
    // No project context: show cross-project nav.
    return [
      {
        label: "Work",
        defaultOpen: true,
        items: mark([
          { label: "Today Board", href: "/subcontractor/today" },
          { label: "RFIs & Questions", href: "/subcontractor/rfis" },
          { label: "Upload Requests", href: "/subcontractor/upload-requests" },
          { label: "Schedule", href: "/subcontractor/schedule" },
          { label: "Documents", href: "/subcontractor/documents" },
        ]),
      },
      {
        label: "Money",
        defaultOpen: true,
        items: mark([
          { label: "POs & Payments", href: "/subcontractor/payments" },
        ]),
      },
      {
        label: "Compliance",
        defaultOpen: true,
        items: mark([
          { label: "Insurance & Certs", href: "/subcontractor/compliance" },
        ]),
      },
      {
        label: "Messages",
        defaultOpen: true,
        items: mark([
          { label: "Inbox", href: "/subcontractor/messages" },
        ]),
      },
      {
        label: "Company",
        defaultOpen: false,
        placement: "after-projects",
        items: mark([
          { label: "Team", href: "/subcontractor/team" },
          { label: "Settings", href: "/subcontractor/settings" },
        ]),
      },
    ];
  }

  if (portalType === "commercial") {
    // Commercial client sidebar is project-scoped. Structure from
    // builtcrm_commercial_client_portal_pages.jsx.
    if (!projectId) return [];
    const base = `/commercial/project/${projectId}`;
    return [
      {
        label: "Project",
        defaultOpen: true,
        items: mark([
          { label: "Project Home", href: `${base}` },
          { label: "Progress & Updates", href: `${base}/progress` },
          { label: "Photos", href: `${base}/photos` },
          { label: "Schedule", href: `${base}/schedule` },
        ]),
      },
      {
        label: "Decisions",
        defaultOpen: true,
        items: mark([
          { label: "Approval Center", href: `${base}/approvals` },
          { label: "Change Orders", href: `${base}/change-orders` },
        ]),
      },
      {
        label: "Financial",
        defaultOpen: true,
        items: mark([
          { label: "Billing & Draws", href: `${base}/billing` },
          { label: "Payment History", href: `${base}/payments` },
        ]),
      },
      {
        label: "Documents",
        defaultOpen: true,
        items: mark([
          { label: "Project Files", href: `${base}/documents` },
        ]),
      },
      {
        label: "Communication",
        defaultOpen: true,
        items: mark([
          { label: "Messages", href: `${base}/messages` },
        ]),
      },
    ];
  }

  // Residential client sidebar — project-scoped, residential language per
  // builtcrm_residential_client_portal_pages.jsx ("Scope Changes", "Decisions",
  // "Your project", "Confirmed choices").
  if (!projectId) return [];
  const base = `/residential/project/${projectId}`;
  return [
    {
      label: "Your project",
      defaultOpen: true,
      items: mark([
        { label: "Project Home", href: `${base}` },
        { label: "Progress & Photos", href: `${base}/progress` },
        { label: "Selections", href: `${base}/selections` },
        { label: "Schedule", href: `${base}/schedule` },
      ]),
    },
    {
      label: "Decisions",
      defaultOpen: true,
      items: mark([
        { label: "Decisions", href: `${base}/decisions` },
        { label: "Scope changes", href: `${base}/scope-changes` },
        { label: "Confirmed choices", href: `${base}/confirmed-choices` },
      ]),
    },
    {
      label: "Payments & docs",
      defaultOpen: true,
      items: mark([
        { label: "Budget", href: `${base}/budget` },
        { label: "Documents", href: `${base}/documents` },
      ]),
    },
    {
      label: "Messages",
      defaultOpen: true,
      items: mark([
        { label: "Inbox", href: `${base}/messages` },
      ]),
    },
  ];
}
