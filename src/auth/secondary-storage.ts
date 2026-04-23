// Better Auth `secondaryStorage` adapter backed by Upstash Redis.
//
// Sessions live in Redis, not Postgres. A Postgres breach does not reveal
// session tokens — the DB simply has no session rows.
// See docs/specs/security_posture.md §4.
//
// Key namespacing: all keys written through this adapter are prefixed with
// `bauth:`. The Upstash instance is shared with non-auth consumers
// (currently src/jobs/upload-request-reminder.ts, which uses `reminders:`).
// New consumers of the shared instance must pick a distinct prefix.

import { Redis } from "@upstash/redis";

// Better Auth's SecondaryStorage contract. Re-declared locally rather than
// imported from @better-auth/core — that package is a nested dependency of
// better-auth, not a direct dependency of this repo. TypeScript's structural
// typing validates the shape at the assignment site in config.ts; if the
// library contract changes, the assignment fails there with a clear error.
type Awaitable<T> = T | Promise<T>;

export interface SecondaryStorage {
  get: (key: string) => Awaitable<unknown>;
  set: (
    key: string,
    value: string,
    ttl?: number | undefined,
  ) => Awaitable<void | null | unknown>;
  delete: (key: string) => Awaitable<void | null | string>;
}

// Dedicated Redis client — separate from @/lib/redis. Better Auth stores
// JSON-stringified values and expects opaque strings back; @/lib/redis has
// automaticDeserialization enabled (other callers want parsed objects).
// Flipping that globally would break them, so this client has its own
// instance with deserialization off.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  automaticDeserialization: false,
});

const PREFIX = "bauth:";

export const betterAuthSecondaryStorage: SecondaryStorage = {
  async get(key) {
    return await redis.get(PREFIX + key);
  },
  async set(key, value, ttl) {
    if (ttl !== undefined) {
      await redis.set(PREFIX + key, value, { ex: ttl });
    } else {
      await redis.set(PREFIX + key, value);
    }
  },
  async delete(key) {
    await redis.del(PREFIX + key);
  },
};
