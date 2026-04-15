import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth/config";
import {
  loadUserPortalContext,
  type PortalOption,
  type ProjectShortcut,
} from "@/domain/loaders/portals";

import type { PortalType, ShellProject } from "@/components/shell/AppShell";

export type PortalShellData = {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  orgName: string;
  orgId: string;
  projects: ShellProject[];
  projectShortcuts: ProjectShortcut[];
  option: PortalOption;
};

// Loads the minimum data needed to render a portal's AppShell and verifies
// that the signed-in user belongs to the requested portal. Redirects to
// /login if unauthenticated, or to the user's first available portal if
// they don't have access to this one.
export async function loadPortalShell(
  portalType: PortalType,
  activeProjectId?: string,
): Promise<PortalShellData> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const appUserId = (session.session as unknown as { appUserId?: string | null })
    .appUserId;
  if (!appUserId) redirect("/login");

  const ctx = await loadUserPortalContext(appUserId);
  if (ctx.options.length === 0) redirect("/select-portal");

  const option = ctx.options.find((o) => matchesPortal(o, portalType));
  if (!option) {
    // User has portals, just not this one — send them to the first one.
    const first = ctx.options[0];
    redirect(routeFor(first));
  }

  const wantLabel = shortcutLabelFor(portalType);
  const shortcuts = ctx.projectShortcuts.filter((s) => s.portalLabel === wantLabel);

  const projects: ShellProject[] = shortcuts.map((s) => ({
    name: s.projectName,
    href: `/${portalType}/project/${s.projectId}`,
    phase: undefined,
    dot: "gray",
    active: activeProjectId ? s.projectId === activeProjectId : false,
  }));

  const userRow = session.user as unknown as { name?: string | null; email: string };
  const userName = userRow.name ?? userRow.email ?? "User";

  return {
    userId: appUserId,
    userName,
    userEmail: userRow.email,
    userRole: roleLabel(portalType),
    orgName: option.organizationName,
    orgId: option.organizationId,
    projects,
    projectShortcuts: shortcuts,
    option,
  };
}

function matchesPortal(option: PortalOption, portalType: PortalType): boolean {
  if (portalType === "contractor") return option.portalType === "contractor";
  if (portalType === "subcontractor") return option.portalType === "subcontractor";
  if (portalType === "commercial") {
    return option.portalType === "client" && option.clientSubtype !== "residential";
  }
  if (portalType === "residential") {
    return option.portalType === "client" && option.clientSubtype === "residential";
  }
  return false;
}

function routeFor(option: PortalOption): string {
  if (option.portalType === "contractor") return "/contractor";
  if (option.portalType === "subcontractor") return "/subcontractor";
  return option.clientSubtype === "residential" ? "/residential" : "/commercial";
}

function shortcutLabelFor(portalType: PortalType): string {
  switch (portalType) {
    case "contractor":
      return "Contractor";
    case "subcontractor":
      return "Subcontractor";
    case "commercial":
      return "Client";
    case "residential":
      return "Residential client";
  }
}

function roleLabel(portalType: PortalType): string {
  switch (portalType) {
    case "contractor":
      return "Contractor";
    case "subcontractor":
      return "Subcontractor";
    case "commercial":
      return "Client";
    case "residential":
      return "Homeowner";
  }
}
