/**
 * Tests for src/lib/offline/dailyLogs.ts — the daily-log-create producer.
 *
 * fetch is mocked at the test level so we don't actually hit the network.
 * Photos are mocked via vi.mock("@/lib/offline/photos") so we don't need
 * createImageBitmap / canvas in node.
 */

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted runs before every other import — required because vi.mock is
// hoisted, and file-level `const photoMocks = ...` is not.
const photoMocks = vi.hoisted(() => ({
  listPhotosForLog: vi.fn(),
  dropPhoto: vi.fn(),
  dropPhotosForLog: vi.fn(),
  capturePhoto: vi.fn(),
  getStorageStatus: vi.fn(),
}));

vi.mock("@/lib/offline/photos", () => photoMocks);

import {
  __resetDbHandleForTests,
  type DailyLogCreatePayload,
  DB_NAME,
} from "@/lib/offline/db";
import { registerDailyLogProducer } from "@/lib/offline/dailyLogs";
import {
  __clearProducersForTests,
  __resetDrainLatchForTests,
  drainQueue,
  enqueueWrite,
  listPending,
} from "@/lib/offline/queue";

async function wipeDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

const fetchMock = vi.fn();

beforeEach(async () => {
  await __resetDbHandleForTests();
  __resetDrainLatchForTests();
  __clearProducersForTests();
  await wipeDb();
  registerDailyLogProducer();
  photoMocks.listPhotosForLog.mockReset();
  photoMocks.dropPhoto.mockReset();
  photoMocks.listPhotosForLog.mockResolvedValue([]);
  photoMocks.dropPhoto.mockResolvedValue(undefined);
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  await __resetDbHandleForTests();
  await wipeDb();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakePayload(overrides?: Partial<DailyLogCreatePayload>): DailyLogCreatePayload {
  return {
    projectId: "11111111-1111-1111-1111-111111111111",
    logDate: "2026-04-30",
    intent: "submit",
    clientSubmittedAt: "2026-04-30T17:00:00.000Z",
    body: { notes: "test" },
    photoClientIds: [],
    ...overrides,
  };
}

describe("daily-log producer — create only (no photos)", () => {
  it("drains successfully on 200 + serverId", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: "server-log-1" }),
    );

    await enqueueWrite({
      clientId: "client-uuid-1",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.drained).toBe(1);
    expect((await listPending()).length).toBe(0);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/daily-logs");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.clientUuid).toBe("client-uuid-1");
    expect(body.clientSubmittedAt).toBe("2026-04-30T17:00:00.000Z");
  });

  it("drains successfully on 200 idempotent retry", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { id: "server-log-2", idempotent: true }),
    );

    await enqueueWrite({
      clientId: "client-uuid-2",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.drained).toBe(1);
    expect((await listPending()).length).toBe(0);
  });

  it("marks conflict on 409 log_exists", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: "log_exists",
        existingLogId: "server-existing",
      }),
    );

    await enqueueWrite({
      clientId: "client-uuid-3",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.conflicted).toBe(1);
    const pending = await listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe("conflict");
    expect(pending[0].lastError).toBe("log_exists");
  });

  it("treats 5xx as transient", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503, { error: "down" }));

    await enqueueWrite({
      clientId: "client-uuid-4",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.drained).toBe(0);
    expect(out.conflicted).toBe(0);
    expect(out.permanent).toBe(0);
    const pending = await listPending();
    expect(pending[0].status).toBe("pending");
    expect(pending[0].attempts).toBe(1);
    expect(pending[0].lastError).toBe("server_503");
  });

  it("treats 401 as permanent (auth changed)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: "unauthenticated" }));

    await enqueueWrite({
      clientId: "client-uuid-5",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.permanent).toBe(1);
    const pending = await listPending();
    expect(pending[0].status).toBe("failed_permanent");
    expect(pending[0].lastError).toBe("auth_changed");
  });

  it("treats network failure as transient", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    await enqueueWrite({
      clientId: "client-uuid-6",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.drained).toBe(0);
    const pending = await listPending();
    expect(pending[0].status).toBe("pending");
    expect(pending[0].attempts).toBe(1);
    expect(pending[0].lastError).toBe("network_create");
  });
});

describe("daily-log producer — with photos", () => {
  it("walks the 4-step R2 chain per photo and drops each on success", async () => {
    photoMocks.listPhotosForLog.mockResolvedValueOnce([
      {
        photoClientId: "photo-1",
        dailyLogClientId: "client-uuid-7",
        blob: new Blob(["fake"], { type: "image/jpeg" }),
        mimeType: "image/jpeg",
        caption: "Foundation pour",
        sortOrder: 0,
        isHero: true,
        thumbDataUrl: "data:image/jpeg;base64,",
        capturedAt: 0,
      },
    ]);

    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "server-log-7" })) // create
      .mockResolvedValueOnce(
        jsonResponse(200, {
          uploadUrl: "https://r2.example/upload",
          storageKey: "org/proj/photos/x.jpg",
        }),
      ) // presign
      .mockResolvedValueOnce(new Response(null, { status: 200 })) // PUT R2
      .mockResolvedValueOnce(
        jsonResponse(200, { documentId: "doc-1", storageKey: "x" }),
      ) // finalize
      .mockResolvedValueOnce(jsonResponse(200, { id: "join-1" })); // link

    await enqueueWrite({
      clientId: "client-uuid-7",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.drained).toBe(1);
    expect(photoMocks.dropPhoto).toHaveBeenCalledWith("photo-1");
    expect(fetchMock.mock.calls.length).toBe(5);
  });

  it("surfaces a transient photo failure on the row without dropping the log", async () => {
    photoMocks.listPhotosForLog.mockResolvedValueOnce([
      {
        photoClientId: "photo-2",
        dailyLogClientId: "client-uuid-8",
        blob: new Blob(["fake"], { type: "image/jpeg" }),
        mimeType: "image/jpeg",
        caption: null,
        sortOrder: 0,
        isHero: false,
        thumbDataUrl: "",
        capturedAt: 0,
      },
    ]);

    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { id: "server-log-8" })) // create OK
      .mockRejectedValueOnce(new Error("network")); // presign network fail

    await enqueueWrite({
      clientId: "client-uuid-8",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.drained).toBe(0); // log row still in queue because photos didn't all sync
    expect(photoMocks.dropPhoto).not.toHaveBeenCalled();
    const pending = await listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe("pending"); // transient — bumped to attempt 1
    expect(pending[0].attempts).toBe(1);
    expect(pending[0].lastError).toBe("network_presign");
  });
});
