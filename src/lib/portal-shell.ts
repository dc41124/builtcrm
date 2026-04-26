import { redirect } from "next/navigation";
import { and, eq, inArray, lte, or } from "drizzle-orm";

import { getServerSession } from "@/auth/session";
import {
  getAccessibleProjects,
  loadUserPortalContext,
  type PortalOption,
  type ProjectShortcut,
} from "@/domain/loaders/portals";
import { db } from "@/db/client";
import { projects, complianceRecords, rfis, approvals } from "@/db/schema";
import { withTenant } from "@/db/with-tenant";

import type { PortalType, ShellProject } from "@/components/shell/AppShell";
import { getPortalNavCounts, type NavCounts } from "./portal-nav-counts";

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
  navCounts: NavCounts;
};

// Loads the minimum data needed to render a portal's AppShell and verifies
// that the signed-in user belongs to the requested portal. Redirects to
// /login if unauthenticated, or to the user's first available portal if
// they don't have access to this one.
export async function loadPortalShell(
  portalType: PortalType,
  activeProjectId?: string,
): Promise<PortalShellData> {
  const sessionData = await getServerSession();
  if (!sessionData) redirect("/login");
  const { session, user } = sessionData;

  const appUserId = session.appUserId;
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

  // Full project list (uncapped) powers both the sidebar and the topbar
  // project switcher. `projectShortcuts` above stays capped at 5 for the
  // portal-selector overview use case.
  const accessible = await getAccessibleProjects(appUserId, portalType);
  const projectIds = accessible.map((p) => p.projectId);
  const [phaseRows, healthMap, navCounts] = await Promise.all([
    projectIds.length
      ? db
          .select({ id: projects.id, currentPhase: projects.currentPhase })
          .from(projects)
          .where(inArray(projects.id, projectIds))
      : Promise.resolve([] as Array<{ id: string; currentPhase: string }>),
    computeProjectHealth(option.organizationId, projectIds),
    getPortalNavCounts({
      portalType,
      userId: appUserId,
      orgId: option.organizationId,
      projectIds,
      activeProjectId,
    }),
  ]);
  const phaseById = new Map(phaseRows.map((r) => [r.id, r.currentPhase]));

  const shellProjects: ShellProject[] = accessible.map((p) => ({
    id: p.projectId,
    name: p.projectName,
    href: p.href,
    phase: phaseLabel(phaseById.get(p.projectId)),
    dot: healthMap.get(p.projectId) ?? "gray",
    active: activeProjectId ? p.projectId === activeProjectId : false,
  }));

  const userName = user.name ?? user.email ?? "User";

  return {
    userId: appUserId,
    userName,
    userEmail: user.email,
    userRole: roleLabel(portalType),
    orgName: option.organizationName,
    orgId: option.organizationId,
    projects: shellProjects,
    projectShortcuts: shortcuts,
    option,
    navCounts,
  };
}

function phaseLabel(phase: string | undefined): string | undefined {
  switch (phase) {
    case "preconstruction":
      return "Preconstruction";
    case "phase_1":
      return "Phase 1 · Foundations";
    case "phase_2":
      return "Phase 2 · Structural";
    case "phase_3":
      return "Phase 3 · Finishes";
    case "closeout":
      return "Closeout";
    default:
      return undefined;
  }
}

// Computes a simple health signal per project for the sidebar dot:
//   red   = any expired compliance or overdue open RFI
//   amber = any compliance expiring within 14 days, or any pending approval past due
//   green = otherwise
// One-query-per-signal, cheap enough to run on every portal load.
async function computeProjectHealth(
  orgId: string,
  projectIds: string[],
): Promise<Map<string, "green" | "amber" | "red" | "gray">> {
  const result = new Map<string, "green" | "amber" | "red" | "gray">();
  if (projectIds.length === 0) return result;
  for (const id of projectIds) result.set(id, "green");

  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 86400000);

  // Red signals — multi-org policy on compliance_records: each user's
  // own GUC selects clause B (contractor on their project) or C
  // (sub/client on a project they have a POM membership on).
  const expiredCompliance = await withTenant(orgId, (tx) =>
    tx
      .select({ projectId: complianceRecords.projectId })
      .from(complianceRecords)
      .where(
        and(
          inArray(complianceRecords.projectId, projectIds),
          eq(complianceRecords.complianceStatus, "expired"),
        )!,
      ),
  );
  for (const r of expiredCompliance) {
    if (r.projectId) result.set(r.projectId, "red");
  }

  const overdueRfis = await db
    .select({ projectId: rfis.projectId })
    .from(rfis)
    .where(
      and(
        inArray(rfis.projectId, projectIds),
        or(eq(rfis.rfiStatus, "open"), eq(rfis.rfiStatus, "pending_response")),
        lte(rfis.dueAt, now),
      )!,
    );
  for (const r of overdueRfis) {
    result.set(r.projectId, "red");
  }

  // Amber signals (don't downgrade red) — same multi-org policy paths.
  const soonExpiring = await withTenant(orgId, (tx) =>
    tx
      .select({ projectId: complianceRecords.projectId })
      .from(complianceRecords)
      .where(
        and(
          inArray(complianceRecords.projectId, projectIds),
          eq(complianceRecords.complianceStatus, "active"),
          lte(complianceRecords.expiresAt, in14Days),
        )!,
      ),
  );
  for (const r of soonExpiring) {
    if (r.projectId && result.get(r.projectId) !== "red") {
      result.set(r.projectId, "amber");
    }
  }

  const stalePendingApprovals = await db
    .select({ projectId: approvals.projectId })
    .from(approvals)
    .where(
      and(
        inArray(approvals.projectId, projectIds),
        eq(approvals.approvalStatus, "pending_review"),
      )!,
    );
  for (const r of stalePendingApprovals) {
    if (result.get(r.projectId) === "green") {
      result.set(r.projectId, "amber");
    }
  }

  return result;
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
