import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { IntegrationProviderKey } from "@/domain/loaders/integrations";

// Signed state parameter for OAuth 2.0 authorization_code flows.
//
// Format: `base64url(json) + "." + base64url(hmac)` where
//   payload = { org, user, provider, nonce, iat }
//   hmac    = HMAC-SHA256(payload_bytes, INTEGRATION_STATE_SECRET)
//
// On callback we:
//   1. Split on "." → parts must be exactly two
//   2. Recompute HMAC and constant-time compare
//   3. Check iat is within STATE_TTL_MS
//   4. (Optional future step) check nonce against a Redis TTL key to prevent
//      replay — not wired here to keep Step 25 dependency-free; the 5-minute
//      freshness window plus single-use-by-design callback URLs make replay
//      a narrow surface. If CSRF review flags it, add Upstash in Step 26.

const STATE_TTL_MS = 5 * 60_000; // 5 minutes
const HMAC_ALGO = "sha256";

let cachedSecret: Buffer | null = null;

function loadSecret(): Buffer {
  if (cachedSecret) return cachedSecret;
  const raw = process.env.INTEGRATION_STATE_SECRET;
  if (!raw) {
    throw new Error(
      "INTEGRATION_STATE_SECRET is not set. Generate 32 random bytes and store them base64-encoded — see README.",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length < 16) {
    throw new Error(
      "INTEGRATION_STATE_SECRET must decode to at least 16 bytes. Regenerate with `openssl rand -base64 32`.",
    );
  }
  cachedSecret = buf;
  return buf;
}

export type StatePayload = {
  org: string;
  user: string;
  provider: IntegrationProviderKey;
  nonce: string;
  iat: number;
};

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = (4 - (input.length % 4)) % 4;
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(base64, "base64");
}

function sign(payloadB64: string): string {
  return b64urlEncode(
    createHmac(HMAC_ALGO, loadSecret()).update(payloadB64).digest(),
  );
}

export function encodeState(
  input: Omit<StatePayload, "nonce" | "iat">,
): string {
  const payload: StatePayload = {
    ...input,
    nonce: randomBytes(16).toString("hex"),
    iat: Date.now(),
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

export type DecodedState =
  | { ok: true; payload: StatePayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function decodeState(state: string | null | undefined): DecodedState {
  if (!state) return { ok: false, reason: "malformed" };
  const parts = state.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [payloadB64, sig] = parts;

  const expected = sign(payloadB64);
  const sigBuf = Buffer.from(sig, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expectedBuf.length) {
    return { ok: false, reason: "bad_signature" };
  }
  if (!timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: StatePayload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8")) as StatePayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (
    typeof payload !== "object" ||
    typeof payload.org !== "string" ||
    typeof payload.user !== "string" ||
    typeof payload.provider !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.iat !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  if (Date.now() - payload.iat > STATE_TTL_MS) {
    return { ok: false, reason: "expired" };
  }
  return { ok: true, payload };
}
