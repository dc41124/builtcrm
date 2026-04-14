import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { documentLinks, documents } from "@/db/schema";

import { POST as uploadRequest } from "@/app/api/upload/request/route";
import { POST as uploadFinalize } from "@/app/api/upload/finalize/route";
import { GET as fileDownload } from "@/app/api/files/[documentId]/route";

import { IDS } from "./fixtures/seed";
import { auditEventsFor } from "./helpers/audit";
import { emptyRequest, jsonRequest } from "./helpers/request";
import { ASSUME } from "./helpers/session";

const PROJECT_A = IDS.projects.projectA;
const PROJECT_B = IDS.projects.projectB;

// Track documents we create so we can tear them down between tests.
const createdDocIds: string[] = [];

afterEach(async () => {
  if (createdDocIds.length === 0) return;
  await db
    .delete(documentLinks)
    .where(eq(documentLinks.linkedObjectId, PROJECT_A));
  for (const id of createdDocIds) {
    await db.delete(documents).where(eq(documents.id, id));
  }
  createdDocIds.length = 0;
});

describe("upload request — presigned URL", () => {
  it("returns a presigned URL for an authorized contractor", async () => {
    ASSUME.contractor();
    const res = await uploadRequest(
      jsonRequest({
        projectId: PROJECT_A,
        filename: "plans.pdf",
        contentType: "application/pdf",
        documentType: "drawing",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploadUrl).toContain("https://stub.test/upload/");
    // Storage keys must live under {orgId}/{projectId}/...
    expect(body.storageKey.startsWith(`${IDS.orgs.contractor}/${PROJECT_A}/`)).toBe(true);
  });

  it("returns a presigned URL for an authorized subcontractor on Project A", async () => {
    ASSUME.subcontractor();
    const res = await uploadRequest(
      jsonRequest({
        projectId: PROJECT_A,
        filename: "submittal.pdf",
        contentType: "application/pdf",
        documentType: "submittal",
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects a client writing documents (no write permission)", async () => {
    ASSUME.commercial();
    const res = await uploadRequest(
      jsonRequest({
        projectId: PROJECT_A,
        filename: "notes.pdf",
        contentType: "application/pdf",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects a subcontractor on Project B (no membership)", async () => {
    ASSUME.subcontractor();
    const res = await uploadRequest(
      jsonRequest({
        projectId: PROJECT_B,
        filename: "x.pdf",
        contentType: "application/pdf",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects an unauthenticated request", async () => {
    ASSUME.none();
    const res = await uploadRequest(
      jsonRequest({
        projectId: PROJECT_A,
        filename: "x.pdf",
        contentType: "application/pdf",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("rejects an invalid body", async () => {
    ASSUME.contractor();
    const res = await uploadRequest(jsonRequest({ filename: 123 }));
    expect(res.status).toBe(400);
  });
});

describe("upload finalize — documents + audit", () => {
  it("creates a document row + project link + audit event", async () => {
    ASSUME.contractor();
    const storageKey = `${IDS.orgs.contractor}/${PROJECT_A}/drawing/1_plans.pdf`;
    const res = await uploadFinalize(
      jsonRequest({
        projectId: PROJECT_A,
        storageKey,
        title: "Plans revision A",
        documentType: "drawing",
        visibilityScope: "project_wide",
        audienceScope: "internal",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    createdDocIds.push(body.documentId);

    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, body.documentId));
    expect(doc.title).toBe("Plans revision A");
    expect(doc.storageKey).toBe(storageKey);

    const links = await db
      .select()
      .from(documentLinks)
      .where(eq(documentLinks.documentId, body.documentId));
    expect(links.some((l) => l.linkedObjectType === "project")).toBe(true);

    const events = await auditEventsFor("document", body.documentId);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe("uploaded");
  });

  it("rejects a storage key that does not match the user's project prefix", async () => {
    ASSUME.contractor();
    const res = await uploadFinalize(
      jsonRequest({
        projectId: PROJECT_A,
        storageKey: `${IDS.orgs.contractor}/${PROJECT_B}/drawing/evil.pdf`,
        title: "Mismatched",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_storage_key");
  });

  it("rejects a client finalizing an upload (no write permission)", async () => {
    ASSUME.commercial();
    const res = await uploadFinalize(
      jsonRequest({
        projectId: PROJECT_A,
        storageKey: `${IDS.orgs.contractor}/${PROJECT_A}/drawing/c.pdf`,
        title: "Client upload",
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("file download — presigned GET", () => {
  const params = async () => ({ documentId: IDS.document.projectA });

  it("returns a download URL to an authorized reader", async () => {
    ASSUME.contractor();
    const res = await fileDownload(emptyRequest(), { params: params() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.downloadUrl).toContain("https://stub.test/download/");
  });

  it("returns a download URL to a subcontractor with project access", async () => {
    ASSUME.subcontractor();
    const res = await fileDownload(emptyRequest(), { params: params() });
    expect(res.status).toBe(200);
  });

  it("blocks an unauthenticated download", async () => {
    ASSUME.none();
    const res = await fileDownload(emptyRequest(), { params: params() });
    expect(res.status).toBe(401);
  });

  it("returns 404 for a missing document", async () => {
    ASSUME.contractor();
    const res = await fileDownload(emptyRequest(), {
      params: Promise.resolve({ documentId: "99999999-0000-0000-0000-000000000000" }),
    });
    expect(res.status).toBe(404);
  });
});
