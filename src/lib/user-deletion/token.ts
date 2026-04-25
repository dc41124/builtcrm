import { createHash, randomBytes } from "node:crypto";

// Cancel-deletion tokens follow the same pattern as invitation tokens
// (src/lib/invitations/token.ts): a 32-byte random bearer credential
// hashed at rest with SHA-256. Plaintext goes out in the confirmation
// email; the digest is what users.pending_deletion_token_hash compares.
//
// See docs/specs/user_deletion_and_export_plan.md.

export function generateCancelDeletionToken(): {
  plaintext: string;
  hash: string;
} {
  const plaintext = randomBytes(32).toString("base64url");
  const hash = hashCancelDeletionToken(plaintext);
  return { plaintext, hash };
}

export function hashCancelDeletionToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
