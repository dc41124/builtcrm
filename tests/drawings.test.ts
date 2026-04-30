import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { drawingSets } from "@/db/schema";

import { POST as createSet } from "@/app/api/drawings/sets/route";
import { PATCH as patchSet } from "@/app/api/drawings/sets/[setId]/route";

import { IDS } from "./fixtures/seed";
import { jsonRequest } from "./helpers/request";
import { ASSUME } from "./helpers/session";

const PROJECT_A = IDS.projects.projectA;
const PROJECT_B = IDS.projects.projectB;
const UNKNOWN_PROJECT = "99999999-0000-0000-0000-000000000000";
const UNKNOWN_SET = "88888888-0000-0000-0000-000000000000";

const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

async function cleanupSets(projectId: string): Promise<void> {
  // ON DELETE CASCADE from drawing_sets → sheets/markups/measurements/comments.
  await db.delete(drawingSets).where(eq(drawingSets.projectId, projectId));
}

beforeEach(async () => {
  await cleanupSets(PROJECT_A);
  await cleanupSets(PROJECT_B);
});

const validSetBody = (projectId: string) => ({
  projectId,
  family: "architectural",
  name: "A-Series",
  filename: "test.pdf",
  fileSize: 1024,
  contentType: "application/pdf",
});

describe("POST /api/drawings/sets — create (write = ALL_CONTRACTOR)", () => {
  it("contractor can create a drawing set on Project A", async () => {
    ASSUME.contractor();
    const res = await createSet(jsonRequest(validSetBody(PROJECT_A)));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { setId: string; version: number };
    expect(body.setId).toBeTruthy();
    expect(body.version).toBe(1);
  });

  it("contractor gets implicit access to Project B (org-staff fallback)", async () => {
    ASSUME.contractor();
    const res = await createSet(jsonRequest(validSetBody(PROJECT_B)));
    expect(res.status).toBe(200);
  });

  it("subcontractor cannot create a set on Project A — 403 (write denied)", async () => {
    ASSUME.subcontractor();
    const res = await createSet(jsonRequest(validSetBody(PROJECT_A)));
    expect(res.status).toBe(403);
  });

  it("commercial client cannot create a set on Project A — 403", async () => {
    ASSUME.commercial();
    const res = await createSet(jsonRequest(validSetBody(PROJECT_A)));
    expect(res.status).toBe(403);
  });

  it("residential client cannot create a set on Project A — 403", async () => {
    ASSUME.residential();
    const res = await createSet(jsonRequest(validSetBody(PROJECT_A)));
    expect(res.status).toBe(403);
  });

  it("subcontractor on Project B (no membership) — 403", async () => {
    // Sub has no project_user_membership on Project B. getEffectiveContext
    // throws "forbidden" before the write-permission check fires.
    ASSUME.subcontractor();
    const res = await createSet(jsonRequest(validSetBody(PROJECT_B)));
    expect(res.status).toBe(403);
  });

  it("unknown project returns 404", async () => {
    ASSUME.contractor();
    const res = await createSet(jsonRequest(validSetBody(UNKNOWN_PROJECT)));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/drawings/sets/[setId] — edit (write = ALL_CONTRACTOR)", () => {
  // Helper: create a set as contractor so PATCH tests have something real
  // to target. Returns the set id.
  async function seedSet(projectId: string): Promise<string> {
    ASSUME.contractor();
    const res = await createSet(jsonRequest(validSetBody(projectId)));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { setId: string };
    return body.setId;
  }

  it("contractor can rename their own set", async () => {
    const setId = await seedSet(PROJECT_A);
    ASSUME.contractor();
    const res = await patchSet(
      jsonRequest({ name: "A-Series (Rev 2)" }),
      params({ setId }),
    );
    expect(res.status).toBe(200);
  });

  it("subcontractor cannot edit set metadata — 403", async () => {
    const setId = await seedSet(PROJECT_A);
    ASSUME.subcontractor();
    const res = await patchSet(
      jsonRequest({ name: "Sneaky rename" }),
      params({ setId }),
    );
    expect(res.status).toBe(403);
  });

  it("non-existent setId returns 404", async () => {
    ASSUME.contractor();
    const res = await patchSet(
      jsonRequest({ name: "Whatever" }),
      params({ setId: UNKNOWN_SET }),
    );
    expect(res.status).toBe(404);
  });
});
