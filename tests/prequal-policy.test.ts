import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

// Bypass the plan gate — these tests exercise prequal logic, not billing.
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
  checkPrequalForAssignment,
  createPrequalTemplate,
  decidePrequalSubmission,
  grantProjectExemption,
  inviteSubToPrequalify,
  setPrequalEnforcementMode,
  submitPrequalSubmission,
} from "@/domain/prequal";

import { IDS } from "./fixtures/seed";
import { ASSUME } from "./helpers/session";

const CONTRACTOR_ORG = IDS.orgs.contractor;
const SUB_ORG = IDS.orgs.subcontractor;
const PROJECT_A = IDS.projects.projectA;

// Org-scoped cleanup. Dev + tests share the same DATABASE_URL (memory:
// "single shared DATABASE_URL for dev + testing"), so an unscoped delete
// blows away dev seed data on every test run. Scope every delete to the
// test contractor org's rows.
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

async function createTemplateAsContractor() {
  ASSUME.contractor();
  const { id } = await createPrequalTemplate({
    session: { appUserId: IDS.users.contractorAdmin },
    name: "Test General",
    questions: [],
    scoringRules: { passThreshold: 0, gatingFailValues: {} },
  });
  return id;
}

async function approveSubmissionForPair() {
  const templateId = await createTemplateAsContractor();
  ASSUME.contractor();
  const { submissionId } = await inviteSubToPrequalify({
    session: { appUserId: IDS.users.contractorAdmin },
    subOrgId: SUB_ORG,
    templateId,
  });
  ASSUME.subcontractor();
  await submitPrequalSubmission({
    session: { appUserId: IDS.users.subcontractor },
    submissionId,
    answers: {},
  });
  ASSUME.contractor();
  await decidePrequalSubmission({
    session: { appUserId: IDS.users.contractorAdmin },
    submissionId,
    decision: { kind: "approve", reviewerNotes: null },
  });
  return submissionId;
}

describe("checkPrequalForAssignment — enforcement matrix", () => {
  beforeEach(async () => {
    await resetPrequalRows();
  });

  it("off mode always returns ok", async () => {
    ASSUME.contractor();
    await setPrequalEnforcementMode({
      session: { appUserId: IDS.users.contractorAdmin },
      mode: "off",
    });
    const result = await checkPrequalForAssignment(
      CONTRACTOR_ORG,
      SUB_ORG,
      PROJECT_A,
    );
    expect(result.kind).toBe("ok");
  });

  it("warn mode + no submission returns warn", async () => {
    ASSUME.contractor();
    await setPrequalEnforcementMode({
      session: { appUserId: IDS.users.contractorAdmin },
      mode: "warn",
    });
    const result = await checkPrequalForAssignment(
      CONTRACTOR_ORG,
      SUB_ORG,
      PROJECT_A,
    );
    expect(result.kind).toBe("warn");
    if (result.kind !== "ok") {
      expect(result.activeStatus).toBe("none");
    }
  });

  it("block mode + no submission returns block", async () => {
    ASSUME.contractor();
    await setPrequalEnforcementMode({
      session: { appUserId: IDS.users.contractorAdmin },
      mode: "block",
    });
    const result = await checkPrequalForAssignment(
      CONTRACTOR_ORG,
      SUB_ORG,
      PROJECT_A,
    );
    expect(result.kind).toBe("block");
  });

  it("approved submission returns ok in any mode", async () => {
    await approveSubmissionForPair();
    for (const mode of ["off", "warn", "block"] as const) {
      ASSUME.contractor();
      await setPrequalEnforcementMode({
        session: { appUserId: IDS.users.contractorAdmin },
        mode,
      });
      const result = await checkPrequalForAssignment(
        CONTRACTOR_ORG,
        SUB_ORG,
        PROJECT_A,
      );
      expect(result.kind).toBe("ok");
    }
  });

  it("block mode + active project exemption returns ok", async () => {
    ASSUME.contractor();
    await setPrequalEnforcementMode({
      session: { appUserId: IDS.users.contractorAdmin },
      mode: "block",
    });
    await grantProjectExemption({
      session: { appUserId: IDS.users.contractorAdmin },
      projectId: PROJECT_A,
      subOrgId: SUB_ORG,
      reason: "trusted partner — compliance pending",
    });
    const result = await checkPrequalForAssignment(
      CONTRACTOR_ORG,
      SUB_ORG,
      PROJECT_A,
    );
    expect(result.kind).toBe("ok");
  });

  it("warn mode + project exemption still warns (exemption is block-only)", async () => {
    ASSUME.contractor();
    await setPrequalEnforcementMode({
      session: { appUserId: IDS.users.contractorAdmin },
      mode: "warn",
    });
    await grantProjectExemption({
      session: { appUserId: IDS.users.contractorAdmin },
      projectId: PROJECT_A,
      subOrgId: SUB_ORG,
      reason: "see exemption in block mode",
    });
    const result = await checkPrequalForAssignment(
      CONTRACTOR_ORG,
      SUB_ORG,
      PROJECT_A,
    );
    expect(result.kind).toBe("warn");
  });
});

describe("cross-org leakage", () => {
  beforeEach(async () => {
    await resetPrequalRows();
  });

  it("a sub cannot create templates", async () => {
    ASSUME.subcontractor();
    await expect(
      createPrequalTemplate({
        session: { appUserId: IDS.users.subcontractor },
        name: "Hacked",
        questions: [],
      }),
    ).rejects.toThrow();
  });

  it("a contractor cannot fill another sub's submission", async () => {
    const templateId = await createTemplateAsContractor();
    ASSUME.contractor();
    const { submissionId } = await inviteSubToPrequalify({
      session: { appUserId: IDS.users.contractorAdmin },
      subOrgId: SUB_ORG,
      templateId,
    });
    // Contractor tries to call submit (sub-only write).
    ASSUME.contractor();
    await expect(
      submitPrequalSubmission({
        session: { appUserId: IDS.users.contractorAdmin },
        submissionId,
        answers: {},
      }),
    ).rejects.toThrow();
  });

  it("a sub cannot decide their own submission", async () => {
    const templateId = await createTemplateAsContractor();
    ASSUME.contractor();
    const { submissionId } = await inviteSubToPrequalify({
      session: { appUserId: IDS.users.contractorAdmin },
      subOrgId: SUB_ORG,
      templateId,
    });
    ASSUME.subcontractor();
    await submitPrequalSubmission({
      session: { appUserId: IDS.users.subcontractor },
      submissionId,
      answers: {},
    });
    // Sub tries to approve their own submission.
    ASSUME.subcontractor();
    await expect(
      decidePrequalSubmission({
        session: { appUserId: IDS.users.subcontractor },
        submissionId,
        decision: { kind: "approve", reviewerNotes: null },
      }),
    ).rejects.toThrow();
  });
});
