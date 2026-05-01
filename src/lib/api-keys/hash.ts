import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Step 58 — API key generation + deterministic hashing.
//
// Format: `bcrm_live_` + 32 random base62 chars = 42 chars total.
// Sandbox mode would use `bcrm_test_` (deferred — see Step 58 stubs).
// 190 bits of entropy makes brute-force/rainbow-table attacks
// impractical without bcrypt's slow comparison; we use HMAC-SHA256
// with a server-side pepper for indexed-equality lookup instead.
// See src/db/schema/apiKeys.ts docstring for the rationale.

const KEY_PREFIX = "bcrm_live_";
const KEY_PREFIX_LENGTH = KEY_PREFIX.length; // 10
const RANDOM_TAIL_LENGTH = 32;
const FULL_KEY_LENGTH = KEY_PREFIX_LENGTH + RANDOM_TAIL_LENGTH; // 42
const STORED_PREFIX_LENGTH = 16; // KEY_PREFIX (10) + 6 chars of tail

const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export type GeneratedApiKey = {
  /** Full key — surfaced to the user exactly once at creation. */
  fullKey: string;
  /** First 16 chars, safe to display in lists. */
  keyPrefix: string;
  /** HMAC-SHA256 hex digest, stored in api_keys.key_hash. */
  keyHash: string;
};

/**
 * Reads `API_KEY_PEPPER` from env, throws a helpful message if absent.
 * The pepper rotates on the same blast-radius tier as
 * BETTER_AUTH_SECRET — losing it invalidates every issued API key.
 */
function requirePepper(): string {
  const pepper = process.env.API_KEY_PEPPER;
  if (!pepper || pepper.length < 32) {
    throw new Error(
      "API_KEY_PEPPER env var is required (min 32 chars). Generate with `openssl rand -base64 48`.",
    );
  }
  return pepper;
}

/**
 * Crypto-quality random base62 string. Uses rejection sampling on
 * `randomBytes` to avoid modulo bias — important when the pool size
 * (256) doesn't divide evenly by the alphabet size (62).
 */
function randomBase62(length: number): string {
  const out: string[] = [];
  // Oversample by ~30% to keep the inner while loop short — 62 / 256
  // wastes ~24% of bytes on rejection.
  const bufferSize = Math.ceil(length * 1.4);
  while (out.length < length) {
    const buf = randomBytes(bufferSize);
    for (let i = 0; i < buf.length && out.length < length; i++) {
      const byte = buf[i];
      // Largest multiple of 62 that fits in a byte = 248. Reject 248-255.
      if (byte < 248) {
        out.push(BASE62_ALPHABET[byte % 62]);
      }
    }
  }
  return out.join("");
}

/** HMAC-SHA256 of the full key with the server pepper, returned as hex. */
export function hashApiKey(fullKey: string): string {
  const pepper = requirePepper();
  return createHmac("sha256", pepper).update(fullKey).digest("hex");
}

/**
 * Generate a new API key. Returns the full key (one-time-display),
 * the prefix to store + display, and the hash to persist.
 */
export function generateApiKey(): GeneratedApiKey {
  const tail = randomBase62(RANDOM_TAIL_LENGTH);
  const fullKey = `${KEY_PREFIX}${tail}`;
  return {
    fullKey,
    keyPrefix: fullKey.slice(0, STORED_PREFIX_LENGTH),
    keyHash: hashApiKey(fullKey),
  };
}

/**
 * Constant-time comparison of two hex digests. Caller-side
 * defense-in-depth for the auth helper — the indexed lookup already
 * uses an exact-match SQL predicate, but if a future code path ever
 * compares hashes in app code, this is the helper to reach for.
 */
export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

/**
 * Validates the surface shape of an inbound bearer token before doing
 * a DB lookup. Returns the full key on success, null otherwise. Cheap
 * filter: rejects obvious garbage without touching the DB.
 */
export function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  const token = match[1];
  if (token.length !== FULL_KEY_LENGTH) return null;
  if (!token.startsWith(KEY_PREFIX)) return null;
  // Tail must be base62 — a regex check is faster than the DB roundtrip.
  if (!/^[0-9A-Za-z]+$/.test(token.slice(KEY_PREFIX_LENGTH))) return null;
  return token;
}
