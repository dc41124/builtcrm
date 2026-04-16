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
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { db } from "./client";
import { r2, R2_BUCKET } from "../lib/storage";
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
  documentLinks,
  rfis,
  rfiResponses,
  changeOrders,
  approvals,
  uploadRequests,
  complianceRecords,
  scheduleOfValues,
  sovLineItems,
  drawRequests,
  drawLineItems,
  lienWaivers,
  conversations,
  conversationParticipants,
  messages,
  activityFeedItems,
  selectionCategories,
  selectionItems,
  selectionOptions,
  selectionDecisions,
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

// -- Photo seeding helpers --------------------------------------------------
// Generates a deterministic placeholder SVG for a seeded photo and uploads it
// to R2 at the given key. Idempotent — re-running just overwrites.
const PHOTO_PALETTE: Array<[string, string]> = [
  ["#5b4fc7", "#7c6fe0"],
  ["#3178b9", "#5fa0d8"],
  ["#2d8a5e", "#4dc584"],
  ["#c17a1a", "#e8a94b"],
  ["#3d6b8e", "#5f8cae"],
  ["#c93b3b", "#e65c5c"],
  ["#8b5fbf", "#a784d4"],
  ["#1a7f9e", "#3ba5c4"],
];

function placeholderSvgBytes(label: string, index: number): Buffer {
  const [from, to] = PHOTO_PALETTE[index % PHOTO_PALETTE.length];
  const safe = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#g)"/>
  <g fill="rgba(255,255,255,0.22)">
    <rect x="60" y="60" width="680" height="480" rx="20" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="3"/>
    <circle cx="260" cy="230" r="48"/>
    <path d="M680 420 L520 280 L360 420 L260 340 L120 460 L120 540 L680 540 Z"/>
  </g>
  <text x="50%" y="${safe.length > 32 ? "48%" : "52%"}" fill="#ffffff" font-family="'DM Sans',system-ui,sans-serif" font-size="34" font-weight="700" text-anchor="middle" letter-spacing="-1">${safe}</text>
</svg>`;
  return Buffer.from(svg, "utf8");
}

async function seedUploadSvg(key: string, bytes: Buffer): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: "image/svg+xml",
      CacheControl: "public, max-age=3600",
    }),
  );
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

  const commercial2 = await upsert(projects, eq(projects.projectCode, "SUM-2026-003"), {
    name: "Cascade Medical Clinic Fit-out",
    projectCode: "SUM-2026-003",
    projectType: "commercial_fitout",
    clientSubtype: "commercial" as const,
    projectStatus: "active" as const,
    currentPhase: "phase_1" as const,
    startDate: new Date("2026-02-10T00:00:00Z"),
    targetCompletionDate: new Date("2026-09-20T00:00:00Z"),
    contractorOrganizationId: summitOrg.id,
    contractValueCents: 120_000_000, // CAD $1,200,000.00
    addressLine1: "4420 Kingsway",
    addressLine2: "Suite 300",
    city: "Burnaby",
    stateProvince: "BC",
    postalCode: "V5H 4M9",
    country: "CA",
  });

  const residential2 = await upsert(projects, eq(projects.projectCode, "SUM-2026-004"), {
    name: "Harper Backyard ADU",
    projectCode: "SUM-2026-004",
    projectType: "residential_new_build",
    clientSubtype: "residential" as const,
    projectStatus: "active" as const,
    currentPhase: "phase_1" as const,
    startDate: new Date("2026-03-20T00:00:00Z"),
    targetCompletionDate: new Date("2026-12-10T00:00:00Z"),
    contractorOrganizationId: summitOrg.id,
    contractValueCents: 34_000_000, // CAD $340,000.00
    addressLine1: "2847 Cambie Street",
    addressLine2: "Laneway",
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

    { projectId: commercial2.id, organizationId: summitOrg.id, membershipType: "contractor" },
    {
      projectId: commercial2.id,
      organizationId: northlineOrg.id,
      membershipType: "subcontractor",
      workScope: "Medical-grade electrical, emergency power, lighting",
    },
    { projectId: commercial2.id, organizationId: meridianOrg.id, membershipType: "client" },

    { projectId: residential2.id, organizationId: summitOrg.id, membershipType: "contractor" },
    {
      projectId: residential2.id,
      organizationId: pacificOrg.id,
      membershipType: "subcontractor",
      workScope: "ADU plumbing rough-in, water service tie-in",
    },
    { projectId: residential2.id, organizationId: harperHousehold.id, membershipType: "client" },
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

    { projectId: commercial2.id, userId: summitAdmin.id, organizationId: summitOrg.id, roleAssignmentId: roleSummitAdmin.id },
    { projectId: commercial2.id, userId: summitPm.id, organizationId: summitOrg.id, roleAssignmentId: roleSummitPm.id },
    { projectId: commercial2.id, userId: northlineUser.id, organizationId: northlineOrg.id, roleAssignmentId: roleNorthline.id },
    { projectId: commercial2.id, userId: meridianUser.id, organizationId: meridianOrg.id, roleAssignmentId: roleMeridian.id },

    { projectId: residential2.id, userId: summitPm.id, organizationId: summitOrg.id, roleAssignmentId: roleSummitPm.id },
    { projectId: residential2.id, userId: pacificUser.id, organizationId: pacificOrg.id, roleAssignmentId: rolePacific.id },
    { projectId: residential2.id, userId: residentialUser.id, organizationId: harperHousehold.id, roleAssignmentId: roleHarper.id },
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
    sub2UserId: pacificUser.id,
    sub2OrgId: pacificOrg.id,
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

  await seedProjectContent({
    project: commercial2,
    contractorOrgId: summitOrg.id,
    pmUserId: summitPm.id,
    adminUserId: summitAdmin.id,
    clientUserId: meridianUser.id,
    subUserId: northlineUser.id,
    subOrgId: northlineOrg.id,
    sub2UserId: pacificUser.id,
    sub2OrgId: pacificOrg.id,
    residential: false,
  });

  await seedProjectContent({
    project: residential2,
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
  sub2UserId?: string;
  sub2OrgId?: string;
  residential: boolean;
}

async function seedProjectContent(ctx: ProjectContext) {
  const { project, contractorOrgId, pmUserId, clientUserId, subUserId, subOrgId, residential } = ctx;
  const contractCents = project.contractValueCents ?? 0;
  const day = 86400000;

  // ---- Documents (12-15) -----------------------------------------------
  type DocSeed = { title: string; type: string; vis?: "internal_only" | "client_visible" | "subcontractor_scoped" | "project_wide"; aud?: "internal" | "contractor" | "subcontractor" | "client" | "commercial_client" | "residential_client" | "mixed"; daysAgo?: number };
  const docTitles: DocSeed[] = residential
    ? [
        { title: "Kitchen design drawings rev C", type: "drawing" },
        { title: "Kitchen design drawings rev B (superseded)", type: "drawing", vis: "project_wide" },
        { title: "Appliance specification package", type: "specification" },
        { title: "Signed fixed-price agreement", type: "contract", vis: "internal_only", aud: "internal" },
        { title: "Cabinetry shop drawings", type: "submittal" },
        { title: "Pre-demo walkthrough photos", type: "photo_log" },
        { title: "Plumbing rough-in inspection report", type: "submittal", daysAgo: 5 },
        { title: "Countertop fabrication template", type: "drawing", daysAgo: 3 },
        { title: "Electrical permit — City of Vancouver", type: "specification", vis: "internal_only", aud: "contractor" },
        { title: "Tile supplier cut sheets — Centura", type: "specification", daysAgo: 8 },
        { title: "Weekly safety checklist — Week 4", type: "submittal", vis: "internal_only", aud: "contractor", daysAgo: 7 },
        { title: "Change order backup — quartzite pricing", type: "specification", vis: "client_visible", daysAgo: 12 },
      ]
    : [
        { title: "Architectural drawing set rev 4", type: "drawing" },
        { title: "Architectural drawing set rev 3 (superseded)", type: "drawing", vis: "project_wide" },
        { title: "Division 26 electrical specifications", type: "specification" },
        { title: "Division 22 mechanical specifications", type: "specification", daysAgo: 18 },
        { title: "Signed master services agreement", type: "contract", vis: "internal_only", aud: "internal" },
        { title: "Mechanical submittal package 03", type: "submittal" },
        { title: "Electrical panel shop drawings", type: "submittal", daysAgo: 10 },
        { title: "Phase 2 progress photo set", type: "photo_log" },
        { title: "Structural engineer sign-off letter", type: "specification", vis: "project_wide", daysAgo: 21 },
        { title: "Fire stopping inspection report — Level 15", type: "submittal", vis: "internal_only", aud: "contractor", daysAgo: 6 },
        { title: "Building permit — City of Vancouver", type: "specification", vis: "internal_only", aud: "contractor" },
        { title: "Weekly safety checklist — Week 12", type: "submittal", vis: "internal_only", aud: "contractor", daysAgo: 3 },
        { title: "Tenant improvement allowance schedule", type: "contract", vis: "client_visible", aud: "commercial_client", daysAgo: 25 },
        { title: "Lobby signage mockup — fabrication release", type: "drawing", vis: "client_visible", daysAgo: 4 },
        { title: "Meeting minutes — OAC #8", type: "submittal", vis: "project_wide", daysAgo: 7 },
      ];

  const docIds: string[] = [];
  for (let i = 0; i < docTitles.length; i++) {
    const d = docTitles[i];
    const slug = d.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase().slice(0, 60);
    const storageKey = `seed/${project.id}/documents/${i + 1}-${slug}.pdf`;
    const isSuperseded = d.title.includes("superseded");
    const createdAt = d.daysAgo ? new Date(Date.now() - d.daysAgo * day) : undefined;
    const doc = await upsert(documents, eq(documents.storageKey, storageKey), {
      projectId: project.id,
      documentType: d.type,
      title: d.title,
      storageKey,
      uploadedByUserId: pmUserId,
      visibilityScope: (d.vis ?? "project_wide") as any,
      audienceScope: (d.aud ?? (residential ? "residential_client" : "commercial_client")) as any,
      documentStatus: isSuperseded ? ("superseded" as const) : ("active" as const),
      isSuperseded,
      ...(createdAt ? { createdAt, updatedAt: createdAt } : {}),
    });
    docIds.push(doc.id);
  }

  // ---- Progress photos (grouped across 3 days) -------------------------
  const photoDefs = residential
    ? [
        { title: "Kitchen demo — before", daysAgo: 14 },
        { title: "Kitchen demo — wall removal", daysAgo: 14 },
        { title: "Kitchen demo — plumbing rough", daysAgo: 14 },
        { title: "Electrical panel upgrade", daysAgo: 7 },
        { title: "Cabinet delivery staging", daysAgo: 7 },
        { title: "Countertop template check", daysAgo: 2 },
        { title: "Backsplash tile layout", daysAgo: 2 },
      ]
    : [
        { title: "Phase 2 slab pour — east wing", daysAgo: 21 },
        { title: "Phase 2 slab pour — west wing", daysAgo: 21 },
        { title: "Structural steel inspection", daysAgo: 14 },
        { title: "Electrical panel room", daysAgo: 7 },
        { title: "Mechanical duct rough-in", daysAgo: 7 },
        { title: "Fire suppression rough-in", daysAgo: 7 },
        { title: "Corridor framing — level 3", daysAgo: 2 },
        { title: "Conduit run — level 3", daysAgo: 2 },
      ];

  for (let i = 0; i < photoDefs.length; i++) {
    const p = photoDefs[i];
    const storageKey = `seed/${project.id}/photos/${i + 1}-${p.title.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.svg`;
    const createdAt = new Date(Date.now() - p.daysAgo * 86400000);
    try {
      await seedUploadSvg(storageKey, placeholderSvgBytes(p.title, i));
    } catch (err) {
      console.warn(
        `[seed] failed to upload placeholder photo to R2 (${storageKey}):`,
        (err as Error).message,
      );
      // Continue — DB row will still be created, view falls back to gradient.
    }
    const existingPhoto = await db
      .select()
      .from(documents)
      .where(eq(documents.storageKey, storageKey))
      .limit(1);
    if (existingPhoto[0]) {
      docIds.push(existingPhoto[0].id);
      continue;
    }
    const [photoDoc] = await db
      .insert(documents)
      .values({
        projectId: project.id,
        documentType: "photo_log",
        title: p.title,
        storageKey,
        uploadedByUserId: pmUserId,
        visibilityScope: "project_wide" as const,
        audienceScope: residential
          ? ("residential_client" as const)
          : ("commercial_client" as const),
        documentStatus: "active" as const,
        createdAt,
        updatedAt: createdAt,
      })
      .returning();
    if (photoDoc) docIds.push(photoDoc.id);
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

  // ---- RFIs (6-8) -------------------------------------------------------
  type RfiSeed = {
    subject: string; body: string;
    status: "draft" | "open" | "pending_response" | "answered" | "closed";
    rfiType?: "formal" | "issue";
    daysAgoCreated: number; dueDaysOut: number;
    createdBy?: "sub" | "pm";
    response?: string; // if answered/closed, the official response text
    drawingRef?: string; locationDesc?: string;
  };
  const rfiRows: RfiSeed[] = residential
    ? [
        { subject: "Confirm island waste line routing", body: "Existing slab has unknown obstructions — need confirmation on preferred routing before cutting.", status: "answered", rfiType: "formal", daysAgoCreated: 18, dueDaysOut: -3, response: "Route waste line 12 inches north of original plan to avoid the post-tension cables. Confirmed with structural engineer." },
        { subject: "Undercabinet lighting wattage", body: "Homeowner selected LED tape exceeds spec draw. Confirm transformer sizing.", status: "open", daysAgoCreated: 8, dueDaysOut: 5 },
        { subject: "Countertop seam location", body: "Requesting approval to relocate seam 6 inches left of original layout to align with the cabinet joint below.", status: "pending_response", rfiType: "formal", daysAgoCreated: 4, dueDaysOut: 8, drawingRef: "Kitchen plan rev C — Sheet K-201" },
        { subject: "Backsplash tile pattern at window returns", body: "Tile layout at the window returns requires a cut pattern that differs from the main field. Need direction on whether to use mitered bullnose or a metal edge trim.", status: "open", daysAgoCreated: 3, dueDaysOut: 10, locationDesc: "Kitchen east wall — window above sink" },
        { subject: "Gas line routing for range", body: "Gas stub-out location conflicts with the island vent duct. Requesting revised routing.", status: "closed", daysAgoCreated: 22, dueDaysOut: -8, response: "Re-routed gas line through the floor cavity. Inspector signed off on revised routing March 28.", createdBy: "pm" },
        { subject: "Pantry door swing clearance", body: "As-built framing leaves only 28 inches for the pantry door swing. Spec calls for 32-inch clear opening.", status: "draft", daysAgoCreated: 1, dueDaysOut: 14 },
      ]
    : [
        { subject: "Slab penetration coordination — Level 15", body: "Mechanical and electrical both require core drilling in grid D/4. Need coordinated layout before either trade proceeds.", status: "answered", rfiType: "formal", daysAgoCreated: 25, dueDaysOut: -10, response: "Coordinated layout issued — see attached markup. Mechanical takes priority at grid D/4; electrical shifted 18 inches east to grid D/5.", drawingRef: "S-401 Structural slab plan — Level 15" },
        { subject: "Fire-rated ceiling assembly substitution", body: "Submitted product (USG Sheetrock Brand Firecode C) does not match spec assembly UL D916. Requesting approval for equivalent.", status: "pending_response", rfiType: "formal", daysAgoCreated: 12, dueDaysOut: 3 },
        { subject: "Existing conduit routing discrepancy", body: "Record drawings show 2\" EMT at grid line B between levels 14-15 that is not present. Need confirmation on new routing to avoid delays.", status: "open", daysAgoCreated: 7, dueDaysOut: 7, locationDesc: "Electrical riser — grid B, Levels 14-15" },
        { subject: "Elevator lobby finish tile layout", body: "GC requesting confirmation on tile orientation in the elevator lobbies — herringbone pattern or running bond per the original intent drawings.", status: "open", daysAgoCreated: 5, dueDaysOut: 12, drawingRef: "A-301 Finish plan — typical lobby" },
        { subject: "Mechanical room ventilation louver sizing", body: "Louver schedule calls for 48x36 but rough opening is framed at 42x30. Confirm whether to enlarge opening or substitute smaller louver.", status: "answered", rfiType: "formal", daysAgoCreated: 20, dueDaysOut: -5, response: "Enlarge rough opening to 48x36 per spec. Framing contractor to patch and re-header. No structural impact confirmed by engineer." },
        { subject: "Sprinkler head placement — open office area Level 16", body: "Reflected ceiling plan conflicts with the revised furniture layout. 3 heads need repositioning to maintain coverage.", status: "closed", daysAgoCreated: 30, dueDaysOut: -15, response: "Heads repositioned per fire protection engineer's revised layout. Inspector approved final placement.", createdBy: "pm" },
        { subject: "Stairwell B handrail bracket spacing", body: "Code requires brackets at 48\" o.c. max but the concrete wall anchors land on a cold joint at two locations. Requesting alternative anchor detail.", status: "draft", daysAgoCreated: 2, dueDaysOut: 14, locationDesc: "Stairwell B — Levels 14-17" },
        { subject: "Demising wall sound rating — Suite 1604", body: "Adjacent tenant has requested STC 55 at the shared wall. Current assembly is rated STC 50. Confirm if upgrade is required.", status: "open", daysAgoCreated: 4, dueDaysOut: 10, rfiType: "formal" },
      ];

  const seededRfiIds: string[] = [];
  for (let i = 0; i < rfiRows.length; i++) {
    const r = rfiRows[i];
    const seq = i + 1;
    const existing = await db
      .select()
      .from(rfis)
      .where(and(eq(rfis.projectId, project.id), eq(rfis.sequentialNumber, seq))!)
      .limit(1);
    let rfiRow = existing[0];
    if (!rfiRow) {
      const createdAt = new Date(Date.now() - r.daysAgoCreated * day);
      const dueAt = new Date(Date.now() + r.dueDaysOut * day);
      [rfiRow] = await db.insert(rfis).values({
        projectId: project.id,
        sequentialNumber: seq,
        subject: r.subject,
        body: r.body,
        rfiStatus: r.status,
        rfiType: r.rfiType ?? "issue",
        createdByUserId: r.createdBy === "pm" ? pmUserId : subUserId,
        assignedToUserId: r.createdBy === "pm" ? subUserId : pmUserId,
        assignedToOrganizationId: r.createdBy === "pm" ? subOrgId : contractorOrgId,
        dueAt,
        respondedAt: (r.status === "answered" || r.status === "closed") ? new Date(Date.now() - (r.daysAgoCreated - 3) * day) : null,
        closedAt: r.status === "closed" ? new Date(Date.now() - (r.daysAgoCreated - 5) * day) : null,
        drawingReference: r.drawingRef ?? null,
        locationDescription: r.locationDesc ?? null,
        createdAt,
        updatedAt: createdAt,
      }).returning();
    }
    seededRfiIds.push(rfiRow.id);

    // Add official response for answered/closed RFIs
    if (r.response && rfiRow) {
      const existingResp = await db.select().from(rfiResponses).where(eq(rfiResponses.rfiId, rfiRow.id)).limit(1);
      if (!existingResp[0]) {
        await db.insert(rfiResponses).values({
          rfiId: rfiRow.id,
          respondedByUserId: r.createdBy === "pm" ? subUserId : pmUserId,
          body: r.response,
          isOfficialResponse: true,
        });
      }
    }
  }

  // ---- Change orders (4-5) ---------------------------------------------
  type CoSeed = {
    title: string; amount: number; reason: string; scheduleDays: number;
    status: "draft" | "pending_review" | "pending_client_approval" | "approved" | "rejected" | "voided";
    submittedDaysAgo: number | null;
    decidedDaysAgo: number | null;
    originatesFromRfi?: number; // 1-based index into seededRfiIds
  };
  const coRows: CoSeed[] = residential
    ? [
        { title: "Upgrade to quartzite countertops", amount: 420_000, reason: "Homeowner selection change from original quartz spec.", scheduleDays: 5, status: "approved", submittedDaysAgo: 18, decidedDaysAgo: 14 },
        { title: "Add pot filler and rough-in", amount: 185_000, reason: "New scope addition requested during demo.", scheduleDays: 2, status: "pending_client_approval", submittedDaysAgo: 10, decidedDaysAgo: null },
        { title: "Re-route gas line for range relocation", amount: 95_000, reason: "Gas stub-out conflicts with island vent duct per RFI-005.", scheduleDays: 1, status: "approved", submittedDaysAgo: 20, decidedDaysAgo: 17, originatesFromRfi: 5 },
        { title: "Pantry shelving upgrade — pull-out drawers", amount: 68_000, reason: "Homeowner requested pull-out drawer organizers in lieu of fixed shelves.", scheduleDays: 0, status: "draft", submittedDaysAgo: null, decidedDaysAgo: null },
        { title: "Remove soffit above peninsula", amount: -32_000, reason: "Soffit removal reveals usable space — credit for reduced drywall and framing.", scheduleDays: -1, status: "rejected", submittedDaysAgo: 22, decidedDaysAgo: 19 },
      ]
    : [
        { title: "Additional demising wall — Level 16", amount: 4_850_000, reason: "Tenant layout revision requires new partition between suites 1604 and 1605.", scheduleDays: 5, status: "approved", submittedDaysAgo: 25, decidedDaysAgo: 18 },
        { title: "Upgrade panel to 400A service", amount: 3_120_000, reason: "Load calculation revision after tenant equipment review.", scheduleDays: 3, status: "pending_client_approval", submittedDaysAgo: 10, decidedDaysAgo: null },
        { title: "Mechanical reroute — south corridor Level 15", amount: 1_840_000, reason: "HVAC duct reroute caused by structural conflict. Blocks procurement release.", scheduleDays: 3, status: "pending_review", submittedDaysAgo: 5, decidedDaysAgo: null },
        { title: "Lobby reception desk millwork upgrade", amount: 2_200_000, reason: "Client-requested upgrade from laminate to walnut veneer with integrated LED accent lighting.", scheduleDays: 8, status: "draft", submittedDaysAgo: null, decidedDaysAgo: null },
        { title: "Delete corridor wallcovering at Level 14", amount: -680_000, reason: "Tenant elected painted finish in lieu of vinyl wallcovering. Credit to owner.", scheduleDays: 0, status: "rejected", submittedDaysAgo: 15, decidedDaysAgo: 12 },
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
        scheduleImpactDays: c.scheduleDays,
        changeOrderStatus: c.status,
        requestedByUserId: pmUserId,
        approvedByUserId: c.decidedDaysAgo != null ? clientUserId : null,
        approvedAt: c.status === "approved" && c.decidedDaysAgo != null ? new Date(Date.now() - c.decidedDaysAgo * day) : null,
        rejectedAt: c.status === "rejected" && c.decidedDaysAgo != null ? new Date(Date.now() - c.decidedDaysAgo * day) : null,
        rejectionReason: c.status === "rejected" ? "Not aligned with project scope at this time." : null,
        submittedAt: c.submittedDaysAgo != null ? new Date(Date.now() - c.submittedDaysAgo * day) : null,
        originatingRfiId: c.originatesFromRfi ? seededRfiIds[c.originatesFromRfi - 1] ?? null : null,
      });
    }
  }

  // ---- Approvals (cross-type queue) ------------------------------------
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

  // ---- Upload requests (3-4) --------------------------------------------
  type UrSeed = { title: string; description: string; status: "open" | "submitted" | "revision_requested" | "completed" | "cancelled"; dueDaysOut: number; fromSub?: boolean };
  const urSeeds: UrSeed[] = residential
    ? [
        { title: "Upload appliance warranty cards", description: "Please upload warranty documentation for all installed appliances.", status: "open", dueDaysOut: 7 },
        { title: "Countertop fabrication sign-off", description: "Template measurements require your sign-off before fabrication proceeds.", status: "submitted", dueDaysOut: -2 },
        { title: "Updated plumbing rough-in photos", description: "Inspector requires rough-in photos with visible pressure test gauge.", status: "revision_requested", dueDaysOut: 3 },
      ]
    : [
        { title: "Upload updated WCB clearance", description: "Latest WCB clearance letter required before next draw release.", status: "open", dueDaysOut: 7 },
        { title: "Fire stopping inspection photos — Level 15", description: "Upload photos showing fire stopping at all penetrations per inspector's request.", status: "submitted", dueDaysOut: -3 },
        { title: "Elevator shaft as-built measurements", description: "As-built dimensions needed for cab manufacturer. Due before procurement release.", status: "open", dueDaysOut: 12 },
        { title: "Electrical panel nameplate data", description: "Panel nameplates and circuit directories for closeout package.", status: "completed", dueDaysOut: -10 },
      ];
  for (const ur of urSeeds) {
    const existing = await db
      .select()
      .from(uploadRequests)
      .where(and(eq(uploadRequests.projectId, project.id), eq(uploadRequests.title, ur.title))!)
      .limit(1);
    if (!existing[0]) {
      await db.insert(uploadRequests).values({
        projectId: project.id,
        title: ur.title,
        description: ur.description,
        requestStatus: ur.status,
        requestedFromUserId: subUserId,
        requestedFromOrganizationId: subOrgId,
        dueAt: new Date(Date.now() + ur.dueDaysOut * day),
        completedAt: ur.status === "completed" ? new Date(Date.now() - 5 * day) : null,
        submittedAt: ur.status === "submitted" || ur.status === "completed" ? new Date(Date.now() - 4 * day) : null,
        revisionNote: ur.status === "revision_requested" ? "Photos too dark — retake with flash in adequate lighting." : null,
        visibilityScope: "project_wide",
      });
    }
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

  // ---- Draw requests (3) — paid → under_review → draft ------------------
  // Helper: build draw line items for a given completion profile
  function buildDrawLines(
    lines: Array<{ id: string; scheduledValueCents: number }>,
    prevPcts: number[],
    thisPcts: number[],
  ) {
    return lines.map((ln, i) => {
      const prev = Math.round(ln.scheduledValueCents * (prevPcts[i] ?? 0));
      const thisPeriod = Math.round(ln.scheduledValueCents * (thisPcts[i] ?? 0));
      const total = prev + thisPeriod;
      const retainage = Math.round(total * 0.1);
      const balance = ln.scheduledValueCents - total;
      const pctBp = ln.scheduledValueCents ? Math.round((total / ln.scheduledValueCents) * 10_000) : 0;
      return {
        sovLineItemId: ln.id,
        workCompletedPreviousCents: prev,
        workCompletedThisPeriodCents: thisPeriod,
        materialsPresentlyStoredCents: 0,
        totalCompletedStoredToDateCents: total,
        retainageCents: retainage,
        retainagePercentApplied: 10,
        percentCompleteBasisPoints: pctBp,
        balanceToFinishCents: balance,
      };
    });
  }

  type DrawSeed = {
    drawNumber: number;
    status: "draft" | "ready_for_review" | "submitted" | "under_review" | "approved" | "approved_with_note" | "returned" | "revised" | "paid" | "closed";
    prevPcts: number[];
    thisPcts: number[];
    periodDaysAgo: [number, number]; // [from, to]
    paidDaysAgo?: number;
    reviewNote?: string;
  };
  const drawSeeds: DrawSeed[] = [
    {
      drawNumber: 1,
      status: "paid",
      prevPcts: [0, 0, 0, 0, 0],
      thisPcts: [0.30, 0.20, 0.15, 0.10, 0],
      periodDaysAgo: [60, 30],
      paidDaysAgo: 22,
    },
    {
      drawNumber: 2,
      status: "under_review",
      prevPcts: [0.30, 0.20, 0.15, 0.10, 0],
      thisPcts: [0.25, 0.15, 0.20, 0.15, 0.10],
      periodDaysAgo: [30, 5],
      reviewNote: "Line item 03 seems high relative to field observation — requesting backup.",
    },
    {
      drawNumber: 3,
      status: "draft",
      prevPcts: [0.55, 0.35, 0.35, 0.25, 0.10],
      thisPcts: [0.15, 0.10, 0.10, 0.12, 0.08],
      periodDaysAgo: [5, 0],
    },
  ];

  let cumulativePreviousCerts = 0;
  for (const ds of drawSeeds) {
    const drawExisting = await db
      .select()
      .from(drawRequests)
      .where(and(eq(drawRequests.projectId, project.id), eq(drawRequests.drawNumber, ds.drawNumber))!)
      .limit(1);
    if (drawExisting[0]) {
      // Accumulate for next draw
      cumulativePreviousCerts += drawExisting[0].totalEarnedLessRetainageCents ?? 0;
      continue;
    }

    const lineRows = buildDrawLines(sovLines, ds.prevPcts, ds.thisPcts);
    const totalCompleted = lineRows.reduce((a, r) => a + r.totalCompletedStoredToDateCents, 0);
    const totalRetainage = lineRows.reduce((a, r) => a + r.retainageCents, 0);
    const earnedLessRet = totalCompleted - totalRetainage;
    const currentPaymentDue = earnedLessRet - cumulativePreviousCerts;
    const balanceToFinish = contractCents - earnedLessRet;
    const periodFrom = new Date(Date.now() - ds.periodDaysAgo[0] * day);
    const periodTo = new Date(Date.now() - ds.periodDaysAgo[1] * day);

    const [draw] = await db
      .insert(drawRequests)
      .values({
        projectId: project.id,
        sovId: sov.id,
        drawNumber: ds.drawNumber,
        periodFrom,
        periodTo,
        drawRequestStatus: ds.status,
        originalContractSumCents: contractCents,
        netChangeOrdersCents: 0,
        contractSumToDateCents: contractCents,
        totalCompletedToDateCents: totalCompleted,
        retainageOnCompletedCents: totalRetainage,
        retainageOnStoredCents: 0,
        totalRetainageCents: totalRetainage,
        totalEarnedLessRetainageCents: earnedLessRet,
        previousCertificatesCents: cumulativePreviousCerts,
        currentPaymentDueCents: currentPaymentDue,
        balanceToFinishCents: balanceToFinish,
        createdByUserId: pmUserId,
        submittedAt: ds.status !== "draft" ? periodTo : null,
        reviewedAt: ds.reviewNote ? new Date(Date.now() - 2 * day) : null,
        reviewNote: ds.reviewNote ?? null,
        paidAt: ds.paidDaysAgo ? new Date(Date.now() - ds.paidDaysAgo * day) : null,
        paymentReferenceName: ds.paidDaysAgo ? `EFT-${project.id.slice(0, 6).toUpperCase()}-${ds.drawNumber}` : null,
      })
      .returning();

    for (const lr of lineRows) {
      await db.insert(drawLineItems).values({ drawRequestId: draw.id, ...lr });
    }

    // Lien waivers for paid draws
    if (ds.status === "paid" && draw) {
      const waiverOrgs = [{ orgId: subOrgId, amount: Math.round(currentPaymentDue * 0.6) }];
      if (ctx.sub2OrgId) waiverOrgs.push({ orgId: ctx.sub2OrgId, amount: Math.round(currentPaymentDue * 0.4) });
      for (const wo of waiverOrgs) {
        const existing = await db
          .select()
          .from(lienWaivers)
          .where(and(eq(lienWaivers.drawRequestId, draw.id), eq(lienWaivers.organizationId, wo.orgId))!)
          .limit(1);
        if (!existing[0]) {
          await db.insert(lienWaivers).values({
            projectId: project.id,
            drawRequestId: draw.id,
            organizationId: wo.orgId,
            lienWaiverType: "conditional_progress",
            lienWaiverStatus: "accepted",
            amountCents: wo.amount,
            requestedAt: periodTo,
            submittedAt: new Date(periodTo.getTime() + 2 * day),
            acceptedAt: new Date(periodTo.getTime() + 4 * day),
            acceptedByUserId: pmUserId,
          });
        }
      }
    }

    // Lien waivers for under_review draws (requested but not yet accepted)
    if (ds.status === "under_review" && draw) {
      const waiverOrgs2 = [subOrgId];
      if (ctx.sub2OrgId) waiverOrgs2.push(ctx.sub2OrgId);
      for (const orgId of waiverOrgs2) {
        const existing = await db
          .select()
          .from(lienWaivers)
          .where(and(eq(lienWaivers.drawRequestId, draw.id), eq(lienWaivers.organizationId, orgId))!)
          .limit(1);
        if (!existing[0]) {
          await db.insert(lienWaivers).values({
            projectId: project.id,
            drawRequestId: draw.id,
            organizationId: orgId,
            lienWaiverType: "conditional_progress",
            lienWaiverStatus: orgId === subOrgId ? "submitted" : "requested",
            amountCents: Math.round(currentPaymentDue * (orgId === subOrgId ? 0.6 : 0.4)),
            requestedAt: periodTo,
            submittedAt: orgId === subOrgId ? new Date(Date.now() - 3 * day) : null,
          });
        }
      }
    }

    cumulativePreviousCerts = earnedLessRet;
  }

  // ---- Conversations (4-5 threads, 15-20 messages total) ----------------
  type ConvoSeed = {
    title: string;
    type: "project_general" | "rfi_thread" | "change_order_thread" | "approval_thread" | "direct";
    participants: string[];
    msgs: Array<{ uid: string; body: string; daysAgo: number }>;
  };
  const allParticipants = [pmUserId, clientUserId, subUserId];
  if (ctx.adminUserId && ctx.adminUserId !== pmUserId) allParticipants.push(ctx.adminUserId);

  const convoSeeds: ConvoSeed[] = residential
    ? [
        {
          title: `${project.name} — general`,
          type: "project_general",
          participants: allParticipants,
          msgs: [
            { uid: pmUserId, body: "Hi Emily — demo wraps Thursday. Cabinets arrive the following Monday.", daysAgo: 10 },
            { uid: clientUserId, body: "Sounds great. Should I be off-site during demo day?", daysAgo: 9 },
            { uid: pmUserId, body: "Yes, we recommend it for dust and noise. Crew will be done by 4pm.", daysAgo: 9 },
            { uid: clientUserId, body: "Perfect. I'll take the kids to my sister's place.", daysAgo: 8 },
            { uid: subUserId, body: "Plumbing rough-in will follow demo on Friday morning.", daysAgo: 7 },
            { uid: pmUserId, body: "We'll need to confirm the island waste routing before then — see the open RFI.", daysAgo: 6 },
            { uid: clientUserId, body: "Let me know if there's anything I need to decide on my end.", daysAgo: 4 },
            { uid: pmUserId, body: "Will do. Photos from demo day will be uploaded end of day Thursday.", daysAgo: 2 },
          ],
        },
        {
          title: "RFI-001 · Island waste routing",
          type: "rfi_thread",
          participants: [pmUserId, subUserId, ...(ctx.adminUserId !== pmUserId ? [ctx.adminUserId] : [])],
          msgs: [
            { uid: subUserId, body: "Opened an RFI on island waste routing — slab obstructions are unknown.", daysAgo: 18 },
            { uid: pmUserId, body: "Can you send a photo of the current slab condition?", daysAgo: 17 },
            { uid: subUserId, body: "Photos attached in the RFI record. Requesting response by Friday.", daysAgo: 16 },
            { uid: pmUserId, body: "Route confirmed 12 inches north. Marking the slab tomorrow.", daysAgo: 15 },
          ],
        },
        {
          title: "CO-001 · Quartzite countertop upgrade",
          type: "change_order_thread",
          participants: [pmUserId, clientUserId],
          msgs: [
            { uid: pmUserId, body: "Emily — the quartzite slab pricing came in. See the change order for the full breakdown.", daysAgo: 20 },
            { uid: clientUserId, body: "That's within what we discussed. Go ahead and order it.", daysAgo: 19 },
            { uid: pmUserId, body: "Approved and locked in. Lead time is 3 weeks from the fabricator.", daysAgo: 18 },
          ],
        },
        {
          title: "Tile selection discussion",
          type: "direct",
          participants: [pmUserId, clientUserId],
          msgs: [
            { uid: clientUserId, body: "I've been looking at the Centura Calacatta hex tile for the backsplash. What do you think?", daysAgo: 5 },
            { uid: pmUserId, body: "Great choice. Just make sure it's the 2-inch hex — the 3-inch needs a different setting pattern and costs more to install.", daysAgo: 4 },
            { uid: clientUserId, body: "Good to know. I'll confirm the 2-inch. Can you add it to the selections board?", daysAgo: 3 },
            { uid: pmUserId, body: "Done — it's under the Backsplash category with the other options.", daysAgo: 2 },
          ],
        },
      ]
    : [
        {
          title: `${project.name} — general`,
          type: "project_general",
          participants: allParticipants,
          msgs: [
            { uid: pmUserId, body: "Priya — mechanical rough-in inspection is booked for next Tuesday.", daysAgo: 10 },
            { uid: clientUserId, body: "Confirmed. I'll notify the tenant rep and forward the schedule.", daysAgo: 9 },
            { uid: subUserId, body: "Northline crew will have access Monday afternoon to prep Level 15.", daysAgo: 8 },
            { uid: pmUserId, body: "Reminder: the mechanical reroute CO needs decision before end of week — it's gating procurement.", daysAgo: 6 },
            { uid: clientUserId, body: "Reviewing it today. Should have a response by EOD.", daysAgo: 5 },
            { uid: subUserId, body: "We'll hold the panel order until we hear back.", daysAgo: 4 },
            { uid: pmUserId, body: "Progress photos from Phase 2 are up in the documents module.", daysAgo: 2 },
            { uid: clientUserId, body: "Thanks — forwarded to the ownership group.", daysAgo: 1 },
          ],
        },
        {
          title: "RFI-001 · Slab penetration coordination",
          type: "rfi_thread",
          participants: [pmUserId, subUserId, ...(ctx.adminUserId !== pmUserId ? [ctx.adminUserId] : [])],
          msgs: [
            { uid: subUserId, body: "RFI opened for grid D/4 core drilling coordination.", daysAgo: 25 },
            { uid: pmUserId, body: "Pulled the drawings — will circulate a revised coordination plan tomorrow.", daysAgo: 24 },
            { uid: subUserId, body: "Thanks. We can hold the drilling until the revised plan is confirmed.", daysAgo: 23 },
            { uid: pmUserId, body: "Revised coordination plan attached. Mechanical gets priority at D/4, electrical shifts to D/5.", daysAgo: 22 },
          ],
        },
        {
          title: "CO-001 · Demising wall Level 16",
          type: "change_order_thread",
          participants: [pmUserId, clientUserId],
          msgs: [
            { uid: pmUserId, body: "The demising wall CO has been priced and submitted. See the breakdown in the CO detail.", daysAgo: 26 },
            { uid: clientUserId, body: "Reviewed with ownership. Approved — please proceed.", daysAgo: 24 },
            { uid: pmUserId, body: "Locked in. Framing crew starts next Monday.", daysAgo: 23 },
          ],
        },
        {
          title: "Lobby finishes — design review",
          type: "approval_thread",
          participants: [pmUserId, clientUserId],
          msgs: [
            { uid: pmUserId, body: "Priya — the reception area finish selections are up for your review. Samples are in the sample room at Level 14.", daysAgo: 4 },
            { uid: clientUserId, body: "I'll visit the sample room Thursday morning. Can the designer be available for questions?", daysAgo: 3 },
            { uid: pmUserId, body: "Yes — I've asked them to be on-site between 10 and 12. Ring the site office when you arrive.", daysAgo: 2 },
          ],
        },
        {
          title: "Electrical coordination — Northline",
          type: "direct",
          participants: [pmUserId, subUserId],
          msgs: [
            { uid: subUserId, body: "Devon — we have a wire pull scheduled for Thursday on Level 16. Need confirmation the ceiling grid is clear.", daysAgo: 3 },
            { uid: pmUserId, body: "Ceiling grid is clear through Level 16 west wing. East wing still has mechanical hangers going in — avoid that zone until Monday.", daysAgo: 2 },
            { uid: subUserId, body: "Copy. We'll stage west wing first and shift east on Monday.", daysAgo: 1 },
          ],
        },
      ];

  for (const cs of convoSeeds) {
    let convo = (
      await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.projectId, project.id), eq(conversations.title, cs.title))!)
        .limit(1)
    )[0];
    if (!convo) {
      [convo] = await db
        .insert(conversations)
        .values({
          projectId: project.id,
          title: cs.title,
          conversationType: cs.type,
          messageCount: 0,
          visibilityScope: "project_wide",
        })
        .returning();
    }

    for (const uid of cs.participants) {
      await upsert(
        conversationParticipants,
        and(eq(conversationParticipants.conversationId, convo.id), eq(conversationParticipants.userId, uid))!,
        { conversationId: convo.id, userId: uid },
      );
    }

    const existingMsgs = await db.select().from(messages).where(eq(messages.conversationId, convo.id)).limit(1);
    if (!existingMsgs[0]) {
      for (const m of cs.msgs) {
        const createdAt = new Date(Date.now() - m.daysAgo * day - ((cs.msgs.indexOf(m) % 3) * 3 * 3600000));
        await db.insert(messages).values({ conversationId: convo.id, senderUserId: m.uid, body: m.body, createdAt });
      }
      const last = cs.msgs[cs.msgs.length - 1];
      await db
        .update(conversations)
        .set({ messageCount: cs.msgs.length, lastMessageAt: new Date(Date.now() - last.daysAgo * day), lastMessagePreview: last.body.slice(0, 255) })
        .where(eq(conversations.id, convo.id));
    }
  }

  // ---- Activity feed items (20+ over 30 days) ---------------------------
  type FeedType = "project_update" | "milestone_update" | "approval_requested" | "approval_completed" | "file_uploaded" | "selection_ready" | "payment_update" | "comment_added";
  type FeedSeed = { activityType: FeedType; title: string; body: string; actor: string; daysAgo: number; vis?: "internal_only" | "client_visible" | "project_wide" };
  const feedSeeds: FeedSeed[] = residential
    ? [
        { activityType: "project_update", title: "Weekly report — Week of April 7", body: "Plumbing rough-in complete. Cabinets are being installed this week. Tile work starts next Monday.", actor: pmUserId, daysAgo: 0 },
        { activityType: "comment_added", title: "New message in project thread", body: "Latest update posted in the general conversation.", actor: pmUserId, daysAgo: 0 },
        { activityType: "file_uploaded", title: "Countertop fabrication template uploaded", body: "Template measurements from the fabricator are now in Documents.", actor: pmUserId, daysAgo: 3 },
        { activityType: "approval_requested", title: "Decision needed: Weekend work for concrete pour", body: "Crew wants to mobilize Saturday morning. Awaiting your go-ahead.", actor: pmUserId, daysAgo: 1 },
        { activityType: "selection_ready", title: "Backsplash tile options published", body: "3 tile options are ready for your review in the Selections board.", actor: pmUserId, daysAgo: 5, vis: "client_visible" },
        { activityType: "file_uploaded", title: "Kitchen design drawings rev C uploaded", body: "New drawing set available in Documents.", actor: pmUserId, daysAgo: 6 },
        { activityType: "milestone_update", title: "Plumbing rough-in inspection passed", body: "Inspector signed off on all rough-in work. Clear to close walls.", actor: pmUserId, daysAgo: 5 },
        { activityType: "payment_update", title: "Draw #1 payment received", body: "Payment of $14,985.00 received via EFT.", actor: pmUserId, daysAgo: 8 },
        { activityType: "approval_completed", title: "Quartzite countertop upgrade approved", body: "Emily approved the upgrade. Fabrication order placed.", actor: clientUserId, daysAgo: 14 },
        { activityType: "milestone_update", title: "Demo complete — wall removal signed off", body: "All wall removal work is complete and the inspector signed off on the exposed framing.", actor: pmUserId, daysAgo: 12 },
        { activityType: "file_uploaded", title: "Progress photos — demo day", body: "7 photos from demo day are up in the Photos tab.", actor: pmUserId, daysAgo: 14 },
        { activityType: "milestone_update", title: "Phase 1 complete — demo signed off", body: "Phase 1 wrapped on schedule. Moving into Phase 2 cabinetry and plumbing rough-in.", actor: pmUserId, daysAgo: 11 },
        { activityType: "project_update", title: "Weekly report — Week of March 24", body: "Kitchen demo is complete and we're on schedule for cabinet delivery next Monday.", actor: pmUserId, daysAgo: 7 },
        { activityType: "file_uploaded", title: "Plumbing rough-in inspection report uploaded", body: "Inspection report with photos added to Documents.", actor: subUserId, daysAgo: 5, vis: "internal_only" },
        { activityType: "approval_completed", title: "Gas line reroute approved", body: "Decision recorded — crew can proceed with revised gas routing.", actor: clientUserId, daysAgo: 17 },
        { activityType: "project_update", title: "Weekly report — Week of March 17", body: "Demo started Monday, on track for completion Thursday. Plumbing crew mobilizing Friday.", actor: pmUserId, daysAgo: 14 },
        { activityType: "comment_added", title: "Tile selection discussion", body: "New messages in the tile selection thread.", actor: clientUserId, daysAgo: 3 },
        { activityType: "file_uploaded", title: "Tile supplier cut sheets uploaded", body: "Centura Calacatta hex tile spec sheets available in Documents.", actor: pmUserId, daysAgo: 8 },
        { activityType: "approval_requested", title: "Decision needed: Pot filler addition", body: "New scope addition — pot filler rough-in and fixture. See change order for pricing.", actor: pmUserId, daysAgo: 10, vis: "client_visible" },
        { activityType: "project_update", title: "Weekly report — Week of March 10", body: "Pre-demo prep complete. All utilities disconnected and hazmat clearance received.", actor: pmUserId, daysAgo: 21 },
      ]
    : [
        { activityType: "project_update", title: "Weekly report — Week of April 7", body: "Good progress across electrical and mechanical rough-in. East corridor complete, west wing wire pull started. Main panel room passed inspection.", actor: pmUserId, daysAgo: 0 },
        { activityType: "comment_added", title: "New message in project thread", body: "Latest update posted in the general conversation.", actor: pmUserId, daysAgo: 0 },
        { activityType: "milestone_update", title: "East corridor rough-in closeout", body: "Final device placement verified and photo submission uploaded. Moving to the west wing.", actor: pmUserId, daysAgo: 3 },
        { activityType: "approval_requested", title: "Approval requested: CO-003 mechanical reroute", body: "The HVAC reroute needs your approval before we can proceed. Currently on the critical path.", actor: pmUserId, daysAgo: 5, vis: "client_visible" },
        { activityType: "file_uploaded", title: "Lobby signage mockup uploaded", body: "Fabrication mockup ready for client review in Documents.", actor: pmUserId, daysAgo: 4 },
        { activityType: "file_uploaded", title: "Architectural drawing set rev 4 uploaded", body: "New drawing set available in Documents.", actor: pmUserId, daysAgo: 6 },
        { activityType: "payment_update", title: "Draw #1 payment received", body: "Payment received via EFT. Lien waivers on file.", actor: pmUserId, daysAgo: 22 },
        { activityType: "approval_completed", title: "CO-001 demising wall approved", body: "Client approved the demising wall addition. Framing crew scheduled for next week.", actor: clientUserId, daysAgo: 18 },
        { activityType: "payment_update", title: "Draw #2 submitted for review", body: "Second progress billing submitted covering the last 30 days of work.", actor: pmUserId, daysAgo: 5 },
        { activityType: "file_uploaded", title: "Fire stopping inspection report uploaded", body: "Level 15 fire stopping photos and inspection report in Documents.", actor: pmUserId, daysAgo: 6, vis: "internal_only" },
        { activityType: "approval_requested", title: "Approval requested: Lobby signage fabrication release", body: "Final confirmation needed before fabrication begins. Affects lobby handover.", actor: pmUserId, daysAgo: 2, vis: "client_visible" },
        { activityType: "file_uploaded", title: "Progress photos — Phase 2 structural", body: "8 photos from the structural inspection and slab pours.", actor: pmUserId, daysAgo: 14 },
        { activityType: "milestone_update", title: "Phase 2 structural substantial completion", body: "All concrete pours passed inspection. Structural engineer signed off. Transitioned to Phase 3 interior rough-in.", actor: pmUserId, daysAgo: 21 },
        { activityType: "approval_completed", title: "CO-005 corridor wallcovering credit rejected", body: "Client declined the credit — proceeding with original wallcovering spec.", actor: clientUserId, daysAgo: 12 },
        { activityType: "project_update", title: "Weekly report — Week of March 31", body: "Mechanical rough-in on Level 15 progressing well. Electrical conduit runs 60% complete. Fire stopping inspection scheduled for Thursday.", actor: pmUserId, daysAgo: 7 },
        { activityType: "file_uploaded", title: "Meeting minutes — OAC #8 uploaded", body: "Minutes from the latest OAC meeting available in Documents.", actor: pmUserId, daysAgo: 7 },
        { activityType: "project_update", title: "Weekly report — Week of March 24", body: "Structural handover complete. Interior rough-in mobilization underway. First electrical crews deployed to Level 14.", actor: pmUserId, daysAgo: 14 },
        { activityType: "file_uploaded", title: "Structural engineer sign-off letter uploaded", body: "Formal sign-off on load tests and concrete pours.", actor: pmUserId, daysAgo: 21, vis: "project_wide" },
        { activityType: "project_update", title: "Weekly report — Week of March 17", body: "Final slab pours completed. Curing in progress. Structural inspections scheduled for next week.", actor: pmUserId, daysAgo: 21 },
        { activityType: "approval_requested", title: "Approval requested: Reception area finish package", body: "Material selections for main reception are ready for your review.", actor: pmUserId, daysAgo: 3, vis: "client_visible" },
        { activityType: "comment_added", title: "Electrical coordination update", body: "New messages in the Northline coordination thread.", actor: subUserId, daysAgo: 1 },
      ];

  for (const f of feedSeeds) {
    const existing = await db
      .select()
      .from(activityFeedItems)
      .where(and(eq(activityFeedItems.projectId, project.id), eq(activityFeedItems.title, f.title))!)
      .limit(1);
    if (!existing[0]) {
      await db.insert(activityFeedItems).values({
        projectId: project.id,
        actorUserId: f.actor,
        activityType: f.activityType,
        surfaceType: "feed_item",
        title: f.title,
        body: f.body,
        visibilityScope: f.vis ?? "project_wide",
        createdAt: new Date(Date.now() - f.daysAgo * day),
      });
    }
  }

  // ---- Selections (residential projects only, 8-10 items) ---------------
  if (residential) {
    type SelCatSeed = {
      name: string; description: string;
      items: Array<{
        title: string; description: string;
        status: "not_started" | "exploring" | "provisional" | "confirmed" | "revision_open" | "locked";
        allowanceCents: number;
        deadlineDaysOut?: number;
        affectsSchedule?: boolean;
        scheduleImpactNote?: string;
        urgencyNote?: string;
        options: Array<{
          name: string; tier: "included" | "upgrade" | "premium_upgrade";
          priceCents: number; leadTimeDays?: number;
          supplierName?: string; productSku?: string;
          swatchColor?: string;
        }>;
        decision?: { optionIndex: number; isConfirmed: boolean; isProvisional: boolean; priceDeltaCents: number };
      }>;
    };
    const selSeeds: SelCatSeed[] = [
      {
        name: "Countertops",
        description: "Kitchen countertop material and edge profile selections",
        items: [
          {
            title: "Kitchen countertop material",
            description: "Primary countertop surface for island and perimeter",
            status: "confirmed",
            allowanceCents: 350_000,
            options: [
              { name: "Caesarstone Calacatta Nuvo", tier: "included", priceCents: 340_000, supplierName: "Caesarstone", productSku: "CS-5131" },
              { name: "Quartzite Taj Mahal", tier: "upgrade", priceCents: 480_000, supplierName: "Levantina", productSku: "LV-TMH-3CM", leadTimeDays: 21 },
              { name: "Dekton Aura 15", tier: "premium_upgrade", priceCents: 620_000, supplierName: "Cosentino", productSku: "DK-AUR15", leadTimeDays: 28 },
            ],
            decision: { optionIndex: 1, isConfirmed: true, isProvisional: false, priceDeltaCents: 130_000 },
          },
          {
            title: "Countertop edge profile",
            description: "Edge detail for all exposed countertop edges",
            status: "provisional",
            allowanceCents: 0,
            options: [
              { name: "Eased edge (standard)", tier: "included", priceCents: 0 },
              { name: "Mitered edge", tier: "upgrade", priceCents: 45_000, leadTimeDays: 3 },
              { name: "Waterfall end panel", tier: "premium_upgrade", priceCents: 85_000, leadTimeDays: 5 },
            ],
            decision: { optionIndex: 2, isConfirmed: false, isProvisional: true, priceDeltaCents: 85_000 },
            deadlineDaysOut: 5,
            urgencyNote: "Fabrication template already measured — edge profile must be locked before cutting.",
          },
        ],
      },
      {
        name: "Backsplash",
        description: "Kitchen backsplash tile and installation pattern",
        items: [
          {
            title: "Backsplash tile",
            description: "Tile material for the kitchen backsplash between countertop and upper cabinets",
            status: "exploring",
            allowanceCents: 80_000,
            deadlineDaysOut: 14,
            options: [
              { name: "Centura Calacatta hex 2\"", tier: "included", priceCents: 75_000, supplierName: "Centura", productSku: "CT-HEX2-CAL", swatchColor: "#e8e4df" },
              { name: "Zellige handmade 4x4 — white", tier: "upgrade", priceCents: 120_000, supplierName: "Cle Tile", productSku: "CLE-ZLG-WHT", leadTimeDays: 14, swatchColor: "#f5f0e8" },
              { name: "Slab-matched quartzite", tier: "premium_upgrade", priceCents: 210_000, supplierName: "Levantina", leadTimeDays: 21 },
            ],
          },
        ],
      },
      {
        name: "Cabinetry Hardware",
        description: "Pulls, knobs, and hinges for all kitchen cabinetry",
        items: [
          {
            title: "Cabinet pulls — upper and lower",
            description: "Handle style for all kitchen drawers and doors",
            status: "confirmed",
            allowanceCents: 25_000,
            options: [
              { name: "Brushed brass bar pull 6\"", tier: "included", priceCents: 22_000, supplierName: "Richelieu", productSku: "RCH-BP6-BB", swatchColor: "#c9a84c" },
              { name: "Matte black edge pull", tier: "included", priceCents: 18_000, supplierName: "Richelieu", productSku: "RCH-EP-MB", swatchColor: "#2a2a2a" },
              { name: "Unlacquered brass knurled pull", tier: "upgrade", priceCents: 48_000, supplierName: "Schoolhouse", productSku: "SH-KP-ULB", leadTimeDays: 18, swatchColor: "#b8942e" },
            ],
            decision: { optionIndex: 0, isConfirmed: true, isProvisional: false, priceDeltaCents: 0 },
          },
        ],
      },
      {
        name: "Flooring",
        description: "Kitchen floor finish material",
        items: [
          {
            title: "Kitchen floor tile",
            description: "Floor finish for the entire kitchen footprint including pantry",
            status: "not_started",
            allowanceCents: 120_000,
            deadlineDaysOut: 21,
            affectsSchedule: true,
            scheduleImpactNote: "Floor tile must be selected before cabinet installation — base trim depends on tile thickness.",
            options: [
              { name: "Porcelain large format 24x24 — Grigio", tier: "included", priceCents: 110_000, supplierName: "Atlas Concorde", productSku: "AC-LF24-GR" },
              { name: "Engineered white oak herringbone", tier: "upgrade", priceCents: 180_000, supplierName: "Lauzon", productSku: "LZ-HB-WO", leadTimeDays: 10 },
            ],
          },
        ],
      },
      {
        name: "Plumbing Fixtures",
        description: "Sink, faucet, and related plumbing fixture selections",
        items: [
          {
            title: "Kitchen sink",
            description: "Primary kitchen sink — undermount into countertop",
            status: "confirmed",
            allowanceCents: 60_000,
            options: [
              { name: "Blanco Quatrus R15 32\" single bowl", tier: "included", priceCents: 55_000, supplierName: "Blanco", productSku: "BL-QR15-32" },
              { name: "Kohler Prolific 33\" undermount", tier: "upgrade", priceCents: 95_000, supplierName: "Kohler", productSku: "KH-5540-NA", leadTimeDays: 7 },
            ],
            decision: { optionIndex: 0, isConfirmed: true, isProvisional: false, priceDeltaCents: 0 },
          },
          {
            title: "Kitchen faucet",
            description: "Primary kitchen faucet with pull-down sprayer",
            status: "locked",
            allowanceCents: 40_000,
            options: [
              { name: "Brizo Litze pull-down — polished nickel", tier: "included", priceCents: 38_000, supplierName: "Brizo", productSku: "BZ-63064LF-PN", swatchColor: "#c0c0c0" },
              { name: "Waterstone Towson — unlacquered brass", tier: "premium_upgrade", priceCents: 125_000, supplierName: "Waterstone", productSku: "WS-5600-ULB", leadTimeDays: 28, swatchColor: "#b8942e" },
            ],
            decision: { optionIndex: 0, isConfirmed: true, isProvisional: false, priceDeltaCents: 0 },
          },
        ],
      },
      {
        name: "Lighting",
        description: "Kitchen pendant, recessed, and undercabinet lighting selections",
        items: [
          {
            title: "Island pendant lights",
            description: "3 pendants above the kitchen island — decorative fixture selection",
            status: "exploring",
            allowanceCents: 90_000,
            deadlineDaysOut: 18,
            affectsSchedule: true,
            scheduleImpactNote: "Electrical rough-in junction box placement depends on pendant dimensions.",
            options: [
              { name: "Schoolhouse Isaac 12\" — brushed brass", tier: "included", priceCents: 85_000, supplierName: "Schoolhouse", productSku: "SH-ISC12-BB" },
              { name: "Apparatus Studio Lantern — bronze", tier: "premium_upgrade", priceCents: 240_000, supplierName: "Apparatus Studio", productSku: "AP-LTRN-BZ", leadTimeDays: 42 },
            ],
          },
        ],
      },
    ];

    for (let ci = 0; ci < selSeeds.length; ci++) {
      const catSeed = selSeeds[ci];
      let cat = (
        await db.select().from(selectionCategories).where(and(eq(selectionCategories.projectId, project.id), eq(selectionCategories.name, catSeed.name))!).limit(1)
      )[0];
      if (!cat) {
        [cat] = await db.insert(selectionCategories).values({
          projectId: project.id,
          name: catSeed.name,
          description: catSeed.description,
          sortOrder: ci,
        }).returning();
      }

      for (let ii = 0; ii < catSeed.items.length; ii++) {
        const itemSeed = catSeed.items[ii];
        let item = (
          await db.select().from(selectionItems).where(and(eq(selectionItems.categoryId, cat.id), eq(selectionItems.title, itemSeed.title))!).limit(1)
        )[0];
        if (!item) {
          const isPublished = itemSeed.status !== "not_started";
          [item] = await db.insert(selectionItems).values({
            categoryId: cat.id,
            projectId: project.id,
            title: itemSeed.title,
            description: itemSeed.description,
            selectionItemStatus: itemSeed.status,
            allowanceCents: itemSeed.allowanceCents,
            decisionDeadline: itemSeed.deadlineDaysOut ? new Date(Date.now() + itemSeed.deadlineDaysOut * day) : null,
            affectsSchedule: itemSeed.affectsSchedule ?? false,
            scheduleImpactNote: itemSeed.scheduleImpactNote ?? null,
            urgencyNote: itemSeed.urgencyNote ?? null,
            isPublished,
            publishedAt: isPublished ? new Date(Date.now() - 20 * day) : null,
            publishedByUserId: isPublished ? pmUserId : null,
            sortOrder: ii,
          }).returning();
        }

        const optionIds: string[] = [];
        for (let oi = 0; oi < itemSeed.options.length; oi++) {
          const optSeed = itemSeed.options[oi];
          let opt = (
            await db.select().from(selectionOptions).where(and(eq(selectionOptions.selectionItemId, item.id), eq(selectionOptions.name, optSeed.name))!).limit(1)
          )[0];
          if (!opt) {
            [opt] = await db.insert(selectionOptions).values({
              selectionItemId: item.id,
              name: optSeed.name,
              optionTier: optSeed.tier,
              priceCents: optSeed.priceCents,
              leadTimeDays: optSeed.leadTimeDays ?? null,
              supplierName: optSeed.supplierName ?? null,
              productSku: optSeed.productSku ?? null,
              swatchColor: optSeed.swatchColor ?? null,
              sortOrder: oi,
            }).returning();
          }
          optionIds.push(opt.id);
        }

        // Seed the decision if specified
        if (itemSeed.decision && optionIds[itemSeed.decision.optionIndex]) {
          const selectedOptId = optionIds[itemSeed.decision.optionIndex];
          const existingDec = await db.select().from(selectionDecisions).where(eq(selectionDecisions.selectionItemId, item.id)).limit(1);
          if (!existingDec[0]) {
            await db.insert(selectionDecisions).values({
              selectionItemId: item.id,
              projectId: project.id,
              selectedOptionId: selectedOptId,
              decidedByUserId: clientUserId,
              isProvisional: itemSeed.decision.isProvisional,
              isConfirmed: itemSeed.decision.isConfirmed,
              isLocked: itemSeed.status === "locked",
              confirmedAt: itemSeed.decision.isConfirmed ? new Date(Date.now() - 10 * day) : null,
              lockedAt: itemSeed.status === "locked" ? new Date(Date.now() - 7 * day) : null,
              revisionExpiresAt: itemSeed.decision.isProvisional ? new Date(Date.now() + 2 * day) : null,
              priceDeltaCents: itemSeed.decision.priceDeltaCents,
            });
          }

          // Set recommendedOptionId on the item if the first option is included tier
          if (itemSeed.options[0]?.tier === "included" && optionIds[0]) {
            await db.update(selectionItems).set({ recommendedOptionId: optionIds[0] }).where(eq(selectionItems.id, item.id));
          }
        }
      }
    }
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
