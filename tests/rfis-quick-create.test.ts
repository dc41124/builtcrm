import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import {
  documentLinks,
  documents,
  projectOrganizationMemberships,
  rfis,
} from "@/db/schema";

import { POST as createRfi } from "@/app/api/rfis/route";

import { IDS } from "./fixtures/seed";
import { jsonRequest } from "./helpers/request";
import { ASSUME } from "./helpers/session";

const PROJECT_A = IDS.projects.projectA;

const PHOTO_DOC_ID = "99999999-cccc-0000-0000-000000000001";

beforeAll(async () => {
  // Sub already has project_user_membership on Project A from the global
  // fixture. The /api/rfis route gates project access via getEffectiveContext
  // which reads project_user_memberships, NOT project_organization_memberships,
  // so we don't need to plant a POM row for the sub-creates test. (The
  // photo-pins suite plants one for its own RLS path; we don't conflict.)

  // A project_organization_memberships row keeps document_links happy under
  // RLS for the attachment test (documents are visible to the sub via POM
  // when they own a doc on a shared project, but in this test the photo doc
  // belongs to PROJECT_A and the contractor is the actor — which is fine).
  await db
    .insert(projectOrganizationMemberships)
    .values({
      projectId: PROJECT_A,
      organizationId: IDS.orgs.subcontractor,
      membershipType: "subcontractor",
      membershipStatus: "active",
    })
    .onConflictDoNothing();

  await db
    .insert(documents)
    .values({
      id: PHOTO_DOC_ID,
      projectId: PROJECT_A,
      documentType: "rfi_attachment",
      title: "Quick RFI photo",
      storageKey: `${IDS.orgs.contractor}/${PROJECT_A}/rfi_attachment/quick.jpg`,
      uploadedByUserId: IDS.users.contractorAdmin,
      visibilityScope: "project_wide",
      audienceScope: "internal",
    })
    .onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(rfis).where(eq(rfis.projectId, PROJECT_A));
  await db
    .delete(documentLinks)
    .where(inArray(documentLinks.documentId, [PHOTO_DOC_ID]));
  await db.delete(documents).where(eq(documents.id, PHOTO_DOC_ID));
});

beforeEach(async () => {
  await db.delete(rfis).where(eq(rfis.projectId, PROJECT_A));
  await db
    .delete(documentLinks)
    .where(inArray(documentLinks.documentId, [PHOTO_DOC_ID]));
});

const baseBody = (overrides?: Record<string, unknown>) => ({
  projectId: PROJECT_A,
  subject: "Field RFI · wall 3A",
  body: "Verify framing detail.",
  rfiType: "issue",
  ...overrides,
});

describe("POST /api/rfis — Step 55 quick-capture extensions", () => {
  it("contractor: omitting status defaults to open + requires assignee", async () => {
    ASSUME.contractor();
    const r = await createRfi(jsonRequest(baseBody()));
    // No assignee → 400
    expect(r.status).toBe(400);
  });

  it("contractor can quick-capture (status=draft, no assignee, defaults to contractor org)", async () => {
    ASSUME.contractor();
    const r = await createRfi(
      jsonRequest(
        baseBody({
          status: "draft",
          locationDescription: "GPS 47.5605, -52.7126 · wall 3A",
        }),
      ),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { id: string; status: string };
    expect(j.status).toBe("draft");
    const [row] = await db
      .select()
      .from(rfis)
      .where(eq(rfis.id, j.id));
    expect(row.rfiStatus).toBe("draft");
    expect(row.assignedToOrganizationId).toBe(IDS.orgs.contractor);
  });

  it("subcontractor: cannot create open RFIs", async () => {
    ASSUME.subcontractor();
    const r = await createRfi(
      jsonRequest(
        baseBody({
          status: "open",
          assignedToOrganizationId: IDS.orgs.contractor,
        }),
      ),
    );
    expect(r.status).toBe(403);
  });

  it("subcontractor can create a draft RFI (FAB shape)", async () => {
    ASSUME.subcontractor();
    const r = await createRfi(
      jsonRequest(
        baseBody({
          status: "draft",
          locationDescription: "GPS 47.5605, -52.7126 · north wall",
        }),
      ),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { id: string };
    const [row] = await db
      .select()
      .from(rfis)
      .where(eq(rfis.id, j.id));
    expect(row.rfiStatus).toBe("draft");
    expect(row.createdByUserId).toBe(IDS.users.subcontractor);
    expect(row.assignedToOrganizationId).toBe(IDS.orgs.contractor);
    expect(row.locationDescription).toContain("GPS 47.5605");
  });

  it("idempotent retry returns the prior id", async () => {
    ASSUME.contractor();
    const cu = "deadbeef-0000-4000-8000-000000000001";
    const first = await createRfi(
      jsonRequest(
        baseBody({
          status: "draft",
          clientUuid: cu,
        }),
      ),
    );
    const j1 = (await first.json()) as { id: string; idempotent?: boolean };
    expect(j1.idempotent).toBeUndefined();
    const second = await createRfi(
      jsonRequest(
        baseBody({
          status: "draft",
          clientUuid: cu,
        }),
      ),
    );
    expect(second.status).toBe(200);
    const j2 = (await second.json()) as { id: string; idempotent?: boolean };
    expect(j2.idempotent).toBe(true);
    expect(j2.id).toBe(j1.id);
  });

  it("attachmentDocumentIds writes document_links rows", async () => {
    ASSUME.contractor();
    const r = await createRfi(
      jsonRequest(
        baseBody({
          status: "draft",
          attachmentDocumentIds: [PHOTO_DOC_ID],
        }),
      ),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { id: string };
    const links = await db
      .select()
      .from(documentLinks)
      .where(eq(documentLinks.linkedObjectId, j.id));
    expect(links.length).toBe(1);
    expect(links[0].documentId).toBe(PHOTO_DOC_ID);
    expect(links[0].linkedObjectType).toBe("rfi");
    expect(links[0].linkRole).toBe("attachment");
  });
});
