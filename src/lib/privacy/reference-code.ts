// Step 65 Session B — DSAR reference-code generator.
//
// Format: `DSAR-{YYYY}-{6 chars [0-9A-Z]}` (e.g. `DSAR-2026-A3F9X2`).
// Random base36 — collision odds at our request volume are negligible
// (36^6 ≈ 2.2B). The POST handler retries once on the unique-constraint
// violation just in case.

import { randomInt } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SUFFIX_LEN = 6;

export function generateDsarReferenceCode(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  let suffix = "";
  for (let i = 0; i < SUFFIX_LEN; i++) {
    suffix += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return `DSAR-${year}-${suffix}`;
}
