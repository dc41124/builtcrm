import { createHash } from "node:crypto";

// Invitation tokens are hashed at rest (SHA-256). The DB stores only the
// digest; at write time we hash before insert, at read time we hash the
// incoming plaintext and compare against the stored digest.
//
// SHA-256 (not a password hash like bcrypt) is the right primitive here:
// invitation tokens are 256-bit random bearer credentials that are already
// high-entropy — no password-style brute-force mitigation is needed, and
// equality comparison must be fast on every redemption.
//
// See docs/specs/security_posture.md §2.

export function hashInvitationToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
