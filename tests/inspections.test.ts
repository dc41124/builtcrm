import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { inspectionTemplates, inspections } from "@/db/schema";

import { POST as createInspection } from "@/app/api/inspections/route";
import { POST as createTemplate } from "@/app/api/inspection-templates/route";

import { IDS } from "./fixtures/seed";
import { jsonRequest } from "./helpers/request";
import { ASSUME } from "./helpers/session";

const PROJECT_A = IDS.projects.projectA;
const PROJECT_B = IDS.projects.projectB;
const UNKNOWN_PROJECT = "99999999-0000-0000-0000-000000000000";
const ANY_TEMPLATE_ID = "77777777-0000-0000-0000-000000000001";

beforeEach(async () => {
  await db.delete(inspections).where(eq(inspections.projectId, PROJECT_A));
  await db.delete(inspections).where(eq(inspections.projectId, PROJECT_B));
});

afterEach(async () => {
  // Clean up any templates created by the happy-path tests.
  await db
    .delete(inspectionTemplates)
    .where(eq(inspectionTemplates.orgId, IDS.orgs.contractor));
});

describe("POST /api/inspections — only contractor_admin/contractor_pm can create", () => {
  // Auth gate fires before template lookup, so a stub templateId is fine
  // for the negative paths — the route returns 403 before checking it.
  const validBody = (projectId: string) => ({
    projectId,
    templateId: ANY_TEMPLATE_ID,
    zone: "Level 1",
  });

  it("subcontractor cannot create inspection — 403", async () => {
    ASSUME.subcontractor();
    const res = await createInspection(jsonRequest(validBody(PROJECT_A)));
    expect(res.status).toBe(403);
  });

  it("commercial client cannot create inspection — 403", async () => {
    ASSUME.commercial();
    const res = await createInspection(jsonRequest(validBody(PROJECT_A)));
    expect(res.status).toBe(403);
  });

  it("residential client cannot create inspection — 403", async () => {
    ASSUME.residential();
    const res = await createInspection(jsonRequest(validBody(PROJECT_A)));
    expect(res.status).toBe(403);
  });

  it("subcontractor on Project B (no membership) — 403", async () => {
    ASSUME.subcontractor();
    const res = await createInspection(jsonRequest(validBody(PROJECT_B)));
    expect(res.status).toBe(403);
  });

  it("unknown project returns 404", async () => {
    ASSUME.contractor();
    const res = await createInspection(jsonRequest(validBody(UNKNOWN_PROJECT)));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/inspection-templates — contractor-only", () => {
  const validTemplateBody = (name: string) => ({
    name,
    tradeCategory: "framing",
    phase: "rough" as const,
    description: "Test template",
    lineItems: [
      { key: "anchor-bolts", orderIndex: 0, label: "Anchor bolts present" },
      { key: "blocking", orderIndex: 1, label: "Blocking installed" },
    ],
  });

  it("contractor can create a custom template", async () => {
    ASSUME.contractor();
    const res = await createTemplate(
      jsonRequest(validTemplateBody("Test Template A")),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBeTruthy();
  });

  it("subcontractor cannot create a template — 403", async () => {
    ASSUME.subcontractor();
    const res = await createTemplate(
      jsonRequest(validTemplateBody("Sneaky Sub Template")),
    );
    expect(res.status).toBe(403);
  });

  it("commercial client cannot create a template — 403", async () => {
    ASSUME.commercial();
    const res = await createTemplate(
      jsonRequest(validTemplateBody("Commercial Template")),
    );
    expect(res.status).toBe(403);
  });

  it("residential client cannot create a template — 403", async () => {
    ASSUME.residential();
    const res = await createTemplate(
      jsonRequest(validTemplateBody("Residential Template")),
    );
    expect(res.status).toBe(403);
  });
});
