// Step 65 — privacy reference-code generators.
//
// Format: `{PREFIX}-{YYYY}-{6 chars [0-9A-Z]}` (e.g. `DSAR-2026-A3F9X2`,
// `BR-2026-9KZ4MT`). Random base36 — collision odds at our request
// volume are negligible (36^6 ≈ 2.2B). Insert handlers retry once on
// the unique-constraint violation just in case.

import { randomInt } from "node:crypto";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SUFFIX_LEN = 6;

function generateSuffix(): string {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LEN; i++) {
    suffix += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return suffix;
}

export function generateDsarReferenceCode(now: Date = new Date()): string {
  return `DSAR-${now.getUTCFullYear()}-${generateSuffix()}`;
}

export function generateBreachReferenceCode(now: Date = new Date()): string {
  return `BR-${now.getUTCFullYear()}-${generateSuffix()}`;
}
