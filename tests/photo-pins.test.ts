import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import {
  documents,
  drawingSets,
  drawingSheets,
  photoPins,
  projectOrganizationMemberships,
} from "@/db/schema";

import { POST as createPin } from "@/app/api/photo-pins/route";
import { DELETE as deletePin, PATCH as patchPin } from "@/app/api/photo-pins/[id]/route";

import { IDS } from "./fixtures/seed";
import { jsonRequest, jsonRequestWithMethod, emptyRequest } from "./helpers/request";
import { ASSUME } from "./helpers/session";

const PROJECT_A = IDS.projects.projectA;
const PROJECT_B = IDS.projects.projectB;
const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

const SET_A_ID = "99999999-aaaa-0000-0000-000000000001";
const SHEET_A_ID = "99999999-aaaa-0000-0000-000000000011";
const SET_B_ID = "99999999-aaaa-0000-0000-000000000002";
const SHEET_B_ID = "99999999-aaaa-0000-0000-000000000012";
const PHOTO_A1_ID = "99999999-aaaa-0000-0000-0000000000a1";
const PHOTO_A2_ID = "99999999-aaaa-0000-0000-0000000000a2";
const PHOTO_B_ID = "99999999-aaaa-0000-0000-0000000000b1";

beforeAll(async () => {
  // Subcontractor org → Project A membership (so the sub user can access
  // PROJECT_A through getEffectiveContext for the cross-tenant test).
  await db
    .insert(projectOrganizationMemberships)
    .values({
      projectId: PROJECT_A,
      organizationId: IDS.orgs.subcontractor,
      membershipType: "subcontractor",
      membershipStatus: "active",
    })
    .onConflictDoNothing();

  // Drawing set + sheet on PROJECT_A
  await db
    .insert(drawingSets)
    .values({
      id: SET_A_ID,
      projectId: PROJECT_A,
      family: "Architectural",
      name: "Test set A",
      version: 1,
      uploadedByUserId: IDS.users.contractorAdmin,
    })
    .onConflictDoNothing();
  await db
    .insert(drawingSheets)
    .values({
      id: SHEET_A_ID,
      setId: SET_A_ID,
      pageIndex: 0,
      sheetNumber: "A-100",
      sheetTitle: "First floor plan",
    })
    .onConflictDoNothing();

  // Drawing set + sheet on PROJECT_B (cross-project test target)
  await db
    .insert(drawingSets)
    .values({
      id: SET_B_ID,
      projectId: PROJECT_B,
      family: "Architectural",
      name: "Test set B",
      version: 1,
      uploadedByUserId: IDS.users.contractorAdmin,
    })
    .onConflictDoNothing();
  await db
    .insert(drawingSheets)
    .values({
      id: SHEET_B_ID,
      setId: SET_B_ID,
      pageIndex: 0,
      sheetNumber: "B-100",
      sheetTitle: "Second sheet",
    })
    .onConflictDoNothing();

  // Two photos on PROJECT_A + one on PROJECT_B
  await db
    .insert(documents)
    .values([
      {
        id: PHOTO_A1_ID,
        projectId: PROJECT_A,
        documentType: "photo",
        title: "Photo A1",
        storageKey: `${IDS.orgs.contractor}/${PROJECT_A}/photo/a1.jpg`,
        uploadedByUserId: IDS.users.contractorAdmin,
        visibilityScope: "project_wide",
        audienceScope: "internal",
      },
      {
        id: PHOTO_A2_ID,
        projectId: PROJECT_A,
        documentType: "photo",
        title: "Photo A2",
        storageKey: `${IDS.orgs.contractor}/${PROJECT_A}/photo/a2.jpg`,
        uploadedByUserId: IDS.users.contractorAdmin,
        visibilityScope: "project_wide",
        audienceScope: "internal",
      },
      {
        id: PHOTO_B_ID,
        projectId: PROJECT_B,
        documentType: "photo",
        title: "Photo B",
        storageKey: `${IDS.orgs.contractor}/${PROJECT_B}/photo/b.jpg`,
        uploadedByUserId: IDS.users.contractorAdmin,
        visibilityScope: "project_wide",
        audienceScope: "internal",
      },
    ])
    .onConflictDoNothing();
});

afterAll(async () => {
  await db
    .delete(photoPins)
    .where(inArray(photoPins.sheetId, [SHEET_A_ID, SHEET_B_ID]));
  await db
    .delete(documents)
    .where(inArray(documents.id, [PHOTO_A1_ID, PHOTO_A2_ID, PHOTO_B_ID]));
  await db
    .delete(drawingSheets)
    .where(inArray(drawingSheets.id, [SHEET_A_ID, SHEET_B_ID]));
  await db
    .delete(drawingSets)
    .where(inArray(drawingSets.id, [SET_A_ID, SET_B_ID]));
  await db
    .delete(projectOrganizationMemberships)
    .where(eq(projectOrganizationMemberships.projectId, PROJECT_A));
});

beforeEach(async () => {
  await db
    .delete(photoPins)
    .where(inArray(photoPins.sheetId, [SHEET_A_ID, SHEET_B_ID]));
});

describe("POST /api/photo-pins", () => {
  it("rejects unauthenticated", async () => {
    ASSUME.none();
    const r = await createPin(
      jsonRequest({
        sheetId: SHEET_A_ID,
        documentId: PHOTO_A1_ID,
        x: 0.5,
        y: 0.5,
      }),
    );
    expect(r.status).toBe(401);
  });

  it("rejects coords outside [0, 1]", async () => {
    ASSUME.contractor();
    const r = await createPin(
      jsonRequest({
        sheetId: SHEET_A_ID,
        documentId: PHOTO_A1_ID,
        x: 1.5,
        y: 0.5,
      }),
    );
    expect(r.status).toBe(400);
  });

  it("contractor creates a pin successfully", async () => {
    ASSUME.contractor();
    const r = await createPin(
      jsonRequest({
        sheetId: SHEET_A_ID,
        documentId: PHOTO_A1_ID,
        x: 0.42,
        y: 0.7,
        note: "wall 3A",
      }),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { id: string };
    const [row] = await db
      .select()
      .from(photoPins)
      .where(eq(photoPins.id, j.id));
    expect(row.sheetId).toBe(SHEET_A_ID);
    expect(row.documentId).toBe(PHOTO_A1_ID);
    expect(Number(row.x)).toBeCloseTo(0.42, 5);
    expect(Number(row.y)).toBeCloseTo(0.7, 5);
    expect(row.projectId).toBe(PROJECT_A);
    expect(row.note).toBe("wall 3A");
  });

  it("rejects pinning a photo from a different project than the sheet", async () => {
    ASSUME.contractor();
    const r = await createPin(
      jsonRequest({
        sheetId: SHEET_A_ID,
        documentId: PHOTO_B_ID, // PHOTO_B is on PROJECT_B
        x: 0.3,
        y: 0.3,
      }),
    );
    expect(r.status).toBe(400);
    const j = (await r.json()) as { error: string; message: string };
    expect(j.error).toBe("validation");
  });

  it("multi-pin: same photo can be pinned twice on the same sheet at different coords", async () => {
    ASSUME.contractor();
    const r1 = await createPin(
      jsonRequest({
        sheetId: SHEET_A_ID,
        documentId: PHOTO_A1_ID,
        x: 0.2,
        y: 0.2,
      }),
    );
    const r2 = await createPin(
      jsonRequest({
        sheetId: SHEET_A_ID,
        documentId: PHOTO_A1_ID,
        x: 0.8,
        y: 0.8,
      }),
    );
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const rows = await db
      .select()
      .from(photoPins)
      .where(
        eq(photoPins.documentId, PHOTO_A1_ID),
      );
    expect(rows.length).toBe(2);
  });

  it("subcontractor on the project can create a pin", async () => {
    ASSUME.subcontractor();
    const r = await createPin(
      jsonRequest({
        sheetId: SHEET_A_ID,
        documentId: PHOTO_A1_ID,
        x: 0.1,
        y: 0.1,
      }),
    );
    expect(r.status).toBe(200);
  });

  it("subcontractor not on PROJECT_B is denied", async () => {
    ASSUME.subcontractor();
    const r = await createPin(
      jsonRequest({
        sheetId: SHEET_B_ID,
        documentId: PHOTO_B_ID,
        x: 0.1,
        y: 0.1,
      }),
    );
    expect(r.status).toBe(403);
  });
});

describe("PATCH /api/photo-pins/[id] — move", () => {
  it("contractor can move their pin", async () => {
    ASSUME.contractor();
    const created = await createPin(
      jsonRequest({
        sheetId: SHEET_A_ID,
        documentId: PHOTO_A1_ID,
        x: 0.2,
        y: 0.2,
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const r = await patchPin(
      jsonRequestWithMethod("PATCH", { x: 0.6, y: 0.4 }),
      params({ id }),
    );
    expect(r.status).toBe(200);
    const [row] = await db
      .select()
      .from(photoPins)
      .where(eq(photoPins.id, id));
    expect(Number(row.x)).toBeCloseTo(0.6, 5);
    expect(Number(row.y)).toBeCloseTo(0.4, 5);
  });
});

describe("DELETE /api/photo-pins/[id]", () => {
  it("contractor can delete their pin", async () => {
    ASSUME.contractor();
    const created = await createPin(
      jsonRequest({
        sheetId: SHEET_A_ID,
        documentId: PHOTO_A1_ID,
        x: 0.5,
        y: 0.5,
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const r = await deletePin(emptyRequest(), params({ id }));
    expect(r.status).toBe(200);
    const rows = await db
      .select()
      .from(photoPins)
      .where(eq(photoPins.id, id));
    expect(rows.length).toBe(0);
  });
});

describe("cascade delete from parent document", () => {
  it("deleting the document cascades to its pins", async () => {
    ASSUME.contractor();
    const created = await createPin(
      jsonRequest({
        sheetId: SHEET_A_ID,
        documentId: PHOTO_A2_ID,
        x: 0.3,
        y: 0.3,
      }),
    );
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };
    await db.delete(documents).where(eq(documents.id, PHOTO_A2_ID));
    const rows = await db
      .select()
      .from(photoPins)
      .where(eq(photoPins.id, id));
    expect(rows.length).toBe(0);
    // Re-plant for subsequent tests.
    await db.insert(documents).values({
      id: PHOTO_A2_ID,
      projectId: PROJECT_A,
      documentType: "photo",
      title: "Photo A2",
      storageKey: `${IDS.orgs.contractor}/${PROJECT_A}/photo/a2.jpg`,
      uploadedByUserId: IDS.users.contractorAdmin,
      visibilityScope: "project_wide",
      audienceScope: "internal",
    });
  });
});
