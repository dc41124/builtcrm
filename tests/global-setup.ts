import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

// Load .env.test and promote TEST_DATABASE_URL -> DATABASE_URL before any
// application module (which imports `@/db/client`) is touched.
loadEnv({ path: resolve(process.cwd(), ".env.test") });

if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL must be set in .env.test. See .env.test.example.",
  );
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
// NODE_ENV is read-only under Next's type augmentation; assign via index.
(process.env as Record<string, string>).NODE_ENV = "test";

export default async function setup() {
  const { seedFixture } = await import("./fixtures/seed");
  await seedFixture();

  // Teardown: close the postgres pool so the worker process exits cleanly.
  return async () => {
    const { db } = await import("@/db/client");
    const client = (db as unknown as { $client?: { end?: () => Promise<void> } }).$client;
    if (client?.end) await client.end();
  };
}
