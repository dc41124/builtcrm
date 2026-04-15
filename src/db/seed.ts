/**
 * Idempotent dev seed for BuiltCRM.
 * Run: npm run db:seed
 *
 * Populates two projects (commercial + residential) with realistic Canadian
 * construction data across all core modules. Re-running upserts by natural
 * keys (email, org name, project code, sequential numbers) instead of
 * inserting duplicates.
 */

import { and, eq, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "node:crypto";

import { db } from "./client";
import {
  users,
  authUser,
  authAccount,
  organizations,
  organizationUsers,
  roleAssignments,
  projects,
  projectOrganizationMemberships,
  projectUserMemberships,
  milestones,
  documents,
  rfis,
  changeOrders,
  approvals,
  uploadRequests,
  complianceRecords,
  scheduleOfValues,
  sovLineItems,
  drawRequests,
  drawLineItems,
  conversations,
  conversationParticipants,
  messages,
} from "./schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function upsert<TTable extends PgTable, TValues extends Record<string, unknown>>(
  table: TTable,
  where: SQL,
  values: TValues,
): Promise<any> {
  const existing = await db.select().from(table as any).where(where).limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db.insert(table as any).values(values as any).returning();
  return row;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

function assertNonProductionTarget() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV=production.");
  }
  if (process.env.ALLOW_PROD_SEED === "1") {
    console.warn("⚠ ALLOW_PROD_SEED=1 set — bypassing database URL guard.");
    return;
  }
  const url = process.env.DATABASE_URL ?? "";
  const lower = url.toLowerCase();
  const prodMarkers = ["prod", "production", "live"];
  const devMarkers = ["dev", "develop", "development", "local", "localhost", "staging", "preview", "branch"];
  const looksProd = prodMarkers.some((m) => lower.includes(m));
  const looksDev = devMarkers.some((m) => lower.includes(m));
  if (looksProd && !looksDev) {
    throw new Error(
      "Refusing to seed: DATABASE_URL looks like a production target. " +
        "Set ALLOW_PROD_SEED=1 to override (not recommended).",
    );
  }
  if (!looksDev) {
    console.warn(
      "⚠ DATABASE_URL has no dev/local/staging marker — proceeding anyway. " +
        "Name your Neon dev branch with 'dev' or 'local' to enable the guard.",
    );
  }
}

async function seed() {
  assertNonProductionTarget();
  console.log("→ Seeding BuiltCRM dev data...");

  // ---- Users ------------------------------------------------------------
  const summitAdmin = await upsert(users, eq(users.email, "rachel.okafor@summitcontracting.ca"), {
    email: "rachel.okafor@summitcontracting.ca",
    firstName: "Rachel",
    lastName: "Okafor",
    displayName: "Rachel Okafor",
    phone: "+1-604-555-0142",
  });

  const summitPm = await upsert(users, eq(users.email, "devon.tremblay@summitcontracting.ca"), {
    email: "devon.tremblay@summitcontracting.ca",
    firstName: "Devon",
    lastName: "Tremblay",
    displayName: "Devon Tremblay",
    phone: "+1-604-555-0118",
  });

  const northlineUser = await upsert(users, eq(users.email, "marcus.chen@northlineelectrical.ca"), {
    email: "marcus.chen@northlineelectrical.ca",
    firstName: "Marcus",
    lastName: "Chen",
    displayName: "Marcus Chen",
    phone: "+1-604-555-0233",
  });

  const pacificUser = await upsert(users, eq(users.email, "siobhan.murphy@pacificplumbing.ca"), {
    email: "siobhan.murphy@pacificplumbing.ca",
    firstName: "Siobhan",
    lastName: "Murphy",
    displayName: "Siobhan Murphy",
    phone: "+1-604-555-0471",
  });

  const meridianUser = await upsert(users, eq(users.email, "priya.vasquez@meridianproperties.ca"), {
    email: "priya.vasquez@meridianproperties.ca",
    firstName: "Priya",
    lastName: "Vasquez",
    displayName: "Priya Vasquez",
    phone: "+1-604-555-0389",
  });

  const residentialUser = await upsert(users, eq(users.email, "emily.harper@gmail.com"), {
    email: "emily.harper@gmail.com",
    firstName: "Emily",
    lastName: "Harper",
    displayName: "Emily Harper",
    phone: "+1-604-555-0826",
  });

  // ---- Organizations ----------------------------------------------------
  const summitOrg = await upsert(organizations, eq(organizations.name, "Summit Contracting"), {
    name: "Summit Contracting",
    organizationType: "contractor" as const,
  });

  const northlineOrg = await upsert(organizations, eq(organizations.name, "Northline Electrical"), {
    name: "Northline Electrical",
    organizationType: "subcontractor" as const,
  });

  const pacificOrg = await upsert(organizations, eq(organizations.name, "Pacific Plumbing"), {
    name: "Pacific Plumbing",
    organizationType: "subcontractor" as const,
  });

  const meridianOrg = await upsert(organizations, eq(organizations.name, "Meridian Properties"), {
    name: "Meridian Properties",
    organizationType: "client_company" as const,
  });

  // Residential clients still need an org (household) — role_assignments.organizationId is NOT NULL.
  const harperHousehold = await upsert(organizations, eq(organizations.name, "Harper Household"), {
    name: "Harper Household",
    organizationType: "household" as const,
  });

  // ---- Organization memberships ----------------------------------------
  const orgUserPairs: Array<[string, string, string]> = [
    [summitOrg.id, summitAdmin.id, "Principal / Owner"],
    [summitOrg.id, summitPm.id, "Senior Project Manager"],
    [northlineOrg.id, northlineUser.id, "Operations Lead"],
    [pacificOrg.id, pacificUser.id, "Field Supervisor"],
    [meridianOrg.id, meridianUser.id, "Director of Asset Management"],
    [harperHousehold.id, residentialUser.id, "Homeowner"],
  ];
  for (const [orgId, userId, jobTitle] of orgUserPairs) {
    await upsert(
      organizationUsers,
      and(eq(organizationUsers.organizationId, orgId), eq(organizationUsers.userId, userId))!,
      { organizationId: orgId, userId, jobTitle, membershipStatus: "active" as const },
    );
  }

  // ---- Role assignments -------------------------------------------------
  async function getRole(
    userId: string,
    organizationId: string,
    portalType: "contractor" | "subcontractor" | "client",
    roleKey: string,
    clientSubtype: "commercial" | "residential" | null,
    isPrimary = true,
  ) {
    return upsert(
      roleAssignments,
      and(
        eq(roleAssignments.userId, userId),
        eq(roleAssignments.organizationId, organizationId),
        eq(roleAssignments.portalType, portalType),
        eq(roleAssignments.roleKey, roleKey),
      )!,
      {
        userId,
        organizationId,
        portalType,
        roleKey,
        clientSubtype: clientSubtype ?? undefined,
        isPrimary,
      },
    );
  }

  const roleSummitAdmin = await getRole(summitAdmin.id, summitOrg.id, "contractor", "admin", null);
  const roleSummitPm = await getRole(summitPm.id, summitOrg.id, "contractor", "project_manager", null);
  const roleNorthline = await getRole(northlineUser.id, northlineOrg.id, "subcontractor", "lead", null);
  const rolePacific = await getRole(pacificUser.id, pacificOrg.id, "subcontractor", "lead", null);
  const roleMeridian = await getRole(
    meridianUser.id,
    meridianOrg.id,
    "client",
    "owner_rep",
    "commercial",
  );
  const roleHarper = await getRole(
    residentialUser.id,
    harperHousehold.id,
    "client",
    "homeowner",
    "residential",
  );

  // ---- Projects ---------------------------------------------------------
  const commercial = await upsert(projects, eq(projects.projectCode, "SUM-2026-001"), {
    name: "Meridian Tower Renovation",
    projectCode: "SUM-2026-001",
    projectType: "commercial_renovation",
    clientSubtype: "commercial" as const,
    projectStatus: "active" as const,
    currentPhase: "phase_2" as const,
    startDate: new Date("2026-01-15T00:00:00Z"),
    targetCompletionDate: new Date("2026-11-30T00:00:00Z"),
    contractorOrganizationId: summitOrg.id,
    contractValueCents: 485_000_000, // CAD $4,850,000.00
    addressLine1: "1055 West Georgia Street",
    addressLine2: "Floors 14-17",
    city: "Vancouver",
    stateProvince: "BC",
    postalCode: "V6E 3P3",
    country: "CA",
  });

  const residential = await upsert(projects, eq(projects.projectCode, "SUM-2026-002"), {
    name: "Harper Residence Kitchen Remodel",
    projectCode: "SUM-2026-002",
    projectType: "residential_remodel",
    clientSubtype: "residential" as const,
    projectStatus: "active" as const,
    currentPhase: "phase_1" as const,
    startDate: new Date("2026-03-02T00:00:00Z"),
    targetCompletionDate: new Date("2026-06-15T00:00:00Z"),
    contractorOrganizationId: summitOrg.id,
    contractValueCents: 18_500_000, // CAD $185,000.00
    addressLine1: "2847 Cambie Street",
    city: "Vancouver",
    stateProvince: "BC",
    postalCode: "V5Z 2V2",
    country: "CA",
  });

  // ---- Project-organization memberships --------------------------------
  const orgMemberships: Array<{
    projectId: string;
    organizationId: string;
    membershipType: "contractor" | "subcontractor" | "client" | "consultant";
    workScope?: string;
  }> = [
    { projectId: commercial.id, organizationId: summitOrg.id, membershipType: "contractor" },
    {
      projectId: commercial.id,
      organizationId: northlineOrg.id,
      membershipType: "subcontractor",
      workScope: "Electrical rough-in, panel upgrades, lighting",
    },
    {
      projectId: commercial.id,
      organizationId: pacificOrg.id,
      membershipType: "subcontractor",
      workScope: "Mechanical, domestic water, fixtures",
    },
    { projectId: commercial.id, organizationId: meridianOrg.id, membershipType: "client" },
    { projectId: residential.id, organizationId: summitOrg.id, membershipType: "contractor" },
    {
      projectId: residential.id,
      organizationId: pacificOrg.id,
      membershipType: "subcontractor",
      workScope: "Kitchen plumbing rough-in and fixture installation",
    },
    { projectId: residential.id, organizationId: harperHousehold.id, membershipType: "client" },
  ];
  for (const m of orgMemberships) {
    await upsert(
      projectOrganizationMemberships,
      and(
        eq(projectOrganizationMemberships.projectId, m.projectId),
        eq(projectOrganizationMemberships.organizationId, m.organizationId),
      )!,
      { ...m, membershipStatus: "active" as const },
    );
  }

  // ---- Project-user memberships ----------------------------------------
  const userMemberships = [
    { projectId: commercial.id, userId: summitAdmin.id, organizationId: summitOrg.id, roleAssignmentId: roleSummitAdmin.id },
    { projectId: commercial.id, userId: summitPm.id, organizationId: summitOrg.id, roleAssignmentId: roleSummitPm.id },
    { projectId: commercial.id, userId: northlineUser.id, organizationId: northlineOrg.id, roleAssignmentId: roleNorthline.id },
    { projectId: commercial.id, userId: pacificUser.id, organizationId: pacificOrg.id, roleAssignmentId: rolePacific.id },
    { projectId: commercial.id, userId: meridianUser.id, organizationId: meridianOrg.id, roleAssignmentId: roleMeridian.id },
    { projectId: residential.id, userId: summitPm.id, organizationId: summitOrg.id, roleAssignmentId: roleSummitPm.id },
    { projectId: residential.id, userId: pacificUser.id, organizationId: pacificOrg.id, roleAssignmentId: rolePacific.id },
    { projectId: residential.id, userId: residentialUser.id, organizationId: harperHousehold.id, roleAssignmentId: roleHarper.id },
  ];
  for (const um of userMemberships) {
    await upsert(
      projectUserMemberships,
      and(
        eq(projectUserMemberships.projectId, um.projectId),
        eq(projectUserMemberships.userId, um.userId),
        eq(projectUserMemberships.organizationId, um.organizationId),
      )!,
      { ...um, membershipStatus: "active" as const, accessState: "active" as const },
    );
  }

  // ---- Compliance records (per subcontractor org) ----------------------
  const complianceRows = [
    {
      organizationId: northlineOrg.id,
      complianceType: "WCB Clearance Letter (BC)",
      complianceStatus: "active" as const,
      expiresAt: new Date("2026-12-31T00:00:00Z"),
    },
    {
      organizationId: northlineOrg.id,
      complianceType: "Commercial General Liability ($5M)",
      complianceStatus: "active" as const,
      expiresAt: new Date("2026-10-14T00:00:00Z"),
    },
    {
      organizationId: pacificOrg.id,
      complianceType: "WCB Clearance Letter (BC)",
      complianceStatus: "active" as const,
      expiresAt: new Date("2026-09-30T00:00:00Z"),
    },
    {
      organizationId: pacificOrg.id,
      complianceType: "Commercial General Liability ($5M)",
      complianceStatus: "expired" as const,
      expiresAt: new Date("2026-03-31T00:00:00Z"),
    },
  ];
  for (const c of complianceRows) {
    await upsert(
      complianceRecords,
      and(
        eq(complianceRecords.organizationId, c.organizationId),
        eq(complianceRecords.complianceType, c.complianceType),
      )!,
      c,
    );
  }

  // ---- Per-project content ---------------------------------------------
  await seedProjectContent({
    project: commercial,
    contractorOrgId: summitOrg.id,
    pmUserId: summitPm.id,
    adminUserId: summitAdmin.id,
    clientUserId: meridianUser.id,
    subUserId: northlineUser.id,
    subOrgId: northlineOrg.id,
    residential: false,
  });

  await seedProjectContent({
    project: residential,
    contractorOrgId: summitOrg.id,
    pmUserId: summitPm.id,
    adminUserId: summitPm.id,
    clientUserId: residentialUser.id,
    subUserId: pacificUser.id,
    subOrgId: pacificOrg.id,
    residential: true,
  });

  // ---- Auth credentials (dev only, password123) ------------------------
  // Inserts directly into Better Auth's tables rather than calling the auth
  // API — avoids pulling the Next/auth config into a Node seed script.
  // Password is hashed with the same scrypt helper Better Auth uses at
  // runtime so logins via the real /api/auth/sign-in/email endpoint work.
  const passwordHash = await hashPassword("password123");
  const authSeeds: Array<{ id: string; email: string; displayName: string | null }> = [
    summitAdmin,
    summitPm,
    northlineUser,
    pacificUser,
    meridianUser,
    residentialUser,
  ];
  for (const u of authSeeds) {
    const existing = await db
      .select()
      .from(authUser)
      .where(eq(authUser.email, u.email))
      .limit(1);
    if (existing[0]) {
      if (existing[0].appUserId !== u.id) {
        await db.update(authUser).set({ appUserId: u.id }).where(eq(authUser.id, existing[0].id));
      }
      continue;
    }
    const authUserId = randomBytes(16).toString("hex");
    await db.insert(authUser).values({
      id: authUserId,
      email: u.email,
      name: u.displayName ?? u.email,
      emailVerified: true,
      appUserId: u.id,
    });
    await db.insert(authAccount).values({
      id: randomBytes(16).toString("hex"),
      userId: authUserId,
      accountId: authUserId,
      providerId: "credential",
      password: passwordHash,
    });
  }

  console.log("✓ Seed complete.");
}

// ---------------------------------------------------------------------------
// Per-project content
// ---------------------------------------------------------------------------

interface ProjectContext {
  project: { id: string; name: string; contractValueCents: number | null };
  contractorOrgId: string;
  pmUserId: string;
  adminUserId: string;
  clientUserId: string;
  subUserId: string;
  subOrgId: string;
  residential: boolean;
}

async function seedProjectContent(ctx: ProjectContext) {
  const { project, contractorOrgId, pmUserId, clientUserId, subUserId, subOrgId, residential } = ctx;
  const contractCents = project.contractValueCents ?? 0;

  // ---- Documents (5) ---------------------------------------------------
  const docTitles = residential
    ? [
        { title: "Kitchen design drawings rev C", type: "drawing" },
        { title: "Appliance specification package", type: "specification" },
        { title: "Signed fixed-price agreement", type: "contract" },
        { title: "Cabinetry shop drawings", type: "submittal" },
        { title: "Pre-demo walkthrough photos", type: "photo_log" },
      ]
    : [
        { title: "Architectural drawing set rev 4", type: "drawing" },
        { title: "Division 26 specifications", type: "specification" },
        { title: "Signed master services agreement", type: "contract" },
        { title: "Mechanical submittal package 03", type: "submittal" },
        { title: "Phase 2 progress photo set", type: "photo_log" },
      ];

  const docIds: string[] = [];
  for (let i = 0; i < docTitles.length; i++) {
    const d = docTitles[i];
    const storageKey = `seed/${project.id}/documents/${i + 1}-${d.type}.pdf`;
    const doc = await upsert(documents, eq(documents.storageKey, storageKey), {
      projectId: project.id,
      documentType: d.type,
      title: d.title,
      storageKey,
      uploadedByUserId: pmUserId,
      visibilityScope: "project_wide" as const,
      audienceScope: residential ? ("residential_client" as const) : ("commercial_client" as const),
      documentStatus: "active" as const,
    });
    docIds.push(doc.id);
  }

  // ---- Milestones (2) --------------------------------------------------
  const milestoneRows = residential
    ? [
        { title: "Cabinet delivery", type: "delivery" as const, daysOut: 21 },
        { title: "Final homeowner walkthrough", type: "walkthrough" as const, daysOut: 70 },
      ]
    : [
        { title: "Mechanical rough-in inspection", type: "inspection" as const, daysOut: 14 },
        { title: "Phase 2 substantial completion", type: "completion" as const, daysOut: 120 },
      ];
  for (let i = 0; i < milestoneRows.length; i++) {
    const m = milestoneRows[i];
    const scheduledDate = new Date(Date.now() + m.daysOut * 86400000);
    const existing = await db
      .select()
      .from(milestones)
      .where(and(eq(milestones.projectId, project.id), eq(milestones.title, m.title))!)
      .limit(1);
    if (!existing[0]) {
      await db.insert(milestones).values({
        projectId: project.id,
        title: m.title,
        milestoneType: m.type,
        milestoneStatus: "scheduled",
        scheduledDate,
        sortOrder: i,
        assignedToUserId: pmUserId,
      });
    }
  }

  // ---- Project-scoped compliance records (4) ---------------------------
  const complianceSeeds = [
    {
      complianceType: "Commercial General Liability ($5M)",
      complianceStatus: "pending" as const,
      expiresAt: new Date(Date.now() + 6 * 86400000),
      hasDoc: true,
    },
    {
      complianceType: "WCB Clearance Letter (BC)",
      complianceStatus: "pending" as const,
      expiresAt: new Date(Date.now() + 2 * 86400000),
      hasDoc: false,
    },
    {
      complianceType: "Site orientation roster",
      complianceStatus: "rejected" as const,
      expiresAt: null,
      hasDoc: false,
    },
    {
      complianceType: "Safety training records",
      complianceStatus: "active" as const,
      expiresAt: new Date(Date.now() + 75 * 86400000),
      hasDoc: true,
    },
  ];
  for (const c of complianceSeeds) {
    const existing = await db
      .select()
      .from(complianceRecords)
      .where(
        and(
          eq(complianceRecords.projectId, project.id),
          eq(complianceRecords.organizationId, subOrgId),
          eq(complianceRecords.complianceType, c.complianceType),
        )!,
      )
      .limit(1);
    if (!existing[0]) {
      await db.insert(complianceRecords).values({
        projectId: project.id,
        organizationId: subOrgId,
        complianceType: c.complianceType,
        complianceStatus: c.complianceStatus,
        expiresAt: c.expiresAt,
        documentId: c.hasDoc ? docIds[0] : null,
      });
    }
  }

  // ---- RFIs (3) --------------------------------------------------------
  const rfiRows = residential
    ? [
        { subject: "Confirm island waste line routing", body: "Existing slab has unknown obstructions — need confirmation on preferred routing before cutting." },
        { subject: "Undercabinet lighting wattage", body: "Homeowner selected LED tape exceeds spec draw. Confirm transformer sizing." },
        { subject: "Countertop seam location", body: "Requesting approval to relocate seam 6 inches left of original layout." },
      ]
    : [
        { subject: "Slab penetration coordination - Level 15", body: "Mechanical and electrical both require core drilling in grid D/4. Need coordinated layout." },
        { subject: "Fire-rated ceiling assembly substitution", body: "Submitted product does not match spec assembly. Requesting approval for equivalent." },
        { subject: "Existing conduit routing discrepancy", body: "Record drawings show 2\" EMT that is not present. Confirm new routing." },
      ];
  for (let i = 0; i < rfiRows.length; i++) {
    const r = rfiRows[i];
    const seq = i + 1;
    const existing = await db
      .select()
      .from(rfis)
      .where(and(eq(rfis.projectId, project.id), eq(rfis.sequentialNumber, seq))!)
      .limit(1);
    if (!existing[0]) {
      await db.insert(rfis).values({
        projectId: project.id,
        sequentialNumber: seq,
        subject: r.subject,
        body: r.body,
        rfiStatus: i === 0 ? "answered" : "open",
        createdByUserId: subUserId,
        assignedToUserId: pmUserId,
        assignedToOrganizationId: contractorOrgId,
        dueAt: new Date(Date.now() + (5 + i * 3) * 86400000),
      });
    }
  }

  // ---- Change orders (2) -----------------------------------------------
  const coRows = residential
    ? [
        { title: "Upgrade to quartzite countertops", amount: 420_000, reason: "Homeowner selection change from original quartz spec." },
        { title: "Add pot filler and rough-in", amount: 185_000, reason: "New scope addition requested during demo." },
      ]
    : [
        { title: "Additional demising wall - Level 16", amount: 4_850_000, reason: "Tenant layout revision requires new partition." },
        { title: "Upgrade panel to 400A service", amount: 3_120_000, reason: "Load calculation revision after tenant equipment review." },
      ];
  for (let i = 0; i < coRows.length; i++) {
    const c = coRows[i];
    const num = i + 1;
    const existing = await db
      .select()
      .from(changeOrders)
      .where(and(eq(changeOrders.projectId, project.id), eq(changeOrders.changeOrderNumber, num))!)
      .limit(1);
    if (!existing[0]) {
      await db.insert(changeOrders).values({
        projectId: project.id,
        changeOrderNumber: num,
        title: c.title,
        description: c.reason,
        reason: c.reason,
        amountCents: c.amount,
        changeOrderStatus: i === 0 ? "approved" : "pending_client_approval",
        requestedByUserId: pmUserId,
        approvedByUserId: i === 0 ? clientUserId : null,
        approvedAt: i === 0 ? new Date(Date.now() - 7 * 86400000) : null,
        submittedAt: new Date(Date.now() - 10 * 86400000),
      });
    }
  }

  // ---- Approvals (cross-type queue) ------------------------------------
  const day = 86400000;
  type ApprovalSeed = {
    category: "general" | "design" | "procurement" | "change_order" | "other";
    title: string;
    description: string;
    approvalStatus: "pending_review" | "approved" | "rejected" | "needs_revision";
    impactCostCents: number;
    impactScheduleDays: number;
    submittedDaysAgo: number;
    decidedDaysAgo: number | null;
  };

  const approvalRows: ApprovalSeed[] = residential
    ? [
        {
          category: "general",
          title: "Weekend work for concrete pour",
          description:
            "Builder is asking if Saturday work is OK to keep the foundation pour on schedule before Monday's inspection.",
          approvalStatus: "pending_review",
          impactCostCents: 0,
          impactScheduleDays: -3,
          submittedDaysAgo: 1,
          decidedDaysAgo: null,
        },
        {
          category: "procurement",
          title: "Foundation material substitution",
          description:
            "Swapped to a locally-available concrete mix that performs the same but ships faster.",
          approvalStatus: "approved",
          impactCostCents: 0,
          impactScheduleDays: 0,
          submittedDaysAgo: 15,
          decidedDaysAgo: 13,
        },
        {
          category: "design",
          title: "Extra insulation in attic space",
          description:
            "Added R-30 insulation in the attic for better energy performance.",
          approvalStatus: "approved",
          impactCostCents: 80_000,
          impactScheduleDays: 0,
          submittedDaysAgo: 22,
          decidedDaysAgo: 21,
        },
        {
          category: "change_order",
          title: "Electrical panel upgrade",
          description:
            "Upgraded to a 200A panel to support the planned EV charger installation.",
          approvalStatus: "approved",
          impactCostCents: 120_000,
          impactScheduleDays: 0,
          submittedDaysAgo: 30,
          decidedDaysAgo: 28,
        },
      ]
    : [
        {
          category: "change_order",
          title: "CO-014 mechanical reroute",
          description:
            "HVAC duct reroute caused by structural conflict at level 3. Blocks procurement release.",
          approvalStatus: "pending_review",
          impactCostCents: 1_840_000,
          impactScheduleDays: 3,
          submittedDaysAgo: 5,
          decidedDaysAgo: null,
        },
        {
          category: "procurement",
          title: "Lobby signage fabrication release",
          description:
            "Final confirmation before fabrication begins. Affects lobby handover milestone.",
          approvalStatus: "pending_review",
          impactCostCents: 1_260_000,
          impactScheduleDays: 0,
          submittedDaysAgo: 2,
          decidedDaysAgo: null,
        },
        {
          category: "design",
          title: "Reception area finish package",
          description:
            "Material and finish selections for main reception — wall covering, flooring, millwork accents.",
          approvalStatus: "pending_review",
          impactCostCents: 0,
          impactScheduleDays: 0,
          submittedDaysAgo: 3,
          decidedDaysAgo: null,
        },
        {
          category: "general",
          title: "After-hours work authorization",
          description:
            "Weekend work for concrete pour — needs owner OK to proceed outside standard site hours.",
          approvalStatus: "pending_review",
          impactCostCents: 0,
          impactScheduleDays: -2,
          submittedDaysAgo: 1,
          decidedDaysAgo: null,
        },
        {
          category: "change_order",
          title: "CO-013 electrical panel relocation",
          description:
            "Panel relocation for code compliance. Previously approved by client.",
          approvalStatus: "approved",
          impactCostCents: 720_000,
          impactScheduleDays: 0,
          submittedDaysAgo: 12,
          decidedDaysAgo: 8,
        },
      ];

  for (let i = 0; i < approvalRows.length; i++) {
    const a = approvalRows[i];
    const num = i + 1;
    const existing = await db
      .select()
      .from(approvals)
      .where(and(eq(approvals.projectId, project.id), eq(approvals.approvalNumber, num))!)
      .limit(1);
    if (!existing[0]) {
      await db.insert(approvals).values({
        projectId: project.id,
        approvalNumber: num,
        category: a.category,
        title: a.title,
        description: a.description,
        approvalStatus: a.approvalStatus,
        impactCostCents: a.impactCostCents,
        impactScheduleDays: a.impactScheduleDays,
        requestedByUserId: pmUserId,
        assignedToOrganizationId: null,
        submittedAt: new Date(Date.now() - a.submittedDaysAgo * day),
        decidedByUserId: a.decidedDaysAgo != null ? clientUserId : null,
        decidedAt: a.decidedDaysAgo != null ? new Date(Date.now() - a.decidedDaysAgo * day) : null,
        decisionNote: a.approvalStatus === "approved" ? "Approved as submitted." : null,
        visibilityScope: "client_visible",
      });
    }
  }

  // ---- Upload request (1) ----------------------------------------------
  const urTitle = residential ? "Upload appliance warranty cards" : "Upload updated WCB clearance";
  const urExisting = await db
    .select()
    .from(uploadRequests)
    .where(and(eq(uploadRequests.projectId, project.id), eq(uploadRequests.title, urTitle))!)
    .limit(1);
  if (!urExisting[0]) {
    await db.insert(uploadRequests).values({
      projectId: project.id,
      title: urTitle,
      description: residential
        ? "Please upload warranty documentation for all installed appliances."
        : "Latest WCB clearance letter required before next draw release.",
      requestStatus: "open",
      requestedFromUserId: subUserId,
      requestedFromOrganizationId: subOrgId,
      dueAt: new Date(Date.now() + 7 * 86400000),
      visibilityScope: "project_wide",
    });
  }

  // ---- SOV + Draw request ---------------------------------------------
  let sov = (
    await db.select().from(scheduleOfValues).where(eq(scheduleOfValues.projectId, project.id)).limit(1)
  )[0];
  if (!sov) {
    [sov] = await db
      .insert(scheduleOfValues)
      .values({
        projectId: project.id,
        version: 1,
        sovStatus: "active",
        totalScheduledValueCents: contractCents,
        totalOriginalContractCents: contractCents,
        totalChangeOrdersCents: 0,
        defaultRetainagePercent: 10,
      })
      .returning();
  }

  const lineSpecs = residential
    ? [
        { itemNumber: "01", costCode: "02-41", description: "Demolition and disposal", pct: 0.08 },
        { itemNumber: "02", costCode: "06-41", description: "Cabinetry supply and installation", pct: 0.35 },
        { itemNumber: "03", costCode: "09-30", description: "Tile, flooring, and finishes", pct: 0.22 },
        { itemNumber: "04", costCode: "22-00", description: "Plumbing rough-in and fixtures", pct: 0.20 },
        { itemNumber: "05", costCode: "26-00", description: "Electrical and lighting", pct: 0.15 },
      ]
    : [
        { itemNumber: "01", costCode: "02-41", description: "Selective demolition", pct: 0.06 },
        { itemNumber: "02", costCode: "09-20", description: "Framing and drywall", pct: 0.22 },
        { itemNumber: "03", costCode: "22-00", description: "Mechanical and domestic water", pct: 0.26 },
        { itemNumber: "04", costCode: "26-00", description: "Electrical and lighting", pct: 0.28 },
        { itemNumber: "05", costCode: "09-90", description: "Finishes and millwork", pct: 0.18 },
      ];

  const sovLines: Array<{ id: string; scheduledValueCents: number }> = [];
  for (let i = 0; i < lineSpecs.length; i++) {
    const spec = lineSpecs[i];
    const value = Math.round(contractCents * spec.pct);
    const existing = await db
      .select()
      .from(sovLineItems)
      .where(and(eq(sovLineItems.sovId, sov.id), eq(sovLineItems.itemNumber, spec.itemNumber))!)
      .limit(1);
    let line = existing[0];
    if (!line) {
      [line] = await db
        .insert(sovLineItems)
        .values({
          sovId: sov.id,
          itemNumber: spec.itemNumber,
          costCode: spec.costCode,
          description: spec.description,
          lineItemType: "original",
          scheduledValueCents: value,
          sortOrder: i,
        })
        .returning();
    }
    sovLines.push({ id: line.id, scheduledValueCents: line.scheduledValueCents });
  }

  // Draw #1 — partial completion across first 3 lines
  const drawExisting = await db
    .select()
    .from(drawRequests)
    .where(and(eq(drawRequests.projectId, project.id), eq(drawRequests.drawNumber, 1))!)
    .limit(1);
  if (!drawExisting[0]) {
    // Per-line "this period" completion: 30%/20%/15% for first 3, zero after.
    const pcts = [0.3, 0.2, 0.15, 0, 0];
    const lineRows = sovLines.map((ln, i) => {
      const thisPeriod = Math.round(ln.scheduledValueCents * pcts[i]);
      const total = thisPeriod;
      const retainage = Math.round(total * 0.1);
      const balance = ln.scheduledValueCents - total;
      const pctBp = ln.scheduledValueCents
        ? Math.round((total / ln.scheduledValueCents) * 10_000)
        : 0;
      return {
        sovLineItemId: ln.id,
        workCompletedPreviousCents: 0,
        workCompletedThisPeriodCents: thisPeriod,
        materialsPresentlyStoredCents: 0,
        totalCompletedStoredToDateCents: total,
        retainageCents: retainage,
        retainagePercentApplied: 10,
        percentCompleteBasisPoints: pctBp,
        balanceToFinishCents: balance,
      };
    });

    const totalCompleted = lineRows.reduce((a, r) => a + r.totalCompletedStoredToDateCents, 0);
    const totalRetainage = lineRows.reduce((a, r) => a + r.retainageCents, 0);
    const earnedLessRet = totalCompleted - totalRetainage;
    const balanceToFinish = contractCents - earnedLessRet;
    const now = new Date();
    const periodFrom = new Date(now.getTime() - 30 * 86400000);

    const [draw] = await db
      .insert(drawRequests)
      .values({
        projectId: project.id,
        sovId: sov.id,
        drawNumber: 1,
        periodFrom,
        periodTo: now,
        drawRequestStatus: "submitted",
        originalContractSumCents: contractCents,
        netChangeOrdersCents: 0,
        contractSumToDateCents: contractCents,
        totalCompletedToDateCents: totalCompleted,
        retainageOnCompletedCents: totalRetainage,
        retainageOnStoredCents: 0,
        totalRetainageCents: totalRetainage,
        totalEarnedLessRetainageCents: earnedLessRet,
        previousCertificatesCents: 0,
        currentPaymentDueCents: earnedLessRet,
        balanceToFinishCents: balanceToFinish,
        createdByUserId: pmUserId,
        submittedAt: now,
      })
      .returning();

    for (const lr of lineRows) {
      await db.insert(drawLineItems).values({ drawRequestId: draw.id, ...lr });
    }
  }

  // ---- Conversation + 3 messages ---------------------------------------
  let convo = (
    await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.projectId, project.id),
          eq(conversations.conversationType, "project_general"),
        )!,
      )
      .limit(1)
  )[0];
  if (!convo) {
    [convo] = await db
      .insert(conversations)
      .values({
        projectId: project.id,
        title: `${project.name} — general`,
        conversationType: "project_general",
        messageCount: 0,
        visibilityScope: "project_wide",
      })
      .returning();
  }

  for (const uid of [pmUserId, clientUserId, subUserId]) {
    await upsert(
      conversationParticipants,
      and(
        eq(conversationParticipants.conversationId, convo.id),
        eq(conversationParticipants.userId, uid),
      )!,
      { conversationId: convo.id, userId: uid },
    );
  }

  const existingMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convo.id))
    .limit(1);
  if (!existingMessages[0]) {
    const msgBodies = residential
      ? [
        { uid: pmUserId, body: "Hi Emily — demo wraps Thursday. Cabinets arrive the following Monday." },
        { uid: clientUserId, body: "Sounds great. Should I be off-site during demo day?" },
        { uid: pmUserId, body: "Yes, we recommend it for dust and noise. Crew will be done by 4pm." },
      ]
      : [
        { uid: pmUserId, body: "Priya — mechanical rough-in inspection is booked for next Tuesday." },
        { uid: clientUserId, body: "Confirmed. I'll notify the tenant rep and forward the schedule." },
        { uid: subUserId, body: "Northline crew will have access Monday afternoon to prep Level 15." },
      ];
    for (const m of msgBodies) {
      await db.insert(messages).values({
        conversationId: convo.id,
        senderUserId: m.uid,
        body: m.body,
      });
    }
    const last = msgBodies[msgBodies.length - 1];
    await db
      .update(conversations)
      .set({
        messageCount: msgBodies.length,
        lastMessageAt: new Date(),
        lastMessagePreview: last.body.slice(0, 255),
      })
      .where(eq(conversations.id, convo.id));
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
