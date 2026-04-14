/**
 * Deterministic test fixture for BuiltCRM's integration test suite.
 *
 * Layout:
 *   - 1 contractor org (Summit) that owns both projects
 *   - 1 subcontractor org, 1 commercial-client org, 1 residential household
 *   - 4 users, one per portal role
 *   - Project A: all 4 users have project_user_memberships
 *   - Project B: only the contractor has implicit access (no explicit rows
 *     for sub/clients, so they must be blocked by getEffectiveContext)
 *   - Per Project A: one SOV + 5 lines, one draft draw, one document
 *
 * The fixture uses fixed UUIDs so test helpers can reference IDs directly.
 * globalSetup purges rows keyed by these IDs before inserting, so re-runs
 * are idempotent and leave unrelated dev data alone.
 */

import { inArray } from "drizzle-orm";

import { db } from "@/db/client";
import {
  auditEvents,
  authAccount,
  authUser,
  changeOrders,
  conversations,
  documentLinks,
  documents,
  drawLineItems,
  drawRequests,
  lienWaivers,
  organizations,
  organizationUsers,
  projectOrganizationMemberships,
  projectUserMemberships,
  projects,
  rfis,
  roleAssignments,
  scheduleOfValues,
  sovLineItems,
  users,
} from "@/db/schema";

// -----------------------------------------------------------------------
// Fixed IDs
// -----------------------------------------------------------------------

export const IDS = {
  orgs: {
    contractor: "11111111-0000-0000-0000-000000000001",
    subcontractor: "11111111-0000-0000-0000-000000000002",
    commercialClient: "11111111-0000-0000-0000-000000000003",
    residentialHousehold: "11111111-0000-0000-0000-000000000004",
  },
  users: {
    contractorAdmin: "22222222-0000-0000-0000-000000000001",
    subcontractor: "22222222-0000-0000-0000-000000000002",
    commercialClient: "22222222-0000-0000-0000-000000000003",
    residentialClient: "22222222-0000-0000-0000-000000000004",
  },
  roles: {
    contractorAdmin: "33333333-0000-0000-0000-000000000001",
    subcontractor: "33333333-0000-0000-0000-000000000002",
    commercialClient: "33333333-0000-0000-0000-000000000003",
    residentialClient: "33333333-0000-0000-0000-000000000004",
  },
  projects: {
    projectA: "44444444-0000-0000-0000-000000000001",
    projectB: "44444444-0000-0000-0000-000000000002",
  },
  sov: {
    projectA: "55555555-0000-0000-0000-000000000001",
  },
  sovLines: {
    a1: "66666666-0000-0000-0000-000000000001",
    a2: "66666666-0000-0000-0000-000000000002",
    a3: "66666666-0000-0000-0000-000000000003",
    a4: "66666666-0000-0000-0000-000000000004",
    a5: "66666666-0000-0000-0000-000000000005",
  },
  draw: {
    projectA: "77777777-0000-0000-0000-000000000001",
  },
  document: {
    projectA: "88888888-0000-0000-0000-000000000001",
  },
} as const;

const allProjectIds = [IDS.projects.projectA, IDS.projects.projectB];
const allOrgIds = Object.values(IDS.orgs);
const allUserIds = Object.values(IDS.users);

// -----------------------------------------------------------------------
// Purge
// -----------------------------------------------------------------------

async function purge() {
  // Order matters — peel back dependents before roots. Anything fk'd to
  // projects will cascade on project delete, but audit_events and
  // authUser/authAccount are not cascaded from projects, so clean
  // explicitly.
  await db.delete(auditEvents).where(inArray(auditEvents.projectId, allProjectIds));
  await db.delete(lienWaivers).where(inArray(lienWaivers.projectId, allProjectIds));
  await db.delete(drawLineItems).where(inArray(drawLineItems.drawRequestId, [IDS.draw.projectA]));
  await db.delete(drawRequests).where(inArray(drawRequests.projectId, allProjectIds));
  await db.delete(sovLineItems).where(inArray(sovLineItems.sovId, [IDS.sov.projectA]));
  await db.delete(scheduleOfValues).where(inArray(scheduleOfValues.projectId, allProjectIds));
  await db.delete(changeOrders).where(inArray(changeOrders.projectId, allProjectIds));
  await db.delete(rfis).where(inArray(rfis.projectId, allProjectIds));
  await db.delete(documentLinks).where(inArray(documentLinks.linkedObjectId, allProjectIds));
  await db.delete(documents).where(inArray(documents.projectId, allProjectIds));
  await db.delete(conversations).where(inArray(conversations.projectId, allProjectIds));
  await db.delete(projectUserMemberships).where(inArray(projectUserMemberships.projectId, allProjectIds));
  await db
    .delete(projectOrganizationMemberships)
    .where(inArray(projectOrganizationMemberships.projectId, allProjectIds));
  await db.delete(projects).where(inArray(projects.id, allProjectIds));
  await db.delete(roleAssignments).where(inArray(roleAssignments.userId, allUserIds));
  await db.delete(organizationUsers).where(inArray(organizationUsers.userId, allUserIds));
  await db.delete(authAccount).where(inArray(authAccount.userId, allUserIds));
  await db.delete(authUser).where(inArray(authUser.appUserId, allUserIds));
  await db.delete(users).where(inArray(users.id, allUserIds));
  await db.delete(organizations).where(inArray(organizations.id, allOrgIds));
}

// -----------------------------------------------------------------------
// Seed
// -----------------------------------------------------------------------

export async function seedFixture() {
  await purge();

  // Orgs
  await db.insert(organizations).values([
    { id: IDS.orgs.contractor, name: "Test Summit Contracting", organizationType: "contractor" },
    { id: IDS.orgs.subcontractor, name: "Test Northline Electrical", organizationType: "subcontractor" },
    { id: IDS.orgs.commercialClient, name: "Test Meridian Properties", organizationType: "client_company" },
    { id: IDS.orgs.residentialHousehold, name: "Test Harper Household", organizationType: "household" },
  ]);

  // Users
  await db.insert(users).values([
    {
      id: IDS.users.contractorAdmin,
      email: "test.contractor@example.test",
      firstName: "Test",
      lastName: "Contractor",
      displayName: "Test Contractor",
    },
    {
      id: IDS.users.subcontractor,
      email: "test.sub@example.test",
      firstName: "Test",
      lastName: "Sub",
      displayName: "Test Sub",
    },
    {
      id: IDS.users.commercialClient,
      email: "test.commercial@example.test",
      firstName: "Test",
      lastName: "Commercial",
      displayName: "Test Commercial",
    },
    {
      id: IDS.users.residentialClient,
      email: "test.residential@example.test",
      firstName: "Test",
      lastName: "Residential",
      displayName: "Test Residential",
    },
  ]);

  // Organization memberships
  await db.insert(organizationUsers).values([
    {
      organizationId: IDS.orgs.contractor,
      userId: IDS.users.contractorAdmin,
      jobTitle: "Admin",
      membershipStatus: "active",
    },
    {
      organizationId: IDS.orgs.subcontractor,
      userId: IDS.users.subcontractor,
      jobTitle: "Lead",
      membershipStatus: "active",
    },
    {
      organizationId: IDS.orgs.commercialClient,
      userId: IDS.users.commercialClient,
      jobTitle: "Owner Rep",
      membershipStatus: "active",
    },
    {
      organizationId: IDS.orgs.residentialHousehold,
      userId: IDS.users.residentialClient,
      jobTitle: "Homeowner",
      membershipStatus: "active",
    },
  ]);

  // Role assignments
  await db.insert(roleAssignments).values([
    {
      id: IDS.roles.contractorAdmin,
      userId: IDS.users.contractorAdmin,
      organizationId: IDS.orgs.contractor,
      portalType: "contractor",
      roleKey: "admin",
      isPrimary: true,
    },
    {
      id: IDS.roles.subcontractor,
      userId: IDS.users.subcontractor,
      organizationId: IDS.orgs.subcontractor,
      portalType: "subcontractor",
      roleKey: "lead",
      isPrimary: true,
    },
    {
      id: IDS.roles.commercialClient,
      userId: IDS.users.commercialClient,
      organizationId: IDS.orgs.commercialClient,
      portalType: "client",
      roleKey: "owner_rep",
      clientSubtype: "commercial",
      isPrimary: true,
    },
    {
      id: IDS.roles.residentialClient,
      userId: IDS.users.residentialClient,
      organizationId: IDS.orgs.residentialHousehold,
      portalType: "client",
      roleKey: "homeowner",
      clientSubtype: "residential",
      isPrimary: true,
    },
  ]);

  // Projects
  await db.insert(projects).values([
    {
      id: IDS.projects.projectA,
      name: "Test Project A — All Portals",
      projectCode: "TEST-A",
      projectType: "commercial_renovation",
      clientSubtype: "commercial",
      projectStatus: "active",
      currentPhase: "phase_2",
      startDate: new Date("2026-01-01T00:00:00Z"),
      targetCompletionDate: new Date("2026-12-31T00:00:00Z"),
      contractorOrganizationId: IDS.orgs.contractor,
      contractValueCents: 100_000_000,
      addressLine1: "1 Test St",
      city: "Vancouver",
      stateProvince: "BC",
      postalCode: "V1A 1A1",
      country: "CA",
    },
    {
      id: IDS.projects.projectB,
      name: "Test Project B — Contractor Only",
      projectCode: "TEST-B",
      projectType: "commercial_renovation",
      clientSubtype: "commercial",
      projectStatus: "active",
      currentPhase: "phase_1",
      startDate: new Date("2026-01-01T00:00:00Z"),
      targetCompletionDate: new Date("2026-12-31T00:00:00Z"),
      contractorOrganizationId: IDS.orgs.contractor,
      contractValueCents: 50_000_000,
      addressLine1: "2 Test St",
      city: "Vancouver",
      stateProvince: "BC",
      postalCode: "V1A 1A2",
      country: "CA",
    },
  ]);

  // Project-user memberships: Project A has all four roles, Project B has
  // none (contractor relies on the org-staff fallback in getEffectiveContext).
  await db.insert(projectUserMemberships).values([
    {
      projectId: IDS.projects.projectA,
      userId: IDS.users.contractorAdmin,
      organizationId: IDS.orgs.contractor,
      roleAssignmentId: IDS.roles.contractorAdmin,
      membershipStatus: "active",
      accessState: "active",
    },
    {
      projectId: IDS.projects.projectA,
      userId: IDS.users.subcontractor,
      organizationId: IDS.orgs.subcontractor,
      roleAssignmentId: IDS.roles.subcontractor,
      membershipStatus: "active",
      accessState: "active",
    },
    {
      projectId: IDS.projects.projectA,
      userId: IDS.users.commercialClient,
      organizationId: IDS.orgs.commercialClient,
      roleAssignmentId: IDS.roles.commercialClient,
      membershipStatus: "active",
      accessState: "active",
    },
    {
      projectId: IDS.projects.projectA,
      userId: IDS.users.residentialClient,
      organizationId: IDS.orgs.residentialHousehold,
      roleAssignmentId: IDS.roles.residentialClient,
      membershipStatus: "active",
      accessState: "active",
    },
  ]);

  // SOV + 5 lines on Project A
  await db.insert(scheduleOfValues).values({
    id: IDS.sov.projectA,
    projectId: IDS.projects.projectA,
    version: 1,
    sovStatus: "active",
    totalScheduledValueCents: 100_000_000,
    totalOriginalContractCents: 100_000_000,
    totalChangeOrdersCents: 0,
    defaultRetainagePercent: 10,
  });

  const lineIds = [
    IDS.sovLines.a1,
    IDS.sovLines.a2,
    IDS.sovLines.a3,
    IDS.sovLines.a4,
    IDS.sovLines.a5,
  ];
  await db.insert(sovLineItems).values(
    lineIds.map((id, i) => ({
      id,
      sovId: IDS.sov.projectA,
      itemNumber: String(i + 1).padStart(2, "0"),
      costCode: "00-00",
      description: `Test line ${i + 1}`,
      lineItemType: "original" as const,
      scheduledValueCents: 20_000_000,
      sortOrder: i,
    })),
  );

  // Draft draw — starts in "draft" so the state-machine test can walk
  // forward. beforeEach resets status to "draft" between transition tests.
  await db.insert(drawRequests).values({
    id: IDS.draw.projectA,
    projectId: IDS.projects.projectA,
    sovId: IDS.sov.projectA,
    drawNumber: 1,
    periodFrom: new Date("2026-03-01T00:00:00Z"),
    periodTo: new Date("2026-03-31T00:00:00Z"),
    drawRequestStatus: "draft",
    originalContractSumCents: 100_000_000,
    netChangeOrdersCents: 0,
    contractSumToDateCents: 100_000_000,
    totalCompletedToDateCents: 20_000_000,
    retainageOnCompletedCents: 2_000_000,
    retainageOnStoredCents: 0,
    totalRetainageCents: 2_000_000,
    totalEarnedLessRetainageCents: 18_000_000,
    previousCertificatesCents: 0,
    currentPaymentDueCents: 18_000_000,
    balanceToFinishCents: 82_000_000,
    createdByUserId: IDS.users.contractorAdmin,
  });

  await db.insert(drawLineItems).values({
    drawRequestId: IDS.draw.projectA,
    sovLineItemId: IDS.sovLines.a1,
    workCompletedPreviousCents: 0,
    workCompletedThisPeriodCents: 20_000_000,
    materialsPresentlyStoredCents: 0,
    totalCompletedStoredToDateCents: 20_000_000,
    retainageCents: 2_000_000,
    retainagePercentApplied: 10,
    percentCompleteBasisPoints: 10_000,
    balanceToFinishCents: 0,
  });

  // One document on Project A — used by the files/download test.
  await db.insert(documents).values({
    id: IDS.document.projectA,
    projectId: IDS.projects.projectA,
    documentType: "general",
    title: "Test seeded document",
    storageKey: `${IDS.orgs.contractor}/${IDS.projects.projectA}/general/seed.pdf`,
    uploadedByUserId: IDS.users.contractorAdmin,
    visibilityScope: "project_wide",
    audienceScope: "internal",
    documentStatus: "active",
  });
}

// Helpers used by individual tests to reset mutable state between cases.

export async function resetDrawToDraft() {
  await db.delete(lienWaivers).where(inArray(lienWaivers.drawRequestId, [IDS.draw.projectA]));
  await db.delete(auditEvents).where(inArray(auditEvents.objectId, [IDS.draw.projectA]));
  const { eq } = await import("drizzle-orm");
  await db
    .update(drawRequests)
    .set({
      drawRequestStatus: "draft",
      submittedAt: null,
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNote: null,
      returnedAt: null,
      returnReason: null,
      paidAt: null,
      paymentReferenceName: null,
    })
    .where(eq(drawRequests.id, IDS.draw.projectA));
}
