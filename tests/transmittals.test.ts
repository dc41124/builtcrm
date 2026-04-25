import { eq } from "drizzle-orm";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock R2 BEFORE the route handlers import it. The success path of the
// anonymous-download route streams archived R2 objects; we replace
// r2.send with a stub that returns a tiny in-memory body so the route
// can complete without a real bucket. The non-success paths (revoked,
// garbage token, etc.) short-circuit before this is touched.
vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>(
    "@/lib/storage",
  );
  const { Readable } = await import("node:stream");
  return {
    ...actual,
    r2: {
      send: vi.fn(async () => ({
        Body: Readable.from(["test-bytes"]),
      })),
    },
  };
});

import { db } from "@/db/client";
import {
  notifications,
  projects,
  transmittalAccessEvents,
  transmittalDocuments,
  transmittalRecipients,
  transmittals,
} from "@/db/schema";

import { POST as createTransmittal } from "@/app/api/transmittals/route";
import { DELETE as deleteTransmittal, PUT as updateTransmittal } from "@/app/api/transmittals/[id]/route";
import { POST as sendTransmittal } from "@/app/api/transmittals/[id]/send/route";
import { PATCH as patchRecipient } from "@/app/api/transmittals/[id]/recipients/[recId]/route";
import { GET as anonymousDownload } from "@/app/api/transmittals/access/[token]/route";

import { hashToken } from "@/lib/transmittals/token";

import { IDS } from "./fixtures/seed";
import { jsonRequest } from "./helpers/request";
import { ASSUME } from "./helpers/session";

const PROJECT_A = IDS.projects.projectA;
const PROJECT_B = IDS.projects.projectB;
const DOC_A = IDS.document.projectA;

const params = <T extends object>(p: T) => ({ params: Promise.resolve(p) });

async function cleanupProject(projectId: string): Promise<void> {
  await db.delete(transmittals).where(eq(transmittals.projectId, projectId));
  await db
    .update(projects)
    .set({ transmittalCounter: 0 })
    .where(eq(projects.id, projectId));
}

beforeEach(async () => {
  await cleanupProject(PROJECT_A);
  await cleanupProject(PROJECT_B);
});

describe("POST /api/transmittals — create draft", () => {
  it("contractor creates a draft with recipients + documents", async () => {
    ASSUME.contractor();
    const res = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "Floor 2 framing — Rev 3",
        message: "Rev-3 attached, distribute to crews.",
        recipients: [
          { name: "Test Sub", email: "test.sub@example.test" },
          { name: "Owner", email: "owner@example.com" },
        ],
        documentIds: [DOC_A],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; status: string };
    expect(body.status).toBe("draft");

    const [row] = await db
      .select()
      .from(transmittals)
      .where(eq(transmittals.id, body.id));
    expect(row.status).toBe("draft");
    expect(row.sequentialNumber).toBeNull();

    const recs = await db
      .select()
      .from(transmittalRecipients)
      .where(eq(transmittalRecipients.transmittalId, body.id));
    expect(recs).toHaveLength(2);
    // Tokens aren't generated until send.
    expect(recs.every((r) => r.accessTokenDigest === null)).toBe(true);

    const docs = await db
      .select()
      .from(transmittalDocuments)
      .where(eq(transmittalDocuments.transmittalId, body.id));
    expect(docs).toHaveLength(1);
  });

  it("subcontractor cannot create transmittals (403)", async () => {
    ASSUME.subcontractor();
    const res = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "Trying to send",
        recipients: [{ name: "x", email: "x@x.com" }],
        documentIds: [DOC_A],
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects documents from another project", async () => {
    // Project B has no documents, so we'll synthesize: create on A then
    // try to attach a doc with a wrong project id by passing a UUID
    // that doesn't exist — the route returns 400.
    ASSUME.contractor();
    const res = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "Bad doc",
        recipients: [{ name: "x", email: "x@x.com" }],
        documentIds: ["00000000-0000-0000-0000-000000000099"],
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects duplicate recipient emails inside a single submission", async () => {
    ASSUME.contractor();
    const res = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "Dup",
        recipients: [
          { name: "a", email: "dup@example.com" },
          { name: "b", email: "dup@example.com" },
        ],
        documentIds: [DOC_A],
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT/DELETE — drafts only", () => {
  it("PUT on a sent transmittal is rejected", async () => {
    ASSUME.contractor();
    const created = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "Will send",
        recipients: [{ name: "Sub", email: "test.sub@example.test" }],
        documentIds: [DOC_A],
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const sendRes = await sendTransmittal(jsonRequest({}), params({ id }));
    expect(sendRes.status).toBe(200);

    const updateRes = await updateTransmittal(
      jsonRequest({ subject: "Sneaky edit" }),
      params({ id }),
    );
    expect(updateRes.status).toBe(409);
  });

  it("DELETE on a sent transmittal is rejected", async () => {
    ASSUME.contractor();
    const created = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "Cannot delete after send",
        recipients: [{ name: "Sub", email: "test.sub@example.test" }],
        documentIds: [DOC_A],
      }),
    );
    const { id } = (await created.json()) as { id: string };
    await sendTransmittal(jsonRequest({}), params({ id }));

    const delRes = await deleteTransmittal(
      jsonRequest({}),
      params({ id }),
    );
    expect(delRes.status).toBe(409);
  });

  it("DELETE on a draft removes the row", async () => {
    ASSUME.contractor();
    const created = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "Throwaway",
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const delRes = await deleteTransmittal(
      jsonRequest({}),
      params({ id }),
    );
    expect(delRes.status).toBe(200);
    const rows = await db
      .select()
      .from(transmittals)
      .where(eq(transmittals.id, id));
    expect(rows).toHaveLength(0);
  });
});

describe("POST /:id/send — atomic counter, tokens, share URLs", () => {
  it("first send gets TM-0001 and returns per-recipient share URLs", async () => {
    ASSUME.contractor();
    const created = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "First send",
        recipients: [
          { name: "Sub", email: "test.sub@example.test" },
          { name: "External", email: "ext@architect.example" },
        ],
        documentIds: [DOC_A],
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const res = await sendTransmittal(jsonRequest({}), params({ id }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sequentialNumber: number;
      numberLabel: string;
      shareUrls: Array<{ recipientId: string; shareUrl: string }>;
    };
    expect(body.sequentialNumber).toBe(1);
    expect(body.numberLabel).toBe("TM-0001");
    expect(body.shareUrls).toHaveLength(2);
    expect(body.shareUrls.every((u) => u.shareUrl.includes("/t/"))).toBe(true);

    // DB now has digests, no plaintext.
    const recs = await db
      .select()
      .from(transmittalRecipients)
      .where(eq(transmittalRecipients.transmittalId, id));
    for (const r of recs) {
      expect(r.accessTokenDigest).toBeTruthy();
      expect(r.accessTokenDigest!.length).toBe(64);
    }
  });

  it("second send on same project gets TM-0002 (atomic counter)", async () => {
    ASSUME.contractor();
    const a = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "First",
        recipients: [{ name: "x", email: "a@x.com" }],
        documentIds: [DOC_A],
      }),
    );
    const aId = (await a.json()).id as string;
    await sendTransmittal(jsonRequest({}), params({ id: aId }));

    const b = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "Second",
        recipients: [{ name: "x", email: "b@x.com" }],
        documentIds: [DOC_A],
      }),
    );
    const bId = (await b.json()).id as string;
    const res = await sendTransmittal(jsonRequest({}), params({ id: bId }));
    const body = (await res.json()) as { numberLabel: string };
    expect(body.numberLabel).toBe("TM-0002");
  });

  it("cannot send a draft with no recipients (409)", async () => {
    ASSUME.contractor();
    const created = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "No recipients",
        documentIds: [DOC_A],
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const res = await sendTransmittal(jsonRequest({}), params({ id }));
    expect(res.status).toBe(409);
  });

  it("cannot send a draft with no documents (409)", async () => {
    ASSUME.contractor();
    const created = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "No docs",
        recipients: [{ name: "x", email: "x@x.com" }],
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const res = await sendTransmittal(jsonRequest({}), params({ id }));
    expect(res.status).toBe(409);
  });

  it("subcontractor cannot send", async () => {
    ASSUME.contractor();
    const created = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "Sub blocked",
        recipients: [{ name: "x", email: "x@x.com" }],
        documentIds: [DOC_A],
      }),
    );
    const { id } = (await created.json()) as { id: string };
    ASSUME.subcontractor();
    const res = await sendTransmittal(jsonRequest({}), params({ id }));
    expect(res.status).toBe(403);
  });
});

describe("Anonymous download — token validation", () => {
  it("garbage token returns 404", async () => {
    const res = await anonymousDownload(
      new Request("http://localhost/test"),
      params({ token: "garbage-token-that-does-not-resolve" }),
    );
    expect(res.status).toBe(404);
  });

  it("very short token returns 404", async () => {
    const res = await anonymousDownload(
      new Request("http://localhost/test"),
      params({ token: "x" }),
    );
    expect(res.status).toBe(404);
  });

  it("valid token returns ZIP and writes an access event", async () => {
    ASSUME.contractor();
    const created = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "For download",
        recipients: [{ name: "Sub", email: "test.sub@example.test" }],
        documentIds: [DOC_A],
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const sendRes = await sendTransmittal(jsonRequest({}), params({ id }));
    const { shareUrls } = (await sendRes.json()) as {
      shareUrls: Array<{ recipientId: string; shareUrl: string }>;
    };
    const url = new URL(shareUrls[0]!.shareUrl);
    const token = url.pathname.replace(/^\/t\//, "");

    const dlRes = await anonymousDownload(
      new Request("http://localhost/test", {
        headers: {
          "user-agent": "VitestRunner/1.0",
          "x-forwarded-for": "203.0.113.42",
        },
      }),
      params({ token }),
    );
    expect(dlRes.status).toBe(200);
    expect(dlRes.headers.get("content-type")).toContain("application/zip");

    // Drain the response so the access-event write isn't racing.
    if (dlRes.body) {
      // @ts-expect-error -- Node Web Streams pollyfill missing types
      const reader = dlRes.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    const events = await db
      .select()
      .from(transmittalAccessEvents)
      .where(eq(transmittalAccessEvents.recipientId, shareUrls[0]!.recipientId));
    expect(events).toHaveLength(1);
    expect(events[0].ipAddress).toBe("203.0.113.42");
    expect(events[0].userAgent).toBe("VitestRunner/1.0");

    const [rec] = await db
      .select()
      .from(transmittalRecipients)
      .where(eq(transmittalRecipients.id, shareUrls[0]!.recipientId));
    expect(rec.totalDownloads).toBe(1);
    expect(rec.firstDownloadedAt).not.toBeNull();
    expect(rec.lastDownloadedAt).not.toBeNull();
  });

  it("revoked recipient's token stops resolving", async () => {
    ASSUME.contractor();
    const created = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "Will revoke",
        recipients: [{ name: "Sub", email: "test.sub@example.test" }],
        documentIds: [DOC_A],
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const sendRes = await sendTransmittal(jsonRequest({}), params({ id }));
    const { shareUrls } = (await sendRes.json()) as {
      shareUrls: Array<{ recipientId: string; shareUrl: string }>;
    };
    const recipientId = shareUrls[0]!.recipientId;
    const token = new URL(shareUrls[0]!.shareUrl).pathname.replace(/^\/t\//, "");

    const revokeRes = await patchRecipient(
      jsonRequest({ action: "revoke" }),
      params({ id, recId: recipientId }),
    );
    expect(revokeRes.status).toBe(200);

    const dlRes = await anonymousDownload(
      new Request("http://localhost/test"),
      params({ token }),
    );
    // Revoked digest is cleared on revoke, so the lookup misses → 404.
    expect([403, 404]).toContain(dlRes.status);

    // And the digest column is gone.
    const [rec] = await db
      .select()
      .from(transmittalRecipients)
      .where(eq(transmittalRecipients.id, recipientId));
    expect(rec.accessTokenDigest).toBeNull();
    expect(rec.revokedAt).not.toBeNull();
  });

  it("regenerated token works; the old token does not", async () => {
    ASSUME.contractor();
    const created = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "Rotate",
        recipients: [{ name: "Sub", email: "test.sub@example.test" }],
        documentIds: [DOC_A],
      }),
    );
    const { id } = (await created.json()) as { id: string };
    const sendRes = await sendTransmittal(jsonRequest({}), params({ id }));
    const { shareUrls } = (await sendRes.json()) as {
      shareUrls: Array<{ recipientId: string; shareUrl: string }>;
    };
    const recipientId = shareUrls[0]!.recipientId;
    const oldToken = new URL(shareUrls[0]!.shareUrl).pathname.replace(/^\/t\//, "");
    const oldDigest = hashToken(oldToken);

    const regenRes = await patchRecipient(
      jsonRequest({ action: "regenerate" }),
      params({ id, recId: recipientId }),
    );
    expect(regenRes.status).toBe(200);
    const { shareUrl: newShareUrl } = (await regenRes.json()) as {
      shareUrl: string;
    };
    const newToken = new URL(newShareUrl).pathname.replace(/^\/t\//, "");
    expect(newToken).not.toBe(oldToken);

    const [rec] = await db
      .select()
      .from(transmittalRecipients)
      .where(eq(transmittalRecipients.id, recipientId));
    expect(rec.accessTokenDigest).not.toBe(oldDigest);
    expect(rec.accessTokenDigest).toBe(hashToken(newToken));
  });
});

describe("Notifications — internal-user emails", () => {
  it("emits a transmittal_received notification when a recipient email matches a contractor user", async () => {
    ASSUME.contractor();
    const created = await createTransmittal(
      jsonRequest({
        projectId: PROJECT_A,
        subject: "To self-team",
        recipients: [
          { name: "Sub", email: "test.sub@example.test" }, // matches the seeded sub user
        ],
        documentIds: [DOC_A],
      }),
    );
    const { id } = (await created.json()) as { id: string };
    await sendTransmittal(jsonRequest({}), params({ id }));

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.relatedObjectId, id));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.eventId === "transmittal_received")).toBe(true);
  });
});
