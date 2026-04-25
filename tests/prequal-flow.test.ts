import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

vi.mock("@/domain/policies/plan", async () => {
  const actual = await vi.importActual<typeof import("@/domain/policies/plan")>(
    "@/domain/policies/plan",
  );
  return { ...actual, requireFeature: vi.fn(() => undefined) };
});

import { db } from "@/db/client";
import {
  organizations,
  prequalProjectExemptions,
  prequalSubmissions,
  prequalTemplates,
} from "@/db/schema";
import {
  createPrequalTemplate,
  decidePrequalSubmission,
  inviteSubToPrequalify,
  submitPrequalSubmission,
} from "@/domain/prequal";
import { getActivePrequalForPair } from "@/domain/loaders/prequal";

import { IDS } from "./fixtures/seed";
import { ASSUME } from "./helpers/session";

const CONTRACTOR_ORG = IDS.orgs.contractor;
const SUB_ORG = IDS.orgs.subcontractor;
const CONTRACTOR_USER = IDS.users.contractorAdmin;
const SUB_USER = IDS.users.subcontractor;

// Org-scoped cleanup — dev + tests share DATABASE_URL, so unscoped
// deletes wipe the dev seed.
async function resetPrequalRows() {
  await db
    .delete(prequalProjectExemptions)
    .where(eq(prequalProjectExemptions.contractorOrgId, CONTRACTOR_ORG));
  await db
    .delete(prequalSubmissions)
    .where(eq(prequalSubmissions.contractorOrgId, CONTRACTOR_ORG));
  await db
    .delete(prequalTemplates)
    .where(eq(prequalTemplates.orgId, CONTRACTOR_ORG));
  await db
    .update(organizations)
    .set({ prequalEnforcementMode: "off" })
    .where(eq(organizations.id, CONTRACTOR_ORG));
}

describe("prequal happy-path flow", () => {
  beforeEach(async () => {
    await resetPrequalRows();
  });

  it("invite → submit → approve → badge reads approved + expires set", async () => {
    // 1. Contractor creates a template with weighted + gating questions.
    ASSUME.contractor();
    const { id: templateId } = await createPrequalTemplate({
      session: { appUserId: CONTRACTOR_USER },
      name: "General",
      validityMonths: 12,
      questions: [
        {
          key: "yrs",
          label: "Years in business",
          type: "number",
          required: true,
          scoreBands: [
            { min: 0, max: 2, points: 0 },
            { min: 3, max: 5, points: 5 },
            { min: 6, max: 999, points: 10 },
          ],
        },
        {
          key: "ins",
          label: "$2M GL insurance?",
          type: "yes_no",
          required: true,
          weight: 15,
        },
        {
          key: "bk",
          label: "Bankruptcy in last 5 yrs?",
          type: "yes_no",
          required: true,
          weight: 0,
          gating: true,
        },
      ],
      scoringRules: {
        passThreshold: 20,
        gatingFailValues: { bk: true },
      },
    });
    expect(templateId).toBeTruthy();

    // 2. Contractor invites the sub.
    ASSUME.contractor();
    const { submissionId } = await inviteSubToPrequalify({
      session: { appUserId: CONTRACTOR_USER },
      subOrgId: SUB_ORG,
      templateId,
    });
    expect(submissionId).toBeTruthy();

    // 3. Sub submits with passing answers.
    ASSUME.subcontractor();
    const submitResult = await submitPrequalSubmission({
      session: { appUserId: SUB_USER },
      submissionId,
      answers: { yrs: 12, ins: true, bk: false },
    });
    expect(submitResult.scoreTotal).toBe(25); // 10 + 15
    expect(submitResult.gatingFailures).toEqual([]);

    // 4. Contractor approves.
    ASSUME.contractor();
    await decidePrequalSubmission({
      session: { appUserId: CONTRACTOR_USER },
      submissionId,
      decision: { kind: "approve", reviewerNotes: "Looks good." },
    });

    // 5. Submission row reflects approval + expires_at.
    const [row] = await db
      .select()
      .from(prequalSubmissions)
      .where(eq(prequalSubmissions.id, submissionId))
      .limit(1);
    expect(row.status).toBe("approved");
    expect(row.expiresAt).not.toBeNull();
    if (row.expiresAt && row.reviewedAt) {
      // ~12 months later, give or take a day.
      const monthsApart =
        (row.expiresAt.getTime() - row.reviewedAt.getTime()) /
        (1000 * 60 * 60 * 24 * 30);
      expect(monthsApart).toBeGreaterThan(11.5);
      expect(monthsApart).toBeLessThan(12.5);
    }

    // 6. Badge loader reads approved.
    const active = await getActivePrequalForPair(CONTRACTOR_ORG, SUB_ORG);
    expect(active.status).toBe("approved");
    expect(active.submissionId).toBe(submissionId);
  });

  it("gating failure blocks straight approve; override path works", async () => {
    ASSUME.contractor();
    const { id: templateId } = await createPrequalTemplate({
      session: { appUserId: CONTRACTOR_USER },
      name: "Gated",
      questions: [
        {
          key: "bk",
          label: "Bankruptcy?",
          type: "yes_no",
          required: true,
          weight: 0,
          gating: true,
        },
      ],
      scoringRules: { passThreshold: 0, gatingFailValues: { bk: true } },
    });
    ASSUME.contractor();
    const { submissionId } = await inviteSubToPrequalify({
      session: { appUserId: CONTRACTOR_USER },
      subOrgId: SUB_ORG,
      templateId,
    });
    ASSUME.subcontractor();
    const r = await submitPrequalSubmission({
      session: { appUserId: SUB_USER },
      submissionId,
      answers: { bk: true },
    });
    expect(r.gatingFailures).toEqual(["bk"]);

    // Approve without override should be rejected.
    ASSUME.contractor();
    await expect(
      decidePrequalSubmission({
        session: { appUserId: CONTRACTOR_USER },
        submissionId,
        decision: { kind: "approve", reviewerNotes: null },
      }),
    ).rejects.toThrow(/gating/i);

    // Approve WITH override should succeed.
    ASSUME.contractor();
    await decidePrequalSubmission({
      session: { appUserId: CONTRACTOR_USER },
      submissionId,
      decision: { kind: "approve", reviewerNotes: "Investigated; OK." },
      overrideGating: true,
    });
    const [row] = await db
      .select()
      .from(prequalSubmissions)
      .where(eq(prequalSubmissions.id, submissionId))
      .limit(1);
    expect(row.status).toBe("approved");
  });

  it("rejection sets status + reviewer notes; sub can read history", async () => {
    ASSUME.contractor();
    const { id: templateId } = await createPrequalTemplate({
      session: { appUserId: CONTRACTOR_USER },
      name: "Rejection path",
      questions: [],
    });
    ASSUME.contractor();
    const { submissionId } = await inviteSubToPrequalify({
      session: { appUserId: CONTRACTOR_USER },
      subOrgId: SUB_ORG,
      templateId,
    });
    ASSUME.subcontractor();
    await submitPrequalSubmission({
      session: { appUserId: SUB_USER },
      submissionId,
      answers: {},
    });
    ASSUME.contractor();
    await decidePrequalSubmission({
      session: { appUserId: CONTRACTOR_USER },
      submissionId,
      decision: { kind: "reject", reviewerNotes: "Insurance below floor." },
    });
    const [row] = await db
      .select()
      .from(prequalSubmissions)
      .where(eq(prequalSubmissions.id, submissionId))
      .limit(1);
    expect(row.status).toBe("rejected");
    expect(row.reviewerNotes).toMatch(/insurance/i);
    expect(row.expiresAt).toBeNull();

    const active = await getActivePrequalForPair(CONTRACTOR_ORG, SUB_ORG);
    expect(active.status).toBe("rejected");
  });
});
