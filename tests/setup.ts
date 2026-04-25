import { vi } from "vitest";

// Ensure env carries over from globalSetup into the worker process.
if (process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// --- React `cache()` stub -----------------------------------------------
// `react.cache` is exposed by Next.js / RSC but absent in the plain Node
// test runtime. Step 49's `getActivePrequalForPair` wraps with `cache`
// for per-request memoization; in tests we replace it with an identity
// wrapper so the loader is just a regular async fn.
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
  };
});

// --- Next.js `headers()` stub -------------------------------------------
// Route handlers call `await headers()` before touching the request body,
// which normally requires running inside the Next request context. We
// replace it with a function that returns an empty Headers object so route
// code can run in a plain vitest process.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// --- Better Auth stub ---------------------------------------------------
// Route handlers all call `auth.api.getSession(...)`. The test helper
// `asUser(userId)` sets the session on this mock before calling a route.
// Importing `@/auth/config` for real would boot Better Auth + drizzleAdapter
// on every test file, which we do not need.
type MockSession = { session: { appUserId: string | null } } | null;
const currentSessionHolder: { current: MockSession } = { current: null };

vi.mock("@/auth/config", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => currentSessionHolder.current),
    },
  },
  resolvePortalPath: () => "/contractor",
}));

// Exposed so the route-caller helper can flip the active user per call.
// Stashed on globalThis because the mock factory above captures it by
// closure in its own module scope.
(globalThis as unknown as { __setMockSession: (s: MockSession) => void }).__setMockSession =
  (s) => {
    currentSessionHolder.current = s;
  };

// --- Cloudflare R2 storage stub -----------------------------------------
// Tests never hit the real bucket. `objectExists` returns true so finalize
// routes believe the upload happened; presign helpers return synthetic URLs.
vi.mock("@/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/lib/storage")>(
    "@/lib/storage",
  );
  return {
    ...actual,
    presignUploadUrl: vi.fn(async ({ key }) => `https://stub.test/upload/${key}`),
    presignDownloadUrl: vi.fn(async ({ key }) => `https://stub.test/download/${key}`),
    objectExists: vi.fn(async () => true),
  };
});

// --- Env stub -----------------------------------------------------------
// `@/lib/env` validates R2/Upstash/Trigger vars at import time. The test
// env file provides fake values, so this mostly works as-is — but stub it
// anyway so we don't need real secrets in CI.
vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters-long",
    BETTER_AUTH_URL: "http://localhost:3000",
    R2_ACCOUNT_ID: "test",
    R2_ACCESS_KEY_ID: "test",
    R2_SECRET_ACCESS_KEY: "test",
    R2_BUCKET_NAME: "test",
    TRIGGER_DEV_API_KEY: "test",
    UPSTASH_REDIS_REST_URL: "http://localhost",
    UPSTASH_REDIS_REST_TOKEN: "test",
  },
}));
