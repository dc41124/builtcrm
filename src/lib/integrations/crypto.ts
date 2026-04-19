import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM token encryption for integration access/refresh tokens.
// The DB columns (integration_connections.access_token_enc / refresh_token_enc)
// are declared as text; we store `base64(iv || authTag || ciphertext)` so a
// single column round-trips without needing a separate IV column.
//
// Key: 32 bytes (256 bits) read from INTEGRATION_ENCRYPTION_KEY, which must be
// supplied as a base64-encoded string. Rotating the key requires re-encrypting
// all existing rows — leave that for a dedicated rotation job when the need
// actually arises.

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit IV recommended for GCM
const TAG_LEN = 16; // 128-bit auth tag
const KEY_LEN = 32; // AES-256

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "INTEGRATION_ENCRYPTION_KEY is not set. Generate 32 random bytes and store them base64-encoded — see README.",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LEN) {
    throw new Error(
      `INTEGRATION_ENCRYPTION_KEY must decode to exactly ${KEY_LEN} bytes (got ${buf.length}). Regenerate with \`openssl rand -base64 32\`.`,
    );
  }
  cachedKey = buf;
  return buf;
}

export function encryptToken(plaintext: string): string {
  if (!plaintext) throw new Error("encryptToken called with empty plaintext");
  const key = loadKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptToken(stored: string): string {
  if (!stored) throw new Error("decryptToken called with empty ciphertext");
  const key = loadKey();
  const buf = Buffer.from(stored, "base64");
  if (buf.length <= IV_LEN + TAG_LEN) {
    throw new Error("Encrypted token payload is too short to contain IV + tag");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

// Convenience: encrypt only when a value is present. Used when OAuth responses
// omit a refresh_token (e.g. QuickBooks on re-auth) — null passes through.
export function encryptTokenOrNull(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  return encryptToken(plaintext);
}

export function decryptTokenOrNull(stored: string | null | undefined): string | null {
  if (!stored) return null;
  return decryptToken(stored);
}
