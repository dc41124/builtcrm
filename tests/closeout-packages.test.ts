import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { closeoutCounters, closeoutPackages } from "@/db/schema";

import { POST as createPackage } from "@/app/api/closeout-packages/route";
import { POST as addSection } from "@/app/api/closeout-packages/[id]/sections/route";

import { IDS } from "./fixtures/seed";
import { jsonRequest } from "./helpers/request";
import { ASSUME } from "./helpers/session";

const PROJECT_A = IDS.projects.projectA;
const PROJECT_B = IDS.projects.projectB;
const UNKNOWN_PROJECT = "99999999-0000-0000-0000-000000000000";
const UNKNOWN_PACKAGE = "88888888-0000-0000-0000-000000000000";

const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

beforeEach(async () => {
  // ON DELETE CASCADE from closeout_packages → sections/items/comments.
  await db
    .delete(closeoutPackages)
    .where(eq(closeoutPackages.projectId, PROJECT_A));
  await db
    .delete(closeoutPackages)
    .where(eq(closeoutPackages.projectId, PROJECT_B));
  // Reset the per-org-per-year counter so each test starts at 1.
  await db
    .delete(closeoutCounters)
    .where(eq(closeoutCounters.organizationId, IDS.orgs.contractor));
});

describe("POST /api/closeout-packages — only contractor_admin/contractor_pm can create", () => {
  const body = (projectId: string) => ({
    projectId,
    title: "Test closeout",
  });

  it("contractor can create a package on Project A", async () => {
    ASSUME.contractor();
    const res = await createPackage(jsonRequest(body(PROJECT_A)));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { id: string; numberLabel: string };
    expect(json.id).toBeTruthy();
    expect(json.numberLabel).toMatch(/^CO-\d{4}-\d{4}$/);
  });

  it("contractor gets implicit access to Project B (org-staff fallback)", async () => {
    ASSUME.contractor();
    const res = await createPackage(jsonRequest(body(PROJECT_B)));
    expect(res.status).toBe(200);
  });

  it("subcontractor cannot create a package — 403", async () => {
    ASSUME.subcontractor();
    const res = await createPackage(jsonRequest(body(PROJECT_A)));
    expect(res.status).toBe(403);
  });

  it("commercial client cannot create a package — 403", async () => {
    ASSUME.commercial();
    const res = await createPackage(jsonRequest(body(PROJECT_A)));
    expect(res.status).toBe(403);
  });

  it("residential client cannot create a package — 403", async () => {
    ASSUME.residential();
    const res = await createPackage(jsonRequest(body(PROJECT_A)));
    expect(res.status).toBe(403);
  });

  it("subcontractor on Project B (no membership) — 403", async () => {
    ASSUME.subcontractor();
    const res = await createPackage(jsonRequest(body(PROJECT_B)));
    expect(res.status).toBe(403);
  });

  it("unknown project returns 404", async () => {
    ASSUME.contractor();
    const res = await createPackage(jsonRequest(body(UNKNOWN_PROJECT)));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/closeout-packages/[id]/sections — only contractor can add", () => {
  async function seedPackage(): Promise<string> {
    ASSUME.contractor();
    const res = await createPackage(jsonRequest({ projectId: PROJECT_A }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { id: string };
    return json.id;
  }

  it("subcontractor cannot add a section — 403", async () => {
    const packageId = await seedPackage();
    ASSUME.subcontractor();
    const res = await addSection(
      jsonRequest({ sectionType: "om_manuals" }),
      params({ id: packageId }),
    );
    expect(res.status).toBe(403);
  });

  it("non-existent package id returns 404", async () => {
    ASSUME.contractor();
    const res = await addSection(
      jsonRequest({ sectionType: "om_manuals" }),
      params({ id: UNKNOWN_PACKAGE }),
    );
    expect(res.status).toBe(404);
  });
});
