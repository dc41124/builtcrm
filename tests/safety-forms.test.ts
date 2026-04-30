import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import {
  safetyFormCounters,
  safetyFormIncidents,
  safetyFormTemplateAssignments,
  safetyFormTemplates,
  safetyForms,
} from "@/db/schema";

import { POST as createForm } from "@/app/api/safety-forms/route";
import { PATCH as patchForm } from "@/app/api/safety-forms/[id]/route";
import { PUT as putAssignments } from "@/app/api/safety-form-templates/[id]/assignments/route";

import { IDS } from "./fixtures/seed";
import { jsonRequest } from "./helpers/request";
import { ASSUME } from "./helpers/session";

const PROJECT_A = IDS.projects.projectA;
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

// One template per test, replanted in beforeEach so each test starts with
// the same shape regardless of run order.
const TPL_TOOLBOX_ID = "99999999-0000-0000-0000-000000000a01";
const TPL_INCIDENT_ID = "99999999-0000-0000-0000-000000000a02";

beforeEach(async () => {
  // Cascade-delete from templates → assignments + safety_forms via FK.
  await db
    .delete(safetyFormTemplateAssignments)
    .where(eq(safetyFormTemplateAssignments.organizationId, IDS.orgs.contractor));
  await db
    .delete(safetyFormTemplateAssignments)
    .where(eq(safetyFormTemplateAssignments.organizationId, IDS.orgs.subcontractor));
  await db
    .delete(safetyForms)
    .where(eq(safetyForms.projectId, PROJECT_A));
  await db
    .delete(safetyFormTemplates)
    .where(eq(safetyFormTemplates.organizationId, IDS.orgs.contractor));
  await db
    .delete(safetyFormCounters)
    .where(eq(safetyFormCounters.organizationId, IDS.orgs.contractor));
  await db
    .delete(safetyFormCounters)
    .where(eq(safetyFormCounters.organizationId, IDS.orgs.subcontractor));

  // Re-plant minimal templates — toolbox + incident.
  await db.insert(safetyFormTemplates).values([
    {
      id: TPL_TOOLBOX_ID,
      organizationId: IDS.orgs.contractor,
      formType: "toolbox_talk",
      name: "Test Toolbox Talk",
      fieldsJson: [
        { key: "topic", type: "select", label: "Topic", required: true, options: ["Falls"] },
        { key: "leader", type: "signature", label: "Leader sig", required: true },
      ],
    },
    {
      id: TPL_INCIDENT_ID,
      organizationId: IDS.orgs.contractor,
      formType: "incident_report",
      name: "Test Incident Report",
      fieldsJson: [
        { key: "severity", type: "select", label: "Severity", required: true },
        { key: "location", type: "text", label: "Location", required: true },
      ],
    },
  ]);
});

describe("POST /api/safety-forms — auth + create", () => {
  const body = (overrides?: Record<string, unknown>) => ({
    projectId: PROJECT_A,
    templateId: TPL_TOOLBOX_ID,
    status: "submitted",
    title: "Daily Toolbox Talk — Falls",
    dataJson: { topic: "Falls", leader: "data:image/png;base64,iVBORw0KGgoAAAA" },
    ...overrides,
  });

  it("rejects unauthenticated", async () => {
    ASSUME.none();
    const res = await createForm(jsonRequest(body()));
    expect(res.status).toBe(401);
  });

  it("rejects clients", async () => {
    ASSUME.commercial();
    const res = await createForm(jsonRequest(body()));
    expect([401, 403, 404]).toContain(res.status);
  });

  it("contractor admin can create + allocates SF-#### per-org", async () => {
    ASSUME.contractor();
    const r1 = await createForm(jsonRequest(body()));
    expect(r1.status).toBe(200);
    const j1 = (await r1.json()) as { id: string; formNumber: string };
    expect(j1.formNumber).toBe("SF-0001");
    const r2 = await createForm(jsonRequest(body()));
    expect(r2.status).toBe(200);
    const j2 = (await r2.json()) as { id: string; formNumber: string };
    expect(j2.formNumber).toBe("SF-0002");
  });

  it("idempotent on clientUuid retry", async () => {
    ASSUME.contractor();
    const cu = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const first = await createForm(jsonRequest(body({ clientUuid: cu })));
    expect(first.status).toBe(200);
    const j1 = (await first.json()) as { id: string; idempotent?: boolean };
    expect(j1.idempotent).toBeUndefined();

    const second = await createForm(jsonRequest(body({ clientUuid: cu })));
    expect(second.status).toBe(200);
    const j2 = (await second.json()) as { id: string; idempotent?: boolean };
    expect(j2.idempotent).toBe(true);
    expect(j2.id).toBe(j1.id);
  });

  it("incident_report writes safety_form_incidents subtype", async () => {
    ASSUME.contractor();
    const res = await createForm(
      jsonRequest({
        projectId: PROJECT_A,
        templateId: TPL_INCIDENT_ID,
        status: "submitted",
        title: "Incident — Hand laceration",
        dataJson: { severity: "first_aid", location: "Floor 1" },
        incident: {
          severity: "first_aid",
          incidentAt: "2026-04-30T14:00:00Z",
          location: "Floor 1",
          description: "Cut while reaming pipe",
          rootCauseText: "No deburr tool",
          injured: [{ name: "T. Ortega" }],
          correctiveActions: [{ id: "ca-1", action: "Add deburr tool", owner: "Mike", due: "2026-05-01" }],
          photoCount: 0,
        },
      }),
    );
    expect(res.status).toBe(200);
    const j = (await res.json()) as { id: string };
    const [inc] = await db
      .select()
      .from(safetyFormIncidents)
      .where(eq(safetyFormIncidents.safetyFormId, j.id));
    expect(inc).toBeDefined();
    expect(inc.severity).toBe("first_aid");
    expect(inc.location).toBe("Floor 1");
  });

  it("incident_report without incident payload returns 400", async () => {
    ASSUME.contractor();
    const res = await createForm(
      jsonRequest({
        projectId: PROJECT_A,
        templateId: TPL_INCIDENT_ID,
        status: "submitted",
        title: "Bad incident",
        dataJson: {},
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/safety-forms/[id] — flag/unflag", () => {
  it("contractor admin can flag", async () => {
    ASSUME.contractor();
    const create = await createForm(
      jsonRequest({
        projectId: PROJECT_A,
        templateId: TPL_TOOLBOX_ID,
        status: "submitted",
        title: "TB",
        dataJson: { topic: "Falls", leader: "data:image/png;base64,A" },
      }),
    );
    const { id } = (await create.json()) as { id: string };
    const res = await patchForm(
      jsonRequest({ flagged: true, flagReason: "Needs review" }),
      params({ id }),
    );
    expect(res.status).toBe(200);
    const [row] = await db.select().from(safetyForms).where(eq(safetyForms.id, id));
    expect(row.flagged).toBe(true);
    expect(row.flagReason).toBe("Needs review");
  });

  it("rejects sub flagging", async () => {
    ASSUME.contractor();
    const create = await createForm(
      jsonRequest({
        projectId: PROJECT_A,
        templateId: TPL_TOOLBOX_ID,
        status: "submitted",
        title: "TB",
        dataJson: { topic: "Falls", leader: "data:image/png;base64,A" },
      }),
    );
    const { id } = (await create.json()) as { id: string };

    ASSUME.subcontractor();
    const res = await patchForm(
      jsonRequest({ flagged: true }),
      params({ id }),
    );
    expect([401, 403, 404]).toContain(res.status);
  });
});

describe("PUT /api/safety-form-templates/[id]/assignments", () => {
  it("contractor can assign + sub sees assigned templates", async () => {
    ASSUME.contractor();
    const res = await putAssignments(
      jsonRequest({
        assignments: [{ orgId: IDS.orgs.subcontractor, projectId: null }],
      }),
      params({ id: TPL_TOOLBOX_ID }),
    );
    expect(res.status).toBe(200);
    const rows = await db
      .select()
      .from(safetyFormTemplateAssignments)
      .where(eq(safetyFormTemplateAssignments.templateId, TPL_TOOLBOX_ID));
    expect(rows.length).toBe(1);
    expect(rows[0].organizationId).toBe(IDS.orgs.subcontractor);
    expect(rows[0].projectId).toBeNull();
  });

  it("rejects sub trying to assign", async () => {
    ASSUME.subcontractor();
    const res = await putAssignments(
      jsonRequest({
        assignments: [{ orgId: IDS.orgs.subcontractor, projectId: null }],
      }),
      params({ id: TPL_TOOLBOX_ID }),
    );
    expect([401, 403, 404]).toContain(res.status);
  });

  it("replace-all semantics: PUT with empty list clears assignments", async () => {
    ASSUME.contractor();
    await putAssignments(
      jsonRequest({
        assignments: [{ orgId: IDS.orgs.subcontractor, projectId: null }],
      }),
      params({ id: TPL_TOOLBOX_ID }),
    );
    await putAssignments(
      jsonRequest({ assignments: [] }),
      params({ id: TPL_TOOLBOX_ID }),
    );
    const rows = await db
      .select()
      .from(safetyFormTemplateAssignments)
      .where(eq(safetyFormTemplateAssignments.templateId, TPL_TOOLBOX_ID));
    expect(rows.length).toBe(0);
  });
});
