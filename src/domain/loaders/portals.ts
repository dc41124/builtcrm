import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  organizations,
  projects,
  projectUserMemberships,
  roleAssignments,
} from "@/db/schema";

export type PortalOption = {
  roleAssignmentId: string;
  portalType: "contractor" | "subcontractor" | "client";
  clientSubtype: "commercial" | "residential" | null;
  organizationId: string;
  organizationName: string;
  roleKey: string;
  projectCount: number;
  /** Pre-resolved portal home href for this option. */
  href: string;
};

export type ProjectShortcut = {
  projectId: string;
  projectName: string;
  portalLabel: string;
  href: string;
};

export type UserPortalContext = {
  options: PortalOption[];
  projectShortcuts: ProjectShortcut[];
};

// What portals can this user enter? Drives the post-login routing decision
// and the multi-portal selector. Contractor staff get implicit access to
// every project owned by their org (mirroring getEffectiveContext); other
// roles must have an explicit project_user_memberships row.
export async function loadUserPortalContext(
  appUserId: string,
): Promise<UserPortalContext> {
  const assignments = await db
    .select({
      id: roleAssignments.id,
      portalType: roleAssignments.portalType,
      clientSubtype: roleAssignments.clientSubtype,
      organizationId: roleAssignments.organizationId,
      organizationName: organizations.name,
      roleKey: roleAssignments.roleKey,
    })
    .from(roleAssignments)
    .innerJoin(
      organizations,
      eq(organizations.id, roleAssignments.organizationId),
    )
    .where(eq(roleAssignments.userId, appUserId));

  const options: PortalOption[] = [];
  const shortcuts: ProjectShortcut[] = [];

  for (const a of assignments) {
    const href = portalHref(a.portalType, a.clientSubtype);

    let projectCount = 0;
    if (a.portalType === "contractor") {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(eq(projects.contractorOrganizationId, a.organizationId));
      projectCount = Number(count);

      const orgProjects = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(eq(projects.contractorOrganizationId, a.organizationId))
        .limit(5);
      for (const p of orgProjects) {
        shortcuts.push({
          projectId: p.id,
          projectName: p.name,
          portalLabel: "Contractor",
          href: `${href}/project/${p.id}`,
        });
      }
    } else {
      const memberships = await db
        .select({
          projectId: projectUserMemberships.projectId,
          projectName: projects.name,
        })
        .from(projectUserMemberships)
        .innerJoin(projects, eq(projects.id, projectUserMemberships.projectId))
        .where(
          and(
            eq(projectUserMemberships.userId, appUserId),
            eq(projectUserMemberships.organizationId, a.organizationId),
            eq(projectUserMemberships.roleAssignmentId, a.id),
          ),
        );
      projectCount = memberships.length;
      const portalLabel =
        a.portalType === "subcontractor"
          ? "Subcontractor"
          : a.clientSubtype === "residential"
            ? "Residential client"
            : "Client";
      for (const m of memberships.slice(0, 5)) {
        shortcuts.push({
          projectId: m.projectId,
          projectName: m.projectName,
          portalLabel,
          href: `${href}/project/${m.projectId}`,
        });
      }
    }

    options.push({
      roleAssignmentId: a.id,
      portalType: a.portalType,
      clientSubtype: a.clientSubtype,
      organizationId: a.organizationId,
      organizationName: a.organizationName,
      roleKey: a.roleKey,
      projectCount,
      href,
    });
  }

  return { options, projectShortcuts: shortcuts };
}

export function portalHref(
  portalType: "contractor" | "subcontractor" | "client",
  clientSubtype: "commercial" | "residential" | null,
): string {
  if (portalType === "contractor") return "/app/contractor";
  if (portalType === "subcontractor") return "/app/subcontractor";
  return clientSubtype === "residential"
    ? "/app/residential"
    : "/app/commercial";
}

export function portalLabel(option: PortalOption): {
  name: string;
  initials: string;
  cssVar: string;
} {
  if (option.portalType === "contractor") {
    return { name: "Contractor Portal", initials: "GC", cssVar: "var(--contractor)" };
  }
  if (option.portalType === "subcontractor") {
    return {
      name: "Subcontractor Portal",
      initials: "SE",
      cssVar: "var(--subcontractor)",
    };
  }
  if (option.clientSubtype === "residential") {
    return {
      name: "Homeowner Portal",
      initials: "HO",
      cssVar: "var(--residential)",
    };
  }
  return { name: "Client Portal", initials: "CL", cssVar: "var(--commercial)" };
}
