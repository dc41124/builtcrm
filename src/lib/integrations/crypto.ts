import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM symmetric encryption for sensitive at-rest values.
// We store `base64(iv || authTag || ciphertext)` in a single text column so
// a value round-trips without needing a separate IV column.
//
// Two key namespaces are in use:
//   - INTEGRATION_ENCRYPTION_KEY — OAuth access/refresh tokens
//     (integration_connections.access_token_enc / refresh_token_enc)
//   - TAX_ID_ENCRYPTION_KEY — organizations.tax_id (see
//     docs/specs/tax_id_encryption_plan.md). Held separately so a leak of
//     one key does not compromise the other.
//
// Each key is 32 bytes (256 bits), supplied base64-encoded. Rotating any
// key requires re-encrypting every row protected by it — see
// docs/specs/security_posture.md §3 for rotation impact.

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit IV recommended for GCM
const TAG_LEN = 16; // 128-bit auth tag
const KEY_LEN = 32; // AES-256

const keyCache = new Map<string, Buffer>();

function loadKey(envVarName: string): Buffer {
  const cached = keyCache.get(envVarName);
  if (cached) return cached;
  const raw = process.env[envVarName];
  if (!raw) {
    throw new Error(
      `${envVarName} is not set. Generate 32 random bytes and store them base64-encoded (\`openssl rand -base64 32\`).`,
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LEN) {
    throw new Error(
      `${envVarName} must decode to exactly ${KEY_LEN} bytes (got ${buf.length}). Regenerate with \`openssl rand -base64 32\`.`,
    );
  }
  keyCache.set(envVarName, buf);
  return buf;
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

function decryptWithKey(stored: string, key: Buffer): string {
  const buf = Buffer.from(stored, "base64");
  if (buf.length <= IV_LEN + TAG_LEN) {
    throw new Error("Encrypted payload is too short to contain IV + tag");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

// --------------------------------------------------------------------------
// Integration tokens — OAuth access/refresh tokens
// --------------------------------------------------------------------------

export function encryptToken(plaintext: string): string {
  if (!plaintext) throw new Error("encryptToken called with empty plaintext");
  return encryptWithKey(plaintext, loadKey("INTEGRATION_ENCRYPTION_KEY"));
}

export function decryptToken(stored: string): string {
  if (!stored) throw new Error("decryptToken called with empty ciphertext");
  return decryptWithKey(stored, loadKey("INTEGRATION_ENCRYPTION_KEY"));
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

// --------------------------------------------------------------------------
// Tax IDs — organizations.tax_id
// See docs/specs/tax_id_encryption_plan.md.
// --------------------------------------------------------------------------

export function encryptTaxId(plaintext: string): string {
  if (!plaintext) throw new Error("encryptTaxId called with empty plaintext");
  return encryptWithKey(plaintext, loadKey("TAX_ID_ENCRYPTION_KEY"));
}

export function decryptTaxId(stored: string): string {
  if (!stored) throw new Error("decryptTaxId called with empty ciphertext");
  return decryptWithKey(stored, loadKey("TAX_ID_ENCRYPTION_KEY"));
}

export function encryptTaxIdOrNull(plaintext: string | null | undefined): string | null {
  if (!plaintext) return null;
  return encryptTaxId(plaintext);
}

export function decryptTaxIdOrNull(stored: string | null | undefined): string | null {
  if (!stored) return null;
  return decryptTaxId(stored);
}
