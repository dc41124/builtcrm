import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// Transmittal access tokens. Bearer credentials embedded in the share
// URL sent to external recipients — e.g. /t/<plaintext-token>. The DB
// stores the SHA-256 digest only; plaintext is generated at send, used
// to render the share URL, and discarded.
//
// Security properties:
//   - 256 bits of entropy (32 random bytes, url-safe base64 → 43 chars)
//   - SHA-256 digest at rest (matches src/lib/invitations/token.ts)
//   - Constant-time compare on validation
//
// Why SHA-256 and not bcrypt: these are high-entropy random bearer
// credentials, not user-chosen passwords. Brute-force mitigation is
// unnecessary; every validation needs an indexed DB lookup that must
// be fast.

const TOKEN_BYTES = 32;

// Generate a URL-safe plaintext token. Caller persists the digest;
// plaintext goes into the share URL and is otherwise forgotten.
export function generateAccessToken(): { plaintext: string; digest: string } {
  const bytes = randomBytes(TOKEN_BYTES);
  const plaintext = bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const digest = hashToken(plaintext);
  return { plaintext, digest };
}

// Hash a plaintext token. Used on write (to compute what's stored) and
// on read (to look up the recipient row).
export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

// Constant-time compare two digests. Used when we fetched a row by
// indexed digest match and want to defend against the paranoid case
// of a timing side-channel on the primary lookup.
export function digestsEqual(a: string, b: string): boolean {
  const buf1 = Buffer.from(a, "hex");
  const buf2 = Buffer.from(b, "hex");
  if (buf1.length !== buf2.length) return false;
  return timingSafeEqual(buf1, buf2);
}

// Build the outward-facing share URL embedded in emails and copied
// from the contractor's detail view. The token is plaintext; it is
// NEVER persisted in this form.
export function buildShareUrl(baseUrl: string, plaintext: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/t/${plaintext}`;
}
