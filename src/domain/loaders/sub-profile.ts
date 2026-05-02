import { and, eq, inArray } from "drizzle-orm";

import { dbAdmin } from "@/db/admin-pool";
import {
  organizations,
  organizationUsers,
  projectOrganizationMemberships,
  projects,
  users,
} from "@/db/schema";
import { lookupRbqLicense } from "@/lib/integrations/rbq";
import type { RbqLookupResult } from "@/lib/integrations/rbq";

// Step 66 — Sub profile loader (RBQ context).
//
// Returns the data the contractor `/subcontractors/[subOrgId]` page
// needs. Primary feature is the RBQ widget; identity + assignments
// are surfaced for context but kept light so this loader stays scoped
// to the Step 66 surface.
//
// Authorization is at the route layer: contractor admins / PMs only.
// This loader uses dbAdmin (cross-org reads to look up the sub's
// public org row, even if the contractor isn't a member of the sub).

export type SubProfileView = {
  subOrg: {
    id: string;
    name: string;
    legalName: string | null;
    primaryTrade: string | null;
    rbqNumber: string | null;
    primaryContactName: string | null;
    primaryContactTitle: string | null;
    primaryContactEmail: string | null;
    primaryContactPhone: string | null;
    addr1: string | null;
    city: string | null;
    stateRegion: string | null;
    postalCode: string | null;
    yearsInBusiness: string | null;
    crewSize: string | null;
  };
  // RBQ cache row for the sub's number, if any. Null when the sub has
  // no rbqNumber on file or when the cache has never been probed.
  rbq: RbqLookupResult | null;
  // Active assignments — projects this sub is currently a member of
  // that the contractor org also has access to. Used to surface the
  // "active assignments" side card and to determine if the *current*
  // project is in Quebec for the province-gated UI.
  activeAssignments: Array<{
    projectId: string;
    projectName: string;
    provinceCode: string | null;
    city: string | null;
  }>;
  // Whether the contractor has at least one Quebec-province project
  // with this sub. Drives whether the RBQ widget renders at all.
  hasQuebecProject: boolean;
  joinedAt: Date | null;
};

export async function loadSubProfileView(
  subOrgId: string,
  contractorOrgId: string,
): Promise<SubProfileView | null> {
  const orgRows = await dbAdmin
    .select()
    .from(organizations)
    .where(eq(organizations.id, subOrgId))
    .limit(1);

  if (orgRows.length === 0) return null;
  const org = orgRows[0];

  // Active project memberships where BOTH the contractor and the sub
  // are members. Two-step query: find sub's projects, then filter to
  // those the contractor is also on.
  const subMemberships = await dbAdmin
    .select({
      projectId: projectOrganizationMemberships.projectId,
    })
    .from(projectOrganizationMemberships)
    .where(eq(projectOrganizationMemberships.organizationId, subOrgId));

  const projectIds = subMemberships.map((m) => m.projectId);

  let activeAssignments: SubProfileView["activeAssignments"] = [];
  let hasQuebecProject = false;

  if (projectIds.length > 0) {
    const sharedProjects = await dbAdmin
      .select({
        projectId: projectOrganizationMemberships.projectId,
      })
      .from(projectOrganizationMemberships)
      .where(
        and(
          eq(projectOrganizationMemberships.organizationId, contractorOrgId),
          inArray(projectOrganizationMemberships.projectId, projectIds),
        ),
      );

    const sharedIds = sharedProjects.map((p) => p.projectId);
    if (sharedIds.length > 0) {
      const projectRows = await dbAdmin
        .select({
          id: projects.id,
          name: projects.name,
          provinceCode: projects.provinceCode,
          city: projects.city,
        })
        .from(projects)
        .where(inArray(projects.id, sharedIds));

      activeAssignments = projectRows.map((p) => ({
        projectId: p.id,
        projectName: p.name,
        provinceCode: p.provinceCode,
        city: p.city,
      }));
      hasQuebecProject = projectRows.some((p) => p.provinceCode === "QC");
    }
  }

  let rbq: RbqLookupResult | null = null;
  if (org.rbqNumber) {
    rbq = await lookupRbqLicense(org.rbqNumber);
  }

  // Earliest organization_users.createdAt for this sub — proxy for
  // "joined our network" timestamp shown in the profile header.
  const oldestMember = await dbAdmin
    .select({ createdAt: organizationUsers.createdAt })
    .from(organizationUsers)
    .where(eq(organizationUsers.organizationId, subOrgId))
    .orderBy(organizationUsers.createdAt)
    .limit(1);

  return {
    subOrg: {
      id: org.id,
      name: org.name,
      legalName: org.legalName,
      primaryTrade: org.primaryTrade,
      rbqNumber: org.rbqNumber,
      primaryContactName: org.primaryContactName,
      primaryContactTitle: org.primaryContactTitle,
      primaryContactEmail: org.primaryContactEmail,
      primaryContactPhone: org.primaryContactPhone,
      addr1: org.addr1,
      city: org.city,
      stateRegion: org.stateRegion,
      postalCode: org.postalCode,
      yearsInBusiness: org.yearsInBusiness,
      crewSize: org.crewSize,
    },
    rbq,
    activeAssignments,
    hasQuebecProject,
    joinedAt: oldestMember[0]?.createdAt ?? null,
  };
}

// Suppress unused-import warning for `users` — kept for future use
// when the loader expands to include primary contact resolution via
// the users table.
void users;
