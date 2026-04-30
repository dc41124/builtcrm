/**
 * Tests for src/lib/offline/queue.ts.
 *
 * fake-indexeddb provides a working IndexedDB in the node test runtime so
 * idb opens normally. structuredClone is a node 17+ built-in (we're on 22)
 * so the IDB clone semantics work too.
 */

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetDbHandleForTests,
  type DailyLogCreatePayload,
  DB_NAME,
} from "@/lib/offline/db";
import {
  __clearProducersForTests,
  __resetDrainLatchForTests,
  drainQueue,
  enqueueWrite,
  listPending,
  registerProducer,
  shouldRetry,
  type DrainOutcome,
  type Producer,
} from "@/lib/offline/queue";

async function wipeDb(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

beforeEach(async () => {
  await __resetDbHandleForTests();
  __resetDrainLatchForTests();
  __clearProducersForTests();
  await wipeDb();
});

afterEach(async () => {
  await __resetDbHandleForTests();
  await wipeDb();
});

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

function makeProducer(
  behaviour: (call: number) => DrainOutcome | Error,
): Producer<DailyLogCreatePayload> & { calls: number } {
  const state = { calls: 0 };
  const p = {
    kind: "daily_log_create" as const,
    describe: () => ({ title: "test" }),
    drain: async () => {
      const result = behaviour(state.calls);
      state.calls += 1;
      if (result instanceof Error) throw result;
      return result;
    },
  };
  return Object.defineProperty(p, "calls", {
    get: () => state.calls,
    enumerable: true,
  }) as Producer<DailyLogCreatePayload> & { calls: number };
}

describe("shouldRetry", () => {
  it("retries when wait window has elapsed", () => {
    expect(shouldRetry(0, 0, 0)).toBe(true); // attempt 0 → 0s wait → immediate
    expect(shouldRetry(1, 0, 4_999)).toBe(false); // attempt 1 → 5s wait
    expect(shouldRetry(1, 0, 5_000)).toBe(true);
    expect(shouldRetry(2, 0, 30_000)).toBe(true); // attempt 2 → 30s wait
  });

  it("never retries past the max attempt count", () => {
    expect(shouldRetry(5, 0, Number.MAX_SAFE_INTEGER)).toBe(false);
  });
});

describe("enqueueWrite + listPending", () => {
  it("persists rows in oldest-first order", async () => {
    await enqueueWrite({
      clientId: "row-a",
      kind: "daily_log_create",
      payload: fakePayload({ logDate: "2026-04-29" }),
    });
    // Brief gap to keep enqueuedAt distinct.
    await new Promise((r) => setTimeout(r, 2));
    await enqueueWrite({
      clientId: "row-b",
      kind: "daily_log_create",
      payload: fakePayload({ logDate: "2026-04-30" }),
    });

    const pending = await listPending();
    expect(pending.map((r) => r.clientId)).toEqual(["row-a", "row-b"]);
    expect(pending[0].status).toBe("pending");
    expect(pending[0].attempts).toBe(0);
  });
});

describe("drainQueue — happy path", () => {
  it("drops rows on type=ok", async () => {
    registerProducer(
      makeProducer(() => ({ type: "ok", serverId: "server-1" })),
    );
    await enqueueWrite({
      clientId: "row-1",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.drained).toBe(1);
    expect((await listPending()).length).toBe(0);
  });

  it("treats idempotent the same as ok", async () => {
    registerProducer(
      makeProducer(() => ({ type: "idempotent", serverId: "server-2" })),
    );
    await enqueueWrite({
      clientId: "row-2",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.drained).toBe(1);
    expect((await listPending()).length).toBe(0);
  });
});

describe("drainQueue — conflict", () => {
  it("marks status=conflict on type=conflict", async () => {
    registerProducer(
      makeProducer(() => ({ type: "conflict", reason: "log_exists" })),
    );
    await enqueueWrite({
      clientId: "row-c",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.conflicted).toBe(1);
    expect(out.drained).toBe(0);

    const pending = await listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe("conflict");
    expect(pending[0].lastError).toBe("log_exists");
  });

  it("does not retry conflict rows on subsequent drain calls", async () => {
    const producer = makeProducer(() => ({ type: "conflict", reason: "log_exists" }));
    registerProducer(producer);
    await enqueueWrite({
      clientId: "row-c",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    await drainQueue();
    await drainQueue();
    expect(producer.calls).toBe(1);
  });
});

describe("drainQueue — transient → permanent", () => {
  it("escalates to failed_permanent after backoff exhausts", async () => {
    let calls = 0;
    registerProducer({
      kind: "daily_log_create",
      describe: () => ({ title: "x" }),
      drain: async () => {
        calls += 1;
        return { type: "transient", reason: "network" };
      },
    });

    await enqueueWrite({
      clientId: "row-t",
      kind: "daily_log_create",
      payload: fakePayload(),
      now: () => 0,
    });

    // Five drains, each "now" advanced past the backoff window of the prior.
    // Attempts 0..4 fire then row escalates to failed_permanent.
    let virtualNow = 0;
    for (let i = 0; i < 6; i++) {
      virtualNow += 60 * 60_000; // an hour each — past every backoff bucket
      await drainQueue(() => virtualNow);
    }

    expect(calls).toBe(5); // BACKOFF_MS has 5 entries; attempts 0..4 fire then permanent
    const pending = await listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe("failed_permanent");
  });

  it("treats thrown errors as transient", async () => {
    registerProducer(
      makeProducer(() => new Error("boom")),
    );
    await enqueueWrite({
      clientId: "row-throw",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    await drainQueue();
    const pending = await listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe("pending");
    expect(pending[0].attempts).toBe(1);
    expect(pending[0].lastError).toBe("boom");
  });
});

describe("drainQueue — concurrency latch", () => {
  it("coalesces concurrent drain calls", async () => {
    // Defer pattern: drain entered → resolves drainCalledPromise; test awaits
    // it before triggering resolveDrain so the producer's promise actually
    // exists by then.
    let resolveDrain: (v: DrainOutcome) => void = () => {};
    let resolveDrainCalled: () => void = () => {};
    const drainCalledPromise = new Promise<void>((r) => {
      resolveDrainCalled = r;
    });
    let calls = 0;
    registerProducer({
      kind: "daily_log_create",
      describe: () => ({ title: "x" }),
      drain: async () => {
        calls += 1;
        const p = new Promise<DrainOutcome>((resolve) => {
          resolveDrain = resolve;
        });
        resolveDrainCalled();
        return p;
      },
    });

    await enqueueWrite({
      clientId: "row-conc",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const first = drainQueue();
    // Wait until the first drain has actually entered the producer.
    await drainCalledPromise;
    // Now any concurrent drain call must hit the in-flight latch.
    const secondResult = await drainQueue();
    expect(secondResult.drained).toBe(0);

    resolveDrain({ type: "ok", serverId: "x" });
    const firstResult = await first;
    expect(firstResult.drained).toBe(1);
    expect(calls).toBe(1);
  });
});

describe("drainQueue — unregistered kind", () => {
  it("leaves rows pending if no producer is registered", async () => {
    // No registerProducer call.
    await enqueueWrite({
      clientId: "row-orphan",
      kind: "daily_log_create",
      payload: fakePayload(),
    });

    const out = await drainQueue();
    expect(out.drained).toBe(0);
    const pending = await listPending();
    expect(pending.length).toBe(1);
    expect(pending[0].status).toBe("pending");
  });
});
